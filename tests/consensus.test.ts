import { describe, it, expect } from 'vitest';
import { calculateWeightedConsensus, type Vote } from '../src/consensus/weighted-consensus.js';

describe('Weighted Consensus Algorithm (Task A1)', () => {
  const currentTime = 10000;
  const stage = { x: 0, y: 0 };

  it('aggregates simple votes correctly', () => {
    const votes: Vote[] = [
      { voterId: '1', parameter: 'p1', value: 10, weight: 1, timestamp: 10000 },
      { voterId: '2', parameter: 'p1', value: 20, weight: 1, timestamp: 10000 },
    ];
    const result = calculateWeightedConsensus('p1', votes, currentTime, stage);
    expect(result.aggregated_value).toBe(15);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('applies temporal decay to older votes', () => {
    // Recent vote: value 100, weight 1.0 -> effective weight 1.0
    // Older vote (7s ago): value 0, weight 1.0 -> effective weight 0.8
    // Result should be (100*1.0 + 0*0.8) / 1.8 = 55.55
    const votes: Vote[] = [
      { voterId: '1', parameter: 'p1', value: 100, weight: 1, timestamp: 10000 },
      { voterId: '2', parameter: 'p1', value: 0, weight: 1, timestamp: 3000 },
    ];
    const result = calculateWeightedConsensus('p1', votes, currentTime, stage);
    expect(result.aggregated_value).toBeCloseTo(55.55, 1);
  });

  it('applies proximity bonus to nearby voters', () => {
    // Voter 1: value 100, weight 1.0, distance 50 -> +0.2 bonus -> weight 1.2
    // Voter 2: value 0, weight 1.0, distance 150 -> no bonus -> weight 1.0
    // Result: (100*1.2 + 0*1.0) / 2.2 = 54.54
    const votes: Vote[] = [
      { voterId: '1', parameter: 'p1', value: 100, weight: 1, timestamp: 10000, location: { x: 50, y: 0 } },
      { voterId: '2', parameter: 'p1', value: 0, weight: 1, timestamp: 10000, location: { x: 150, y: 0 } },
    ];
    const result = calculateWeightedConsensus('p1', votes, currentTime, stage);
    expect(result.aggregated_value).toBeCloseTo(54.54, 1);
  });

  it('removes outliers beyond 2 standard deviations', () => {
    // Votes: 50, 52, 48, 50, 100 (outlier)
    // Mean: 60, StdDev: 20
    // 100 - 60 = 40 (which is 2 * StdDev)
    // Actually let's make it clearer
    const votes: Vote[] = [
      { voterId: '1', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '2', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '3', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '4', parameter: 'p1', value: 0, weight: 1, timestamp: 10000 }, // std dev will be small, 0 will be removed
    ];
    // mean: 37.5. std dev of [50, 50, 50, 0] is 21.65. 2*stddev = 43.3. |0 - 37.5| = 37.5 <= 43.3. So 0 stays.
    
    // Let's use [50, 50, 50, 50, 50, 0]
    // mean: 41.66. std dev: 18.63. 2*stddev = 37.26. |0 - 41.66| = 41.66 > 37.26. 0 is outlier.
    const outlierVotes: Vote[] = [
      { voterId: '1', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '2', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '3', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '4', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '5', parameter: 'p1', value: 50, weight: 1, timestamp: 10000 },
      { voterId: '6', parameter: 'p1', value: 0, weight: 1, timestamp: 10000 },
    ];
    const result = calculateWeightedConsensus('p1', outlierVotes, currentTime, stage);
    expect(result.aggregated_value).toBe(50); // 0 removed
  });

  it('discards votes older than 10 seconds', () => {
    const votes: Vote[] = [
      { voterId: '1', parameter: 'p1', value: 100, weight: 1, timestamp: 10000 },
      { voterId: '2', parameter: 'p1', value: 0, weight: 1, timestamp: -1 }, // 10.001s ago
    ];
    const result = calculateWeightedConsensus('p1', votes, currentTime, stage);
    expect(result.aggregated_value).toBe(100);
  });
});