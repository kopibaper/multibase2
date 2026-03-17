/**
 * ExtensionUpdateChecker
 *
 * Background service that runs weekly and checks whether newer versions of
 * installed extensions are available.  For each Extension in the catalog it
 * compares the stored `version` against `latestVersion` (populated either by
 * a remote registry call or by the seed script).  When a newer version is
 * detected the `latestVersion` column is updated so the frontend can show an
 * "Update available" badge.
 *
 * In a production setup `fetchLatestVersion` would call a real registry API.
 * Here it is a no-op stub that keeps the column in sync with the seeded data.
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface UpdateAvailable {
  extensionId: string;
  currentVersion: string;
  latestVersion: string;
}

export class ExtensionUpdateChecker extends EventEmitter {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  /** Start the weekly check loop.  Also runs once immediately on startup. */
  start(): void {
    logger.info('ExtensionUpdateChecker: starting (interval = 7 days)');
    // Run once after a short delay so the server finishes booting first
    setTimeout(() => this.runCheck(), 30_000);
    this.timer = setInterval(() => this.runCheck(), WEEKLY_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('ExtensionUpdateChecker: stopped');
    }
  }

  /** Run a full catalog scan and emit `update:available` events. */
  async runCheck(): Promise<UpdateAvailable[]> {
    try {
      logger.info('ExtensionUpdateChecker: running version check…');
      const extensions = await this.prisma.extension.findMany({
        select: { id: true, version: true, latestVersion: true, manifestUrl: true },
      });

      const updates: UpdateAvailable[] = [];

      for (const ext of extensions) {
        try {
          const latest = await this.fetchLatestVersion(ext.id, ext.manifestUrl, ext.version);
          if (latest && latest !== ext.latestVersion) {
            await this.prisma.extension.update({
              where: { id: ext.id },
              data: { latestVersion: latest },
            });
          }
          if (latest && this.isNewer(latest, ext.version)) {
            const update: UpdateAvailable = {
              extensionId: ext.id,
              currentVersion: ext.version,
              latestVersion: latest,
            };
            updates.push(update);
            this.emit('update:available', update);
          }
        } catch (err: any) {
          logger.debug(`ExtensionUpdateChecker: skipped ${ext.id} – ${err.message}`);
        }
      }

      logger.info(`ExtensionUpdateChecker: check complete — ${updates.length} update(s) available`);
      return updates;
    } catch (error: any) {
      logger.error('ExtensionUpdateChecker: error during check:', error);
      return [];
    }
  }

  /**
   * Fetch the latest published version for an extension.
   *
   * In production this would call:
   *   GET https://registry.multibase.dev/extensions/:id/latest
   * or parse the remote manifest JSON.
   *
   * Here we return `currentVersion` (no-op) so no false positives are logged
   * during development.  Replace the body with a real HTTP call when the
   * registry is live.
   */
  private async fetchLatestVersion(
    _id: string,
    _manifestUrl: string,
    currentVersion: string
  ): Promise<string> {
    // TODO: replace with actual registry call once live
    // const res = await fetch(`https://registry.multibase.dev/api/extensions/${_id}/latest`);
    // const json = await res.json();
    // return json.version;
    return currentVersion;
  }

  /**
   * Semantic version comparison — returns true if `candidate` is strictly
   * newer than `current`.  Supports "MAJOR.MINOR.PATCH" format.
   */
  private isNewer(candidate: string, current: string): boolean {
    const parse = (v: string) =>
      v
        .replace(/^[^0-9]*/, '') // strip leading non-numeric (e.g. "v")
        .split('.')
        .map((n) => parseInt(n, 10) || 0);

    const [caMaj, caMin, caPat] = parse(candidate);
    const [cuMaj, cuMin, cuPat] = parse(current);

    if (caMaj !== cuMaj) return caMaj > cuMaj;
    if (caMin !== cuMin) return caMin > cuMin;
    return caPat > cuPat;
  }
}
