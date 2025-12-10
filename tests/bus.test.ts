/**
 * Parameter Bus Tests for Omni-Dromenon-Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ParameterBus,
  BusEvent,
  createBus,
} from '../src/bus/parameter-bus.js';
import { createAudienceInputsHandler } from '../src/bus/audience-inputs.js';
import { createPerformerSubscriptions } from '../src/bus/performer-subscriptions.js';
import type { AudienceInput, ConsensusResult, PerformerOverride } from '../src/types/index.js';

// =============================================================================
// PARAMETER BUS TESTS
// =============================================================================

describe('ParameterBus', () => {
  let bus: ParameterBus;
  
  beforeEach(() => {
    bus = createBus();
  });
  
  describe('Event Publishing', () => {
    it('emits audience input events', () => {
      const handler = vi.fn();
      bus.subscribe(BusEvent.AUDIENCE_INPUT, handler);
      
      const input: AudienceInput = {
        id: 'test-id',
        clientId: 'client-1',
        sessionId: 'session-1',
        timestamp: Date.now(),
        parameter: 'mood',
        value: 0.7,
      };
      
      bus.publishInput(input);
      
      expect(handler).toHaveBeenCalledWith(input);
    });
    
    it('emits consensus update events', () => {
      const handler = vi.fn();
      bus.subscribe(BusEvent.CONSENSUS_UPDATE, handler);
      
      const result: ConsensusResult = {
        parameter: 'mood',
        value: 0.6,
        confidence: 0.9,
        inputCount: 10,
        timestamp: Date.now(),
        mode: 0, // WEIGHTED_AVERAGE
        rawMean: 0.6,
        weightedMean: 0.6,
        standardDeviation: 0.1,
        participationRate: 1.0,
      };
      
      bus.publishConsensus(result);
      
      expect(handler).toHaveBeenCalledWith(result);
    });
    
    it('emits performer override events', () => {
      const handler = vi.fn();
      bus.subscribe(BusEvent.PERFORMER_OVERRIDE, handler);
      
      const override: PerformerOverride = {
        performerId: 'performer-1',
        parameter: 'mood',
        value: 0.8,
        mode: 'absolute',
      };
      
      bus.publishOverride(override);
      
      expect(handler).toHaveBeenCalledWith(override);
    });
  });
  
  describe('Subscription Management', () => {
    it('allows unsubscribing from events', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe(BusEvent.AUDIENCE_INPUT, handler);
      
      unsubscribe();
      
      bus.publishInput({
        id: 'test',
        clientId: 'client',
        sessionId: 'session',
        timestamp: Date.now(),
        parameter: 'mood',
        value: 0.5,
      });
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('supports multiple subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      bus.subscribe(BusEvent.CONSENSUS_UPDATE, handler1);
      bus.subscribe(BusEvent.CONSENSUS_UPDATE, handler2);
      
      const result: ConsensusResult = {
        parameter: 'mood',
        value: 0.5,
        confidence: 0.8,
        inputCount: 5,
        timestamp: Date.now(),
        mode: 0,
        rawMean: 0.5,
        weightedMean: 0.5,
        standardDeviation: 0.05,
        participationRate: 1.0,
      };
      
      bus.publishConsensus(result);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
    
    it('supports subscribeOnce', () => {
      const handler = vi.fn();
      bus.subscribeOnce(BusEvent.SESSION_START, handler);
      
      bus.publish(BusEvent.SESSION_START, { sessionId: 'test' });
      bus.publish(BusEvent.SESSION_START, { sessionId: 'test' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Statistics', () => {
    it('tracks input counts', async () => {
      for (let i = 0; i < 10; i++) {
        bus.publishInput({
          id: `input-${i}`,
          clientId: 'client',
          sessionId: 'session',
          timestamp: Date.now(),
          parameter: 'mood',
          value: Math.random(),
        });
      }
      
      // Wait for stats collection
      await new Promise(r => setTimeout(r, 1100));
      
      const stats = bus.getStats();
      expect(stats.inputsPerSecond).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// AUDIENCE INPUTS HANDLER TESTS
// =============================================================================

describe('AudienceInputsHandler', () => {
  let bus: ParameterBus;
  let handler: ReturnType<typeof createAudienceInputsHandler>;
  
  beforeEach(() => {
    bus = createBus();
    handler = createAudienceInputsHandler(
      bus,
      'test-session',
      ['mood', 'tempo', 'intensity']
    );
  });
  
  describe('Input Handling', () => {
    it('accepts valid input', () => {
      const result = handler.handleInput('client-1', 'mood', 0.5);
      expect(result.accepted).toBe(true);
    });
    
    it('rejects invalid parameter', () => {
      const result = handler.handleInput('client-1', 'invalid', 0.5);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('invalid_parameter');
    });
    
    it('rejects out-of-range values', () => {
      const result1 = handler.handleInput('client-1', 'mood', -0.1);
      const result2 = handler.handleInput('client-1', 'mood', 1.1);
      
      expect(result1.accepted).toBe(false);
      expect(result1.reason).toBe('invalid_value');
      expect(result2.accepted).toBe(false);
    });
    
    it('rate limits rapid inputs', () => {
      handler.handleInput('client-1', 'mood', 0.5);
      const result = handler.handleInput('client-1', 'mood', 0.6);
      
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('rate_limited');
    });
  });
  
  describe('Client Management', () => {
    it('tracks client locations', () => {
      handler.handleInput('client-1', 'mood', 0.5);
      handler.updateClientLocation('client-1', { x: 50, y: 30 });
      
      const state = handler.getClientState('client-1');
      expect(state?.location).toEqual({ x: 50, y: 30 });
    });
    
    it('removes client state', () => {
      handler.handleInput('client-1', 'mood', 0.5);
      handler.removeClient('client-1');
      
      expect(handler.getClientState('client-1')).toBeUndefined();
    });
    
    it('blocks and unblocks clients', () => {
      handler.handleInput('client-1', 'mood', 0.5);
      handler.blockClient('client-1', 1000);
      
      const result = handler.handleInput('client-1', 'mood', 0.6);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('client_blocked');
      
      handler.unblockClient('client-1');
      
      // Need to wait for rate limit
      setTimeout(() => {
        const result2 = handler.handleInput('client-1', 'mood', 0.7);
        expect(result2.accepted).toBe(true);
      }, 150);
    });
  });
  
  describe('Active Client Count', () => {
    it('counts active clients correctly', async () => {
      handler.handleInput('client-1', 'mood', 0.5);
      await new Promise(r => setTimeout(r, 150));
      handler.handleInput('client-2', 'tempo', 0.6);
      
      expect(handler.getActiveClientCount()).toBe(2);
    });
  });
});

// =============================================================================
// PERFORMER SUBSCRIPTIONS TESTS
// =============================================================================

describe('PerformerSubscriptions', () => {
  let bus: ParameterBus;
  let subs: ReturnType<typeof createPerformerSubscriptions>;
  
  beforeEach(() => {
    bus = createBus();
    subs = createPerformerSubscriptions(bus, 'test-session');
  });
  
  describe('Authentication', () => {
    it('authenticates with correct secret', () => {
      const result = subs.authenticate('performer-1', 'dev-secret-change-me');
      expect(result).toBe(true);
    });
    
    it('rejects incorrect secret', () => {
      const result = subs.authenticate('performer-1', 'wrong-secret');
      expect(result).toBe(false);
    });
  });
  
  describe('Override Handling', () => {
    beforeEach(() => {
      subs.registerPerformer('performer-1', 'Test Performer');
      subs.setAuthenticated('performer-1', true);
    });
    
    it('accepts override from authenticated performer', () => {
      const result = subs.requestOverride({
        performerId: 'performer-1',
        parameter: 'mood',
        value: 0.8,
        mode: 'absolute',
      });
      
      expect(result.success).toBe(true);
      expect(result.override?.value).toBe(0.8);
    });
    
    it('rejects override from unauthenticated performer', () => {
      subs.setAuthenticated('performer-1', false);
      
      const result = subs.requestOverride({
        performerId: 'performer-1',
        parameter: 'mood',
        value: 0.8,
        mode: 'absolute',
      });
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_authenticated');
    });
    
    it('clears overrides', () => {
      subs.requestOverride({
        performerId: 'performer-1',
        parameter: 'mood',
        value: 0.8,
        mode: 'absolute',
      });
      
      const cleared = subs.clearOverride('performer-1', 'mood');
      expect(cleared).toBe(true);
      expect(subs.getOverride('mood')).toBeNull();
    });
    
    it('expires timed overrides', async () => {
      subs.requestOverride({
        performerId: 'performer-1',
        parameter: 'mood',
        value: 0.8,
        mode: 'absolute',
        durationMs: 100,
      });
      
      expect(subs.getOverride('mood')).not.toBeNull();
      
      await new Promise(r => setTimeout(r, 150));
      
      expect(subs.getOverride('mood')).toBeNull();
    });
  });
  
  describe('Performer Management', () => {
    it('registers and retrieves performers', () => {
      const session = subs.registerPerformer('performer-1', 'Test Performer');
      
      expect(session.performerId).toBe('performer-1');
      expect(session.displayName).toBe('Test Performer');
      expect(subs.getPerformer('performer-1')).toBeDefined();
    });
    
    it('removes performers and clears their overrides', () => {
      subs.registerPerformer('performer-1', 'Test');
      subs.setAuthenticated('performer-1', true);
      
      subs.requestOverride({
        performerId: 'performer-1',
        parameter: 'mood',
        value: 0.8,
        mode: 'absolute',
      });
      
      subs.removePerformer('performer-1');
      
      expect(subs.getPerformer('performer-1')).toBeUndefined();
      expect(subs.getOverride('mood')).toBeNull();
    });
  });
});
