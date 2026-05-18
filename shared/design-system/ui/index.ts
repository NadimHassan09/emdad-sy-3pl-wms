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

// Form
export { Button } from './Button';
export type { ButtonProps } from './Button';
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';
export { Input } from './Input';
export type { InputProps } from './Input';
export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';
export { Select } from './Select';
export type { SelectOption, SelectProps } from './Select';
export { Field } from './Field';
export { Spinner } from './Spinner';

// Display
export { Badge } from './Badge';
export type { BadgeProps } from './Badge';
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
