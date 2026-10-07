import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'reference/**', 'scripts/**', '**/*.config.*', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // independence + single icon library + no legacy design system
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@ds', '@ds/*', '**/shared/design-system*', '**/frontend/**', '**/client-frontend/**'], message: 'web-v2 must not depend on the classic UI.' },
            { group: ['@heroicons/*', 'react-icons', 'react-icons/*', '@tabler/icons-react', 'phosphor-react', '@phosphor-icons/*'], message: 'Use lucide-react only.' },
            { group: ['next/*', 'next-themes'], message: 'Not a Next.js app.' },
          ],
        },
      ],
    },
  },
  {
    // shadcn-generated primitives: keep as generated, only structural lint
    files: ['packages/ui/src/components/ui/**'],
    rules: { 'react-hooks/purity': 'off', 'react-hooks/set-state-in-effect': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
)
