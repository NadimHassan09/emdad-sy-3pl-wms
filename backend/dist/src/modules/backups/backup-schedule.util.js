"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextBackupScheduleRun = getNextBackupScheduleRun;
exports.isBackupScheduleDue = isBackupScheduleDue;
const client_1 = require("@prisma/client");
function atScheduleTime(base, hour, minute) {
    const d = new Date(base);
    d.setSeconds(0, 0);
    d.setHours(hour, minute, 0, 0);
    return d;
}
function getNextBackupScheduleRun(schedule, now) {
    if (!schedule.enabled)
        return null;
    const anchor = schedule.createdAt;
    switch (schedule.frequency) {
        case client_1.BackupScheduleFrequency.daily: {
            let next = atScheduleTime(now, schedule.hour, schedule.minute);
            if (next <= now) {
                next = atScheduleTime(new Date(now.getTime() + 86_400_000), schedule.hour, schedule.minute);
            }
            return next;
        }
        case client_1.BackupScheduleFrequency.weekly: {
            const targetDay = anchor.getDay();
            for (let offset = 0; offset < 8; offset += 1) {
                const day = new Date(now.getTime() + offset * 86_400_000);
                if (day.getDay() !== targetDay)
                    continue;
                const next = atScheduleTime(day, schedule.hour, schedule.minute);
                if (next > now)
                    return next;
            }
            return atScheduleTime(new Date(now.getTime() + 7 * 86_400_000), schedule.hour, schedule.minute);
        }
        case client_1.BackupScheduleFrequency.monthly: {
            const targetDate = anchor.getDate();
            for (let monthOffset = 0; monthOffset < 14; monthOffset += 1) {
                const probe = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
                const lastDay = new Date(probe.getFullYear(), probe.getMonth() + 1, 0).getDate();
                const day = Math.min(targetDate, lastDay);
                const next = atScheduleTime(new Date(probe.getFullYear(), probe.getMonth(), day), schedule.hour, schedule.minute);
                if (next > now)
                    return next;
            }
            return null;
        }
        default:
            return null;
    }
}
function isBackupScheduleDue(schedule, now) {
    if (!schedule.enabled)
        return false;
    if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) {
        return false;
    }
    if (schedule.lastRunAt) {
        const last = schedule.lastRunAt;
        if (last.getFullYear() === now.getFullYear() &&
            last.getMonth() === now.getMonth() &&
            last.getDate() === now.getDate() &&
            last.getHours() === now.getHours() &&
            last.getMinutes() === now.getMinutes()) {
            return false;
        }
    }
    const anchor = schedule.createdAt;
    switch (schedule.frequency) {
        case client_1.BackupScheduleFrequency.daily:
            return true;
        case client_1.BackupScheduleFrequency.weekly:
            return now.getDay() === anchor.getDay();
        case client_1.BackupScheduleFrequency.monthly:
            return now.getDate() === anchor.getDate();
        default:
            return false;
    }
}
//# sourceMappingURL=backup-schedule.util.js.map