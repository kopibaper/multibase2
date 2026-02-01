import fs from 'fs-extra';
import path from 'path';
import { DockerManager } from './DockerManager';

const VOLUMES_DIR = process.env.VOLUMES_DIR || path.join(process.cwd(), 'volumes');

export class FunctionService {
  constructor(private dockerManager: DockerManager) {}

  private getFunctionsDir(instanceName: string): string {
    return path.join(VOLUMES_DIR, instanceName, 'functions');
  }

  async listFunctions(instanceName: string): Promise<string[]> {
    const dir = this.getFunctionsDir(instanceName);
    await fs.ensureDir(dir);
    const files = await fs.readdir(dir);
    // Filter for .ts or .js files, maybe directories later
    return files.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  }

  async getFunction(instanceName: string, name: string): Promise<string> {
    const filePath = path.join(this.getFunctionsDir(instanceName), name);
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`Function ${name} not found`);
    }
    return fs.readFile(filePath, 'utf-8');
  }

  async saveFunction(instanceName: string, name: string, code: string): Promise<void> {
    const dir = this.getFunctionsDir(instanceName);
    await fs.ensureDir(dir);
    // Ensure name has extension
    let fileName = name;
    if (!fileName.endsWith('.ts') && !fileName.endsWith('.js')) {
      fileName += '.ts';
    }
    await fs.writeFile(path.join(dir, fileName), code);
  }

  async deleteFunction(instanceName: string, name: string): Promise<void> {
    const filePath = path.join(this.getFunctionsDir(instanceName), name);
    if (await fs.pathExists(filePath)) {
      await fs.unlink(filePath);
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
