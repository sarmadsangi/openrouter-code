#!/usr/bin/env python3
"""
Context-Aware Editing Helper

This module provides utilities for better context preservation when editing code.
"""

import ast
import re
from typing import List, Tuple, Optional, Dict

class ContextAwareEditor:
    """
    Enhanced editor that provides better context preservation than simple string replacement.
    """
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        with open(file_path, 'r') as f:
            self.content = f.read()
        self.lines = self.content.split('\n')
    
    def find_function_context(self, function_name: str) -> Optional[Tuple[int, int]]:
        """Find the start and end lines of a function."""
        try:
            tree = ast.parse(self.content)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == function_name:
                    return node.lineno - 1, node.end_lineno - 1
        except SyntaxError:
            # Fallback to regex if AST parsing fails
            pattern = rf'^\s*def\s+{re.escape(function_name)}\s*\('
            for i, line in enumerate(self.lines):
                if re.match(pattern, line):
                    # Find end by indentation
                    indent = len(line) - len(line.lstrip())
                    for j in range(i + 1, len(self.lines)):
                        if self.lines[j].strip() and len(self.lines[j]) - len(self.lines[j].lstrip()) <= indent:
                            return i, j - 1
                    return i, len(self.lines) - 1
        return None
    
    def find_class_context(self, class_name: str) -> Optional[Tuple[int, int]]:
        """Find the start and end lines of a class."""
        try:
            tree = ast.parse(self.content)
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef) and node.name == class_name:
                    return node.lineno - 1, node.end_lineno - 1
        except SyntaxError:
            # Fallback to regex
            pattern = rf'^\s*class\s+{re.escape(class_name)}\s*[:\(]'
            for i, line in enumerate(self.lines):
                if re.match(pattern, line):
                    indent = len(line) - len(line.lstrip())
                    for j in range(i + 1, len(self.lines)):
                        if self.lines[j].strip() and len(self.lines[j]) - len(self.lines[j].lstrip()) <= indent:
                            return i, j - 1
                    return i, len(self.lines) - 1
        return None
    
    def get_context_around_line(self, target_line: int, context_lines: int = 3) -> Tuple[int, int, str]:
        """Get context around a specific line number."""
        start = max(0, target_line - context_lines)
        end = min(len(self.lines), target_line + context_lines + 1)
        context = '\n'.join(self.lines[start:end])
        return start, end, context
    
    def find_unique_occurrence(self, search_text: str, within_function: str = None, 
                              within_class: str = None) -> Optional[Tuple[str, int]]:
        """
        Find a unique occurrence of text within a specific context.
        Returns (unique_context_string, line_number) or None if not unique/found.
        """
        search_lines = []
        
        # Determine search scope
        if within_function:
            func_range = self.find_function_context(within_function)
            if func_range:
                search_lines = list(range(func_range[0], func_range[1] + 1))
        elif within_class:
            class_range = self.find_class_context(within_class)
            if class_range:
                search_lines = list(range(class_range[0], class_range[1] + 1))
        else:
            search_lines = list(range(len(self.lines)))
        
        # Find occurrences
        occurrences = []
        for line_num in search_lines:
            if search_text in self.lines[line_num]:
                occurrences.append(line_num)
        
        if len(occurrences) == 1:
            # Unique occurrence found - return with context
            line_num = occurrences[0]
            start, end, context = self.get_context_around_line(line_num, 2)
            return context, line_num
        elif len(occurrences) > 1:
            # Multiple occurrences - need more context
            print(f"Warning: Found {len(occurrences)} occurrences of '{search_text}'")
            for occ in occurrences:
                print(f"  Line {occ + 1}: {self.lines[occ].strip()}")
            return None
        else:
            print(f"No occurrences of '{search_text}' found")
            return None
    
    def suggest_edit_context(self, search_text: str, within_function: str = None) -> List[str]:
        """
        Suggest better context for making unique edits.
        """
        suggestions = []
        
        # Find all occurrences
        occurrences = []
        for i, line in enumerate(self.lines):
            if search_text in line:
                occurrences.append(i)
        
        if len(occurrences) <= 1:
            return ["Text is already unique or not found"]
        
        # For each occurrence, suggest context
        for i, line_num in enumerate(occurrences):
            start, end, context = self.get_context_around_line(line_num, 3)
            suggestions.append(f"Occurrence {i+1} (line {line_num + 1}):\n{context}\n")
        
        return suggestions

def analyze_edit_safety(file_path: str, old_text: str, new_text: str) -> Dict[str, any]:
    """
    Analyze the safety and context preservation of a proposed edit.
    """
    editor = ContextAwareEditor(file_path)
    
    # Count occurrences
    occurrences = editor.content.count(old_text)
    
    # Check indentation consistency
    old_lines = old_text.split('\n')
    new_lines = new_text.split('\n')
    
    indentation_preserved = True
    if len(old_lines) > 1 and len(new_lines) > 1:
        old_indent = len(old_lines[0]) - len(old_lines[0].lstrip())
        new_indent = len(new_lines[0]) - len(new_lines[0].lstrip()) 
        indentation_preserved = (old_indent == new_indent)
    
    return {
        'occurrences': occurrences,
        'is_unique': occurrences == 1,
        'indentation_preserved': indentation_preserved,
        'suggestions': editor.suggest_edit_context(old_text) if occurrences > 1 else []
    }

if __name__ == "__main__":
    # Example usage
    editor = ContextAwareEditor("context_test.py")
    
    # Find function context
    auth_range = editor.find_function_context("authenticate_user")
    print(f"authenticate_user function: lines {auth_range}")
    
    # Find unique occurrence within function
    result = editor.find_unique_occurrence("return None", within_function="authenticate_user")
    if result:
        context, line_num = result
        print(f"Unique context for edit:\n{context}")