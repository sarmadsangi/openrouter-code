import { BaseTool } from './base-tool';
import { ToolResult } from '../types';
import { QAAgent } from '../qa/qa-agent';
import { ConfigManager } from '../config';

export class QATool extends BaseTool {
  name = 'QA';
  description = 'Automated QA testing using browser automation to validate web applications';
  
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
  }

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      this.validateParameters(parameters, []);
      
      const {
        customPrompt,
        blueprintPath,
        workspacePath = process.cwd(),
        mode = 'auto', // 'auto' | 'custom' | 'validate'
        demo = false // Demo mode for testing without API keys
      } = parameters;

      const qaAgent = new QAAgent(workspacePath, this.configManager, demo);
      
      let result;
      
      switch (mode) {
        case 'custom':
          if (!customPrompt) {
            throw new Error('Custom prompt required for custom mode');
          }
          result = await qaAgent.validateWithCustomPrompt(customPrompt);
          break;
          
        case 'validate':
          const taskDescription = parameters.taskDescription || 'recent implementation';
          result = await qaAgent.validateImplementation(taskDescription);
          break;
          
        case 'auto':
        default:
          result = await qaAgent.validateAutomatically();
          break;
      }

      // Format the result for display
      let output = `🧪 QA Validation Results\\n\\n`;
      output += `Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}\\n`;
      output += `Tests: ${result.testsPassed}/${result.testsRun} passed\\n\\n`;
      
      if (!result.success) {
        output += `Failed Tests:\\n`;
        result.testResults
          .filter(r => !r.success)
          .forEach(testResult => {
            output += `- ${testResult.testCase.name}: ${testResult.error}\\n`;
          });
        output += `\\n`;
      }
      
      if (result.recommendations && result.recommendations.length > 0) {
        output += `Recommendations:\\n`;
        result.recommendations.forEach(rec => {
          output += `- ${rec}\\n`;
        });
        output += `\\n`;
      }
      
      output += `Summary: ${result.summary}`;

      return this.createResult(result.success, output);
    } catch (error: any) {
      return this.createResult(false, '', `QA validation failed: ${error.message}`);
    }
  }
}