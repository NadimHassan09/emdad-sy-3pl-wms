"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBranding = resolveBranding;
function resolveBranding(config) {
    const get = (key, fallback) => (config.get(key) ?? '').trim() || fallback;
    return {
        companyName: get('DOC_BRAND_NAME', 'EMDAD Logistics & Warehousing'),
        companyNameAr: get('DOC_BRAND_NAME_AR', 'إمداد للخدمات اللوجستية والتخزين'),
        tagline: get('DOC_BRAND_TAGLINE', 'Logistics & Warehousing'),
        taglineAr: get('DOC_BRAND_TAGLINE_AR', 'الخدمات اللوجستية والتخزين'),
        phone: get('DOC_BRAND_PHONE', '+963 983 628 071'),
        email: get('DOC_BRAND_EMAIL', 'info@emdadsy.com'),
        website: get('DOC_BRAND_WEBSITE', 'emdadsy.com'),
        addressEn: get('DOC_BRAND_ADDRESS_EN', 'Sheikh Najjar Industrial Zone, Aleppo, Syria'),
        addressAr: get('DOC_BRAND_ADDRESS_AR', 'المدينة الصناعية بالشيخ نجار، حلب، سوريا'),
        colors: {
            primary: '#0B5E3C',
            dark: '#08452C',
            light: '#EAF6F0',
            gray: '#F5F5F5',
            text: '#222222',
        },
    };
}
//# sourceMappingURL=branding.js.map