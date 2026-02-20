# generateViewport

The `generateViewport()` function allows you to customize the initial viewport settings for the page, separated from other metadata generation.

## Function Signature

```typescript
import { Viewport } from 'next'

export function generateViewport(): Viewport
```

## Return Value

Returns a `Viewport` object with viewport configuration.

## Viewport Object Fields

```typescript
type Viewport = {
  width?: string | number
  height?: string | number
  initialScale?: number
  minimumScale?: number
  maximumScale?: number
  userScalable?: boolean
  viewportFit?: 'auto' | 'cover' | 'contain'
  interactiveWidget?: 'resizes-visual' | 'resizes-content' | 'overlays-content'

  // Theme color
  themeColor?:
    | string
    | { media?: string; color: string }[]

  // Color scheme
  colorScheme?: 'normal' | 'light' | 'dark' | 'only light' | 'only dark'
}
```

## Usage Examples

### Basic Viewport

```typescript
// app/layout.tsx
import { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

### Dynamic Viewport Generation

```typescript
// app/layout.tsx
import { Viewport } from 'next'

export function generateViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 5,
    userScalable: true
  }
}
```

### With Theme Color

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000'
}
```

### Responsive Theme Color

```typescript
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ]
}
```

### Full Viewport Configuration

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  height: 'device-height',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#3b82f6',
  colorScheme: 'light dark'
}
```

### PWA Viewport

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000'
}
```

### Mobile-Optimized

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,  // Disable zoom for app-like experience
  viewportFit: 'cover'  // For notched devices
}
```

### Dynamic Theme Based on Route

```typescript
// app/[theme]/layout.tsx
import { Viewport } from 'next'

export function generateViewport({
  params
}: {
  params: { theme: string }
}): Viewport {
  const themeColor = params.theme === 'dark' ? '#000000' : '#ffffff'

  return {
    width: 'device-width',
    initialScale: 1,
    themeColor
  }
}
```

### Interactive Widget Handling

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content'  // Adjusts for on-screen keyboard
}
```

### Color Scheme Preference

```typescript
export const viewport: Viewport = {
  colorScheme: 'dark',  // Force dark mode
  themeColor: '#0f172a'
}
```

### Multi-Theme Application

```typescript
export const viewport: Viewport = {
  colorScheme: 'light dark',  // Support both
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ]
}
```

### Game or Immersive App

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  height: 'device-height',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  colorScheme: 'only dark',
  themeColor: '#000000'
}
```

### E-commerce Site

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,  // Allow zoom for product images
  themeColor: '#3b82f6',
  colorScheme: 'light'
}
```

### Blog with Reader Mode

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 0.5,   // Allow zoom out
  maximumScale: 3,     // Allow zoom in for readability
  userScalable: true,
  colorScheme: 'light dark'
}
```

## Generated HTML Output

The viewport configuration generates these meta tags:

```html
<!-- Basic viewport -->
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- Full viewport -->
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover">

<!-- Theme color -->
<meta name="theme-color" content="#000000">

<!-- Responsive theme color -->
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">

<!-- Color scheme -->
<meta name="color-scheme" content="light dark">
```

## Best Practices

1. **Always Set Basic Viewport**
   ```typescript
   export const viewport: Viewport = {
     width: 'device-width',
     initialScale: 1
   }
   ```

2. **Consider Mobile Users**
   ```typescript
   // Allow pinch-to-zoom for accessibility
   export const viewport: Viewport = {
     width: 'device-width',
     initialScale: 1,
     userScalable: true  // ✅ Don't disable unless app-like
   }
   ```

3. **Use Theme Colors**
   ```typescript
   // Match your brand color
   export const viewport: Viewport = {
     themeColor: '#your-brand-color'
   }
   ```

4. **Support Dark Mode**
   ```typescript
   export const viewport: Viewport = {
     colorScheme: 'light dark',
     themeColor: [
       { media: '(prefers-color-scheme: light)', color: '#ffffff' },
       { media: '(prefers-color-scheme: dark)', color: '#000000' }
     ]
   }
   ```

5. **Use viewportFit for Notched Devices**
   ```typescript
   export const viewport: Viewport = {
     viewportFit: 'cover'  // Extends into safe areas on iPhone X+
   }
   ```

6. **Don't Disable Zoom Unless Necessary**
   ```typescript
   // ❌ Bad for accessibility
   maximumScale: 1,
   userScalable: false

   // ✅ Allow zoom
   userScalable: true
   ```

## Common Patterns

### Standard Website

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff'
}
```

### Progressive Web App

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000'
}
```

### Dark Mode App

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
  themeColor: '#0f172a'
}
```

### Responsive App with Theme Switching

```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' }
  ]
}
```

## Viewport Properties Explained

### width
- `'device-width'` - Use device's width (recommended)
- Number - Fixed width in pixels

### height
- `'device-height'` - Use device's height
- Number - Fixed height in pixels

### initialScale
- Number (0.1 - 10) - Initial zoom level (1 = 100%)

### minimumScale
- Number (0.1 - 10) - Minimum zoom level

### maximumScale
- Number (0.1 - 10) - Maximum zoom level

### userScalable
- `true` - Allow user to zoom (recommended)
- `false` - Disable zoom

### viewportFit
- `'auto'` - Default behavior
- `'cover'` - Extend into safe areas (notched devices)
- `'contain'` - Stay within safe areas

### themeColor
- Sets the browser UI color
- Can be responsive based on color scheme

### colorScheme
- `'light'` - Light mode only
- `'dark'` - Dark mode only
- `'light dark'` - Support both
- `'only light'` / `'only dark'` - Force mode

## Notes

- Separated from `generateMetadata()` for performance
- Use `viewport` export for static configuration
- Use `generateViewport()` for dynamic configuration
- Only one can be exported per page/layout
- Viewport is inherited by child routes
- Theme color affects browser UI (address bar, etc.)
- viewportFit is useful for iPhone X and newer devices

## Related

- [generateMetadata](./generateMetadata.md) - Generate page metadata
- [Viewport API](https://nextjs.org/docs/app/api-reference/functions/generate-viewport) - Full documentation
