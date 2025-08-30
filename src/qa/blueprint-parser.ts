import * as fs from 'fs';
import * as path from 'path';

export interface ServerConfig {
  command: string;
  port?: number;
  baseUrl?: string;
  healthCheckPath?: string;
  startupTimeout?: number;
}

export interface QAConfig {
  server: ServerConfig;
  testCases?: string[];
  customPrompts?: string[];
  skipTests?: string[];
  browsers?: ('chromium' | 'firefox' | 'webkit')[];
  viewport?: { width: number; height: number };
}

export class BlueprintParser {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async parseBlueprint(blueprintPath?: string): Promise<QAConfig> {
    const filePath = blueprintPath || path.join(this.workspacePath, 'blueprint.md');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Blueprint file not found at ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.extractQAConfig(content);
  }

  private extractQAConfig(content: string): QAConfig {
    const config: QAConfig = {
      server: {
        command: this.extractServerCommand(content),
        port: this.extractPort(content),
        baseUrl: this.extractBaseUrl(content),
        healthCheckPath: this.extractHealthCheckPath(content),
        startupTimeout: this.extractStartupTimeout(content)
      },
      testCases: this.extractTestCases(content),
      customPrompts: this.extractCustomPrompts(content),
      skipTests: this.extractSkipTests(content),
      browsers: this.extractBrowsers(content),
      viewport: this.extractViewport(content)
    };

    return config;
  }

  private extractServerCommand(content: string): string {
    // Look for various patterns that might indicate server commands
    const patterns = [
      /(?:server|start|run|dev|serve)\s*(?:command|cmd)?[:\s]*[`'"]*([^`'"\\n]+)[`'"]*$/im,
      /npm\s+(?:run\s+)?(?:start|dev|serve)[^\\n]*/im,
      /yarn\s+(?:start|dev|serve)[^\\n]*/im,
      /node\s+[^\\n]+/im,
      /python\s+[^\\n]+/im,
      /\.\/[^\\s]+\s*(?:serve|start)?[^\\n]*/im
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1] || match[0].trim();
      }
    }

    // Look in code blocks
    const codeBlocks = content.match(/```(?:bash|sh|shell)?\\n([^`]+)```/g);
    if (codeBlocks) {
      for (const block of codeBlocks) {
        const commands = block.replace(/```(?:bash|sh|shell)?\\n|```/g, '').trim().split('\\n');
        for (const cmd of commands) {
          if (cmd.includes('start') || cmd.includes('serve') || cmd.includes('dev') || cmd.includes('run')) {
            return cmd.trim();
          }
        }
      }
    }

    // Default fallback
    return 'npm start';
  }

  private extractPort(content: string): number | undefined {
    const portMatch = content.match(/port[:\s]*(\d+)/i);
    if (portMatch) {
      return parseInt(portMatch[1], 10);
    }

    // Common default ports
    const command = this.extractServerCommand(content).toLowerCase();
    if (command.includes('3000')) return 3000;
    if (command.includes('8080')) return 8080;
    if (command.includes('5000')) return 5000;
    if (command.includes('4000')) return 4000;

    return 3000; // Default
  }

  private extractBaseUrl(content: string): string | undefined {
    const urlMatch = content.match(/(?:base[_\\s]*url|url)[:\s]*([^\\s\\n]+)/i);
    if (urlMatch) {
      return urlMatch[1];
    }
    return undefined;
  }

  private extractHealthCheckPath(content: string): string | undefined {
    const healthMatch = content.match(/health[_\\s]*check[:\s]*([^\\s\\n]+)/i);
    if (healthMatch) {
      return healthMatch[1];
    }
    return '/';
  }

  private extractStartupTimeout(content: string): number | undefined {
    const timeoutMatch = content.match(/(?:startup[_\\s]*timeout|timeout)[:\s]*(\d+)/i);
    if (timeoutMatch) {
      return parseInt(timeoutMatch[1], 10) * 1000; // Convert to milliseconds
    }
    return 30000; // 30 seconds default
  }

  private extractTestCases(content: string): string[] | undefined {
    const testSection = content.match(/##?\s*(?:test|qa|testing)[^#]*?((?:[-*]\s*[^\\n]+\\n?)+)/i);
    if (testSection) {
      return testSection[1]
        .split('\\n')
        .map(line => line.replace(/^[-*]\\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    return undefined;
  }

  private extractCustomPrompts(content: string): string[] | undefined {
    const promptSection = content.match(/##?\s*(?:custom[_\\s]*prompts?|prompts?)[^#]*?((?:[-*]\s*[^\\n]+\\n?)+)/i);
    if (promptSection) {
      return promptSection[1]
        .split('\\n')
        .map(line => line.replace(/^[-*]\\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    return undefined;
  }

  private extractSkipTests(content: string): string[] | undefined {
    const skipSection = content.match(/##?\s*(?:skip[_\\s]*tests?)[^#]*?((?:[-*]\s*[^\\n]+\\n?)+)/i);
    if (skipSection) {
      return skipSection[1]
        .split('\\n')
        .map(line => line.replace(/^[-*]\\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    return undefined;
  }

  private extractBrowsers(content: string): ('chromium' | 'firefox' | 'webkit')[] | undefined {
    const browserMatch = content.match(/browsers?[:\s]*([^\\n]+)/i);
    if (browserMatch) {
      const browsers = browserMatch[1].toLowerCase();
      const result: ('chromium' | 'firefox' | 'webkit')[] = [];
      
      if (browsers.includes('chrome') || browsers.includes('chromium')) result.push('chromium');
      if (browsers.includes('firefox')) result.push('firefox');
      if (browsers.includes('webkit') || browsers.includes('safari')) result.push('webkit');
      
      return result.length > 0 ? result : undefined;
    }
    return undefined;
  }

  private extractViewport(content: string): { width: number; height: number } | undefined {
    const viewportMatch = content.match(/viewport[:\s]*(\d+)[x×](\d+)/i);
    if (viewportMatch) {
      return {
        width: parseInt(viewportMatch[1], 10),
        height: parseInt(viewportMatch[2], 10)
      };
    }
    return undefined;
  }
}