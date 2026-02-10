[![ORGAN-II: Poiesis](https://img.shields.io/badge/ORGAN--II-Poiesis-6a1b9a?style=flat-square)](https://github.com/organvm-ii-poiesis)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io/)

# Core Engine

**The computational heart of audience-participatory performance.** A real-time WebSocket server that aggregates audience inputs through weighted consensus algorithms and distributes resulting parameters to performers and synthesis engines — enabling live performances where hundreds of audience members collectively shape the art in real time.

Part of the [Omni-Dromenon-Engine](https://github.com/organvm-ii-poiesis/metasystem-master) constellation within **ORGAN-II (Poiesis)**, the generative art organ of the [organvm system](https://github.com/organvm-ii-poiesis).

---

## Table of Contents

- [Artistic Purpose](#artistic-purpose)
- [Conceptual Approach](#conceptual-approach)
- [Architecture](#architecture)
- [Technical Overview](#technical-overview)
- [Installation & Quick Start](#installation--quick-start)
- [Working Examples](#working-examples)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Theory Implemented from ORGAN-I](#theory-implemented-from-organ-i)
- [Cross-Organ Context](#cross-organ-context)
- [Performance Benchmarks](#performance-benchmarks)
- [Deployment](#deployment)
- [Related Work](#related-work)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Artistic Purpose

Most interactive performance technology treats audience participation as a novelty — press a button, cast a vote, watch a light change color. Core Engine rejects this premise. It treats the audience as a *collective instrument*, a distributed body whose spatial position, temporal engagement, and emergent consensus patterns become the raw material of artistic expression.

The problem Core Engine solves is one of translation: how do you convert the simultaneous, contradictory, noisy intentions of hundreds of people into a coherent artistic signal that a performer can interpret and a synthesis engine can render? The answer is weighted consensus — a mathematical framework that doesn't flatten disagreement into averages but preserves the texture of collective desire, including its tensions, clusters, and bimodalities.

When an audience member sends a parameter value (mood, intensity, tempo, density), their input is weighted by three factors: how close they are to the stage (spatial weighting), how recently they engaged (temporal weighting), and how much their input agrees with others (consensus weighting). The result is not a poll. It is a living signal — a real-time portrait of what the room wants, filtered through configurable artistic priorities.

Performers retain absolute authority. Any performer can override any parameter at any time, blending audience consensus with their own artistic judgment or locking a parameter entirely. This is not democratic art. It is art that listens.

---

## Conceptual Approach

Core Engine's design philosophy emerges from several intersecting ideas:

**Collective intelligence, not majority rule.** The weighted consensus model draws from research in swarm intelligence and deliberative polling. Rather than simple averaging, the system identifies clusters of agreement, measures entropy (the dispersion of opinion), and detects bimodality — moments when the audience is genuinely split. These analytical signals are as artistically useful as the consensus value itself. A performer who sees high entropy knows the room is conflicted; that information shapes their next move.

**Spatial embodiment matters.** In a traditional concert hall, proximity to the stage changes the experience. Core Engine encodes this reality into its weighting model. An audience member in the front row — literally leaning into the performance — carries more weight than someone in the back who may be checking their phone. This is not elitism; it is fidelity to the physics of attention. The spatial weighting uses exponential decay from a configurable stage position, and venues can define zones (front, middle, back) with distinct weight multipliers.

**Temporal recency as engagement signal.** Inputs decay over a configurable time window (default: 10 seconds). A person who voted 30 seconds ago and disengaged contributes less than someone actively adjusting parameters now. This prevents stale opinions from dominating and rewards continuous engagement — creating a feedback loop where participation itself becomes part of the performance.

**Genre-aware presets.** Different performance contexts demand different weighting balances. An electronic music set might privilege temporal responsiveness (audiences react quickly to drops and builds). A ballet might privilege spatial weighting (the audience's physical relationship to dancers matters more). An installation might make space dominant, with almost no temporal decay, because the work unfolds slowly. Core Engine ships with presets for electronic music, ballet, opera, installation, and theatre, each tuning the three weighting coefficients (alpha, beta, gamma) to match the art form's rhythms.

**Performer sovereignty.** The override system implements three modes: *absolute* (performer's value replaces consensus entirely), *blend* (a configurable mix of performer and audience values), and *lock* (parameter frozen at performer's chosen value until explicitly released). Overrides can carry expiration timestamps, enabling effects like "lock intensity at maximum for 30 seconds, then release back to audience control." This gives performers the tools to conduct the collective instrument with precision.

---

## Architecture

```
core-engine/
├── src/
│   ├── server.ts                    → Express + Socket.io server entry point
│   ├── config.ts                    → Environment-based configuration
│   ├── types/
│   │   ├── index.ts                 → Type re-exports
│   │   ├── consensus.ts             → Voting, weighting, cluster analysis types
│   │   └── performance.ts           → Parameters, venues, sessions, recordings
│   ├── consensus/
│   │   ├── weighted-voting.ts       → Spatial/temporal/consensus weight algorithms
│   │   ├── parameter-aggregation.ts → Multi-parameter aggregation engine
│   │   └── tests.ts                 → Consensus unit tests
│   ├── bus/
│   │   ├── parameter-bus.ts         → Typed event-driven pub/sub system
│   │   ├── audience-inputs.ts       → Input validation, rate limiting, batching
│   │   └── performer-subscriptions.ts → Performer auth, overrides, commands
│   ├── osc/
│   │   ├── osc-bridge.ts            → Bidirectional OSC for external synths
│   │   └── synthesis-protocols.ts   → Protocol definitions for SC/Max/Pd
│   └── middleware/
│       ├── auth.ts                  → JWT and secret-based authentication
│       ├── rate-limit.ts            → Per-client rate limiting
│       └── validation.ts            → Zod-based request validation
├── tests/
│   ├── bus.test.ts                  → Parameter bus unit tests
│   ├── consensus.test.ts            → Weighted voting algorithm tests
│   └── osc-bridge.test.ts          → OSC bridge integration tests
├── benchmarks/
│   └── latency-test.ts             → P95 latency benchmarks
├── docs/
│   ├── API.md                       → WebSocket events and REST endpoints
│   └── DEPLOYMENT.md               → Production deployment guide
├── docker/
│   ├── Dockerfile                   → Container image definition
│   └── docker-compose.yml          → Multi-service orchestration
├── package.json
└── tsconfig.json
```

---

## Technical Overview

### Core Systems

**1. Weighted Consensus Engine** (`src/consensus/weighted-voting.ts`)

The mathematical core. Each audience input receives a composite weight calculated from three independent factors:

- **Spatial weight (alpha):** Exponential decay based on Euclidean distance from a configurable stage position. Default coefficient: 0.3. Closer to stage = higher weight.
- **Temporal weight (beta):** Exponential decay based on input age within a configurable window (default: 10 seconds). Default coefficient: 0.5. More recent = higher weight.
- **Consensus weight (gamma):** Agreement score based on how many other inputs fall within a configurable cluster threshold of the input's value. Default coefficient: 0.2. Agreement with others = higher weight.

The composite weight formula: `W = alpha * spatial + beta * temporal + gamma * consensus`, clamped to [0.001, 1.0].

The engine supports four consensus modes: weighted average (default), median, majority vote (via cluster analysis), and performer blend.

**2. Parameter Bus** (`src/bus/parameter-bus.ts`)

A typed event-driven pub/sub system built on Node.js `EventEmitter` with a strongly-typed event map. The bus routes 16 distinct event types across four categories: input events (individual and batched audience inputs), consensus events (parameter updates and snapshots), performer events (overrides, commands), and session lifecycle events (start, pause, resume, end). It tracks throughput statistics (inputs/second, consensus updates/second) and exposes a typed `subscribe()` method that returns an unsubscribe function.

**3. Audience Inputs Handler** (`src/bus/audience-inputs.ts`)

The ingestion layer. Validates incoming inputs against parameter definitions and value ranges (all values normalized to 0.0-1.0). Enforces per-client rate limiting (default: 100ms between inputs). Implements flood detection that blocks clients exceeding configurable thresholds (default: 100 inputs before auto-block for 60 seconds). Buffers inputs and flushes them in batches every 50ms to reduce event overhead and improve consensus computation efficiency.

**4. Parameter Aggregation** (`src/consensus/parameter-aggregation.ts`)

The orchestration layer above the voting algorithms. Manages per-parameter state including input history, weighted inputs, current consensus results, performer overrides, and historical consensus values. Prunes inputs older than the configured window. Coordinates override application after consensus computation. Provides snapshot generation for full-state broadcasts to connected clients.

**5. OSC Bridge** (`src/osc/osc-bridge.ts`)

Bidirectional UDP communication with external synthesis engines — SuperCollider, Max/MSP, Pure Data, or any OSC-compatible software. Attaches to the Parameter Bus and automatically forwards consensus updates as OSC messages. Supports both individual messages and time-tagged bundles for sample-accurate multi-parameter updates. Handles incoming OSC messages (including a ping/pong heartbeat) and emits them as typed events for application-level handling.

**6. WebSocket Server** (`src/server.ts`)

Express + Socket.io server with two namespaces: `/audience` for audience connections and `/performer` for authenticated performer connections. Audience clients receive session state on connect and can submit parameter inputs and location updates. Performer clients authenticate via shared secret, receive full state including active overrides, and can issue overrides, session commands (start, pause, resume, end), and parameter locks. A consensus computation loop runs on a configurable interval (default: 50ms), broadcasting updated values to all connected clients.

### Type System

The codebase uses Zod for runtime validation alongside TypeScript's static type system. Key types include:

- **`AudienceInput`** — Normalized input with client ID, session ID, parameter reference, 0-1 value, optional spatial location, and metadata.
- **`WeightedInput`** — Extends `AudienceInput` with computed spatial, temporal, consensus, and composite weights.
- **`ConsensusResult`** — Computed value with confidence score, input count, raw and weighted means, standard deviation, and participation rate.
- **`PerformerOverride`** — Override specification with mode (absolute/blend/lock), optional blend factor, optional expiration timestamp.
- **`ParameterDefinition`** — Parameter metadata including category (mood, tempo, intensity, density, texture, harmony, rhythm, spatial, custom), value range, default value, controllability flags, and optional OSC address or MIDI CC mapping.
- **`VenueGeometry`** — Spatial model with dimensions, stage position, named zones with bounds and weight multipliers, and capacity.

---

## Installation & Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Redis (optional, for session persistence)

### Install

```bash
git clone https://github.com/organvm-ii-poiesis/core-engine.git
cd core-engine
npm install
```

### Development Mode (Hot Reload)

```bash
npm run dev
```

The server starts on `http://localhost:3000` with WebSocket endpoints at `/audience` and `/performer`.

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
# Build and run with Docker Compose
npm run docker:build
npm run docker:run
```

### Run Tests

```bash
npm test
```

### Benchmark Latency

```bash
npm run test:bench
```

---

## Working Examples

### Connect as Audience (Browser)

```typescript
import { io } from "socket.io-client";

// Connect to the audience namespace
const socket = io("ws://localhost:3000/audience", {
  query: { clientId: "my-unique-id" },
});

// Receive initial session state
socket.on("session:state", (state) => {
  console.log("Session:", state.sessionId);
  console.log("Parameters:", state.parameters.map((p) => p.name));
  console.log("Current values:", state.values);
});

// Send a parameter input (value must be 0.0 to 1.0)
socket.emit("input", { parameter: "mood", value: 0.8 });
socket.emit("input", { parameter: "intensity", value: 0.6 });

// Update your spatial location in the venue
socket.emit("location", { x: 45, y: 20, zone: "front" });

// Listen for consensus-computed value updates
socket.on("values", (values) => {
  console.log("Mood:", values.mood);
  console.log("Intensity:", values.intensity);
  console.log("Tempo:", values.tempo);
  console.log("Density:", values.density);
});

// Handle input rejection (rate limited, invalid, etc.)
socket.on("input:rejected", ({ reason }) => {
  console.warn("Input rejected:", reason);
});
```

### Connect as Performer

```typescript
import { io } from "socket.io-client";

const socket = io("ws://localhost:3000/performer", {
  query: { performerId: "performer-1", displayName: "Lead Artist" },
});

// Authenticate
socket.emit("auth", { secret: process.env.PERFORMER_SECRET });

socket.on("auth:success", ({ performerId }) => {
  console.log("Authenticated as", performerId);

  // Start the session
  socket.emit("session:start");
});

// Override a parameter (absolute mode — full performer control)
socket.emit("override", {
  parameter: "intensity",
  value: 1.0,
  mode: "absolute",
});

// Blend with audience (70% performer, 30% audience)
socket.emit("override", {
  parameter: "mood",
  value: 0.9,
  mode: "blend",
  blendFactor: 0.7,
});

// Timed lock: hold tempo for 30 seconds, then release
socket.emit("override", {
  parameter: "tempo",
  value: 0.85,
  mode: "lock",
  durationMs: 30000,
});

// Release an override back to audience control
socket.emit("override:clear", { parameter: "intensity" });

// Monitor full state including analytics
socket.on("snapshot", ({ timestamp, participants, values }) => {
  console.log(`[${new Date(timestamp).toISOString()}]`);
  console.log(`  Participants: ${participants}`);
  console.log(`  Values:`, values);
});
```

### Integrate with SuperCollider via OSC

```supercollider
// SuperCollider: receive consensus values from Core Engine
(
OSCdef(\mood, { |msg|
    ~mood = msg[1];
    ("Mood: " ++ ~mood).postln;
}, '/performance/mood');

OSCdef(\intensity, { |msg|
    ~intensity = msg[1];
    ("Intensity: " ++ ~intensity).postln;
}, '/performance/intensity');

OSCdef(\tempo, { |msg|
    ~tempo = msg[1];
    ("Tempo: " ++ ~tempo).postln;
}, '/performance/tempo');

OSCdef(\density, { |msg|
    ~density = msg[1];
    ("Density: " ++ ~density).postln;
}, '/performance/density');
)
```

---

## API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health, session ID, uptime, participant counts |
| `GET` | `/session` | Full session state: parameters, values, venue, bus stats |
| `GET` | `/values` | Current consensus values for all parameters |

### WebSocket Events — Audience (`/audience`)

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `session:state` | Server -> Client | `{ sessionId, status, parameters, values }` | Initial state on connect |
| `input` | Client -> Server | `{ parameter: string, value: number }` | Submit parameter input (0.0-1.0) |
| `location` | Client -> Server | `{ x: number, y: number, zone?: string }` | Update spatial position |
| `values` | Server -> Client | `Record<string, number>` | Consensus-computed values broadcast |
| `input:rejected` | Server -> Client | `{ reason: string }` | Input rejected (rate limit, invalid, etc.) |
| `error` | Server -> Client | `{ code: string, message: string }` | Session or server error |

### WebSocket Events — Performer (`/performer`)

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `auth` | Client -> Server | `{ secret: string }` | Authenticate with performer secret |
| `auth:success` | Server -> Client | `{ performerId }` | Authentication succeeded |
| `auth:failed` | Server -> Client | `{ reason: string }` | Authentication failed |
| `session:state` | Server -> Client | Full state including overrides and bus stats | Sent after auth success |
| `override` | Client -> Server | `{ parameter, value, mode, blendFactor?, durationMs? }` | Set parameter override |
| `override:success` | Server -> Client | `{ override }` | Override applied |
| `override:failed` | Server -> Client | `{ reason }` | Override rejected |
| `override:clear` | Client -> Server | `{ parameter }` | Release override |
| `session:start` | Client -> Server | — | Start the session |
| `session:pause` | Client -> Server | — | Pause the session |
| `session:resume` | Client -> Server | — | Resume the session |
| `session:end` | Client -> Server | — | End the session |
| `values` | Server -> Client | `Record<string, number>` | Consensus values broadcast |
| `snapshot` | Server -> Client | `{ timestamp, participants, values }` | Full analytics snapshot |

See [`docs/API.md`](./docs/API.md) for detailed payload schemas and error codes.

---

## Configuration

All configuration is environment-variable-driven with sensible defaults:

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP/WebSocket server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `CORS_ORIGINS` | `*` | Comma-separated allowed CORS origins |
| `LOG_LEVEL` | `info` | Logging level |

### WebSocket

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PING_INTERVAL` | `10000` | Ping interval (ms) |
| `WS_PING_TIMEOUT` | `5000` | Ping timeout (ms) |
| `WS_MAX_PAYLOAD` | `65536` | Maximum WebSocket payload size (bytes) |

### Consensus

| Variable | Default | Description |
|----------|---------|-------------|
| `CONSENSUS_INTERVAL_MS` | `50` | Consensus computation interval |
| `BROADCAST_INTERVAL_MS` | `50` | Value broadcast interval |
| `INPUT_WINDOW_MS` | `10000` | How long inputs remain in the aggregation window |
| `MAX_INPUTS_PER_CLIENT` | `100` | Maximum inputs before flood-block |
| `INPUT_RATE_LIMIT_MS` | `100` | Minimum interval between inputs per client |
| `WEIGHT_SPATIAL_ALPHA` | `0.3` | Spatial weighting coefficient |
| `WEIGHT_TEMPORAL_BETA` | `0.5` | Temporal weighting coefficient |
| `WEIGHT_CONSENSUS_GAMMA` | `0.2` | Consensus weighting coefficient |
| `SMOOTHING_FACTOR` | `0.3` | Exponential smoothing factor (0 = no change, 1 = instant) |

### OSC

| Variable | Default | Description |
|----------|---------|-------------|
| `OSC_ENABLED` | `true` | Enable/disable OSC bridge |
| `OSC_LOCAL_PORT` | `57121` | Local UDP port for receiving OSC messages |
| `OSC_REMOTE_HOST` | `127.0.0.1` | Target synthesis engine host |
| `OSC_REMOTE_PORT` | `57120` | Target synthesis engine port |
| `OSC_ADDRESS_PREFIX` | `/performance` | OSC address namespace prefix |

### Redis (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_ENABLED` | `false` | Enable Redis for session persistence |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `REDIS_PREFIX` | `ode:` | Key prefix for Redis entries |

### Session

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_PARTICIPANTS` | `1000` | Maximum concurrent audience connections |
| `SESSION_TIMEOUT_MS` | `3600000` | Session auto-end timeout (1 hour) |
| `INACTIVITY_TIMEOUT_MS` | `300000` | Inactivity timeout (5 minutes) |
| `RECORDING_ENABLED` | `true` | Record all performance events |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `PERFORMER_SECRET` | `dev-secret-change-me` | Shared secret for performer auth |
| `ADMIN_SECRET` | `admin-secret-change-me` | Admin authentication secret |
| `JWT_SECRET` | `jwt-secret-change-me` | JWT signing secret |
| `JWT_EXPIRY` | `24h` | JWT token expiration |

### Genre Presets

Built-in weighting presets for common performance contexts:

| Genre | Spatial (alpha) | Temporal (beta) | Consensus (gamma) | Character |
|-------|----------------|-----------------|-------------------|-----------|
| Electronic Music | 0.3 | 0.5 | 0.2 | Fast response, recency-dominant |
| Ballet | 0.5 | 0.2 | 0.3 | Spatial awareness, slow consensus |
| Opera | 0.2 | 0.3 | 0.5 | Agreement-dominant, collective will |
| Installation | 0.7 | 0.1 | 0.2 | Spatial-dominant, slow evolution |
| Theatre | 0.4 | 0.3 | 0.3 | Balanced, moderate response |

---

## Theory Implemented from ORGAN-I

Core Engine translates several theoretical frameworks from [ORGAN-I (Theoria)](https://github.com/organvm-i-theoria) into working software:

**Recursive feedback loops.** The consensus computation creates a feedback loop between audience, consensus engine, performer, synthesis output, and back to audience (who hear/see the result and adjust their inputs). This is a direct implementation of the recursive self-observation patterns explored in ORGAN-I's [recursive-engine](https://github.com/organvm-i-theoria/recursive-engine). The system observes its observers and is shaped by being shaped.

**Weighted epistemology.** The three-factor weighting model (spatial, temporal, consensus) is an implementation of situated knowledge — the idea that what you know depends on where you stand, when you engage, and who agrees with you. These are not neutral mathematical choices; they encode an epistemological position about how collective meaning emerges from distributed, embodied, temporally-situated agents.

**Emergence from constraint.** The parameter space is deliberately limited to four default parameters (mood, tempo, intensity, density) with values normalized to 0-1. This constraint is generative: it forces the audience to express complex artistic intentions through a simple vocabulary, and forces the consensus engine to find signal in noise. The resulting emergent behavior — cluster formation, bimodal splits, entropy spikes — is more interesting than what any individual participant intended.

**Authority preservation.** The performer override system implements a theory of creative authority: collective participation enriches art but does not replace artistic judgment. The three override modes (absolute, blend, lock) give performers a gradient of control, from full surrender to audience will, through negotiated blending, to complete autonomous authority. This maps to ORGAN-I's framework for balancing distributed and centralized governance.

---

## Cross-Organ Context

Core Engine sits at the center of the ORGAN-II constellation:

| Repository | Relationship |
|-----------|-------------|
| [metasystem-master](https://github.com/organvm-ii-poiesis/metasystem-master) | Flagship monorepo; Core Engine is a primary subsystem |
| [a-mavs-olevm](https://github.com/organvm-ii-poiesis/a-mavs-olevm) | Visual generation layer that consumes Core Engine parameters |
| [virgil-training-overlay](https://github.com/organvm-iii-ergon/virgil-training-overlay) | ORGAN-III product that may expose Core Engine functionality to end users |
| [recursive-engine](https://github.com/organvm-i-theoria/recursive-engine) | ORGAN-I theoretical framework that Core Engine implements |
| [agentic-titan](https://github.com/organvm-iv-taxis/agentic-titan) | ORGAN-IV orchestration layer for multi-organ coordination |

**Dependency direction:** ORGAN-I (theory) -> ORGAN-II (art) -> ORGAN-III (product). Core Engine consumes theoretical frameworks from ORGAN-I and is consumed by product layers in ORGAN-III. No reverse dependencies exist.

---

## Performance Benchmarks

Proof-of-concept benchmarks (validated on Apple Silicon M3, Node.js 20):

| Metric | Value | Notes |
|--------|-------|-------|
| P95 consensus latency | **< 2ms** | 1,000 simultaneous inputs |
| P99 consensus latency | **< 5ms** | 1,000 simultaneous inputs |
| WebSocket broadcast latency | **< 3ms** | 500 connected clients |
| Consensus computation interval | **50ms** | 20 consensus cycles/second |
| Max tested audience connections | **1,000** | Single server instance |
| Input throughput | **10,000 inputs/sec** | Before rate limiting |
| Memory usage (idle) | **~45MB** | Node.js process baseline |
| Memory usage (1000 clients) | **~120MB** | With active consensus |

---

## Deployment

### Docker (Recommended)

```bash
docker build -t core-engine:latest -f docker/Dockerfile .
docker-compose -f docker/docker-compose.yml up
```

### Environment Setup

Create a `.env` file for production:

```bash
NODE_ENV=production
PORT=3000
PERFORMER_SECRET=your-secure-secret-here
ADMIN_SECRET=your-admin-secret-here
JWT_SECRET=your-jwt-secret-here
REDIS_ENABLED=true
REDIS_URL=redis://your-redis-host:6379
OSC_ENABLED=true
OSC_REMOTE_HOST=your-synth-host
OSC_REMOTE_PORT=57120
CORS_ORIGINS=https://your-frontend.com
MAX_PARTICIPANTS=500
```

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for full production deployment instructions including reverse proxy configuration, SSL termination, and scaling considerations.

---

## Related Work

Core Engine draws inspiration from and differentiates itself against:

- **[Audience Participation Systems in HCI Research](https://dl.acm.org/doi/10.1145/3491102.3517456)** — Academic work on crowd-sourced interaction; Core Engine adds real-time weighted consensus and performer authority.
- **[Open Sound Control (OSC)](http://opensoundcontrol.org/)** — The communication protocol used for synthesis engine integration.
- **[Reactable](http://reactable.com/)** — Tangible interface for collaborative music; Core Engine extends the concept to distributed mobile audiences.
- **[Ars Electronica's Deep Space](https://ars.electronica.art/center/en/exhibitions/deepspace/)** — Immersive audience environments; Core Engine provides the parameter routing layer such installations need.

---

## Contributing

Core Engine is in proof-of-concept stage moving toward alpha. Contributions welcome in these areas:

1. **Frontend clients** — Web/mobile interfaces for audience participation
2. **Synthesis patches** — SuperCollider, Max/MSP, Pure Data patches that consume Core Engine parameters
3. **Venue configurations** — Real venue geometry definitions for spatial weighting
4. **Performance recordings** — Documentation and recording of live tests
5. **Benchmark improvements** — Latency optimization and load testing at scale

Please open an issue before submitting a pull request to discuss the approach.

---

## License

[MIT](./LICENSE) — Anthony Padavano

---

## Author

**Anthony Padavano** ([@4444j99](https://github.com/4444j99))

Core Engine is part of the [organvm](https://github.com/meta-organvm) system — an eight-organ creative-institutional architecture coordinating theory, art, commerce, orchestration, public process, community, and distribution.

*The audience is not a crowd. It is a collective instrument waiting to be played.*
