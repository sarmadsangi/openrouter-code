#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from './config';
import { ConversationManager } from './conversation-manager';
import { OpenRouterClient } from './openrouter-client';

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

async function startChatSession(options: any) {
  try {
    const configManager = new ConfigManager();
    const conversationManager = new ConversationManager(configManager);
    
    console.log(chalk.blue('🤖 OpenRouter Code Assistant'));
    console.log(chalk.gray('Type "exit" to quit, "help" for commands, "reset" to start over'));
    console.log(chalk.gray(`Current model: ${conversationManager.getCurrentModel()}`));
    console.log(chalk.gray(`Available tools: ${conversationManager.getAvailableTools().join(', ')}`));
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
  console.log(chalk.white('  exit    - Exit the chat'));
  console.log(chalk.white('  help    - Show this help'));
  console.log(chalk.white('  reset   - Reset conversation'));
  console.log(chalk.white('  status  - Show conversation status'));
  console.log();
  console.log(chalk.blue('🛠  Available Tools:'));
  console.log(chalk.white(conversationManager.getToolsHelp()));
  console.log();
}

function showStatus(conversationManager: ConversationManager) {
  console.log(chalk.blue('\n📊 Conversation Status:'));
  console.log(chalk.white(`  Turn count: ${conversationManager.getTurnCount()}`));
  console.log(chalk.white(`  Current model: ${conversationManager.getCurrentModel()}`));
  console.log(chalk.white(`  Available tools: ${conversationManager.getAvailableTools().join(', ')}`));
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

program.parse();