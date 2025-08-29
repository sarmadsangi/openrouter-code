# OpenRouter Code Assistant Blueprint

## Project Overview
This is a Claude Code clone built using OpenRouter for configurable AI models. The system provides an interactive coding assistant that can read, understand, and modify codebases through natural language interaction.

## Key Features
- **Multi-model support**: Uses OpenRouter to support various AI models
- **Task planning**: Intelligent planning for complex coding tasks
- **Context management**: Smart context window management with blueprint integration
- **Workspace management**: Support for multiple project workspaces
- **Tool integration**: File operations, bash commands, search capabilities

## Architecture
- **CLI Interface**: Primary interaction through command-line interface
- **Conversation Manager**: Handles chat flow and context
- **Task Planner**: Breaks down complex tasks into manageable steps
- **Context Manager**: Manages conversation context and blueprint integration
- **Workspace Manager**: Handles multiple project environments

## Development Guidelines
- Use TypeScript for type safety
- Follow modular architecture with clear separation of concerns
- Implement proper error handling and validation
- Maintain backwards compatibility when adding features
- Write comprehensive tests for new functionality

## Blueprint Auto-loading
The system automatically loads this blueprint.md file to provide project context to the AI assistant. This ensures the assistant understands the project structure, goals, and guidelines without requiring manual explanation.

## Task Planning Intelligence
The system uses intelligent heuristics to determine when task planning is needed versus direct execution:
- Simple queries and quick modifications are executed directly
- Complex multi-step tasks trigger automatic planning
- Planning can be manually triggered with `/plan` command