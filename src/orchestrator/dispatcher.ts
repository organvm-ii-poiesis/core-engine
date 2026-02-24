/**
 * Orchestrator Task Dispatcher
 * 
 * Objective: Write structured task files (AI_TASK.md) into managed workspaces
 * to trigger their internal autonomous agents (as defined in their seed.yaml).
 */

import fs from 'fs/promises';
import path from 'path';
import { OrchestratorScout } from './scout.js';

export interface DispatchRequest {
  workspaceName: string;
  taskType: string;
  title: string;
  description: string;
  priority: 'normal' | 'high' | 'critical';
}

export interface DispatchResult {
  success: boolean;
  taskId: string;
  filePath: string;
  timestamp: string;
  error?: string;
}

export class TaskDispatcher {
  private scout: OrchestratorScout;
  private manifestPath: string;

  constructor(manifestPath: string) {
    this.manifestPath = manifestPath;
    this.scout = new OrchestratorScout(manifestPath);
  }

  async dispatchTask(request: DispatchRequest): Promise<DispatchResult> {
    const timestamp = new Date().toISOString();
    const taskId = `task-${Date.now()}`;
    
    try {
      const manifest = await this.scout.loadManifest();
      const workspace = manifest.components.workspaces.find(w => w.name === request.workspaceName);

      if (!workspace) {
        throw new Error(`Workspace '${request.workspaceName}' not found in manifest.`);
      }

      const targetRoot = path.resolve(path.dirname(this.manifestPath), workspace.path);
      
      // We will write a file that the target project's "Watcher" or "CI" would pick up.
      // Based on life-my--midst--in docs, it uses GitHub Issues or 'ai-task' label.
      // Since we are file-system based here, we will drop a file in a standard location
      // that a local watcher *could* see, or that documents the intent.
      
      const taskContent = `---
id: ${taskId}
type: ${request.taskType}
title: ${request.title}
created: ${timestamp}
priority: ${request.priority}
author: Omni-Dromenon Orchestrator
---

# Task Description
${request.description}

## Context
Dispatching from Universal Orchestrator.
`;

      // Check if .orchestrator/inbox exists, create if not
      const inboxPath = path.join(targetRoot, '.orchestrator', 'inbox');
      await fs.mkdir(inboxPath, { recursive: true });

      const fileName = `TASK_${taskId}.md`;
      const filePath = path.join(inboxPath, fileName);

      await fs.writeFile(filePath, taskContent, 'utf-8');
      console.log(`⚡ [Dispatcher] Task ${taskId} dispatched to ${request.workspaceName}`);

      return {
        success: true,
        taskId,
        filePath,
        timestamp
      };

    } catch (error: any) {
      console.error(`❌ [Dispatcher] Failed to dispatch to ${request.workspaceName}:`, error);
      return {
        success: false,
        taskId,
        filePath: '',
        timestamp,
        error: error.message
      };
    }
  }
}
