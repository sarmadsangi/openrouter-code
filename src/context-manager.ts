import { Message } from './types';

export interface ContextWindow {
  maxTokens: number;
  targetTokens: number; // Target to stay under for reduced hallucinations
  currentTokens: number;
  utilizationPercentage: number;
}

export interface ContextSummary {
  summary: string;
  tokensSaved: number;
  messagesCompressed: number;
}

export class ContextManager {
  private maxContextTokens: number;
  private targetContextTokens: number;
  private readonly tokenBuffer: number = 5000; // Safety buffer

  constructor(maxTokens: number = 200000, targetTokens: number = 100000) {
    this.maxContextTokens = maxTokens;
    this.targetContextTokens = targetTokens;
  }

  // Rough token estimation - approximately 4 characters per token for English
  // This is conservative and works well for most cases
  estimateTokens(text: string): number {
    // More accurate estimation considering:
    // - Average 4 chars per token for English
    // - Code tokens tend to be shorter
    // - JSON/structured data has more punctuation
    
    const baseEstimate = Math.ceil(text.length / 4);
    
    // Adjust for content type
    const codePatterns = /[{}();,\[\]]/g;
    const codeMatches = (text.match(codePatterns) || []).length;
    
    // Code has more tokens due to punctuation and symbols
    const codeAdjustment = codeMatches * 0.2;
    
    return Math.ceil(baseEstimate + codeAdjustment);
  }

  calculateContextWindow(messages: Message[]): ContextWindow {
    const totalText = messages.map(m => m.content).join('\n');
    const currentTokens = this.estimateTokens(totalText);
    
    return {
      maxTokens: this.maxContextTokens,
      targetTokens: this.targetContextTokens,
      currentTokens,
      utilizationPercentage: (currentTokens / this.maxContextTokens) * 100
    };
  }

  shouldCompress(messages: Message[]): boolean {
    const context = this.calculateContextWindow(messages);
    return context.currentTokens > this.targetContextTokens;
  }

  shouldTruncate(messages: Message[]): boolean {
    const context = this.calculateContextWindow(messages);
    return context.currentTokens > (this.maxContextTokens - this.tokenBuffer);
  }

  // Compress conversation by summarizing older messages
  async compressConversation(
    messages: Message[], 
    chatFunction: (messages: Message[]) => Promise<string>
  ): Promise<{ compressedMessages: Message[], summary: ContextSummary }> {
    if (messages.length <= 3) {
      return { 
        compressedMessages: messages, 
        summary: { summary: '', tokensSaved: 0, messagesCompressed: 0 }
      };
    }

    // Keep system message, and recent messages
    const systemMessage = messages[0];
    const recentMessages = messages.slice(-8); // Keep last 8 messages
    const middleMessages = messages.slice(1, -8); // Messages to compress

    if (middleMessages.length === 0) {
      return { 
        compressedMessages: messages, 
        summary: { summary: '', tokensSaved: 0, messagesCompressed: 0 }
      };
    }

    // Create summary of middle conversation
    const summaryPrompt: Message[] = [
      {
        role: 'system',
        content: `Summarize the following conversation concisely, preserving key decisions, file changes, and important context. Focus on actionable information and maintain continuity for the ongoing conversation.`
      },
      {
        role: 'user',
        content: `Please summarize this conversation:\n\n${middleMessages.map(m => `${m.role}: ${m.content}`).join('\n\n')}`
      }
    ];

    try {
      const summaryText = await chatFunction(summaryPrompt);
      
      const originalTokens = this.estimateTokens(middleMessages.map(m => m.content).join('\n'));
      const summaryTokens = this.estimateTokens(summaryText);
      
      const summarizedMessage: Message = {
        role: 'system',
        content: `[CONVERSATION SUMMARY]\n${summaryText}\n[END SUMMARY]`
      };

      const compressedMessages = [
        systemMessage,
        summarizedMessage,
        ...recentMessages
      ];

      return {
        compressedMessages,
        summary: {
          summary: summaryText,
          tokensSaved: originalTokens - summaryTokens,
          messagesCompressed: middleMessages.length
        }
      };
    } catch (error) {
      console.warn('Failed to compress conversation:', error);
      // Fall back to simple truncation
      return {
        compressedMessages: [systemMessage, ...recentMessages],
        summary: {
          summary: 'Compressed due to context limit',
          tokensSaved: this.estimateTokens(middleMessages.map(m => m.content).join('\n')),
          messagesCompressed: middleMessages.length
        }
      };
    }
  }

  // Intelligent truncation - remove messages but keep important context
  truncateMessages(messages: Message[]): { truncatedMessages: Message[], removedCount: number } {
    if (messages.length <= 2) {
      return { truncatedMessages: messages, removedCount: 0 };
    }

    // Always keep system message and most recent message
    const systemMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    
    // Calculate how many messages we can keep
    let totalTokens = this.estimateTokens(systemMessage.content + lastMessage.content);
    const keepMessages = [systemMessage];
    let removedCount = 0;

    // Add messages from most recent backwards until we hit limit
    for (let i = messages.length - 1; i >= 1; i--) {
      const messageTokens = this.estimateTokens(messages[i].content);
      
      if (totalTokens + messageTokens > this.targetContextTokens) {
        removedCount = i;
        break;
      }
      
      keepMessages.unshift(messages[i]);
      totalTokens += messageTokens;
    }

    // Ensure we keep at least the system message and last message
    if (keepMessages.length === 1) {
      keepMessages.push(lastMessage);
    }

    return {
      truncatedMessages: keepMessages,
      removedCount
    };
  }

  // Get context utilization info for display
  getContextInfo(messages: Message[]): string {
    const context = this.calculateContextWindow(messages);
    const percentage = context.utilizationPercentage.toFixed(1);
    
    let status = '🟢 Good';
    if (context.utilizationPercentage > 80) status = '🔴 High';
    else if (context.utilizationPercentage > 60) status = '🟡 Medium';
    
    return `Context: ${context.currentTokens.toLocaleString()}/${context.maxTokens.toLocaleString()} tokens (${percentage}%) ${status}`;
  }

  // Prioritize file content based on relevance
  prioritizeFileContent(fileContents: string[], query: string, maxTokens: number): string[] {
    interface ScoredContent {
      content: string;
      score: number;
      tokens: number;
    }

    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    const scoredContents: ScoredContent[] = fileContents.map(content => {
      const contentLower = content.toLowerCase();
      let score = 0;
      
      // Score based on query term matches
      queryTerms.forEach(term => {
        const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
        score += matches * (term.length > 4 ? 2 : 1); // Longer terms get higher weight
      });
      
      // Boost score for code-like content
      if (content.includes('function') || content.includes('class') || content.includes('import')) {
        score += 10;
      }
      
      return {
        content,
        score,
        tokens: this.estimateTokens(content)
      };
    });

    // Sort by score descending
    scoredContents.sort((a, b) => b.score - a.score);
    
    // Select content up to token limit
    const selected: string[] = [];
    let totalTokens = 0;
    
    for (const item of scoredContents) {
      if (totalTokens + item.tokens <= maxTokens) {
        selected.push(item.content);
        totalTokens += item.tokens;
      }
    }
    
    return selected;
  }

  // Create a focused context window for specific tasks
  createFocusedContext(
    messages: Message[], 
    relevantFiles: string[], 
    maxFileTokens: number = 30000
  ): Message[] {
    const context = this.calculateContextWindow(messages);
    const remainingTokens = this.targetContextTokens - context.currentTokens;
    
    if (remainingTokens <= 0 || relevantFiles.length === 0) {
      return messages;
    }

    // Use available tokens for file content, but cap at maxFileTokens
    const fileTokenBudget = Math.min(remainingTokens * 0.7, maxFileTokens);
    
    // Create a context message with relevant file content
    const fileContent = relevantFiles.slice(0, Math.floor(fileTokenBudget / 1000)).join('\n\n---\n\n');
    const fileTokens = this.estimateTokens(fileContent);
    
    if (fileTokens > 100) { // Only add if substantial content
      const contextMessage: Message = {
        role: 'system',
        content: `[RELEVANT CODE CONTEXT]\n${fileContent}\n[END CONTEXT]`
      };
      
      return [messages[0], contextMessage, ...messages.slice(1)];
    }
    
    return messages;
  }

  // Update configuration
  updateLimits(maxTokens: number, targetTokens: number): void {
    this.maxContextTokens = maxTokens;
    this.targetContextTokens = targetTokens;
  }

  // Get recommended actions based on context state
  getRecommendedActions(messages: Message[]): string[] {
    const context = this.calculateContextWindow(messages);
    const actions: string[] = [];
    
    if (context.utilizationPercentage > 90) {
      actions.push('🚨 Critical: Context window nearly full - immediate compression needed');
    } else if (context.utilizationPercentage > 75) {
      actions.push('⚠️ Warning: Consider compressing conversation or starting fresh');
    } else if (context.utilizationPercentage > 50) {
      actions.push('💡 Info: Context window getting full - compression may be needed soon');
    }
    
    if (messages.length > 20) {
      actions.push('📝 Suggestion: Long conversation - consider summarizing older messages');
    }
    
    return actions;
  }
}