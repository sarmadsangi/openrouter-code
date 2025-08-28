# OpenRouter Code Assistant

A Claude Code clone that uses OpenRouter for flexible AI model selection, allowing you to configure different models for reasoning and coding tasks.

## Features

- 🤖 **Multiple Model Support**: Configure separate models for reasoning vs coding tasks
- 🛠️ **Comprehensive Tools**: Read, Write, Bash, Grep, Search, WebSearch capabilities
- ⚡ **Optimized DevX**: Minimal API surface with maximum functionality
- 🔧 **Configurable**: Flexible configuration via environment variables
- 💬 **Interactive Chat**: Terminal-based conversation interface
- 🔒 **Security**: Built-in command filtering and safety checks

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd openrouter-code

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Setup

Run the interactive setup wizard:

```bash
npm run dev -- setup
```

Or manually create a `.env` file:

```bash
cp .env.example .env
# Edit .env with your OpenRouter API key and model preferences
```

### 3. Usage

Start an interactive chat session:

```bash
npm run dev -- chat
```

Or use the built version:

```bash
npm start chat
```

## Configuration

The assistant supports the following configuration options:

```env
# OpenRouter Configuration
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Model Configuration
REASONING_MODEL=anthropic/claude-3.5-sonnet  # For complex reasoning tasks
CODING_MODEL=anthropic/claude-3.5-sonnet    # For coding tasks
FALLBACK_MODEL=openai/gpt-4                 # Fallback model

# Assistant Configuration
MAX_TURNS=40                                 # Maximum conversation turns
MAX_TOKENS=95000                            # Maximum tokens per response
TEMPERATURE=0.1                             # Response randomness (0.0-1.0)
ALLOWED_TOOLS=Read,Write,Bash,Grep,Search,WebSearch  # Available tools
```

## Available Tools

- **Read**: Read file contents
- **Write**: Write content to files
- **Bash**: Execute shell commands (with safety filters)
- **Grep**: Search for patterns in files
- **Search**: Search through codebase for files and content
- **WebSearch**: Search the web for information

## Commands

### Chat Commands
- `exit` - Exit the chat session
- `help` - Show available commands and tools
- `reset` - Reset the conversation
- `status` - Show conversation status

### CLI Commands
- `orcode chat` - Start interactive chat
- `orcode models` - List available OpenRouter models
- `orcode config` - Show current configuration
- `orcode setup` - Run setup wizard

## Model Selection Strategy

The assistant automatically selects the appropriate model based on your input:

- **Reasoning Model**: Used for analysis, planning, architecture discussions
- **Coding Model**: Used for code implementation, debugging, refactoring
- **Fallback Model**: Used for general queries and as backup

Keywords are analyzed to determine the best model for each task.

## API Reference

The core API supports the following configuration:

```javascript
{
  systemPrompt: string,        // Custom system prompt
  maxTurns: 40,               // Maximum conversation turns
  allowedTools: ["Read", "Write", "Bash", "Grep", "Search", "WebSearch"],
  maxTokens: 95000,           // Token limit per response
  temperature: 0.1            // Response randomness
}
```

## Security

- Dangerous bash commands are filtered out
- File operations are sandboxed to the current directory
- API keys are kept secure in environment variables
- Tool execution has built-in timeouts

## Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Watch mode for development
npm run watch
```

## Architecture

```
src/
├── cli.ts                 # Command-line interface
├── config.ts             # Configuration management
├── conversation-manager.ts # Conversation flow control
├── openrouter-client.ts   # OpenRouter API integration
├── types.ts              # TypeScript definitions
└── tools/                # Tool implementations
    ├── base-tool.ts      # Abstract base tool
    ├── read-tool.ts      # File reading
    ├── write-tool.ts     # File writing
    ├── bash-tool.ts      # Command execution
    ├── grep-tool.ts      # Pattern searching
    ├── search-tool.ts    # Codebase search
    ├── web-search-tool.ts # Web search
    └── tool-manager.ts   # Tool orchestration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the documentation
- Review existing issues
- Create a new issue with detailed information

---

Built with ❤️ for developers who want flexible AI assistance.