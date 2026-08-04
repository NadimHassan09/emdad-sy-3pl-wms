import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Skeleton, Textarea, TextField, FILTER_PRIMARY_BUTTON_CLASS } from '@ds';

import { useAuth } from '../auth/AuthContext';
import { ImageUploadField } from '../components/ImageUploadField';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { clientMediaSrc } from '../lib/client-media';
import { isClientArabic } from '../lib/client-ui-language';
import { isClientAdmin } from '../lib/rbac';
import {
  deleteClientProductImage,
  fetchClientProduct,
  updateClientProduct,
  uploadClientProductImage,
} from '../services/clientProductsService';

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'Edit product': 'تعديل المنتج',
    'Update name, description, photo, and min stock threshold':
      'حدّث الاسم والوصف والصورة وحد المخزون الأدنى',
    'Back to product': 'العودة إلى المنتج',
    'Back to inventory': 'العودة إلى المخزون',
    Details: 'التفاصيل',
    Name: 'الاسم',
    Description: 'الوصف',
    'Min stock threshold': 'حد المخزون الأدنى',
    'Product photo': 'صورة المنتج',
    Optional: 'اختياري',
    Cancel: 'إلغاء',
    Save: 'حفظ',
    'Product updated.': 'تم تحديث المنتج.',
    'Editing products is not available for your account right now.':
      'تعديل المنتجات غير متاح لحسابك حالياً.',
    'Product not found.': 'المنتج غير موجود.',
    'Could not load product.': 'تعذر تحميل المنتج.',
    units: 'وحدة',
  };
  return ar[text] ?? text;
}

function SectionHeading({ title }: { title: string }): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
        {title}
      </h2>
    </div>
  );
}

export function EditProductPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isArabic = isClientArabic();
  const t = (s: string) => label(s, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const canEdit = isClientAdmin(user?.role);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minStockThreshold, setMinStockThreshold] = useState('0');
  const [imageVersion, setImageVersion] = useState(() => Date.now());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productQuery = useQuery({
    queryKey: ['client', 'products', id],
    queryFn: () => fetchClientProduct(id),
    enabled: Boolean(id) && canEdit,
  });

  useEffect(() => {
    if (!productQuery.data || hydrated) return;
    setName(productQuery.data.name);
    setDescription(productQuery.data.description ?? '');
    setMinStockThreshold(String(Number(productQuery.data.minStockThreshold) || 0));
    setImageUrl(productQuery.data.imageUrl ?? null);
    setHydrated(true);
  }, [productQuery.data, hydrated]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error(isArabic ? 'الاسم مطلوب.' : 'Name is required.');
      }
      const thresholdRaw = minStockThreshold.trim();
      const threshold = thresholdRaw === '' ? 0 : Number(thresholdRaw);
      if (!Number.isFinite(threshold) || threshold < 0 || !Number.isInteger(threshold)) {
        throw new Error(
          isArabic
            ? 'حد المخزون الأدنى يجب أن يكون عدداً صحيحاً ≥ 0.'
            : 'Min stock threshold must be a whole number ≥ 0.',
        );
      }
      return updateClientProduct(id, {
        name: trimmedName,
        description: description.trim(),
        minStockThreshold: threshold,
      });
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] });
      navigate(`/products/${updated.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const imageUploadMut = useMutation({
    mutationFn: (file: File) => uploadClientProductImage(id, file),
    onSuccess: (res) => {
      setImageUrl(res.imageUrl);
      setImageVersion(Date.now());
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] });
    },
  });

  const imageDeleteMut = useMutation({
    mutationFn: () => deleteClientProductImage(id),
    onSuccess: () => {
      setImageUrl(null);
      setImageVersion(Date.now());
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] });
    },
  });

  if (!canEdit) {
    return <Navigate to="/products" replace />;
  }

  if (!id) {
    return <Navigate to="/products" replace />;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t('Editing products is not available for your account right now.'),
      );
      return;
    }
    setError(null);
    saveMut.mutate();
  };

  const loading = saveMut.isPending;
  const fieldsDisabled =
    loading || !billingAccess.operationalAllowed || imageUploadMut.isPending || imageDeleteMut.isPending;

  if (productQuery.isLoading && !hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 animate-enter">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (productQuery.isError) {
    const notFound = isAxiosError(productQuery.error) && productQuery.error.response?.status === 404;
    return (
      <div className="mx-auto max-w-4xl space-y-4 animate-enter">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:underline"
        >
          <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
          {t('Back to inventory')}
        </Link>
        <Alert variant="error">{notFound ? t('Product not found.') : t('Could not load product.')}</Alert>
      </div>
    );
  }

  const previewUrl = clientMediaSrc(imageUrl, imageVersion);

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to={`/products/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to product')}
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">{t('Edit product')}</h1>
          <p className="text-sm text-text-muted">
            {t('Update name, description, photo, and min stock threshold')}
          </p>
        </header>
      </div>

      {!billingAccess.operationalAllowed ? (
        <p
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
          role="alert"
        >
          {billingAccess.actionBlockedReason ||
            t('Editing products is not available for your account right now.')}
        </p>
      ) : null}

      <form id="edit-client-product" onSubmit={submit} className="space-y-10">
        {error ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="space-y-5">
          <SectionHeading title={t('Details')} />
          <div className="space-y-5">
            <ImageUploadField
              label={t('Product photo')}
              hint={t('Optional')}
              previewUrl={previewUrl}
              disabled={fieldsDisabled}
              uploading={imageUploadMut.isPending || imageDeleteMut.isPending}
              isArabic={isArabic}
              onUpload={async (file) => {
                await imageUploadMut.mutateAsync(file);
              }}
              onRemove={
                imageUrl
                  ? async () => {
                      await imageDeleteMut.mutateAsync();
                    }
                  : undefined
              }
            />
            <TextField
              label={t('Name')}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={fieldsDisabled}
            />
            <Textarea
              label={t('Description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={fieldsDisabled}
            />
            <TextField
              label={t('Min stock threshold')}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={minStockThreshold}
              onChange={(e) => setMinStockThreshold(e.target.value)}
              disabled={fieldsDisabled}
              hint={t('units')}
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => navigate(`/products/${id}`)}
          >
            {t('Cancel')}
          </Button>
          <button
            type="submit"
            form="edit-client-product"
            disabled={fieldsDisabled || !name.trim()}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {loading ? (
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-check" aria-hidden="true" />
            )}
            {t('Save')}
          </button>
        </div>
      </form>
    </div>
  );
}
