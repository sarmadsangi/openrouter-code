import { QAAgent } from '../../src/qa/qa-agent';
import { ConfigManager } from '../../src/config';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../../src/openrouter-client');
jest.mock('playwright');

describe('QAAgent', () => {
  let qaAgent: QAAgent;
  let mockConfigManager: ConfigManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp');
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

    qaAgent = new QAAgent(tempDir, mockConfigManager, true); // Demo mode
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with blueprint configuration', async () => {
      const blueprint = `# Test App
**Start Command:** npm run dev
**Port:** 3000
`;
      
      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);

      await expect(qaAgent.initialize(blueprintPath)).resolves.not.toThrow();
    });

    it('should handle missing blueprint file gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.md');
      
      await expect(qaAgent.initialize(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('test case generation', () => {
    beforeEach(async () => {
      const blueprint = `# Test App
**Start Command:** echo "mock server"
**Port:** 3000
`;
      
      const blueprintPath = path.join(tempDir, 'blueprint.md');
      fs.writeFileSync(blueprintPath, blueprint);
      
      // Mock the initialization to avoid browser/server startup in tests
      qaAgent['config'] = {
        server: {
          command: 'echo "mock server"',
          port: 3000,
          baseUrl: 'http://localhost:3000',
          healthCheckPath: '/',
          startupTimeout: 30000
        }
      };
    });

    it('should generate fallback test cases in demo mode', () => {
      const testCases = qaAgent['getFallbackTestCases']();
      
      expect(testCases).toHaveLength(2);
      expect(testCases[0].name).toBe('Basic Navigation Test');
      expect(testCases[1].name).toBe('UI Elements Test');
    });

    it('should generate prompt-based test cases', () => {
      const testCases = qaAgent['getPromptBasedFallbackTestCases']('test the contact form');
      
      expect(testCases).toHaveLength(1);
      expect(testCases[0].name).toBe('Form Validation Test');
      expect(testCases[0].steps.some(step => step.action === 'fill')).toBe(true);
    });

    it('should generate navigation test cases for navigation prompts', () => {
      const testCases = qaAgent['getPromptBasedFallbackTestCases']('test navigation menu');
      
      expect(testCases).toHaveLength(1);
      expect(testCases[0].name).toBe('Navigation Test');
    });
  });

  describe('test execution', () => {
    it('should handle test step execution', () => {
      const testStep = {
        action: 'navigate' as const,
        target: '/',
        description: 'Navigate to home page'
      };

      // Test that the step structure is valid
      expect(testStep.action).toBe('navigate');
      expect(testStep.target).toBe('/');
      expect(testStep.description).toBe('Navigate to home page');
    });

    it('should validate test case structure', () => {
      const testCase = {
        id: 'test_1',
        name: 'Test Case',
        description: 'Test description',
        steps: [
          { action: 'navigate' as const, target: '/', description: 'Navigate' }
        ],
        expectedResults: ['Success'],
        priority: 'high' as const
      };

      expect(testCase.id).toBe('test_1');
      expect(testCase.steps).toHaveLength(1);
      expect(testCase.priority).toBe('high');
    });
  });

  describe('result analysis', () => {
    it('should analyze test results correctly', () => {
      const testResults = [
        {
          testCase: {
            id: 'test1',
            name: 'Test 1',
            description: 'First test',
            steps: [],
            expectedResults: [],
            priority: 'high' as const
          },
          success: true,
          steps: [],
          duration: 1000,
          screenshots: []
        },
        {
          testCase: {
            id: 'test2',
            name: 'Test 2',
            description: 'Second test',
            steps: [],
            expectedResults: [],
            priority: 'medium' as const
          },
          success: false,
          error: 'Test failed',
          steps: [],
          duration: 500,
          screenshots: []
        }
      ];

      const result = qaAgent['analyzeResults'](testResults);

      expect(result.success).toBe(false);
      expect(result.testsRun).toBe(2);
      expect(result.testsPassed).toBe(1);
      expect(result.testsFailed).toBe(1);
      expect(result.summary).toContain('FAILED');
    });
  });
});