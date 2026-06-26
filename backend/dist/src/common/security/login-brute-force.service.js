"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginBruteForceService = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("../audit/audit-log.service");
const MAX_FAILURES = 5;
const WINDOW_MS = 60_000;
let LoginBruteForceService = class LoginBruteForceService {
    audit;
    buckets = new Map();
    constructor(audit) {
        this.audit = audit;
    }
    assertAllowed(portal, ip) {
        if (this.failureCount(portal, ip) >= MAX_FAILURES) {
            throw new common_1.HttpException({
                code: 'TOO_MANY_REQUESTS',
                message: 'Too many failed sign-in attempts. Please wait about a minute before trying again.',
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    recordFailure(portal, ctx) {
        const key = this.key(portal, ctx.ipAddress);
        const now = Date.now();
        const bucket = this.pruneBucket(key, now);
        bucket.failures.push(now);
        this.buckets.set(key, bucket);
        const blocked = bucket.failures.length >= MAX_FAILURES;
        if (blocked) {
            void this.audit.logBestEffort({
                actorId: null,
                actorEmail: ctx.email?.trim().toLowerCase() ?? 'anonymous',
                actorName: 'Login rate limit',
                actorRole: 'anonymous',
                companyId: null,
                action: 'SECURITY_LOGIN_RATE_LIMITED',
                resourceType: 'security',
                resourceId: ctx.ipAddress,
                ipAddress: ctx.ipAddress,
                userAgent: ctx.userAgent ?? null,
                newState: {
                    portal,
                    failures: bucket.failures.length,
                    windowSec: WINDOW_MS / 1000,
                    email: ctx.email?.trim().toLowerCase() ?? null,
                },
            });
        }
        return blocked;
    }
    recordSuccess(portal, ip) {
        this.buckets.delete(this.key(portal, ip));
    }
    failureCount(portal, ip) {
        return this.pruneBucket(this.key(portal, ip), Date.now()).failures.length;
    }
    reset(portal, ip) {
        if (!portal) {
            this.buckets.clear();
            return;
        }
        if (!ip) {
            for (const key of [...this.buckets.keys()]) {
                if (key.startsWith(`${portal}:`))
                    this.buckets.delete(key);
            }
            return;
        }
        this.buckets.delete(this.key(portal, ip));
    }
    key(portal, ip) {
        return `${portal}:${ip || 'unknown'}`;
    }
    pruneBucket(key, now) {
        const existing = this.buckets.get(key);
        const cutoff = now - WINDOW_MS;
        const failures = (existing?.failures ?? []).filter((ts) => ts > cutoff);
        const bucket = { failures };
        if (failures.length === 0) {
            this.buckets.delete(key);
        }
        else {
            this.buckets.set(key, bucket);
        }
        return bucket;
    }
};
exports.LoginBruteForceService = LoginBruteForceService;
exports.LoginBruteForceService = LoginBruteForceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], LoginBruteForceService);
//# sourceMappingURL=login-brute-force.service.js.map