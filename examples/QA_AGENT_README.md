# QA Agent Documentation

## Overview

The QA Agent is an intelligent testing system that automatically validates web applications using browser automation. It integrates seamlessly with the existing task planning system and can be used both as part of agentic workflows and as a standalone CLI command.

## Key Features

### 🤖 AI-Powered Test Generation
- Uses OpenRouter AI models to generate intelligent test cases
- Supports custom test prompts for specific validation requirements
- Analyzes page structure and functionality to create targeted tests

### 🌐 Browser Automation
- Built on Playwright for robust cross-browser testing
- Supports Chromium, Firefox, and WebKit
- Automatic screenshot capture for debugging and reporting

### 📋 Blueprint Integration
- Parses `blueprint.md` files to understand server configuration
- Extracts server commands, ports, and testing requirements
- Flexible configuration format supporting various project types

### 🔄 Workflow Integration
- Automatically triggered after implementation tasks in agentic workflows
- Iterative testing: fixes issues and re-runs validation until all tests pass
- Seamless integration with existing task planning system

## Usage

### 1. Standalone CLI Command

```bash
# Run automatic QA validation (requires OpenRouter API key)
orcode qa

# Run with custom test prompt
orcode qa --prompt "Test the user registration and login flow"

# Use custom blueprint file
orcode qa --blueprint ./my-project/blueprint.md

# Specify workspace directory
orcode qa --workspace ./my-web-app
```

### 2. Agentic Workflow Integration

The QA agent automatically runs after implementation tasks when web-related keywords are detected:

```bash
orcode chat
> "Create a contact form component for my React app"
```

The system will:
1. Analyze requirements
2. Plan implementation  
3. Implement the solution
4. **Automatically run QA validation** ✨
5. Fix any issues found and re-validate
6. Complete the task only when all tests pass

### 3. Blueprint Configuration

Create a `blueprint.md` file in your project root:

```markdown
# My Web App Blueprint

## Server Configuration
**Start Command:** `npm run dev`
**Port:** 3000
**Health Check:** /api/health

## QA Testing Configuration

### Test Cases
- Verify home page loads correctly
- Test user authentication flow
- Validate form submissions

### Custom Prompts  
- Test all error handling scenarios
- Verify responsive design works

### Browser Configuration
**Browsers:** chromium, firefox
**Viewport:** 1280x720
```

## Configuration Options

### Server Configuration
- `Start Command`: Command to start your web server
- `Port`: Port number (default: 3000)
- `Base URL`: Custom base URL (default: http://localhost:{port})
- `Health Check`: Endpoint for health checks (default: /)
- `Startup Timeout`: Max time to wait for server startup (default: 30s)

### Test Configuration
- `Test Cases`: Predefined test scenarios
- `Custom Prompts`: AI prompts for generating specific tests
- `Skip Tests`: Test categories to skip
- `Browsers`: Target browsers (chromium, firefox, webkit)
- `Viewport`: Browser viewport size

## Test Case Structure

Test cases are automatically generated or can be defined manually:

```json
{
  "id": "unique_id",
  "name": "Test Name", 
  "description": "What this test validates",
  "steps": [
    {
      "action": "navigate",
      "target": "/",
      "description": "Navigate to home page"
    },
    {
      "action": "click", 
      "target": "#submit-button",
      "description": "Click submit button"
    },
    {
      "action": "fill",
      "target": "#email-input",
      "value": "test@example.com", 
      "description": "Fill email field"
    },
    {
      "action": "check",
      "target": ".success-message",
      "description": "Verify success message appears"
    }
  ],
  "expectedResults": ["Form submits successfully"],
  "priority": "high"
}
```

## Test Actions

- `navigate`: Navigate to a URL path
- `click`: Click an element
- `fill`: Fill an input field
- `wait`: Wait for a specified time
- `check`: Verify element exists
- `screenshot`: Take a screenshot

## Example Workflow

1. **Task Planning**: User requests "Add user authentication"
2. **Implementation**: System implements auth features
3. **QA Validation**: Automatically triggered
   - Starts server using blueprint command
   - Generates test cases for authentication
   - Runs browser tests (login, logout, protected routes)
   - Takes screenshots and logs results
4. **Issue Resolution**: If tests fail, system analyzes errors and fixes issues
5. **Re-validation**: Runs tests again until all pass
6. **Task Completion**: Only completes when QA validation passes

## Reports

The QA agent generates comprehensive reports:

### Console Output
- Real-time test execution status
- Pass/fail summary with timing
- Error details and recommendations

### HTML Reports  
- Visual test results with screenshots
- Detailed step-by-step execution logs
- Interactive timeline and metrics

### JSON Reports
- Machine-readable test results
- Integration with CI/CD systems
- Detailed metadata and timing information

## Integration Examples

### React Application
```markdown
# React App Blueprint
**Start Command:** `npm start`
**Port:** 3000

### Test Cases
- Component rendering and props
- State management and user interactions
- Routing and navigation
- API integration and error handling
```

### Next.js Application  
```markdown
# Next.js App Blueprint
**Start Command:** `npm run dev`
**Port:** 3000

### Test Cases
- SSR and page hydration
- Dynamic routing
- API routes functionality
- Image optimization and loading
```

### Express API
```markdown
# Express API Blueprint
**Start Command:** `npm run dev`
**Port:** 8080
**Health Check:** /api/v1/health

### Test Cases
- API endpoint responses
- Authentication middleware
- Error handling and status codes
- Request validation
```

## Advanced Features

### Custom Test Generation
Use specific prompts to generate targeted tests:

```bash
orcode qa --prompt "Test the shopping cart functionality including add to cart, quantity updates, and checkout process"
```

### Multi-Browser Testing
Configure multiple browsers for cross-browser validation:

```markdown
**Browsers:** chromium, firefox, webkit
```

### Environment-Specific Testing
Different configurations for development vs production:

```markdown
## Development
**Start Command:** `npm run dev`
**Port:** 3000

## Production  
**Start Command:** `npm start`
**Port:** 80
**Base URL:** https://myapp.com
```

## Troubleshooting

### Common Issues

1. **Server won't start**: Check that the start command is correct and dependencies are installed
2. **Tests timing out**: Increase startup timeout or check server health endpoint
3. **Element not found**: Verify CSS selectors are correct and elements exist
4. **Browser crashes**: Ensure Playwright browsers are installed (`npx playwright install`)

### Debug Mode

Enable verbose logging for debugging:

```bash
DEBUG=qa:* orcode qa --prompt "debug my form validation"
```

## Best Practices

1. **Blueprint Maintenance**: Keep blueprint.md updated with current server configuration
2. **Test Specificity**: Use specific CSS selectors and clear test descriptions  
3. **Error Handling**: Include tests for error scenarios and edge cases
4. **Performance**: Consider test execution time and optimize for CI/CD
5. **Screenshots**: Use screenshots strategically for debugging and documentation

## Contributing

The QA agent is designed to be extensible. You can:

- Add new test actions in `browser-manager.ts`
- Extend blueprint parsing in `blueprint-parser.ts`  
- Customize report formats in `test-reporter.ts`
- Add new validation heuristics in `qa-agent.ts`