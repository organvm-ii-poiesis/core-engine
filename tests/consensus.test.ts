/**
 * Consensus Algorithm Tests for Omni-Dromenon-Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateSpatialWeight,
  calculateTemporalWeight,
  calculateConsensusWeight,
  calculateWeight,
  weightInputs,
  weightedMean,
  standardDeviation,
  removeOutliers,
  smoothValue,
  analyzeCluster,
  computeConsensus,
  applyOverride,
} from '../src/consensus/weighted-voting.js';
import {
  DEFAULT_WEIGHTING_CONFIG,
  ConsensusMode,
  type AudienceInput,
  type PerformerOverride,
} from '../src/types/index.js';

// =============================================================================
// TEST UTILITIES
// =============================================================================

function createInput(
  value: number,
  timestamp?: number,
  location?: { x: number; y: number }
): AudienceInput {
  return {
    id: crypto.randomUUID(),
    clientId: 'test-client',
    sessionId: 'test-session',
    timestamp: timestamp ?? Date.now(),
    parameter: 'test',
    value,
    location,
  };
}

function createInputs(values: number[]): AudienceInput[] {
  return values.map(v => createInput(v));
}

// =============================================================================
// WEIGHT CALCULATION TESTS
// =============================================================================

describe('Weight Calculation', () => {
  const config = DEFAULT_WEIGHTING_CONFIG;
  const stagePosition = { x: 50, y: 0 };
  
  describe('calculateSpatialWeight', () => {
    it('returns 1.0 for location at stage', () => {
      const weight = calculateSpatialWeight(
        { x: 50, y: 0 },
        stagePosition,
        config
      );
      expect(weight).toBeCloseTo(1.0, 2);
    });
    
    it('returns lower weight for distant locations', () => {
      const closeWeight = calculateSpatialWeight(
        { x: 50, y: 20 },
        stagePosition,
        config
      );
      const farWeight = calculateSpatialWeight(
        { x: 50, y: 80 },
        stagePosition,
        config
      );
      expect(closeWeight).toBeGreaterThan(farWeight);
    });
    
    it('returns 0.5 for undefined location', () => {
      const weight = calculateSpatialWeight(undefined, stagePosition, config);
      expect(weight).toBe(0.5);
    });
  });
  
  describe('calculateTemporalWeight', () => {
    it('returns 1.0 for current timestamp', () => {
      const now = Date.now();
      const weight = calculateTemporalWeight(now, now, config);
      expect(weight).toBeCloseTo(1.0, 2);
    });
    
    it('returns lower weight for older inputs', () => {
      const now = Date.now();
      const recentWeight = calculateTemporalWeight(now - 1000, now, config);
      const oldWeight = calculateTemporalWeight(now - 4000, now, config);
      expect(recentWeight).toBeGreaterThan(oldWeight);
    });
    
    it('returns minimal weight for inputs outside window', () => {
      const now = Date.now();
      const weight = calculateTemporalWeight(
        now - config.temporalWindowMs - 1000,
        now,
        config
      );
      expect(weight).toBeLessThan(0.1);
    });
  });
  
  describe('calculateConsensusWeight', () => {
    it('returns 1.0 when all inputs agree', () => {
      const inputs = createInputs([0.5, 0.5, 0.5, 0.5]);
      const weight = calculateConsensusWeight(inputs[0], inputs, config);
      expect(weight).toBeCloseTo(1.0, 2);
    });
    
    it('returns 0.0 when input is outlier', () => {
      const inputs = createInputs([0.5, 0.5, 0.5, 0.9]);
      const weight = calculateConsensusWeight(inputs[3], inputs, config);
      expect(weight).toBeLessThan(0.5);
    });
    
    it('returns 1.0 for single input', () => {
      const inputs = createInputs([0.5]);
      const weight = calculateConsensusWeight(inputs[0], inputs, config);
      expect(weight).toBe(1.0);
    });
  });
});

// =============================================================================
// AGGREGATION TESTS
// =============================================================================

describe('Aggregation', () => {
  const stagePosition = { x: 50, y: 0 };
  
  describe('weightedMean', () => {
    it('returns 0.5 for empty inputs', () => {
      expect(weightedMean([])).toBe(0.5);
    });
    
    it('calculates correct weighted mean', () => {
      const inputs = weightInputs(
        createInputs([0.2, 0.4, 0.6, 0.8]),
        stagePosition
      );
      const mean = weightedMean(inputs);
      expect(mean).toBeGreaterThan(0);
      expect(mean).toBeLessThan(1);
    });
    
    it('returns correct mean for uniform weights', () => {
      const inputs = [
        { ...createInput(0.2), weight: 1, spatialWeight: 1, temporalWeight: 1, consensusWeight: 1 },
        { ...createInput(0.8), weight: 1, spatialWeight: 1, temporalWeight: 1, consensusWeight: 1 },
      ];
      expect(weightedMean(inputs)).toBeCloseTo(0.5, 2);
    });
  });
  
  describe('standardDeviation', () => {
    it('returns 0 for uniform values', () => {
      const inputs = weightInputs(
        createInputs([0.5, 0.5, 0.5]),
        stagePosition
      );
      expect(standardDeviation(inputs)).toBeCloseTo(0, 5);
    });
    
    it('returns higher std for dispersed values', () => {
      const uniform = weightInputs(createInputs([0.4, 0.5, 0.6]), stagePosition);
      const dispersed = weightInputs(createInputs([0.1, 0.5, 0.9]), stagePosition);
      expect(standardDeviation(dispersed)).toBeGreaterThan(standardDeviation(uniform));
    });
  });
  
  describe('removeOutliers', () => {
    it('removes statistical outliers', () => {
      const inputs = weightInputs(
        createInputs([0.5, 0.5, 0.5, 0.5, 0.95]),
        stagePosition
      );
      const filtered = removeOutliers(inputs);
      expect(filtered.length).toBeLessThan(inputs.length);
    });
    
    it('keeps all inputs when no outliers', () => {
      const inputs = weightInputs(
        createInputs([0.4, 0.5, 0.5, 0.6]),
        stagePosition
      );
      const filtered = removeOutliers(inputs);
      expect(filtered.length).toBe(inputs.length);
    });
  });
  
  describe('smoothValue', () => {
    it('applies exponential smoothing', () => {
      const smoothed = smoothValue(1.0, 0.0, 0.3);
      expect(smoothed).toBeCloseTo(0.3, 2);
    });
    
    it('returns previous value with factor 0', () => {
      const smoothed = smoothValue(1.0, 0.5, 0);
      expect(smoothed).toBe(0.5);
    });
    
    it('returns new value with factor 1', () => {
      const smoothed = smoothValue(1.0, 0.5, 1);
      expect(smoothed).toBe(1.0);
    });
  });
});

// =============================================================================
// CLUSTER ANALYSIS TESTS
// =============================================================================

describe('Cluster Analysis', () => {
  const stagePosition = { x: 50, y: 0 };
  
  it('identifies single cluster for uniform values', () => {
    const inputs = weightInputs(
      createInputs([0.5, 0.5, 0.5, 0.5]),
      stagePosition
    );
    const analysis = analyzeCluster(inputs);
    expect(analysis.clusters.length).toBe(1);
    expect(analysis.bimodality).toBe(false);
  });
  
  it('identifies bimodality for polarized values', () => {
    const inputs = weightInputs(
      createInputs([0.1, 0.1, 0.1, 0.9, 0.9, 0.9]),
      stagePosition
    );
    const analysis = analyzeCluster(inputs);
    expect(analysis.clusters.length).toBeGreaterThanOrEqual(2);
    expect(analysis.bimodality).toBe(true);
  });
  
  it('returns empty analysis for no inputs', () => {
    const analysis = analyzeCluster([]);
    expect(analysis.clusters.length).toBe(0);
    expect(analysis.dominantCluster).toBeNull();
  });
});

// =============================================================================
// CONSENSUS COMPUTATION TESTS
// =============================================================================

describe('Consensus Computation', () => {
  const stagePosition = { x: 50, y: 0 };
  
  it('returns default value for no inputs', () => {
    const result = computeConsensus('test', [], stagePosition);
    expect(result.value).toBe(0.5);
    expect(result.inputCount).toBe(0);
    expect(result.confidence).toBe(0);
  });
  
  it('computes weighted average consensus', () => {
    const inputs = createInputs([0.3, 0.5, 0.7]);
    const result = computeConsensus('test', inputs, stagePosition);
    expect(result.value).toBeGreaterThan(0);
    expect(result.value).toBeLessThan(1);
    expect(result.inputCount).toBe(3);
    expect(result.mode).toBe(ConsensusMode.WEIGHTED_AVERAGE);
  });
  
  it('applies smoothing to previous value', () => {
    const inputs = createInputs([1.0, 1.0, 1.0]);
    const result = computeConsensus('test', inputs, stagePosition, DEFAULT_WEIGHTING_CONFIG, 0.0);
    expect(result.value).toBeLessThan(1.0); // Smoothed
    expect(result.value).toBeGreaterThan(0.0);
  });
  
  it('calculates confidence based on agreement', () => {
    const agreeing = createInputs([0.5, 0.5, 0.5]);
    const disagreeing = createInputs([0.1, 0.5, 0.9]);
    
    const agreeingResult = computeConsensus('test', agreeing, stagePosition);
    const disagreeingResult = computeConsensus('test', disagreeing, stagePosition);
    
    expect(agreeingResult.confidence).toBeGreaterThan(disagreeingResult.confidence);
  });
});

// =============================================================================
// PERFORMER OVERRIDE TESTS
// =============================================================================

describe('Performer Override', () => {
  it('applies absolute override', () => {
    const override: PerformerOverride = {
      performerId: 'performer-1',
      parameter: 'test',
      value: 0.8,
      mode: 'absolute',
    };
    expect(applyOverride(0.5, override)).toBe(0.8);
  });
  
  it('applies blend override', () => {
    const override: PerformerOverride = {
      performerId: 'performer-1',
      parameter: 'test',
      value: 1.0,
      mode: 'blend',
      blendFactor: 0.5,
    };
    expect(applyOverride(0.0, override)).toBeCloseTo(0.5, 2);
  });
  
  it('returns consensus value when no override', () => {
    expect(applyOverride(0.7, null)).toBe(0.7);
  });
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

describe('Performance', () => {
  const stagePosition = { x: 50, y: 0 };
  
  it('computes consensus for 1000 inputs in <10ms', () => {
    const inputs: AudienceInput[] = [];
    for (let i = 0; i < 1000; i++) {
      inputs.push(createInput(
        Math.random(),
        Date.now() - Math.random() * 5000,
        { x: Math.random() * 100, y: Math.random() * 100 }
      ));
    }
    
    const start = performance.now();
    const result = computeConsensus('test', inputs, stagePosition);
    const elapsed = performance.now() - start;
    
    expect(elapsed).toBeLessThan(10);
    expect(result.inputCount).toBe(1000);
  });
});
