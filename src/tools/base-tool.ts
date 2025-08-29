import { ToolResult } from '../types';

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;

  abstract execute(parameters: Record<string, any>): Promise<ToolResult>;

  protected createResult(success: boolean, result: string, error?: string): ToolResult {
    return { success, result, error };
  }

  protected validateParameters(parameters: Record<string, any>, required: string[]): void {
    for (const param of required) {
      if (!(param in parameters)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }
}