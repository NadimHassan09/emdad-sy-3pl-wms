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
  theme: {
    extend: {},
  },
  plugins: [],
};
