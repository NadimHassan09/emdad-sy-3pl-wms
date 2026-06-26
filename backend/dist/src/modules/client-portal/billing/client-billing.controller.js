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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientBillingController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const client_billing_service_1 = require("./client-billing.service");
let ClientBillingController = class ClientBillingController {
    billing;
    constructor(billing) {
        this.billing = billing;
    }
    access(client) {
        return this.billing.getAccess(client);
    }
    summary(client) {
        return this.billing.getSummary(client);
    }
    listInvoices(client, limit, offset, status) {
        const parsedLimit = limit != null ? Number(limit) : undefined;
        const parsedOffset = offset != null ? Number(offset) : undefined;
        if (parsedLimit != null || parsedOffset != null || status) {
            return this.billing.listInvoicesPage(client, {
                limit: Number.isFinite(parsedLimit) ? parsedLimit : 50,
                offset: Number.isFinite(parsedOffset) ? parsedOffset : 0,
                status,
            });
        }
        return this.billing.listInvoices(client);
    }
    getInvoice(client, id) {
        return this.billing.getInvoice(client, id);
    }
};
exports.ClientBillingController = ClientBillingController;
__decorate([
    (0, common_1.Get)('access'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientBillingController.prototype, "access", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClientBillingController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('invoices'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], ClientBillingController.prototype, "listInvoices", null);
__decorate([
    (0, common_1.Get)('invoices/:id'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientBillingController.prototype, "getInvoice", null);
exports.ClientBillingController = ClientBillingController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client/billing'),
    __metadata("design:paramtypes", [client_billing_service_1.ClientBillingService])
], ClientBillingController);
//# sourceMappingURL=client-billing.controller.js.map