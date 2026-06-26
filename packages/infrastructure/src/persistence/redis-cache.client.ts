import type { Redis } from 'ioredis';
import type { CacheClient } from './clients.js';

export class RedisCacheClient implements CacheClient {
  constructor(private readonly redis: Redis) {}

  ping(): Promise<string> {
    return this.redis.ping();
  }
}
