/** @type {import('tailwindcss').Config} */
export default {
  presets: ['../shared/design-system/tailwind.preset.cjs'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../shared/design-system/**/*.css',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
