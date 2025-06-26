import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  // Apply to all JavaScript and TypeScript files
  {
    files: ['**/*.js', '**/*.mjs', '**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        // AMD globals
        define: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // Extend recommended rules
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      
      // Auto-fixable rules for TypeScript issues
      '@typescript-eslint/no-explicit-any': 'off', // Allow any type for gradual migration
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_', 
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      
      // Fix unknown error types in catch blocks
      '@typescript-eslint/no-implicit-any-catch': 'off', // This rule doesn't exist in newer versions
      
      // Allow console statements for server logging
      'no-console': 'off',
      
      // Disable some strict rules for existing codebase
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      
      // Fix parameter type issues
      '@typescript-eslint/no-inferrable-types': 'off',
      
      // Allow empty functions for stubs/mocks
      '@typescript-eslint/no-empty-function': 'off',
      
      // Disable strict rules that would require major refactoring
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      
      // Relax some rules that are causing many errors
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-cond-assign': 'off',
      'no-useless-escape': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      'no-empty': 'off',
      'no-self-assign': 'off',
      'no-undef': 'off', // TypeScript handles this better
    },
  },
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      'node_modules/**',
      'logs/**',
      '*.log',
      'dist/**',
      'build/**',
      'coverage/**',
      '.git/**',
      '.cursor/**',
      '.serena/**',
      // Ignore minified files and large dependencies
      '**/*.min.js',
      '**/package-lock.json',
      // Ignore Python virtual environment and library files
      'serena/.venv/**',
      'serena/**/.venv/**',
      '**/site-packages/**',
      '**/.venv/**',
      // Ignore compiled/vendor files
      '**/vendor.js',
      '**/pyright*.js',
      // Ignore test resource files that are example code
      'serena/test/resources/**',
    ],
  },
]; 