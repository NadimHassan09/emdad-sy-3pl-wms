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
exports.FormsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const public_decorator_1 = require("../../common/auth/public.decorator");
const super_admin_guard_1 = require("../../common/auth/super-admin.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_lead_form_dto_1 = require("./dto/create-lead-form.dto");
const list_lead_forms_query_dto_1 = require("./dto/list-lead-forms-query.dto");
const forms_service_1 = require("./forms.service");
let FormsController = class FormsController {
    forms;
    constructor(forms) {
        this.forms = forms;
    }
    submit(dto, req) {
        return this.forms.submit(dto, {
            ip: req.ip,
            origin: req.headers.origin ?? undefined,
        });
    }
    list(user, query) {
        return this.forms.list(user, query);
    }
    activityTypes() {
        return this.forms.activityTypes();
    }
    findOne(id) {
        return this.forms.findById(id);
    }
    remove(user, id) {
        return this.forms.remove(id, user);
    }
};
exports.FormsController = FormsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('submit'),
    (0, common_1.HttpCode)(201),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lead_form_dto_1.CreateLeadFormDto, Object]),
    __metadata("design:returntype", void 0)
], FormsController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_lead_forms_query_dto_1.ListLeadFormsQueryDto]),
    __metadata("design:returntype", void 0)
], FormsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('activity-types'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FormsController.prototype, "activityTypes", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FormsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FormsController.prototype, "remove", null);
exports.FormsController = FormsController = __decorate([
    (0, common_1.Controller)('forms'),
    __metadata("design:paramtypes", [forms_service_1.FormsService])
], FormsController);
//# sourceMappingURL=forms.controller.js.map