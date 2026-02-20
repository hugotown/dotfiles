---
name: nextjs-patterns-and-guides
description: Documents common Next.js implementation patterns including authentication, internationalization, multi-tenancy, PWA, MDX, and deployment strategies. Use when implementing common features or following best practices.
---

# Next.js Patterns and Guides

This skill provides comprehensive documentation for common Next.js implementation patterns and best practices. Use this when implementing features that require established patterns or architectural decisions.

## Available Patterns

### Authentication (`authentication.md`)
Complete authentication patterns using NextAuth.js, session management, middleware protection, and custom auth implementations.

### Internationalization (`internationalization.md`)
i18n routing strategies, translation management, locale detection, and RTL (Right-to-Left) language support.

### Multi-Tenancy (`multi-tenancy.md`)
Tenant isolation patterns, subdomain routing, database-per-tenant architecture, and shared database strategies.

### Static Exports (`static-exports.md`)
Static site generation, output configuration, deployment strategies, and limitations of static exports.

### Progressive Web Apps (`pwa.md`)
PWA implementation, service workers, offline support, web app manifests, and caching strategies.

### MDX Integration (`mdx.md`)
MDX setup and configuration, custom components, remote MDX content, and content collections management.

### Deployment (`deployment.md`)
Deployment strategies for Vercel, Docker, self-hosting, Node.js servers, and static hosting platforms.

### Environment Variables (`environment-variables.md`)
Runtime vs build-time variables, NEXT_PUBLIC_ prefix usage, environment validation, and security best practices.

### Analytics (`analytics.md`)
Web Vitals tracking, custom metrics implementation, and third-party analytics integration.

### Security (`security.md`)
Content Security Policy (CSP), security headers, CORS configuration, input sanitization, and rate limiting.

## When to Use This Skill

Use this skill when you need to:
- Implement authentication or authorization in a Next.js application
- Add internationalization support with multiple languages
- Build multi-tenant SaaS applications
- Configure static exports for deployment
- Create Progressive Web Apps with Next.js
- Integrate MDX for content-driven applications
- Deploy Next.js applications to various platforms
- Manage environment variables securely
- Implement analytics and monitoring
- Enhance application security

## Best Practices

1. **Choose the Right Pattern**: Select patterns based on your application requirements and scale
2. **Follow Next.js Conventions**: Adhere to Next.js file-system routing and conventions
3. **Optimize Performance**: Use appropriate rendering strategies (SSG, SSR, ISR)
4. **Security First**: Implement security patterns from the start
5. **Type Safety**: Use TypeScript for better development experience
6. **Testing**: Write tests for critical patterns and flows
7. **Documentation**: Document custom patterns specific to your application

## Integration with Other Skills

This skill works well with:
- `nextjs-app-router`: For App Router specific implementations
- `nextjs-pages-router`: For Pages Router specific implementations
- `nextjs-api-reference`: For API and configuration details
- `nextjs-testing`: For testing pattern implementations

## Contributing

When adding new patterns:
1. Create a dedicated markdown file for the pattern
2. Include implementation guides with code examples
3. Document best practices and common pitfalls
4. Provide real-world use cases
5. Update this main SKILL.md file to reference the new pattern
