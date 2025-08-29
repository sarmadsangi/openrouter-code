import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from './base-tool';
import { ToolResult } from '../types';

const execAsync = promisify(exec);

export class GrepTool extends BaseTool {
  name = 'Grep';
  description = 'Search for patterns in files using grep';

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      this.validateParameters(parameters, ['pattern']);
      
      const pattern = parameters.pattern;
      const path = parameters.path || '.';
      const recursive = parameters.recursive !== false; // default true
      const ignoreCase = parameters.ignoreCase === true; // default false
      const lineNumbers = parameters.lineNumbers !== false; // default true
      
      let command = 'grep';
      
      if (recursive) command += ' -r';
      if (ignoreCase) command += ' -i';
      if (lineNumbers) command += ' -n';
      
      // Add common ignore patterns for cleaner output
      command += ' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist';
      command += ` "${pattern}" ${path}`;

      const { stdout, stderr } = await execAsync(command, {
        timeout: 15000 // 15 second timeout
      });
      
      if (!stdout && !stderr) {
        return this.createResult(true, 'No matches found');
      }
      
      return this.createResult(true, stdout || stderr);
    } catch (error: any) {
      // grep returns exit code 1 when no matches found, which is not an error
      if (error.code === 1) {
        return this.createResult(true, 'No matches found');
      }
      return this.createResult(false, '', `Grep failed: ${error.message}`);
    }
  }
}