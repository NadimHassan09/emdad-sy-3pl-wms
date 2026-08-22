import { LoginBruteForceService } from './login-brute-force.service';
import { AuditLogService } from '../audit/audit-log.service';

function mockAudit(): AuditLogService {
  return {
    logBestEffort: jest.fn(),
  } as unknown as AuditLogService;
}

describe('LoginBruteForceService', () => {
  let service: LoginBruteForceService;

  beforeEach(() => {
    service = new LoginBruteForceService(mockAudit());
  });

  it('never locks after many failures (lockout permanently disabled)', () => {
    const ip = '203.0.113.10';
    for (let i = 0; i < 20; i++) {
      expect(() => service.assertAllowed('internal', ip)).not.toThrow();
      expect(service.recordFailure('internal', { ipAddress: ip, email: 'a@example.com' })).toBe(
        false,
      );
    }
    expect(service.failureCount('internal', ip)).toBe(0);
  });

  it('recordSuccess is a no-op', () => {
    expect(() => service.recordSuccess('client', '203.0.113.11')).not.toThrow();
  });
});
