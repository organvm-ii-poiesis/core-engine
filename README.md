# Core Engine

The computational heart of the Omni-Dromenon-Engine. Real-time WebSocket server with weighted consensus for audience inputs and parameter distribution to performers.

## Status

**Current:** Proof-of-concept validated (P95 latency: 2ms)  
**Target:** Alpha release Q2 2025

## Architecture

```
core-engine/
├── src/
│   ├── consensus/     → Weighted voting, parameter aggregation
│   ├── bus/           → Parameter routing, pub/sub
│   ├── osc/           → OSC bridge for external synthesizers
│   ├── server/        → Express + Socket.io
│   ├── types/         → Shared TypeScript interfaces
│   └── middleware/    → Auth, rate limiting, validation
├── tests/             → Unit + integration tests
├── benchmarks/        → Latency benchmarks
└── docker/            → Container deployment
```

## Quick Start

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Production build
npm run build && npm start

# Run tests
npm test

# Benchmark latency
npm run test:bench
```

## Core Concepts

**Parameter Bus**: Event-driven pub/sub for real-time parameter updates

**Weighted Consensus**: Aggregates audience inputs using temporal decay + proximity weighting

**Performer Override**: Authority preservation—performers can override any parameter at any time

## API

See [docs/API.md](./docs/API.md) for WebSocket events and REST endpoints.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `REDIS_URL` | localhost:6379 | Session state store |
| `OSC_OUT_PORT` | 57121 | OSC output port |
| `CONSENSUS_WINDOW_MS` | 1000 | Voting window duration |

## License

MIT © Anthony Padavano
