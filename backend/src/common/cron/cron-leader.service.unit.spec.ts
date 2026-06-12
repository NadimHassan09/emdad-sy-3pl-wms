import { ConfigService } from '@nestjs/config';

import { CronLeaderService } from './cron-leader.service';
import { RedisService } from '../redis/redis.service';

function buildService(
  redis: Partial<RedisService>,
  env: Record<string, string> = {},
): CronLeaderService {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new CronLeaderService(redis as RedisService, config);
}

describe('CronLeaderService', () => {
  const originalInstance = process.env.NODE_APP_INSTANCE;

  afterEach(() => {
    if (originalInstance === undefined) delete process.env.NODE_APP_INSTANCE;
    else process.env.NODE_APP_INSTANCE = originalInstance;
  });

  it('runs job when leader lock acquired via Redis', async () => {
    process.env.NODE_APP_INSTANCE = '0';
    const token = `0:${process.pid}`;
    const redis = {
      isEnabled: () => true,
      setNx: jest.fn().mockResolvedValue(true),
      getString: jest.fn().mockResolvedValue(token),
      expire: jest.fn(),
      del: jest.fn(),
    };
    const service = buildService(redis);
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await service.runExclusive('test-job', 60, fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(redis.setNx).toHaveBeenCalledWith('cron:lock:test-job', expect.any(String), 60);
    expect(redis.del).toHaveBeenCalledWith('cron:lock:test-job');
  });

  it('skips job when another worker holds the lock', async () => {
    const redis = {
      isEnabled: () => true,
      setNx: jest.fn().mockResolvedValue(false),
      getString: jest.fn().mockResolvedValue('1:9999'),
      expire: jest.fn(),
      del: jest.fn(),
    };
    process.env.NODE_APP_INSTANCE = '0';
    const service = buildService(redis);
    const fn = jest.fn();

    const result = await service.runExclusive('test-job', 60, fn);

    expect(result).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('uses instance 0 fallback when Redis is disabled', async () => {
    process.env.NODE_APP_INSTANCE = '0';
    const redis = { isEnabled: () => false };
    const service = buildService(redis, { CRON_LEADER_ENABLED: 'true' });
    const fn = jest.fn().mockResolvedValue(1);

    await expect(service.runExclusive('daily-job', 60, fn)).resolves.toBe(1);
    expect(fn).toHaveBeenCalled();
  });

  it('skips non-primary instance when Redis is disabled', async () => {
    process.env.NODE_APP_INSTANCE = '2';
    const redis = { isEnabled: () => false };
    const service = buildService(redis, { CRON_LEADER_ENABLED: 'true' });
    const fn = jest.fn();

    await expect(service.runExclusive('daily-job', 60, fn)).resolves.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs on all instances when CRON_LEADER_ENABLED=false', async () => {
    process.env.NODE_APP_INSTANCE = '3';
    const redis = { isEnabled: () => false };
    const service = buildService(redis, { CRON_LEADER_ENABLED: 'false' });
    const fn = jest.fn().mockResolvedValue(true);

    await expect(service.runExclusive('dev-job', 60, fn)).resolves.toBe(true);
    expect(fn).toHaveBeenCalled();
  });
});
