import axios, { AxiosInstance } from 'axios';
import { ConfigManager } from './config';
import { Message, OpenRouterResponse, TaskType } from './types';

export interface ChatResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export class OpenRouterClient {
  private client: AxiosInstance;
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    const { apiKey, baseUrl } = configManager.getOpenRouterConfig();
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/your-username/openrouter-code',
        'X-Title': 'OpenRouter Code Assistant'
      }
    });
  }

  async chat(
    messages: Message[], 
    taskType: 'reasoning' | 'coding' | 'general' = 'general'
  ): Promise<ChatResponse> {
    const config = this.configManager.getConfig();
    const model = this.configManager.getModelForTask(taskType);

    try {
      const response = await this.client.post<OpenRouterResponse>('/chat/completions', {
        model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: false
      });

      const choice = response.data.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No response from OpenRouter');
      }

      return {
        content: choice.message.content,
        usage: response.data.usage,
        model: response.data.model
      };
    } catch (error: any) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      
      // Fallback to different model if primary fails
      if (model !== config.models.fallback) {
        console.log(`Falling back to ${config.models.fallback}`);
        return this.chatWithModel(messages, config.models.fallback);
      }
      
      throw error;
    }
  }

  private async chatWithModel(messages: Message[], model: string): Promise<ChatResponse> {
    const config = this.configManager.getConfig();
    
    const response = await this.client.post<OpenRouterResponse>('/chat/completions', {
      model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: false
    });

    const choice = response.data.choices[0];
    if (!choice || !choice.message) {
      throw new Error('No response from fallback model');
    }

    return {
      content: choice.message.content,
      usage: response.data.usage,
      model: response.data.model
    };
  }

  async getAvailableModels(): Promise<any[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      return [];
    }
  }

  determineTaskType(userInput: string): 'reasoning' | 'coding' | 'general' {
    const codingKeywords = [
      'code', 'function', 'class', 'method', 'variable', 'bug', 'debug', 
      'implement', 'refactor', 'optimize', 'test', 'compile', 'syntax',
      'algorithm', 'data structure', 'api', 'database', 'framework'
    ];
    
    const reasoningKeywords = [
      'analyze', 'plan', 'strategy', 'architecture', 'design', 'approach',
      'solve', 'problem', 'logic', 'reasoning', 'decision', 'comparison',
      'evaluate', 'assess', 'recommend', 'explain', 'understand'
    ];

    const input = userInput.toLowerCase();
    
    const codingScore = codingKeywords.reduce((score, keyword) => 
      score + (input.includes(keyword) ? 1 : 0), 0
    );
    
    const reasoningScore = reasoningKeywords.reduce((score, keyword) => 
      score + (input.includes(keyword) ? 1 : 0), 0
    );

    if (codingScore > reasoningScore) return 'coding';
    if (reasoningScore > codingScore) return 'reasoning';
    return 'general';
  }
}