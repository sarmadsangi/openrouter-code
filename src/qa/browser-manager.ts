import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { QAConfig } from './blueprint-parser';

export interface BrowserTestResult {
  success: boolean;
  error?: string;
  screenshot?: string;
  logs: string[];
  metrics?: {
    loadTime: number;
    errors: number;
    warnings: number;
  };
}

export class BrowserManager {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private config: QAConfig;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const browsersToLaunch = this.config.browsers || ['chromium'];
    
    for (const browserType of browsersToLaunch) {
      let browser: Browser;
      
      switch (browserType) {
        case 'chromium':
          browser = await chromium.launch({ headless: true });
          break;
        case 'firefox':
          browser = await firefox.launch({ headless: true });
          break;
        case 'webkit':
          browser = await webkit.launch({ headless: true });
          break;
        default:
          throw new Error(`Unsupported browser type: ${browserType}`);
      }
      
      this.browsers.set(browserType, browser);
      
      // Create context with viewport settings
      const context = await browser.newContext({
        viewport: this.config.viewport || { width: 1280, height: 720 },
        ignoreHTTPSErrors: true
      });
      
      this.contexts.set(browserType, context);
    }
  }

  async createPage(browserType: string = 'chromium'): Promise<Page> {
    const context = this.contexts.get(browserType);
    if (!context) {
      throw new Error(`Browser context not found for ${browserType}`);
    }
    
    const page = await context.newPage();
    
    // Set up console logging
    page.on('console', msg => {
      console.log(`[${browserType}] Console ${msg.type()}: ${msg.text()}`);
    });
    
    // Set up error tracking
    page.on('pageerror', error => {
      console.error(`[${browserType}] Page error:`, error.message);
    });
    
    return page;
  }

  async navigateToApp(page: Page, path: string = ''): Promise<BrowserTestResult> {
    const baseUrl = this.config.server.baseUrl || `http://localhost:${this.config.server.port || 3000}`;
    const fullUrl = `${baseUrl}${path}`;
    
    const logs: string[] = [];
    const startTime = Date.now();
    
    try {
      logs.push(`Navigating to ${fullUrl}`);
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
      
      const loadTime = Date.now() - startTime;
      logs.push(`Page loaded in ${loadTime}ms`);
      
      return {
        success: true,
        logs,
        metrics: {
          loadTime,
          errors: 0,
          warnings: 0
        }
      };
    } catch (error) {
      logs.push(`Navigation failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
  }

  async takeScreenshot(page: Page, name: string): Promise<string> {
    const screenshotPath = path.join(process.cwd(), 'qa-screenshots', `${name}-${Date.now()}.png`);
    
    // Ensure directory exists
    const dir = path.dirname(screenshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  async waitForElement(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  async clickElement(page: Page, selector: string): Promise<BrowserTestResult> {
    const logs: string[] = [];
    
    try {
      logs.push(`Clicking element: ${selector}`);
      
      // Wait for element to be visible and clickable
      await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      await page.click(selector);
      
      // Wait a bit for any potential navigation or state changes
      await page.waitForTimeout(1000);
      
      logs.push(`Successfully clicked ${selector}`);
      
      return {
        success: true,
        logs
      };
    } catch (error) {
      logs.push(`Click failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
  }

  async fillInput(page: Page, selector: string, value: string): Promise<BrowserTestResult> {
    const logs: string[] = [];
    
    try {
      logs.push(`Filling input ${selector} with: ${value}`);
      
      await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
      await page.fill(selector, value);
      
      logs.push(`Successfully filled ${selector}`);
      
      return {
        success: true,
        logs
      };
    } catch (error) {
      logs.push(`Fill failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
  }

  async checkElementExists(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.$(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  async getElementText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.textContent();
      }
      return null;
    } catch {
      return null;
    }
  }

  async getPageTitle(page: Page): Promise<string> {
    return await page.title();
  }

  async getPageUrl(page: Page): Promise<string> {
    return page.url();
  }

  async cleanup(): Promise<void> {
    // Close all contexts and browsers
    for (const context of this.contexts.values()) {
      await context.close();
    }
    
    for (const browser of this.browsers.values()) {
      await browser.close();
    }
    
    this.contexts.clear();
    this.browsers.clear();
  }
}