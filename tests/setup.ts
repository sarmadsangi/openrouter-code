// Jest setup file
import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
(global as any).testUtils = {
  createMockConfigManager: () => ({
    getConfig: () => ({
      systemPrompt: 'Test system prompt',
      maxTurns: 10,
      allowedTools: ['Read', 'Write', 'QA'],
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
    }),
    getContextLimits: () => ({
      maxTokens: 200000,
      targetTokens: 100000
    })
  })
};