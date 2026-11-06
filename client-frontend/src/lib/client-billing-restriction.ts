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
  _daysRemaining: number | null,
  isArabic: boolean,
): BillingRestrictionCopy {
  if (accountStatus === 'restricted') {
    return isArabic
      ? {
          variant: 'error',
          title: 'الحساب مقيّد',
          description:
            'لا يمكن إنشاء طلبات أو منتجات جديدة. تواصل مع المالية أو مدير حسابك لاستعادة الوصول.',
          actionBlockedReason: 'الحساب مقيّد — تواصل مع المالية لإنشاء طلبات أو منتجات.',
          showBanner: true,
        }
      : {
          variant: 'error',
          title: 'Account restricted',
          description:
            'You cannot create new orders or products. Contact finance or your account manager to restore operational access.',
          actionBlockedReason: 'Account restricted — contact finance to create orders or products.',
          showBanner: true,
        };
  }

  if (accountStatus === 'no_plan') {
    return isArabic
      ? {
          variant: 'error',
          title: 'الحساب غير جاهز للتشغيل',
          description:
            'حسابك غير مفعّل للطلبات بعد. تواصل مع مدير حسابك قبل إنشاء الطلبات أو المنتجات.',
          actionBlockedReason: 'الحساب غير جاهز — تواصل مع مدير حسابك.',
          showBanner: true,
        }
      : {
          variant: 'error',
          title: 'Account not ready',
          description:
            'Your account is not set up for operations yet. Contact your account manager before creating orders or products.',
          actionBlockedReason: 'Account not ready — contact your account manager.',
          showBanner: true,
        };
  }

  // Legacy cycle "expiring soon" banner — EMDAD billing is on-demand (no fixed cycle).
  // Keep the status for older UI pages, but do not show a cycle-expiry alert.
  if (accountStatus === 'expiring') {
    return {
      variant: 'info',
      title: '',
      description: '',
      actionBlockedReason: '',
      showBanner: false,
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
  const isBilling = pathname.startsWith('/billing') || pathname.startsWith('/invoices');
  if (isArabic) {
    return {
      variant: 'info',
      title: 'لا يمكن الوصول إلى هذه الصفحة',
      description: isBilling
        ? 'صفحات الفوترة والفواتير متاحة لمسؤولي العميل فقط. يمكنك متابعة الطلبات والمخزون من القائمة.'
        : 'كتالوج المنتجات متاح لمسؤولي العميل فقط. تم توجيهك إلى المخزون.',
      actionBlockedReason: '',
      showBanner: true,
    };
  }
  return {
    variant: 'info',
    title: 'Page not available for your role',
    description: isBilling
      ? 'Billing and invoices are available to client administrators only. You can continue with orders and stock from the menu.'
      : 'The product catalog is available to client administrators only. You were redirected to stock.',
    actionBlockedReason: '',
    showBanner: true,
  };
}
