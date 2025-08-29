import dotenv from 'dotenv';
import { AssistantConfig, ModelConfig, Tool } from './types';

dotenv.config();

export class ConfigManager {
  private config: AssistantConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): AssistantConfig {
    return {
      systemPrompt: this.getSystemPrompt(),
      maxTurns: parseInt(process.env.MAX_TURNS || '40'),
      allowedTools: this.getAllowedTools(),
      maxTokens: parseInt(process.env.MAX_TOKENS || '95000'),
      temperature: parseFloat(process.env.TEMPERATURE || '0.1'),
      models: {
        reasoning: process.env.REASONING_MODEL || 'anthropic/claude-3.5-sonnet',
        coding: process.env.CODING_MODEL || 'anthropic/claude-3.5-sonnet',
        fallback: process.env.FALLBACK_MODEL || 'openai/gpt-4'
      }
    };
  }

  private getSystemPrompt(): string {
    return `You are an AI coding assistant similar to Claude Code, powered by OpenRouter. You help developers with coding tasks through natural language interaction.

Key capabilities:
- Read and understand codebases
- Write and edit code files
- Execute bash commands
- Search and grep through files
- Perform web searches for information

Always:
- Ask for permission before making destructive changes
- Provide clear explanations of your actions
- Follow best practices and coding standards
- Be helpful but cautious with file modifications

Available tools: Read, Write, Bash, Grep, Search, WebSearch`;
  }

  private getAllowedTools(): Tool[] {
    const toolsEnv = process.env.ALLOWED_TOOLS;
    if (toolsEnv) {
      return toolsEnv.split(',').map(t => t.trim() as Tool);
    }
    return ["Read", "Write", "Bash", "Grep", "Search", "WebSearch"];
  }

  getConfig(): AssistantConfig {
    return { ...this.config };
  }

  updateModels(models: Partial<ModelConfig>): void {
    this.config.models = { ...this.config.models, ...models };
  }

  getModelForTask(taskType: 'reasoning' | 'coding' | 'general'): string {
    switch (taskType) {
      case 'reasoning':
        return this.config.models.reasoning;
      case 'coding':
        return this.config.models.coding;
      default:
        return this.config.models.fallback;
    }
  }

  getOpenRouterConfig() {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
    };
  }

  getContextLimits() {
    return {
      maxTokens: parseInt(process.env.MAX_CONTEXT_TOKENS || '200000'),
      targetTokens: parseInt(process.env.TARGET_CONTEXT_TOKENS || '100000')
    };
  }
}