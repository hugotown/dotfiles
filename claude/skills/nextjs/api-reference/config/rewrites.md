# Rewrites Configuration

Rewrites allow you to map an incoming request path to a different destination path without changing the URL in the browser. Configure rewrites in `next.config.js`.

## Basic Rewrite

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/about',
        destination: '/about-us',
      },
    ]
  },
}

module.exports = nextConfig
```

## Rewrites vs Redirects

| Feature | Rewrites | Redirects |
|---------|----------|-----------|
| URL changes | No | Yes |
| Status code | 200 | 307/308 |
| SEO impact | Preserves URL | Transfers to new URL |
| Use case | Proxy/mask URL | Permanent moves |

## Rewrite Phases

Rewrites can be applied at three different phases:

```javascript
async rewrites() {
  return {
    beforeFiles: [
      // Checked before pages/public files
      {
        source: '/some-page',
        destination: '/somewhere-else',
      },
    ],
    afterFiles: [
      // Checked after pages/public files
      {
        source: '/non-existent',
        destination: '/somewhere-else',
      },
    ],
    fallback: [
      // Checked after both pages/public files and dynamic routes
      {
        source: '/:path*',
        destination: '/api/fallback',
      },
    ],
  }
}
```

### Phase Order

1. **beforeFiles**: Before checking pages and public files
2. Check Next.js pages
3. Check public directory files
4. **afterFiles**: After pages/public, before dynamic routes
5. Check dynamic routes
6. **fallback**: After everything else

## Rewrite Object Properties

```typescript
{
  source: string          // Incoming request path pattern
  destination: string     // Path to rewrite to
  basePath?: false        // Don't include basePath (default: true)
  locale?: false          // Don't include locale (default: true)
  has?: HasMatcher[]      // Additional conditions
  missing?: HasMatcher[]  // Inverse of has
}
```

## Path Matching

### Exact Match

```javascript
{
  source: '/old-about',
  destination: '/about',
}
```

### Path Parameters

```javascript
{
  source: '/blog/:slug',
  destination: '/news/:slug',
}

// /blog/hello → shows /news/hello content at /blog/hello URL
```

### Catch-all Routes

```javascript
{
  source: '/blog/:slug*',
  destination: '/news/:slug*',
}

// /blog/a/b/c → shows /news/a/b/c content
```

### Regex Matching

```javascript
{
  source: '/old-blog/:slug(\\d{1,})',
  destination: '/blog/:slug',
}

// Matches: /old-blog/123 → /blog/123
// Doesn't match: /old-blog/abc
```

## Proxying to External URLs

### API Proxy

```javascript
{
  source: '/api/external/:path*',
  destination: 'https://api.example.com/:path*',
}

// /api/external/users → https://api.example.com/users
```

### CDN Proxy

```javascript
{
  source: '/images/:path*',
  destination: 'https://cdn.example.com/images/:path*',
}
```

### Backend Proxy

```javascript
{
  source: '/api/backend/:path*',
  destination: 'http://backend.internal:8080/:path*',
}
```

## Conditional Rewrites

### Header Matching

```javascript
{
  source: '/dashboard',
  has: [
    {
      type: 'header',
      key: 'x-rewrite-me',
    },
  ],
  destination: '/admin/dashboard',
}
```

### Cookie Matching

```javascript
{
  source: '/home',
  has: [
    {
      type: 'cookie',
      key: 'authorized',
      value: 'true',
    },
  ],
  destination: '/dashboard',
}
```

### Query String Matching

```javascript
{
  source: '/search',
  has: [
    {
      type: 'query',
      key: 'type',
      value: 'advanced',
    },
  ],
  destination: '/search/advanced',
}
```

### Host Matching

```javascript
{
  source: '/:path*',
  has: [
    {
      type: 'host',
      value: 'admin.example.com',
    },
  ],
  destination: '/admin/:path*',
}
```

## Using `missing` Matcher

Rewrite when condition is NOT met:

```javascript
{
  source: '/:path*',
  missing: [
    {
      type: 'header',
      key: 'x-skip-rewrite',
    },
  ],
  destination: '/rewritten/:path*',
}
```

## basePath and Locale

### Excluding basePath

```javascript
{
  source: '/no-basepath',
  destination: '/with-basepath',
  basePath: false,
}
```

### Excluding Locale

```javascript
{
  source: '/en/:path*',
  destination: '/:path*',
  locale: false,
}
```

## Common Rewrite Patterns

### API Proxy Pattern

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'https://api.example.com/:path*',
    },
  ]
}
```

### Multi-tenant Pattern

```javascript
async rewrites() {
  return [
    {
      source: '/:org/:path*',
      destination: '/app/:org/:path*',
    },
  ]
}
```

### A/B Testing Pattern

```javascript
async rewrites() {
  return [
    {
      source: '/product/:id',
      has: [
        {
          type: 'cookie',
          key: 'ab-test',
          value: 'variant-b',
        },
      ],
      destination: '/product-variant-b/:id',
    },
    {
      source: '/product/:id',
      destination: '/product-variant-a/:id',
    },
  ]
}
```

### Internationalization Pattern

```javascript
async rewrites() {
  return [
    {
      source: '/:locale(en|fr|de)/:path*',
      destination: '/app/:locale/:path*',
    },
  ]
}
```

### Microservices Pattern

```javascript
async rewrites() {
  return [
    {
      source: '/auth/:path*',
      destination: 'http://auth-service:3001/:path*',
    },
    {
      source: '/payments/:path*',
      destination: 'http://payment-service:3002/:path*',
    },
    {
      source: '/users/:path*',
      destination: 'http://user-service:3003/:path*',
    },
  ]
}
```

### Legacy App Migration

```javascript
async rewrites() {
  return {
    beforeFiles: [
      // New pages take precedence
    ],
    afterFiles: [
      // Fallback to legacy app
      {
        source: '/:path*',
        destination: 'http://legacy-app.internal/:path*',
      },
    ],
  }
}
```

## Advanced Examples

### Dynamic Rewrites from Database

```javascript
async rewrites() {
  const dynamicRewrites = await fetchRewritesFromDB()

  return [
    ...dynamicRewrites,
    {
      source: '/blog/:slug',
      destination: '/posts/:slug',
    },
  ]
}
```

### Environment-Based Rewrites

```javascript
async rewrites() {
  const apiUrl = process.env.NODE_ENV === 'production'
    ? 'https://api.example.com'
    : 'http://localhost:4000'

  return [
    {
      source: '/api/:path*',
      destination: `${apiUrl}/:path*`,
    },
  ]
}
```

### Feature Flag Rewrites

```javascript
async rewrites() {
  return [
    {
      source: '/new-feature',
      has: [
        {
          type: 'cookie',
          key: 'feature-flag',
          value: 'enabled',
        },
      ],
      destination: '/beta/new-feature',
    },
    {
      source: '/new-feature',
      destination: '/coming-soon',
    },
  ]
}
```

## Complete Example

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // Subdomain rewrites
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: 'blog.example.com',
            },
          ],
          destination: '/blog/:path*',
        },
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              value: 'docs.example.com',
            },
          ],
          destination: '/docs/:path*',
        },
      ],
      afterFiles: [
        // API proxy
        {
          source: '/api/v1/:path*',
          destination: 'https://api.example.com/v1/:path*',
        },

        // A/B testing
        {
          source: '/products/:id',
          has: [
            {
              type: 'cookie',
              key: 'experiment',
              value: 'new-layout',
            },
          ],
          destination: '/products-new/:id',
        },
      ],
      fallback: [
        // Catch-all proxy to CMS
        {
          source: '/:path*',
          destination: 'https://cms.example.com/:path*',
        },
      ],
    }
  },
}

module.exports = nextConfig
```

## Best Practices

1. **Use appropriate phase**: Choose beforeFiles, afterFiles, or fallback based on need
2. **Prefer specific patterns**: Avoid overly broad catch-alls
3. **Document complex rewrites**: Add comments for regex patterns
4. **Test thoroughly**: Verify rewrite behavior in all scenarios
5. **Consider performance**: External proxies add latency
6. **Handle CORS**: Configure CORS for proxied APIs
7. **Use environment variables**: Don't hardcode URLs

## Headers with Rewrites

Rewrites preserve original request headers. For proxying, you may need to modify headers:

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'https://api.example.com/:path*',
    },
  ]
}

async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'X-Forwarded-Host',
          value: 'example.com',
        },
      ],
    },
  ]
}
```

## Common Issues

### Rewrite Not Working

Check:
1. Phase (beforeFiles vs afterFiles vs fallback)
2. File exists in public directory (blocks afterFiles)
3. Page exists (blocks beforeFiles if has priority)
4. Pattern matching correctly
5. Conditions (has/missing) are met

### External Proxy CORS

```javascript
// Add CORS headers for proxied APIs
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
      ],
    },
  ]
}
```

### Infinite Loops

```javascript
// Bad: Can create loops
{
  source: '/:path*',
  destination: '/proxy/:path*',
}
{
  source: '/proxy/:path*',
  destination: '/:path*',
}
```

## Testing Rewrites

```bash
# The URL should stay the same, but content from destination is served
curl -i http://localhost:3000/about

# Response shows content from /about-us but URL is /about
```

## Performance Considerations

1. **External proxies add latency**: Consider caching
2. **Rewrites are evaluated on every request**: Keep patterns simple
3. **Database lookups**: Cache dynamic rewrites
4. **Regex complexity**: Simple patterns perform better
