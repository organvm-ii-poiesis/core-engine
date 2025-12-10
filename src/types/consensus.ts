/**
 * Consensus Types for Omni-Dromenon-Engine
 * 
 * Defines weighted voting, audience input aggregation,
 * and consensus result structures.
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export enum ConsensusMode {
  WEIGHTED_AVERAGE = 'weighted_average',
  MAJORITY_VOTE = 'majority_vote',
  MEDIAN = 'median',
  PERFORMER_BLEND = 'performer_blend',
}

export enum InputSource {
  AUDIENCE = 'audience',
  PERFORMER = 'performer',
  SYSTEM = 'system',
  ENVIRONMENT = 'environment',
}

// =============================================================================
// AUDIENCE INPUT
// =============================================================================

export interface AudienceInput {
  id: string;
  clientId: string;
  sessionId: string;
  timestamp: number;
  parameter: string;
  value: number; // Normalized 0-1
  location?: {
    x: number;
    y: number;
    zone?: string;
  };
  metadata?: Record<string, unknown>;
}

export const AudienceInputSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  sessionId: z.string(),
  timestamp: z.number(),
  parameter: z.string(),
  value: z.number().min(0).max(1),
  location: z.object({
    x: z.number(),
    y: z.number(),
    zone: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// WEIGHTING CONFIGURATION
// =============================================================================

export interface WeightingConfig {
  // Spatial weighting (distance from stage)
  spatialAlpha: number;
  spatialDecayRate: number;
  
  // Temporal weighting (recency of input)
  temporalBeta: number;
  temporalWindowMs: number;
  temporalDecayRate: number;
  
  // Consensus clustering
  consensusGamma: number;
  clusterThreshold: number;
  
  // Smoothing
  smoothingFactor: number;
  outlierThreshold: number;
}

export const DEFAULT_WEIGHTING_CONFIG: WeightingConfig = {
  spatialAlpha: 0.3,
  spatialDecayRate: 0.5,
  temporalBeta: 0.5,
  temporalWindowMs: 5000,
  temporalDecayRate: 0.5,
  consensusGamma: 0.2,
  clusterThreshold: 0.1,
  smoothingFactor: 0.3,
  outlierThreshold: 2.5, // Standard deviations
};

// Genre-specific presets
export const GENRE_PRESETS: Record<string, Partial<WeightingConfig>> = {
  electronic_music: {
    spatialAlpha: 0.3,
    temporalBeta: 0.5,
    consensusGamma: 0.2,
  },
  ballet: {
    spatialAlpha: 0.5,
    temporalBeta: 0.2,
    consensusGamma: 0.3,
  },
  opera: {
    spatialAlpha: 0.2,
    temporalBeta: 0.3,
    consensusGamma: 0.5,
  },
  installation: {
    spatialAlpha: 0.7,
    temporalBeta: 0.1,
    consensusGamma: 0.2,
  },
  theatre: {
    spatialAlpha: 0.4,
    temporalBeta: 0.3,
    consensusGamma: 0.3,
  },
};

// =============================================================================
// WEIGHTED INPUT
// =============================================================================

export interface WeightedInput extends AudienceInput {
  weight: number;
  spatialWeight: number;
  temporalWeight: number;
  consensusWeight: number;
}

// =============================================================================
// CONSENSUS RESULT
// =============================================================================

export interface ConsensusResult {
  parameter: string;
  value: number;
  confidence: number; // 0-1, based on input agreement
  inputCount: number;
  timestamp: number;
  mode: ConsensusMode;
  
  // Analytics
  rawMean: number;
  weightedMean: number;
  standardDeviation: number;
  participationRate: number;
}

export interface ConsensusSnapshot {
  sessionId: string;
  timestamp: number;
  results: Map<string, ConsensusResult>;
  totalParticipants: number;
  activeParticipants: number;
}

// =============================================================================
// PERFORMER OVERRIDE
// =============================================================================

export interface PerformerOverride {
  performerId: string;
  parameter: string;
  value: number;
  mode: 'absolute' | 'blend' | 'lock';
  blendFactor?: number; // 0-1, how much performer input vs audience
  expiresAt?: number;
  reason?: string;
}

export const PerformerOverrideSchema = z.object({
  performerId: z.string(),
  parameter: z.string(),
  value: z.number().min(0).max(1),
  mode: z.enum(['absolute', 'blend', 'lock']),
  blendFactor: z.number().min(0).max(1).optional(),
  expiresAt: z.number().optional(),
  reason: z.string().optional(),
});

// =============================================================================
// AGGREGATION STATE
// =============================================================================

export interface AggregationState {
  parameter: string;
  inputs: AudienceInput[];
  weightedInputs: WeightedInput[];
  currentConsensus: ConsensusResult | null;
  performerOverride: PerformerOverride | null;
  history: ConsensusResult[];
  lastUpdated: number;
}

// =============================================================================
// CLUSTER ANALYSIS
// =============================================================================

export interface InputCluster {
  centroid: number;
  members: WeightedInput[];
  density: number;
  coherence: number;
}

export interface ClusterAnalysis {
  clusters: InputCluster[];
  dominantCluster: InputCluster | null;
  entropy: number; // Measure of input dispersion
  bimodality: boolean;
}
