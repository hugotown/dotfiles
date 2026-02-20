---
name: using-nextjs-cli
description: Documents Next.js CLI tools including create-next-app for project scaffolding and next commands for development, build, and production. Use when creating projects, running dev server, building, or deploying.
---

# Next.js CLI Reference

Complete reference for Next.js command-line interface tools.

## Overview

Next.js provides a comprehensive CLI for project creation and management:
- **create-next-app**: Bootstrap new Next.js projects
- **next dev**: Run development server
- **next build**: Create production builds
- **next start**: Run production server
- **next lint**: Run ESLint checks
- **next info**: Display system information

## Quick Reference

### Project Creation
```bash
npx create-next-app@latest my-app
```

### Development
```bash
next dev              # Start dev server
next dev --turbo      # Start with Turbopack
```

### Production
```bash
next build            # Build for production
next start            # Start production server
```

### Maintenance
```bash
next lint             # Run linting
next info             # Show system info
```

## Detailed Documentation

- [create-next-app](./create-next-app.md) - Project scaffolding and initialization
- [next dev](./next-dev.md) - Development server configuration
- [next build](./next-build.md) - Production build process
- [next start](./next-start.md) - Production server deployment
- [next lint](./next-lint.md) - Linting and code quality
- [next info](./next-info.md) - System diagnostics

## Common Workflows

### Starting a New Project
```bash
# Interactive setup with latest features
npx create-next-app@latest

# Pre-configured TypeScript + Tailwind + App Router
npx create-next-app@latest my-app --typescript --tailwind --app

# Minimal setup
npx create-next-app@latest my-app --no-tailwind --no-eslint
```

### Development Workflow
```bash
# Start development
npm run dev

# Or with custom port
next dev --port 3001

# With Turbopack for faster builds
next dev --turbo
```

### Production Deployment
```bash
# Build and start
npm run build
npm start

# Or directly
next build && next start
```

## Environment Variables

CLI commands respect environment variables:
- `NODE_ENV` - Development or production mode
- `PORT` - Default server port
- `HOSTNAME` - Server hostname

## Best Practices

1. **Use package.json scripts** for common commands
2. **Enable Turbopack** for faster development
3. **Run linting** before commits
4. **Check build output** for optimization opportunities
5. **Use next info** when reporting issues

## Troubleshooting

### Port Already in Use
```bash
# Use different port
next dev --port 3001
```

### Build Failures
```bash
# Get system info for debugging
next info

# Clean build cache
rm -rf .next
next build
```

### Slow Development Server
```bash
# Enable Turbopack
next dev --turbo
```

## Version Information

Check your Next.js version:
```bash
next --version
```

Update to latest:
```bash
npm install next@latest react@latest react-dom@latest
```
