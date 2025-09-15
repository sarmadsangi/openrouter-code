import { Tool, ToolResult } from '../types';
import { BaseTool } from './base-tool';
import { ReadTool } from './read-tool';
import { WriteTool } from './write-tool';
import { BashTool } from './bash-tool';
import { GrepTool } from './grep-tool';
import { SearchTool } from './search-tool';
import { WebSearchTool } from './web-search-tool';
import { QATool } from './qa-tool';
import { ConfigManager } from '../config';

export class ToolManager {
  private tools: Map<Tool, BaseTool>;
  private configManager: ConfigManager;

  constructor(allowedTools: Tool[], configManager: ConfigManager) {
    this.tools = new Map();
    this.configManager = configManager;
    this.initializeTools(allowedTools);
  }

  private initializeTools(allowedTools: Tool[]): void {
    const toolClasses = {
      'Read': ReadTool,
      'Write': WriteTool,
      'Bash': BashTool,
      'Grep': GrepTool,
      'Search': SearchTool,
      'WebSearch': WebSearchTool,
      'QA': QATool
    };

    allowedTools.forEach(toolName => {
      const ToolClass = toolClasses[toolName];
      if (ToolClass) {
        if (toolName === 'QA') {
          this.tools.set(toolName, new (ToolClass as any)(this.configManager));
        } else {
          this.tools.set(toolName, new (ToolClass as any)());
        }
      }
    });
  }

  async executeTool(toolName: Tool, parameters: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        result: '',
        error: `Tool "${toolName}" is not available or not allowed`
      };
    }

    try {
      return await tool.execute(parameters);
    } catch (error: any) {
      return {
        success: false,
        result: '',
        error: `Tool execution failed: ${error.message}`
      };
    }
  }

  getAvailableTools(): Tool[] {
    return Array.from(this.tools.keys());
  }

  getToolDescription(toolName: Tool): string {
    const tool = this.tools.get(toolName);
    return tool?.description || 'No description available';
  }

  getToolsHelp(): string {
    const tools = Array.from(this.tools.values());
    return tools.map(tool => `${tool.name}: ${tool.description}`).join('\n');
  }
}