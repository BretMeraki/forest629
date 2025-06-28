module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Prevent direct path module imports outside of FileSystem utility
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['path'],
            message: 'Use FileSystem utility instead of direct path imports in most cases. If path import is needed, use "import * as path from \'path\'"'
          },
          {
            group: ['fs', 'fs/promises', 'node:fs', 'node:fs/promises'],
            message: 'Use FileSystem utility instead of direct fs imports. All file operations should go through the centralized FileSystem abstraction.'
          }
        ],
            message: 'Use FileSystem utility instead of direct path imports in most cases. If path import is needed, use "import * as path from \'path\'"'
          }
        ]
      }
    ],
    
    // Enforce consistent import ordering
    'sort-imports': [
      'error',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true
      }
    ],
    
    // Prevent usage of path.join without proper import
    'no-undef': 'error',
    
    // Ensure proper ESM import syntax
    'prefer-const': 'error',
    'no-var': 'error'
  },
  
  // Custom rules for Forest server specific patterns
  overrides: [
    {
      files: ['modules/utils/file-system.js', 'modules/core-infrastructure.js'],
      rules: {
        // Allow path imports in utility files and core infrastructure
        'no-restricted-imports': 'off'
      }
    },
    {
      files: ['**/*.test.js', '__tests__/**/*.js'],
      rules: {
        // Allow path imports in test files
        'no-restricted-imports': 'off'
      }
    }
  ]
};