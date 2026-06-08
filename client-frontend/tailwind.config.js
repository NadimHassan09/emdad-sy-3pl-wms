/** @type {import('tailwindcss').Config} */
export default {
  presets: ['../shared/design-system/tailwind.preset.cjs'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../shared/design-system/**/*.css',
    '../shared/design-system/ui/**/*.{ts,tsx}',
    '../frontend/src/components/**/*.{ts,tsx}',
  ],
  safelist: [
    'grid-cols-[1fr_auto]',
    'sm:items-center',
    'sm:flex-row',
    'sm:justify-between',
    'sm:items-end',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
