"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseUuidLoosePipe = void 0;
const common_1 = require("@nestjs/common");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let ParseUuidLoosePipe = class ParseUuidLoosePipe {
    transform(value, metadata) {
        if (typeof value !== 'string' || !UUID_RE.test(value)) {
            const name = metadata.data ?? 'value';
            throw new common_1.BadRequestException(`${name} must be a UUID`);
        }
        return value;
    }
};
exports.ParseUuidLoosePipe = ParseUuidLoosePipe;
exports.ParseUuidLoosePipe = ParseUuidLoosePipe = __decorate([
    (0, common_1.Injectable)()
], ParseUuidLoosePipe);
//# sourceMappingURL=parse-uuid-loose.pipe.js.map