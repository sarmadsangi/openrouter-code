#!/usr/bin/env node
/**
 * TypeScript/JavaScript Context-Aware Editor
 * 
 * This tool provides better context preservation for JS/TS editing
 * by using the TypeScript compiler API for AST analysis.
 */

const ts = require('typescript');
const fs = require('fs');
const path = require('path');

class TSContextEditor {
    constructor(filePath) {
        this.filePath = filePath;
        this.sourceText = fs.readFileSync(filePath, 'utf8');
        this.sourceFile = ts.createSourceFile(
            filePath,
            this.sourceText,
            ts.ScriptTarget.Latest,
            true
        );
        this.lines = this.sourceText.split('\n');
    }

    /**
     * Find the context of a specific function, method, or class
     */
    findNodeContext(nodeName, nodeType = 'any') {
        const results = [];
        
        const visit = (node) => {
            let match = false;
            let kind = '';
            
            if (ts.isFunctionDeclaration(node) && node.name?.text === nodeName) {
                match = true;
                kind = 'function';
            } else if (ts.isMethodDeclaration(node) && node.name?.text === nodeName) {
                match = true;
                kind = 'method';
            } else if (ts.isClassDeclaration(node) && node.name?.text === nodeName) {
                match = true;
                kind = 'class';
            } else if (ts.isInterfaceDeclaration(node) && node.name?.text === nodeName) {
                match = true;
                kind = 'interface';
            } else if (ts.isVariableDeclaration(node) && node.name?.text === nodeName) {
                match = true;
                kind = 'variable';
            } else if (ts.isPropertyDeclaration(node) && node.name?.text === nodeName) {
                match = true;
                kind = 'property';
            }
            
            if (match && (nodeType === 'any' || nodeType === kind)) {
                const start = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
                const end = this.sourceFile.getLineAndCharacterOfPosition(node.getEnd());
                
                results.push({
                    kind,
                    name: nodeName,
                    startLine: start.line,
                    endLine: end.line,
                    startChar: start.character,
                    endChar: end.character,
                    text: this.sourceText.substring(node.getStart(), node.getEnd())
                });
            }
            
            ts.forEachChild(node, visit);
        };
        
        visit(this.sourceFile);
        return results;
    }

    /**
     * Find unique occurrences of text within a specific context
     */
    findUniqueInContext(searchText, contextName, contextType = 'any') {
        const contexts = this.findNodeContext(contextName, contextType);
        
        if (contexts.length === 0) {
            return { error: `No ${contextType} named '${contextName}' found` };
        }
        
        if (contexts.length > 1) {
            return { 
                error: `Multiple ${contextType}s named '${contextName}' found`,
                contexts: contexts.map(c => ({ kind: c.kind, line: c.startLine + 1 }))
            };
        }
        
        const context = contexts[0];
        const contextLines = this.lines.slice(context.startLine, context.endLine + 1);
        const occurrences = [];
        
        contextLines.forEach((line, index) => {
            if (line.includes(searchText)) {
                occurrences.push({
                    line: context.startLine + index,
                    text: line.trim(),
                    absoluteLine: context.startLine + index + 1
                });
            }
        });
        
        return {
            context,
            occurrences,
            isUnique: occurrences.length === 1,
            contextText: contextLines.join('\n')
        };
    }

    /**
     * Generate context-aware edit suggestions
     */
    generateEditContext(searchText, targetContext = null) {
        let scope = this.lines;
        let scopeStart = 0;
        
        // If target context specified, narrow the scope
        if (targetContext) {
            const contexts = this.findNodeContext(targetContext);
            if (contexts.length === 1) {
                const ctx = contexts[0];
                scope = this.lines.slice(ctx.startLine, ctx.endLine + 1);
                scopeStart = ctx.startLine;
            }
        }
        
        const occurrences = [];
        scope.forEach((line, index) => {
            if (line.includes(searchText)) {
                const absoluteLine = scopeStart + index;
                const start = Math.max(0, absoluteLine - 2);
                const end = Math.min(this.lines.length, absoluteLine + 3);
                
                occurrences.push({
                    line: absoluteLine + 1,
                    context: this.lines.slice(start, end).join('\n'),
                    contextStart: start + 1,
                    contextEnd: end
                });
            }
        });
        
        return {
            searchText,
            targetContext,
            occurrences,
            isUnique: occurrences.length === 1,
            suggestions: occurrences.map((occ, i) => 
                `Occurrence ${i + 1} (line ${occ.line}):\n${occ.context}\n`
            )
        };
    }

    /**
     * Validate edit safety
     */
    validateEdit(oldText, newText, targetContext = null) {
        const analysis = this.generateEditContext(oldText, targetContext);
        
        // Check indentation preservation
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        
        let indentationIssues = [];
        if (oldLines.length > 1 && newLines.length > 1) {
            for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
                const oldIndent = oldLines[i].match(/^\s*/)[0];
                const newIndent = newLines[i].match(/^\s*/)[0];
                if (oldIndent !== newIndent && oldLines[i].trim() && newLines[i].trim()) {
                    indentationIssues.push(`Line ${i + 1}: indent mismatch`);
                }
            }
        }
        
        // Check for syntax issues (basic)
        const syntaxWarnings = [];
        if (newText.includes('function') && !newText.includes('{')) {
            syntaxWarnings.push('Function declaration might be missing opening brace');
        }
        
        return {
            isUnique: analysis.isUnique,
            occurrences: analysis.occurrences.length,
            indentationIssues,
            syntaxWarnings,
            safe: analysis.isUnique && indentationIssues.length === 0,
            suggestions: analysis.suggestions
        };
    }

    /**
     * Get AST node information at a specific line
     */
    getNodeAtLine(lineNumber) {
        const position = this.sourceFile.getPositionOfLineAndCharacter(lineNumber - 1, 0);
        
        const findNodeAtPosition = (node) => {
            if (node.getStart() <= position && position < node.getEnd()) {
                // Check children first for more specific nodes
                for (const child of node.getChildren()) {
                    const result = findNodeAtPosition(child);
                    if (result) return result;
                }
                return node;
            }
            return null;
        };
        
        const node = findNodeAtPosition(this.sourceFile);
        if (!node) return null;
        
        return {
            kind: ts.SyntaxKind[node.kind],
            text: node.getText(),
            start: this.sourceFile.getLineAndCharacterOfPosition(node.getStart()),
            end: this.sourceFile.getLineAndCharacterOfPosition(node.getEnd())
        };
    }
}

// Example usage and CLI interface
if (require.main === module) {
    const filePath = process.argv[2];
    const command = process.argv[3];
    const searchText = process.argv[4];
    const context = process.argv[5];
    
    if (!filePath || !command) {
        console.log('Usage: node ts-context-editor.js <file> <command> [args...]');
        console.log('Commands:');
        console.log('  analyze <search_text> [context] - Analyze edit safety');
        console.log('  find <node_name> [type] - Find node context');
        console.log('  validate <old_text> <new_text> [context] - Validate edit');
        process.exit(1);
    }
    
    try {
        const editor = new TSContextEditor(filePath);
        
        switch (command) {
            case 'analyze':
                const analysis = editor.generateEditContext(searchText, context);
                console.log(JSON.stringify(analysis, null, 2));
                break;
                
            case 'find':
                const nodeType = context || 'any';
                const nodes = editor.findNodeContext(searchText, nodeType);
                console.log(JSON.stringify(nodes, null, 2));
                break;
                
            case 'validate':
                const newText = context || '';
                const validation = editor.validateEdit(searchText, newText);
                console.log(JSON.stringify(validation, null, 2));
                break;
                
            default:
                console.error('Unknown command:', command);
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

module.exports = TSContextEditor;