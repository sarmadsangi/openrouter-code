import { Message, Conversation, ToolCall } from './types';
import { ConfigManager } from './config';
import { OpenRouterClient } from './openrouter-client';
import { ToolManager } from './tools/tool-manager';
import { TaskPlanner, TaskPlan, Task } from './task-planner';

export class ConversationManager {
  private conversation: Conversation;
  private configManager: ConfigManager;
  private openRouterClient: OpenRouterClient;
  private toolManager: ToolManager;
  private taskPlanner: TaskPlanner;
  private requiresApproval: boolean = true;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.openRouterClient = new OpenRouterClient(configManager);
    this.toolManager = new ToolManager(configManager.getConfig().allowedTools);
    this.taskPlanner = new TaskPlanner(configManager, this.toolManager);
    
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

    // Handle special commands
    if (input.toLowerCase().startsWith('/plan ')) {
      return await this.handlePlanCommand(input.substring(6));
    }
    
    if (input.toLowerCase() === '/continue') {
      return await this.continueCurrentPlan();
    }
    
    if (input.toLowerCase() === '/status') {
      return this.getTaskStatus();
    }

    // Add user message
    this.conversation.messages.push({
      role: 'user',
      content: input
    });

    try {
      // Check if this looks like a complex task that needs planning
      if (this.shouldCreateTaskPlan(input)) {
        return await this.handleComplexTask(input);
      }

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

  private shouldCreateTaskPlan(input: string): boolean {
    const complexTaskIndicators = [
      'implement', 'create', 'build', 'develop', 'refactor', 'migrate',
      'setup', 'configure', 'add feature', 'new feature', 'complete',
      'full', 'entire', 'whole project', 'from scratch', 'step by step'
    ];
    
    const inputLower = input.toLowerCase();
    const hasComplexIndicator = complexTaskIndicators.some(indicator => 
      inputLower.includes(indicator)
    );
    
    const isLongRequest = input.split(' ').length > 10;
    const hasMultipleRequirements = input.includes(' and ') || input.includes(',');
    
    return hasComplexIndicator || (isLongRequest && hasMultipleRequirements);
  }

  private async handleComplexTask(input: string): Promise<string> {
    try {
      const plan = await this.taskPlanner.createTaskPlan(input);
      
      let response = `🎯 **Complex Task Detected!**\n\n`;
      response += `I've broken down your request into manageable tasks:\n\n`;
      response += this.taskPlanner.formatPlanSummary();
      response += `\n\n`;
      response += this.requiresApproval 
        ? `Do you want me to proceed with this plan? Type "yes" to continue or "modify" to adjust the plan.`
        : `Starting execution automatically...`;
      
      if (!this.requiresApproval) {
        // Auto-execute first task
        const firstResult = await this.executeNextTask();
        if (firstResult) {
          response += `\n\n**Started First Task:**\n${firstResult}`;
        }
      }
      
      return response;
    } catch (error: any) {
      return `Failed to create task plan: ${error.message}`;
    }
  }

  private async handlePlanCommand(request: string): Promise<string> {
    try {
      const plan = await this.taskPlanner.createTaskPlan(request);
      return `📋 **Task Plan Created:**\n\n${this.taskPlanner.formatPlanSummary()}`;
    } catch (error: any) {
      return `Failed to create plan: ${error.message}`;
    }
  }

  private async continueCurrentPlan(): Promise<string> {
    const result = await this.executeNextTask();
    return result || 'No active plan or all tasks completed.';
  }

  private getTaskStatus(): string {
    const plan = this.taskPlanner.getCurrentPlan();
    if (!plan) {
      return 'No active task plan.';
    }
    return this.taskPlanner.formatPlanSummary();
  }

  private async executeNextTask(): Promise<string | null> {
    const nextTask = this.taskPlanner.getNextPendingTask();
    if (!nextTask) {
      return null;
    }

    try {
      // Mark task as in progress
      nextTask.status = 'in_progress';
      
      // Execute the task
      const taskPrompt = this.buildTaskExecutionPrompt(nextTask);
      const taskType = nextTask.type === 'analysis' || nextTask.type === 'planning' 
        ? 'reasoning' : 'coding';
      
      const response = await this.openRouterClient.chat([
        { role: 'system', content: this.getTaskExecutionSystemPrompt() },
        { role: 'user', content: taskPrompt }
      ], taskType);

      // Process any tool calls
      const processedResponse = await this.processToolCalls(response);
      
      // Mark task as completed
      this.taskPlanner.markTaskComplete(nextTask.id, processedResponse);
      
      return `✅ **Completed: ${nextTask.title}**\n\n${processedResponse}`;
      
    } catch (error: any) {
      this.taskPlanner.markTaskFailed(nextTask.id, error.message);
      return `❌ **Failed: ${nextTask.title}**\n\nError: ${error.message}`;
    }
  }

  private buildTaskExecutionPrompt(task: Task): string {
    return `
Execute this specific task:

**Task:** ${task.title}
**Description:** ${task.description}
**Type:** ${task.type}
**Available Tools:** ${task.toolsRequired.join(', ')}

Focus only on this specific task. Be thorough and provide clear results.
If you need to use tools, format them as [TOOL:ToolName]parameters[/TOOL].
`;
  }

  private getTaskExecutionSystemPrompt(): string {
    return `You are executing a specific task as part of a larger plan. 

Key guidelines:
- Focus only on the current task
- Use tools when necessary
- Provide clear, actionable results
- Be thorough but concise
- If you encounter issues, explain them clearly

Available tools: ${this.toolManager.getAvailableTools().join(', ')}
`;
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

  // Task Planning Methods
  setApprovalRequired(required: boolean): void {
    this.requiresApproval = required;
  }

  getCurrentPlan(): TaskPlan | null {
    return this.taskPlanner.getCurrentPlan();
  }

  // Approval handling
  async handleApproval(approved: boolean): Promise<string> {
    if (!approved) {
      return 'Task execution cancelled. You can modify the plan or start over.';
    }

    const result = await this.executeNextTask();
    return result || 'No tasks to execute.';
  }

  // Model configuration methods
  updateModels(models: { reasoning?: string; coding?: string; fallback?: string }): void {
    this.configManager.updateModels(models);
  }

  getCurrentModels(): { reasoning: string; coding: string; fallback: string } {
    const config = this.configManager.getConfig();
    return config.models;
  }

  async listAvailableModels(): Promise<any[]> {
    return await this.openRouterClient.getAvailableModels();
  }
}