import { ConfigManager, ConversationManager } from '../src';

async function basicExample() {
  // Initialize the configuration manager
  const configManager = new ConfigManager();
  
  // Create a conversation manager
  const conversationManager = new ConversationManager(configManager);
  
  // Process user input
  try {
    const response = await conversationManager.processUserInput(
      "Can you help me read the package.json file and explain what this project does?"
    );
    
    console.log('AI Response:', response);
    
    // Check conversation status
    console.log('Turn count:', conversationManager.getTurnCount());
    console.log('Current model:', conversationManager.getCurrentModel());
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example of configuring custom models
async function customModelExample() {
  const configManager = new ConfigManager();
  
  // Update models for specific use case
  configManager.updateModels({
    reasoning: 'anthropic/claude-3.5-sonnet',
    coding: 'anthropic/claude-3.5-sonnet',
    fallback: 'openai/gpt-4'
  });
  
  const conversationManager = new ConversationManager(configManager);
  
  const response = await conversationManager.processUserInput(
    "Help me design the architecture for a new microservices system"
  );
  
  console.log('Architecture advice:', response);
}

// Run examples
if (require.main === module) {
  console.log('Running basic example...');
  basicExample().catch(console.error);
  
  setTimeout(() => {
    console.log('\nRunning custom model example...');
    customModelExample().catch(console.error);
  }, 2000);
}