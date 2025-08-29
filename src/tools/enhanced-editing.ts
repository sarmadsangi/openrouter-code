/**
 * Enhanced Editing Integration
 * 
 * Seamless integration layer that enhances Cursor's existing editing tools
 * with TypeScript context-awareness. Provides drop-in replacements for
 * search_replace and MultiEdit with Claude Code-level precision.
 */

import { TSContextEngine, EditContext, EditResult } from './ts-context-engine';
import * as fs from 'fs';
import * as path from 'path';

export interface EnhancedEditOptions {
  /** Original search_replace parameters */
  oldString: string;
  newString: string;
  
  /** Enhanced context options */
  withinFunction?: string;
  withinClass?: string;
  withinInterface?: string;
  withinMethod?: string;
  withinNamespace?: string;
  
  /** Safety and validation options */
  requireUnique?: boolean;
  preserveIndentation?: boolean;
  validateSyntax?: boolean;
  dryRun?: boolean;
  
  /** Advanced options */
  maxOccurrences?: number;
  confidenceThreshold?: number;
}

export interface MultiEditOperation {
  oldString: string;
  newString: string;
  context?: Partial<EditContext>;
}

export interface EnhancedEditResult {
  success: boolean;
  message?: string;
  error?: string;
  warnings?: string[];
  editsApplied: number;
  linesChanged: number;
  preview?: string;
  suggestions?: any[];
  validation?: any;
}

export class EnhancedEditor {
  private contextEngine: TSContextEngine;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    
    // Only create context engine for JS/TS files
    if (this.isJavaScriptOrTypeScript(filePath)) {
      this.contextEngine = new TSContextEngine(filePath);
    } else {
      throw new Error(`Enhanced editing only supports JavaScript/TypeScript files. Got: ${path.extname(filePath)}`);
    }
  }

  /**
   * Enhanced search_replace with context awareness
   * Drop-in replacement for Cursor's search_replace tool
   */
  async enhancedSearchReplace(options: EnhancedEditOptions): Promise<EnhancedEditResult> {
    const context: EditContext = {
      withinFunction: options.withinFunction,
      withinClass: options.withinClass,
      withinInterface: options.withinInterface,
      withinMethod: options.withinMethod,
      withinNamespace: options.withinNamespace,
      requireUnique: options.requireUnique ?? true
    };

    if (options.dryRun) {
      const preview = await this.contextEngine.previewEdit(
        options.oldString,
        options.newString,
        context
      );
      
      return this.formatResult(preview, 0);
    }

    const result = await this.contextEngine.editWithContext(
      options.oldString,
      options.newString,
      context
    );

    return this.formatResult(result, result.success ? 1 : 0);
  }

  /**
   * Enhanced MultiEdit with context awareness for each operation
   */
  async enhancedMultiEdit(operations: MultiEditOperation[]): Promise<EnhancedEditResult> {
    const results: EditResult[] = [];
    let totalEditsApplied = 0;
    let totalLinesChanged = 0;
    const allWarnings: string[] = [];
    const allSuggestions: any[] = [];

    // Validate all operations first
    for (const [index, op] of operations.entries()) {
      const context: EditContext = {
        ...op.context,
        requireUnique: op.context?.requireUnique ?? true
      };

      const preview = await this.contextEngine.previewEdit(
        op.oldString,
        op.newString,
        context
      );

      if (!preview.success) {
        return {
          success: false,
          error: `Operation ${index + 1} failed validation: ${preview.error}`,
          editsApplied: 0,
          linesChanged: 0,
          warnings: preview.warnings
        };
      }

      if (preview.validation?.suggestions) {
        allSuggestions.push(...preview.validation.suggestions);
      }
    }

    // Apply all operations atomically
    try {
      // Create backup
      const backupContent = fs.readFileSync(this.filePath, 'utf8');
      
      for (const [index, op] of operations.entries()) {
        const context: EditContext = {
          ...op.context,
          requireUnique: op.context?.requireUnique ?? true
        };

        const result = await this.contextEngine.editWithContext(
          op.oldString,
          op.newString,
          context
        );

        results.push(result);

        if (result.success) {
          totalEditsApplied++;
          totalLinesChanged += result.linesChanged || 0;
        } else {
          // Rollback on failure
          fs.writeFileSync(this.filePath, backupContent, 'utf8');
          return {
            success: false,
            error: `Operation ${index + 1} failed: ${result.error}. All changes rolled back.`,
            editsApplied: 0,
            linesChanged: 0,
            warnings: result.warnings
          };
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings);
        }
      }

      return {
        success: true,
        message: `Successfully applied ${totalEditsApplied} edit operations`,
        editsApplied: totalEditsApplied,
        linesChanged: totalLinesChanged,
        warnings: allWarnings,
        suggestions: allSuggestions
      };

    } catch (error) {
      return {
        success: false,
        error: `MultiEdit failed: ${error instanceof Error ? error.message : String(error)}`,
        editsApplied: 0,
        linesChanged: 0
      };
    }
  }

  /**
   * Smart context detection - automatically determine the best context for an edit
   */
  async smartEdit(oldString: string, newString: string): Promise<EnhancedEditResult> {
    // First, try without context
    const globalPreview = await this.contextEngine.previewEdit(oldString, newString, {});
    
    if (globalPreview.validation?.isUnique && globalPreview.validation?.isSafe) {
      // Simple case - unique and safe globally
      return this.enhancedSearchReplace({ oldString, newString, requireUnique: true });
    }

    // If ambiguous, try to auto-detect best context
    const suggestions = globalPreview.validation?.suggestions || [];
    
    if (suggestions.length > 0) {
      // Use the highest confidence suggestion
      const bestSuggestion = suggestions.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      if (bestSuggestion.strategy === 'surrounding_context') {
        return this.enhancedSearchReplace({
          oldString: bestSuggestion.oldString,
          newString: bestSuggestion.newString,
          requireUnique: true
        });
      }
    }

    // Return the ambiguous result with suggestions
    return this.formatResult(globalPreview, 0);
  }

  /**
   * Validate edit before applying - useful for preview/confirmation workflows
   */
  async validateEdit(oldString: string, newString: string, context?: Partial<EditContext>) {
    const editContext: EditContext = {
      requireUnique: true,
      ...context
    };

    return this.contextEngine.previewEdit(oldString, newString, editContext);
  }

  /**
   * Generate context suggestions for ambiguous edits
   */
  async generateEditStrategies(oldString: string, newString: string) {
    const preview = await this.contextEngine.previewEdit(oldString, newString, {});
    
    if (preview.validation?.isUnique) {
      return {
        isUnique: true,
        strategies: [{
          type: 'direct',
          description: 'Direct replacement (already unique)',
          oldString,
          newString,
          confidence: 1.0
        }]
      };
    }

    return {
      isUnique: false,
      occurrences: preview.validation?.occurrences || 0,
      strategies: preview.validation?.suggestions || []
    };
  }

  /**
   * Advanced: Context-aware refactoring operations
   */
  async refactorFunction(functionName: string, operations: MultiEditOperation[]): Promise<EnhancedEditResult> {
    // Add function context to all operations
    const contextualOperations = operations.map(op => ({
      ...op,
      context: {
        ...op.context,
        withinFunction: functionName
      }
    }));

    return this.enhancedMultiEdit(contextualOperations);
  }

  async refactorClass(className: string, operations: MultiEditOperation[]): Promise<EnhancedEditResult> {
    // Add class context to all operations
    const contextualOperations = operations.map(op => ({
      ...op,
      context: {
        ...op.context,
        withinClass: className
      }
    }));

    return this.enhancedMultiEdit(contextualOperations);
  }

  /**
   * Helper methods
   */

  private formatResult(engineResult: EditResult, editsApplied: number): EnhancedEditResult {
    return {
      success: engineResult.success,
      message: engineResult.message,
      error: engineResult.error,
      warnings: engineResult.warnings,
      editsApplied,
      linesChanged: engineResult.linesChanged || 0,
      preview: engineResult.preview,
      suggestions: engineResult.validation?.suggestions,
      validation: engineResult.validation
    };
  }

  private isJavaScriptOrTypeScript(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext);
  }
}

/**
 * Convenience functions that integrate with existing Cursor workflow
 */

export async function enhancedSearchReplace(
  filePath: string,
  oldString: string,
  newString: string,
  options: Partial<EnhancedEditOptions> = {}
): Promise<EnhancedEditResult> {
  const editor = new EnhancedEditor(filePath);
  return editor.enhancedSearchReplace({
    oldString,
    newString,
    ...options
  });
}

export async function enhancedMultiEdit(
  filePath: string,
  operations: MultiEditOperation[]
): Promise<EnhancedEditResult> {
  const editor = new EnhancedEditor(filePath);
  return editor.enhancedMultiEdit(operations);
}

export async function smartEdit(
  filePath: string,
  oldString: string,
  newString: string
): Promise<EnhancedEditResult> {
  const editor = new EnhancedEditor(filePath);
  return editor.smartEdit(oldString, newString);
}

export async function validateEditSafety(
  filePath: string,
  oldString: string,
  newString: string,
  context?: Partial<EditContext>
): Promise<EditResult> {
  const editor = new EnhancedEditor(filePath);
  return editor.validateEdit(oldString, newString, context);
}

/**
 * Legacy compatibility layer - drop-in replacements for existing tools
 */

export interface LegacySearchReplaceParams {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface LegacyMultiEditParams {
  file_path: string;
  edits: Array<{
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }>;
}

/**
 * Enhanced search_replace that falls back to basic replacement for non-JS/TS files
 */
export async function contextAwareSearchReplace(params: LegacySearchReplaceParams): Promise<EnhancedEditResult> {
  if (!fs.existsSync(params.file_path)) {
    return {
      success: false,
      error: `File not found: ${params.file_path}`,
      editsApplied: 0,
      linesChanged: 0
    };
  }

  // Check if it's a JS/TS file
  const editor = new EnhancedEditor(params.file_path);
  
  try {
    if (editor['isJavaScriptOrTypeScript'](params.file_path)) {
      // Use enhanced editing for JS/TS
      return editor.enhancedSearchReplace({
        oldString: params.old_string,
        newString: params.new_string,
        requireUnique: !params.replace_all
      });
    } else {
      // Fall back to basic replacement for other files
      return basicSearchReplace(params);
    }
  } catch (error) {
    // Fallback on any error
    return basicSearchReplace(params);
  }
}

/**
 * Basic search replace fallback for non-JS/TS files
 */
function basicSearchReplace(params: LegacySearchReplaceParams): EnhancedEditResult {
  try {
    const content = fs.readFileSync(params.file_path, 'utf8');
    const occurrences = (content.match(new RegExp(escapeRegExp(params.old_string), 'g')) || []).length;
    
    if (occurrences === 0) {
      return {
        success: false,
        error: `Text "${params.old_string}" not found in file`,
        editsApplied: 0,
        linesChanged: 0
      };
    }

    if (occurrences > 1 && !params.replace_all) {
      return {
        success: false,
        error: `Found ${occurrences} occurrences. Use replace_all=true to replace all instances.`,
        editsApplied: 0,
        linesChanged: 0
      };
    }

    const newContent = params.replace_all
      ? content.replace(new RegExp(escapeRegExp(params.old_string), 'g'), params.new_string)
      : content.replace(params.old_string, params.new_string);

    fs.writeFileSync(params.file_path, newContent, 'utf8');

    const linesChanged = countChangedLines(content, newContent);

    return {
      success: true,
      message: `Successfully replaced ${occurrences} occurrence(s)`,
      editsApplied: occurrences,
      linesChanged
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
      editsApplied: 0,
      linesChanged: 0
    };
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countChangedLines(oldContent: string, newContent: string): number {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  let changes = 0;
  const maxLines = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    if ((oldLines[i] || '') !== (newLines[i] || '')) {
      changes++;
    }
  }
  
  return changes;
}