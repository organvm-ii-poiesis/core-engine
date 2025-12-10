/**
 * Performer Subscriptions for Omni-Dromenon-Engine
 * 
 * Manages performer connections, override handling, and
 * distributing consensus updates to performer dashboards.
 */

import {
  type PerformerOverride,
  type ConsensusResult,
  type ConsensusSnapshot,
  PerformerOverrideSchema,
  ParticipantRole,
} from '../types/index.js';
import { ParameterBus, BusEvent } from './parameter-bus.js';
import { authConfig } from '../config.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PerformerSession {
  performerId: string;
  displayName: string;
  connectedAt: number;
  lastActiveAt: number;
  isAuthenticated: boolean;
  permissions: PerformerPermissions;
  subscriptions: Set<string>; // Parameter subscriptions
  activeOverrides: Set<string>;
}

export interface PerformerPermissions {
  canOverride: boolean;
  canPause: boolean;
  canEnd: boolean;
  canModifyConfig: boolean;
  overridableParameters: Set<string> | 'all';
}

export interface OverrideRequest {
  performerId: string;
  parameter: string;
  value: number;
  mode: 'absolute' | 'blend' | 'lock';
  blendFactor?: number;
  durationMs?: number;
  reason?: string;
}

// =============================================================================
// PERFORMER SUBSCRIPTIONS
// =============================================================================

export class PerformerSubscriptions {
  private bus: ParameterBus;
  private performers: Map<string, PerformerSession>;
  private overrides: Map<string, PerformerOverride>; // parameter -> override
  private sessionId: string;
  
  constructor(bus: ParameterBus, sessionId: string) {
    this.bus = bus;
    this.sessionId = sessionId;
    this.performers = new Map();
    this.overrides = new Map();
    
    // Subscribe to consensus updates
    this.bus.subscribe(BusEvent.CONSENSUS_UPDATE, (result) => {
      this.distributeConsensusUpdate(result);
    });
    
    this.bus.subscribe(BusEvent.CONSENSUS_SNAPSHOT, (snapshot) => {
      this.distributeSnapshot(snapshot);
    });
  }
  
  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================
  
  /**
   * Authenticate a performer with the secret.
   */
  authenticate(performerId: string, secret: string): boolean {
    // Simple secret-based auth for now
    // In production, use JWT or similar
    return secret === authConfig.performerSecret;
  }
  
  /**
   * Register a new performer session.
   */
  registerPerformer(
    performerId: string,
    displayName: string,
    permissions?: Partial<PerformerPermissions>
  ): PerformerSession {
    const session: PerformerSession = {
      performerId,
      displayName,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
      isAuthenticated: false,
      permissions: {
        canOverride: permissions?.canOverride ?? true,
        canPause: permissions?.canPause ?? true,
        canEnd: permissions?.canEnd ?? false,
        canModifyConfig: permissions?.canModifyConfig ?? false,
        overridableParameters: permissions?.overridableParameters ?? 'all',
      },
      subscriptions: new Set(),
      activeOverrides: new Set(),
    };
    
    this.performers.set(performerId, session);
    
    this.bus.publish(BusEvent.PARTICIPANT_JOIN, {
      clientId: performerId,
      role: ParticipantRole.PERFORMER,
    });
    
    return session;
  }
  
  /**
   * Mark performer as authenticated.
   */
  setAuthenticated(performerId: string, authenticated: boolean): void {
    const session = this.performers.get(performerId);
    if (session) {
      session.isAuthenticated = authenticated;
      session.lastActiveAt = Date.now();
    }
  }
  
  // ===========================================================================
  // OVERRIDE HANDLING
  // ===========================================================================
  
  /**
   * Request an override from a performer.
   */
  requestOverride(request: OverrideRequest): { 
    success: boolean; 
    reason?: string;
    override?: PerformerOverride;
  } {
    const session = this.performers.get(request.performerId);
    
    if (!session) {
      return { success: false, reason: 'performer_not_found' };
    }
    
    if (!session.isAuthenticated) {
      return { success: false, reason: 'not_authenticated' };
    }
    
    if (!session.permissions.canOverride) {
      return { success: false, reason: 'no_override_permission' };
    }
    
    // Check parameter permissions
    if (
      session.permissions.overridableParameters !== 'all' &&
      !session.permissions.overridableParameters.has(request.parameter)
    ) {
      return { success: false, reason: 'parameter_not_allowed' };
    }
    
    // Validate value
    if (request.value < 0 || request.value > 1) {
      return { success: false, reason: 'invalid_value' };
    }
    
    // Create override
    const override: PerformerOverride = {
      performerId: request.performerId,
      parameter: request.parameter,
      value: request.value,
      mode: request.mode,
      blendFactor: request.blendFactor,
      expiresAt: request.durationMs 
        ? Date.now() + request.durationMs 
        : undefined,
      reason: request.reason,
    };
    
    // Store and publish
    this.overrides.set(request.parameter, override);
    session.activeOverrides.add(request.parameter);
    session.lastActiveAt = Date.now();
    
    this.bus.publishOverride(override);
    
    return { success: true, override };
  }
  
  /**
   * Clear an override.
   */
  clearOverride(performerId: string, parameter: string): boolean {
    const session = this.performers.get(performerId);
    if (!session?.isAuthenticated) return false;
    
    const override = this.overrides.get(parameter);
    if (override?.performerId !== performerId) return false;
    
    this.overrides.delete(parameter);
    session.activeOverrides.delete(parameter);
    
    this.bus.publish(BusEvent.PERFORMER_OVERRIDE_CLEAR, {
      parameter,
      performerId,
    });
    
    return true;
  }
  
  /**
   * Clear all overrides for a performer.
   */
  clearAllOverrides(performerId: string): void {
    const session = this.performers.get(performerId);
    if (!session) return;
    
    for (const parameter of session.activeOverrides) {
      this.clearOverride(performerId, parameter);
    }
  }
  
  /**
   * Get active override for a parameter.
   */
  getOverride(parameter: string): PerformerOverride | null {
    const override = this.overrides.get(parameter);
    if (!override) return null;
    
    // Check expiry
    if (override.expiresAt && Date.now() > override.expiresAt) {
      this.overrides.delete(parameter);
      return null;
    }
    
    return override;
  }
  
  /**
   * Get all active overrides.
   */
  getAllOverrides(): Map<string, PerformerOverride> {
    // Clean expired overrides
    for (const [param, override] of this.overrides) {
      if (override.expiresAt && Date.now() > override.expiresAt) {
        this.overrides.delete(param);
        const session = this.performers.get(override.performerId);
        session?.activeOverrides.delete(param);
      }
    }
    return new Map(this.overrides);
  }
  
  // ===========================================================================
  // SUBSCRIPTIONS
  // ===========================================================================
  
  /**
   * Subscribe performer to parameter updates.
   */
  subscribeToParameter(performerId: string, parameter: string): void {
    const session = this.performers.get(performerId);
    if (session) {
      session.subscriptions.add(parameter);
    }
  }
  
  /**
   * Subscribe performer to all parameters.
   */
  subscribeToAll(performerId: string): void {
    const session = this.performers.get(performerId);
    if (session) {
      session.subscriptions.add('*');
    }
  }
  
  /**
   * Unsubscribe performer from parameter.
   */
  unsubscribe(performerId: string, parameter: string): void {
    const session = this.performers.get(performerId);
    if (session) {
      session.subscriptions.delete(parameter);
    }
  }
  
  // ===========================================================================
  // DISTRIBUTION
  // ===========================================================================
  
  private distributeConsensusUpdate(result: ConsensusResult): void {
    // This would normally send to connected sockets
    // The actual sending is handled by the server layer
  }
  
  private distributeSnapshot(snapshot: ConsensusSnapshot): void {
    // This would normally send to connected sockets
  }
  
  /**
   * Get performers subscribed to a parameter.
   */
  getSubscribedPerformers(parameter: string): PerformerSession[] {
    const performers: PerformerSession[] = [];
    for (const session of this.performers.values()) {
      if (session.subscriptions.has('*') || session.subscriptions.has(parameter)) {
        performers.push(session);
      }
    }
    return performers;
  }
  
  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================
  
  /**
   * Get performer session.
   */
  getPerformer(performerId: string): PerformerSession | undefined {
    return this.performers.get(performerId);
  }
  
  /**
   * Get all connected performers.
   */
  getAllPerformers(): PerformerSession[] {
    return Array.from(this.performers.values());
  }
  
  /**
   * Remove performer.
   */
  removePerformer(performerId: string): void {
    const session = this.performers.get(performerId);
    if (session) {
      this.clearAllOverrides(performerId);
      this.performers.delete(performerId);
      
      this.bus.publish(BusEvent.PARTICIPANT_LEAVE, {
        clientId: performerId,
        reason: 'disconnected',
      });
    }
  }
  
  /**
   * Update performer activity.
   */
  updateActivity(performerId: string): void {
    const session = this.performers.get(performerId);
    if (session) {
      session.lastActiveAt = Date.now();
    }
  }
  
  /**
   * Get active performer count.
   */
  getActivePerformerCount(): number {
    const cutoff = Date.now() - 60000;
    let count = 0;
    for (const session of this.performers.values()) {
      if (session.lastActiveAt > cutoff && session.isAuthenticated) {
        count++;
      }
    }
    return count;
  }
  
  // ===========================================================================
  // CLEANUP
  // ===========================================================================
  
  /**
   * Cleanup and reset.
   */
  destroy(): void {
    for (const performerId of this.performers.keys()) {
      this.removePerformer(performerId);
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createPerformerSubscriptions(
  bus: ParameterBus,
  sessionId: string
): PerformerSubscriptions {
  return new PerformerSubscriptions(bus, sessionId);
}
