import { HttpException } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service';
import { LoginBruteForceService } from './login-brute-force.service';

describe('LoginBruteForceService', () => {
  const audit = {
    logBestEffort: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditLogService;

  let service: LoginBruteForceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoginBruteForceService(audit);
  });

  it('allows attempts until five failures in the window', () => {
    const ip = '203.0.113.10';
    for (let i = 0; i < 4; i++) {
      expect(() => service.assertAllowed('internal', ip)).not.toThrow();
      service.recordFailure('internal', { ipAddress: ip, email: 'a@example.com' });
    }
    expect(service.failureCount('internal', ip)).toBe(4);
    expect(() => service.assertAllowed('internal', ip)).not.toThrow();
  });

  it('blocks after five failures and emits audit once', () => {
    const ip = '203.0.113.11';
    for (let i = 0; i < 5; i++) {
      service.recordFailure('internal', { ipAddress: ip, email: 'a@example.com' });
    }
    expect(() => service.assertAllowed('internal', ip)).toThrow(HttpException);
    expect(audit.logBestEffort).toHaveBeenCalledTimes(1);
    expect(audit.logBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SECURITY_LOGIN_RATE_LIMITED' }),
    );
  });

  it('clears failures after successful login', () => {
    const ip = '203.0.113.12';
    service.recordFailure('client', { ipAddress: ip });
    service.recordFailure('client', { ipAddress: ip });
    service.recordSuccess('client', ip);
    expect(service.failureCount('client', ip)).toBe(0);
  });
});
