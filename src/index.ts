// Main export file for the workspace manager
export { WorkspaceManager, workspaceManager, type WorkspaceConfig } from './config/workspace-config';
import { workspaceManager } from './config/workspace-config';

// Helper functions for quick operations
export const workspace = {
  /**
   * Quick switch to a workspace
   */
  switch: (name: string) => workspaceManager.switchToWorkspace(name),
  
  /**
   * Quick add workspace
   */
  add: (name: string, path: string) => workspaceManager.setWorkingDirectory(name, path),
  
  /**
   * Get current workspace info
   */
  current: () => workspaceManager.getCurrentWorkspace(),
  
  /**
   * List all workspaces
   */
  list: () => workspaceManager.listWorkspaces(),
  
  /**
   * Remove workspace
   */
  remove: (name: string) => workspaceManager.removeWorkingDirectory(name),
  
  /**
   * Detect project directories
   */
  detect: () => workspaceManager.detectProjectDirectories()
};