// Controlli automatici del codice. Vedi docs/2026-11-06-manutenibilita.md.
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'test-results/', 'playwright-report/', '.vitest/', 'public/', 'scripts/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
      },
    },
    rules: {
      // Promesse senza await né void: tipica causa di errori USB che nessuno vede.
      '@typescript-eslint/no-floating-promises': 'error',
      // Coerente con verbatimModuleSyntax.
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Le porte (stampante simulata, finti trasporti nei test) implementano interfacce async
      // anche quando non aspettano nulla: segnalarle sarebbe solo rumore.
      '@typescript-eslint/require-await': 'off',
      // Variabili assegnate una volta ma lette prima in una closure (es. `chosen` in usb-diagnostics.ts).
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      // La formattazione la fa Prettier.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
    },
  },
  {
    // opentype.js non ha tipi: le prove sui caratteri leggono i glifi come valori non tipizzati.
    files: ['tests/unit/diameter-font.test.ts', 'tests/unit/iso-font.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
);
