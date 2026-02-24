/**
 * Dreamcatcher Circuit Breaker
 * 
 * Objective: Enforce safety limits on autonomous agents to prevent
 * runaway costs, infinite loops, or destructive actions.
 */

export interface CircuitConfig {
  maxDailyLoops: number;
  maxFilesPerTask: number;
  blockedFilePatterns: string[];
}

const DEFAULT_CONFIG: CircuitConfig = {
  maxDailyLoops: 50,
  maxFilesPerTask: 5,
  blockedFilePatterns: [
    '.env',
    'credentials.json',
    'id_rsa',
    'seed.yaml' // Agents cannot rewrite the genome without human signoff
  ]
};

export class CircuitBreaker {
  private loopCount: number = 0;
  private lastReset: number = Date.now();
  private config: CircuitConfig;

  constructor(config: Partial<CircuitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  canProceed(): boolean {
    this.checkReset();
    if (this.loopCount >= this.config.maxDailyLoops) {
      console.warn(`🛑 [Circuit] Daily limit reached (${this.loopCount}/${this.config.maxDailyLoops}). Sleeping.`);
      return false;
    }
    return true;
  }

  registerLoop(): void {
    this.loopCount++;
  }

  isSafePath(filePath: string): boolean {
    return !this.config.blockedFilePatterns.some(pattern => filePath.includes(pattern));
  }

  private checkReset() {
    const now = Date.now();
    // Reset counter every 24 hours
    if (now - this.lastReset > 24 * 60 * 60 * 1000) {
      this.loopCount = 0;
      this.lastReset = now;
      console.log('🌅 [Circuit] New day. Counters reset.');
    }
  }
}
