export interface ModelConfig {
  reasoning: string;
  coding: string;
  fallback: string;
}

export interface AssistantConfig {
  systemPrompt: string;
  maxTurns: number;
  allowedTools: Tool[];
  maxTokens: number;
  temperature: number;
  models: ModelConfig;
}

export type Tool = "Read" | "Write" | "Bash" | "Grep" | "Search" | "WebSearch" | "QA";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Conversation {
  messages: Message[];
  turnCount: number;
  currentModel: string;
}

export interface ToolCall {
  tool: Tool;
  parameters: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  result: string;
  error?: string;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface TaskType {
  type: "reasoning" | "coding" | "general";
  description: string;
}