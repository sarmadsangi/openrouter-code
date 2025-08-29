# OpenRouter Code Assistant

A Claude Code clone that uses OpenRouter for flexible AI model selection, allowing you to configure different models for reasoning and coding tasks.

## Features

- 🧠 **Smart Task Planning**: Automatically breaks down complex requests into manageable tasks
- 🤖 **Multiple Model Support**: Configure separate models for reasoning vs coding tasks
- 🛠️ **Comprehensive Tools**: Read, Write, Bash, Grep, Search, WebSearch capabilities
- ⚡ **Optimized DevX**: Minimal API surface with maximum functionality
- 🔧 **Configurable**: Flexible configuration via environment variables
- 💬 **Interactive Chat**: Terminal-based conversation interface
- ✅ **Approval System**: User approval for destructive operations
- 📋 **Progress Tracking**: Real-time task execution progress
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

## How to Configure Models

### Option 1: Interactive Configuration
```bash
npm run dev -- configure-models
```

### Option 2: CLI Command
```bash
orcode configure-models
```

### Option 3: Manual .env Configuration
Edit your `.env` file with your preferred models:
- **REASONING_MODEL**: For analysis, planning, architecture (e.g., `anthropic/claude-3.5-sonnet`)
- **CODING_MODEL**: For implementation, debugging, refactoring (e.g., `anthropic/claude-3.5-sonnet`)  
- **FALLBACK_MODEL**: For general queries and backup (e.g., `openai/gpt-4`)

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
- `status` - Show conversation and task status
- `models` - Show current model configuration
- `yes/no` - Approve or cancel task execution
- `/plan <request>` - Create a task plan for complex requests
- `/continue` - Continue current task plan
- `/status` - Show task plan status

### CLI Commands
- `orcode chat` - Start interactive chat
- `orcode models` - List available OpenRouter models
- `orcode config` - Show current configuration
- `orcode setup` - Run setup wizard
- `orcode configure-models` - Interactive model configuration

## Model Selection Strategy

The assistant automatically selects the appropriate model based on your input:

- **Reasoning Model**: Used for analysis, planning, architecture discussions
- **Coding Model**: Used for code implementation, debugging, refactoring
- **Fallback Model**: Used for general queries and as backup

Keywords are analyzed to determine the best model for each task.

## Task Planning & Execution

The assistant can automatically break down complex requests into manageable tasks:

### Automatic Task Detection
Complex requests are automatically detected based on keywords like:
- `implement`, `create`, `build`, `develop`, `refactor`
- `setup`, `configure`, `add feature`, `from scratch`
- Long requests with multiple requirements

### Example Usage
```
You: "Implement a new user authentication system with JWT tokens, password hashing, and role-based access control"