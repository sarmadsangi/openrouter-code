export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  timestamp: Date;
}

export interface TaskUsage {
  taskId: string;
  taskName: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  requestCount: number;
  models: string[];
  startTime: Date;
  endTime?: Date;
  requests: UsageData[];
}

export interface ConversationUsage {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalRequests: number;
  modelsUsed: string[];
  tasks: TaskUsage[];
  startTime: Date;
}

export class UsageTracker {
  private conversationUsage: ConversationUsage;
  private currentTaskId: string | null = null;

  constructor() {
    this.conversationUsage = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      modelsUsed: [],
      tasks: [],
      startTime: new Date()
    };
  }

  startTask(taskId: string, taskName: string): void {
    // End current task if one exists
    this.endCurrentTask();

    this.currentTaskId = taskId;
    const task: TaskUsage = {
      taskId,
      taskName,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      models: [],
      startTime: new Date(),
      requests: []
    };

    this.conversationUsage.tasks.push(task);
  }

  endCurrentTask(): void {
    if (this.currentTaskId) {
      const currentTask = this.getCurrentTask();
      if (currentTask) {
        currentTask.endTime = new Date();
      }
      this.currentTaskId = null;
    }
  }

  recordUsage(usage: UsageData): void {
    // Update conversation totals
    this.conversationUsage.totalPromptTokens += usage.prompt_tokens;
    this.conversationUsage.totalCompletionTokens += usage.completion_tokens;
    this.conversationUsage.totalTokens += usage.total_tokens;
    this.conversationUsage.totalRequests++;

    // Track unique models
    if (!this.conversationUsage.modelsUsed.includes(usage.model)) {
      this.conversationUsage.modelsUsed.push(usage.model);
    }

    // Update current task if one exists
    const currentTask = this.getCurrentTask();
    if (currentTask) {
      currentTask.totalPromptTokens += usage.prompt_tokens;
      currentTask.totalCompletionTokens += usage.completion_tokens;
      currentTask.totalTokens += usage.total_tokens;
      currentTask.requestCount++;
      currentTask.requests.push(usage);

      if (!currentTask.models.includes(usage.model)) {
        currentTask.models.push(usage.model);
      }
    } else {
      // If no current task, create a general task
      this.startTask(`general_${Date.now()}`, 'General Conversation');
      this.recordUsage(usage);
    }
  }

  private getCurrentTask(): TaskUsage | undefined {
    if (!this.currentTaskId) return undefined;
    return this.conversationUsage.tasks.find(task => task.taskId === this.currentTaskId);
  }

  getConversationUsage(): ConversationUsage {
    return { ...this.conversationUsage };
  }

  getCurrentTaskUsage(): TaskUsage | null {
    const task = this.getCurrentTask();
    return task ? { ...task } : null;
  }

  getLastRequestUsage(): UsageData | null {
    const currentTask = this.getCurrentTask();
    if (currentTask && currentTask.requests.length > 0) {
      return currentTask.requests[currentTask.requests.length - 1];
    }

    // If no current task, look in the last task
    const lastTask = this.conversationUsage.tasks[this.conversationUsage.tasks.length - 1];
    if (lastTask && lastTask.requests.length > 0) {
      return lastTask.requests[lastTask.requests.length - 1];
    }

    return null;
  }

  formatUsageDisplay(): string {
    const lastUsage = this.getLastRequestUsage();
    const currentTask = this.getCurrentTask();
    const conversation = this.getConversationUsage();

    if (!lastUsage) {
      return '';
    }

    let display = '\n' + '─'.repeat(60) + '\n';
    display += '📊 **Usage Summary**\n\n';

    // Last request usage
    display += `**Last Request:**\n`;
    display += `• Model: ${lastUsage.model}\n`;
    display += `• Prompt tokens: ${lastUsage.prompt_tokens.toLocaleString()}\n`;
    display += `• Completion tokens: ${lastUsage.completion_tokens.toLocaleString()}\n`;
    display += `• Total tokens: ${lastUsage.total_tokens.toLocaleString()}\n\n`;

    // Current task usage (if exists)
    if (currentTask) {
      display += `**Current Task (${currentTask.taskName}):**\n`;
      display += `• Requests: ${currentTask.requestCount}\n`;
      display += `• Total tokens: ${currentTask.totalTokens.toLocaleString()}\n`;
      display += `• Models used: ${currentTask.models.join(', ')}\n\n`;
    }

    // Conversation totals
    display += `**Conversation Total:**\n`;
    display += `• Requests: ${conversation.totalRequests}\n`;
    display += `• Total tokens: ${conversation.totalTokens.toLocaleString()}\n`;
    display += `• Tasks completed: ${conversation.tasks.filter(t => t.endTime).length}\n`;
    display += `• Models used: ${conversation.modelsUsed.join(', ')}\n`;

    display += '─'.repeat(60);

    return display;
  }

  reset(): void {
    this.conversationUsage = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      modelsUsed: [],
      tasks: [],
      startTime: new Date()
    };
    this.currentTaskId = null;
  }
}