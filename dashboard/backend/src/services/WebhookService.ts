import InstanceManager from './InstanceManager';
import { logger } from '../utils/logger';

export interface WebhookConfig {
  name: string;
  tableSchema: string;
  tableName: string;
  events: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class WebhookService {
  constructor(private instanceManager: InstanceManager) {}

  /** Safely quote a Postgres identifier */
  private ident(s: string): string {
    return '"' + s.replace(/"/g, '""') + '"';
  }

  /** Safely quote a Postgres string literal */
  private literal(s: string): string {
    return "'" + s.replace(/'/g, "''") + "'";
  }

  /** Produce a safe function/trigger name from user input */
  private safeName(s: string): string {
    return s.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 50);
  }

  /** Create _mb_meta schema and webhooks table if not present */
  private async ensureMetaSchema(instanceName: string): Promise<void> {
    const sql = `
      CREATE SCHEMA IF NOT EXISTS _mb_meta;
      CREATE TABLE IF NOT EXISTS _mb_meta.webhooks (
        id          SERIAL PRIMARY KEY,
        name        TEXT UNIQUE NOT NULL,
        table_schema TEXT NOT NULL DEFAULT 'public',
        table_name  TEXT NOT NULL,
        events      TEXT[] NOT NULL,
        url         TEXT NOT NULL,
        method      TEXT NOT NULL DEFAULT 'POST',
        headers     JSONB NOT NULL DEFAULT '{}',
        timeout_ms  INTEGER NOT NULL DEFAULT 5000,
        enabled     BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    const result = await this.instanceManager.executeSQL(instanceName, sql);
    if (result.error) throw new Error(result.error);
  }

  async listWebhooks(instanceName: string) {
    await this.ensureMetaSchema(instanceName);
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT id, name, table_schema, table_name, events, url, method, headers, timeout_ms, enabled, created_at
       FROM _mb_meta.webhooks ORDER BY id;`
    );
    if (result.error) throw new Error(result.error);
    return result.rows;
  }

  async createWebhook(instanceName: string, config: WebhookConfig) {
    await this.ensureMetaSchema(instanceName);

    const {
      name,
      tableSchema,
      tableName,
      events,
      url,
      method = 'POST',
      headers = {},
      timeoutMs = 5000,
    } = config;

    // Validate inputs
    if (!name || !tableName || !url || events.length === 0) {
      throw new Error('name, tableName, url, and at least one event are required');
    }
    const allowedEvents = new Set(['INSERT', 'UPDATE', 'DELETE']);
    for (const e of events) {
      if (!allowedEvents.has(e)) throw new Error(`Invalid event: ${e}`);
    }

    const safeFnName = `_mb_wh_${this.safeName(name)}`;
    const headersJson = this.literal(JSON.stringify(headers));
    const eventsArray = events.map((e) => this.literal(e)).join(',');

    // Insert metadata row
    const insertResult = await this.instanceManager.executeSQL(
      instanceName,
      `INSERT INTO _mb_meta.webhooks (name, table_schema, table_name, events, url, method, headers, timeout_ms)
       VALUES (${this.literal(name)}, ${this.literal(tableSchema)}, ${this.literal(tableName)},
               ARRAY[${eventsArray}]::text[], ${this.literal(url)},
               ${this.literal(method)}, ${headersJson}::jsonb, ${timeoutMs})
       RETURNING id;`
    );
    if (insertResult.error) throw new Error(insertResult.error);

    // Check if pg_net extension is available
    const extCheck = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT 1 FROM pg_extension WHERE extname = 'pg_net';`
    );
    const hasPgNet = extCheck.rows.length > 0;

    if (hasPgNet) {
      // Create the trigger function
      const fnSql = `
        CREATE OR REPLACE FUNCTION _mb_meta.${this.ident(safeFnName)}()
        RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
          _payload jsonb;
        BEGIN
          _payload := jsonb_build_object(
            'type',       TG_OP,
            'table',      TG_TABLE_NAME,
            'schema',     TG_TABLE_SCHEMA,
            'record',     CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
            'old_record', CASE WHEN TG_OP = 'UPDATE'  THEN to_jsonb(OLD) ELSE NULL END
          );
          PERFORM net.http_post(
            url                  := ${this.literal(url)},
            body                 := _payload::text::bytea,
            headers              := ${headersJson}::jsonb,
            timeout_milliseconds := ${timeoutMs}
          );
          RETURN NEW;
        END;
        $$;
      `;
      const fnResult = await this.instanceManager.executeSQL(instanceName, fnSql);
      if (fnResult.error) {
        logger.warn(`Could not create trigger function for webhook "${name}": ${fnResult.error}`);
      } else {
        // Create the trigger
        const eventStr = events.join(' OR ');
        const trigSql = `
          CREATE TRIGGER ${this.ident(safeFnName)}
          AFTER ${eventStr}
          ON ${this.ident(tableSchema)}.${this.ident(tableName)}
          FOR EACH ROW EXECUTE FUNCTION _mb_meta.${this.ident(safeFnName)}();
        `;
        const trigResult = await this.instanceManager.executeSQL(instanceName, trigSql);
        if (trigResult.error) {
          logger.warn(`Could not create trigger for webhook "${name}": ${trigResult.error}`);
        }
      }
    }

    return { id: insertResult.rows[0]?.id, hasTrigger: hasPgNet };
  }

  async deleteWebhook(instanceName: string, webhookId: number) {
    await this.ensureMetaSchema(instanceName);

    const getResult = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT name, table_schema, table_name FROM _mb_meta.webhooks WHERE id = ${webhookId};`
    );
    if (getResult.error) throw new Error(getResult.error);
    if (getResult.rows.length === 0) throw new Error('Webhook not found');

    const { name, table_schema, table_name } = getResult.rows[0];
    const safeFnName = `_mb_wh_${this.safeName(name)}`;

    // Drop trigger (ignore errors – table may have been dropped by user)
    await this.instanceManager.executeSQL(
      instanceName,
      `DROP TRIGGER IF EXISTS ${this.ident(safeFnName)} ON ${this.ident(table_schema)}.${this.ident(table_name)};`
    );

    // Drop trigger function
    await this.instanceManager.executeSQL(
      instanceName,
      `DROP FUNCTION IF EXISTS _mb_meta.${this.ident(safeFnName)}();`
    );

    // Delete metadata row
    const deleteResult = await this.instanceManager.executeSQL(
      instanceName,
      `DELETE FROM _mb_meta.webhooks WHERE id = ${webhookId};`
    );
    if (deleteResult.error) throw new Error(deleteResult.error);

    return { success: true };
  }

  async toggleWebhook(instanceName: string, webhookId: number, enabled: boolean) {
    await this.ensureMetaSchema(instanceName);

    const result = await this.instanceManager.executeSQL(
      instanceName,
      `UPDATE _mb_meta.webhooks SET enabled = ${enabled} WHERE id = ${webhookId} RETURNING *;`
    );
    if (result.error) throw new Error(result.error);
    if (result.rows.length === 0) throw new Error('Webhook not found');

    const webhook = result.rows[0];
    const safeFnName = `_mb_wh_${this.safeName(webhook.name)}`;

    // Enable/disable the Postgres trigger if it exists
    await this.instanceManager.executeSQL(
      instanceName,
      `ALTER TABLE ${this.ident(webhook.table_schema)}.${this.ident(webhook.table_name)}
       ${enabled ? 'ENABLE' : 'DISABLE'} TRIGGER ${this.ident(safeFnName)};`
    );

    return webhook;
  }
}
