"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ApplicationLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationLifecycleService = void 0;
const common_1 = require("@nestjs/common");
let ApplicationLifecycleService = ApplicationLifecycleService_1 = class ApplicationLifecycleService {
    log = new common_1.Logger(ApplicationLifecycleService_1.name);
    ready = false;
    shuttingDown = false;
    markReady() {
        this.ready = true;
        this.shuttingDown = false;
        this.log.log(`Application ready (pid=${process.pid}, instance=${this.instanceId()}).`);
    }
    markShuttingDown(reason) {
        if (this.shuttingDown)
            return;
        this.shuttingDown = true;
        this.ready = false;
        this.log.warn(`Draining traffic${reason ? ` (${reason})` : ''} pid=${process.pid} instance=${this.instanceId()}.`);
    }
    isAcceptingTraffic() {
        return this.ready && !this.shuttingDown;
    }
    isShuttingDown() {
        return this.shuttingDown;
    }
    instanceId() {
        return process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? '0';
    }
    clusterInfo() {
        return {
            pid: process.pid,
            instanceId: this.instanceId(),
            acceptingTraffic: this.isAcceptingTraffic(),
            shuttingDown: this.shuttingDown,
        };
    }
    onApplicationShutdown(signal) {
        this.markShuttingDown(signal ?? 'application_shutdown');
    }
};
exports.ApplicationLifecycleService = ApplicationLifecycleService;
exports.ApplicationLifecycleService = ApplicationLifecycleService = ApplicationLifecycleService_1 = __decorate([
    (0, common_1.Injectable)()
], ApplicationLifecycleService);
//# sourceMappingURL=application-lifecycle.service.js.map