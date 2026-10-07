import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Loader2, MapPin, Package, RefreshCw, Route } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { cn } from '@emdad/ui'
import { OmsApi, type OmsOrderDetail, type OmsShipmentMovementEvent } from '@/api/oms'

function formatEventDateTime(isoString: string, isArabic: boolean): { date: string; time: string } {
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return { date: '—', time: '—' }
    const date = d.toLocaleDateString(isArabic ? 'ar-SY' : 'en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const time = d.toLocaleTimeString(isArabic ? 'ar-SY' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    return { date, time }
  } catch {
    return { date: '—', time: '—' }
  }
}

function eventTone(color?: string): { card: string; dot: string } {
  switch (color) {
    case 'success':
      return { card: 'border-emerald-200 bg-emerald-50/90 text-emerald-950', dot: 'bg-emerald-500' }
    case 'info':
      return { card: 'border-blue-200 bg-blue-50/90 text-blue-950', dot: 'bg-blue-500' }
    case 'error':
      return { card: 'border-rose-200 bg-rose-50/90 text-rose-950', dot: 'bg-rose-500' }
    case 'warning':
      return { card: 'border-amber-200 bg-amber-50/90 text-amber-950', dot: 'bg-amber-500' }
    default:
      return { card: 'border-border bg-muted/40 text-foreground', dot: 'bg-muted-foreground' }
  }
}

type Props = { order: OmsOrderDetail; isArabic: boolean }

export function OmsShipmentMovementPanel({ order, isArabic }: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [copied, setCopied] = useState(false)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['oms-shipping-movement', order.id],
    queryFn: () => OmsApi.getShippingMovement(order.id),
    staleTime: 60_000,
    retry: 1,
  })

  const awb = data?.awb || order.trackingNumber || null
  const carrierName = data?.providerName || order.carrier || null
  const events = data?.events || []
  const errorMessage = data?.error
  const infoMessage = data?.message

  const copyAwb = () => {
    if (!awb) return
    void navigator.clipboard.writeText(awb)
    setCopied(true)
    toast.success(t('Tracking number copied', 'تم نسخ رقم الشحنة'))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card aria-label={t('Shipment movement', 'حركة الشحنة')}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Route className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {t('Shipment movement', 'حركة الشحنة')}
              {carrierName ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {carrierName}
                </span>
              ) : null}
            </CardTitle>
            {awb ? (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{t('AWB:', 'رقم التتبع:')}</span>
                <span className="font-mono font-medium text-foreground select-all">{awb}</span>
                <button
                  type="button"
                  onClick={copyAwb}
                  title={t('Copy tracking number', 'نسخ رقم التتبع')}
                  className="inline-flex items-center text-muted-foreground hover:text-foreground"
                >
                  <Copy className={cn('size-3.5', copied && 'text-primary')} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {t('Refresh', 'تحديث')}
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />
            ))}
          </div>
        ) : isError || errorMessage ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <p className="font-medium">
              {t(
                'Unable to fetch shipment movement from the carrier at this moment.',
                'تعذر الحصول على حركة الشحنة من شركة الشحن حالياً.',
              )}
            </p>
            {errorMessage ? <p className="mt-1 text-xs opacity-80">{errorMessage}</p> : null}
            <Button type="button" variant="link" size="sm" className="mt-2 h-auto p-0" onClick={() => refetch()}>
              {t('Try again', 'إعادة المحاولة')}
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="size-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">
              {infoMessage ||
                t('No shipment movement data available currently.', 'لا توجد بيانات لحركة الشحنة حالياً.')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event: OmsShipmentMovementEvent, idx: number) => {
              const { date, time } = formatEventDateTime(event.timestamp, isArabic)
              const styling = eventTone(event.color)
              return (
                <div key={`${event.timestamp}-${idx}`} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                  <div className="flex shrink-0 items-baseline justify-between gap-2 text-xs tabular-nums text-muted-foreground sm:w-28 sm:flex-col sm:items-end">
                    <span className="font-semibold text-foreground">{date}</span>
                    <span className="opacity-80">{time}</span>
                  </div>
                  <div className={cn('flex-1 rounded-lg border p-4 shadow-sm', styling.card)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold leading-snug">{event.title}</p>
                        {event.notes ? <p className="text-sm opacity-85">{event.notes}</p> : null}
                        {event.location ? (
                          <div className="flex items-center gap-1.5 pt-1 text-sm">
                            <MapPin className="size-3.5 shrink-0 text-destructive" aria-hidden />
                            <span>{event.location}</span>
                          </div>
                        ) : null}
                      </div>
                      {idx === 0 ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-xs font-bold uppercase">
                          <span className={cn('size-1.5 rounded-full', styling.dot)} />
                          {t('Latest', 'الأحدث')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
