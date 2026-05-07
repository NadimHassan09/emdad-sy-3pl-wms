"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateSocketConnection = authenticateSocketConnection;
exports.isValidCompanyRoomId = isValidCompanyRoomId;
const client_1 = require("@prisma/client");
const jwt = __importStar(require("jsonwebtoken"));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ROLES = [client_1.UserRole.client_admin, client_1.UserRole.client_staff];
function tryVerify(token, secret) {
    try {
        const p = jwt.verify(token, secret);
        if (typeof p === 'string' || !p || typeof p !== 'object')
            return null;
        return p;
    }
    catch {
        return null;
    }
}
async function authenticateSocketConnection(config, prisma, token) {
    const internalSecret = config.get('JWT_SECRET') ?? 'dev-only-change-in-production';
    const clientSecret = config.get('CLIENT_JWT_SECRET') ?? config.get('JWT_SECRET') ?? internalSecret;
    const internalPayload = tryVerify(token, internalSecret);
    if (internalPayload?.sub && internalPayload.typ !== 'client') {
        const user = await prisma.user.findUnique({
            where: { id: String(internalPayload.sub) },
            select: { id: true, role: true, status: true, companyId: true, email: true },
        });
        if (!user || user.status !== client_1.UserStatus.active)
            return null;
        if (user.companyId !== null || CLIENT_ROLES.includes(user.role))
            return null;
        return {
            kind: 'internal',
            userId: user.id,
            role: user.role,
            email: user.email,
        };
    }
    const clientPayload = tryVerify(token, clientSecret);
    if (clientPayload?.sub && clientPayload.typ === 'client') {
        const companyId = typeof clientPayload.companyId === 'string' ? clientPayload.companyId : '';
        if (!UUID_RE.test(companyId))
            return null;
        const user = await prisma.user.findUnique({
            where: { id: String(clientPayload.sub) },
            select: { id: true, role: true, status: true, companyId: true, email: true },
        });
        if (!user || user.status !== client_1.UserStatus.active)
            return null;
        if (user.companyId === null || !CLIENT_ROLES.includes(user.role))
            return null;
        if (user.companyId !== companyId)
            return null;
        return {
            kind: 'client',
            userId: user.id,
            companyId: user.companyId,
            role: user.role,
            email: user.email,
        };
    }
    return null;
}
function isValidCompanyRoomId(companyId) {
    return typeof companyId === 'string' && UUID_RE.test(companyId.trim());
}
//# sourceMappingURL=realtime-socket-auth.js.map