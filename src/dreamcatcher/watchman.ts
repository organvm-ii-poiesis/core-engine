/**
 * Dreamcatcher Night Watchman
 * 
 * Objective: The autonomous event loop that monitors the system for
 * idle bandwidth and dispatches agents to perform work.
 */

import { CircuitBreaker } from './circuit.js';
import { ModelRouter } from './router.js';
import { MetasystemManager } from '../orchestrator/metasystem-manager.js';
import { SCENARIOS, Scenario } from './scenarios/index.js';

export class NightWatchman {
  private circuit: CircuitBreaker;
  private router: ModelRouter;
  private metasystem: MetasystemManager;
  private isAwake: boolean = false;

  constructor(metasystem: MetasystemManager) {
    this.metasystem = metasystem;
    this.circuit = new CircuitBreaker();
    this.router = new ModelRouter();
  }

  startWatch(): void {
    if (this.isAwake) return;
    this.isAwake = true;
    console.log('🌙 [Watchman] The Night Watch begins. Scanning for dreams...');
    
    // Start the poll loop (every 1 minute for demo, 1 hour in prod)
    setInterval(() => this.patrol(), 60000);
  }

  private async patrol() {
    if (!this.circuit.canProceed()) return;

    // 1. Process Pending Tasks (The "Doing")
    await this.processInbox();

    // 2. Check Universe Health (The "Seeing")
    const health = await this.metasystem.getUniverseHealth();
    
    // 3. Identify Drift
    const drifted = health.filter(h => h.status === 'drifted' || h.status === 'error');

    if (drifted.length > 0) {
      console.log(`🌙 [Watchman] Found ${drifted.length} drifted dreams.`);
      
      for (const project of drifted) {
        if (!this.circuit.canProceed()) break;

        await this.handleDrift(project);
        this.circuit.registerLoop();
      }
    } else {
      console.log('🌙 [Watchman] The universe is calm.');
      
      // 4. Entropy / Dream Scenarios (The "Dreaming")
      // 5% chance to trigger a scenario if calm
      if (Math.random() < 0.05) {
        const randomScenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
        await this.runScenario(randomScenario);
      }
    }
  }

  public async runScenario(scenario: Scenario) {
    console.log(`✨ [Watchman] Initiating Dream Scenario: ${scenario.name}`);
    
    const plan = await this.router.callProvider(
      'ARCHITECT',
      scenario.prompt,
      'Context: 4jp-metasystem.yaml'
    );

    await this.metasystem.dispatcher.dispatchTask({
        workspaceName: 'omni-dromenon-machina', // Scenarios often span the metasystem
        taskType: 'feature',
        title: `Dream: ${scenario.name}`,
        description: `## SCENARIO: ${scenario.name}\n${scenario.description}\n\n## PLAN\n${plan}`,
        priority: 'low'
    });
    
    this.circuit.registerLoop();
  }


  private async processInbox() {
      // Placeholder: In a real system, this reads from .orchestrator/inbox
      // For now, we assume the Dispatcher handles the handoff or we implement a simple queue
      console.log('🌙 [Watchman] Checking inbox...');
  }

  private async handleDrift(project: any) {
    console.log(`🌙 [Watchman] Dispatching Architect to fix ${project.name}...`);
    
    // Phase 1: Planning (Claude)
    const plan = await this.router.callProvider(
      'ARCHITECT',
      `Analyze drift in ${project.name}. Missing modules: ${project.missing_modules?.join(', ')}`,
      `Context: 4jp-metasystem.yaml. Project Genome: ${project.name}`
    );

    // Phase 2: Critical Review (Gemini) - "Who watches the watchmen?"
    console.log(`🌙 [Watchman] Dispatching Critic to review Architect's plan for ${project.name}...`);
    const review = await this.router.callProvider(
      'CRITIC',
      `Critically review the following plan for ${project.name}. 
      
      MANDATORY CHECKS:
      1. Does it violate any 'non_goals' defined in 'seed.yaml'?
      2. Does it respect the 'automation_contract' (e.g. disallowed_writes)?
      3. Is it aligned with the 'problem_statement'?
      
      PLAN:
      ${plan}`,
      'Context: Project Genome (seed.yaml) & Security Mandates.'
    );

    console.log(`🌙 [Watchman] Critic's Verdict: ${review.substring(0, 100)}...`);
    
    // Phase 3: Manifestation
    await this.metasystem.dispatcher.dispatchTask({
        workspaceName: project.name,
        taskType: 'ai-fix',
        title: `Auto-Fix Drift: ${project.name} (Reviewed by Critic)`,
        description: `## ARCHITECT PLAN\n${plan}\n\n## CRITIC REVIEW\n${review}`,
        priority: 'high'
    });
  }
}
