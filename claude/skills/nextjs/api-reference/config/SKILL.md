---
name: configuring-nextjs
description: Documents next.config.js options including images, redirects, rewrites, headers, webpack, turbopack, and experimental features. Use when configuring Next.js build, runtime, or deployment settings.
---

# Configuring Next.js

This skill provides comprehensive documentation for Next.js configuration options through `next.config.js` or `next.config.mjs`. Use this skill when you need to configure Next.js build settings, runtime behavior, or deployment options.

## Skill Contents

### Core Configuration
- **next-config-overview.md** - File structure, ESM vs CommonJS, TypeScript config
- **env.md** - Environment variables, build-time vs runtime configuration
- **output.md** - Build output options (standalone, export, static)
- **basePath.md** - Sub-path deployment configuration
- **i18n.md** - Internationalization and locale configuration

### Asset & Routing Configuration
- **images.md** - Image optimization settings (domains, remotePatterns, loader, formats)
- **redirects.md** - Redirect configuration, permanent vs temporary, pattern matching
- **rewrites.md** - URL rewrites, beforeFiles, afterFiles, fallback strategies
- **headers.md** - Custom HTTP headers, security headers, CORS

### Build & Bundler Configuration
- **webpack.md** - Custom webpack configuration, plugins, loaders
- **turbopack.md** - Turbopack-specific options and settings
- **typescript.md** - TypeScript configuration, strict mode, type checking
- **eslint.md** - ESLint configuration, ignored paths, custom rules

### Advanced Configuration
- **experimental.md** - Experimental features (ppr, typedRoutes, serverActions, etc.)

## When to Use This Skill

Use this skill when you need to:
- Configure Next.js build or runtime settings
- Set up image optimization
- Configure redirects, rewrites, or custom headers
- Customize webpack or Turbopack configuration
- Enable experimental features
- Configure environment variables
- Set up internationalization
- Deploy to sub-paths or custom environments

## Usage Pattern

1. Identify the configuration area you need to modify
2. Refer to the relevant markdown file for syntax and options
3. Apply the configuration to your `next.config.js` or `next.config.mjs`
4. Test the configuration in development before deploying

## Configuration File Formats

Next.js supports multiple configuration file formats:
- `next.config.js` - CommonJS format
- `next.config.mjs` - ES Modules format
- `next.config.ts` - TypeScript format (Next.js 15+)

Refer to `next-config-overview.md` for detailed information on file formats and structure.
