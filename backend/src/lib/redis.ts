import { Redis } from 'ioredis';

export type { Redis };

export function createRedis(url: string, onError: (err: Error) => void = () => undefined): Redis {
  const redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  redis.on('error', onError); // ioredis reconnects by itself; just record the failure
  return redis;
}
