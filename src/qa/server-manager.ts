import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import { ServerConfig } from './blueprint-parser';
import kill from 'tree-kill';

export interface ServerStatus {
  isRunning: boolean;
  pid?: number;
  port?: number;
  error?: string;
}

export class ServerManager {
  private serverProcess: ChildProcess | null = null;
  private config: ServerConfig;
  private workspacePath: string;

  constructor(config: ServerConfig, workspacePath: string) {
    this.config = config;
    this.workspacePath = workspacePath;
  }

  async startServer(): Promise<ServerStatus> {
    if (this.serverProcess) {
      return { isRunning: true, pid: this.serverProcess.pid, port: this.config.port };
    }

    try {
      console.log(`Starting server with command: ${this.config.command}`);
      
      // Parse command and arguments
      const [command, ...args] = this.config.command.split(' ');
      
      // Start the server process
      this.serverProcess = spawn(command, args, {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      // Handle process events
      this.serverProcess.on('error', (error) => {
        console.error('Server process error:', error);
      });

      this.serverProcess.stdout?.on('data', (data) => {
        console.log(`[Server] ${data.toString().trim()}`);
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error(`[Server Error] ${data.toString().trim()}`);
      });

      // Wait for server to be ready
      const isReady = await this.waitForServerReady();
      
      if (isReady) {
        return {
          isRunning: true,
          pid: this.serverProcess.pid,
          port: this.config.port
        };
      } else {
        await this.stopServer();
        return {
          isRunning: false,
          error: 'Server failed to start within timeout period'
        };
      }
    } catch (error) {
      return {
        isRunning: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async stopServer(): Promise<void> {
    if (this.serverProcess && this.serverProcess.pid) {
      console.log('Stopping server...');
      
      try {
        // Use tree-kill to kill the process and all its children
        await new Promise<void>((resolve, reject) => {
          kill(this.serverProcess!.pid!, 'SIGTERM', (error?: Error) => {
            if (error) {
              console.warn('SIGTERM failed, trying SIGKILL:', error);
              kill(this.serverProcess!.pid!, 'SIGKILL', (killError?: Error) => {
                if (killError) {
                  reject(killError);
                } else {
                  resolve();
                }
              });
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        console.warn('Failed to kill server process:', error);
      }
      
      this.serverProcess = null;
    }
  }

  async getServerStatus(): Promise<ServerStatus> {
    if (!this.serverProcess) {
      return { isRunning: false };
    }

    const isHealthy = await this.checkServerHealth();
    
    return {
      isRunning: isHealthy,
      pid: this.serverProcess.pid,
      port: this.config.port
    };
  }

  private async waitForServerReady(): Promise<boolean> {
    const timeout = this.config.startupTimeout || 30000;
    const startTime = Date.now();
    
    // Give the server a moment to start before first check
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    while (Date.now() - startTime < timeout) {
      if (await this.checkServerHealth()) {
        console.log('Server is ready!');
        return true;
      }
      
      console.log('Waiting for server to be ready...');
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('Server health check timed out');
    return false;
  }

  private async checkServerHealth(): Promise<boolean> {
    const port = this.config.port || 3000;
    const healthPath = this.config.healthCheckPath || '/';
    const url = `http://localhost:${port}${healthPath}`;
    
    return new Promise((resolve) => {
      console.log(`Checking server health at: ${url}`);
      
      const request = http.get(url, (response) => {
        const success = response.statusCode !== undefined && response.statusCode < 500;
        console.log(`Health check response: ${response.statusCode} - ${success ? 'OK' : 'FAILED'}`);
        resolve(success);
      });
      
      request.on('error', (error) => {
        console.log(`Health check error: ${error.message}`);
        resolve(false);
      });
      
      request.setTimeout(5000, () => {
        console.log('Health check timeout');
        request.destroy();
        resolve(false);
      });
    });
  }

  async isServerRunning(): Promise<boolean> {
    if (!this.serverProcess) {
      return false;
    }
    
    return await this.checkServerHealth();
  }
}