import { useAuth } from '../../auth/AuthContext';
import { getVisibleSettingsTabs } from '../../lib/settings/settings-catalog';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { PillSubNav } from '../PillSubNav';

export function SettingsNav() {
  const { t } = useWmsTranslation();
  const { user } = useAuth();
  const tabs = getVisibleSettingsTabs().filter(
    (entry) => !entry.superAdminOnly || user?.role === 'super_admin',
  );

  return (
    <PillSubNav
      ariaLabel={t(['Settings navigation', 'تنقل الإعدادات'])}
      className="mb-0"
      items={tabs.map((entry) => ({
        key: entry.id,
        label: t([entry.title, entry.titleAr]),
        to: entry.path,
      }))}
    />
  );
}
