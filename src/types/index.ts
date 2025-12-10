/**
 * Type Exports for Omni-Dromenon-Engine Core
 */

// Consensus types
export {
  ConsensusMode,
  InputSource,
  type AudienceInput,
  AudienceInputSchema,
  type WeightingConfig,
  DEFAULT_WEIGHTING_CONFIG,
  GENRE_PRESETS,
  type WeightedInput,
  type ConsensusResult,
  type ConsensusSnapshot,
  type PerformerOverride,
  PerformerOverrideSchema,
  type AggregationState,
  type InputCluster,
  type ClusterAnalysis,
} from './consensus.js';

// Performance types
export {
  ParameterCategory,
  type ParameterDefinition,
  DEFAULT_PARAMETERS,
  type VenueZone,
  type VenueGeometry,
  DEFAULT_VENUE,
  SessionStatus,
  type SessionConfig,
  DEFAULT_SESSION_CONFIG,
  type PerformanceSession,
  ParticipantRole,
  type Participant,
  type PerformanceEvent,
  type PerformanceRecording,
  ParameterValueSchema,
  SessionConfigSchema,
} from './performance.js';
