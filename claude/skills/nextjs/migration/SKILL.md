---
name: migrating-nextjs-applications
description: Guides for migrating to Next.js from other frameworks and upgrading between Next.js versions. Use when migrating from CRA, Vite, or upgrading from Pages Router to App Router.
---

# Migrating Next.js Applications

This skill provides comprehensive guidance for migrating to Next.js from other frameworks and upgrading between Next.js versions.

## Use Cases

- Migrating from Create React App (CRA) to Next.js
- Migrating from Vite to Next.js
- Upgrading from Pages Router to App Router
- Upgrading between major Next.js versions (13→14→15→16)
- Using codemods for automated migrations

## Available Guides

### Migration from Other Frameworks

- **[from-cra.md](./from-cra.md)** - Complete guide for migrating from Create React App
- **[from-vite.md](./from-vite.md)** - Complete guide for migrating from Vite

### Next.js Internal Migrations

- **[pages-to-app-router.md](./pages-to-app-router.md)** - Comprehensive migration from Pages Router to App Router
- **[version-upgrades.md](./version-upgrades.md)** - Upgrading between major Next.js versions

### Automation Tools

- **[codemods.md](./codemods.md)** - Using Next.js codemods for automated migrations

## General Migration Principles

1. **Incremental Migration**: Most migrations can be done incrementally without full rewrites
2. **Test Coverage**: Ensure good test coverage before starting migration
3. **Backup**: Always work in a version-controlled environment with backups
4. **Dependencies**: Update dependencies gradually to avoid breaking changes
5. **Documentation**: Keep track of changes and decisions during migration

## When to Use This Skill

Use this skill when you need to:
- Move an existing React application to Next.js
- Modernize a Pages Router application to use App Router
- Upgrade to the latest Next.js version
- Automate migration tasks using codemods
- Understand migration best practices and common pitfalls
