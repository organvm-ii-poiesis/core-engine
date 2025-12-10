/**
 * Audience Inputs Handler for Omni-Dromenon-Engine
 * 
 * Manages incoming audience inputs: validation, rate limiting,
 * batching, and publishing to the parameter bus.
 */

import { v4 as uuidv4 } from 'crypto';
import {
  type AudienceInput,
  AudienceInputSchema,
} from '../types/index.js';
import { ParameterBus, BusEvent } from './parameter-bus.js';
import { consensusConfig } from '../config.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AudienceInputsConfig {
  rateLimitMs: number;
  maxInputsPerClient: number;
  batchIntervalMs: number;
  validParameters: Set<string>;
}

export interface ClientState {
  clientId: string;
  lastInputTime: number;
  inputCount: number;
  location?: { x: number; y: number; zone?: string };
  isBlocked: boolean;
  blockedUntil?: number;
}

// =============================================================================
// AUDIENCE INPUTS HANDLER
// =============================================================================

export class AudienceInputsHandler {
  private bus: ParameterBus;
  private config: AudienceInputsConfig;
  private clients: Map<string, ClientState>;
  private inputBuffer: AudienceInput[];
  private batchTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  
  constructor(
    bus: ParameterBus,
    sessionId: string,
    validParameters: string[],
    config?: Partial<AudienceInputsConfig>
  ) {
    this.bus = bus;
    this.sessionId = sessionId;
    this.clients = new Map();
    this.inputBuffer = [];
    
    this.config = {
      rateLimitMs: config?.rateLimitMs ?? consensusConfig.inputRateLimitMs,
      maxInputsPerClient: config?.maxInputsPerClient ?? consensusConfig.maxInputsPerClient,
      batchIntervalMs: config?.batchIntervalMs ?? 50,
      validParameters: new Set(validParameters),
    };
    
    this.startBatching();
  }
  
  // ===========================================================================
  // INPUT PROCESSING
  // ===========================================================================
  
  /**
   * Process raw input from a client.
   * Returns true if accepted, false if rejected.
   */
  handleInput(
    clientId: string,
    parameter: string,
    value: number,
    location?: { x: number; y: number; zone?: string }
  ): { accepted: boolean; reason?: string } {
    // Get or create client state
    let client = this.clients.get(clientId);
    if (!client) {
      client = {
        clientId,
        lastInputTime: 0,
        inputCount: 0,
        isBlocked: false,
      };
      this.clients.set(clientId, client);
    }
    
    // Check if client is blocked
    if (client.isBlocked) {
      if (client.blockedUntil && Date.now() > client.blockedUntil) {
        client.isBlocked = false;
        client.blockedUntil = undefined;
      } else {
        return { accepted: false, reason: 'client_blocked' };
      }
    }
    
    // Rate limiting
    const now = Date.now();
    if (now - client.lastInputTime < this.config.rateLimitMs) {
      return { accepted: false, reason: 'rate_limited' };
    }
    
    // Validate parameter
    if (!this.config.validParameters.has(parameter)) {
      return { accepted: false, reason: 'invalid_parameter' };
    }
    
    // Validate value range
    if (value < 0 || value > 1 || !Number.isFinite(value)) {
      return { accepted: false, reason: 'invalid_value' };
    }
    
    // Update client state
    client.lastInputTime = now;
    client.inputCount++;
    if (location) {
      client.location = location;
    }
    
    // Check for input flooding
    if (client.inputCount > this.config.maxInputsPerClient) {
      client.isBlocked = true;
      client.blockedUntil = now + 60000; // Block for 1 minute
      this.bus.publishError(
        'CLIENT_BLOCKED',
        `Client ${clientId} blocked for input flooding`,
        { clientId, inputCount: client.inputCount }
      );
      return { accepted: false, reason: 'flood_blocked' };
    }
    
    // Create input record
    const input: AudienceInput = {
      id: uuidv4(),
      clientId,
      sessionId: this.sessionId,
      timestamp: now,
      parameter,
      value,
      location: client.location,
    };
    
    // Add to buffer for batching
    this.inputBuffer.push(input);
    
    // Also emit individual input for real-time processing
    this.bus.publishInput(input);
    
    return { accepted: true };
  }
  
  /**
   * Parse and validate input from raw data.
   */
  parseInput(data: unknown): AudienceInput | null {
    const result = AudienceInputSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    return null;
  }
  
  // ===========================================================================
  // BATCHING
  // ===========================================================================
  
  private startBatching(): void {
    this.batchTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.batchIntervalMs);
  }
  
  private flushBuffer(): void {
    if (this.inputBuffer.length === 0) return;
    
    const batch = [...this.inputBuffer];
    this.inputBuffer = [];
    
    this.bus.publishInputBatch(batch);
  }
  
  // ===========================================================================
  // CLIENT MANAGEMENT
  // ===========================================================================
  
  /**
   * Update client location.
   */
  updateClientLocation(
    clientId: string,
    location: { x: number; y: number; zone?: string }
  ): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.location = location;
    }
  }
  
  /**
   * Remove client state.
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }
  
  /**
   * Block a client.
   */
  blockClient(clientId: string, durationMs: number = 60000): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isBlocked = true;
      client.blockedUntil = Date.now() + durationMs;
    }
  }
  
  /**
   * Unblock a client.
   */
  unblockClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isBlocked = false;
      client.blockedUntil = undefined;
    }
  }
  
  /**
   * Get client state.
   */
  getClientState(clientId: string): ClientState | undefined {
    return this.clients.get(clientId);
  }
  
  /**
   * Get active client count.
   */
  getActiveClientCount(): number {
    const cutoff = Date.now() - 60000; // Active in last minute
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.lastInputTime > cutoff && !client.isBlocked) {
        count++;
      }
    }
    return count;
  }
  
  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================
  
  /**
   * Add valid parameter.
   */
  addValidParameter(parameter: string): void {
    this.config.validParameters.add(parameter);
  }
  
  /**
   * Remove valid parameter.
   */
  removeValidParameter(parameter: string): void {
    this.config.validParameters.delete(parameter);
  }
  
  /**
   * Update rate limit.
   */
  setRateLimit(ms: number): void {
    this.config.rateLimitMs = ms;
  }
  
  // ===========================================================================
  // CLEANUP
  // ===========================================================================
  
  /**
   * Stop batching and cleanup.
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushBuffer();
    this.clients.clear();
  }
  
  /**
   * Reset input counts (call periodically).
   */
  resetInputCounts(): void {
    for (const client of this.clients.values()) {
      client.inputCount = 0;
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createAudienceInputsHandler(
  bus: ParameterBus,
  sessionId: string,
  validParameters: string[],
  config?: Partial<AudienceInputsConfig>
): AudienceInputsHandler {
  return new AudienceInputsHandler(bus, sessionId, validParameters, config);
}
