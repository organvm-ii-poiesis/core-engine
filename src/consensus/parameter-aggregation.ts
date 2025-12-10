/**
 * Parameter Aggregation for Omni-Dromenon-Engine
 * 
 * Manages multi-parameter consensus computation and
 * coordinates aggregation across all active parameters.
 */

import {
  type AudienceInput,
  type ConsensusResult,
  type ConsensusSnapshot,
  type PerformerOverride,
  type WeightingConfig,
  type AggregationState,
  type ParameterDefinition,
  ConsensusMode,
  DEFAULT_WEIGHTING_CONFIG,
} from '../types/index.js';

import {
  computeConsensus,
  applyOverride,
  isOverrideActive,
} from './weighted-voting.js';

// =============================================================================
// AGGREGATION ENGINE
// =============================================================================

export interface AggregatorConfig {
  weighting: WeightingConfig;
  mode: ConsensusMode;
  stagePosition: { x: number; y: number };
  inputWindowMs: number; // How long to keep inputs
  snapshotIntervalMs: number;
  maxHistoryLength: number;
}

export const DEFAULT_AGGREGATOR_CONFIG: AggregatorConfig = {
  weighting: DEFAULT_WEIGHTING_CONFIG,
  mode: ConsensusMode.WEIGHTED_AVERAGE,
  stagePosition: { x: 50, y: 0 },
  inputWindowMs: 10000,
  snapshotIntervalMs: 1000,
  maxHistoryLength: 100,
};

export class ParameterAggregator {
  private config: AggregatorConfig;
  private states: Map<string, AggregationState>;
  private overrides: Map<string, PerformerOverride>;
  private parameters: Map<string, ParameterDefinition>;
  private sessionId: string;
  
  constructor(
    sessionId: string,
    parameters: ParameterDefinition[],
    config: Partial<AggregatorConfig> = {}
  ) {
    this.sessionId = sessionId;
    this.config = { ...DEFAULT_AGGREGATOR_CONFIG, ...config };
    this.states = new Map();
    this.overrides = new Map();
    this.parameters = new Map(parameters.map(p => [p.id, p]));
    
    // Initialize state for each parameter
    for (const param of parameters) {
      this.states.set(param.id, {
        parameter: param.id,
        inputs: [],
        weightedInputs: [],
        currentConsensus: null,
        performerOverride: null,
        history: [],
        lastUpdated: Date.now(),
      });
    }
  }
  
  // ===========================================================================
  // INPUT HANDLING
  // ===========================================================================
  
  /**
   * Add new audience input for a parameter.
   */
  addInput(input: AudienceInput): void {
    const state = this.states.get(input.parameter);
    if (!state) return;
    
    const param = this.parameters.get(input.parameter);
    if (!param?.audienceControllable) return;
    
    state.inputs.push(input);
    state.lastUpdated = Date.now();
    
    // Prune old inputs
    this.pruneInputs(state);
  }
  
  /**
   * Add multiple inputs at once.
   */
  addInputs(inputs: AudienceInput[]): void {
    for (const input of inputs) {
      this.addInput(input);
    }
  }
  
  /**
   * Remove inputs older than the window.
   */
  private pruneInputs(state: AggregationState): void {
    const cutoff = Date.now() - this.config.inputWindowMs;
    state.inputs = state.inputs.filter(i => i.timestamp > cutoff);
  }
  
  // ===========================================================================
  // OVERRIDE HANDLING
  // ===========================================================================
  
  /**
   * Set performer override for a parameter.
   */
  setOverride(override: PerformerOverride): void {
    const param = this.parameters.get(override.parameter);
    if (!param?.performerControllable) return;
    
    this.overrides.set(override.parameter, override);
    
    const state = this.states.get(override.parameter);
    if (state) {
      state.performerOverride = override;
    }
  }
  
  /**
   * Clear override for a parameter.
   */
  clearOverride(parameter: string): void {
    this.overrides.delete(parameter);
    
    const state = this.states.get(parameter);
    if (state) {
      state.performerOverride = null;
    }
  }
  
  /**
   * Get active override for a parameter.
   */
  getOverride(parameter: string): PerformerOverride | null {
    const override = this.overrides.get(parameter);
    if (override && isOverrideActive(override)) {
      return override;
    }
    return null;
  }
  
  // ===========================================================================
  // CONSENSUS COMPUTATION
  // ===========================================================================
  
  /**
   * Compute consensus for a single parameter.
   */
  computeParameter(parameter: string): ConsensusResult | null {
    const state = this.states.get(parameter);
    if (!state) return null;
    
    // Prune old inputs first
    this.pruneInputs(state);
    
    // Get previous value for smoothing
    const previousValue = state.currentConsensus?.value;
    
    // Compute new consensus
    const consensus = computeConsensus(
      parameter,
      state.inputs,
      this.config.stagePosition,
      this.config.weighting,
      previousValue,
      this.config.mode
    );
    
    // Apply override if active
    const override = this.getOverride(parameter);
    if (override) {
      consensus.value = applyOverride(consensus.value, override);
    }
    
    // Update state
    state.currentConsensus = consensus;
    state.history.push(consensus);
    
    // Trim history
    if (state.history.length > this.config.maxHistoryLength) {
      state.history = state.history.slice(-this.config.maxHistoryLength);
    }
    
    return consensus;
  }
  
  /**
   * Compute consensus for all parameters.
   */
  computeAll(): Map<string, ConsensusResult> {
    const results = new Map<string, ConsensusResult>();
    
    for (const parameter of this.parameters.keys()) {
      const result = this.computeParameter(parameter);
      if (result) {
        results.set(parameter, result);
      }
    }
    
    return results;
  }
  
  // ===========================================================================
  // SNAPSHOT
  // ===========================================================================
  
  /**
   * Create a snapshot of current consensus state.
   */
  createSnapshot(): ConsensusSnapshot {
    const results = this.computeAll();
    
    // Count active participants
    const activeClients = new Set<string>();
    const cutoff = Date.now() - this.config.inputWindowMs;
    
    for (const state of this.states.values()) {
      for (const input of state.inputs) {
        if (input.timestamp > cutoff) {
          activeClients.add(input.clientId);
        }
      }
    }
    
    return {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      results,
      totalParticipants: activeClients.size,
      activeParticipants: activeClients.size,
    };
  }
  
  // ===========================================================================
  // GETTERS
  // ===========================================================================
  
  /**
   * Get current value for a parameter.
   */
  getValue(parameter: string): number {
    const state = this.states.get(parameter);
    if (!state?.currentConsensus) {
      const param = this.parameters.get(parameter);
      return param?.defaultValue ?? 0.5;
    }
    return state.currentConsensus.value;
  }
  
  /**
   * Get all current values as a plain object.
   */
  getAllValues(): Record<string, number> {
    const values: Record<string, number> = {};
    for (const [param, state] of this.states) {
      values[param] = state.currentConsensus?.value ?? 
        (this.parameters.get(param)?.defaultValue ?? 0.5);
    }
    return values;
  }
  
  /**
   * Get state for a parameter.
   */
  getState(parameter: string): AggregationState | undefined {
    return this.states.get(parameter);
  }
  
  /**
   * Get input count for a parameter.
   */
  getInputCount(parameter: string): number {
    return this.states.get(parameter)?.inputs.length ?? 0;
  }
  
  /**
   * Get total input count across all parameters.
   */
  getTotalInputCount(): number {
    let count = 0;
    for (const state of this.states.values()) {
      count += state.inputs.length;
    }
    return count;
  }
  
  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================
  
  /**
   * Update configuration.
   */
  updateConfig(config: Partial<AggregatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Update stage position (for spatial weighting).
   */
  setStagePosition(x: number, y: number): void {
    this.config.stagePosition = { x, y };
  }
  
  /**
   * Reset all state.
   */
  reset(): void {
    for (const state of this.states.values()) {
      state.inputs = [];
      state.weightedInputs = [];
      state.currentConsensus = null;
      state.history = [];
      state.lastUpdated = Date.now();
    }
    this.overrides.clear();
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createAggregator(
  sessionId: string,
  parameters: ParameterDefinition[],
  config?: Partial<AggregatorConfig>
): ParameterAggregator {
  return new ParameterAggregator(sessionId, parameters, config);
}
