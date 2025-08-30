import { QAAgent } from '../../src/qa/qa-agent';
import { ConfigManager } from '../../src/config';
import * as fs from 'fs';
import * as path from 'path';

describe('QA Agent Integration Tests', () => {
  let tempDir: string;
  let mockConfigManager: ConfigManager;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-integration');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    mockConfigManager = {
      getConfig: () => ({
        systemPrompt: 'Test prompt',
        maxTurns: 10,
        allowedTools: ['QA'],
        maxTokens: 100000,
        temperature: 0.1,
        models: {
          reasoning: 'test-model',
          coding: 'test-model',
          fallback: 'test-model'
        }
      }),
      getOpenRouterConfig: () => ({
        apiKey: 'test-key',
        baseUrl: 'https://test.api.com'
      })
    } as any;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('end-to-end workflow', () => {
    it('should handle complete QA workflow in demo mode', async () => {
      // Create a test blueprint
      const blueprint = `# Test Integration App

## Server Configuration
**Start Command:** echo "Mock server started"
**Port:** 3000
**Health Check:** /

### Test Cases
- Basic page load test
- Navigation functionality test
`;

      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      const qaAgent = new QAAgent(tempDir, mockConfigManager, true); // Demo mode
      
      // Mock the server and browser managers to avoid actual browser/server startup
      qaAgent['browserManager'] = {
        initialize: jest.fn().mockResolvedValue(undefined),
        createPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue(true),
          evaluate: jest.fn().mockResolvedValue({
            title: 'Test Page',
            url: 'http://localhost:3000',
            forms: [],
            buttons: [{ text: 'Test Button', id: 'test-btn' }],
            links: [{ text: 'Home', href: '/' }],
            headings: [{ level: 'H1', text: 'Welcome' }],
            errors: []
          }),
          close: jest.fn().mockResolvedValue(undefined)
        }),
        navigateToApp: jest.fn().mockResolvedValue({ success: true, logs: [] }),
        takeScreenshot: jest.fn().mockResolvedValue('/test/screenshot.png'),
        clickElement: jest.fn().mockResolvedValue({ success: true, logs: [] }),
        fillInput: jest.fn().mockResolvedValue({ success: true, logs: [] }),
        checkElementExists: jest.fn().mockResolvedValue(true),
        cleanup: jest.fn().mockResolvedValue(undefined)
      } as any;

      qaAgent['serverManager'] = {
        startServer: jest.fn().mockResolvedValue({ isRunning: true, pid: 12345 }),
        stopServer: jest.fn().mockResolvedValue(undefined),
        isServerRunning: jest.fn().mockResolvedValue(true)
      } as any;

      // Test automatic validation
      const result = await qaAgent.validateAutomatically();

      expect(result).toBeDefined();
      expect(result.testsRun).toBeGreaterThan(0);
      expect(typeof result.success).toBe('boolean');
      expect(result.summary).toBeDefined();
    });

    it('should handle custom prompt validation', async () => {
      const blueprint = `# Custom Test App
**Start Command:** node server.js
**Port:** 8080
`;

      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      const qaAgent = new QAAgent(tempDir, mockConfigManager, true);
      
      // Mock dependencies
      qaAgent['browserManager'] = {
        initialize: jest.fn(),
        cleanup: jest.fn()
      } as any;

      qaAgent['serverManager'] = {
        startServer: jest.fn().mockResolvedValue({ isRunning: true }),
        stopServer: jest.fn()
      } as any;

      // Mock test case generation
      qaAgent['getPromptBasedFallbackTestCases'] = jest.fn().mockReturnValue([
        {
          id: 'custom_test',
          name: 'Custom Test',
          description: 'Custom test case',
          steps: [
            { action: 'navigate', target: '/', description: 'Navigate home' }
          ],
          expectedResults: ['Success'],
          priority: 'high'
        }
      ]);

      // Mock test execution
      qaAgent['runTestCase'] = jest.fn().mockResolvedValue({
        testCase: { id: 'custom_test', name: 'Custom Test' },
        success: true,
        steps: [],
        duration: 1000,
        screenshots: []
      });

      const result = await qaAgent.validateWithCustomPrompt('test the login form');

      expect(result).toBeDefined();
      expect(qaAgent['getPromptBasedFallbackTestCases']).toHaveBeenCalledWith('test the login form');
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const qaAgent = new QAAgent('/nonexistent/path', mockConfigManager, true);
      
      await expect(qaAgent.initialize()).rejects.toThrow();
    });

    it('should cleanup resources on error', async () => {
      const qaAgent = new QAAgent(tempDir, mockConfigManager, true);
      
      const mockBrowserManager = {
        initialize: jest.fn(),
        cleanup: jest.fn()
      };
      
      const mockServerManager = {
        startServer: jest.fn().mockRejectedValue(new Error('Server failed')),
        stopServer: jest.fn()
      };

      qaAgent['browserManager'] = mockBrowserManager as any;
      qaAgent['serverManager'] = mockServerManager as any;
      qaAgent['config'] = {
        server: {
          command: 'echo "Mock server started"',
          port: 3000,
          healthCheckPath: '/',
          startupTimeout: 30000
        }
      };

      await expect(qaAgent.runQA()).rejects.toThrow('Server failed');
      expect(mockBrowserManager.cleanup).toHaveBeenCalled();
      expect(mockServerManager.stopServer).toHaveBeenCalled();
    });
  });
});