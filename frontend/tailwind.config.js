/** @type {import('tailwindcss').Config} */
export default {
  presets: ['../shared/design-system/tailwind.preset.cjs'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../shared/design-system/**/*.css',
    '../shared/design-system/ui/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
