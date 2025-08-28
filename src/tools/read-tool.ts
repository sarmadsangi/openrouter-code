import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { BaseTool } from './base-tool';
import { ToolResult } from '../types';

export class ReadTool extends BaseTool {
  name = 'Read';
  description = 'Read the contents of a file';

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      this.validateParameters(parameters, ['filePath']);
      
      const filePath = path.resolve(parameters.filePath);
      
      if (!existsSync(filePath)) {
        return this.createResult(false, '', `File not found: ${filePath}`);
      }

      const content = await readFile(filePath, 'utf8');
      return this.createResult(true, content);
    } catch (error: any) {
      return this.createResult(false, '', `Error reading file: ${error.message}`);
    }
  }
}