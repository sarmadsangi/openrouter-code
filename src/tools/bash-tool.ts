import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from './base-tool';
import { ToolResult } from '../types';

const execAsync = promisify(exec);

export class BashTool extends BaseTool {
  name = 'Bash';
  description = 'Execute bash commands';

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      this.validateParameters(parameters, ['command']);
      
      const command = parameters.command;
      const cwd = parameters.cwd || process.cwd();
      
      // Security check - prevent dangerous commands
      if (this.isDangerousCommand(command)) {
        return this.createResult(false, '', 'Command not allowed for security reasons');
      }

      const { stdout, stderr } = await execAsync(command, { 
        cwd,
        timeout: 30000 // 30 second timeout
      });
      
      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      return this.createResult(true, output);
    } catch (error: any) {
      return this.createResult(false, '', `Command execution failed: ${error.message}`);
    }
  }

  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /dd\s+if=/, // dd commands
      /mkfs/, // filesystem formatting
      /fdisk/, // disk partitioning
      /shutdown/, // system shutdown
      /reboot/, // system reboot
      /halt/, // system halt
      /init\s+0/, // init 0
      /sudo\s+/, // sudo commands (require explicit permission)
      /su\s+/, // su commands
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
  }
}