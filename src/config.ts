/**
 * Configuration for Omni-Dromenon-Engine Core
 * 
 * Environment-based configuration with sensible defaults.
 */

// =============================================================================
// ENVIRONMENT PARSING
// =============================================================================

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

// =============================================================================
// SERVER CONFIG
// =============================================================================

export const serverConfig = {
  port: getEnvNumber('PORT', 3000),
  host: getEnv('HOST', '0.0.0.0'),
  env: getEnv('NODE_ENV', 'development'),
  
  // CORS
  corsOrigins: getEnv('CORS_ORIGINS', '*').split(','),
  
  // Logging
  logLevel: getEnv('LOG_LEVEL', 'info'),
  logFormat: getEnv('LOG_FORMAT', 'json'),
};

// =============================================================================
// WEBSOCKET CONFIG
// =============================================================================

export const websocketConfig = {
  pingInterval: getEnvNumber('WS_PING_INTERVAL', 10000),
  pingTimeout: getEnvNumber('WS_PING_TIMEOUT', 5000),
  maxPayload: getEnvNumber('WS_MAX_PAYLOAD', 65536),
  transports: ['websocket', 'polling'] as const,
};

// =============================================================================
// REDIS CONFIG
// =============================================================================

export const redisConfig = {
  enabled: getEnvBoolean('REDIS_ENABLED', false),
  url: getEnv('REDIS_URL', 'redis://localhost:6379'),
  prefix: getEnv('REDIS_PREFIX', 'ode:'),
};

// =============================================================================
// OSC CONFIG
// =============================================================================

export const oscConfig = {
  enabled: getEnvBoolean('OSC_ENABLED', true),
  localPort: getEnvNumber('OSC_LOCAL_PORT', 57121),
  remoteHost: getEnv('OSC_REMOTE_HOST', '127.0.0.1'),
  remotePort: getEnvNumber('OSC_REMOTE_PORT', 57120),
  addressPrefix: getEnv('OSC_ADDRESS_PREFIX', '/performance'),
};

// =============================================================================
// CONSENSUS CONFIG
// =============================================================================

export const consensusConfig = {
  // Update intervals
  consensusIntervalMs: getEnvNumber('CONSENSUS_INTERVAL_MS', 50),
  broadcastIntervalMs: getEnvNumber('BROADCAST_INTERVAL_MS', 50),
  
  // Input handling
  inputWindowMs: getEnvNumber('INPUT_WINDOW_MS', 10000),
  maxInputsPerClient: getEnvNumber('MAX_INPUTS_PER_CLIENT', 100),
  
  // Rate limiting
  inputRateLimitMs: getEnvNumber('INPUT_RATE_LIMIT_MS', 100),
  
  // Weighting defaults
  spatialAlpha: parseFloat(getEnv('WEIGHT_SPATIAL_ALPHA', '0.3')),
  temporalBeta: parseFloat(getEnv('WEIGHT_TEMPORAL_BETA', '0.5')),
  consensusGamma: parseFloat(getEnv('WEIGHT_CONSENSUS_GAMMA', '0.2')),
  
  // Smoothing
  smoothingFactor: parseFloat(getEnv('SMOOTHING_FACTOR', '0.3')),
};

// =============================================================================
// SESSION CONFIG
// =============================================================================

export const sessionConfig = {
  maxParticipants: getEnvNumber('MAX_PARTICIPANTS', 1000),
  sessionTimeoutMs: getEnvNumber('SESSION_TIMEOUT_MS', 3600000), // 1 hour
  inactivityTimeoutMs: getEnvNumber('INACTIVITY_TIMEOUT_MS', 300000), // 5 min
  recordingEnabled: getEnvBoolean('RECORDING_ENABLED', true),
};

// =============================================================================
// AUTH CONFIG
// =============================================================================

export const authConfig = {
  performerSecret: getEnv('PERFORMER_SECRET', 'dev-secret-change-me'),
  adminSecret: getEnv('ADMIN_SECRET', 'admin-secret-change-me'),
  jwtSecret: getEnv('JWT_SECRET', 'jwt-secret-change-me'),
  jwtExpiry: getEnv('JWT_EXPIRY', '24h'),
};

// =============================================================================
// COMBINED CONFIG
// =============================================================================

export const config = {
  server: serverConfig,
  websocket: websocketConfig,
  redis: redisConfig,
  osc: oscConfig,
  consensus: consensusConfig,
  session: sessionConfig,
  auth: authConfig,
  
  // Helpers
  isDev: serverConfig.env === 'development',
  isProd: serverConfig.env === 'production',
  isTest: serverConfig.env === 'test',
};

export default config;
