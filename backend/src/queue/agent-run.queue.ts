import { Queue } from 'bullmq';
import type Redis from 'ioredis';

let _queue: Queue | null = null;

export function getAgentRunQueue(redis: Redis): Queue {
  if (_queue) return _queue;
  _queue = new Queue('agent-run', {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100, age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
  return _queue;
}
