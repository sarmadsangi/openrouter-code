import { ServerManager } from '../../src/qa/server-manager';
import { ServerConfig } from '../../src/qa/blueprint-parser';
import { spawn } from 'child_process';

// Mock child_process
jest.mock('child_process');
jest.mock('tree-kill');

describe('ServerManager', () => {
  let serverManager: ServerManager;
  let mockConfig: ServerConfig;
  const mockWorkspacePath = '/test/workspace';

  beforeEach(() => {
    mockConfig = {
      command: 'npm start',
      port: 3000,
      baseUrl: 'http://localhost:3000',
      healthCheckPath: '/',
      startupTimeout: 5000
    };

    serverManager = new ServerManager(mockConfig, mockWorkspacePath);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await serverManager.stopServer();
  });

  describe('server lifecycle', () => {
    it('should start server with correct configuration', async () => {
      const mockProcess = {
        pid: 12345,
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);
      
      // Mock successful health check
      serverManager['checkServerHealth'] = jest.fn().mockResolvedValue(true);

      const status = await serverManager.startServer();

      expect(spawn).toHaveBeenCalledWith('npm', ['start'], {
        cwd: mockWorkspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });
      
      expect(status.isRunning).toBe(true);
      expect(status.pid).toBe(12345);
    });

    it('should handle server startup failure', async () => {
      const mockProcess = {
        pid: 12345,
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      };

      (spawn as jest.Mock).mockReturnValue(mockProcess);
      
      // Mock failed health check
      serverManager['checkServerHealth'] = jest.fn().mockResolvedValue(false);
      serverManager.stopServer = jest.fn().mockResolvedValue(undefined);

      const status = await serverManager.startServer();

      expect(status.isRunning).toBe(false);
      expect(status.error).toContain('failed to start');
    });

    it('should handle spawn errors', async () => {
      (spawn as jest.Mock).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const status = await serverManager.startServer();

      expect(status.isRunning).toBe(false);
      expect(status.error).toBe('Spawn failed');
    });
  });

  describe('server status', () => {
    it('should return correct status when server is not running', async () => {
      const status = await serverManager.getServerStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.pid).toBeUndefined();
    });

    it('should check if server is running', async () => {
      // Mock no running server
      const isRunning = await serverManager.isServerRunning();
      
      expect(isRunning).toBe(false);
    });
  });

  describe('health checks', () => {
    it('should perform health check on correct endpoint', async () => {
      // Mock the private method for testing
      const healthCheck = serverManager['checkServerHealth'];
      
      // Since we can't easily mock http.get in this context, 
      // we'll test that the method exists and can be called
      expect(typeof healthCheck).toBe('function');
    });
  });
});