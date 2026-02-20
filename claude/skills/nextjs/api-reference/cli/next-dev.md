# next dev

Start the Next.js development server with hot reloading and development features.

## Syntax

```bash
next dev [options]
```

## Description

Starts Next.js in development mode with:
- Hot Module Replacement (HMR)
- Fast Refresh for React components
- Error overlay
- Development-only warnings
- Source maps for debugging

## Options

### `--port` / `-p`
Specify server port (default: 3000).

```bash
next dev --port 3001
next dev -p 4000
```

### `--hostname` / `-H`
Specify hostname (default: 0.0.0.0).

```bash
next dev --hostname localhost
next dev -H 127.0.0.1
```

### `--turbo`
Enable Turbopack (beta) for faster bundling.

```bash
next dev --turbo
```

Benefits:
- Up to 700x faster updates
- Up to 10x faster startup
- Rust-based bundler

### `--experimental-https`
Enable HTTPS in development.

```bash
next dev --experimental-https
```

Creates self-signed certificate automatically.

### `--experimental-https-key`
Path to custom HTTPS key file.

```bash
next dev --experimental-https --experimental-https-key ./certificates/key.pem
```

### `--experimental-https-cert`
Path to custom HTTPS certificate.

```bash
next dev --experimental-https --experimental-https-cert ./certificates/cert.pem
```

### `--experimental-https-ca`
Path to custom HTTPS CA certificate.

```bash
next dev --experimental-https --experimental-https-ca ./certificates/ca.pem
```

## Environment Variables

### NODE_ENV
Automatically set to `development`.

### PORT
Override default port via environment:
```bash
PORT=3001 next dev
```

### HOSTNAME
Override default hostname:
```bash
HOSTNAME=localhost next dev
```

## Features in Development Mode

### Hot Module Replacement (HMR)
Instant updates without full page reload:
- React component updates
- CSS changes
- API route modifications

### Fast Refresh
Preserves component state during edits:
- Local component state maintained
- Props and hooks preserved
- Instant feedback

### Error Overlay
Full-screen development errors:
- Compile-time errors
- Runtime errors
- Source code context
- Stack traces

### Development Warnings
Console warnings for:
- Missing keys in lists
- Legacy API usage
- Performance issues
- Accessibility concerns

## Usage Examples

### Basic Development
```bash
# Start on default port 3000
next dev

# Or via package.json
npm run dev
```

### Custom Port
```bash
# Specific port
next dev --port 8080

# Via environment variable
PORT=8080 next dev
```

### Network Access
```bash
# Allow network access (default)
next dev --hostname 0.0.0.0

# Local only
next dev --hostname localhost
```

### With Turbopack
```bash
# Enable Turbopack for faster builds
next dev --turbo

# In package.json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}
```

### HTTPS Development
```bash
# Auto-generated certificate
next dev --experimental-https

# Custom certificates
next dev --experimental-https \
  --experimental-https-key ./localhost-key.pem \
  --experimental-https-cert ./localhost.pem
```

## Development Server Behavior

### File Watching
Automatically watches:
- `app/` or `pages/` directory
- `components/` directory
- `lib/` directory
- `public/` directory
- `next.config.js`
- Environment files

### Auto Compilation
Compiles on-demand:
- First request triggers compilation
- Subsequent requests use cached builds
- Changed files recompile automatically

### Development Routes
Special routes in development:
- `/__nextjs_original-stack-frame` - Error stack traces
- `/_next/static/` - Static assets
- `/_next/webpack-hmr` - HMR WebSocket

## Performance Optimization

### Faster Startup
```bash
# Use Turbopack
next dev --turbo

# Reduce initial compile time
# Edit only files you need
```

### Memory Management
```bash
# Increase Node.js memory
NODE_OPTIONS='--max-old-space-size=4096' next dev
```

### Disable Features
In `next.config.js`:
```javascript
module.exports = {
  // Disable source maps in dev for faster builds
  productionBrowserSourceMaps: false,

  // Reduce bundle size
  swcMinify: true,
}
```

## Common Workflows

### Local Development
```bash
# Start server
next dev

# Open browser
open http://localhost:3000
```

### Team Development
```bash
# Allow network access
next dev --hostname 0.0.0.0

# Team members access via
# http://<your-ip>:3000
```

### Mobile Testing
```bash
# Start with network access
next dev --hostname 0.0.0.0

# Access from mobile device
# http://<computer-ip>:3000
```

### API Development
```bash
# Start server
next dev

# Test API routes
curl http://localhost:3000/api/hello
```

### HTTPS Testing
```bash
# Enable HTTPS
next dev --experimental-https

# Access via
# https://localhost:3000
```

## Debugging

### Enable Verbose Logging
```bash
NODE_OPTIONS='--inspect' next dev
```

Attach debugger at: chrome://inspect

### Debug Specific Port
```bash
NODE_OPTIONS='--inspect=9229' next dev
```

### Source Maps
Enabled by default in development.

View original source in browser DevTools.

## Turbopack Features

### Supported Features
- Hot Module Replacement
- Fast Refresh
- CSS/SCSS/Sass
- CSS Modules
- PostCSS
- Image optimization
- Font optimization
- Styled JSX
- TypeScript
- JSX/TSX

### Current Limitations
Some features may not work with `--turbo`:
- Custom webpack configuration
- Certain webpack loaders
- Some Babel plugins

Check compatibility: https://nextjs.org/docs/architecture/turbopack

## Configuration

### next.config.js Integration
```javascript
module.exports = {
  // Development-specific config
  reactStrictMode: true,

  // Custom dev server
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.example.com/:path*',
      },
    ]
  },
}
```

### Environment Files
Loaded in development:
- `.env.development.local`
- `.env.local`
- `.env.development`
- `.env`

Priority: `.env.development.local` > `.env.local` > `.env.development` > `.env`

## Error Handling

### Compilation Errors
Shown in:
- Terminal
- Browser overlay
- Browser console

### Runtime Errors
Displayed in:
- Error overlay
- Browser console
- Terminal (for API routes)

### Network Errors
```bash
# Port in use
Error: listen EADDRINUSE: address already in use :::3000

# Solution: Use different port
next dev --port 3001

# Or kill process on port
lsof -ti:3000 | xargs kill
```

## Best Practices

1. **Use Turbopack**: Enable with `--turbo` for faster development
2. **Specific Hostname**: Use `localhost` for security in public networks
3. **Environment Variables**: Use `.env.local` for secrets
4. **Hot Reload**: Save files to trigger automatic updates
5. **Error Checking**: Fix errors as they appear in overlay
6. **Network Testing**: Use `0.0.0.0` for mobile device testing

## Troubleshooting

### Slow Hot Reload
```bash
# Enable Turbopack
next dev --turbo

# Increase memory
NODE_OPTIONS='--max-old-space-size=4096' next dev

# Clear cache
rm -rf .next
next dev
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
next dev --port 3001
```

### HMR Not Working
```bash
# Check WebSocket connection in DevTools
# Look for /_next/webpack-hmr

# Restart dev server
# Ctrl+C then next dev

# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
```

### HTTPS Certificate Errors
```bash
# Trust self-signed certificate in browser
# Click "Advanced" -> "Proceed to localhost"

# Or use custom certificate
next dev --experimental-https \
  --experimental-https-key ./key.pem \
  --experimental-https-cert ./cert.pem
```

## Package.json Scripts

### Basic Setup
```json
{
  "scripts": {
    "dev": "next dev"
  }
}
```

### With Options
```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "dev:port": "next dev --port 3001",
    "dev:https": "next dev --experimental-https",
    "dev:network": "next dev --hostname 0.0.0.0"
  }
}
```

### Cross-Platform
```json
{
  "scripts": {
    "dev": "next dev",
    "dev:windows": "set PORT=3001&& next dev",
    "dev:unix": "PORT=3001 next dev"
  }
}
```

## Related Commands

- [create-next-app](./create-next-app.md) - Create new project
- [next build](./next-build.md) - Build for production
- [next start](./next-start.md) - Start production server
- [next lint](./next-lint.md) - Run linting

## Learn More

- [Fast Refresh](https://nextjs.org/docs/architecture/fast-refresh)
- [Turbopack](https://nextjs.org/docs/architecture/turbopack)
- [Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
