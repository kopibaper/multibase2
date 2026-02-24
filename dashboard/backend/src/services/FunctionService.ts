import fs from 'fs-extra';
import path from 'path';
import { DockerManager } from './DockerManager';

const VOLUMES_DIR = process.env.VOLUMES_DIR || path.join(process.cwd(), 'volumes');

export class FunctionService {
  constructor(
    private dockerManager: DockerManager,
    private projectsPath: string = path.resolve(path.join(process.cwd(), '../../projects'))
  ) {}

  private getFunctionsRootDir(instanceName: string): string {
    const projectFunctionsMainDir = path.join(
      this.projectsPath,
      instanceName,
      'volumes',
      'functions',
      'main'
    );
    if (fs.existsSync(projectFunctionsMainDir)) {
      return path.dirname(projectFunctionsMainDir);
    }

    const projectFunctionsDir = path.join(this.projectsPath, instanceName, 'volumes', 'functions');
    if (fs.existsSync(projectFunctionsDir)) {
      return projectFunctionsDir;
    }

    const legacyFunctionsMainDir = path.join(VOLUMES_DIR, instanceName, 'functions', 'main');
    if (fs.existsSync(legacyFunctionsMainDir)) {
      return path.dirname(legacyFunctionsMainDir);
    }

    return path.join(VOLUMES_DIR, instanceName, 'functions');
  }

  private getLegacyMainDir(functionsRootDir: string): string {
    return path.join(functionsRootDir, 'main');
  }

  private sanitizeFunctionName(name: string): string {
    const normalized = name.trim();
    if (!normalized || normalized.includes('..') || normalized.includes('\\') || normalized.includes('/')) {
      throw new Error('Invalid function name');
    }

    return normalized;
  }

  private resolveFunctionPath(functionsRootDir: string, name: string): string {
    const safeName = this.sanitizeFunctionName(name);
    const legacyMainDir = this.getLegacyMainDir(functionsRootDir);

    if (safeName.endsWith('.ts') || safeName.endsWith('.js')) {
      const directPath = path.join(functionsRootDir, safeName);
      const legacyPath = path.join(legacyMainDir, safeName);

      if (fs.existsSync(directPath) || !fs.existsSync(legacyPath)) {
        return directPath;
      }

      return legacyPath;
    }

    const directDirPath = path.join(functionsRootDir, safeName, 'index.ts');
    const legacyDirPath = path.join(legacyMainDir, safeName, 'index.ts');

    if (fs.existsSync(directDirPath) || !fs.existsSync(legacyDirPath)) {
      return directDirPath;
    }

    return legacyDirPath;
  }

  async listFunctions(instanceName: string): Promise<string[]> {
    const functionsRootDir = this.getFunctionsRootDir(instanceName);
    await fs.ensureDir(functionsRootDir);

    const mainDir = this.getLegacyMainDir(functionsRootDir);
    const entries = await fs.readdir(functionsRootDir, { withFileTypes: true });
    const functions: string[] = [];

    for (const entry of entries) {
      if (entry.name === 'main') {
        continue;
      }

      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        functions.push(entry.name);
      }

      if (entry.isDirectory()) {
        const indexTs = path.join(functionsRootDir, entry.name, 'index.ts');
        const indexJs = path.join(functionsRootDir, entry.name, 'index.js');
        if ((await fs.pathExists(indexTs)) || (await fs.pathExists(indexJs))) {
          functions.push(entry.name);
        }
      }
    }

    if (functions.length === 0 && (await fs.pathExists(mainDir))) {
      const legacyEntries = await fs.readdir(mainDir, { withFileTypes: true });
      for (const entry of legacyEntries) {
        if (entry.name === 'index.ts' || entry.name === 'index.js') {
          continue;
        }

        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          functions.push(entry.name);
        }

        if (entry.isDirectory()) {
          const indexTs = path.join(mainDir, entry.name, 'index.ts');
          const indexJs = path.join(mainDir, entry.name, 'index.js');
          if ((await fs.pathExists(indexTs)) || (await fs.pathExists(indexJs))) {
            functions.push(entry.name);
          }
        }
      }
    }

    return functions.sort((a, b) => a.localeCompare(b));
  }

  async getFunction(instanceName: string, name: string): Promise<string> {
    const filePath = this.resolveFunctionPath(this.getFunctionsRootDir(instanceName), name);
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`Function ${name} not found`);
    }
    return fs.readFile(filePath, 'utf-8');
  }

  async saveFunction(instanceName: string, name: string, code: string): Promise<void> {
    const functionsRootDir = this.getFunctionsRootDir(instanceName);
    await fs.ensureDir(functionsRootDir);

    const safeName = this.sanitizeFunctionName(name);
    let filePath: string;

    if (safeName.endsWith('.ts') || safeName.endsWith('.js')) {
      filePath = path.join(functionsRootDir, safeName);
    } else {
      filePath = path.join(functionsRootDir, safeName, 'index.ts');
    }

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, code);
  }

  async deleteFunction(instanceName: string, name: string): Promise<void> {
    const filePath = this.resolveFunctionPath(this.getFunctionsRootDir(instanceName), name);
    if (await fs.pathExists(filePath)) {
      await fs.unlink(filePath);
    }

    if (!name.endsWith('.ts') && !name.endsWith('.js')) {
      const functionDir = path.dirname(filePath);
      const remaining = await fs.readdir(functionDir).catch(() => []);
      if (remaining.length === 0) {
        await fs.rmdir(functionDir).catch(() => {});
      }
    }
  }

  async deployFunction(instanceName: string, name: string): Promise<void> {
    // For now, this is a placeholder.
    // In a real Supabase/Deno setup, we would send a request to the Edge Runtime API
    // or restart the container if it's watching files.
    // If the Deno container mounts this volume, it might auto-reload.
    console.log(`Deploying function ${name} for ${instanceName} (simulated)`);
  }

  async getFunctionLogs(instanceName: string, _functionName: string): Promise<string[]> {
    const containers = await this.dockerManager.listProjectContainers(instanceName);
    // Try to find 'functions' or 'edge-runtime' service
    // Service names usually: {project}-functions or {project}-edge-runtime
    const functionsContainer = containers.find((c) =>
      c.Names.some((n) => n.includes('functions') || n.includes('edge-runtime'))
    );

    if (!functionsContainer) {
      return ['Container not found or not running.'];
    }

    const logs = await this.dockerManager.getContainerLogs(functionsContainer.Id, { tail: 200 });

    // Filter logs for the specific function if possible
    // Supabase edge runtime logs usually look like:
    // "serving function 'hello-world'"
    // However, simplified approach: return all logs for now, or simple grep
    const lines = logs.split('\n');

    // If we want to be strict, we can filter.
    // But standard container logs might contain useful startup info too.
    // Let's simplified filter: return last 200 lines, maybe highlight matches in frontend?
    // Or just filter if the line strictly mentions the function.
    // Often logs are mixed. Let's return raw logs for the User to see everything
    // which helps debugging "system" issues too.
    // Optimisation: Filter empty lines
    return lines.map((l) => l.replace(/[\u0000-\u001f]/g, '')).filter((l) => l.length > 0);
  }
}
