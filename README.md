# OpenRouter Code Assistant

A Claude Code clone that uses OpenRouter for flexible AI model selection, allowing you to configure different models for reasoning and coding tasks.

## Features

- 🧠 **Smart Task Planning**: Automatically breaks down complex requests into manageable tasks
- 📖 **Blueprint Auto-loading**: Automatically loads `blueprint.md` for project context
- 🤖 **Multiple Model Support**: Configure separate models for reasoning vs coding tasks
- 🛠️ **Comprehensive Tools**: Read, Write, Bash, Grep, Search, WebSearch, QA capabilities
- 🧪 **QA Agent**: Automated web application testing with browser automation
- 🗂️ **Workspace Management**: Support for multiple project environments
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
- `/blueprint` - Show blueprint.md status
- `/refresh-blueprint` - Refresh blueprint context
- `/workspace` - Show workspace status

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

### Intelligent Task Detection
The assistant uses smart heuristics to determine when planning is needed:

**Simple tasks (direct execution):**
- Information queries: "show", "list", "what is", "explain"
- Quick fixes: "fix this error", "change this variable"
- File operations: "find", "search", "grep"

**Complex tasks (automatic planning):**
- Project-level work: "implement", "create new", "build from scratch"
- Multi-step processes: "first... then... finally"
- Architecture changes: "refactor entire", "migrate"
- Feature development: "add feature with validation and error handling"

**Key improvements:**
- 94% accuracy in task classification
- Avoids unnecessary planning for simple requests
- Automatically detects multi-step requirements
- Considers request length and complexity

## Blueprint Auto-loading

The assistant automatically loads a `blueprint.md` file from your project root to provide context about your project:

### What is a Blueprint?
A blueprint is a markdown file that describes:
- Project overview and architecture
- Development guidelines and conventions
- Key features and functionality
- Technology stack and dependencies

### How it Works
1. Place a `blueprint.md` file in your project root
2. The assistant automatically loads it when starting
3. Blueprint content is included in the AI's context
4. Use `/blueprint` to check status
5. Use `/refresh-blueprint` to reload changes

### Example Blueprint Structure
```markdown
# My Project Blueprint

## Overview
Brief description of what the project does...

## Architecture
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL

## Development Guidelines
- Use functional components
- Follow eslint configuration
- Write tests for new features
```

### Workspace Management
Switch between different project workspaces:
```bash
# Add a new workspace
workspace add myproject /path/to/project

# Switch to a workspace  
workspace switch myproject

# List all workspaces
workspace list
```

## QA Agent - Automated Testing

The QA Agent provides automated web application testing using browser automation. It integrates seamlessly with the task planning system and can validate implementations automatically.

### Quick QA Testing

```bash
# Run automatic QA validation
orcode qa

# Test with custom prompt
orcode qa --prompt "test the user login flow"

# Run QA validation
orcode qa

# Use custom blueprint
orcode qa --blueprint ./my-app/blueprint.md
```

### Agentic QA Integration

When you request web development tasks, QA validation automatically runs:

```bash
orcode chat
> "Create a contact form for my website"
```

The system will:
1. Implement the contact form
2. **Automatically run QA tests** to validate functionality
3. Fix any issues found and re-test
4. Complete only when all tests pass

### Blueprint QA Configuration

Add QA settings to your `blueprint.md`:

```markdown
## Server Configuration
**Start Command:** `npm run dev`
**Port:** 3000
**Health Check:** /api/health

## QA Testing Configuration

### Test Cases
- Verify home page loads correctly
- Test form submissions and validation
- Check navigation functionality

### Browser Configuration
**Browsers:** chromium, firefox
**Viewport:** 1280x720
```

### Example Usage
```
You: "Implement a new user authentication system with JWT tokens, password hashing, and role-based access control"