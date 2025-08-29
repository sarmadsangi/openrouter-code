#!/usr/bin/env node
/**
 * Enhanced TypeScript Editor with Context Preservation
 * 
 * This integrates the context analysis with actual file editing,
 * providing Claude Code-level context preservation for JS/TS.
 */

const TSContextEditor = require('./ts-context-editor');
const fs = require('fs');

class EnhancedTSEditor {
    constructor(filePath) {
        this.filePath = filePath;
        this.analyzer = new TSContextEditor(filePath);
    }

    /**
     * Smart replace that ensures uniqueness and context preservation
     */
    smartReplace(oldText, newText, options = {}) {
        const { 
            withinFunction, 
            withinClass, 
            withinInterface,
            requireUnique = true,
            preserveIndentation = true 
        } = options;

        // Determine context scope
        let contextName = withinFunction || withinClass || withinInterface;
        let contextType = withinFunction ? 'function' : 
                         withinClass ? 'class' : 
                         withinInterface ? 'interface' : 'any';

        // Analyze the replacement
        const analysis = this.analyzer.generateEditContext(oldText, contextName);
        
        if (requireUnique && !analysis.isUnique) {
            return {
                success: false,
                error: `Found ${analysis.occurrences.length} occurrences of "${oldText}"`,
                suggestions: this.generateUniqueStrategies(analysis, oldText, newText),
                analysis
            };
        }

        // Validate the edit
        const validation = this.analyzer.validateEdit(oldText, newText, contextName);
        
        if (!validation.safe) {
            return {
                success: false,
                error: 'Edit validation failed',
                issues: [
                    ...validation.indentationIssues,
                    ...validation.syntaxWarnings
                ],
                validation
            };
        }

        // Perform the replacement
        try {
            const originalContent = fs.readFileSync(this.filePath, 'utf8');
            let newContent;
            
            if (contextName) {
                // Replace within specific context
                newContent = this.replaceInContext(originalContent, oldText, newText, contextName, contextType);
            } else {
                // Global replacement (if unique)
                newContent = originalContent.replace(oldText, newText);
            }

            // Write back to file
            fs.writeFileSync(this.filePath, newContent, 'utf8');
            
            return {
                success: true,
                message: `Successfully replaced "${oldText}" with "${newText}"`,
                context: contextName || 'global',
                linesChanged: this.countChangedLines(originalContent, newContent)
            };
        } catch (error) {
            return {
                success: false,
                error: `File operation failed: ${error.message}`
            };
        }
    }

    /**
     * Replace text within a specific context (function, class, etc.)
     */
    replaceInContext(content, oldText, newText, contextName, contextType) {
        const contexts = this.analyzer.findNodeContext(contextName, contextType);
        
        if (contexts.length !== 1) {
            throw new Error(`Expected exactly one ${contextType} named ${contextName}`);
        }

        const context = contexts[0];
        const lines = content.split('\n');
        
        // Replace only within the context bounds
        for (let i = context.startLine; i <= context.endLine; i++) {
            if (lines[i].includes(oldText)) {
                lines[i] = lines[i].replace(oldText, newText);
                break; // Replace only first occurrence within context
            }
        }
        
        return lines.join('\n');
    }

    /**
     * Generate strategies to make ambiguous edits unique
     */
    generateUniqueStrategies(analysis, oldText, newText) {
        const strategies = [];
        
        analysis.occurrences.forEach((occ, index) => {
            // Strategy 1: Add surrounding context
            const lines = occ.context.split('\n');
            const targetLineIndex = lines.findIndex(line => line.includes(oldText));
            
            if (targetLineIndex >= 0) {
                const before = lines.slice(0, targetLineIndex + 1).join('\n');
                const after = lines.slice(targetLineIndex).join('\n');
                
                strategies.push({
                    occurrence: index + 1,
                    line: occ.line,
                    strategy: 'surrounding_context',
                    oldString: before,
                    newString: before.replace(oldText, newText),
                    description: `Use surrounding context (lines around ${occ.line})`
                });
                
                // Strategy 2: Use comment context if available
                const beforeLine = targetLineIndex > 0 ? lines[targetLineIndex - 1] : '';
                const afterLine = targetLineIndex < lines.length - 1 ? lines[targetLineIndex + 1] : '';
                
                if (beforeLine.includes('//') || afterLine.includes('//')) {
                    const contextWithComment = [beforeLine, lines[targetLineIndex], afterLine]
                        .filter(line => line.trim())
                        .join('\n');
                    
                    strategies.push({
                        occurrence: index + 1,
                        line: occ.line,
                        strategy: 'comment_context',
                        oldString: contextWithComment,
                        newString: contextWithComment.replace(oldText, newText),
                        description: `Use comment context near line ${occ.line}`
                    });
                }
            }
        });
        
        return strategies;
    }

    /**
     * Count how many lines were actually changed
     */
    countChangedLines(oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        let changedLines = 0;
        const maxLines = Math.max(oldLines.length, newLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i] || '';
            const newLine = newLines[i] || '';
            if (oldLine !== newLine) {
                changedLines++;
            }
        }
        
        return changedLines;
    }

    /**
     * Preview changes without applying them
     */
    previewChange(oldText, newText, options = {}) {
        const result = this.smartReplace(oldText, newText, { ...options, dryRun: true });
        
        // Add diff preview
        if (result.success) {
            const originalContent = fs.readFileSync(this.filePath, 'utf8');
            const { contextName, contextType } = options;
            
            let previewContent;
            if (contextName) {
                previewContent = this.replaceInContext(originalContent, oldText, newText, contextName, contextType);
            } else {
                previewContent = originalContent.replace(oldText, newText);
            }
            
            result.preview = {
                diff: this.generateDiff(originalContent, previewContent),
                before: oldText,
                after: newText
            };
        }
        
        return result;
    }

    /**
     * Generate a simple diff
     */
    generateDiff(oldContent, newContent) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff = [];
        
        const maxLines = Math.max(oldLines.length, newLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];
            
            if (oldLine !== newLine) {
                if (oldLine !== undefined) {
                    diff.push(`- ${oldLine}`);
                }
                if (newLine !== undefined) {
                    diff.push(`+ ${newLine}`);
                }
            }
        }
        
        return diff.join('\n');
    }
}

// CLI interface
if (require.main === module) {
    const [,, filePath, command, oldText, newText, ...contextArgs] = process.argv;
    
    if (!filePath || !command) {
        console.log('Usage: node enhanced-ts-editor.js <file> <command> <args...>');
        console.log('Commands:');
        console.log('  replace <old> <new> [--function=name] [--class=name] [--interface=name]');
        console.log('  preview <old> <new> [--function=name] [--class=name] [--interface=name]');
        console.log('  analyze <text> [--function=name] [--class=name] [--interface=name]');
        process.exit(1);
    }
    
    try {
        const editor = new EnhancedTSEditor(filePath);
        
        // Parse context options
        const options = {};
        contextArgs.forEach(arg => {
            if (arg.startsWith('--function=')) options.withinFunction = arg.split('=')[1];
            if (arg.startsWith('--class=')) options.withinClass = arg.split('=')[1];
            if (arg.startsWith('--interface=')) options.withinInterface = arg.split('=')[1];
        });
        
        let result;
        
        switch (command) {
            case 'replace':
                result = editor.smartReplace(oldText, newText, options);
                break;
                
            case 'preview':
                result = editor.previewChange(oldText, newText, options);
                break;
                
            case 'analyze':
                const analyzer = new TSContextEditor(filePath);
                const contextName = options.withinFunction || options.withinClass || options.withinInterface;
                result = analyzer.generateEditContext(oldText, contextName);
                break;
                
            default:
                console.error('Unknown command:', command);
                process.exit(1);
        }
        
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

module.exports = EnhancedTSEditor;