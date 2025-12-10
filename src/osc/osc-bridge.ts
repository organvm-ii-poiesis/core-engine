/**
 * OSC Bridge for Omni-Dromenon-Engine
 * 
 * Bidirectional OSC communication with external synthesis engines
 * (SuperCollider, Max/MSP, Pure Data, etc.)
 */

import osc from 'osc';
import { EventEmitter } from 'events';
import { ParameterBus, BusEvent } from '../bus/parameter-bus.js';
import { oscConfig } from '../config.js';
import type { ConsensusResult } from '../types/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface OSCBridgeConfig {
  localPort: number;
  remoteHost: string;
  remotePort: number;
  addressPrefix: string;
  enabled: boolean;
}

export interface OSCMessage {
  address: string;
  args: (number | string | boolean | Buffer)[];
}

// =============================================================================
// OSC BRIDGE
// =============================================================================

export class OSCBridge extends EventEmitter {
  private config: OSCBridgeConfig;
  private udpPort: osc.UDPPort | null = null;
  private bus: ParameterBus | null = null;
  private connected: boolean = false;
  private messageCount: number = 0;
  
  constructor(config?: Partial<OSCBridgeConfig>) {
    super();
    
    this.config = {
      localPort: config?.localPort ?? oscConfig.localPort,
      remoteHost: config?.remoteHost ?? oscConfig.remoteHost,
      remotePort: config?.remotePort ?? oscConfig.remotePort,
      addressPrefix: config?.addressPrefix ?? oscConfig.addressPrefix,
      enabled: config?.enabled ?? oscConfig.enabled,
    };
  }
  
  // ===========================================================================
  // CONNECTION
  // ===========================================================================
  
  /**
   * Connect to OSC and start listening.
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[OSC] Bridge disabled');
      return;
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.udpPort = new osc.UDPPort({
          localAddress: '0.0.0.0',
          localPort: this.config.localPort,
          remoteAddress: this.config.remoteHost,
          remotePort: this.config.remotePort,
          metadata: true,
        });
        
        this.udpPort.on('ready', () => {
          this.connected = true;
          console.log(`[OSC] Listening on port ${this.config.localPort}`);
          console.log(`[OSC] Sending to ${this.config.remoteHost}:${this.config.remotePort}`);
          this.emit('connected');
          resolve();
        });
        
        this.udpPort.on('message', (msg: osc.OscMessage) => {
          this.handleIncoming(msg);
        });
        
        this.udpPort.on('error', (err: Error) => {
          console.error('[OSC] Error:', err);
          this.emit('error', err);
        });
        
        this.udpPort.open();
      } catch (err) {
        reject(err);
      }
    });
  }
  
  /**
   * Disconnect and cleanup.
   */
  disconnect(): void {
    if (this.udpPort) {
      this.udpPort.close();
      this.udpPort = null;
    }
    this.connected = false;
    console.log('[OSC] Disconnected');
  }
  
  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  // ===========================================================================
  // BUS INTEGRATION
  // ===========================================================================
  
  /**
   * Attach to parameter bus for automatic forwarding.
   */
  attachToBus(bus: ParameterBus): void {
    this.bus = bus;
    
    // Forward consensus updates to OSC
    bus.subscribe(BusEvent.CONSENSUS_UPDATE, (result) => {
      this.sendParameter(result.parameter, result.value);
    });
    
    // Forward snapshots as bundles
    bus.subscribe(BusEvent.CONSENSUS_SNAPSHOT, (snapshot) => {
      const messages: OSCMessage[] = [];
      for (const [param, result] of snapshot.results) {
        messages.push({
          address: `${this.config.addressPrefix}/${param}`,
          args: [result.value],
        });
      }
      this.sendBundle(messages);
    });
  }
  
  // ===========================================================================
  // SENDING
  // ===========================================================================
  
  /**
   * Send a single parameter value.
   */
  sendParameter(parameter: string, value: number): void {
    const address = `${this.config.addressPrefix}/${parameter}`;
    this.send({ address, args: [{ type: 'f', value }] });
  }
  
  /**
   * Send raw OSC message.
   */
  send(message: { address: string; args: osc.Argument[] }): void {
    if (!this.connected || !this.udpPort) return;
    
    try {
      this.udpPort.send(message);
      this.messageCount++;
    } catch (err) {
      console.error('[OSC] Send error:', err);
    }
  }
  
  /**
   * Send OSC bundle (multiple messages with same timestamp).
   */
  sendBundle(messages: OSCMessage[], timeTag?: number): void {
    if (!this.connected || !this.udpPort) return;
    
    try {
      const bundle: osc.OscBundle = {
        timeTag: timeTag 
          ? osc.timeTag(timeTag) 
          : osc.timeTag(0), // Immediate
        packets: messages.map(m => ({
          address: m.address,
          args: m.args.map(a => {
            if (typeof a === 'number') return { type: 'f' as const, value: a };
            if (typeof a === 'string') return { type: 's' as const, value: a };
            if (typeof a === 'boolean') return a ? { type: 'T' as const } : { type: 'F' as const };
            return { type: 'b' as const, value: a };
          }),
        })),
      };
      
      this.udpPort.send(bundle);
      this.messageCount += messages.length;
    } catch (err) {
      console.error('[OSC] Bundle send error:', err);
    }
  }
  
  /**
   * Send all current values.
   */
  sendAllValues(values: Record<string, number>): void {
    const messages: OSCMessage[] = Object.entries(values).map(([param, value]) => ({
      address: `${this.config.addressPrefix}/${param}`,
      args: [value],
    }));
    
    this.sendBundle(messages);
  }
  
  // ===========================================================================
  // RECEIVING
  // ===========================================================================
  
  private handleIncoming(msg: osc.OscMessage): void {
    const { address, args } = msg;
    
    // Parse address to extract parameter
    const prefix = this.config.addressPrefix;
    if (!address.startsWith(prefix)) return;
    
    const paramPath = address.slice(prefix.length + 1);
    
    // Emit for external handling
    this.emit('message', {
      address,
      parameter: paramPath,
      args: args.map((a: osc.Argument) => 'value' in a ? a.value : a),
    });
    
    // Handle specific addresses
    if (paramPath === 'ping') {
      this.send({
        address: `${prefix}/pong`,
        args: [{ type: 'i', value: Date.now() }],
      });
    }
    
    // Handle parameter feedback from synth
    if (this.bus && args.length > 0) {
      const value = args[0];
      if ('value' in value && typeof value.value === 'number') {
        // Could publish back to bus for visualization
        // this.bus.publish(...)
      }
    }
  }
  
  // ===========================================================================
  // UTILITY
  // ===========================================================================
  
  /**
   * Get message statistics.
   */
  getStats(): { messageCount: number; connected: boolean } {
    return {
      messageCount: this.messageCount,
      connected: this.connected,
    };
  }
  
  /**
   * Update remote target.
   */
  setRemote(host: string, port: number): void {
    this.config.remoteHost = host;
    this.config.remotePort = port;
    
    // Reconnect if currently connected
    if (this.connected) {
      this.disconnect();
      this.connect();
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let bridgeInstance: OSCBridge | null = null;

export function getOSCBridge(): OSCBridge {
  if (!bridgeInstance) {
    bridgeInstance = new OSCBridge();
  }
  return bridgeInstance;
}

export function createOSCBridge(config?: Partial<OSCBridgeConfig>): OSCBridge {
  return new OSCBridge(config);
}
