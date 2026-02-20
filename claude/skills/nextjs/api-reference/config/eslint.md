# ESLint Configuration

Next.js provides an integrated ESLint configuration out of the box. Configure ESLint-specific Next.js options in `next.config.js`.

## ESLint in next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignore ESLint errors during builds
    ignoreDuringBuilds: false,

    // Directories to lint during build
    dirs: ['pages', 'app', 'components', 'lib', 'src'],
  },
}

module.exports = nextConfig
```

## ESLint Options

### ignoreDuringBuilds

```javascript
const nextConfig = {
  eslint: {
    // Skip linting during production builds
    // WARNING: Use with caution!
    ignoreDuringBuilds: true,
  },
}
```

**When to use:**
- CI/CD handles linting separately
- Temporary workaround during migration
- Quick deployments (not recommended)

**Warning**: This can lead to bugs in production.

### dirs

```javascript
const nextConfig = {
  eslint: {
    // Specify which directories to lint
    dirs: [
      'pages',
      'app',
      'components',
      'lib',
      'utils',
      'hooks',
      'contexts',
      'services',
    ],
  },
}
```

## ESLint Configuration File

Next.js automatically creates `.eslintrc.json` with recommended rules:

```json
{
  "extends": "next/core-web-vitals"
}
```

### Available Configurations

#### next/core-web-vitals (Recommended)

Includes Core Web Vitals rules:

```json
{
  "extends": "next/core-web-vitals"
}
```

#### next (Base)

Base Next.js rules without Core Web Vitals:

```json
{
  "extends": "next"
}
```

## Custom ESLint Configuration

### Extending Next.js Config

```json
{
  "extends": [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    // Custom rules
  }
}
```

### TypeScript ESLint

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  }
}
```

### Prettier Integration

```json
{
  "extends": [
    "next/core-web-vitals",
    "prettier"
  ],
  "plugins": ["prettier"],
  "rules": {
    "prettier/prettier": "error"
  }
}
```

## Next.js ESLint Rules

### Core Rules

```json
{
  "rules": {
    // No <img> element, use next/image instead
    "@next/next/no-img-element": "error",

    // No <a> in <Link>, not needed in Next.js 13+
    "@next/next/no-html-link-for-pages": "error",

    // No synchronous scripts
    "@next/next/no-sync-scripts": "error",

    // Prevent usage of next/head in app directory
    "@next/next/no-head-element": "error",

    // No duplicate head elements
    "@next/next/no-duplicate-head": "error",

    // Inline scripts need id attribute
    "@next/next/inline-script-id": "error",

    // Prevent Google Fonts without font-display
    "@next/next/google-font-display": "error",

    // Prevent @next/font without font-display
    "@next/next/no-page-custom-font": "error"
  }
}
```

### Warning Rules

```json
{
  "rules": {
    // Prevent manual stylesheet tags
    "@next/next/no-css-tags": "warn",

    // Prevent title in _document.js
    "@next/next/no-title-in-document-head": "warn",

    // No assignment to exports in pages
    "@next/next/no-assign-module-variable": "warn",

    // Prevent before-interactive scripts outside _document
    "@next/next/no-before-interactive-script-outside-document": "warn",

    // Use next/script for external scripts
    "@next/next/no-script-component-in-head": "warn"
  }
}
```

## Custom Rules Configuration

### Disable Specific Rules

```json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "@next/next/no-img-element": "off",
    "react/no-unescaped-entities": "off"
  }
}
```

### Rule Severity Levels

```json
{
  "rules": {
    "@next/next/no-img-element": "error",    // Error
    "@next/next/no-css-tags": "warn",        // Warning
    "@next/next/no-sync-scripts": "off"      // Disabled
  }
}
```

### Per-File Configuration

```json
{
  "overrides": [
    {
      "files": ["*.ts", "*.tsx"],
      "rules": {
        "@typescript-eslint/no-unused-vars": "error"
      }
    },
    {
      "files": ["*.test.ts", "*.test.tsx"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
}
```

## Ignoring Files

### .eslintignore

```
# Dependencies
node_modules/
.pnp/
.pnp.js

# Build output
.next/
out/
dist/
build/

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
```

### Inline Ignore

```typescript
// Disable for next line
// eslint-disable-next-line @next/next/no-img-element
<img src="/image.jpg" alt="Image" />

// Disable for block
/* eslint-disable @next/next/no-img-element */
<img src="/image1.jpg" alt="Image 1" />
<img src="/image2.jpg" alt="Image 2" />
/* eslint-enable @next/next/no-img-element */

// Disable entire file
/* eslint-disable */
```

## Scripts Configuration

### package.json

```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "lint:strict": "next lint --max-warnings 0",
    "lint:dirs": "next lint --dir pages --dir components"
  }
}
```

### Advanced Scripts

```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "lint:strict": "next lint --max-warnings 0",
    "lint:cache": "next lint --cache",
    "lint:quiet": "next lint --quiet",
    "lint:report": "next lint --format json --output-file eslint-report.json"
  }
}
```

## IDE Integration

### VS Code Settings

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

### VS Code Extensions

Install ESLint extension:
```
ext install dbaeumer.vscode-eslint
```

## Complete Configuration Examples

### TypeScript + Prettier

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2021,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint", "prettier"],
  "rules": {
    "prettier/prettier": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@next/next/no-img-element": "error"
  }
}
```

### Strict Configuration

```json
{
  "extends": [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "no-console": "warn",
    "@next/next/no-img-element": "error"
  }
}
```

### Monorepo Configuration

```json
{
  "root": true,
  "extends": "next/core-web-vitals",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "settings": {
    "next": {
      "rootDir": ["apps/*/", "packages/*/"]
    }
  }
}
```

## Environment-Specific Rules

```json
{
  "extends": "next/core-web-vitals",
  "env": {
    "browser": true,
    "node": true,
    "es2021": true,
    "jest": true
  },
  "overrides": [
    {
      "files": ["*.test.ts", "*.test.tsx", "**/__tests__/**"],
      "env": {
        "jest": true
      },
      "rules": {
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
}
```

## Common Plugins

### Import Order

```bash
npm install --save-dev eslint-plugin-import
```

```json
{
  "extends": ["next/core-web-vitals", "plugin:import/recommended"],
  "plugins": ["import"],
  "rules": {
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "newlines-between": "always",
        "alphabetize": {
          "order": "asc"
        }
      }
    ]
  }
}
```

### React Hooks

```json
{
  "extends": ["next/core-web-vitals"],
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### Accessibility (a11y)

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

```json
{
  "extends": ["next/core-web-vitals", "plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"]
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
```

### Pre-commit Hook

```bash
npm install --save-dev husky lint-staged
```

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "git add"]
  }
}
```

## Best Practices

1. **Use next/core-web-vitals**: Start with recommended config
2. **Enable type-aware rules**: For TypeScript projects
3. **Integrate Prettier**: Consistent formatting
4. **Set up pre-commit hooks**: Catch issues early
5. **Run in CI/CD**: Enforce on all code
6. **Use --max-warnings 0**: Treat warnings as errors in CI
7. **Document custom rules**: Explain why rules are disabled

## Common Issues

### Parsing Error

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "ecmaVersion": 2021,
    "sourceType": "module"
  }
}
```

### Module Not Found

```bash
npm install --save-dev eslint-config-next
```

### Rules Not Applied

Clear ESLint cache:

```bash
next lint --no-cache
# or
rm -rf .next
```

### Performance Issues

Enable caching:

```bash
next lint --cache
```

Ignore large files:

```
# .eslintignore
.next/
node_modules/
public/
```

## Troubleshooting

### Check ESLint Version

```bash
npx eslint --version
```

Next.js requires ESLint 7 or higher.

### Debug ESLint

```bash
# Show loaded config
next lint --print-config pages/index.tsx

# Verbose output
next lint --debug
```

### Reset ESLint Config

```bash
# Remove config
rm .eslintrc.json

# Regenerate
next lint
```
