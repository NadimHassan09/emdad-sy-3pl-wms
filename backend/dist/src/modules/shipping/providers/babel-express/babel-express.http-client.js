"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var BabelExpressHttpClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabelExpressHttpClient = exports.BabelApiError = exports.BABEL_BASE_URL = void 0;
const common_1 = require("@nestjs/common");
exports.BABEL_BASE_URL = 'https://www.babel-express.com/api/v1/webservice.php';
class BabelApiError extends Error {
    statusCode;
    body;
    constructor(message, statusCode, body) {
        super(message);
        this.statusCode = statusCode;
        this.body = body;
        this.name = 'BabelApiError';
    }
}
exports.BabelApiError = BabelApiError;
let BabelExpressHttpClient = BabelExpressHttpClient_1 = class BabelExpressHttpClient {
    logger = new common_1.Logger(BabelExpressHttpClient_1.name);
    async post(action, credentials, body = {}) {
        const url = `${exports.BABEL_BASE_URL}/${action.replace(/^\//, '')}`;
        const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body ?? {}),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Babel ${action} network error: ${msg}`);
            throw new BabelApiError(`Babel Express unreachable: ${msg}`);
        }
        let json;
        try {
            json = await res.json();
        }
        catch {
            throw new BabelApiError(`Babel Express returned non-JSON (HTTP ${res.status}).`, res.status);
        }
        const record = json && typeof json === 'object' ? json : null;
        if (record?.status === 'error') {
            const errorMessage = typeof record.errorMessage === 'string' && record.errorMessage.trim()
                ? record.errorMessage.trim()
                : 'Babel Express request failed.';
            throw new BabelApiError(errorMessage, res.status, json);
        }
        if (!res.ok) {
            throw new BabelApiError(`Babel Express HTTP ${res.status}`, res.status, json);
        }
        return json;
    }
};
exports.BabelExpressHttpClient = BabelExpressHttpClient;
exports.BabelExpressHttpClient = BabelExpressHttpClient = BabelExpressHttpClient_1 = __decorate([
    (0, common_1.Injectable)()
], BabelExpressHttpClient);
//# sourceMappingURL=babel-express.http-client.js.map