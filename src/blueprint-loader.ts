import * as fs from 'fs';
import * as path from 'path';

export interface BlueprintContent {
  content: string;
  exists: boolean;
  lastModified?: Date;
  path: string;
}

export class BlueprintLoader {
  private static readonly BLUEPRINT_FILENAME = 'blueprint.md';
  private cachedBlueprint: BlueprintContent | null = null;
  private lastChecked: Date | null = null;
  private readonly cacheExpiryMs = 30000; // 30 seconds cache

  /**
   * Loads blueprint.md from the specified directory or current working directory
   */
  async loadBlueprint(workingDirectory?: string): Promise<BlueprintContent> {
    const blueprintPath = this.getBlueprintPath(workingDirectory);
    
    // Check if we have a valid cached version
    if (this.isCacheValid(blueprintPath)) {
      return this.cachedBlueprint!;
    }

    const blueprint = await this.readBlueprintFile(blueprintPath);
    
    // Cache the result
    this.cachedBlueprint = blueprint;
    this.lastChecked = new Date();
    
    return blueprint;
  }

  /**
   * Forces a fresh load of the blueprint, bypassing cache
   */
  async forceReload(workingDirectory?: string): Promise<BlueprintContent> {
    this.invalidateCache();
    return this.loadBlueprint(workingDirectory);
  }

  /**
   * Checks if blueprint.md exists in the specified directory
   */
  blueprintExists(workingDirectory?: string): boolean {
    const blueprintPath = this.getBlueprintPath(workingDirectory);
    try {
      return fs.existsSync(blueprintPath) && fs.statSync(blueprintPath).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Gets the blueprint content formatted for system context
   */
  async getBlueprintContext(workingDirectory?: string): Promise<string> {
    const blueprint = await this.loadBlueprint(workingDirectory);
    
    if (!blueprint.exists) {
      return '';
    }

    return `\n\n--- PROJECT BLUEPRINT ---\nThe following blueprint.md file provides important project context and guidelines:\n\n${blueprint.content}\n--- END BLUEPRINT ---\n\n`;
  }

  /**
   * Invalidates the cached blueprint
   */
  invalidateCache(): void {
    this.cachedBlueprint = null;
    this.lastChecked = null;
  }

  private getBlueprintPath(workingDirectory?: string): string {
    const baseDir = workingDirectory || process.cwd();
    return path.join(baseDir, BlueprintLoader.BLUEPRINT_FILENAME);
  }

  private async readBlueprintFile(blueprintPath: string): Promise<BlueprintContent> {
    try {
      const stats = fs.statSync(blueprintPath);
      const content = fs.readFileSync(blueprintPath, 'utf-8');
      
      return {
        content: content.trim(),
        exists: true,
        lastModified: stats.mtime,
        path: blueprintPath
      };
    } catch (error) {
      return {
        content: '',
        exists: false,
        path: blueprintPath
      };
    }
  }

  private isCacheValid(blueprintPath: string): boolean {
    if (!this.cachedBlueprint || !this.lastChecked) {
      return false;
    }

    // Check if cache has expired
    const now = new Date();
    if (now.getTime() - this.lastChecked.getTime() > this.cacheExpiryMs) {
      return false;
    }

    // Check if file was modified since last cache
    try {
      const stats = fs.statSync(blueprintPath);
      if (this.cachedBlueprint.lastModified && stats.mtime > this.cachedBlueprint.lastModified) {
        return false;
      }
    } catch {
      // File doesn't exist or can't be accessed
      return !this.cachedBlueprint.exists;
    }

    return true;
  }
}

// Singleton instance for global use
export const blueprintLoader = new BlueprintLoader();