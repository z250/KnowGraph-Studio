import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getConfig } from './config.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const config = getConfig();
    this.client = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
