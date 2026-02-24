/**
 * Orchestrator Analyst
 * 
 * Objective: Compare the *actual* state of a managed project against
 * its *expected* state defined in the genome (seed.yaml).
 */

import fs from 'fs/promises';
import path from 'path';
import { OrchestratorScout } from './scout.js';

interface AnalysisReport {
  project: string;
  status: 'healthy' | 'drifted' | 'unknown';
  missing_modules: string[];
  next_actions: string[];
  timestamp: string;
}

export class OrchestratorAnalyst {
  private scout: OrchestratorScout;

  constructor(scout: OrchestratorScout) {
    this.scout = scout;
  }

  async analyze(workspaceName: string, workspaceRoot: string): Promise<AnalysisReport> {
    const genome = await this.scout.scanWorkspace(workspaceName);
    if (!genome) {
      throw new Error(`Genome not found for ${workspaceName}`);
    }

    const report: AnalysisReport = {
      project: genome.project.name,
      status: 'healthy',
      missing_modules: [],
      next_actions: [],
      timestamp: new Date().toISOString(),
    };

    // 1. Verify Roadmap Epics (Simple check: do the modules exist?)
    // In a real implementation, we'd check if the code *actually* implements the epic.
    // For Phase D-1, we check if the defined module paths exist.
    
    // We assume the genome defines 'modules' in growth_objectives or similar.
    // Let's use the 'roadmap_epics' to infer expected paths if they are listed there.
    // Based on the seed.yaml read earlier:
    // epics have 'modules' list like ["packages/schema", "apps/web"]

    const epics = genome.growth_objectives.roadmap_epics;
    
    for (const epic of epics) {
      if (epic.modules) { // TypeScript might complain if we don't define this interface strictly, but for logic logic:
        for (const modulePath of (epic as any).modules) {
           const fullPath = path.resolve(workspaceRoot, modulePath);
           try {
             await fs.access(fullPath);
           } catch {
             report.missing_modules.push(modulePath);
             report.status = 'drifted';
           }
        }
      }
    }

    // 2. Determine Next Actions
    if (report.missing_modules.length > 0) {
      report.next_actions.push(`Scaffold missing modules: ${report.missing_modules.join(', ')}`);
    } else {
      report.next_actions.push('Run test suite verification');
      report.next_actions.push('Check for new roadmap tasks');
    }

    return report;
  }
}

import { fileURLToPath } from 'url';

// --- CLI Execution ---
const __filename = fileURLToPath(import.meta.url);
const entryFile = process.argv[1];

if (entryFile === __filename) {
  const MANIFEST_PATH = path.resolve(process.cwd(), 'omni-dromenon-machina/4jp-metasystem.yaml');
  // We need to know where the target actually lives relative to us.
  // The manifest says "../life-my--midst--in", so relative to the manifest.
  // We can parse the manifest to get the path.
  
  (async () => {
    const scout = new OrchestratorScout(MANIFEST_PATH);
    const manifest = await scout.loadManifest();
    const target = manifest.components.workspaces.find(w => w.name === 'life-my--midst--in');
    
    if (target) {
      const targetRoot = path.resolve(path.dirname(MANIFEST_PATH), target.path);
      const analyst = new OrchestratorAnalyst(scout);
      const report = await analyst.analyze('life-my--midst--in', targetRoot);
      console.log(JSON.stringify(report, null, 2));
    }
  })();
}
