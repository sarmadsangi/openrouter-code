/**
 * TypeScript Context-Aware Editing Engine
 * 
 * Production-grade context preservation system that rivals Claude Code's precision.
 * Provides AST-based understanding, intelligent disambiguation, and comprehensive
 * safety validation for JavaScript/TypeScript editing operations.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface EditContext {
  withinFunction?: string;
  withinClass?: string;
  withinInterface?: string;
  withinMethod?: string;
  withinNamespace?: string;
  atLine?: number;
  requireUnique?: boolean;
}

export interface EditResult {
  success: boolean;
  message?: string;
  error?: string;
  warnings?: string[];
  context?: string;
  linesChanged?: number;
  preview?: string;
  validation?: EditValidation;
}

export interface EditValidation {
  isUnique: boolean;
  isSafe: boolean;
  syntaxValid: boolean;
  occurrences: number;
  indentationIssues: string[];
  syntaxWarnings: string[];
  suggestions: DisambiguationSuggestion[];
}

export interface DisambiguationSuggestion {
  strategy: 'surrounding_context' | 'comment_context' | 'line_context' | 'scope_context';
  description: string;
  oldString: string;
  newString: string;
  confidence: number;
  line: number;
}

export interface NodeContext {
  kind: string;
  name: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  text: string;
  parent?: NodeContext;
  children?: NodeContext[];
  scope: 'global' | 'class' | 'function' | 'method' | 'namespace';
}

export class TSContextEngine {
  private sourceFile: ts.SourceFile;
  private sourceText: string;
  private lines: string[];
  private filePath: string;
  private program?: ts.Program;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.sourceText = fs.readFileSync(filePath, 'utf8');
    this.lines = this.sourceText.split('\n');
    
    // Create TypeScript program for enhanced analysis
    this.createTSProgram();
    
    // Create source file with full type information when possible
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.sourceText,
      this.detectScriptTarget(),
      true, // setParentNodes
      this.detectScriptKind()
    );
  }

  /**
   * Main entry point for context-aware editing
   */
  public async editWithContext(
    oldText: string, 
    newText: string, 
    context: EditContext = {}
  ): Promise<EditResult> {
    try {
      // Step 1: Validate inputs
      const inputValidation = this.validateInputs(oldText, newText);
      if (!inputValidation.valid) {
        return { 
          success: false, 
          error: inputValidation.error,
          warnings: inputValidation.warnings 
        };
      }

      // Step 2: Analyze context and find occurrences
      const analysis = await this.analyzeEditContext(oldText, context);
      
      // Step 3: Validate edit safety
      const validation = this.validateEdit(oldText, newText, analysis);
      
      if (!validation.isSafe) {
        return {
          success: false,
          error: 'Edit failed safety validation',
          validation,
          warnings: [...validation.syntaxWarnings, ...validation.indentationIssues]
        };
      }

      // Step 4: Handle ambiguous edits
      if (!validation.isUnique && context.requireUnique !== false) {
        return {
          success: false,
          error: `Found ${validation.occurrences} occurrences. Edit is ambiguous.`,
          validation,
          warnings: ['Use more specific context or accept multiple replacements']
        };
      }

      // Step 5: Apply the edit
      const result = await this.applyEdit(oldText, newText, analysis, context);
      
      return {
        ...result,
        validation
      };

    } catch (error) {
      return {
        success: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Preview changes without applying them
   */
  public async previewEdit(
    oldText: string, 
    newText: string, 
    context: EditContext = {}
  ): Promise<EditResult> {
    const analysis = await this.analyzeEditContext(oldText, context);
    const validation = this.validateEdit(oldText, newText, analysis);
    
    const preview = this.generatePreview(oldText, newText, analysis);
    
    return {
      success: true,
      message: 'Preview generated successfully',
      preview,
      validation,
      linesChanged: this.countPotentialChanges(oldText, newText, analysis)
    };
  }

  /**
   * Analyze edit context with intelligent disambiguation
   */
  private async analyzeEditContext(searchText: string, context: EditContext) {
    const analysis = {
      searchText,
      context,
      occurrences: [] as Array<{
        line: number;
        column: number;
        text: string;
        nodeContext?: NodeContext;
        surroundingContext: string;
      }>,
      targetNodes: [] as NodeContext[],
      scope: 'global' as 'global' | 'class' | 'function' | 'method' | 'namespace'
    };

    // Find target scope nodes if context specified
    if (context.withinFunction || context.withinClass || context.withinInterface || 
        context.withinMethod || context.withinNamespace) {
      analysis.targetNodes = this.findTargetNodes(context);
      analysis.scope = this.determineScopeType(context);
    }

    // Find all occurrences
    analysis.occurrences = this.findAllOccurrences(searchText, analysis.targetNodes);

    return analysis;
  }

  /**
   * Find target nodes based on context
   */
  private findTargetNodes(context: EditContext): NodeContext[] {
    const nodes: NodeContext[] = [];
    
    const visit = (node: ts.Node, parent?: NodeContext): void => {
      const nodeContext = this.createNodeContext(node, parent);
      
      if (this.matchesContext(nodeContext, context)) {
        nodes.push(nodeContext);
      }
      
      ts.forEachChild(node, child => visit(child, nodeContext));
    };

    visit(this.sourceFile);
    return nodes;
  }

  /**
   * Create detailed node context information
   */
  private createNodeContext(node: ts.Node, parent?: NodeContext): NodeContext {
    const start = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = this.sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    
    let name = '';
    let kind = ts.SyntaxKind[node.kind];
    let scope: NodeContext['scope'] = 'global';

    // Extract name based on node type
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      name = node.name?.getText() || '';
      scope = ts.isFunctionDeclaration(node) ? 'function' : 'method';
    } else if (ts.isClassDeclaration(node)) {
      name = node.name?.getText() || '';
      scope = 'class';
    } else if (ts.isInterfaceDeclaration(node)) {
      name = node.name?.getText() || '';
    } else if (ts.isModuleDeclaration(node)) {
      name = node.name?.getText() || '';
      scope = 'namespace';
    }

    return {
      kind,
      name,
      startLine: start.line,
      endLine: end.line,
      startChar: start.character,
      endChar: end.character,
      text: node.getText(),
      parent,
      scope
    };
  }

  /**
   * Check if node context matches the specified edit context
   */
  private matchesContext(nodeContext: NodeContext, editContext: EditContext): boolean {
    if (editContext.withinFunction && nodeContext.scope === 'function' && 
        nodeContext.name === editContext.withinFunction) return true;
    
    if (editContext.withinClass && nodeContext.scope === 'class' && 
        nodeContext.name === editContext.withinClass) return true;
    
    if (editContext.withinMethod && nodeContext.scope === 'method' && 
        nodeContext.name === editContext.withinMethod) return true;
    
    if (editContext.withinInterface && nodeContext.kind === 'InterfaceDeclaration' && 
        nodeContext.name === editContext.withinInterface) return true;
    
    if (editContext.withinNamespace && nodeContext.scope === 'namespace' && 
        nodeContext.name === editContext.withinNamespace) return true;

    return false;
  }

  /**
   * Find all occurrences of search text within specified nodes
   */
  private findAllOccurrences(searchText: string, targetNodes: NodeContext[]) {
    const occurrences: Array<{
      line: number;
      column: number;
      text: string;
      nodeContext?: NodeContext;
      surroundingContext: string;
    }> = [];

    // If no target nodes, search globally
    const searchLines = targetNodes.length > 0 
      ? this.getLinesInNodes(targetNodes)
      : Array.from({ length: this.lines.length }, (_, i) => i);

    for (const lineIndex of searchLines) {
      const line = this.lines[lineIndex];
      let columnIndex = 0;
      
      while ((columnIndex = line.indexOf(searchText, columnIndex)) !== -1) {
        const nodeContext = targetNodes.find(node => 
          lineIndex >= node.startLine && lineIndex <= node.endLine
        );

        occurrences.push({
          line: lineIndex,
          column: columnIndex,
          text: line,
          nodeContext,
          surroundingContext: this.getSurroundingContext(lineIndex, 3)
        });

        columnIndex += searchText.length;
      }
    }

    return occurrences;
  }

  /**
   * Comprehensive edit validation
   */
  private validateEdit(oldText: string, newText: string, analysis: any): EditValidation {
    const validation: EditValidation = {
      isUnique: analysis.occurrences.length === 1,
      isSafe: true,
      syntaxValid: true,
      occurrences: analysis.occurrences.length,
      indentationIssues: [],
      syntaxWarnings: [],
      suggestions: []
    };

    // Check indentation preservation
    validation.indentationIssues = this.validateIndentation(oldText, newText);
    
    // Check syntax validity
    const syntaxCheck = this.validateSyntax(newText, analysis);
    validation.syntaxValid = syntaxCheck.valid;
    validation.syntaxWarnings = syntaxCheck.warnings;

    // Generate disambiguation suggestions if needed
    if (!validation.isUnique) {
      validation.suggestions = this.generateDisambiguationSuggestions(
        oldText, newText, analysis.occurrences
      );
    }

    // Overall safety assessment
    validation.isSafe = validation.syntaxValid && 
                      validation.indentationIssues.length === 0 &&
                      (validation.isUnique || analysis.context.requireUnique === false);

    return validation;
  }

  /**
   * Generate intelligent disambiguation suggestions
   */
  private generateDisambiguationSuggestions(
    oldText: string, 
    newText: string, 
    occurrences: any[]
  ): DisambiguationSuggestion[] {
    const suggestions: DisambiguationSuggestion[] = [];

    occurrences.forEach((occ, index) => {
      // Strategy 1: Surrounding context
      const surroundingLines = this.getSurroundingLines(occ.line, 2);
      const surroundingContext = surroundingLines.join('\n');
      
      if (surroundingContext.includes(oldText)) {
        suggestions.push({
          strategy: 'surrounding_context',
          description: `Use surrounding context for occurrence at line ${occ.line + 1}`,
          oldString: surroundingContext,
          newString: surroundingContext.replace(oldText, newText),
          confidence: 0.9,
          line: occ.line + 1
        });
      }

      // Strategy 2: Comment context
      const lineText = this.lines[occ.line];
      if (lineText.includes('//') || this.hasNearbyComment(occ.line)) {
        const commentContext = this.getCommentContext(occ.line);
        suggestions.push({
          strategy: 'comment_context',
          description: `Use comment context for occurrence at line ${occ.line + 1}`,
          oldString: commentContext,
          newString: commentContext.replace(oldText, newText),
          confidence: 0.8,
          line: occ.line + 1
        });
      }

      // Strategy 3: Scope context
      if (occ.nodeContext) {
        suggestions.push({
          strategy: 'scope_context',
          description: `Edit within ${occ.nodeContext.scope} '${occ.nodeContext.name}'`,
          oldString: oldText,
          newString: newText,
          confidence: 0.7,
          line: occ.line + 1
        });
      }
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply the validated edit to the file
   */
  private async applyEdit(
    oldText: string, 
    newText: string, 
    analysis: any, 
    context: EditContext
  ): Promise<EditResult> {
    try {
      let newContent = this.sourceText;
      let replacements = 0;

      if (analysis.targetNodes.length > 0) {
        // Scoped replacement
        newContent = this.replaceInScope(
          newContent, 
          oldText, 
          newText, 
          analysis.targetNodes[0]
        );
        replacements = 1;
      } else {
        // Global replacement
        const regex = new RegExp(this.escapeRegExp(oldText), 'g');
        newContent = newContent.replace(regex, newText);
        replacements = (this.sourceText.match(regex) || []).length;
      }

      // Write back to file
      fs.writeFileSync(this.filePath, newContent, 'utf8');

      // Update internal state
      this.sourceText = newContent;
      this.lines = newContent.split('\n');

      return {
        success: true,
        message: `Successfully applied ${replacements} replacement(s)`,
        context: analysis.targetNodes[0]?.name || 'global',
        linesChanged: this.countActualChanges(this.sourceText, newContent)
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to apply edit: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Helper methods for enhanced functionality
   */

  private createTSProgram(): void {
    try {
      const configPath = ts.findConfigFile(
        path.dirname(this.filePath),
        ts.sys.fileExists,
        'tsconfig.json'
      );

      if (configPath) {
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        const compilerOptions = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(configPath)
        );

        this.program = ts.createProgram([this.filePath], compilerOptions.options);
      }
    } catch {
      // Fallback to basic parsing if TypeScript config fails
      this.program = undefined;
    }
  }

  private detectScriptTarget(): ts.ScriptTarget {
    if (this.filePath.endsWith('.ts') || this.filePath.endsWith('.tsx')) {
      return ts.ScriptTarget.Latest;
    }
    return ts.ScriptTarget.ES2020;
  }

  private detectScriptKind(): ts.ScriptKind {
    if (this.filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
    if (this.filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
    if (this.filePath.endsWith('.ts')) return ts.ScriptKind.TS;
    return ts.ScriptKind.JS;
  }

  private validateInputs(oldText: string, newText: string) {
    const warnings: string[] = [];
    
    if (!oldText.trim()) {
      return { valid: false, error: 'Old text cannot be empty' };
    }
    
    if (oldText === newText) {
      return { valid: false, error: 'Old and new text are identical' };
    }

    if (oldText.length > 10000) {
      warnings.push('Large text replacement - consider breaking into smaller edits');
    }

    return { valid: true, warnings };
  }

  private validateIndentation(oldText: string, newText: string): string[] {
    const issues: string[] = [];
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
      const oldIndent = oldLines[i].match(/^\s*/)?.[0] || '';
      const newIndent = newLines[i].match(/^\s*/)?.[0] || '';
      
      if (oldIndent !== newIndent && oldLines[i].trim() && newLines[i].trim()) {
        issues.push(`Line ${i + 1}: Indentation changed from "${oldIndent}" to "${newIndent}"`);
      }
    }

    return issues;
  }

  private validateSyntax(newText: string, analysis: any): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Basic syntax checks
    const braceBalance = this.checkBraceBalance(newText);
    if (!braceBalance.balanced) {
      warnings.push(`Unbalanced braces: ${braceBalance.error}`);
    }

    const parenBalance = this.checkParenBalance(newText);
    if (!parenBalance.balanced) {
      warnings.push(`Unbalanced parentheses: ${parenBalance.error}`);
    }

    // TypeScript-specific checks if available
    if (this.program) {
      try {
        const tempFile = ts.createSourceFile(
          'temp.ts',
          newText,
          ts.ScriptTarget.Latest,
          true
        );
        
        const diagnostics = this.program.getSemanticDiagnostics(tempFile);
        diagnostics.forEach(diagnostic => {
          warnings.push(`TypeScript: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
        });
      } catch {
        // Ignore TypeScript validation errors in fallback mode
      }
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }

  private generatePreview(oldText: string, newText: string, analysis: any): string {
    const lines = [...this.lines];
    
    // Apply changes to preview
    for (const occ of analysis.occurrences) {
      if (lines[occ.line].includes(oldText)) {
        lines[occ.line] = lines[occ.line].replace(oldText, newText);
      }
    }

    // Generate unified diff format
    const diff: string[] = [];
    const contextLines = 3;

    analysis.occurrences.forEach((occ: any) => {
      const start = Math.max(0, occ.line - contextLines);
      const end = Math.min(lines.length, occ.line + contextLines + 1);
      
      diff.push(`@@ -${start + 1},${end - start} +${start + 1},${end - start} @@`);
      
      for (let i = start; i < end; i++) {
        const prefix = i === occ.line ? (this.lines[i] !== lines[i] ? '+' : ' ') : ' ';
        diff.push(`${prefix}${lines[i]}`);
      }
    });

    return diff.join('\n');
  }

  private getSurroundingContext(lineIndex: number, contextLines: number): string {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(this.lines.length, lineIndex + contextLines + 1);
    return this.lines.slice(start, end).join('\n');
  }

  private getSurroundingLines(lineIndex: number, contextLines: number): string[] {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(this.lines.length, lineIndex + contextLines + 1);
    return this.lines.slice(start, end);
  }

  private hasNearbyComment(lineIndex: number): boolean {
    for (let i = Math.max(0, lineIndex - 2); i <= Math.min(this.lines.length - 1, lineIndex + 2); i++) {
      if (this.lines[i].includes('//') || this.lines[i].includes('/*')) {
        return true;
      }
    }
    return false;
  }

  private getCommentContext(lineIndex: number): string {
    let start = lineIndex;
    let end = lineIndex;

    // Expand to include nearby comments
    while (start > 0 && (this.lines[start - 1].includes('//') || this.lines[start - 1].trim() === '')) {
      start--;
    }
    
    while (end < this.lines.length - 1 && (this.lines[end + 1].includes('//') || this.lines[end + 1].trim() === '')) {
      end++;
    }

    return this.lines.slice(start, end + 1).join('\n');
  }

  private replaceInScope(content: string, oldText: string, newText: string, scope: NodeContext): string {
    const lines = content.split('\n');
    
    for (let i = scope.startLine; i <= scope.endLine && i < lines.length; i++) {
      if (lines[i].includes(oldText)) {
        lines[i] = lines[i].replace(oldText, newText);
        break; // Replace only first occurrence in scope
      }
    }
    
    return lines.join('\n');
  }

  private countActualChanges(oldContent: string, newContent: string): number {
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

  private countPotentialChanges(oldText: string, newText: string, analysis: any): number {
    return analysis.occurrences.length;
  }

  private determineScopeType(context: EditContext): 'global' | 'class' | 'function' | 'method' | 'namespace' {
    if (context.withinNamespace) return 'namespace';
    if (context.withinClass) return 'class';
    if (context.withinMethod) return 'method';
    if (context.withinFunction) return 'function';
    return 'global';
  }

  private getLinesInNodes(nodes: NodeContext[]): number[] {
    const lines = new Set<number>();
    
    nodes.forEach(node => {
      for (let i = node.startLine; i <= node.endLine; i++) {
        lines.add(i);
      }
    });
    
    return Array.from(lines).sort((a, b) => a - b);
  }

  private checkBraceBalance(text: string): { balanced: boolean; error?: string } {
    let braceCount = 0;
    
    for (const char of text) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount < 0) return { balanced: false, error: 'Closing brace without opening brace' };
    }
    
    return braceCount === 0 
      ? { balanced: true }
      : { balanced: false, error: `${braceCount} unclosed opening braces` };
  }

  private checkParenBalance(text: string): { balanced: boolean; error?: string } {
    let parenCount = 0;
    
    for (const char of text) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) return { balanced: false, error: 'Closing paren without opening paren' };
    }
    
    return parenCount === 0 
      ? { balanced: true }
      : { balanced: false, error: `${parenCount} unclosed opening parentheses` };
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}