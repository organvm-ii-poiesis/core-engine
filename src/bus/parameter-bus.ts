/**
 * Parameter Bus for Omni-Dromenon-Engine
 * 
 * Event-driven pub/sub system for routing parameter changes
 * between audience inputs, consensus engine, performers, and outputs.
 */

import { EventEmitter } from 'events';
import {
  type ConsensusResult,
  type ConsensusSnapshot,
  type PerformerOverride,
  type AudienceInput,
} from '../types/index.js';

// =============================================================================
// EVENT TYPES
// =============================================================================

export enum BusEvent {
  // Input events
  AUDIENCE_INPUT = 'audience:input',
  AUDIENCE_INPUT_BATCH = 'audience:input:batch',
  
  // Consensus events
  CONSENSUS_UPDATE = 'consensus:update',
  CONSENSUS_SNAPSHOT = 'consensus:snapshot',
  
  // Performer events
  PERFORMER_OVERRIDE = 'performer:override',
  PERFORMER_OVERRIDE_CLEAR = 'performer:override:clear',
  PERFORMER_COMMAND = 'performer:command',
  
  // Session events
  SESSION_START = 'session:start',
  SESSION_PAUSE = 'session:pause',
  SESSION_RESUME = 'session:resume',
  SESSION_END = 'session:end',
  
  // Participant events
  PARTICIPANT_JOIN = 'participant:join',
  PARTICIPANT_LEAVE = 'participant:leave',
  PARTICIPANT_UPDATE = 'participant:update',
  
  // System events
  ERROR = 'error',
  WARNING = 'warning',
  STATS = 'stats',
}

export interface BusEventPayloads {
  [BusEvent.AUDIENCE_INPUT]: AudienceInput;
  [BusEvent.AUDIENCE_INPUT_BATCH]: AudienceInput[];
  [BusEvent.CONSENSUS_UPDATE]: ConsensusResult;
  [BusEvent.CONSENSUS_SNAPSHOT]: ConsensusSnapshot;
  [BusEvent.PERFORMER_OVERRIDE]: PerformerOverride;
  [BusEvent.PERFORMER_OVERRIDE_CLEAR]: { parameter: string; performerId: string };
  [BusEvent.PERFORMER_COMMAND]: { command: string; data?: unknown };
  [BusEvent.SESSION_START]: { sessionId: string };
  [BusEvent.SESSION_PAUSE]: { sessionId: string };
  [BusEvent.SESSION_RESUME]: { sessionId: string };
  [BusEvent.SESSION_END]: { sessionId: string; reason?: string };
  [BusEvent.PARTICIPANT_JOIN]: { clientId: string; role: string };
  [BusEvent.PARTICIPANT_LEAVE]: { clientId: string; reason?: string };
  [BusEvent.PARTICIPANT_UPDATE]: { clientId: string; data: unknown };
  [BusEvent.ERROR]: { code: string; message: string; context?: unknown };
  [BusEvent.WARNING]: { code: string; message: string };
  [BusEvent.STATS]: BusStats;
}

export interface BusStats {
  inputsPerSecond: number;
  consensusUpdatesPerSecond: number;
  activeSubscribers: number;
  queueDepth: number;
  latencyMs: number;
}

// =============================================================================
// TYPED EVENT EMITTER
// =============================================================================

type BusEventHandler<E extends BusEvent> = (payload: BusEventPayloads[E]) => void;

export interface TypedEventEmitter {
  on<E extends BusEvent>(event: E, handler: BusEventHandler<E>): this;
  off<E extends BusEvent>(event: E, handler: BusEventHandler<E>): this;
  once<E extends BusEvent>(event: E, handler: BusEventHandler<E>): this;
  emit<E extends BusEvent>(event: E, payload: BusEventPayloads[E]): boolean;
}

// =============================================================================
// PARAMETER BUS
// =============================================================================

export class ParameterBus extends EventEmitter implements TypedEventEmitter {
  private stats: BusStats = {
    inputsPerSecond: 0,
    consensusUpdatesPerSecond: 0,
    activeSubscribers: 0,
    queueDepth: 0,
    latencyMs: 0,
  };
  
  private inputCount = 0;
  private consensusCount = 0;
  private lastStatsReset = Date.now();
  
  constructor() {
    super();
    this.setMaxListeners(100);
    
    // Start stats collection
    setInterval(() => this.collectStats(), 1000);
  }
  
  // ===========================================================================
  // TYPED EMIT/SUBSCRIBE
  // ===========================================================================
  
  /**
   * Emit a typed event.
   */
  publish<E extends BusEvent>(event: E, payload: BusEventPayloads[E]): boolean {
    return this.emit(event, payload);
  }
  
  /**
   * Subscribe to a typed event.
   */
  subscribe<E extends BusEvent>(event: E, handler: BusEventHandler<E>): () => void {
    this.on(event, handler);
    return () => this.off(event, handler);
  }
  
  /**
   * Subscribe once to a typed event.
   */
  subscribeOnce<E extends BusEvent>(event: E, handler: BusEventHandler<E>): void {
    this.once(event, handler);
  }
  
  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================
  
  /**
   * Publish audience input.
   */
  publishInput(input: AudienceInput): void {
    this.inputCount++;
    this.publish(BusEvent.AUDIENCE_INPUT, input);
  }
  
  /**
   * Publish batch of inputs.
   */
  publishInputBatch(inputs: AudienceInput[]): void {
    this.inputCount += inputs.length;
    this.publish(BusEvent.AUDIENCE_INPUT_BATCH, inputs);
  }
  
  /**
   * Publish consensus update.
   */
  publishConsensus(result: ConsensusResult): void {
    this.consensusCount++;
    this.publish(BusEvent.CONSENSUS_UPDATE, result);
  }
  
  /**
   * Publish consensus snapshot.
   */
  publishSnapshot(snapshot: ConsensusSnapshot): void {
    this.publish(BusEvent.CONSENSUS_SNAPSHOT, snapshot);
  }
  
  /**
   * Publish performer override.
   */
  publishOverride(override: PerformerOverride): void {
    this.publish(BusEvent.PERFORMER_OVERRIDE, override);
  }
  
  /**
   * Publish error.
   */
  publishError(code: string, message: string, context?: unknown): void {
    this.publish(BusEvent.ERROR, { code, message, context });
  }
  
  // ===========================================================================
  // STATS
  // ===========================================================================
  
  private collectStats(): void {
    const now = Date.now();
    const elapsed = (now - this.lastStatsReset) / 1000;
    
    this.stats = {
      inputsPerSecond: this.inputCount / elapsed,
      consensusUpdatesPerSecond: this.consensusCount / elapsed,
      activeSubscribers: this.listenerCount(BusEvent.CONSENSUS_UPDATE),
      queueDepth: 0, // Would need async queue for this
      latencyMs: 0, // Measured externally
    };
    
    this.inputCount = 0;
    this.consensusCount = 0;
    this.lastStatsReset = now;
    
    this.publish(BusEvent.STATS, this.stats);
  }
  
  getStats(): BusStats {
    return { ...this.stats };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let busInstance: ParameterBus | null = null;

export function getBus(): ParameterBus {
  if (!busInstance) {
    busInstance = new ParameterBus();
  }
  return busInstance;
}

export function createBus(): ParameterBus {
  return new ParameterBus();
}
