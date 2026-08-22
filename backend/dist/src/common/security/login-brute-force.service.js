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
var LoginBruteForceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginBruteForceService = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("../audit/audit-log.service");
let LoginBruteForceService = LoginBruteForceService_1 = class LoginBruteForceService {
    log = new common_1.Logger(LoginBruteForceService_1.name);
    constructor(_audit) {
        this.log.warn('Login brute-force lockout is permanently DISABLED.');
    }
    assertAllowed(_portal, _ip) {
    }
    recordFailure(_portal, _ctx) {
        return false;
    }
    recordSuccess(_portal, _ip) {
    }
    failureCount(_portal, _ip) {
        return 0;
    }
    reset(_portal, _ip) {
    }
};
exports.LoginBruteForceService = LoginBruteForceService;
exports.LoginBruteForceService = LoginBruteForceService = LoginBruteForceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], LoginBruteForceService);
//# sourceMappingURL=login-brute-force.service.js.map