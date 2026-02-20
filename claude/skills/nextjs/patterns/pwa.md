# Progressive Web Apps (PWA) in Next.js

Complete guide to building Progressive Web Apps with Next.js, including service workers, offline support, push notifications, and app-like experiences.

## Table of Contents

1. [PWA Basics](#pwa-basics)
2. [Setup with next-pwa](#setup-with-next-pwa)
3. [Web App Manifest](#web-app-manifest)
4. [Service Workers](#service-workers)
5. [Offline Support](#offline-support)
6. [Caching Strategies](#caching-strategies)
7. [Push Notifications](#push-notifications)
8. [Install Prompts](#install-prompts)
9. [Best Practices](#best-practices)

## PWA Basics

### What is a PWA?

A Progressive Web App is a web application that uses modern web capabilities to deliver an app-like experience:

- **Reliable**: Load instantly, even offline
- **Fast**: Respond quickly to user interactions
- **Engaging**: Feel like a native app

### PWA Requirements

1. **HTTPS**: Required for service workers
2. **Web App Manifest**: Provides app metadata
3. **Service Worker**: Enables offline functionality
4. **Responsive Design**: Works on all devices
5. **App Shell Architecture**: Fast loading

## Setup with next-pwa

### Installation

```bash
npm install next-pwa
# or
pnpm add next-pwa
```

### Basic Configuration

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)
```

### Advanced Configuration

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',

  // Workbox options
  buildExcludes: [/middleware-manifest\.json$/],

  // Runtime caching
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'cdn-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/api\.example\.com\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
})

module.exports = withPWA({
  reactStrictMode: true,
})
```

## Web App Manifest

### Create Manifest File

```json
// public/manifest.json
{
  "name": "My Next.js PWA",
  "short_name": "Next PWA",
  "description": "A Progressive Web App built with Next.js",
  "theme_color": "#3b82f6",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "categories": ["productivity", "utilities"],
  "shortcuts": [
    {
      "name": "Dashboard",
      "short_name": "Dashboard",
      "description": "Go to Dashboard",
      "url": "/dashboard",
      "icons": [{ "src": "/icons/dashboard.png", "sizes": "192x192" }]
    },
    {
      "name": "Profile",
      "short_name": "Profile",
      "description": "View Profile",
      "url": "/profile",
      "icons": [{ "src": "/icons/profile.png", "sizes": "192x192" }]
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "1280x720",
      "type": "image/png"
    }
  ]
}
```

### Link Manifest in Layout

```typescript
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Next.js PWA',
  description: 'A Progressive Web App built with Next.js',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Next PWA',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## Service Workers

### Custom Service Worker

```javascript
// public/sw.js
const CACHE_NAME = 'my-pwa-cache-v1'
const urlsToCache = [
  '/',
  '/offline',
  '/styles/main.css',
  '/scripts/main.js',
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    })
  )
})

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response
      }

      return fetch(event.request).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }

        // Clone response
        const responseToCache = response.clone()

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })

        return response
      })
    })
  )
})

// Activate event
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})
```

### Register Service Worker (App Router)

```typescript
// app/layout.tsx
'use client'

import { useEffect } from 'react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration)
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error)
        })
    }
  }, [])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### Service Worker Lifecycle Hook

```typescript
// hooks/useServiceWorker.ts
import { useEffect, useState } from 'react'

export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        setRegistration(reg)

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
              }
            })
          }
        })
      })
    }
  }, [])

  const updateServiceWorker = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  return { registration, updateAvailable, updateServiceWorker }
}
```

## Offline Support

### Offline Page

```typescript
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">You're Offline</h1>
      <p className="mt-4 text-gray-600">
        Please check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-8 rounded-lg bg-blue-600 px-6 py-3 text-white"
      >
        Retry
      </button>
    </div>
  )
}
```

### Offline Detection

```typescript
// hooks/useOnlineStatus.ts
import { useEffect, useState } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

### Offline Banner Component

```typescript
// components/OfflineBanner.tsx
'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-50">
      You are currently offline. Some features may not be available.
    </div>
  )
}
```

## Caching Strategies

### 1. Cache First (Good for Static Assets)

```javascript
// Cache first, fall back to network
workbox.routing.registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  new workbox.strategies.CacheFirst({
    cacheName: 'images',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)
```

### 2. Network First (Good for API Calls)

```javascript
// Network first, fall back to cache
workbox.routing.registerRoute(
  /\/api\//,
  new workbox.strategies.NetworkFirst({
    cacheName: 'api',
    networkTimeoutSeconds: 10,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
)
```

### 3. Stale While Revalidate (Good for Frequently Updated Content)

```javascript
// Return cached version, update in background
workbox.routing.registerRoute(
  /\.(?:js|css)$/,
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
)
```

### 4. Network Only (Always Fresh)

```javascript
// Always fetch from network
workbox.routing.registerRoute(
  /\/auth\//,
  new workbox.strategies.NetworkOnly()
)
```

### 5. Cache Only (Offline First)

```javascript
// Only use cache
workbox.routing.registerRoute(
  /\/offline/,
  new workbox.strategies.CacheOnly({
    cacheName: 'offline',
  })
)
```

## Push Notifications

### Request Notification Permission

```typescript
// lib/notifications.ts
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return 'denied'
  }

  return await Notification.requestPermission()
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, options)
      })
    } else {
      new Notification(title, options)
    }
  }
}
```

### Notification Component

```typescript
// components/NotificationButton.tsx
'use client'

import { useState } from 'react'
import { requestNotificationPermission, showNotification } from '@/lib/notifications'

export default function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' ? Notification.permission : 'default'
  )

  const handleRequest = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)

    if (result === 'granted') {
      showNotification('Notifications Enabled', {
        body: 'You will now receive notifications',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
      })
    }
  }

  if (permission === 'granted') {
    return (
      <button
        onClick={() =>
          showNotification('Test Notification', {
            body: 'This is a test notification',
          })
        }
      >
        Send Test Notification
      </button>
    )
  }

  return (
    <button onClick={handleRequest}>
      {permission === 'denied' ? 'Notifications Blocked' : 'Enable Notifications'}
    </button>
  )
}
```

### Web Push Notifications

```typescript
// lib/web-push.ts
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications not supported')
  }

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    ),
  })

  // Send subscription to backend
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })

  return subscription
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
```

### Backend Push API

```typescript
// app/api/push/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: NextRequest) {
  const { subscription, payload } = await request.json()

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
```

## Install Prompts

### Detect Install Prompt

```typescript
// hooks/useInstallPrompt.ts
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const promptInstall = async () => {
    if (!installPrompt) return false

    installPrompt.prompt()
    const choice = await installPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      return true
    }

    return false
  }

  return { installPrompt, promptInstall, isInstalled }
}
```

### Install Button Component

```typescript
// components/InstallButton.tsx
'use client'

import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function InstallButton() {
  const { installPrompt, promptInstall, isInstalled } = useInstallPrompt()

  if (isInstalled || !installPrompt) {
    return null
  }

  return (
    <button
      onClick={promptInstall}
      className="fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg"
    >
      Install App
    </button>
  )
}
```

## Best Practices

### 1. Performance Optimization

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',

  // Exclude large files from precaching
  buildExcludes: [/chunks\/.*\.js$/],

  // Optimize caching
  maximumFileSizeToCacheInBytes: 3000000, // 3 MB
})
```

### 2. Update Strategy

```typescript
// components/UpdatePrompt.tsx
'use client'

import { useServiceWorker } from '@/hooks/useServiceWorker'

export default function UpdatePrompt() {
  const { updateAvailable, updateServiceWorker } = useServiceWorker()

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-4">
      <div className="container mx-auto flex items-center justify-between">
        <span>A new version is available!</span>
        <button
          onClick={updateServiceWorker}
          className="bg-white text-blue-600 px-4 py-2 rounded"
        >
          Update Now
        </button>
      </div>
    </div>
  )
}
```

### 3. Testing PWA

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run PWA audit
lighthouse https://your-site.com --view --preset=pwa

# Or use Chrome DevTools > Lighthouse
```

### 4. Security Headers

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}
```

## Common Pitfalls

1. **No HTTPS**: Service workers require HTTPS (except localhost)
2. **Large cache**: Don't cache everything, be selective
3. **No offline fallback**: Always provide offline page
4. **Forgetting to update manifest**: Keep icons and metadata current
5. **Not testing on real devices**: PWA behavior differs across platforms
6. **Ignoring iOS**: Add apple-touch-icon and meta tags
7. **Not handling updates**: Implement update notification
8. **Cache invalidation**: Clear old caches on activation

## Resources

- [Next PWA Documentation](https://github.com/shadowwalker/next-pwa)
- [PWA Builder](https://www.pwabuilder.com/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
