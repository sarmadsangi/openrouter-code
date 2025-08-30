import { BrowserManager } from '../../src/qa/browser-manager';
import { QAConfig } from '../../src/qa/blueprint-parser';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          on: jest.fn(),
          goto: jest.fn().mockResolvedValue(true),
          screenshot: jest.fn().mockResolvedValue(true),
          waitForSelector: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(true),
          fill: jest.fn().mockResolvedValue(true),
          $: jest.fn().mockResolvedValue({}),
          title: jest.fn().mockResolvedValue('Test Page'),
          url: jest.fn().mockResolvedValue('http://localhost:3000'),
          close: jest.fn().mockResolvedValue(true)
        }),
        close: jest.fn().mockResolvedValue(true)
      }),
      close: jest.fn().mockResolvedValue(true)
    })
  },
  firefox: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        close: jest.fn().mockResolvedValue(true)
      }),
      close: jest.fn().mockResolvedValue(true)
    })
  },
  webkit: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        close: jest.fn().mockResolvedValue(true)
      }),
      close: jest.fn().mockResolvedValue(true)
    })
  }
}));

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  let mockConfig: QAConfig;

  beforeEach(() => {
    mockConfig = {
      server: {
        command: 'npm start',
        port: 3000,
        baseUrl: 'http://localhost:3000',
        healthCheckPath: '/',
        startupTimeout: 30000
      },
      browsers: ['chromium'],
      viewport: { width: 1280, height: 720 }
    };

    browserManager = new BrowserManager(mockConfig);
  });

  afterEach(async () => {
    await browserManager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with chromium browser', async () => {
      await expect(browserManager.initialize()).resolves.not.toThrow();
    });

    it('should support multiple browsers', async () => {
      const multiConfig = {
        ...mockConfig,
        browsers: ['chromium', 'firefox'] as const
      };
      
      const multiBrowserManager = new BrowserManager(multiConfig);
      await expect(multiBrowserManager.initialize()).resolves.not.toThrow();
      await multiBrowserManager.cleanup();
    });

    it('should handle unsupported browser type', async () => {
      const invalidConfig = {
        ...mockConfig,
        browsers: ['invalid-browser' as any]
      };
      
      const invalidBrowserManager = new BrowserManager(invalidConfig);
      await expect(invalidBrowserManager.initialize()).rejects.toThrow('Unsupported browser type');
    });
  });

  describe('page operations', () => {
    beforeEach(async () => {
      await browserManager.initialize();
    });

    it('should create a new page', async () => {
      const page = await browserManager.createPage();
      expect(page).toBeDefined();
      expect(page.on).toHaveBeenCalled(); // Verify event listeners were set up
    });

    it('should navigate to app successfully', async () => {
      const page = await browserManager.createPage();
      const result = await browserManager.navigateToApp(page, '/test');
      
      expect(result.success).toBe(true);
      expect(result.logs).toContain('Navigating to http://localhost:3000/test');
    });

    it('should handle navigation errors', async () => {
      const page = await browserManager.createPage();
      // Mock navigation failure
      page.goto = jest.fn().mockRejectedValue(new Error('Navigation failed'));
      
      const result = await browserManager.navigateToApp(page);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation failed');
    });
  });

  describe('element interactions', () => {
    let mockPage: any;

    beforeEach(async () => {
      await browserManager.initialize();
      mockPage = await browserManager.createPage();
    });

    it('should click elements successfully', async () => {
      const result = await browserManager.clickElement(mockPage, '#test-button');
      
      expect(result.success).toBe(true);
      expect(mockPage.click).toHaveBeenCalledWith('#test-button');
    });

    it('should fill input fields', async () => {
      const result = await browserManager.fillInput(mockPage, '#email', 'test@example.com');
      
      expect(result.success).toBe(true);
      expect(mockPage.fill).toHaveBeenCalledWith('#email', 'test@example.com');
    });

    it('should check element existence', async () => {
      mockPage.$ = jest.fn().mockResolvedValue({}); // Element exists
      
      const exists = await browserManager.checkElementExists(mockPage, '#test-element');
      
      expect(exists).toBe(true);
      expect(mockPage.$).toHaveBeenCalledWith('#test-element');
    });

    it('should handle missing elements', async () => {
      mockPage.$ = jest.fn().mockResolvedValue(null); // Element doesn't exist
      
      const exists = await browserManager.checkElementExists(mockPage, '#missing-element');
      
      expect(exists).toBe(false);
    });
  });
});