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
exports.UserActivityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const PERSIST_INTERVAL_MS = 90_000;
let UserActivityService = class UserActivityService {
    prisma;
    lastPersistMs = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    touch(userId) {
        const now = Date.now();
        const prev = this.lastPersistMs.get(userId) ?? 0;
        if (now - prev < PERSIST_INTERVAL_MS)
            return;
        this.lastPersistMs.set(userId, now);
        void this.prisma.user
            .update({
            where: { id: userId },
            data: { lastActivityAt: new Date() },
        })
            .catch(() => {
            this.lastPersistMs.delete(userId);
        });
    }
};
exports.UserActivityService = UserActivityService;
exports.UserActivityService = UserActivityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserActivityService);
//# sourceMappingURL=user-activity.service.js.map