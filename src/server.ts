/**
 * Omni-Dromenon-Engine Core Server
 * 
 * Express + Socket.io server for real-time audience participation.
 * Handles WebSocket connections, consensus computation, and
 * parameter distribution.
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'crypto';

import { config } from './config.js';
import {
  DEFAULT_PARAMETERS,
  DEFAULT_VENUE,
  type AudienceInput,
  type PerformerOverride,
  ParticipantRole,
  SessionStatus,
} from './types/index.js';
import { createBus, BusEvent } from './bus/parameter-bus.js';
import { createAudienceInputsHandler } from './bus/audience-inputs.js';
import { createPerformerSubscriptions } from './bus/performer-subscriptions.js';
import { createAggregator } from './consensus/parameter-aggregation.js';

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

const app = express();
const httpServer = createServer(app);

// Create Socket.io server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.server.corsOrigins,
    methods: ['GET', 'POST'],
  },
  pingInterval: config.websocket.pingInterval,
  pingTimeout: config.websocket.pingTimeout,
  maxHttpBufferSize: config.websocket.maxPayload,
  transports: [...config.websocket.transports],
});

// Create session state
const sessionId = uuidv4();
let sessionStatus: SessionStatus = SessionStatus.PENDING;

// Create bus and handlers
const bus = createBus();
const aggregator = createAggregator(
  sessionId,
  DEFAULT_PARAMETERS,
  {
    stagePosition: DEFAULT_VENUE.stagePosition,
    weighting: {
      spatialAlpha: config.consensus.spatialAlpha,
      temporalBeta: config.consensus.temporalBeta,
      consensusGamma: config.consensus.consensusGamma,
      spatialDecayRate: 0.5,
      temporalWindowMs: config.consensus.inputWindowMs,
      temporalDecayRate: 0.5,
      clusterThreshold: 0.1,
      smoothingFactor: config.consensus.smoothingFactor,
      outlierThreshold: 2.5,
    },
  }
);

const audienceHandler = createAudienceInputsHandler(
  bus,
  sessionId,
  DEFAULT_PARAMETERS.map(p => p.id)
);

const performerSubs = createPerformerSubscriptions(bus, sessionId);

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessionId,
    sessionStatus,
    uptime: process.uptime(),
    participants: {
      audience: audienceHandler.getActiveClientCount(),
      performers: performerSubs.getActivePerformerCount(),
    },
  });
});

// Session info
app.get('/session', (req, res) => {
  res.json({
    sessionId,
    status: sessionStatus,
    parameters: DEFAULT_PARAMETERS,
    venue: DEFAULT_VENUE,
    values: aggregator.getAllValues(),
    stats: bus.getStats(),
  });
});

// Current values
app.get('/values', (req, res) => {
  res.json(aggregator.getAllValues());
});

// =============================================================================
// SOCKET NAMESPACES
// =============================================================================

// Audience namespace
const audienceNs = io.of('/audience');

audienceNs.on('connection', (socket: Socket) => {
  const clientId = socket.handshake.query.clientId as string || uuidv4();
  
  console.log(`[Audience] Connected: ${clientId}`);
  
  // Send initial state
  socket.emit('session:state', {
    sessionId,
    status: sessionStatus,
    parameters: DEFAULT_PARAMETERS,
    values: aggregator.getAllValues(),
  });
  
  // Handle parameter input
  socket.on('input', (data: { parameter: string; value: number }) => {
    if (sessionStatus !== SessionStatus.ACTIVE) {
      socket.emit('error', { code: 'SESSION_NOT_ACTIVE', message: 'Session is not active' });
      return;
    }
    
    const result = audienceHandler.handleInput(
      clientId,
      data.parameter,
      data.value
    );
    
    if (!result.accepted) {
      socket.emit('input:rejected', { reason: result.reason });
    }
  });
  
  // Handle location update
  socket.on('location', (data: { x: number; y: number; zone?: string }) => {
    audienceHandler.updateClientLocation(clientId, data);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Audience] Disconnected: ${clientId}`);
    audienceHandler.removeClient(clientId);
  });
});

// Performer namespace
const performerNs = io.of('/performer');

performerNs.on('connection', (socket: Socket) => {
  const performerId = socket.handshake.query.performerId as string || uuidv4();
  const displayName = socket.handshake.query.displayName as string || 'Performer';
  
  console.log(`[Performer] Connected: ${performerId} (${displayName})`);
  
  // Register performer
  const session = performerSubs.registerPerformer(performerId, displayName);
  
  // Handle authentication
  socket.on('auth', (data: { secret: string }) => {
    const authenticated = performerSubs.authenticate(performerId, data.secret);
    performerSubs.setAuthenticated(performerId, authenticated);
    
    if (authenticated) {
      performerSubs.subscribeToAll(performerId);
      socket.emit('auth:success', { performerId });
      
      // Send full state
      socket.emit('session:state', {
        sessionId,
        status: sessionStatus,
        parameters: DEFAULT_PARAMETERS,
        values: aggregator.getAllValues(),
        overrides: Object.fromEntries(performerSubs.getAllOverrides()),
        stats: bus.getStats(),
      });
    } else {
      socket.emit('auth:failed', { reason: 'invalid_secret' });
    }
  });
  
  // Handle override request
  socket.on('override', (data: {
    parameter: string;
    value: number;
    mode: 'absolute' | 'blend' | 'lock';
    blendFactor?: number;
    durationMs?: number;
  }) => {
    const result = performerSubs.requestOverride({
      performerId,
      ...data,
    });
    
    if (result.success) {
      socket.emit('override:success', { override: result.override });
      // Apply to aggregator
      if (result.override) {
        aggregator.setOverride(result.override);
      }
    } else {
      socket.emit('override:failed', { reason: result.reason });
    }
  });
  
  // Handle override clear
  socket.on('override:clear', (data: { parameter: string }) => {
    const success = performerSubs.clearOverride(performerId, data.parameter);
    if (success) {
      aggregator.clearOverride(data.parameter);
      socket.emit('override:cleared', { parameter: data.parameter });
    }
  });
  
  // Handle session commands
  socket.on('session:start', () => {
    const session = performerSubs.getPerformer(performerId);
    if (session?.isAuthenticated) {
      sessionStatus = SessionStatus.ACTIVE;
      io.emit('session:started', { sessionId });
      console.log(`[Session] Started by ${performerId}`);
    }
  });
  
  socket.on('session:pause', () => {
    const session = performerSubs.getPerformer(performerId);
    if (session?.isAuthenticated && session.permissions.canPause) {
      sessionStatus = SessionStatus.PAUSED;
      io.emit('session:paused', { sessionId });
    }
  });
  
  socket.on('session:resume', () => {
    const session = performerSubs.getPerformer(performerId);
    if (session?.isAuthenticated) {
      sessionStatus = SessionStatus.ACTIVE;
      io.emit('session:resumed', { sessionId });
    }
  });
  
  socket.on('session:end', () => {
    const session = performerSubs.getPerformer(performerId);
    if (session?.isAuthenticated && session.permissions.canEnd) {
      sessionStatus = SessionStatus.ENDED;
      io.emit('session:ended', { sessionId });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Performer] Disconnected: ${performerId}`);
    performerSubs.removePerformer(performerId);
  });
});

// =============================================================================
// CONSENSUS LOOP
// =============================================================================

// Subscribe to batch inputs for consensus
bus.subscribe(BusEvent.AUDIENCE_INPUT_BATCH, (inputs) => {
  aggregator.addInputs(inputs);
});

// Consensus computation interval
setInterval(() => {
  if (sessionStatus !== SessionStatus.ACTIVE) return;
  
  const snapshot = aggregator.createSnapshot();
  
  // Broadcast to all connected clients
  const values = aggregator.getAllValues();
  
  audienceNs.emit('values', values);
  performerNs.emit('values', values);
  performerNs.emit('snapshot', {
    timestamp: snapshot.timestamp,
    participants: snapshot.totalParticipants,
    values,
  });
}, config.consensus.broadcastIntervalMs);

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

function shutdown() {
  console.log('[Server] Shutting down...');
  
  sessionStatus = SessionStatus.ENDED;
  io.emit('session:ended', { sessionId, reason: 'server_shutdown' });
  
  audienceHandler.destroy();
  performerSubs.destroy();
  
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    console.log('[Server] Forcing shutdown');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// =============================================================================
// START SERVER
// =============================================================================

httpServer.listen(config.server.port, config.server.host, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         OMNI-DROMENON-ENGINE CORE SERVER                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Session ID: ${sessionId}          ║
║  Status:     ${sessionStatus.padEnd(51)}║
║  Listening:  http://${config.server.host}:${config.server.port}                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                    ║
║    WebSocket (Audience):   ws://host:port/audience            ║
║    WebSocket (Performer):  ws://host:port/performer           ║
║    REST Health:            GET /health                        ║
║    REST Session:           GET /session                       ║
║    REST Values:            GET /values                        ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export { app, io, httpServer };
