"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandContext = brandContext;
exports.footerContext = footerContext;
function brandContext(brand, lang, logo) {
    return {
        name: lang === 'ar' ? brand.companyNameAr : brand.companyName,
        tagline: lang === 'ar' ? brand.taglineAr : brand.tagline,
        phone: brand.phone,
        email: brand.email,
        website: brand.website,
        address: lang === 'ar' ? brand.addressAr : brand.addressEn,
        logo,
    };
}
function footerContext(brand, lang, L) {
    const name = lang === 'ar' ? brand.companyNameAr : brand.companyName;
    const companyLine = `${name} · ${brand.phone} · ${brand.email}`;
    return {
        lang,
        dir: lang === 'ar' ? 'rtl' : 'ltr',
        companyLine,
        generatedBy: L.generatedByWms,
        confidential: L.confidential,
        pageWord: L.page,
        ofWord: L.of,
    };
}
//# sourceMappingURL=pdf-context.util.js.map