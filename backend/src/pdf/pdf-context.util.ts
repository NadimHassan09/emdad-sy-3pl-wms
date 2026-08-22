import { DocumentBranding } from './branding';
import { DocLang, LabelKey } from './i18n';
import { RenderFooter } from './pdf.service';

export function brandContext(brand: DocumentBranding, lang: DocLang, logo: string) {
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

export function footerContext(
  brand: DocumentBranding,
  lang: DocLang,
  L: Record<LabelKey, string>,
): RenderFooter {
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
