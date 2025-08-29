#!/usr/bin/env node

import { workspaceManager } from '../config/workspace-config';
import * as process from 'process';

interface Command {
  name: string;
  description: string;
  action: (args: string[]) => void;
}

const commands: Command[] = [
  {
    name: 'add',
    description: 'Add a new working directory: workspace add <name> <path>',
    action: (args: string[]) => {
      if (args.length < 2) {
        console.error('Usage: workspace add <name> <path>');
        process.exit(1);
      }
      
      const [name, dirPath] = args;
      try {
        workspaceManager.setWorkingDirectory(name, dirPath);
        console.log(`✅ Added working directory '${name}': ${dirPath}`);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  },
  {
    name: 'switch',
    description: 'Switch to a working directory: workspace switch <name>',
    action: (args: string[]) => {
      if (args.length < 1) {
        console.error('Usage: workspace switch <name>');
        process.exit(1);
      }
      
      const [name] = args;
      try {
        const newPath = workspaceManager.switchToWorkspace(name);
        console.log(`✅ Switched to workspace '${name}': ${newPath}`);
        console.log(`💡 Run 'cd "${newPath}"' in your shell to update your terminal`);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  },
  {
    name: 'list',
    description: 'List all configured working directories',
    action: () => {
      const workspaces = workspaceManager.listWorkspaces();
      const current = workspaceManager.getCurrentWorkspace();
      
      console.log('\n📁 Configured Workspaces:');
      console.log('═══════════════════════════');
      
      for (const [name, path] of Object.entries(workspaces)) {
        const isCurrent = name === current.name;
        const indicator = isCurrent ? '👉 ' : '   ';
        console.log(`${indicator}${name.padEnd(15)} → ${path}`);
      }
      console.log('');
    }
  },
  {
    name: 'current',
    description: 'Show current working directory',
    action: () => {
      const current = workspaceManager.getCurrentWorkspace();
      console.log(`📍 Current workspace: ${current.name}`);
      console.log(`📂 Path: ${current.path}`);
    }
  },
  {
    name: 'remove',
    description: 'Remove a working directory: workspace remove <name>',
    action: (args: string[]) => {
      if (args.length < 1) {
        console.error('Usage: workspace remove <name>');
        process.exit(1);
      }
      
      const [name] = args;
      try {
        workspaceManager.removeWorkingDirectory(name);
        console.log(`✅ Removed working directory '${name}'`);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  },
  {
    name: 'detect',
    description: 'Auto-detect potential project directories',
    action: () => {
      console.log('🔍 Scanning for project directories...');
      const suggestions = workspaceManager.detectProjectDirectories();
      
      if (suggestions.length === 0) {
        console.log('No project directories found.');
        return;
      }
      
      console.log('\n📦 Detected Project Directories:');
      console.log('═════════════════════════════════');
      suggestions.forEach((dir, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${dir}`);
      });
      
      console.log('\n💡 To add any of these, use: workspace add <name> <path>');
    }
  },
  {
    name: 'default',
    description: 'Set default workspace: workspace default <name>',
    action: (args: string[]) => {
      if (args.length < 1) {
        console.error('Usage: workspace default <name>');
        process.exit(1);
      }
      
      const [name] = args;
      try {
        workspaceManager.setDefaultWorkspace(name);
        console.log(`✅ Set '${name}' as default workspace`);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  },
  {
    name: 'help',
    description: 'Show this help message',
    action: () => {
      console.log('\n🛠️  Workspace Manager CLI');
      console.log('═══════════════════════════');
      console.log('Manage and switch between different working directories for your projects.\n');
      
      commands.forEach(cmd => {
        console.log(`${cmd.name.padEnd(10)} - ${cmd.description}`);
      });
      
      console.log('\nExamples:');
      console.log('  workspace add myproject /path/to/my/project');
      console.log('  workspace switch myproject');
      console.log('  workspace list');
      console.log('  workspace detect');
      console.log('');
    }
  }
];

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    commands.find(cmd => cmd.name === 'help')?.action([]);
    return;
  }
  
  const [commandName, ...commandArgs] = args;
  const command = commands.find(cmd => cmd.name === commandName);
  
  if (!command) {
    console.error(`❌ Unknown command: ${commandName}`);
    console.log('Run "workspace help" for available commands.');
    process.exit(1);
  }
  
  command.action(commandArgs);
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}