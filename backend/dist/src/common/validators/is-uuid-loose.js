"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsUuidLoose = IsUuidLoose;
const class_validator_1 = require("class-validator");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function IsUuidLoose(validationOptions) {
    return (0, class_validator_1.ValidateBy)({
        name: 'isUuidLoose',
        validator: {
            validate: (value) => typeof value === 'string' && UUID_RE.test(value),
            defaultMessage: (0, class_validator_1.buildMessage)((eachPrefix) => `${eachPrefix}$property must be a UUID`, validationOptions),
        },
    }, validationOptions);
}
//# sourceMappingURL=is-uuid-loose.js.map