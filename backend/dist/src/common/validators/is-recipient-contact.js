"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsRecipientName = IsRecipientName;
exports.IsRecipientPhone = IsRecipientPhone;
const class_validator_1 = require("class-validator");
const recipient_contact_1 = require("./recipient-contact");
function IsRecipientName(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isRecipientName',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value) {
                    if (value == null || value === '')
                        return true;
                    if (typeof value !== 'string')
                        return false;
                    return (0, recipient_contact_1.isValidRecipientName)(value);
                },
                defaultMessage() {
                    return 'Name can only contain Arabic or English letters and spaces.';
                },
            },
        });
    };
}
function IsRecipientPhone(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isRecipientPhone',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value, args) {
                    if (value == null || value === '')
                        return true;
                    if (typeof value !== 'string')
                        return false;
                    const obj = args.object;
                    const result = (0, recipient_contact_1.normalizeRecipientContact)({
                        recipientPhone: value,
                        shippingPhoneCountry: obj.shippingPhoneCountry,
                    });
                    return result.ok;
                },
                defaultMessage(args) {
                    const obj = args.object;
                    const result = (0, recipient_contact_1.normalizeRecipientContact)({
                        recipientPhone: typeof args.value === 'string' ? args.value : obj.recipientPhone,
                        shippingPhoneCountry: obj.shippingPhoneCountry,
                    });
                    return result.ok ? 'Please enter a valid phone number.' : result.message;
                },
            },
        });
    };
}
//# sourceMappingURL=is-recipient-contact.js.map