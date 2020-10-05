module.exports = {
  root: true,
  env: {
    browser: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:jest/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
      jsx: true
    }
  },
  plugins: [
    '@typescript-eslint',
    'babel',
    'import',
    'jest',
    'jsx-a11y',
    'node',
    'prettier',
    'react',
    'react-hooks',
    'security',
    'xss'
  ],
  rules: {
    curly: 'warn',
    'import/extensions': [
      'error',
      {
        ts: 'never',
        tsx: 'never',
        ejs: 'always',
        jsx: 'never',
        js: 'never'
      }
    ],
    'import/prefer-default-export': 'off',
    'no-console': [
      'warn',
      {
        allow: ['warn', 'error', 'info']
      }
    ],
    'no-else-return': 'warn',
    'no-invalid-this': 0,
    'no-magic-numbers': 0,
    'no-useless-return': 'warn',
    'no-use-before-define': ['off'],
    'prefer-const': [
      'warn',
      {
        destructuring: 'all'
      }
    ],
    'prefer-template': 'warn',
    'prettier/prettier': 'error',
    quotes: [2, 'single'],
    'react/jsx-filename-extension': [
      'warn',
      {
        extensions: ['.tsx', '.jsx']
      }
    ],
    'react/jsx-uses-react': 2,
    'react/jsx-uses-vars': 2,
    'react/react-in-jsx-scope': 2,
    'react/sort-comp': 0,
    semi: [2, 'always'],
    strict: [2, 'never']
  },
  settings: {
    react: {
      version: 'detect'
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        paths: ['./src']
      }
    }
  }
};
