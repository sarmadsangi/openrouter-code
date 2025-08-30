import { Page } from 'playwright';
import { BlueprintParser, QAConfig } from './blueprint-parser';
import { BrowserManager, BrowserTestResult } from './browser-manager';
import { ServerManager } from './server-manager';
import { OpenRouterClient } from '../openrouter-client';
import { ConfigManager } from '../config';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  expectedResults: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface TestStep {
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'check' | 'screenshot';
  target?: string;
  value?: string;
  timeout?: number;
  description: string;
}

export interface QAResult {
  success: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  testResults: TestCaseResult[];
  summary: string;
  recommendations?: string[];
}

export interface TestCaseResult {
  testCase: TestCase;
  success: boolean;
  error?: string;
  steps: TestStepResult[];
  duration: number;
  screenshots: string[];
}

export interface TestStepResult {
  step: TestStep;
  success: boolean;
  error?: string;
  duration: number;
}

export class QAAgent {
  private blueprintParser: BlueprintParser;
  private browserManager: BrowserManager | null = null;
  private serverManager: ServerManager | null = null;
  private config: QAConfig | null = null;
  private openRouterClient?: OpenRouterClient;
  private workspacePath: string;
  private demoMode: boolean = false;

  constructor(workspacePath: string, configManager: ConfigManager, demoMode: boolean = false) {
    this.workspacePath = workspacePath;
    this.blueprintParser = new BlueprintParser(workspacePath);
    this.demoMode = demoMode;
    
    // Only initialize OpenRouter client if not in demo mode
    if (!demoMode) {
      this.openRouterClient = new OpenRouterClient(configManager);
    }
  }

  async initialize(blueprintPath?: string): Promise<void> {
    // Parse blueprint configuration
    this.config = await this.blueprintParser.parseBlueprint(blueprintPath);
    
    // Initialize browser manager
    this.browserManager = new BrowserManager(this.config);
    await this.browserManager.initialize();
    
    // Initialize server manager
    this.serverManager = new ServerManager(this.config.server, this.workspacePath);
  }

  async runQA(customPrompt?: string): Promise<QAResult> {
    if (!this.config || !this.browserManager || !this.serverManager) {
      throw new Error('QA Agent not initialized. Call initialize() first.');
    }

    console.log('🚀 Starting QA validation...');
    
    // Start the server
    const serverStatus = await this.serverManager.startServer();
    if (!serverStatus.isRunning) {
      throw new Error(`Failed to start server: ${serverStatus.error}`);
    }

    try {
      // Generate or use provided test cases
      const testCases = customPrompt 
        ? (this.demoMode ? this.getPromptBasedFallbackTestCases(customPrompt) : await this.generateTestCasesFromPrompt(customPrompt))
        : (this.demoMode ? this.getFallbackTestCases() : await this.generateAutomaticTestCases());

      // Run all test cases
      const testResults: TestCaseResult[] = [];
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        const result = await this.runTestCase(testCase);
        testResults.push(result);
      }

      // Analyze results and generate summary
      const qaResult = this.analyzeResults(testResults);
      
      return qaResult;
    } finally {
      // Always cleanup
      await this.cleanup();
    }
  }

  private async generateTestCasesFromPrompt(prompt: string): Promise<TestCase[]> {
    try {
      const systemPrompt = `You are a QA testing expert. Generate comprehensive test cases for web application testing based on the user's prompt. 

Return a JSON array of test cases with this structure:
{
  "id": "unique_id",
  "name": "Test Name",
  "description": "What this test validates",
  "steps": [
    {
      "action": "navigate|click|fill|wait|check|screenshot",
      "target": "CSS selector or URL path",
      "value": "value for fill actions",
      "timeout": 5000,
      "description": "What this step does"
    }
  ],
  "expectedResults": ["Expected outcome 1", "Expected outcome 2"],
  "priority": "high|medium|low"
}

Focus on practical, executable test cases that validate real functionality.`;

      if (!this.openRouterClient) {
        throw new Error('OpenRouter client not available in demo mode');
      }
      
      const response = await this.openRouterClient.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate test cases for: ${prompt}` }
      ], 'reasoning');

      const testCases = JSON.parse(response.content);
      return Array.isArray(testCases) ? testCases : [testCases];
    } catch (error) {
      console.warn('Failed to generate AI test cases, using prompt-based fallback');
      return this.getPromptBasedFallbackTestCases(prompt);
    }
  }

  private getPromptBasedFallbackTestCases(prompt: string): TestCase[] {
    const lower = prompt.toLowerCase();
    
    // Generate test cases based on keywords in the prompt
    if (lower.includes('form') || lower.includes('contact') || lower.includes('submit')) {
      return [
        {
          id: 'form_validation',
          name: 'Form Validation Test',
          description: 'Test form functionality and validation',
          steps: [
            { action: 'navigate', target: '/', description: 'Navigate to home page' },
            { action: 'click', target: 'form button, [type="submit"]', description: 'Find and click submit button' },
            { action: 'fill', target: 'input[type="email"], input[name*="email"]', value: 'test@example.com', description: 'Fill email field' },
            { action: 'fill', target: 'input[type="text"], input[name*="name"]', value: 'Test User', description: 'Fill name field' },
            { action: 'fill', target: 'textarea', value: 'Test message', description: 'Fill message field' },
            { action: 'click', target: '[type="submit"], button[type="submit"]', description: 'Submit form' },
            { action: 'wait', timeout: 2000, description: 'Wait for form submission' }
          ],
          expectedResults: ['Form submits successfully', 'Success message appears'],
          priority: 'high'
        }
      ];
    }
    
    if (lower.includes('navigation') || lower.includes('nav') || lower.includes('menu')) {
      return [
        {
          id: 'navigation_test',
          name: 'Navigation Test',
          description: 'Test website navigation functionality',
          steps: [
            { action: 'navigate', target: '/', description: 'Navigate to home page' },
            { action: 'click', target: 'nav a, .nav a, header a', description: 'Click navigation links' },
            { action: 'check', target: 'h1, h2, main', description: 'Verify page content loaded' }
          ],
          expectedResults: ['All navigation links work', 'Pages load correctly'],
          priority: 'high'
        }
      ];
    }
    
    // Default comprehensive test
    return this.getFallbackTestCases();
  }

  private async generateAutomaticTestCases(): Promise<TestCase[]> {
    // First, analyze the running application to understand its structure
    const page = await this.browserManager!.createPage();
    
    try {
      await this.browserManager!.navigateToApp(page);
      
      // Analyze the page structure
      const pageAnalysis = await this.analyzePage(page);
      
      try {
        // Generate test cases based on analysis using AI
        const systemPrompt = `You are a QA testing expert. Based on the provided page analysis, generate comprehensive test cases for this web application.

Return a JSON array of test cases focusing on:
1. Navigation and routing
2. Form interactions
3. Button clicks and user interactions
4. Content validation
5. Error handling

Use practical CSS selectors and realistic user flows.`;

        if (!this.openRouterClient) {
          throw new Error('OpenRouter client not available in demo mode');
        }
        
        const response = await this.openRouterClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Page analysis: ${JSON.stringify(pageAnalysis, null, 2)}` }
        ], 'reasoning');

        const testCases = JSON.parse(response.content);
        return Array.isArray(testCases) ? testCases : [testCases];
      } catch (error) {
        console.warn('Failed to generate AI test cases, using page analysis fallback');
        return this.generateTestCasesFromPageAnalysis(pageAnalysis);
      }
    } finally {
      await page.close();
    }
  }

  private generateTestCasesFromPageAnalysis(pageAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];

    // Basic navigation test
    testCases.push({
      id: 'page_load',
      name: 'Page Load Test',
      description: 'Verify the application loads correctly',
      steps: [
        { action: 'navigate', target: '/', description: 'Navigate to home page' },
        { action: 'check', target: 'body', description: 'Verify page body exists' },
        { action: 'screenshot', description: 'Take homepage screenshot' }
      ],
      expectedResults: ['Page loads without errors'],
      priority: 'high'
    });

    // Form testing if forms are present
    if (pageAnalysis.forms && pageAnalysis.forms.length > 0) {
      const form = pageAnalysis.forms[0];
      const steps: TestStep[] = [
        { action: 'navigate', target: '/', description: 'Navigate to home page' }
      ];

      // Add steps to fill form inputs
      form.inputs.forEach((input: any, index: number) => {
        if (input.type === 'email') {
          steps.push({
            action: 'fill',
            target: `#${input.id}` || `input[name="${input.name}"]` || `input[type="email"]`,
            value: 'test@example.com',
            description: `Fill email field`
          });
        } else if (input.type === 'text') {
          steps.push({
            action: 'fill',
            target: `#${input.id}` || `input[name="${input.name}"]` || `input[type="text"]`,
            value: 'Test User',
            description: `Fill text field`
          });
        } else if (input.type === 'TEXTAREA') {
          steps.push({
            action: 'fill',
            target: `#${input.id}` || `textarea[name="${input.name}"]` || `textarea`,
            value: 'This is a test message',
            description: `Fill textarea field`
          });
        }
      });

      // Add submit step
      steps.push({
        action: 'click',
        target: 'button[type="submit"], input[type="submit"]',
        description: 'Submit the form'
      });

      steps.push({
        action: 'wait',
        timeout: 2000,
        description: 'Wait for form processing'
      });

      testCases.push({
        id: 'form_interaction',
        name: 'Form Interaction Test',
        description: 'Test form filling and submission',
        steps,
        expectedResults: ['Form submits successfully', 'No validation errors'],
        priority: 'high'
      });
    }

    // Button testing
    if (pageAnalysis.buttons && pageAnalysis.buttons.length > 0) {
      pageAnalysis.buttons.forEach((button: any, index: number) => {
        if (button.text && button.text.length > 0) {
          testCases.push({
            id: `button_test_${index}`,
            name: `Button Test: ${button.text}`,
            description: `Test ${button.text} button functionality`,
            steps: [
              { action: 'navigate', target: '/', description: 'Navigate to home page' },
              { 
                action: 'click', 
                target: button.id ? `#${button.id}` : `button:has-text("${button.text}")`,
                description: `Click ${button.text} button`
              },
              { action: 'wait', timeout: 1000, description: 'Wait for button action' }
            ],
            expectedResults: ['Button click works without errors'],
            priority: 'medium'
          });
        }
      });
    }

    // Navigation testing
    if (pageAnalysis.links && pageAnalysis.links.length > 0) {
      const internalLinks = pageAnalysis.links.filter((link: any) => 
        link.href && (link.href.startsWith('/') || link.href.includes('localhost'))
      );

      if (internalLinks.length > 0) {
        testCases.push({
          id: 'navigation_links',
          name: 'Navigation Links Test',
          description: 'Test internal navigation links',
          steps: [
            { action: 'navigate', target: '/', description: 'Start from home page' },
            ...internalLinks.slice(0, 3).map((link: any, index: number) => ({
              action: 'click' as const,
              target: link.id ? `#${link.id}` : `a[href="${link.href}"]`,
              description: `Click link: ${link.text || link.href}`
            }))
          ],
          expectedResults: ['All internal links navigate correctly'],
          priority: 'medium'
        });
      }
    }

    return testCases.length > 0 ? testCases : this.getFallbackTestCases();
  }

  private async analyzePage(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const analysis = {
        title: document.title,
        url: window.location.href,
        forms: Array.from(document.forms).map(form => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.elements).map(el => ({
            type: (el as any).type || el.tagName,
            name: (el as any).name,
            id: el.id,
            placeholder: (el as HTMLInputElement).placeholder
          }))
        })),
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
          text: btn.textContent?.trim(),
          id: btn.id,
          className: btn.className,
          type: (btn as HTMLButtonElement).type
        })),
        links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
          text: link.textContent?.trim(),
          href: (link as HTMLAnchorElement).href,
          id: link.id
        })),
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: h.tagName,
          text: h.textContent?.trim()
        })),
        errors: Array.from(document.querySelectorAll('.error, .alert-danger, [role="alert"]')).map(err => ({
          text: err.textContent?.trim(),
          className: err.className
        }))
      };
      
      return analysis;
    });
  }

  private getFallbackTestCases(): TestCase[] {
    return [
      {
        id: 'basic_navigation',
        name: 'Basic Navigation Test',
        description: 'Verify the application loads and basic navigation works',
        steps: [
          {
            action: 'navigate',
            target: '/',
            description: 'Navigate to home page'
          },
          {
            action: 'screenshot',
            description: 'Take screenshot of home page'
          },
          {
            action: 'check',
            target: 'body',
            description: 'Verify page content loaded'
          }
        ],
        expectedResults: ['Page loads successfully', 'No console errors'],
        priority: 'high'
      },
      {
        id: 'ui_elements',
        name: 'UI Elements Test',
        description: 'Check that essential UI elements are present and functional',
        steps: [
          {
            action: 'navigate',
            target: '/',
            description: 'Navigate to home page'
          },
          {
            action: 'check',
            target: 'h1, h2, h3',
            description: 'Verify headings are present'
          },
          {
            action: 'check',
            target: 'button, input[type="button"], input[type="submit"]',
            description: 'Verify interactive elements exist'
          }
        ],
        expectedResults: ['Essential UI elements are present'],
        priority: 'medium'
      }
    ];
  }

  async runTestCase(testCase: TestCase): Promise<TestCaseResult> {
    const page = await this.browserManager!.createPage();
    const startTime = Date.now();
    const screenshots: string[] = [];
    const stepResults: TestStepResult[] = [];

    try {
      for (const step of testCase.steps) {
        const stepResult = await this.executeTestStep(page, step);
        stepResults.push(stepResult);
        
        if (step.action === 'screenshot') {
          const screenshot = await this.browserManager!.takeScreenshot(page, `${testCase.id}_${step.description.replace(/\\s+/g, '_')}`);
          screenshots.push(screenshot);
        }
        
        if (!stepResult.success) {
          // Test failed, take error screenshot
          const errorScreenshot = await this.browserManager!.takeScreenshot(page, `${testCase.id}_error`);
          screenshots.push(errorScreenshot);
          break;
        }
      }

      const allStepsSucceeded = stepResults.every(result => result.success);
      
      return {
        testCase,
        success: allStepsSucceeded,
        steps: stepResults,
        duration: Date.now() - startTime,
        screenshots
      };
    } finally {
      await page.close();
    }
  }

  private async executeTestStep(page: Page, step: TestStep): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      switch (step.action) {
        case 'navigate':
          const navResult = await this.browserManager!.navigateToApp(page, step.target || '');
          return {
            step,
            success: navResult.success,
            error: navResult.error,
            duration: Date.now() - startTime
          };
          
        case 'click':
          if (!step.target) throw new Error('Click action requires target selector');
          const clickResult = await this.browserManager!.clickElement(page, step.target);
          return {
            step,
            success: clickResult.success,
            error: clickResult.error,
            duration: Date.now() - startTime
          };
          
        case 'fill':
          if (!step.target || !step.value) throw new Error('Fill action requires target and value');
          const fillResult = await this.browserManager!.fillInput(page, step.target, step.value);
          return {
            step,
            success: fillResult.success,
            error: fillResult.error,
            duration: Date.now() - startTime
          };
          
        case 'wait':
          await page.waitForTimeout(step.timeout || 1000);
          return {
            step,
            success: true,
            duration: Date.now() - startTime
          };
          
        case 'check':
          if (!step.target) throw new Error('Check action requires target selector');
          const exists = await this.browserManager!.checkElementExists(page, step.target);
          return {
            step,
            success: exists,
            error: exists ? undefined : `Element not found: ${step.target}`,
            duration: Date.now() - startTime
          };
          
        case 'screenshot':
          // Screenshot is handled in runTestCase
          return {
            step,
            success: true,
            duration: Date.now() - startTime
          };
          
        default:
          throw new Error(`Unsupported test action: ${step.action}`);
      }
    } catch (error) {
      return {
        step,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  private analyzeResults(testResults: TestCaseResult[]): QAResult {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    const success = failedTests === 0;
    
    let summary = `QA Validation ${success ? 'PASSED' : 'FAILED'}\\n`;
    summary += `Tests: ${passedTests}/${totalTests} passed\\n`;
    
    if (failedTests > 0) {
      summary += `\\nFailed Tests:\\n`;
      testResults
        .filter(r => !r.success)
        .forEach(result => {
          summary += `- ${result.testCase.name}: ${result.error || 'Unknown error'}\\n`;
        });
    }

    const recommendations: string[] = [];
    
    // Analyze common failure patterns
    const failedResults = testResults.filter(r => !r.success);
    if (failedResults.length > 0) {
      const commonErrors = this.identifyCommonErrors(failedResults);
      recommendations.push(...commonErrors);
    }

    return {
      success,
      testsRun: totalTests,
      testsPassed: passedTests,
      testsFailed: failedTests,
      testResults,
      summary,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }

  private identifyCommonErrors(failedResults: TestCaseResult[]): string[] {
    const recommendations: string[] = [];
    const errors = failedResults.map(r => r.error || '').join(' ').toLowerCase();
    
    if (errors.includes('element not found') || errors.includes('selector')) {
      recommendations.push('Consider updating CSS selectors - elements may have changed');
    }
    
    if (errors.includes('timeout') || errors.includes('navigation')) {
      recommendations.push('Check if server is running correctly and responsive');
    }
    
    if (errors.includes('network') || errors.includes('connection')) {
      recommendations.push('Verify network connectivity and server configuration');
    }
    
    return recommendations;
  }

  async validateWithCustomPrompt(prompt: string): Promise<QAResult> {
    await this.initialize();
    return await this.runQA(prompt);
  }

  async validateAutomatically(): Promise<QAResult> {
    await this.initialize();
    return await this.runQA();
  }

  async cleanup(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.cleanup();
    }
    
    if (this.serverManager) {
      await this.serverManager.stopServer();
    }
  }

  // Method to be called by task planner for automatic validation
  async validateImplementation(taskDescription: string): Promise<QAResult> {
    const validationPrompt = `Validate the implementation of: ${taskDescription}. 
    Focus on testing the specific functionality that was just implemented. 
    Create targeted test cases that verify the new features work correctly.`;
    
    return await this.validateWithCustomPrompt(validationPrompt);
  }
}