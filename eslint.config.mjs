import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginSecurity from 'eslint-plugin-security';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.d.ts'
    ]
  },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is strictly prohibited due to XSS risk.'
        },
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Assigning to innerHTML is strictly prohibited due to XSS risk.'
        },
        {
          selector: "AssignmentExpression[left.property.name='outerHTML']",
          message: 'Assigning to outerHTML is strictly prohibited due to XSS risk.'
        }
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  }
);
