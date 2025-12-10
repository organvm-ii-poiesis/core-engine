/**
 * Performance Types for Omni-Dromenon-Engine
 * 
 * Defines session state, parameter definitions, venue geometry,
 * and performance lifecycle structures.
 */

import { z } from 'zod';

// =============================================================================
// PERFORMANCE PARAMETERS
// =============================================================================

export enum ParameterCategory {
  MOOD = 'mood',
  TEMPO = 'tempo',
  INTENSITY = 'intensity',
  DENSITY = 'density',
  TEXTURE = 'texture',
  HARMONY = 'harmony',
  RHYTHM = 'rhythm',
  SPATIAL = 'spatial',
  CUSTOM = 'custom',
}

export interface ParameterDefinition {
  id: string;
  name: string;
  category: ParameterCategory;
  description: string;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  unit?: string;
  
  // Control behavior
  audienceControllable: boolean;
  performerControllable: boolean;
  smoothingEnabled: boolean;
  
  // Mapping
  oscAddress?: string;
  midiCC?: number;
}

export const DEFAULT_PARAMETERS: ParameterDefinition[] = [
  {
    id: 'mood',
    name: 'Mood',
    category: ParameterCategory.MOOD,
    description: 'Overall emotional color (dark to bright)',
    min: 0,
    max: 1,
    defaultValue: 0.5,
    audienceControllable: true,
    performerControllable: true,
    smoothingEnabled: true,
    oscAddress: '/performance/mood',
  },
  {
    id: 'tempo',
    name: 'Tempo',
    category: ParameterCategory.TEMPO,
    description: 'Speed/pace of performance',
    min: 0,
    max: 1,
    defaultValue: 0.5,
    audienceControllable: true,
    performerControllable: true,
    smoothingEnabled: true,
    oscAddress: '/performance/tempo',
  },
  {
    id: 'intensity',
    name: 'Intensity',
    category: ParameterCategory.INTENSITY,
    description: 'Energy level (calm to intense)',
    min: 0,
    max: 1,
    defaultValue: 0.3,
    audienceControllable: true,
    performerControllable: true,
    smoothingEnabled: true,
    oscAddress: '/performance/intensity',
  },
  {
    id: 'density',
    name: 'Density',
    category: ParameterCategory.DENSITY,
    description: 'Textural complexity (sparse to dense)',
    min: 0,
    max: 1,
    defaultValue: 0.4,
    audienceControllable: true,
    performerControllable: true,
    smoothingEnabled: true,
    oscAddress: '/performance/density',
  },
];

// =============================================================================
// VENUE GEOMETRY
// =============================================================================

export interface VenueZone {
  id: string;
  name: string;
  bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  spatialWeight: number; // Base weight multiplier for this zone
}

export interface VenueGeometry {
  id: string;
  name: string;
  width: number;
  height: number;
  stagePosition: { x: number; y: number };
  zones: VenueZone[];
  maxCapacity: number;
}

export const DEFAULT_VENUE: VenueGeometry = {
  id: 'default',
  name: 'Default Venue',
  width: 100,
  height: 100,
  stagePosition: { x: 50, y: 0 },
  zones: [
    {
      id: 'front',
      name: 'Front Section',
      bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 30 },
      spatialWeight: 1.0,
    },
    {
      id: 'middle',
      name: 'Middle Section',
      bounds: { xMin: 0, xMax: 100, yMin: 30, yMax: 70 },
      spatialWeight: 0.8,
    },
    {
      id: 'back',
      name: 'Back Section',
      bounds: { xMin: 0, xMax: 100, yMin: 70, yMax: 100 },
      spatialWeight: 0.6,
    },
  ],
  maxCapacity: 500,
};

// =============================================================================
// SESSION STATE
// =============================================================================

export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
}

export interface SessionConfig {
  allowAudienceInput: boolean;
  allowPerformerOverride: boolean;
  recordingEnabled: boolean;
  maxParticipants: number;
  inputRateLimitMs: number;
  consensusIntervalMs: number;
  oscEnabled: boolean;
  oscHost?: string;
  oscPort?: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  allowAudienceInput: true,
  allowPerformerOverride: true,
  recordingEnabled: true,
  maxParticipants: 1000,
  inputRateLimitMs: 100,
  consensusIntervalMs: 50,
  oscEnabled: true,
  oscHost: '127.0.0.1',
  oscPort: 57120,
};

export interface PerformanceSession {
  id: string;
  name: string;
  status: SessionStatus;
  startedAt: number | null;
  endedAt: number | null;
  
  // Configuration
  config: SessionConfig;
  venue: VenueGeometry;
  parameters: ParameterDefinition[];
  
  // Current state
  currentValues: Map<string, number>;
  participantCount: number;
  
  // Metadata
  genre?: string;
  performers: string[];
  tags: string[];
}

// =============================================================================
// PARTICIPANT
// =============================================================================

export enum ParticipantRole {
  AUDIENCE = 'audience',
  PERFORMER = 'performer',
  ADMIN = 'admin',
  OBSERVER = 'observer',
}

export interface Participant {
  id: string;
  sessionId: string;
  role: ParticipantRole;
  connectedAt: number;
  lastActiveAt: number;
  location?: { x: number; y: number; zone?: string };
  inputCount: number;
  isActive: boolean;
}

// =============================================================================
// RECORDING
// =============================================================================

export interface PerformanceEvent {
  timestamp: number;
  type: 'input' | 'consensus' | 'override' | 'state_change';
  source: string;
  data: Record<string, unknown>;
}

export interface PerformanceRecording {
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  events: PerformanceEvent[];
  snapshots: Array<{
    timestamp: number;
    values: Record<string, number>;
    participantCount: number;
  }>;
  metadata: {
    venue: string;
    genre?: string;
    performers: string[];
    totalParticipants: number;
    peakParticipants: number;
    totalInputs: number;
  };
}

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const ParameterValueSchema = z.object({
  parameter: z.string(),
  value: z.number().min(0).max(1),
});

export const SessionConfigSchema = z.object({
  allowAudienceInput: z.boolean(),
  allowPerformerOverride: z.boolean(),
  recordingEnabled: z.boolean(),
  maxParticipants: z.number().positive(),
  inputRateLimitMs: z.number().positive(),
  consensusIntervalMs: z.number().positive(),
  oscEnabled: z.boolean(),
  oscHost: z.string().optional(),
  oscPort: z.number().positive().optional(),
});
