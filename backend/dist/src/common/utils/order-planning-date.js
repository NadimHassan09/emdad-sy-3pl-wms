"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCalendarYmd = extractCalendarYmd;
exports.calendarTodayYmdServerLocal = calendarTodayYmdServerLocal;
exports.assertCalendarDateNotBeforeToday = assertCalendarDateNotBeforeToday;
const common_1 = require("@nestjs/common");
const YMD_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
function extractCalendarYmd(value) {
    const m = YMD_PREFIX.exec(value?.trim() ?? '');
    if (!m) {
        throw new common_1.BadRequestException('Date must include a YYYY-MM-DD calendar day.');
    }
    return m[1];
}
function calendarTodayYmdServerLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
}
function assertCalendarDateNotBeforeToday(value, fieldName) {
    const ymd = extractCalendarYmd(value);
    const today = calendarTodayYmdServerLocal();
    if (ymd < today) {
        throw new common_1.BadRequestException(`${fieldName} cannot be before today.`);
    }
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + MAX_PLANNING_DAYS_AHEAD);
    if (ymd > limit.toISOString().slice(0, 10)) {
        throw new common_1.BadRequestException(`${fieldName} cannot be more than 2 years from today.`);
    }
}
const MAX_PLANNING_DAYS_AHEAD = 730;
//# sourceMappingURL=order-planning-date.js.map