import { OpenRouterClient } from './openrouter-client';
import { ToolManager } from './tools/tool-manager';
import { ConfigManager } from './config';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'analysis' | 'planning' | 'implementation' | 'testing' | 'documentation';
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  estimatedComplexity: 'low' | 'medium' | 'high';
  toolsRequired: string[];
  result?: string;
  error?: string;
}

export interface TaskPlan {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
  currentTaskIndex: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
}

export class TaskPlanner {
  private openRouterClient: OpenRouterClient;
  private toolManager: ToolManager;
  private configManager: ConfigManager;
  private currentPlan: TaskPlan | null = null;

  constructor(configManager: ConfigManager, toolManager: ToolManager) {
    this.configManager = configManager;
    this.openRouterClient = new OpenRouterClient(configManager);
    this.toolManager = toolManager;
  }

  async createTaskPlan(userRequest: string): Promise<TaskPlan> {
    const planningPrompt = this.buildPlanningPrompt(userRequest);
    
    try {
      const response = await this.openRouterClient.chat([
        { role: 'system', content: this.getPlanningSystemPrompt() },
        { role: 'user', content: planningPrompt }
      ], 'reasoning');

      const plan = this.parseTaskPlanFromResponse(response.content, userRequest);
      this.currentPlan = plan;
      return plan;
    } catch (error: any) {
      throw new Error(`Failed to create task plan: ${error.message}`);
    }
  }

  private buildPlanningPrompt(userRequest: string): string {
    return `
I need to break down this coding task into manageable steps:

"${userRequest}"

Please analyze this request and create a detailed task breakdown. Consider:
1. What needs to be analyzed or understood first
2. What planning is required
3. What code needs to be implemented
4. What testing is needed
5. What documentation might be required

For each task, specify:
- Title and description
- Type (analysis/planning/implementation/testing/documentation)
- Estimated complexity (low/medium/high)
- Dependencies on other tasks
- Tools that might be needed (Read, Write, Bash, Grep, Search, WebSearch)

Format your response as a structured plan with numbered tasks.
`;
  }

  private getPlanningSystemPrompt(): string {
    return `You are an expert software development planner. Your job is to break down complex coding tasks into manageable, sequential steps.

Key principles:
- Start with analysis and understanding
- Plan before implementing
- Consider dependencies between tasks
- Be specific about what each step accomplishes
- Think about potential challenges
- Include testing and documentation steps

Available tools: ${this.toolManager.getAvailableTools().join(', ')}

Always structure your response with clear task breakdowns that can be executed step by step.`;
  }

  private parseTaskPlanFromResponse(response: string, userRequest: string): TaskPlan {
    const plan: TaskPlan = {
      id: this.generateId(),
      title: this.extractTitleFromRequest(userRequest),
      description: userRequest,
      tasks: [],
      currentTaskIndex: 0,
      status: 'planning',
      createdAt: new Date()
    };

    // Simple parsing - in production you'd want more robust parsing
    const lines = response.split('\n');
    let currentTask: Partial<Task> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for numbered tasks
      const taskMatch = trimmed.match(/^(\d+)\.\s*(.+)/);
      if (taskMatch) {
        // Save previous task if exists
        if (currentTask && currentTask.title) {
          plan.tasks.push(this.completeTask(currentTask));
        }
        
        // Start new task
        currentTask = {
          id: this.generateId(),
          title: taskMatch[2],
          description: taskMatch[2],
          type: this.inferTaskType(taskMatch[2]),
          dependencies: [],
          status: 'pending',
          estimatedComplexity: this.inferComplexity(taskMatch[2]),
          toolsRequired: this.inferRequiredTools(taskMatch[2])
        };
      } else if (currentTask && trimmed.startsWith('-')) {
        // Add description details
        const detail = trimmed.substring(1).trim();
        currentTask.description += `\n- ${detail}`;
      }
    }

    // Add final task
    if (currentTask && currentTask.title) {
      plan.tasks.push(this.completeTask(currentTask));
    }

    // If no tasks were parsed, create a basic plan
    if (plan.tasks.length === 0) {
      plan.tasks = this.createBasicPlan(userRequest);
    }

    // Set dependencies
    this.setTaskDependencies(plan.tasks);

    return plan;
  }

  private completeTask(partial: Partial<Task>): Task {
    return {
      id: partial.id || this.generateId(),
      title: partial.title || 'Untitled Task',
      description: partial.description || partial.title || 'No description',
      type: partial.type || 'implementation',
      dependencies: partial.dependencies || [],
      status: partial.status || 'pending',
      estimatedComplexity: partial.estimatedComplexity || 'medium',
      toolsRequired: partial.toolsRequired || ['Read', 'Write']
    };
  }

  private inferTaskType(title: string): Task['type'] {
    const lower = title.toLowerCase();
    if (lower.includes('analyze') || lower.includes('understand') || lower.includes('review')) {
      return 'analysis';
    }
    if (lower.includes('plan') || lower.includes('design') || lower.includes('architecture')) {
      return 'planning';
    }
    if (lower.includes('test') || lower.includes('verify')) {
      return 'testing';
    }
    if (lower.includes('document') || lower.includes('readme')) {
      return 'documentation';
    }
    return 'implementation';
  }

  private inferComplexity(title: string): Task['estimatedComplexity'] {
    const lower = title.toLowerCase();
    if (lower.includes('simple') || lower.includes('basic') || lower.includes('quick')) {
      return 'low';
    }
    if (lower.includes('complex') || lower.includes('advanced') || lower.includes('refactor')) {
      return 'high';
    }
    return 'medium';
  }

  private inferRequiredTools(title: string): string[] {
    const lower = title.toLowerCase();
    const tools: string[] = [];
    
    if (lower.includes('read') || lower.includes('analyze') || lower.includes('review')) {
      tools.push('Read', 'Search', 'Grep');
    }
    if (lower.includes('write') || lower.includes('create') || lower.includes('implement')) {
      tools.push('Write');
    }
    if (lower.includes('run') || lower.includes('execute') || lower.includes('test')) {
      tools.push('Bash');
    }
    if (lower.includes('search') || lower.includes('find')) {
      tools.push('Search', 'Grep');
    }
    if (lower.includes('web') || lower.includes('documentation') || lower.includes('research')) {
      tools.push('WebSearch');
    }

    return tools.length > 0 ? tools : ['Read', 'Write'];
  }

  private createBasicPlan(userRequest: string): Task[] {
    return [
      {
        id: this.generateId(),
        title: 'Analyze Requirements',
        description: `Understand what needs to be done: ${userRequest}`,
        type: 'analysis',
        dependencies: [],
        status: 'pending',
        estimatedComplexity: 'low',
        toolsRequired: ['Read', 'Search']
      },
      {
        id: this.generateId(),
        title: 'Plan Implementation',
        description: 'Design the approach and identify required changes',
        type: 'planning',
        dependencies: [],
        status: 'pending',
        estimatedComplexity: 'medium',
        toolsRequired: ['Read', 'Search']
      },
      {
        id: this.generateId(),
        title: 'Implement Solution',
        description: 'Execute the planned changes',
        type: 'implementation',
        dependencies: [],
        status: 'pending',
        estimatedComplexity: 'high',
        toolsRequired: ['Read', 'Write', 'Bash']
      }
    ];
  }

  private setTaskDependencies(tasks: Task[]): void {
    // Simple dependency setting - each task depends on the previous one
    for (let i = 1; i < tasks.length; i++) {
      tasks[i].dependencies = [tasks[i - 1].id];
    }
  }

  private extractTitleFromRequest(request: string): string {
    const words = request.split(' ').slice(0, 8).join(' ');
    return words.length > 50 ? words.substring(0, 47) + '...' : words;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getCurrentPlan(): TaskPlan | null {
    return this.currentPlan;
  }

  getNextPendingTask(): Task | null {
    if (!this.currentPlan) return null;
    
    return this.currentPlan.tasks.find(task => 
      task.status === 'pending' && 
      task.dependencies.every(depId => 
        this.currentPlan!.tasks.find(t => t.id === depId)?.status === 'completed'
      )
    ) || null;
  }

  markTaskComplete(taskId: string, result: string): void {
    if (!this.currentPlan) return;
    
    const task = this.currentPlan.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.result = result;
    }
  }

  markTaskFailed(taskId: string, error: string): void {
    if (!this.currentPlan) return;
    
    const task = this.currentPlan.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'failed';
      task.error = error;
    }
  }

  formatPlanSummary(): string {
    if (!this.currentPlan) return 'No active plan';
    
    const plan = this.currentPlan;
    const completedTasks = plan.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = plan.tasks.length;
    
    let summary = `📋 **${plan.title}**\n`;
    summary += `Progress: ${completedTasks}/${totalTasks} tasks completed\n\n`;
    
    plan.tasks.forEach((task, index) => {
      const status = this.getTaskStatusIcon(task.status);
      const complexity = this.getComplexityIcon(task.estimatedComplexity);
      summary += `${index + 1}. ${status} ${task.title} ${complexity}\n`;
      if (task.status === 'in_progress') {
        summary += `   🔄 Currently working on this task\n`;
      }
      if (task.error) {
        summary += `   ❌ Error: ${task.error}\n`;
      }
    });
    
    return summary;
  }

  private getTaskStatusIcon(status: Task['status']): string {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '⏳';
    }
  }

  private getComplexityIcon(complexity: Task['estimatedComplexity']): string {
    switch (complexity) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  }
}