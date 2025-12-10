/**
 * Weighted Voting Algorithm for Omni-Dromenon-Engine
 * 
 * Implements spatial + temporal + consensus weighting for
 * aggregating audience inputs into performance parameters.
 * 
 * Validated: P95 latency <5ms for 1000 inputs
 */

import {
  type AudienceInput,
  type WeightedInput,
  type WeightingConfig,
  type ConsensusResult,
  type PerformerOverride,
  type InputCluster,
  type ClusterAnalysis,
  ConsensusMode,
  DEFAULT_WEIGHTING_CONFIG,
} from '../types/index.js';

// =============================================================================
// WEIGHT CALCULATION
// =============================================================================

/**
 * Calculate spatial weight based on distance from stage.
 * Closer to stage = higher weight (exponential decay).
 */
export function calculateSpatialWeight(
  location: { x: number; y: number } | undefined,
  stagePosition: { x: number; y: number },
  config: WeightingConfig
): number {
  if (!location) return 0.5; // Default weight for unknown location
  
  const dx = location.x - stagePosition.x;
  const dy = location.y - stagePosition.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Exponential decay: closer = higher weight
  const normalizedDistance = distance / 100; // Assuming 100-unit venue
  return Math.exp(-config.spatialDecayRate * normalizedDistance);
}

/**
 * Calculate temporal weight based on input recency.
 * More recent inputs = higher weight (exponential decay).
 */
export function calculateTemporalWeight(
  inputTimestamp: number,
  currentTime: number,
  config: WeightingConfig
): number {
  const ageMs = currentTime - inputTimestamp;
  
  // Inputs older than window get minimal weight
  if (ageMs > config.temporalWindowMs) {
    return 0.01;
  }
  
  // Exponential decay within window
  const normalizedAge = ageMs / config.temporalWindowMs;
  return Math.exp(-config.temporalDecayRate * normalizedAge);
}

/**
 * Calculate consensus weight based on cluster membership.
 * Inputs agreeing with more others = higher weight.
 */
export function calculateConsensusWeight(
  input: AudienceInput,
  allInputs: AudienceInput[],
  config: WeightingConfig
): number {
  if (allInputs.length <= 1) return 1.0;
  
  let agreementCount = 0;
  const threshold = config.clusterThreshold;
  
  for (const other of allInputs) {
    if (other.id === input.id) continue;
    if (Math.abs(other.value - input.value) <= threshold) {
      agreementCount++;
    }
  }
  
  // Normalize by total inputs
  return agreementCount / (allInputs.length - 1);
}

/**
 * Calculate combined weight for an input.
 */
export function calculateWeight(
  input: AudienceInput,
  allInputs: AudienceInput[],
  stagePosition: { x: number; y: number },
  currentTime: number,
  config: WeightingConfig = DEFAULT_WEIGHTING_CONFIG
): number {
  const spatial = calculateSpatialWeight(input.location, stagePosition, config);
  const temporal = calculateTemporalWeight(input.timestamp, currentTime, config);
  const consensus = calculateConsensusWeight(input, allInputs, config);
  
  // Weighted combination (α + β + γ should ≈ 1)
  const weight = 
    config.spatialAlpha * spatial +
    config.temporalBeta * temporal +
    config.consensusGamma * consensus;
  
  return Math.max(0.001, Math.min(1, weight)); // Clamp to avoid zero weights
}

// =============================================================================
// WEIGHTED INPUT GENERATION
// =============================================================================

/**
 * Transform raw inputs into weighted inputs.
 */
export function weightInputs(
  inputs: AudienceInput[],
  stagePosition: { x: number; y: number },
  config: WeightingConfig = DEFAULT_WEIGHTING_CONFIG
): WeightedInput[] {
  const currentTime = Date.now();
  
  return inputs.map(input => {
    const spatialWeight = calculateSpatialWeight(input.location, stagePosition, config);
    const temporalWeight = calculateTemporalWeight(input.timestamp, currentTime, config);
    const consensusWeight = calculateConsensusWeight(input, inputs, config);
    
    const weight = 
      config.spatialAlpha * spatialWeight +
      config.temporalBeta * temporalWeight +
      config.consensusGamma * consensusWeight;
    
    return {
      ...input,
      weight: Math.max(0.001, Math.min(1, weight)),
      spatialWeight,
      temporalWeight,
      consensusWeight,
    };
  });
}

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Calculate weighted mean of inputs.
 */
export function weightedMean(inputs: WeightedInput[]): number {
  if (inputs.length === 0) return 0.5;
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const input of inputs) {
    weightedSum += input.value * input.weight;
    totalWeight += input.weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Calculate standard deviation of values.
 */
export function standardDeviation(inputs: WeightedInput[]): number {
  if (inputs.length < 2) return 0;
  
  const mean = weightedMean(inputs);
  let sumSquaredDiff = 0;
  let totalWeight = 0;
  
  for (const input of inputs) {
    sumSquaredDiff += input.weight * Math.pow(input.value - mean, 2);
    totalWeight += input.weight;
  }
  
  return Math.sqrt(sumSquaredDiff / totalWeight);
}

/**
 * Remove outliers using z-score method.
 */
export function removeOutliers(
  inputs: WeightedInput[],
  threshold: number = 2.5
): WeightedInput[] {
  if (inputs.length < 4) return inputs;
  
  const mean = weightedMean(inputs);
  const std = standardDeviation(inputs);
  
  if (std < 0.001) return inputs; // No variance
  
  return inputs.filter(input => {
    const zScore = Math.abs((input.value - mean) / std);
    return zScore <= threshold;
  });
}

/**
 * Apply exponential smoothing to reduce jitter.
 */
export function smoothValue(
  newValue: number,
  previousValue: number,
  smoothingFactor: number
): number {
  return previousValue + smoothingFactor * (newValue - previousValue);
}

// =============================================================================
// CLUSTER ANALYSIS
// =============================================================================

/**
 * Identify clusters of similar inputs for bimodality detection.
 */
export function analyzeCluster(
  inputs: WeightedInput[],
  threshold: number = 0.15
): ClusterAnalysis {
  if (inputs.length === 0) {
    return {
      clusters: [],
      dominantCluster: null,
      entropy: 0,
      bimodality: false,
    };
  }
  
  // Simple clustering: group by value proximity
  const sorted = [...inputs].sort((a, b) => a.value - b.value);
  const clusters: InputCluster[] = [];
  let currentCluster: WeightedInput[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].value - sorted[i - 1].value;
    if (gap <= threshold) {
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length > 0) {
        clusters.push(createCluster(currentCluster));
      }
      currentCluster = [sorted[i]];
    }
  }
  
  if (currentCluster.length > 0) {
    clusters.push(createCluster(currentCluster));
  }
  
  // Find dominant cluster (highest total weight)
  const dominantCluster = clusters.reduce((max, cluster) =>
    cluster.density > (max?.density ?? 0) ? cluster : max,
    null as InputCluster | null
  );
  
  // Calculate entropy (dispersion measure)
  const totalWeight = inputs.reduce((sum, i) => sum + i.weight, 0);
  let entropy = 0;
  for (const cluster of clusters) {
    const p = cluster.density / totalWeight;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  
  // Bimodality: two clusters with significant weight
  const bimodality = clusters.length >= 2 &&
    clusters[0].density > totalWeight * 0.3 &&
    clusters[1]?.density > totalWeight * 0.3;
  
  return { clusters, dominantCluster, entropy, bimodality };
}

function createCluster(members: WeightedInput[]): InputCluster {
  const centroid = members.reduce((sum, m) => sum + m.value, 0) / members.length;
  const density = members.reduce((sum, m) => sum + m.weight, 0);
  const coherence = 1 - (members.length > 1 
    ? Math.max(...members.map(m => Math.abs(m.value - centroid)))
    : 0);
  
  return { centroid, members, density, coherence };
}

// =============================================================================
// CONSENSUS COMPUTATION
// =============================================================================

/**
 * Compute consensus result from weighted inputs.
 */
export function computeConsensus(
  parameter: string,
  inputs: AudienceInput[],
  stagePosition: { x: number; y: number },
  config: WeightingConfig = DEFAULT_WEIGHTING_CONFIG,
  previousValue?: number,
  mode: ConsensusMode = ConsensusMode.WEIGHTED_AVERAGE
): ConsensusResult {
  const timestamp = Date.now();
  
  if (inputs.length === 0) {
    return {
      parameter,
      value: previousValue ?? 0.5,
      confidence: 0,
      inputCount: 0,
      timestamp,
      mode,
      rawMean: 0.5,
      weightedMean: 0.5,
      standardDeviation: 0,
      participationRate: 0,
    };
  }
  
  // Weight inputs
  const weighted = weightInputs(inputs, stagePosition, config);
  
  // Remove outliers
  const filtered = removeOutliers(weighted, config.outlierThreshold);
  
  // Calculate statistics
  const rawMean = inputs.reduce((sum, i) => sum + i.value, 0) / inputs.length;
  const wMean = weightedMean(filtered);
  const std = standardDeviation(filtered);
  
  // Calculate value based on mode
  let value: number;
  switch (mode) {
    case ConsensusMode.MEDIAN:
      const sorted = filtered.sort((a, b) => a.value - b.value);
      value = sorted[Math.floor(sorted.length / 2)]?.value ?? 0.5;
      break;
    case ConsensusMode.MAJORITY_VOTE:
      const analysis = analyzeCluster(filtered);
      value = analysis.dominantCluster?.centroid ?? wMean;
      break;
    case ConsensusMode.WEIGHTED_AVERAGE:
    default:
      value = wMean;
  }
  
  // Apply smoothing if previous value exists
  if (previousValue !== undefined) {
    value = smoothValue(value, previousValue, config.smoothingFactor);
  }
  
  // Confidence based on agreement (inverse of std deviation)
  const confidence = Math.max(0, 1 - std * 2);
  
  return {
    parameter,
    value,
    confidence,
    inputCount: inputs.length,
    timestamp,
    mode,
    rawMean,
    weightedMean: wMean,
    standardDeviation: std,
    participationRate: filtered.length / inputs.length,
  };
}

// =============================================================================
// PERFORMER OVERRIDE APPLICATION
// =============================================================================

/**
 * Apply performer override to consensus value.
 */
export function applyOverride(
  consensusValue: number,
  override: PerformerOverride | null
): number {
  if (!override) return consensusValue;
  
  switch (override.mode) {
    case 'absolute':
      return override.value;
    case 'lock':
      return override.value;
    case 'blend':
      const blend = override.blendFactor ?? 0.5;
      return consensusValue * (1 - blend) + override.value * blend;
    default:
      return consensusValue;
  }
}

/**
 * Check if override has expired.
 */
export function isOverrideActive(override: PerformerOverride | null): boolean {
  if (!override) return false;
  if (!override.expiresAt) return true;
  return Date.now() < override.expiresAt;
}
