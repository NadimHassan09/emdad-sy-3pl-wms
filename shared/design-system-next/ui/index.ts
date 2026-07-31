/**
 * WMS Design System — primitive barrel export.
 *
 * Consumers import from a single root:
 *
 *   import { Button, Modal, Badge } from '@ds';
 *
 * No business logic lives here. Each primitive is dumb, accessible, and
 * RTL-ready by default. Higher-order patterns (DataTable, Combobox, Workflow
 * components) are built on top of these primitives in later phases.
 */
export { cn } from './cn';
export type { ClassValue } from './cn';
export type { Size, Variant, Tone, OperationalStatus } from './types';

export {
  FILTER_APPLY_BUTTON_CLASS,
  FILTER_RESET_BUTTON_CLASS,
} from './filter-button-styles';

/** @deprecated Prefer FILTER_APPLY_BUTTON_CLASS — kept for Client modal CTAs. */
export { FILTER_APPLY_BUTTON_CLASS as FILTER_PRIMARY_BUTTON_CLASS } from './filter-button-styles';

export {
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_CONTROL_ERROR_CLASS,
  FILTER_GRID_CLASS,
  FILTER_ACTION_BUTTON_SIZE_CLASS,
  FILTER_OVERFLOW_TRANSITION_CLASS,
} from './filter-panel-styles';

export { renderSidebarNavIcon } from '../lib/sidebar-nav-icons';

export {
  statusMeta,
  normalizeStatusKey,
  statusLabel,
} from '../lib/statusMeta';
export type { StatusMeta } from '../lib/statusMeta';

export { useUiLanguage, applyUiLanguage } from '../lib/use-ui-language';
export type { UiLanguage, UseUiLanguageOptions } from '../lib/use-ui-language';
export { useUiTheme, applyUiTheme } from '../lib/use-ui-theme';
export type { UiTheme, UiThemePreference, UseUiThemeOptions } from '../lib/use-ui-theme';
export { useDebouncedValue } from '../lib/use-debounced-value';
export { LanguageSwitchOverlay } from './LanguageSwitchOverlay';
export type { LanguageSwitchOverlayProps } from './LanguageSwitchOverlay';

export { LoginScreen } from './LoginScreen';
export type { LoginScreenProps } from './LoginScreen';

// Form
export { Button } from './Button';
export type { ButtonProps } from './Button';
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';
export { FaIconButton } from './FaIconButton';
export type { FaIconButtonProps } from './FaIconButton';
export { Input } from './Input';
export type { InputProps } from './Input';
export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';
export { Select } from './Select';
export type { SelectOption, SelectProps } from './Select';
export { Field } from './Field';
export { Spinner } from './Spinner';
export { TextField } from './TextField';
export { SelectField } from './SelectField';
export { Combobox } from './Combobox';
export type { ComboboxOption } from './Combobox';

// Display
export { Badge } from './Badge';
export type { BadgeProps } from './Badge';
export { StatusBadge } from './StatusBadge';
export type { StatusBadgeProps } from './StatusBadge';
export { Card } from './Card';
export type { CardProps } from './Card';
export { Skeleton } from './Skeleton';
export { EmptyState } from './EmptyState';

// Overlay
export { Modal } from './Modal';
export { Drawer } from './Drawer';
export { Tooltip } from './Tooltip';
export { Portal } from './Portal';
export { useFocusTrap } from './useFocusTrap';

// Layout
export { PageContainer } from './PageContainer';
export { SectionContainer } from './SectionContainer';

// ─── Phase 3: Layout / AppShell architecture ─────────────────────────────────
export { AppShell } from './AppShell';

export {
  Sidebar,
  SidebarBrand,
  SidebarNav,
  SidebarSection,
  SidebarLink,
  SidebarDivider,
  SidebarFooter,
  SidebarCollapseButton,
  MobileSidebarOverlay,
} from './Sidebar';

export {
  Topbar,
  TopbarMobileMenuButton,
  TopbarUserMenu,
  TopbarLanguageToggle,
  TopbarThemeToggle,
} from './Topbar';
export type { TopbarUserMenuProps } from './Topbar';

export { TopbarNotifications } from './TopbarNotifications';
export type { TopbarNotificationItem, TopbarNotificationsProps } from './TopbarNotifications';

export { AppPageHeader } from './AppPageHeader';
export { ListPageHeader } from './ListPageHeader';
export type { ListPageHeaderProps } from './ListPageHeader';

export { Breadcrumb } from './Breadcrumb';
export type { BreadcrumbItem } from './Breadcrumb';

// ─── Phase 5: Production polish ─────────────────────────────────────────────
export { PageLoadFallback } from './PageLoadFallback';

// ─── Phase 4: Premium UX primitives ─────────────────────────────────────────
export { Alert } from './Alert';
export type { AlertVariant } from './Alert';

export { WorkflowStatus } from './WorkflowStatus';
export type { WorkflowStep, WorkflowStatusProps } from './WorkflowStatus';

// ─── Phase 2: DataTable architecture ────────────────────────────────────────
export { DataTable, DataTableContainer } from './DataTable';
export type { Column, DataTableProps, RowState, SortDir } from './DataTable';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';
export { TableFooterPagination } from './TableFooterPagination';
export type {
  TableFooterPaginationProps,
  ServerPaginationLike,
} from './TableFooterPagination';

export { SearchInput } from './SearchInput';

export {
  TableToolbar,
  DensityToggle,
  RefreshButton,
} from './TableToolbar';

export { TableCardHeader } from './TableCardHeader';
export type { TableCardHeaderProps } from './TableCardHeader';

export {
  FilterBar,
  FilterBarToggle,
  FilterBarActions,
  StatusFilter,
} from './FilterBar';
