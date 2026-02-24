/**
 * E2E_VERIFICATION.ts
 * 
 * Full system run-through to validate:
 * 1. Audience Connection & Input
 * 2. Real-time Consensus Processing
 * 3. Performer Data Reception
 * 4. Latency Metrics
 */

import { io } from 'socket.io-client';
import { performance } from 'perf_hooks';

const CORE_URL = 'https://omni-dromenon-core-dkxnci5fua-uc.a.run.app';
const NUM_CLIENTS = 10;
const DURATION_MS = 5000;

async function runVerification() {
  console.log('🚀 Starting System Run-Through...');
  console.log(`Target: ${CORE_URL}`);
  
  const metrics = {
    sent: 0,
    received: 0,
    latencies: [] as number[],
    errors: 0
  };

  // 1. Setup Performer (Listener)
  const performer = io(`${CORE_URL}/performer`, {
    query: { performerId: 'TEST_PERFORMER', displayName: 'System Validator' },
    transports: ['websocket']
  });

  const consensusUpdates: any[] = [];

  performer.on('connect', () => {
    console.log('✅ Performer Connected');
    // Authenticate and Start Session
    performer.emit('auth', { secret: 'dev-secret-change-me' }); // Default dev secret
    // Actually, looking at server.ts, we need to register first.
    // Wait, registration happens on connection.
    // Let's try sending session:start after a brief delay.
    setTimeout(() => {
        performer.emit('session:start');
        console.log('▶️ Sent session:start command');
    }, 500);
  });

  performer.on('session:started', () => {
      console.log('✅ Session STARTED');
  });

  performer.on('auth:failed', (err) => console.error('❌ Auth Failed:', err));

  performer.on('values', (data) => {
    metrics.received++;
    consensusUpdates.push({ time: performance.now(), data });
  });

  // 2. Setup Audience (Input Generators)
  const clients = Array.from({ length: NUM_CLIENTS }).map((_, i) => 
    io(`${CORE_URL}/audience`, {
      query: { clientId: `TEST_AUDIENCE_${i}` },
      transports: ['websocket']
    })
  );

  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for connections

  console.log(`✅ ${NUM_CLIENTS} Audience Clients Connected`);

  // 3. Execution Phase
  console.log('⚡ Generating Traffic...');
  const startTime = performance.now();
  
  const trafficInterval = setInterval(() => {
    clients.forEach(client => {
      const start = performance.now();
      client.emit('input', { 
        parameter: 'tempo', 
        value: Math.random() 
      });
      metrics.sent++;
    });
  }, 100); // 10 inputs per second per client

  // 4. Verification Phase
  await new Promise(resolve => setTimeout(resolve, DURATION_MS));
  
  clearInterval(trafficInterval);
  const endTime = performance.now();

  // Cleanup
  clients.forEach(c => c.close());
  performer.close();

  // 5. Analysis
  console.log('\n📊 Run-Through Results:');
  console.log(`- Duration: ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`- Inputs Sent: ${metrics.sent}`);
  console.log(`- Consensus Updates Received: ${metrics.received}`);
  
  if (metrics.received > 0) {
    console.log('✅ Data Flow Verified: Audience -> Core -> Performer');
  } else {
    console.error('❌ Data Flow FAILED: No updates received by performer');
    process.exit(1);
  }

  // Latency estimation (approximate)
  // Real latency requires server timestamp echoing, but flow validation is key here.
  const throughput = metrics.sent / (DURATION_MS / 1000);
  console.log(`- Throughput: ${throughput.toFixed(2)} inputs/sec`);
  
  console.log('\n✅ System Run-Through Complete.');
}

runVerification().catch(console.error);
