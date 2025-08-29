import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface WorkspaceConfig {
  workingDirectories: { [name: string]: string };
  currentWorkspace?: string;
  defaultWorkspace?: string;
}

export class WorkspaceManager {
  private configPath: string;
  private config: WorkspaceConfig;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.workspace-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file, or create default if it doesn't exist
   */
  private loadConfig(): WorkspaceConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn('Error loading config, using defaults:', error);
    }

    // Default configuration
    return {
      workingDirectories: {
        'default': process.cwd()
      },
      currentWorkspace: 'default',
      defaultWorkspace: 'default'
    };
  }

  /**
   * Save current configuration to file
   */
  private saveConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  /**
   * Add or update a working directory
   */
  setWorkingDirectory(name: string, dirPath: string): void {
    const absolutePath = path.resolve(dirPath);
    
    // Validate directory exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Directory does not exist: ${absolutePath}`);
    }

    if (!fs.statSync(absolutePath).isDirectory()) {
      throw new Error(`Path is not a directory: ${absolutePath}`);
    }

    this.config.workingDirectories[name] = absolutePath;
    this.saveConfig();
  }

  /**
   * Remove a working directory configuration
   */
  removeWorkingDirectory(name: string): void {
    if (!(name in this.config.workingDirectories)) {
      throw new Error(`Working directory '${name}' not found`);
    }

    if (name === 'default') {
      throw new Error('Cannot remove default working directory');
    }

    delete this.config.workingDirectories[name];

    // Update current workspace if it was the one being removed
    if (this.config.currentWorkspace === name) {
      this.config.currentWorkspace = this.config.defaultWorkspace || 'default';
    }

    this.saveConfig();
  }

  /**
   * Switch to a configured working directory
   */
  switchToWorkspace(name: string): string {
    if (!(name in this.config.workingDirectories)) {
      throw new Error(`Working directory '${name}' not found. Available: ${Object.keys(this.config.workingDirectories).join(', ')}`);
    }

    const dirPath = this.config.workingDirectories[name];
    
    // Validate directory still exists
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory no longer exists: ${dirPath}`);
    }

    this.config.currentWorkspace = name;
    this.saveConfig();

    // Change process working directory
    process.chdir(dirPath);
    
    return dirPath;
  }

  /**
   * Get current working directory info
   */
  getCurrentWorkspace(): { name: string; path: string } {
    const currentName = this.config.currentWorkspace || 'default';
    const currentPath = this.config.workingDirectories[currentName] || process.cwd();
    
    return {
      name: currentName,
      path: currentPath
    };
  }

  /**
   * List all configured working directories
   */
  listWorkspaces(): { [name: string]: string } {
    return { ...this.config.workingDirectories };
  }

  /**
   * Set default workspace
   */
  setDefaultWorkspace(name: string): void {
    if (!(name in this.config.workingDirectories)) {
      throw new Error(`Working directory '${name}' not found`);
    }

    this.config.defaultWorkspace = name;
    this.saveConfig();
  }

  /**
   * Auto-detect and suggest common project directories
   */
  detectProjectDirectories(): string[] {
    const suggestions: string[] = [];
    const homeDir = os.homedir();
    
    // Common project locations
    const commonPaths = [
      path.join(homeDir, 'Projects'),
      path.join(homeDir, 'Documents', 'Projects'),
      path.join(homeDir, 'Development'),
      path.join(homeDir, 'dev'),
      path.join(homeDir, 'workspace'),
      path.join(homeDir, 'code'),
      '/workspace',
      '/projects'
    ];

    for (const dirPath of commonPaths) {
      try {
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          // Look for subdirectories that might be projects
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const projectPath = path.join(dirPath, entry.name);
              // Check for common project indicators
              const indicators = ['package.json', '.git', 'Cargo.toml', 'requirements.txt', 'pom.xml', 'go.mod'];
              if (indicators.some(indicator => fs.existsSync(path.join(projectPath, indicator)))) {
                suggestions.push(projectPath);
              }
            }
          }
        }
      } catch (error) {
        // Ignore errors for inaccessible directories
      }
    }

    return suggestions;
  }
}

// Global instance
export const workspaceManager = new WorkspaceManager();