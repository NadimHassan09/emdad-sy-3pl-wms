import type { ClientBillingAccess } from '../services/clientBillingService';

export type BillingRestrictionVariant = 'error' | 'warning' | 'info';

export type BillingRestrictionCopy = {
  variant: BillingRestrictionVariant;
  title: string;
  description: string;
  actionBlockedReason: string;
  showBanner: boolean;
};

export function buildBillingRestrictionCopy(
  accountStatus: ClientBillingAccess['accountStatus'],
  daysRemaining: number | null,
  isArabic: boolean,
): BillingRestrictionCopy {
  if (accountStatus === 'restricted') {
    return isArabic
      ? {
          variant: 'error',
          title: 'الحساب مقيّد',
          description:
            'انتهت دورة الفوترة. لا يمكن إنشاء طلبات أو منتجات جديدة. تواصل مع المالية أو مدير حسابك لتجديد الاشتراك واستعادة الوصول.',
          actionBlockedReason: 'الحساب مقيّد — جدّد الفوترة لإنشاء طلبات أو منتجات.',
          showBanner: true,
        }
      : {
          variant: 'error',
          title: 'Account restricted',
          description:
            'Your billing cycle has expired. You cannot create new orders or products. Contact finance or your account manager to renew and restore operational access.',
          actionBlockedReason: 'Account restricted — renew billing to create orders or products.',
          showBanner: true,
        };
  }

  if (accountStatus === 'no_plan') {
    return isArabic
      ? {
          variant: 'error',
          title: 'لا توجد خطة فوترة',
          description:
            'لا توجد خطة فوترة نشطة. تواصل مع مدير حسابك لإعداد الفوترة قبل إنشاء الطلبات أو المنتجات.',
          actionBlockedReason: 'لا توجد خطة فوترة — تواصل مع مدير حسابك.',
          showBanner: true,
        }
      : {
          variant: 'error',
          title: 'No billing plan',
          description:
            'There is no active billing plan on file. Contact your account manager to set up billing before creating orders or products.',
          actionBlockedReason: 'No billing plan — contact your account manager.',
          showBanner: true,
        };
  }

  if (accountStatus === 'expiring') {
    const days = daysRemaining ?? 0;
    return isArabic
      ? {
          variant: 'warning',
          title: 'دورة الفوترة تنتهي قريبًا',
          description: `تبقى ${days} يوم على انتهاء دورة الفوترة. جدّد في الوقت المناسب لتجنب تقييد الحساب.`,
          actionBlockedReason: '',
          showBanner: true,
        }
      : {
          variant: 'warning',
          title: 'Billing cycle expiring soon',
          description: `Your billing cycle ends in ${days} day${days === 1 ? '' : 's'}. Renew on time to avoid account restrictions.`,
          actionBlockedReason: '',
          showBanner: true,
        };
  }

  return {
    variant: 'info',
    title: '',
    description: '',
    actionBlockedReason: '',
    showBanner: false,
  };
}

export function roleAccessDeniedCopy(pathname: string, isArabic: boolean): BillingRestrictionCopy {
  const isBilling = pathname.startsWith('/billing');
  if (isArabic) {
    return {
      variant: 'info',
      title: 'لا يمكن الوصول إلى هذه الصفحة',
      description: isBilling
        ? 'صفحة الفوترة متاحة لمسؤولي العميل فقط. يمكنك متابعة الطلبات والمخزون من القائمة.'
        : 'كتالوج المنتجات متاح لمسؤولي العميل فقط. تم توجيهك إلى المخزون.',
      actionBlockedReason: '',
      showBanner: true,
    };
  }
  return {
    variant: 'info',
    title: 'Page not available for your role',
    description: isBilling
      ? 'Billing is available to client administrators only. You can continue with orders and stock from the menu.'
      : 'The product catalog is available to client administrators only. You were redirected to stock.',
    actionBlockedReason: '',
    showBanner: true,
  };
}
