# Context Management Features

Our OpenRouter Code Assistant now includes sophisticated context window management similar to Claude Code, designed to maintain optimal performance and reduce hallucinations.

## Key Features

### 🎯 **Smart Token Limits**
- **Target**: 100,000 tokens for optimal performance
- **Maximum**: 200,000 tokens with automatic management
- **Conservative approach**: Reduces hallucinations and improves accuracy

### 🧠 **Intelligent Token Estimation**
- Accurate token counting for text, code, and structured data
- Adjustments for code patterns and punctuation
- Real-time context window monitoring

### 📊 **Automatic Context Management**
- **Compression**: Summarizes older conversations when approaching limits
- **Truncation**: Intelligent message removal preserving important context
- **Prioritization**: Relevant content selection based on user queries

### ⚡ **Performance Optimizations**
- Tool result limiting (max 10k tokens per tool)
- Smart file content prioritization
- Context-aware processing for large outputs

## Configuration

### Environment Variables
```env
# Context Window Management
MAX_CONTEXT_TOKENS=200000    # Hard limit for context window
TARGET_CONTEXT_TOKENS=100000 # Target limit for optimal performance
```

### Runtime Configuration
```typescript
// Update context limits
conversationManager.updateContextLimits(maxTokens, targetTokens);

// Get current context status
const contextWindow = conversationManager.getContextWindow();
```

## CLI Commands

### Context Monitoring
- `context` - Quick context status
- `/context` - Detailed context analysis
- `status` - Includes context in conversation status

### Visual Indicators
- 🟢 Good (< 60% utilization)
- 🟡 Medium (60-80% utilization)  
- 🔴 High (> 80% utilization)

## How It Works

### 1. **Automatic Detection**
The system continuously monitors token usage and automatically triggers management when needed.

### 2. **Smart Compression**
When context approaches 100k tokens:
- Summarizes middle conversation parts
- Preserves system messages and recent context
- Uses reasoning model for intelligent summarization

### 3. **Emergency Truncation**
When approaching 200k token limit:
- Removes oldest messages first
- Always preserves system prompt and latest exchange
- Maintains conversation continuity

### 4. **Tool Result Management**
- Limits individual tool results to 10k tokens
- Prioritizes relevant content based on user query
- Truncates with clear indicators

## Benefits

### 🎯 **Improved Accuracy**
- Staying within optimal token ranges reduces hallucinations
- Better model performance with focused context

### ⚡ **Consistent Performance**
- Prevents context window overflow
- Maintains fast response times
- Predictable behavior across long conversations

### 🧠 **Smart Context Preservation**
- Keeps relevant information while removing noise
- Maintains conversation continuity
- Preserves important decisions and file changes

## Usage Examples

### Monitoring Context
```bash
You: context
🟢 25,432/100,000 tokens (25.4%)

You: /context
📊 **Context Status**

Context: 25,432/100,000 tokens (25.4%) 🟢 Good

**Details:**
- Messages: 12
- Current tokens: 25,432
- Target limit: 100,000
- Max limit: 200,000
- Utilization: 25.4%
```

### Automatic Management
When context gets full, you'll see:
```
💡 Context window getting full - compressing conversation
Compressed 8 messages, saved 15,234 tokens
```

### Context Warnings
```
⚠️ Context window is 85.2% full. Consider using '/context' to check status or start a new conversation for better performance.
```

## Technical Implementation

### Token Estimation
- ~4 characters per token baseline
- Code adjustment for punctuation and symbols
- Conservative estimation for safety

### Compression Strategy
1. Keep system message (always)
2. Keep last 8 messages (recent context)
3. Summarize middle messages
4. Use reasoning model for compression

### Prioritization Algorithm
- Score content based on query relevance
- Boost code-related content
- Prefer longer, more specific terms
- Maintain token budget limits

## Comparison to Claude Code

Our implementation provides similar context management to Claude Code:

✅ **Automatic context window management**  
✅ **Smart conversation compression**  
✅ **Relevant content prioritization**  
✅ **Performance-optimized token limits**  
✅ **Real-time context monitoring**  
✅ **Conservative approach for accuracy**

This ensures your coding assistant maintains high performance and accuracy even during extended coding sessions, just like Claude Code!