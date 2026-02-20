# create-next-app

Bootstrap new Next.js applications with optimal configuration.

## Syntax

```bash
npx create-next-app@latest [project-name] [options]
```

## Description

`create-next-app` is the official Next.js project scaffolding tool. It sets up a new Next.js application with recommended configurations, file structure, and dependencies.

## Interactive Mode

Running without arguments starts interactive setup:

```bash
npx create-next-app@latest
```

Prompts for:
- Project name
- TypeScript usage
- ESLint configuration
- Tailwind CSS
- `src/` directory
- App Router
- Import alias customization

## Options

### `--typescript` / `--ts`
Enable TypeScript configuration.

```bash
npx create-next-app@latest my-app --typescript
```

Creates:
- `tsconfig.json`
- TypeScript files (`.ts`, `.tsx`)
- Type definitions

### `--javascript` / `--js`
Use JavaScript (default if not specified).

```bash
npx create-next-app@latest my-app --javascript
```

### `--tailwind`
Install and configure Tailwind CSS.

```bash
npx create-next-app@latest my-app --tailwind
```

Adds:
- `tailwind.config.js`
- `postcss.config.js`
- Tailwind directives in CSS

### `--eslint`
Include ESLint configuration.

```bash
npx create-next-app@latest my-app --eslint
```

Creates:
- `.eslintrc.json`
- `eslint-config-next` package

### `--app`
Use App Router (recommended).

```bash
npx create-next-app@latest my-app --app
```

Creates `app/` directory with:
- `layout.tsx`
- `page.tsx`
- React Server Components by default

### `--src-dir`
Create `src/` directory for application code.

```bash
npx create-next-app@latest my-app --src-dir
```

Structure:
```
my-app/
├── src/
│   └── app/
│       ├── layout.tsx
│       └── page.tsx
├── public/
└── package.json
```

### `--import-alias`
Customize import alias (default: `@/*`).

```bash
npx create-next-app@latest my-app --import-alias "@components/*"
```

Enables imports like:
```typescript
import Button from '@components/Button'
```

### `--use-npm`
Use npm as package manager.

```bash
npx create-next-app@latest my-app --use-npm
```

### `--use-pnpm`
Use pnpm as package manager.

```bash
npx create-next-app@latest my-app --use-pnpm
```

### `--use-yarn`
Use Yarn as package manager.

```bash
npx create-next-app@latest my-app --use-yarn
```

### `--use-bun`
Use Bun as package manager and runtime.

```bash
npx create-next-app@latest my-app --use-bun
```

### `--example` / `-e`
Bootstrap from official example.

```bash
npx create-next-app@latest my-app --example with-tailwindcss
```

Browse examples: https://github.com/vercel/next.js/tree/canary/examples

### `--example-path`
Use specific example from repository.

```bash
npx create-next-app@latest my-app --example-path examples/with-typescript
```

### `--reset-preferences`
Reset saved configuration preferences.

```bash
npx create-next-app@latest --reset-preferences
```

## Common Use Cases

### Full-Featured Modern App
```bash
npx create-next-app@latest my-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

### Minimal Setup
```bash
npx create-next-app@latest my-app \
  --javascript \
  --no-tailwind \
  --no-eslint \
  --app
```

### From Example
```bash
# E-commerce starter
npx create-next-app@latest my-store --example with-commerce

# Blog with MDX
npx create-next-app@latest my-blog --example blog-starter

# Authentication
npx create-next-app@latest my-app --example with-clerk
```

### Corporate/Enterprise
```bash
npx create-next-app@latest enterprise-app \
  --typescript \
  --eslint \
  --app \
  --src-dir \
  --use-pnpm \
  --import-alias "@/*"
```

## Project Structure

### With App Router (`--app`)
```
my-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── public/
│   ├── next.svg
│   └── vercel.svg
├── next.config.js
├── package.json
├── tsconfig.json (if --typescript)
├── tailwind.config.js (if --tailwind)
└── .eslintrc.json (if --eslint)
```

### With src/ Directory (`--src-dir`)
```
my-app/
├── src/
│   └── app/
│       ├── layout.tsx
│       └── page.tsx
├── public/
├── next.config.js
└── package.json
```

## Scripts Created

Generated `package.json` includes:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

For Turbopack:
```json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}
```

## Examples Repository

Official examples: https://github.com/vercel/next.js/tree/canary/examples

Popular examples:
- `api-routes` - API route examples
- `auth0` - Auth0 authentication
- `blog-starter` - Blog with MDX
- `cms-*` - CMS integrations (Contentful, Sanity, etc.)
- `with-docker` - Docker setup
- `with-graphql` - GraphQL integration
- `with-mongodb` - MongoDB connection
- `with-tailwindcss` - Tailwind setup
- `with-typescript` - TypeScript configuration

## Configuration Options

### TypeScript Configuration
Generated `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### ESLint Configuration
Generated `.eslintrc.json`:
```json
{
  "extends": "next/core-web-vitals"
}
```

### Tailwind Configuration
Generated `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## Best Practices

1. **Use Latest Version**: Always use `@latest` tag
2. **Choose App Router**: Use `--app` for new projects
3. **Enable TypeScript**: Better type safety and IDE support
4. **Include ESLint**: Catch errors early
5. **Organize with src/**: Use `--src-dir` for larger projects
6. **Customize Import Alias**: Set up path aliases from start

## Troubleshooting

### Permission Errors
```bash
# Clear npm cache
npm cache clean --force

# Run with sudo (not recommended)
sudo npx create-next-app@latest my-app
```

### Port Already in Use
Created app uses port 3000 by default. Change in dev script:
```json
{
  "scripts": {
    "dev": "next dev --port 3001"
  }
}
```

### Package Manager Detection
Specify explicitly if auto-detection fails:
```bash
npx create-next-app@latest my-app --use-npm
```

### Network Issues
```bash
# Use different registry
npm config set registry https://registry.npmjs.org/

# Or specify during creation
npx --registry https://registry.npmjs.org/ create-next-app@latest
```

## Next Steps

After creation:

```bash
cd my-app
npm run dev
```

Visit http://localhost:3000

## Version Support

- Requires Node.js 18.17 or later
- Compatible with npm, yarn, pnpm, and bun
- Uses latest stable Next.js version by default

## Related Commands

- [next dev](./next-dev.md) - Start development server
- [next build](./next-build.md) - Build for production
- [next start](./next-start.md) - Start production server
