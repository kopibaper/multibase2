import InstanceManager from './InstanceManager';
import { logger } from '../utils/logger';

export interface VectorColumnConfig {
  tableSchema: string;
  tableName: string;
  columnName: string;
  dimension: number;
}

export interface VectorIndexConfig {
  tableSchema: string;
  tableName: string;
  columnName: string;
  indexType: 'ivfflat' | 'hnsw';
  metric: 'cosine' | 'l2' | 'ip';
  lists?: number; // ivfflat only
}

export interface SimilaritySearchConfig {
  tableSchema: string;
  tableName: string;
  columnName: string;
  vector: number[];
  k: number;
  metric: 'cosine' | 'l2' | 'ip';
}

export class VectorService {
  constructor(private instanceManager: InstanceManager) {}

  private ident(s: string): string {
    return '"' + s.replace(/"/g, '""') + '"';
  }

  async getStatus(instanceName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`
    );
    if (result.error) throw new Error(result.error);
    return { enabled: result.rows.length > 0, extension: result.rows[0] || null };
  }

  async enableExtension(instanceName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `CREATE EXTENSION IF NOT EXISTS vector;`
    );
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async listVectorColumns(instanceName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT
         c.table_schema,
         c.table_name,
         c.column_name
       FROM information_schema.columns c
       WHERE c.udt_name = 'vector'
       ORDER BY c.table_schema, c.table_name, c.column_name;`
    );
    if (result.error) throw new Error(result.error);
    return result.rows;
  }

  async addVectorColumn(instanceName: string, config: VectorColumnConfig) {
    const { tableSchema, tableName, columnName, dimension } = config;

    if (!Number.isInteger(dimension) || dimension < 1 || dimension > 2000) {
      throw new Error('Dimension must be an integer between 1 and 2000');
    }

    const sql = `
      ALTER TABLE ${this.ident(tableSchema)}.${this.ident(tableName)}
      ADD COLUMN ${this.ident(columnName)} vector(${dimension});
    `;
    const result = await this.instanceManager.executeSQL(instanceName, sql);
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async listIndexes(instanceName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT indexname, tablename, schemaname, indexdef
       FROM pg_indexes
       WHERE indexdef ILIKE '%ivfflat%' OR indexdef ILIKE '%hnsw%'
       ORDER BY schemaname, tablename, indexname;`
    );
    if (result.error) throw new Error(result.error);
    return result.rows;
  }

  async createIndex(instanceName: string, config: VectorIndexConfig) {
    const { tableSchema, tableName, columnName, indexType, metric, lists = 100 } = config;

    const opClassMap: Record<string, string> = {
      cosine: 'vector_cosine_ops',
      l2:     'vector_l2_ops',
      ip:     'vector_ip_ops',
    };
    const opClass = opClassMap[metric] ?? 'vector_cosine_ops';

    let sql: string;
    if (indexType === 'hnsw') {
      sql = `CREATE INDEX ON ${this.ident(tableSchema)}.${this.ident(tableName)}
             USING hnsw (${this.ident(columnName)} ${opClass});`;
    } else {
      sql = `CREATE INDEX ON ${this.ident(tableSchema)}.${this.ident(tableName)}
             USING ivfflat (${this.ident(columnName)} ${opClass})
             WITH (lists = ${lists});`;
    }

    const result = await this.instanceManager.executeSQL(instanceName, sql);
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async dropIndex(instanceName: string, indexName: string) {
    const sql = `DROP INDEX IF EXISTS ${this.ident(indexName)};`;
    const result = await this.instanceManager.executeSQL(instanceName, sql);
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async similaritySearch(instanceName: string, config: SimilaritySearchConfig) {
    const { tableSchema, tableName, columnName, vector, k, metric } = config;

    if (!Array.isArray(vector) || vector.some((v) => typeof v !== 'number')) {
      throw new Error('vector must be an array of numbers');
    }
    if (!Number.isInteger(k) || k < 1 || k > 1000) {
      throw new Error('k must be an integer between 1 and 1000');
    }

    const operatorMap: Record<string, string> = {
      cosine: '<=>',
      l2:     '<->',
      ip:     '<#>',
    };
    const operator = operatorMap[metric] ?? '<=>';

    const vectorLiteral = `'[${vector.join(',')}]'::vector`;

    const sql = `
      SELECT *, (${this.ident(columnName)} ${operator} ${vectorLiteral}) AS similarity_score
      FROM ${this.ident(tableSchema)}.${this.ident(tableName)}
      WHERE ${this.ident(columnName)} IS NOT NULL
      ORDER BY ${this.ident(columnName)} ${operator} ${vectorLiteral}
      LIMIT ${k};
    `;
    const result = await this.instanceManager.executeSQL(instanceName, sql);
    if (result.error) throw new Error(result.error);
    return result.rows;
  }
}
