import { createClient } from 'redis';
import { MetasystemEvent } from '../types/metasystem.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CHANNEL = 'metasystem:events';

export class SystemBus {
  private publisher;
  private subscriber;

  constructor() {
    this.publisher = createClient({ url: REDIS_URL });
    this.subscriber = this.publisher.duplicate();

    this.publisher.on('error', (err) => console.error('Redis Pub Error:', err));
    this.subscriber.on('error', (err) => console.error('Redis Sub Error:', err));
  }

  async connect() {
    await this.publisher.connect();
    await this.subscriber.connect();
    console.log('🔗 System Bus Connected');
  }

  async publish(event: MetasystemEvent) {
    try {
      await this.publisher.publish(CHANNEL, JSON.stringify(event));
      // console.log(`📤 Event Published: ${event.type}`);
    } catch (err) {
      console.error('Failed to publish event:', err);
    }
  }

  async subscribe(handler: (event: MetasystemEvent) => void) {
    await this.subscriber.subscribe(CHANNEL, (message) => {
      try {
        const event = JSON.parse(message) as MetasystemEvent;
        handler(event);
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    });
  }
}

export const systemBus = new SystemBus();
