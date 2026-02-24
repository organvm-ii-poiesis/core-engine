/**
 * Task A1: Weighted Consensus Algorithm Implementation
 * Deliverable for Omni-Dromenon-Engine Phase A
 * 
 * Implements temporal decay, proximity bonus, and outlier removal
 * for high-performance audience input aggregation.
 */

export interface Vote {
  voterId: string;
  parameter: string;
  value: number; // 0-100
  weight: number; // 0.5-1.5
  timestamp: number;
  location?: { x: number; y: number };
}

export interface ConsensusOutput {
  parameter: string;
  aggregated_value: number; // 0-100
  confidence: number; // 0-1
}

/**
 * Main consensus entry point.
 * Aggregates an array of votes into a single output.
 */
export function calculateWeightedConsensus(
  parameter: string,
  votes: Vote[],
  currentTime: number = Date.now(),
  stagePosition: { x: number; y: number } = { x: 0, y: 0 }
): ConsensusOutput {
  if (votes.length === 0) {
    return { parameter, aggregated_value: 50, confidence: 0 };
  }

  // 1. Initial filtering and weighting
  let processedVotes = votes
    .filter(v => currentTime - v.timestamp <= 10000) // Discard > 10s
    .map(v => {
      let finalWeight = v.weight;
      const age = currentTime - v.timestamp;

      // Temporal decay
      if (age > 5000) {
        finalWeight *= 0.8;
      } else {
        finalWeight *= 1.0;
      }

      // Proximity bonus
      if (v.location) {
        const dx = v.location.x - stagePosition.x;
        const dy = v.location.y - stagePosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 100) {
          finalWeight += 0.2;
        }
      }

      return { ...v, finalWeight };
    });

  if (processedVotes.length === 0) {
    return { parameter, aggregated_value: 50, confidence: 0 };
  }

  // 2. Outlier removal (Iteration 1: Calculate Mean/StdDev)
  const getStats = (items: typeof processedVotes) => {
    const n = items.length;
    if (n === 0) return { mean: 50, stdDev: 0 };
    
    const mean = items.reduce((sum, v) => sum + v.value, 0) / n;
    const variance = items.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) / n;
    return { mean, stdDev: Math.sqrt(variance) };
  };

  const initialStats = getStats(processedVotes);
  
  // Exclude votes > 2 std dev from mean
  if (processedVotes.length >= 3 && initialStats.stdDev > 0) {
    processedVotes = processedVotes.filter(v => 
      Math.abs(v.value - initialStats.mean) <= 2 * initialStats.stdDev
    );
  }

  // 3. Final Weighted Mean
  if (processedVotes.length === 0) {
    return { parameter, aggregated_value: 50, confidence: 0 };
  }

  let totalWeightedValue = 0;
  let totalWeight = 0;

  for (const v of processedVotes) {
    totalWeightedValue += v.value * v.finalWeight;
    totalWeight += v.finalWeight;
  }

  const aggregated_value = totalWeight > 0 ? totalWeightedValue / totalWeight : 50;
  
  // 4. Final Confidence calculation
  const finalStats = getStats(processedVotes);
  const confidence = Math.max(0, Math.min(1, 1 - (finalStats.stdDev / 100)));

  return {
    parameter,
    aggregated_value,
    confidence
  };
}
