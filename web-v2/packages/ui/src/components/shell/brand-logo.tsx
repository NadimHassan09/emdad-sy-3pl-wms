import { cn } from '@ui/lib/utils'
import emdadLogo from '@ui/assets/emdad-logo.png'

/** Official Emdad mark from the legacy admin frontend (`emdad-logo.png`) + bilingual wordmark. */
export function BrandLogo({
  tone = 'onDark',
  compact,
  className,
}: {
  tone?: 'onDark' | 'onLight'
  /** Icon-rail / collapsed sidebar — mark only, sized to fit with clear padding. */
  compact?: boolean
  className?: string
}) {
  const text = tone === 'onDark' ? 'text-white' : 'text-brand-900'
  return (
    <div
      className={cn(
        'flex items-center',
        compact ? 'w-full justify-center px-0.5' : 'gap-2.5',
        className,
      )}
      dir="ltr"
    >
      <img
        src={emdadLogo}
        alt="EMDAD"
        width={175}
        height={110}
        draggable={false}
        className={cn(
          'shrink-0 object-contain object-center select-none',
          compact ? 'h-7 w-auto max-w-full' : 'h-9 w-auto',
          // Dark green mark → white on the sidebar / dark auth panel
          tone === 'onDark' && 'brightness-0 invert',
        )}
      />
      {compact ? null : (
        <div className={cn('leading-none', text)}>
          <div dir="rtl" lang="ar" className="font-arabic text-lg font-bold leading-6">
            إمداد
          </div>
          <div className="text-[0.95rem] font-extrabold tracking-wide">EMDAD</div>
        </div>
      )}
    </div>
  )
}
