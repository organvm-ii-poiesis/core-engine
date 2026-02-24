/**
 * Orchestrator Scout
 * 
 * Objective: Locate managed projects, read their genomes (seed.yaml),
 * and report on their configuration state.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml'; // We'll need to add this dependency

// Interfaces matching the 4jp-metasystem.yaml structure
interface MetasystemManifest {
  components: {
    workspaces: Array<{
      name: string;
      path: string;
      genome: string;
      status: string;
    }>;
  };
}

interface ProjectGenome {
  project: {
    name: string;
    codename: string;
  };
  growth_objectives: {
    roadmap_epics: Array<{
      id: string;
      title: string;
      description: string;
      effort_units: number;
    }>;
  };
  automation_contract: {
    ai_access: {
      read_paths: string[];
      write_paths: string[];
    };
  };
}

export class OrchestratorScout {
  private manifestPath: string;
  private rootDir: string;

  constructor(manifestPath: string) {
    this.manifestPath = manifestPath;
    this.rootDir = path.dirname(manifestPath);
  }

  async loadManifest(): Promise<MetasystemManifest> {
    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      return yaml.load(content) as MetasystemManifest;
    } catch (error) {
      console.error(`Failed to load manifest at ${this.manifestPath}`, error);
      throw error;
    }
  }

  async scanWorkspace(workspaceName: string): Promise<ProjectGenome | null> {
    const manifest = await this.loadManifest();
    const workspace = manifest.components.workspaces.find(w => w.name === workspaceName);

    if (!workspace) {
      console.error(`Workspace ${workspaceName} not found in manifest.`);
      return null;
    }

    // Resolve genome path relative to the manifest location
    const genomePath = path.resolve(this.rootDir, workspace.genome);
    
    try {
      const content = await fs.readFile(genomePath, 'utf-8');
      const genome = yaml.load(content) as ProjectGenome;
      
      console.log(`✅ [Scout] Successfully scanned ${workspaceName}`);
      console.log(`   - Codename: ${genome.project.codename}`);
      console.log(`   - Roadmap Epics: ${genome.growth_objectives.roadmap_epics.length}`);
      
      return genome;
    } catch (error) {
      console.error(`❌ [Scout] Failed to read genome at ${genomePath}`, error);
      return null;
    }
  }
}

import { fileURLToPath } from 'url';

// --- CLI Execution ---
const __filename = fileURLToPath(import.meta.url);
const entryFile = process.argv[1];

if (entryFile === __filename) {
  const MANIFEST_PATH = path.resolve(process.cwd(), 'omni-dromenon-machina/4jp-metasystem.yaml');
  const scout = new OrchestratorScout(MANIFEST_PATH);
  
  // Example: Scan the primary target
  scout.scanWorkspace('life-my--midst--in').catch(console.error);
}
