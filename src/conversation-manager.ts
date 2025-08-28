import { Message, Conversation, ToolCall } from './types';
import { ConfigManager } from './config';
import { OpenRouterClient } from './openrouter-client';
import { ToolManager } from './tools/tool-manager';

export class ConversationManager {
  private conversation: Conversation;
  private configManager: ConfigManager;
  private openRouterClient: OpenRouterClient;
  private toolManager: ToolManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.openRouterClient = new OpenRouterClient(configManager);
    this.toolManager = new ToolManager(configManager.getConfig().allowedTools);
    
    this.conversation = {
      messages: [{
        role: 'system',
        content: configManager.getConfig().systemPrompt
      }],
      turnCount: 0,
      currentModel: configManager.getConfig().models.fallback
    };
  }

  async processUserInput(input: string): Promise<string> {
    const config = this.configManager.getConfig();
    
    // Check turn limit
    if (this.conversation.turnCount >= config.maxTurns) {
      return 'Maximum turn limit reached. Please start a new conversation.';
    }

    // Add user message
    this.conversation.messages.push({
      role: 'user',
      content: input
    });

    try {
      // Determine task type and get appropriate model
      const taskType = this.openRouterClient.determineTaskType(input);
      this.conversation.currentModel = this.configManager.getModelForTask(taskType);

      // Get AI response
      let response = await this.openRouterClient.chat(
        this.conversation.messages,
        taskType
      );

      // Process tool calls if present
      response = await this.processToolCalls(response);

      // Add assistant response
      this.conversation.messages.push({
        role: 'assistant',
        content: response
      });

      this.conversation.turnCount++;
      return response;

    } catch (error: any) {
      console.error('Error processing input:', error);
      return `Sorry, I encountered an error: ${error.message}`;
    }
  }

  private async processToolCalls(response: string): Promise<string> {
    // Simple tool call detection and processing
    // This is a basic implementation - in a production system you might want
    // to use a more sophisticated tool calling format
    
    const toolCallPattern = /\[TOOL:(\w+)\](.*?)\[\/TOOL\]/gs;
    let processedResponse = response;
    let match;

    while ((match = toolCallPattern.exec(response)) !== null) {
      const toolName = match[1] as any;
      const toolParams = this.parseToolParameters(match[2]);
      
      try {
        const result = await this.toolManager.executeTool(toolName, toolParams);
        const replacement = result.success 
          ? `[TOOL RESULT]\n${result.result}\n[/TOOL RESULT]`
          : `[TOOL ERROR]\n${result.error}\n[/TOOL ERROR]`;
        
        processedResponse = processedResponse.replace(match[0], replacement);
      } catch (error: any) {
        const replacement = `[TOOL ERROR]\nFailed to execute ${toolName}: ${error.message}\n[/TOOL ERROR]`;
        processedResponse = processedResponse.replace(match[0], replacement);
      }
    }

    return processedResponse;
  }

  private parseToolParameters(paramString: string): Record<string, any> {
    try {
      // Try to parse as JSON first
      return JSON.parse(paramString.trim());
    } catch {
      // Fall back to simple key=value parsing
      const params: Record<string, any> = {};
      const lines = paramString.trim().split('\n');
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          params[key.trim()] = valueParts.join(':').trim();
        }
      }
      
      return params;
    }
  }

  getConversationHistory(): Message[] {
    return [...this.conversation.messages];
  }

  getTurnCount(): number {
    return this.conversation.turnCount;
  }

  getCurrentModel(): string {
    return this.conversation.currentModel;
  }

  getAvailableTools(): string[] {
    return this.toolManager.getAvailableTools();
  }

  getToolsHelp(): string {
    return this.toolManager.getToolsHelp();
  }

  reset(): void {
    const config = this.configManager.getConfig();
    this.conversation = {
      messages: [{
        role: 'system',
        content: config.systemPrompt
      }],
      turnCount: 0,
      currentModel: config.models.fallback
    };
  }
}