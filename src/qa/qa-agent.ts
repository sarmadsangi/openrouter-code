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
  private openRouterClient: OpenRouterClient;
  private workspacePath: string;

  constructor(workspacePath: string, configManager: ConfigManager) {
    this.workspacePath = workspacePath;
    this.blueprintParser = new BlueprintParser(workspacePath);
    this.openRouterClient = new OpenRouterClient(configManager);
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
      // Generate test cases using AI only
      const testCases = customPrompt 
        ? await this.generateTestCasesFromPrompt(customPrompt)
        : await this.generateAutomaticTestCases();

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

      const response = await this.openRouterClient.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate test cases for: ${prompt}` }
      ], 'reasoning');

      const testCases = JSON.parse(response.content);
      return Array.isArray(testCases) ? testCases : [testCases];
    } catch (error) {
      throw new Error(`Failed to generate test cases from prompt: ${error instanceof Error ? error.message : String(error)}`);
    }
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

        const response = await this.openRouterClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Page analysis: ${JSON.stringify(pageAnalysis, null, 2)}` }
        ], 'reasoning');

        const testCases = JSON.parse(response.content);
        return Array.isArray(testCases) ? testCases : [testCases];
      } catch (error) {
        throw new Error(`Failed to generate automatic test cases: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      await page.close();
    }
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