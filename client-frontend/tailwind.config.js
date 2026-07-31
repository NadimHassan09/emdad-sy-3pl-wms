import dsPreset from '../shared/design-system-next/tailwind.preset.cjs';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  presets: [dsPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../shared/design-system-next/**/*.css',
    '../shared/design-system-next/ui/**/*.{ts,tsx}',
    '../shared/design-system-next/lib/**/*.{ts,tsx}',
  ],
  safelist: [
    'grid-cols-[1fr_auto]',
    'sm:items-center',
    'sm:flex-row',
    'sm:justify-between',
    'sm:items-end',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        slate: { 850: '#151F32', 950: '#020617' },
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        card: '0 4px 6px -1px rgb(0 0 0 / 0.02), 0 2px 4px -2px rgb(0 0 0 / 0.02)',
        elevated: '0 10px 15px -3px rgb(0 0 0 / 0.03), 0 4px 6px -4px rgb(0 0 0 / 0.03)',
      },
    },
  },
  plugins: [],
};
