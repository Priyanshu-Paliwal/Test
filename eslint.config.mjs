export default [
  // ESLint recommended configuration directly added to the array
  {
    ignores: ['public/js/require.js',
      'public/js/postmonger.js'
    ],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        require: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly',
        $: 'readonly',
        define: 'readonly',
        document: 'readonly',
        DataTransfer: 'readonly',
        pdfjsLib: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        fetch: 'readonly',
        File: 'readonly',
        atob: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URLSearchParams: 'readonly',
        window: 'readonly',
        DOMParser: 'readonly',
      }
    },
    rules: {
      'no-console': 'error',
      'eqeqeq': 'error',
      'no-unused-vars': 'warn',
      'no-debugger': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'curly': 'error',
      'semi': ['error', 'always'],
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
    },
  },
];