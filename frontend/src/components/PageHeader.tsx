/** Thin Admin wrapper — SoT is `@ds` AppPageHeader. */
import type { ReactNode } from 'react';
import { AppPageHeader } from '@ds';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Font Awesome solid icon class without the `fa-solid` prefix. */
  icon?: string;
}

export function PageHeader({ title, description, actions, icon }: PageHeaderProps) {
  return (
    <AppPageHeader title={title} description={description} actions={actions} icon={icon} />
  );
}
