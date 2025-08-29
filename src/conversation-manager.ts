import { Message, Conversation, ToolCall } from './types';
import { ConfigManager } from './config';
import { OpenRouterClient, ChatResponse } from './openrouter-client';
import { ToolManager } from './tools/tool-manager';
import { TaskPlanner, TaskPlan, Task } from './task-planner';
import { ContextManager, ContextWindow } from './context-manager';
import { UsageTracker } from './usage-tracker';
import { workspaceManager } from './config/workspace-config';

export class ConversationManager {
  private conversation: Conversation;
  private configManager: ConfigManager;
  private openRouterClient: OpenRouterClient;
  private toolManager: ToolManager;
  private taskPlanner: TaskPlanner;
  private contextManager: ContextManager;
  private usageTracker: UsageTracker;
  private requiresApproval: boolean = true;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.openRouterClient = new OpenRouterClient(configManager);
    this.toolManager = new ToolManager(configManager.getConfig().allowedTools);
    this.taskPlanner = new TaskPlanner(configManager, this.toolManager);
    this.usageTracker = new UsageTracker();
    
    // Initialize context manager with conservative limits for reduced hallucinations
    const contextLimits = configManager.getContextLimits();
    const currentWorkspace = workspaceManager.getCurrentWorkspace();
    this.contextManager = new ContextManager(
      contextLimits.maxTokens, 
      contextLimits.targetTokens, 
      currentWorkspace.path
    );
    
    // Initialize conversation with system prompt - blueprint will be added later
    this.conversation = {
      messages: [{
        role: 'system',
        content: configManager.getConfig().systemPrompt
      }],
      turnCount: 0,
      currentModel: configManager.getConfig().models.fallback
    };

    // Initialize with blueprint context
    this.initializeWithBlueprint();

    // Start initial task tracking
    this.usageTracker.startTask('conversation_start', 'Initial Conversation');
  }

  /**
   * Initialize the conversation with blueprint context if available
   */
  private async initializeWithBlueprint(): Promise<void> {
    try {
      const blueprintContext = await this.contextManager.getBlueprintContext();
      if (blueprintContext) {
        // Append blueprint context to the system message
        const systemMessage = this.conversation.messages[0];
        systemMessage.content += blueprintContext;
      }
    } catch (error) {
      console.warn('Failed to initialize blueprint context:', error);
    }
  }

  /**
   * Refresh blueprint context if the workspace has changed
   */
  async refreshBlueprintContext(): Promise<void> {
    const currentWorkspace = workspaceManager.getCurrentWorkspace();
    this.contextManager.setWorkingDirectory(currentWorkspace.path);
    
    try {
      const blueprintContext = await this.contextManager.getBlueprintContext();
      if (blueprintContext) {
        // Update the system message with fresh blueprint context
        const systemMessage = this.conversation.messages[0];
        const basePrompt = this.configManager.getConfig().systemPrompt;
        systemMessage.content = basePrompt + blueprintContext;
      }
    } catch (error) {
      console.warn('Failed to refresh blueprint context:', error);
    }
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

    if (input.toLowerCase() === '/context') {
      return this.getContextStatus();
    }

    if (input.toLowerCase() === '/usage') {
      return this.getUsageStatus();
    }

    if (input.toLowerCase() === '/blueprint') {
      return this.getBlueprintStatus();
    }

    if (input.toLowerCase() === '/refresh-blueprint') {
      await this.refreshBlueprintContext();
      return 'Blueprint context refreshed from current workspace.';
    }

    if (input.toLowerCase() === '/workspace') {
      return this.getWorkspaceStatus();
    }

    // Add user message
    this.conversation.messages.push({
      role: 'user',
      content: input
    });

    try {
      // Context management - check if we need to compress or truncate
      await this.manageContext();

      // Check if this looks like a complex task that needs planning
      if (this.shouldCreateTaskPlan(input)) {
        return await this.handleComplexTask(input);
      }

      // Determine task type and get appropriate model
      const taskType = this.openRouterClient.determineTaskType(input);
      this.conversation.currentModel = this.configManager.getModelForTask(taskType);

      // Get AI response with managed context
      const chatResponse = await this.openRouterClient.chat(
        this.conversation.messages,
        taskType
      );

      // Track usage
      this.usageTracker.recordUsage({
        prompt_tokens: chatResponse.usage.prompt_tokens,
        completion_tokens: chatResponse.usage.completion_tokens,
        total_tokens: chatResponse.usage.total_tokens,
        model: chatResponse.model,
        timestamp: new Date()
      });

      // Process tool calls if present
      let response = await this.processToolCalls(chatResponse.content);

      // Add assistant response
      this.conversation.messages.push({
        role: 'assistant',
        content: response
      });

      this.conversation.turnCount++;
      
      // Add context info to response if context is getting high
      const contextInfo = this.getContextWarning();
      if (contextInfo) {
        response += `\n\n${contextInfo}`;
      }

      // Add usage information to response
      const usageDisplay = this.usageTracker.formatUsageDisplay();
      if (usageDisplay) {
        response += `\n${usageDisplay}`;
      }

      return response;

    } catch (error: any) {
      console.error('Error processing input:', error);
      return `Sorry, I encountered an error: ${error.message}`;
    }
  }

  private shouldCreateTaskPlan(input: string): boolean {
    const inputLower = input.toLowerCase();
    
    // Simple execution tasks - don't need planning
    const simpleTaskIndicators = [
      'show', 'list', 'display', 'print', 'view', 'check', 'status',
      'what is', 'what are', 'how does', 'explain', 'tell me', 'help',
      'fix this error', 'debug this', 'why is', 'where is',
      'find', 'search', 'grep', 'look for', 'locate'
    ];

    // Quick modifications - don't need planning
    const quickModificationIndicators = [
      'change this', 'update this', 'modify this', 'edit this',
      'replace this', 'fix this bug', 'correct this', 'adjust this',
      'add this line', 'remove this line', 'delete this',
      'rename this', 'move this file'
    ];

    // Complex project tasks - need planning
    const complexTaskIndicators = [
      'implement', 'create new', 'build', 'develop', 'refactor entire',
      'migrate', 'setup project', 'configure project', 'add feature',
      'new feature', 'complete project', 'full implementation',
      'entire application', 'whole project', 'from scratch',
      'step by step', 'architecture', 'design system',
      'multiple files', 'several components', 'database schema'
    ];

    // Multi-step indicators - need planning
    const multiStepIndicators = [
      'first', 'then', 'after that', 'next', 'finally',
      'phase 1', 'phase 2', 'step 1', 'step 2',
      'multiple steps', 'several tasks', 'different parts'
    ];

    // Check for simple tasks first
    const hasSimpleIndicator = simpleTaskIndicators.some(indicator => 
      inputLower.includes(indicator)
    );
    
    const hasQuickModIndicator = quickModificationIndicators.some(indicator => 
      inputLower.includes(indicator)
    );

    // If it's a simple task, don't plan
    if (hasSimpleIndicator || (hasQuickModIndicator && input.split(' ').length < 15)) {
      return false;
    }

    // Check for complex indicators
    const hasComplexIndicator = complexTaskIndicators.some(indicator => 
      inputLower.includes(indicator)
    );

    const hasMultiStepIndicator = multiStepIndicators.some(indicator => 
      inputLower.includes(indicator)
    );

    // Strong indicators for planning
    if (hasComplexIndicator || hasMultiStepIndicator) {
      return true;
    }

    // Length and complexity heuristics
    const wordCount = input.split(' ').length;
    const hasMultipleRequirements = input.includes(' and ') || 
                                   input.split(',').length > 2 ||
                                   input.split('.').length > 2;
    
    const hasFileOperations = inputLower.includes('file') || 
                              inputLower.includes('component') ||
                              inputLower.includes('module');

    // Plan if it's a long request with multiple requirements or file operations
    return (wordCount > 15 && hasMultipleRequirements) || 
           (wordCount > 20 && hasFileOperations) ||
           (wordCount > 30);
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
      
      // Start tracking this specific task
      this.usageTracker.startTask(nextTask.id, nextTask.title);

      // Execute the task
      const taskPrompt = this.buildTaskExecutionPrompt(nextTask);
      const taskType = nextTask.type === 'analysis' || nextTask.type === 'planning' 
        ? 'reasoning' : 'coding';
      
      const chatResponse = await this.openRouterClient.chat([
        { role: 'system', content: this.getTaskExecutionSystemPrompt() },
        { role: 'user', content: taskPrompt }
      ], taskType);

      // Track usage for this task
      this.usageTracker.recordUsage({
        prompt_tokens: chatResponse.usage.prompt_tokens,
        completion_tokens: chatResponse.usage.completion_tokens,
        total_tokens: chatResponse.usage.total_tokens,
        model: chatResponse.model,
        timestamp: new Date()
      });

      // Process any tool calls
      const processedResponse = await this.processToolCalls(chatResponse.content);
      
      // Mark task as completed and end task tracking
      this.taskPlanner.markTaskComplete(nextTask.id, processedResponse);
      this.usageTracker.endCurrentTask();
      
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
    
    // Reset usage tracking
    this.usageTracker.reset();
    this.usageTracker.startTask('conversation_start', 'Initial Conversation');
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

  // Context Management Methods
  private async manageContext(): Promise<void> {
    if (this.contextManager.shouldTruncate(this.conversation.messages)) {
      console.log('🚨 Context window critical - performing emergency truncation');
      const { truncatedMessages, removedCount } = this.contextManager.truncateMessages(this.conversation.messages);
      this.conversation.messages = truncatedMessages;
      console.log(`Removed ${removedCount} old messages to stay within context limit`);
    } else if (this.contextManager.shouldCompress(this.conversation.messages)) {
      console.log('💡 Context window getting full - compressing conversation');
      try {
        const { compressedMessages, summary } = await this.contextManager.compressConversation(
          this.conversation.messages,
          async (messages) => {
            const response = await this.openRouterClient.chat(messages, 'reasoning');
            // Track usage for compression
            this.usageTracker.recordUsage({
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens,
              model: response.model,
              timestamp: new Date()
            });
            return response.content;
          }
        );
        this.conversation.messages = compressedMessages;
        console.log(`Compressed ${summary.messagesCompressed} messages, saved ${summary.tokensSaved} tokens`);
      } catch (error) {
        console.warn('Failed to compress conversation, falling back to truncation');
        const { truncatedMessages } = this.contextManager.truncateMessages(this.conversation.messages);
        this.conversation.messages = truncatedMessages;
      }
    }
  }

  private getContextStatus(): string {
    const contextInfo = this.contextManager.getContextInfo(this.conversation.messages);
    const recommendations = this.contextManager.getRecommendedActions(this.conversation.messages);
    
    let status = `📊 **Context Status**\n\n${contextInfo}\n`;
    
    if (recommendations.length > 0) {
      status += `\n**Recommendations:**\n${recommendations.map(r => `- ${r}`).join('\n')}`;
    }
    
    const context = this.contextManager.calculateContextWindow(this.conversation.messages);
    status += `\n\n**Details:**`;
    status += `\n- Messages: ${this.conversation.messages.length}`;
    status += `\n- Current tokens: ${context.currentTokens.toLocaleString()}`;
    status += `\n- Target limit: ${context.targetTokens.toLocaleString()}`;
    status += `\n- Max limit: ${context.maxTokens.toLocaleString()}`;
    status += `\n- Utilization: ${context.utilizationPercentage.toFixed(1)}%`;
    
    return status;
  }

  private getContextWarning(): string | null {
    const context = this.contextManager.calculateContextWindow(this.conversation.messages);
    
    if (context.utilizationPercentage > 80) {
      return `⚠️ Context window is ${context.utilizationPercentage.toFixed(1)}% full. Consider using '/context' to check status or start a new conversation for better performance.`;
    } else if (context.utilizationPercentage > 60) {
      return `💡 Context window is ${context.utilizationPercentage.toFixed(1)}% full. This conversation will be automatically managed to maintain performance.`;
    }
    
    return null;
  }

  // Enhanced tool processing with context awareness
  private async processToolCallsWithContext(response: string, userQuery: string): Promise<string> {
    const toolResults: string[] = [];
    const toolCallPattern = /\[TOOL:(\w+)\](.*?)\[\/TOOL\]/gs;
    let match;

    while ((match = toolCallPattern.exec(response)) !== null) {
      const toolName = match[1] as any;
      const toolParams = this.parseToolParameters(match[2]);
      
      try {
        const result = await this.toolManager.executeTool(toolName, toolParams);
        
        if (result.success && result.result) {
          // Apply context-aware processing to tool results
          const managedResult = this.applyContextLimitsToToolResult(result.result, userQuery);
          toolResults.push(`[TOOL RESULT: ${toolName}]\n${managedResult}\n[/TOOL RESULT]`);
        } else {
          toolResults.push(`[TOOL ERROR: ${toolName}]\n${result.error}\n[/TOOL ERROR]`);
        }
        
        // Replace the tool call with the result
        response = response.replace(match[0], toolResults[toolResults.length - 1]);
      } catch (error: any) {
        const errorResult = `[TOOL ERROR: ${toolName}]\nFailed to execute: ${error.message}\n[/TOOL ERROR]`;
        toolResults.push(errorResult);
        response = response.replace(match[0], errorResult);
      }
    }

    return response;
  }

  private applyContextLimitsToToolResult(result: string, userQuery: string): string {
    const maxToolResultTokens = 10000; // Limit individual tool results
    const resultTokens = this.contextManager.estimateTokens(result);
    
    if (resultTokens <= maxToolResultTokens) {
      return result;
    }

    // If result is too large, try to prioritize relevant content
    const lines = result.split('\n');
    
    // For code files, prioritize based on user query
    if (userQuery && lines.length > 50) {
      const prioritizedContent = this.contextManager.prioritizeFileContent(
        [result], 
        userQuery, 
        maxToolResultTokens
      );
      
      if (prioritizedContent.length > 0) {
        return prioritizedContent[0] + '\n\n[... content truncated for context management ...]';
      }
    }
    
    // Simple truncation as fallback
    const targetLength = Math.floor(result.length * (maxToolResultTokens / resultTokens));
    return result.substring(0, targetLength) + '\n\n[... content truncated for context management ...]';
  }

  // Update context limits
  updateContextLimits(maxTokens: number, targetTokens: number): void {
    this.contextManager.updateLimits(maxTokens, targetTokens);
  }

  // Get current context window info
  getContextWindow(): ContextWindow {
    return this.contextManager.calculateContextWindow(this.conversation.messages);
  }

  // Usage tracking methods
  getUsageTracker(): UsageTracker {
    return this.usageTracker;
  }

  getConversationUsage() {
    return this.usageTracker.getConversationUsage();
  }

  getCurrentTaskUsage() {
    return this.usageTracker.getCurrentTaskUsage();
  }

  private getUsageStatus(): string {
    const conversation = this.usageTracker.getConversationUsage();
    const currentTask = this.usageTracker.getCurrentTaskUsage();

    let status = '📊 **Detailed Usage Report**\n\n';

    // Current task details
    if (currentTask) {
      status += `**Current Task: ${currentTask.taskName}**\n`;
      status += `• Task ID: ${currentTask.taskId}\n`;
      status += `• Requests: ${currentTask.requestCount}\n`;
      status += `• Prompt tokens: ${currentTask.totalPromptTokens.toLocaleString()}\n`;
      status += `• Completion tokens: ${currentTask.totalCompletionTokens.toLocaleString()}\n`;
      status += `• Total tokens: ${currentTask.totalTokens.toLocaleString()}\n`;
      status += `• Models used: ${currentTask.models.join(', ')}\n`;
      status += `• Started: ${currentTask.startTime.toLocaleString()}\n\n`;
    }

    // Conversation totals
    status += `**Conversation Totals:**\n`;
    status += `• Total requests: ${conversation.totalRequests}\n`;
    status += `• Total prompt tokens: ${conversation.totalPromptTokens.toLocaleString()}\n`;
    status += `• Total completion tokens: ${conversation.totalCompletionTokens.toLocaleString()}\n`;
    status += `• Total tokens: ${conversation.totalTokens.toLocaleString()}\n`;
    status += `• Models used: ${conversation.modelsUsed.join(', ')}\n`;
    status += `• Conversation started: ${conversation.startTime.toLocaleString()}\n`;
    status += `• Tasks completed: ${conversation.tasks.filter(t => t.endTime).length}\n`;
    status += `• Tasks in progress: ${conversation.tasks.filter(t => !t.endTime).length}\n\n`;

    // Task breakdown
    if (conversation.tasks.length > 0) {
      status += `**Task Breakdown:**\n`;
      conversation.tasks.forEach((task, index) => {
        const statusIcon = task.endTime ? '✅' : '🔄';
        status += `${index + 1}. ${statusIcon} ${task.taskName}\n`;
        status += `   • Tokens: ${task.totalTokens.toLocaleString()}\n`;
        status += `   • Requests: ${task.requestCount}\n`;
        if (task.endTime) {
          const duration = task.endTime.getTime() - task.startTime.getTime();
          status += `   • Duration: ${Math.round(duration / 1000)}s\n`;
        }
      });
    }

    return status;
  }

  private getBlueprintStatus(): string {
    const currentWorkspace = workspaceManager.getCurrentWorkspace();
    const blueprintExists = this.contextManager.blueprintExists();
    
    let status = `**Blueprint Status:**\n\n`;
    status += `• Current workspace: ${currentWorkspace.name} (${currentWorkspace.path})\n`;
    status += `• Blueprint.md exists: ${blueprintExists ? '✅ Yes' : '❌ No'}\n`;
    
    if (blueprintExists) {
      status += `• Status: Loaded in system context\n`;
      status += `• Use /refresh-blueprint to reload if changed\n`;
    } else {
      status += `• Create a blueprint.md file in your project root for automatic context loading\n`;
    }
    
    return status;
  }

  private getWorkspaceStatus(): string {
    const currentWorkspace = workspaceManager.getCurrentWorkspace();
    const allWorkspaces = workspaceManager.listWorkspaces();
    
    let status = `**Workspace Status:**\n\n`;
    status += `• Current workspace: ${currentWorkspace.name}\n`;
    status += `• Current path: ${currentWorkspace.path}\n`;
    status += `• Blueprint.md exists: ${this.contextManager.blueprintExists() ? '✅' : '❌'}\n\n`;
    
    status += `**Available Workspaces:**\n`;
    Object.entries(allWorkspaces).forEach(([name, path]) => {
      const isCurrent = name === currentWorkspace.name;
      const marker = isCurrent ? '👉' : '  ';
      status += `${marker} ${name}: ${path}\n`;
    });
    
    status += `\nUse the workspace CLI to manage workspaces: workspace switch <name>\n`;
    return status;
  }
}