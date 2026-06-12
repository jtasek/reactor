import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import security from 'eslint-plugin-security';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'static/**', '**/*.css.d.ts']
    },
    js.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2021,
                sourceType: 'module',
                ecmaFeatures: { jsx: true }
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                module: 'readonly'
            }
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            react: reactPlugin,
            'react-hooks': reactHooks,
            'jsx-a11y': jsxA11y,
            import: importPlugin,
            security
        },
        settings: {
            react: { version: 'detect' },
            'import/resolver': {
                node: {
                    extensions: ['.js', '.jsx', '.ts', '.tsx'],
                    paths: ['./src']
                }
            }
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            ...jsxA11y.configs.recommended.rules,
            'no-undef': 'off',
            curly: 'warn',
            'import/extensions': [
                'error',
                { ts: 'never', tsx: 'never', ejs: 'always', jsx: 'never', js: 'never' }
            ],
            'import/prefer-default-export': 'off',
            'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
            'no-else-return': 'warn',
            'no-invalid-this': 'off',
            'no-useless-return': 'warn',
            'no-use-before-define': 'off',
            'prefer-const': ['warn', { destructuring: 'all' }],
            'prefer-template': 'warn',
            quotes: ['error', 'single'],
            'react/jsx-filename-extension': ['warn', { extensions: ['.tsx', '.jsx'] }],
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            semi: ['error', 'always']
        }
    },
    {
        files: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}'],
        plugins: { jest: jestPlugin },
        languageOptions: {
            globals: { ...globals.jest }
        },
        rules: {
            ...jestPlugin.configs.recommended.rules
        }
    },
    prettierRecommended
];
