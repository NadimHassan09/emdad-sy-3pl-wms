"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAvatarPublicUrl = toAvatarPublicUrl;
function toAvatarPublicUrl(avatarPath) {
    if (!avatarPath?.trim())
        return null;
    const cleaned = avatarPath.trim().replace(/^\/+/, '');
    return `/media/${cleaned}`;
}
//# sourceMappingURL=avatar-url.js.map