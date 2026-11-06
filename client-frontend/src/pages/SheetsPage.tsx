import { useEffect, useState, type ReactElement } from 'react';

import { Button, Skeleton } from '@ds';

import { OmsSheet } from '../components/sheets/OmsSheet';
import { WmsOrdersSheet } from '../components/sheets/WmsOrdersSheet';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createGoogleSheet,
  disconnectGoogleSheets,
  fetchGoogleSheetsStatus,
  getGoogleSheetsAuthorizeUrl,
  type GoogleSheetsStatus,
} from '../services/clientSheetsGoogleService';

type Tab = 'oms' | 'inbound' | 'outbound';

export function SheetsPage(): ReactElement {
  const isArabic = isClientArabic();
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const [tab, setTab] = useState<Tab>('oms');
  const [googleStatus, setGoogleStatus] = useState<GoogleSheetsStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleWorking, setGoogleWorking] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'oms', label: isArabic ? 'طلبات التوصيل (OMS)' : 'Delivery orders (OMS)' },
    { id: 'inbound', label: isArabic ? 'الاستلام' : 'Inbound' },
    { id: 'outbound', label: isArabic ? 'الصرف' : 'Outbound' },
  ];

  useEffect(() => {
    void fetchGoogleSheetsStatus()
      .then(setGoogleStatus)
      .catch(() => setGoogleStatus({ connected: false, sheetId: null, sheetUrl: null }))
      .finally(() => setGoogleLoading(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected')) {
      setGoogleMessage({ kind: 'success', text: t('Google account connected! You can now create a sheet.', 'تم ربط حساب جوجل! يمكنك الآن إنشاء الشيت.') });
      void fetchGoogleSheetsStatus().then(setGoogleStatus);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('google_error')) {
      setGoogleMessage({ kind: 'error', text: t('Could not connect Google account.', 'تعذّر ربط حساب جوجل.') });
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setGoogleWorking(true);
    try {
      const url = await getGoogleSheetsAuthorizeUrl();
      window.location.href = url;
    } catch {
      setGoogleMessage({ kind: 'error', text: t('Could not start Google connection.', 'تعذّر بدء ربط جوجل.') });
      setGoogleWorking(false);
    }
  };

  const handleCreateSheet = async () => {
    setGoogleWorking(true);
    setGoogleMessage(null);
    try {
      const { sheetUrl } = await createGoogleSheet();
      setGoogleMessage({ kind: 'success', text: t('Sheet created!', 'تم إنشاء الشيت!') });
      setGoogleStatus((s) => s ? { ...s, sheetUrl } : s);
    } catch {
      setGoogleMessage({ kind: 'error', text: t('Could not create sheet.', 'تعذّر إنشاء الشيت.') });
    } finally {
      setGoogleWorking(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(t('Disconnect Google Sheets?', 'قطع ربط جوجل شيتس؟'))) return;
    setGoogleWorking(true);
    try {
      await disconnectGoogleSheets();
      setGoogleStatus({ connected: false, sheetId: null, sheetUrl: null });
      setGoogleMessage({ kind: 'success', text: t('Disconnected.', 'تم قطع الربط.') });
    } catch {
      setGoogleMessage({ kind: 'error', text: t('Could not disconnect.', 'تعذّر قطع الربط.') });
    } finally {
      setGoogleWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <ListPageHeader
        icon="fa-table"
        title={isArabic ? 'الشيتات' : 'Sheets'}
        subtitle={isArabic ? 'أضف وعدّل طلباتك في جدول واحد' : 'Add and edit your orders in one table'}
      />

      {/* Google Sheets connect panel */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/40">
        <span className="text-sm font-medium">{t('Google Sheets sync', 'مزامنة جوجل شيتس')}</span>
        {googleLoading ? (
          <Skeleton className="h-7 w-32" />
        ) : googleStatus?.connected ? (
          <>
            {googleStatus.sheetUrl ? (
              <a
                href={googleStatus.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              >
                <i className="fa fa-external-link text-xs" />
                {t('Open in Google Sheets', 'فتح جوجل شيتس')}
              </a>
            ) : (
              <Button type="button" variant="secondary" onClick={() => void handleCreateSheet()} disabled={googleWorking}>
                {t('Create sheet', 'إنشاء شيت')}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => void handleDisconnect()} disabled={googleWorking} className="text-neutral-500">
              {t('Disconnect', 'قطع الربط')}
            </Button>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              <i className="fa fa-check-circle mr-1" />
              {t('Connected', 'مرتبط')}
            </span>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={() => void handleConnect()} disabled={googleWorking}>
            <i className="fab fa-google mr-1.5" />
            {t('Connect with Google', 'ربط بجوجل')}
          </Button>
        )}
        {googleMessage && (
          <span className={`text-sm ${googleMessage.kind === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {googleMessage.text}
          </span>
        )}
      </div>

      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`px-4 py-2 text-sm ${tab === x.id ? 'border-b-2 border-emerald-600 font-medium' : 'text-neutral-500'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'oms' ? <OmsSheet isArabic={isArabic} /> : <WmsOrdersSheet key={tab} kind={tab} isArabic={isArabic} />}
    </div>
  );
}
