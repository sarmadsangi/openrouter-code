#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from './config';
import { ConversationManager } from './conversation-manager';
import { OpenRouterClient } from './openrouter-client';
import { QAAgent } from './qa/qa-agent';

const program = new Command();

program
  .name('orcode')
  .description('OpenRouter Code Assistant - A Claude Code clone using OpenRouter')
  .version('1.0.0');

program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Override default model')
  .action(async (options) => {
    await startChatSession(options);
  });

program
  .command('models')
  .description('List available models')
  .action(async () => {
    await listModels();
  });

program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    await showConfig();
  });

program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    await setupWizard();
  });

program
  .command('configure-models')
  .description('Configure reasoning and coding models')
  .action(async () => {
    await configureModels();
  });

program
  .command('qa')
  .description('Run QA validation on web application')
  .option('-p, --prompt <prompt>', 'Custom test prompt')
  .option('-b, --blueprint <path>', 'Path to blueprint.md file')
  .option('-w, --workspace <path>', 'Workspace path (defaults to current directory)')
  .action(async (options) => {
    await runQAValidation(options);
  });

async function startChatSession(options: any) {
  try {
    const configManager = new ConfigManager();
    const conversationManager = new ConversationManager(configManager);
    
    console.log(chalk.blue('🤖 OpenRouter Code Assistant'));
    console.log(chalk.gray('Task Planning: Automatic breakdown of complex requests'));
    console.log(chalk.gray('Context Management: Optimized for 100k-200k token window'));
    console.log(chalk.gray('Type "exit" to quit, "help" for commands, "reset" to start over'));
    console.log(chalk.gray(`Current model: ${conversationManager.getCurrentModel()}`));
    console.log(chalk.gray(`Available tools: ${conversationManager.getAvailableTools().join(', ')}`));
    
    // Show initial context status
    const contextWindow = conversationManager.getContextWindow();
    console.log(chalk.gray(`Context: ${contextWindow.currentTokens}/${contextWindow.targetTokens} tokens (${contextWindow.utilizationPercentage.toFixed(1)}%)`));
    console.log();

    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.green('You:'),
          validate: (input) => input.trim().length > 0 || 'Please enter a message'
        }
      ]);

      if (input.toLowerCase() === 'exit') {
        console.log(chalk.yellow('Goodbye! 👋'));
        break;
      }

      if (input.toLowerCase() === 'help') {
        showHelp(conversationManager);
        continue;
      }

      if (input.toLowerCase() === 'reset') {
        conversationManager.reset();
        console.log(chalk.yellow('Conversation reset'));
        continue;
      }

      if (input.toLowerCase() === 'status') {
        showStatus(conversationManager);
        continue;
      }

      if (input.toLowerCase() === 'models') {
        await showCurrentModels(conversationManager);
        continue;
      }

      if (input.toLowerCase() === 'context') {
        console.log(chalk.cyan('Context Information:'));
        const contextInfo = conversationManager.getContextWindow();
        const status = contextInfo.utilizationPercentage > 80 ? '🔴' : 
                      contextInfo.utilizationPercentage > 60 ? '🟡' : '🟢';
        console.log(`${status} ${contextInfo.currentTokens.toLocaleString()}/${contextInfo.targetTokens.toLocaleString()} tokens (${contextInfo.utilizationPercentage.toFixed(1)}%)`);
        console.log();
        continue;
      }

      if (input.toLowerCase() === 'usage') {
        console.log(chalk.cyan('Usage Information:'));
        const usageReport = conversationManager.getUsageTracker().formatUsageDisplay();
        console.log(usageReport);
        console.log();
        continue;
      }

      if (input.toLowerCase().startsWith('yes') || input.toLowerCase().startsWith('approve')) {
        const result = await conversationManager.handleApproval(true);
        console.log(chalk.cyan('Assistant:'));
        console.log(result);
        console.log();
        continue;
      }

      if (input.toLowerCase().startsWith('no') || input.toLowerCase().startsWith('cancel')) {
        const result = await conversationManager.handleApproval(false);
        console.log(chalk.yellow(result));
        console.log();
        continue;
      }

      const spinner = ora('Thinking...').start();
      
      try {
        const response = await conversationManager.processUserInput(input);
        spinner.stop();
        
        console.log(chalk.cyan('Assistant:'));
        console.log(response);
        console.log();
      } catch (error: any) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
      }
    }
  } catch (error: any) {
    console.error(chalk.red('Failed to start chat session:'), error.message);
    process.exit(1);
  }
}

function showHelp(conversationManager: ConversationManager) {
  console.log(chalk.blue('\n📚 Available Commands:'));
  console.log(chalk.white('  exit      - Exit the chat'));
  console.log(chalk.white('  help      - Show this help'));
  console.log(chalk.white('  reset     - Reset conversation'));
  console.log(chalk.white('  status    - Show conversation status'));
  console.log(chalk.white('  models    - Show current model configuration'));
  console.log(chalk.white('  context   - Show context window utilization'));
  console.log(chalk.white('  usage     - Show detailed usage statistics'));
  console.log(chalk.white('  /plan     - Create a task plan for complex requests'));
  console.log(chalk.white('  /continue - Continue current task plan'));
  console.log(chalk.white('  /status   - Show task plan status'));
  console.log(chalk.white('  /context  - Detailed context analysis'));
  console.log(chalk.white('  /blueprint - Show blueprint.md status'));
  console.log(chalk.white('  /refresh-blueprint - Refresh blueprint context'));
  console.log(chalk.white('  /workspace - Show workspace status'));
  console.log(chalk.white('  yes/no    - Approve or cancel task execution'));
  console.log();
  console.log(chalk.blue('🛠  Available Tools:'));
  console.log(chalk.white(conversationManager.getToolsHelp()));
  console.log();
  console.log(chalk.blue('🎯 Task Planning:'));
  console.log(chalk.white('  The assistant can automatically break down complex requests'));
  console.log(chalk.white('  into manageable tasks and execute them step by step.'));
  console.log();
  console.log(chalk.blue('🧠 Context Management:'));
  console.log(chalk.white('  Target: 100k tokens for optimal performance'));
  console.log(chalk.white('  Maximum: 200k tokens with automatic compression'));
  console.log(chalk.white('  Smart prioritization of relevant code and content'));
  console.log();
}

function showStatus(conversationManager: ConversationManager) {
  console.log(chalk.blue('\n📊 Conversation Status:'));
  console.log(chalk.white(`  Turn count: ${conversationManager.getTurnCount()}`));
  console.log(chalk.white(`  Current model: ${conversationManager.getCurrentModel()}`));
  console.log(chalk.white(`  Available tools: ${conversationManager.getAvailableTools().join(', ')}`));
  
  // Context information
  const contextWindow = conversationManager.getContextWindow();
  const contextStatus = contextWindow.utilizationPercentage > 80 ? '🔴 High' : 
                       contextWindow.utilizationPercentage > 60 ? '🟡 Medium' : '🟢 Good';
  console.log(chalk.white(`  Context usage: ${contextWindow.currentTokens.toLocaleString()}/${contextWindow.targetTokens.toLocaleString()} tokens (${contextWindow.utilizationPercentage.toFixed(1)}%) ${contextStatus}`));
  
  const plan = conversationManager.getCurrentPlan();
  if (plan) {
    console.log(chalk.blue('\n📋 Current Task Plan:'));
    console.log(chalk.white(`  Title: ${plan.title}`));
    console.log(chalk.white(`  Status: ${plan.status}`));
    console.log(chalk.white(`  Tasks: ${plan.tasks.length}`));
    const completed = plan.tasks.filter(t => t.status === 'completed').length;
    console.log(chalk.white(`  Progress: ${completed}/${plan.tasks.length}`));
  }
  console.log();
}

async function showCurrentModels(conversationManager: ConversationManager) {
  const models = conversationManager.getCurrentModels();
  console.log(chalk.blue('\n🤖 Current Model Configuration:'));
  console.log(chalk.white(`  Reasoning Model: ${models.reasoning}`));
  console.log(chalk.white(`  Coding Model: ${models.coding}`));
  console.log(chalk.white(`  Fallback Model: ${models.fallback}`));
  console.log();
}

async function listModels() {
  const spinner = ora('Fetching available models...').start();
  
  try {
    const configManager = new ConfigManager();
    const client = new OpenRouterClient(configManager);
    const models = await client.getAvailableModels();
    
    spinner.stop();
    
    console.log(chalk.blue('📋 Available Models:'));
    models.forEach((model: any) => {
      console.log(chalk.white(`  ${model.id} - ${model.name || 'No description'}`));
    });
  } catch (error: any) {
    spinner.stop();
    console.error(chalk.red('Failed to fetch models:'), error.message);
  }
}

async function showConfig() {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    
    console.log(chalk.blue('⚙️  Current Configuration:'));
    console.log(chalk.white(`  Max Turns: ${config.maxTurns}`));
    console.log(chalk.white(`  Max Tokens: ${config.maxTokens}`));
    console.log(chalk.white(`  Temperature: ${config.temperature}`));
    console.log(chalk.white(`  Reasoning Model: ${config.models.reasoning}`));
    console.log(chalk.white(`  Coding Model: ${config.models.coding}`));
    console.log(chalk.white(`  Fallback Model: ${config.models.fallback}`));
    console.log(chalk.white(`  Allowed Tools: ${config.allowedTools.join(', ')}`));
  } catch (error: any) {
    console.error(chalk.red('Failed to load configuration:'), error.message);
  }
}

async function setupWizard() {
  console.log(chalk.blue('🔧 OpenRouter Code Assistant Setup'));
  console.log();

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your OpenRouter API Key:',
      validate: (input) => input.trim().length > 0 || 'API Key is required'
    },
    {
      type: 'input',
      name: 'reasoningModel',
      message: 'Reasoning model (default: anthropic/claude-3.5-sonnet):',
      default: 'anthropic/claude-3.5-sonnet'
    },
    {
      type: 'input',
      name: 'codingModel',
      message: 'Coding model (default: anthropic/claude-3.5-sonnet):',
      default: 'anthropic/claude-3.5-sonnet'
    },
    {
      type: 'input',
      name: 'fallbackModel',
      message: 'Fallback model (default: openai/gpt-4):',
      default: 'openai/gpt-4'
    }
  ]);

  // Write to .env file
  const envContent = `# OpenRouter Configuration
OPENROUTER_API_KEY=${answers.apiKey}
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Model Configuration
REASONING_MODEL=${answers.reasoningModel}
CODING_MODEL=${answers.codingModel}
FALLBACK_MODEL=${answers.fallbackModel}

# Assistant Configuration
MAX_TURNS=40
MAX_TOKENS=95000
TEMPERATURE=0.1
ALLOWED_TOOLS=Read,Write,Bash,Grep,Search,WebSearch
`;

  const fs = await import('fs/promises');
  await fs.writeFile('.env', envContent);
  
  console.log(chalk.green('✅ Configuration saved to .env'));
  console.log(chalk.yellow('You can now run "orcode chat" to start the assistant'));
}

async function configureModels() {
  try {
    const configManager = new ConfigManager();
    const conversationManager = new ConversationManager(configManager);
    
    console.log(chalk.blue('🤖 Model Configuration'));
    console.log();
    
    // Show current models
    const currentModels = conversationManager.getCurrentModels();
    console.log(chalk.yellow('Current Configuration:'));
    console.log(`  Reasoning: ${currentModels.reasoning}`);
    console.log(`  Coding: ${currentModels.coding}`);
    console.log(`  Fallback: ${currentModels.fallback}`);
    console.log();
    
    // Get available models
    const spinner = ora('Fetching available models...').start();
    const availableModels = await conversationManager.listAvailableModels();
    spinner.stop();
    
    if (availableModels.length === 0) {
      console.log(chalk.red('No models available. Check your API key and connection.'));
      return;
    }
    
    const modelChoices = availableModels.slice(0, 20).map((model: any) => ({
      name: `${model.id} - ${model.name || 'No description'}`,
      value: model.id
    }));
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'reasoningModel',
        message: 'Select reasoning model (for analysis, planning, architecture):',
        choices: modelChoices,
        default: currentModels.reasoning
      },
      {
        type: 'list',
        name: 'codingModel',
        message: 'Select coding model (for implementation, debugging):',
        choices: modelChoices,
        default: currentModels.coding
      },
      {
        type: 'list',
        name: 'fallbackModel',
        message: 'Select fallback model (for general queries):',
        choices: modelChoices,
        default: currentModels.fallback
      }
    ]);
    
    // Update configuration
    conversationManager.updateModels({
      reasoning: answers.reasoningModel,
      coding: answers.codingModel,
      fallback: answers.fallbackModel
    });
    
    // Update .env file
    const fs = await import('fs/promises');
    let envContent = '';
    try {
      envContent = await fs.readFile('.env', 'utf8');
    } catch {
      // File doesn't exist, create new
    }
    
    // Update or add model configuration
    const lines = envContent.split('\n');
    const updates = {
      'REASONING_MODEL': answers.reasoningModel,
      'CODING_MODEL': answers.codingModel,
      'FALLBACK_MODEL': answers.fallbackModel
    };
    
    Object.entries(updates).forEach(([key, value]) => {
      const lineIndex = lines.findIndex(line => line.startsWith(`${key}=`));
      if (lineIndex >= 0) {
        lines[lineIndex] = `${key}=${value}`;
      } else {
        lines.push(`${key}=${value}`);
      }
    });
    
    await fs.writeFile('.env', lines.join('\n'));
    
    console.log(chalk.green('✅ Model configuration updated successfully!'));
    console.log();
    console.log(chalk.yellow('New Configuration:'));
    console.log(`  Reasoning: ${answers.reasoningModel}`);
    console.log(`  Coding: ${answers.codingModel}`);
    console.log(`  Fallback: ${answers.fallbackModel}`);
    
  } catch (error: any) {
    console.error(chalk.red('Failed to configure models:'), error.message);
  }
}

async function runQAValidation(options: any) {
  try {
    const configManager = new ConfigManager();
    const workspacePath = options.workspace || process.cwd();
    
    console.log(chalk.blue('🧪 Starting QA Validation...'));
    console.log(chalk.gray(`Workspace: ${workspacePath}`));
    
    if (options.blueprint) {
      console.log(chalk.gray(`Blueprint: ${options.blueprint}`));
    }
    
    const spinner = ora('Initializing QA Agent...').start();
    
    const qaAgent = new QAAgent(workspacePath, configManager);
    await qaAgent.initialize(options.blueprint);
    
    spinner.text = 'Running QA tests...';
    
    let result;
    if (options.prompt) {
      console.log(chalk.gray(`Custom prompt: ${options.prompt}`));
      result = await qaAgent.validateWithCustomPrompt(options.prompt);
    } else {
      result = await qaAgent.validateAutomatically();
    }
    
    spinner.stop();
    
    // Display results
    console.log();
    console.log(chalk.bold('🧪 QA Validation Results'));
    console.log('='.repeat(50));
    
    if (result.success) {
      console.log(chalk.green(`✅ All tests passed! (${result.testsPassed}/${result.testsRun})`));
    } else {
      console.log(chalk.red(`❌ Some tests failed (${result.testsPassed}/${result.testsRun})`));
    }
    
    console.log();
    console.log(chalk.bold('Test Results:'));
    result.testResults.forEach((testResult, index) => {
      const status = testResult.success ? chalk.green('✅') : chalk.red('❌');
      const duration = chalk.gray(`(${testResult.duration}ms)`);
      console.log(`${index + 1}. ${status} ${testResult.testCase.name} ${duration}`);
      
      if (!testResult.success && testResult.error) {
        console.log(chalk.red(`   Error: ${testResult.error}`));
      }
    });
    
    if (result.recommendations && result.recommendations.length > 0) {
      console.log();
      console.log(chalk.yellow('💡 Recommendations:'));
      result.recommendations.forEach(rec => {
        console.log(chalk.yellow(`- ${rec}`));
      });
    }
    
    console.log();
    console.log(chalk.gray('Summary:'));
    console.log(result.summary);
    
    await qaAgent.cleanup();
    
    if (!result.success) {
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error(chalk.red('QA validation failed:'), error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

program.parse();