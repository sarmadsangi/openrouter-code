# Changelog

## [1.1.0] - QA Agent Integration

### Added
- **QA Agent System**: Comprehensive automated testing system for web applications
  - Browser automation using Playwright
  - Intelligent test case generation using AI
  - Blueprint.md integration for server configuration
  - Automatic server lifecycle management
  - Cross-browser testing support (Chromium, Firefox, WebKit)

### Features
- **Agentic Workflow Integration**: QA validation automatically triggers after implementation tasks
- **CLI Command**: Standalone `orcode qa` command for manual testing
- **Demo Mode**: Test functionality without requiring OpenRouter API keys
- **Smart Blueprint Parsing**: Extracts server commands, ports, and test configurations
- **Comprehensive Reporting**: Console, HTML, and JSON report formats
- **Screenshot Capture**: Automatic screenshots for debugging and documentation

### Components Added
- `src/qa/qa-agent.ts` - Core QA orchestration and test execution
- `src/qa/blueprint-parser.ts` - Blueprint.md parsing and configuration extraction
- `src/qa/browser-manager.ts` - Playwright browser automation wrapper
- `src/qa/server-manager.ts` - Web server lifecycle management
- `src/qa/test-reporter.ts` - Test result reporting and formatting
- `src/tools/qa-tool.ts` - QA tool integration for the tool system

### Task Planning Integration
- Automatic QA validation task addition for web-related requests
- Smart detection of web development tasks
- Iterative testing and fixing workflow

### CLI Enhancements
- New `qa` command with options for custom prompts, blueprint paths, and demo mode
- Enhanced help and configuration display

### Dependencies Added
- `playwright` - Browser automation framework
- `tree-kill` - Process management for server cleanup
- `jest`, `@types/jest`, `ts-jest` - Testing framework

### Testing
- Comprehensive test suite for QA components
- Integration tests for end-to-end workflows
- Mock implementations for testing without external dependencies

### Examples
- Sample test application with Express.js server
- Example blueprint.md configurations
- Comprehensive documentation and usage examples

### Configuration
- Extended tool system to include QA capabilities
- Blueprint-based configuration for flexible project support
- Demo mode for testing without API requirements