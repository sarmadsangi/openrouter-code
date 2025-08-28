import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { BaseTool } from './base-tool';
import { ToolResult } from '../types';

export class WriteTool extends BaseTool {
  name = 'Write';
  description = 'Write content to a file';

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      this.validateParameters(parameters, ['filePath', 'content']);
      
      const filePath = path.resolve(parameters.filePath);
      const content = parameters.content;
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await mkdir(dir, { recursive: true });
      
      await writeFile(filePath, content, 'utf8');
      return this.createResult(true, `File written successfully: ${filePath}`);
    } catch (error: any) {
      return this.createResult(false, '', `Error writing file: ${error.message}`);
    }
  }
}