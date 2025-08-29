# Workspace Manager Usage Examples

## Quick Start

```bash
# Build the project first
npm run build

# Add your first workspace
workspace add myproject /path/to/my/existing/project

# Switch to it
workspace switch myproject

# List all configured workspaces
workspace list
```

## Common Use Cases

### 1. Adding Existing Codebases

```bash
# Add a React project
workspace add my-react-app /home/user/projects/my-react-app

# Add a Python project
workspace add data-analysis /home/user/python/data-analysis

# Add a work project
workspace add work-api /workspace/company/api-service
```

### 2. Auto-Detection

```bash
# Scan for project directories
workspace detect

# Sample output:
# 🔍 Scanning for project directories...
# 
# 📦 Detected Project Directories:
# ═════════════════════════════════
#  1. /home/user/projects/my-website
#  2. /home/user/projects/mobile-app
#  3. /workspace/backend-service
```

### 3. Managing Workspaces

```bash
# List all workspaces with current indicator
workspace list
# Output:
# 📁 Configured Workspaces:
# ═══════════════════════════
# 👉 myproject      → /path/to/my/existing/project
#    work-api       → /workspace/company/api-service
#    data-analysis  → /home/user/python/data-analysis

# Check current workspace
workspace current
# Output:
# 📍 Current workspace: myproject
# 📂 Path: /path/to/my/existing/project

# Set a default workspace
workspace default myproject

# Remove a workspace (can't remove 'default')
workspace remove old-project
```

## Integration with Development Tools

### VS Code / Cursor Integration

When you switch workspaces, you'll want to update your editor:

```bash
# Switch workspace
workspace switch my-react-app

# Open in VS Code/Cursor (after the switch)
code .
# or
cursor .
```

### Shell Integration

Add this to your `.bashrc` or `.zshrc` for better integration:

```bash
# Function to switch workspace and cd
wsw() {
  if [ -z "$1" ]; then
    workspace list
  else
    NEW_PATH=$(workspace switch "$1" 2>/dev/null | grep "Switched to workspace" | sed "s/.*: //")
    if [ $? -eq 0 ] && [ -n "$NEW_PATH" ]; then
      cd "$NEW_PATH"
      echo "📁 Now in: $(pwd)"
    fi
  fi
}

# Autocomplete for workspace names
_workspace_complete() {
  local cur prev opts
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  
  if [ "$prev" = "wsw" ]; then
    opts=$(workspace list 2>/dev/null | grep "→" | awk '{print $1}' | tr -d '👉')
    COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
  fi
}
complete -F _workspace_complete wsw
```

### Project-Specific Configuration

You can create a `.workspace` file in project roots:

```json
{
  "name": "my-awesome-project",
  "description": "Full-stack web application",
  "commands": {
    "dev": "npm run dev",
    "test": "npm test",
    "build": "npm run build"
  },
  "directories": {
    "frontend": "./client",
    "backend": "./server",
    "docs": "./documentation"
  }
}
```

## Advanced Usage

### Scripting with the Workspace Manager

```typescript
import { workspace } from './src/index.js';

// Programmatic usage
workspace.add('temp-project', '/tmp/my-project');
workspace.switch('temp-project');

const current = workspace.current();
console.log(`Working in: ${current.name} at ${current.path}`);

// Auto-detect and add multiple projects
const detected = workspace.detect();
detected.forEach((path, index) => {
  const name = path.split('/').pop() || `project-${index}`;
  workspace.add(name, path);
});
```

### Backup and Restore Configuration

```bash
# Your configuration is stored in ~/.workspace-config.json
# Backup
cp ~/.workspace-config.json ~/workspace-config-backup.json

# Restore
cp ~/workspace-config-backup.json ~/.workspace-config.json
```

## Tips and Best Practices

1. **Naming Convention**: Use descriptive names for your workspaces
   - `personal-website` instead of `website`
   - `company-api-v2` instead of `api`

2. **Directory Structure**: Organize your projects logically
   ```
   /home/user/
   ├── projects/
   │   ├── personal/
   │   └── work/
   └── experiments/
   ```

3. **Regular Cleanup**: Remove workspaces for projects you no longer work on
   ```bash
   workspace remove old-experiment
   ```

4. **Use Detection**: Let the tool find projects for you
   ```bash
   workspace detect
   ```

5. **Set Defaults**: Configure a default workspace for your most common project
   ```bash
   workspace default main-project
   ```