# Real-time Features in Next.js App Router

Comprehensive guide for implementing real-time data synchronization using WebSockets, Server-Sent Events (SSE), and polling strategies.

## Table of Contents
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [WebSockets](#websockets)
- [Polling Strategies](#polling-strategies)
- [Pusher Integration](#pusher-integration)
- [Ably Integration](#ably-integration)
- [Optimistic Updates](#optimistic-updates)

## Server-Sent Events (SSE)

### Basic SSE Implementation

```ts
// app/api/sse/route.ts
export const runtime = 'edge'

export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      )

      // Send updates every 5 seconds
      const interval = setInterval(() => {
        const data = {
          type: 'update',
          timestamp: new Date().toISOString(),
          data: Math.random()
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }, 5000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### SSE Client Hook

```tsx
// hooks/useSSE.ts
'use client'

import { useEffect, useState } from 'react'

type SSEMessage<T> = {
  type: string
  data?: T
  timestamp?: string
}

export function useSSE<T = any>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage<T> = JSON.parse(event.data)
        if (message.type === 'update' && message.data) {
          setData(message.data)
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err)
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
      setError(new Error('SSE connection error'))
    }

    return () => {
      eventSource.close()
    }
  }, [url])

  return { data, isConnected, error }
}
```

### Real-time Notifications with SSE

```ts
// app/api/notifications/stream/route.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'edge'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial notifications
      const notifications = await prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' }
      })

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'initial', notifications })}\n\n`)
      )

      // Poll for new notifications every 10 seconds
      const interval = setInterval(async () => {
        const newNotifications = await prisma.notification.findMany({
          where: {
            userId,
            read: false,
            createdAt: { gt: new Date(Date.now() - 10000) }
          }
        })

        if (newNotifications.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'new', notifications: newNotifications })}\n\n`)
          )
        }
      }, 10000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

```tsx
// components/NotificationStream.tsx
'use client'

import { useSSE } from '@/hooks/useSSE'

type Notification = {
  id: string
  message: string
  createdAt: string
}

export function NotificationStream() {
  const { data, isConnected } = useSSE<{ notifications: Notification[] }>(
    '/api/notifications/stream'
  )

  return (
    <div>
      <div className="status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>

      <div className="notifications">
        {data?.notifications.map(notification => (
          <div key={notification.id}>
            <p>{notification.message}</p>
            <small>{new Date(notification.createdAt).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## WebSockets

### WebSocket Server with Socket.IO

```bash
npm install socket.io socket.io-client
```

```ts
// server/socket.ts
import { Server } from 'socket.io'
import type { Server as HTTPServer } from 'http'

export function initSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId)
      socket.to(roomId).emit('user-joined', socket.id)
    })

    socket.on('send-message', (data: { roomId: string; message: string }) => {
      io.to(data.roomId).emit('new-message', {
        id: socket.id,
        message: data.message,
        timestamp: new Date()
      })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  return io
}
```

```ts
// server.ts (Custom server)
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initSocket } from './server/socket'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true)
    await handle(req, res, parsedUrl)
  })

  initSocket(server)

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
```

### WebSocket Client Hook

```tsx
// hooks/useSocket.ts
'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket']
    })

    socketInstance.on('connect', () => {
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  return { socket, isConnected }
}
```

### Real-time Chat with WebSockets

```tsx
// app/chat/[roomId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSocket } from '@/hooks/useSocket'

type Message = {
  id: string
  message: string
  timestamp: Date
}

export default function ChatRoom({ params }: { params: { roomId: string } }) {
  const { socket, isConnected } = useSocket()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  useEffect(() => {
    if (!socket) return

    socket.emit('join-room', params.roomId)

    socket.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, message])
    })

    return () => {
      socket.off('new-message')
    }
  }, [socket, params.roomId])

  const sendMessage = () => {
    if (!socket || !input.trim()) return

    socket.emit('send-message', {
      roomId: params.roomId,
      message: input
    })

    setInput('')
  }

  return (
    <div>
      <div className="status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <strong>{msg.id}</strong>: {msg.message}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>

      <div className="input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  )
}
```

## Polling Strategies

### Simple Interval Polling

```tsx
// hooks/usePolling.ts
'use client'

import { useEffect, useState, useCallback } from 'react'

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  interval: number = 5000
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    fetch()

    const intervalId = setInterval(fetch, interval)

    return () => clearInterval(intervalId)
  }, [fetch, interval])

  return { data, error, isLoading, refetch: fetch }
}
```

### Smart Polling with Exponential Backoff

```tsx
// hooks/useSmartPolling.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

export function useSmartPolling<T>(
  fetchFn: () => Promise<T>,
  options: {
    initialInterval?: number
    maxInterval?: number
    backoffMultiplier?: number
    stopOnError?: boolean
  } = {}
) {
  const {
    initialInterval = 1000,
    maxInterval = 30000,
    backoffMultiplier = 1.5,
    stopOnError = false
  } = options

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const intervalRef = useRef<number>(initialInterval)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const fetch = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setError(null)

      // Reset interval on success
      intervalRef.current = initialInterval
    } catch (err) {
      setError(err as Error)

      if (stopOnError) return

      // Increase interval on error (exponential backoff)
      intervalRef.current = Math.min(
        intervalRef.current * backoffMultiplier,
        maxInterval
      )
    }
  }, [fetchFn, initialInterval, maxInterval, backoffMultiplier, stopOnError])

  useEffect(() => {
    const poll = async () => {
      await fetch()

      if (!stopOnError || !error) {
        timeoutRef.current = setTimeout(poll, intervalRef.current)
      }
    }

    poll()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [fetch, stopOnError, error])

  return { data, error, refetch: fetch }
}
```

### Visibility-Based Polling

```tsx
// hooks/useVisibilityPolling.ts
'use client'

import { useEffect, useState } from 'react'

export function useVisibilityPolling<T>(
  fetchFn: () => Promise<T>,
  interval: number = 5000
) {
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const result = await fetchFn()
      setData(result)
    }

    let intervalId: NodeJS.Timeout | null = null

    const startPolling = () => {
      fetch()
      intervalId = setInterval(fetch, interval)
    }

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchFn, interval])

  return { data }
}
```

## Pusher Integration

### Setup Pusher

```bash
npm install pusher pusher-js
```

```ts
// lib/pusher.ts
import Pusher from 'pusher'
import PusherClient from 'pusher-js'

// Server-side
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
})

// Client-side
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: '/api/pusher/auth'
  }
)
```

### Pusher Auth Endpoint

```ts
// app/api/pusher/auth/route.ts
import { auth } from '@/lib/auth'
import { pusherServer } from '@/lib/pusher'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const data = await request.formData()
  const socketId = data.get('socket_id') as string
  const channel = data.get('channel_name') as string

  // Authorize private channels
  if (channel.startsWith('private-')) {
    const authResponse = pusherServer.authorizeChannel(socketId, channel, {
      user_id: session.user.id,
      user_info: {
        name: session.user.name
      }
    })

    return Response.json(authResponse)
  }

  // Authorize presence channels
  if (channel.startsWith('presence-')) {
    const authResponse = pusherServer.authorizeChannel(socketId, channel, {
      user_id: session.user.id,
      user_info: {
        name: session.user.name,
        email: session.user.email
      }
    })

    return Response.json(authResponse)
  }

  return new Response('Forbidden', { status: 403 })
}
```

### Real-time Updates with Pusher

```ts
// app/actions.ts
'use server'

import { pusherServer } from '@/lib/pusher'
import { prisma } from '@/lib/prisma'

export async function createPost(data: { title: string; content: string }) {
  const post = await prisma.post.create({ data })

  // Trigger Pusher event
  await pusherServer.trigger('posts', 'new-post', post)

  return post
}
```

```tsx
// components/PostsFeed.tsx
'use client'

import { useEffect, useState } from 'react'
import { pusherClient } from '@/lib/pusher'

type Post = {
  id: string
  title: string
  content: string
}

export function PostsFeed({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts)

  useEffect(() => {
    const channel = pusherClient.subscribe('posts')

    channel.bind('new-post', (newPost: Post) => {
      setPosts(prev => [newPost, ...prev])
    })

    return () => {
      channel.unbind('new-post')
      pusherClient.unsubscribe('posts')
    }
  }, [])

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  )
}
```

## Ably Integration

### Setup Ably

```bash
npm install ably
```

```ts
// lib/ably.ts
import * as Ably from 'ably'

export const ablyServer = new Ably.Rest({
  key: process.env.ABLY_API_KEY!
})

export const ablyClient = new Ably.Realtime({
  authUrl: '/api/ably/auth'
})
```

### Ably Token Auth

```ts
// app/api/ably/auth/route.ts
import { auth } from '@/lib/auth'
import { ablyServer } from '@/lib/ably'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const tokenRequest = await ablyServer.auth.createTokenRequest({
    clientId: session.user.id
  })

  return Response.json(tokenRequest)
}
```

### Real-time Presence with Ably

```tsx
// components/OnlineUsers.tsx
'use client'

import { useEffect, useState } from 'react'
import { ablyClient } from '@/lib/ably'

type User = {
  clientId: string
  data?: { name: string }
}

export function OnlineUsers() {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    const channel = ablyClient.channels.get('presence-demo')

    channel.presence.subscribe('enter', (member) => {
      setUsers(prev => [...prev, member])
    })

    channel.presence.subscribe('leave', (member) => {
      setUsers(prev => prev.filter(u => u.clientId !== member.clientId))
    })

    channel.presence.enter({ name: 'Current User' })

    channel.presence.get((err, members) => {
      if (!err && members) {
        setUsers(members)
      }
    })

    return () => {
      channel.presence.leave()
      channel.presence.unsubscribe()
    }
  }, [])

  return (
    <div>
      <h3>Online Users ({users.length})</h3>
      <ul>
        {users.map(user => (
          <li key={user.clientId}>{user.data?.name || 'Anonymous'}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Best Practices

1. **Choose the right approach**:
   - SSE: Server-to-client updates, notifications
   - WebSockets: Bidirectional communication, chat
   - Polling: Simple updates, fallback option
   - Pusher/Ably: Managed real-time infrastructure

2. **Connection management**:
   - Clean up connections on unmount
   - Handle reconnection logic
   - Implement exponential backoff

3. **Performance**:
   - Use visibility-based polling to pause when inactive
   - Implement debouncing for frequent updates
   - Batch updates when possible

4. **Error handling**:
   - Handle connection failures gracefully
   - Provide offline indicators
   - Retry with backoff strategies

5. **Security**:
   - Authenticate connections
   - Validate messages
   - Use private channels for sensitive data

## Resources

- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Pusher Documentation](https://pusher.com/docs/)
- [Ably Documentation](https://ably.com/docs)
