"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const crypto_module_1 = require("./common/crypto/crypto.module");
const prisma_module_1 = require("./common/prisma/prisma.module");
const redis_module_1 = require("./common/redis/redis.module");
const adjustments_module_1 = require("./modules/adjustments/adjustments.module");
const auth_module_1 = require("./modules/auth/auth.module");
const jwt_auth_guard_1 = require("./modules/auth/guards/jwt-auth.guard");
const client_portal_module_1 = require("./modules/client-portal/client-portal.module");
const companies_module_1 = require("./modules/companies/companies.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const inbound_module_1 = require("./modules/inbound/inbound.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const locations_module_1 = require("./modules/locations/locations.module");
const outbound_module_1 = require("./modules/outbound/outbound.module");
const products_module_1 = require("./modules/products/products.module");
const users_module_1 = require("./modules/users/users.module");
const warehouses_module_1 = require("./modules/warehouses/warehouses.module");
const warehouse_workflow_module_1 = require("./modules/warehouse-workflow/warehouse-workflow.module");
const realtime_module_1 = require("./modules/realtime/realtime.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            schedule_1.ScheduleModule.forRoot(),
            crypto_module_1.CryptoModule,
            auth_module_1.AuthModule,
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            companies_module_1.CompaniesModule,
            dashboard_module_1.DashboardModule,
            client_portal_module_1.ClientPortalModule,
            users_module_1.UsersModule,
            products_module_1.ProductsModule,
            warehouses_module_1.WarehousesModule,
            locations_module_1.LocationsModule,
            inventory_module_1.InventoryModule,
            inbound_module_1.InboundModule,
            outbound_module_1.OutboundModule,
            adjustments_module_1.AdjustmentsModule,
            warehouse_workflow_module_1.WarehouseWorkflowModule,
            realtime_module_1.RealtimeModule,
        ],
        providers: [{ provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard }],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map