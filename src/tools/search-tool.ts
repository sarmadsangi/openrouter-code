import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';
import { BaseTool } from './base-tool';
import { ToolResult } from '../types';

export class SearchTool extends BaseTool {
  name = 'Search';
  description = 'Search for files and content in the codebase';

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      const query = parameters.query || '';
      const searchPath = parameters.path || '.';
      const filePattern = parameters.filePattern;
      const contentSearch = parameters.contentSearch !== false; // default true
      
      const results = await this.searchRecursive(
        path.resolve(searchPath), 
        query, 
        filePattern, 
        contentSearch
      );
      
      if (results.length === 0) {
        return this.createResult(true, 'No results found');
      }
      
      const output = results.slice(0, 50) // Limit to 50 results
        .map(result => result.type === 'file' 
          ? `FILE: ${result.path}`
          : `CONTENT: ${result.path}:${result.line}: ${result.content}`
        ).join('\n');
      
      return this.createResult(true, output);
    } catch (error: any) {
      return this.createResult(false, '', `Search failed: ${error.message}`);
    }
  }

  private async searchRecursive(
    dir: string, 
    query: string, 
    filePattern?: string, 
    contentSearch: boolean = true
  ): Promise<Array<{type: 'file' | 'content', path: string, line?: number, content?: string}>> {
    const results: Array<{type: 'file' | 'content', path: string, line?: number, content?: string}> = [];
    
    try {
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        
        // Skip common directories to ignore
        if (['node_modules', '.git', 'dist', '.next', 'build'].includes(entry)) {
          continue;
        }
        
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          const subResults = await this.searchRecursive(fullPath, query, filePattern, contentSearch);
          results.push(...subResults);
        } else if (stats.isFile()) {
          // File name search
          if (filePattern && entry.includes(filePattern)) {
            results.push({ type: 'file', path: fullPath });
          }
          
          // Content search
          if (contentSearch && query && this.isTextFile(entry)) {
            try {
              const content = await readFile(fullPath, 'utf8');
              const lines = content.split('\n');
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    type: 'content',
                    path: fullPath,
                    line: index + 1,
                    content: line.trim()
                  });
                }
              });
            } catch {
              // Skip files that can't be read as text
            }
          }
        }
      }
    } catch {
      // Skip directories that can't be accessed
    }
    
    return results;
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.scss', '.html', '.xml', '.json', '.yaml', '.yml',
      '.md', '.txt', '.go', '.rs', '.php', '.rb', '.swift', '.kt',
      '.vue', '.svelte', '.sql', '.sh', '.bash', '.zsh'
    ];
    
    return textExtensions.some(ext => filename.endsWith(ext));
  }
}