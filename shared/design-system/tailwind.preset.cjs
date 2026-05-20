/**
 * WMS Design System — shared Tailwind preset.
 *
 * Maps the CSS custom properties exposed by `tokens.css` into Tailwind's
 * theme. This means utility classes (`bg-brand-600`, `shadow-md`, `z-modal`,
 * `font-arabic`, etc.) all resolve to the same tokens used by primitives.
 *
 * Notes:
 *   - Tailwind colour values reference `var(--…)` so a future dark-mode
 *     palette can swap tokens without touching component class names.
 *   - The legacy `primary.*` palette is preserved (alias of `accent.*`) so
 *     existing pages keep working.
 *   - Phase 1 only — no plugins added.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        /* Neutral ramp */
        neutral: {
          0:   'var(--color-neutral-0)',
          50:  'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
          950: 'var(--color-neutral-950)',
        },

        /* Brand — operational green identity */
        brand: {
          50:  'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          300: 'var(--color-brand-300)',
          400: 'var(--color-brand-400)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)',
          700: 'var(--color-brand-700)',
          800: 'var(--color-brand-800)',
          900: 'var(--color-brand-900)',
        },

        /* Accent — informational blue */
        accent: {
          50:  'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
        },

        /* Surface layer aliases — use these in components, not raw neutral ramp. */
        surface: {
          page:    'var(--surface-page)',
          card:    'var(--surface-card)',
          raised:  'var(--surface-raised)',
          panel:   'var(--surface-panel)',
          /* --surface-overlay is the DARK BACKDROP rgba — avoid using as bg- class */
          hover:   'var(--surface-hover)',
          active:  'var(--surface-active)',
          sunken:  'var(--surface-sunken)',
        },

        /* Legacy alias — keep `primary-*` working for existing class users. */
        primary: {
          50:  'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
        },

        /* Semantic UI states */
        success: {
          50:  'var(--color-success-50)',
          100: 'var(--color-success-100)',
          200: 'var(--color-success-200)',
          500: 'var(--color-success-500)',
          600: 'var(--color-success-600)',
          700: 'var(--color-success-700)',
          900: 'var(--color-success-900)',
        },
        warning: {
          50:  'var(--color-warning-50)',
          100: 'var(--color-warning-100)',
          200: 'var(--color-warning-200)',
          400: 'var(--color-warning-400)',
          500: 'var(--color-warning-500)',
          600: 'var(--color-warning-600)',
          700: 'var(--color-warning-700)',
          900: 'var(--color-warning-900)',
        },
        danger: {
          50:  'var(--color-danger-50)',
          100: 'var(--color-danger-100)',
          200: 'var(--color-danger-200)',
          500: 'var(--color-danger-500)',
          600: 'var(--color-danger-600)',
          700: 'var(--color-danger-700)',
          900: 'var(--color-danger-900)',
        },
        info: {
          50:  'var(--color-info-50)',
          100: 'var(--color-info-100)',
          200: 'var(--color-info-200)',
          500: 'var(--color-info-500)',
          600: 'var(--color-info-600)',
          700: 'var(--color-info-700)',
          900: 'var(--color-info-900)',
        },

        /* Operational warehouse colors (Section B of spec) */
        'op-inv-increase':    'var(--color-inv-increase)',
        'op-inv-increase-bg': 'var(--color-inv-increase-bg)',
        'op-inv-decrease':    'var(--color-inv-decrease)',
        'op-inv-decrease-bg': 'var(--color-inv-decrease-bg)',
        'op-task-assigned':   'var(--color-task-assigned)',
        'op-task-active':     'var(--color-task-active)',
        'op-task-blocked':    'var(--color-task-blocked)',
        'op-locked':          'var(--color-locked)',
        'op-locked-bg':       'var(--color-locked-bg)',
        'op-syncing':         'var(--color-syncing)',
        'op-live':            'var(--color-live)',
        'op-stale':           'var(--color-stale)',
        'op-offline':         'var(--color-offline)',
        'op-critical':        'var(--color-critical)',
        'op-shortfall':       'var(--color-shortfall)',
        'op-overage':         'var(--color-overage)',
        'op-expiry-warning':  'var(--color-expiry-warning)',
        'op-expiry-critical': 'var(--color-expiry-critical)',
        'op-expired':         'var(--color-expired)',
      },

      fontFamily: {
        sans:   ['var(--font-sans)'],
        mono:   ['var(--font-mono)'],
        arabic: ['var(--font-arabic)'],
      },

      fontSize: {
        '2xs':  ['var(--text-2xs)',  { lineHeight: 'var(--leading-snug)' }],
        xs:     ['var(--text-xs)',   { lineHeight: 'var(--leading-snug)' }],
        sm:     ['var(--text-sm)',   { lineHeight: 'var(--leading-normal)' }],
        base:   ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
        lg:     ['var(--text-lg)',   { lineHeight: 'var(--leading-snug)' }],
        xl:     ['var(--text-xl)',   { lineHeight: 'var(--leading-snug)' }],
        '2xl':  ['var(--text-2xl)',  { lineHeight: 'var(--leading-tight)' }],
        '3xl':  ['var(--text-3xl)',  { lineHeight: 'var(--leading-tight)' }],
        '4xl':  ['var(--text-4xl)',  { lineHeight: 'var(--leading-tight)' }],
      },

      borderRadius: {
        none: 'var(--radius-none)',
        xs:   'var(--radius-xs)',
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        '2xl':'var(--radius-2xl)',
        '3xl':'var(--radius-3xl)',
        pill: 'var(--radius-pill)',
        card: 'var(--radius-card)',
      },

      boxShadow: {
        xs:    'var(--shadow-xs)',
        sm:    'var(--shadow-sm)',
        md:    'var(--shadow-md)',
        lg:    'var(--shadow-lg)',
        xl:    'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        focus: 'var(--shadow-focus)',
        'focus-danger': 'var(--shadow-focus-danger)',
      },

      zIndex: {
        base:     'var(--z-base)',
        raised:   'var(--z-raised)',
        dropdown: 'var(--z-dropdown)',
        sticky:   'var(--z-sticky)',
        fixed:    'var(--z-fixed)',
        overlay:  'var(--z-overlay)',
        modal:    'var(--z-modal)',
        drawer:   'var(--z-drawer)',
        popover:  'var(--z-popover)',
        tooltip:  'var(--z-tooltip)',
        toast:    'var(--z-toast)',
        max:      'var(--z-max)',
      },

      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast:    'var(--duration-fast)',
        base:    'var(--duration-base)',
        slow:    'var(--duration-slow)',
      },

      transitionTimingFunction: {
        standard:   'var(--ease-standard)',
        emphasis:   'var(--ease-emphasis)',
        exit:       'var(--ease-exit)',
        spring:     'var(--ease-spring)',
        decelerate: 'var(--ease-decelerate)',
        accelerate: 'var(--ease-accelerate)',
      },

      maxWidth: {
        content: 'var(--content-max-w)',
      },

      spacing: {
        /* Component layout primitives */
        'topbar':       'var(--topbar-h)',
        'topbar-md':    'var(--topbar-h-md)',
        'sidebar':      'var(--sidebar-w)',
        'sidebar-mobile':'var(--sidebar-w-mobile)',
      },
    },
  },
  plugins: [],
};
