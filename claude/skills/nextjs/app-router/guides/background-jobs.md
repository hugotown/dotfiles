# Background Jobs in Next.js App Router

Comprehensive guide for implementing background jobs, queue systems, and scheduled tasks in Next.js applications.

## Table of Contents
- [Queue Systems](#queue-systems)
- [BullMQ Integration](#bullmq-integration)
- [Inngest Integration](#inngest-integration)
- [Cron Jobs](#cron-jobs)
- [Serverless Functions](#serverless-functions)
- [Job Monitoring](#job-monitoring)

## Queue Systems

### Why Use Queues?

- Offload time-consuming tasks from request handlers
- Retry failed operations automatically
- Process jobs in the background
- Rate limit API calls
- Handle concurrent jobs efficiently

## BullMQ Integration

### Setup BullMQ with Redis

```bash
npm install bullmq ioredis
```

```ts
// lib/queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null
})

export const emailQueue = new Queue('email', { connection })
export const imageQueue = new Queue('image-processing', { connection })
export const webhookQueue = new Queue('webhooks', { connection })
```

### Define Job Processors

```ts
// workers/email-worker.ts
import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import { resend } from '@/lib/resend'

export const emailWorker = new Worker(
  'email',
  async (job) => {
    const { to, subject, html } = job.data

    await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to,
      subject,
      html
    })

    return { sent: true, to }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000 // 10 emails per second
    }
  }
)

emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`)
})

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err)
})
```

```ts
// workers/image-worker.ts
import { Worker } from 'bullmq'
import { connection } from '@/lib/queue'
import sharp from 'sharp'
import { uploadToS3 } from '@/lib/s3'

export const imageWorker = new Worker(
  'image-processing',
  async (job) => {
    const { imageUrl, sizes } = job.data

    // Download image
    const response = await fetch(imageUrl)
    const buffer = Buffer.from(await response.arrayBuffer())

    // Process different sizes
    const results = await Promise.all(
      sizes.map(async (size: { width: number; height: number; name: string }) => {
        const processed = await sharp(buffer)
          .resize(size.width, size.height, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer()

        // Upload to S3
        const result = await uploadToS3(
          new File([processed], `${size.name}.jpg`, { type: 'image/jpeg' })
        )

        return { size: size.name, url: result.url }
      })
    )

    return results
  },
  { connection }
)
```

### Add Jobs to Queue

```tsx
// app/actions.ts
'use server'

import { emailQueue, imageQueue } from '@/lib/queue'

export async function sendEmailAsync(to: string, subject: string, html: string) {
  const job = await emailQueue.add(
    'send-email',
    { to, subject, html },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  )

  return { jobId: job.id }
}

export async function processImage(imageUrl: string) {
  const job = await imageQueue.add(
    'process-image',
    {
      imageUrl,
      sizes: [
        { name: 'thumbnail', width: 200, height: 200 },
        { name: 'medium', width: 800, height: 600 },
        { name: 'large', width: 1920, height: 1080 }
      ]
    },
    {
      attempts: 2,
      priority: 10 // Higher priority
    }
  )

  return { jobId: job.id }
}
```

### Monitor Job Status

```tsx
// app/api/jobs/[jobId]/route.ts
import { emailQueue } from '@/lib/queue'

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const job = await emailQueue.getJob(params.jobId)

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 })
  }

  const state = await job.getState()
  const progress = job.progress

  return Response.json({
    id: job.id,
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason
  })
}
```

### Job Scheduling

```tsx
// app/actions.ts
'use server'

import { emailQueue } from '@/lib/queue'

export async function scheduleEmail(
  to: string,
  subject: string,
  html: string,
  sendAt: Date
) {
  const delay = sendAt.getTime() - Date.now()

  const job = await emailQueue.add(
    'scheduled-email',
    { to, subject, html },
    {
      delay,
      attempts: 3
    }
  )

  return { jobId: job.id, scheduledFor: sendAt }
}
```

### Recurring Jobs

```ts
// lib/scheduled-jobs.ts
import { Queue } from 'bullmq'
import { connection } from '@/lib/queue'

export const scheduledQueue = new Queue('scheduled', { connection })

// Add a repeatable job
export async function setupRecurringJobs() {
  // Daily report at 9 AM
  await scheduledQueue.add(
    'daily-report',
    { type: 'daily' },
    {
      repeat: {
        pattern: '0 9 * * *' // Cron pattern
      }
    }
  )

  // Weekly cleanup every Sunday at midnight
  await scheduledQueue.add(
    'weekly-cleanup',
    { type: 'cleanup' },
    {
      repeat: {
        pattern: '0 0 * * 0'
      }
    }
  )
}
```

## Inngest Integration

### Setup Inngest

```bash
npm install inngest
```

```ts
// lib/inngest.ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'my-app',
  eventKey: process.env.INNGEST_EVENT_KEY
})
```

### Define Functions

```ts
// inngest/functions.ts
import { inngest } from '@/lib/inngest'
import { resend } from '@/lib/resend'
import { prisma } from '@/lib/prisma'

export const sendWelcomeEmail = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/created' },
  async ({ event, step }) => {
    const user = event.data.user

    // Step 1: Create welcome email content
    const emailContent = await step.run('create-email', async () => {
      return {
        subject: 'Welcome!',
        html: `<h1>Welcome ${user.name}!</h1>`
      }
    })

    // Step 2: Send email
    await step.run('send-email', async () => {
      await resend.emails.send({
        from: 'onboarding@example.com',
        to: user.email,
        ...emailContent
      })
    })

    // Step 3: Update user record
    await step.run('update-user', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingEmailSent: true }
      })
    })

    return { success: true }
  }
)

export const processImageWithRetry = inngest.createFunction(
  {
    id: 'process-image',
    retries: 3
  },
  { event: 'image/uploaded' },
  async ({ event, step }) => {
    const { imageUrl } = event.data

    const processed = await step.run('resize-image', async () => {
      // Image processing logic
      return { thumbnailUrl: '...', largeUrl: '...' }
    })

    await step.run('save-to-db', async () => {
      await prisma.image.update({
        where: { url: imageUrl },
        data: processed
      })
    })

    return processed
  }
)
```

### Scheduled Functions

```ts
// inngest/scheduled.ts
import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'

export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest' },
  { cron: '0 9 * * *' }, // Every day at 9 AM
  async ({ step }) => {
    const users = await step.run('get-users', async () => {
      return await prisma.user.findMany({
        where: { emailPreferences: { dailyDigest: true } }
      })
    })

    await step.run('send-digests', async () => {
      for (const user of users) {
        await inngest.send({
          name: 'email/send-digest',
          data: { userId: user.id }
        })
      }
    })

    return { sent: users.length }
  }
)

export const cleanupOldData = inngest.createFunction(
  { id: 'cleanup-old-data' },
  { cron: '0 0 * * 0' }, // Every Sunday at midnight
  async ({ step }) => {
    const deleted = await step.run('delete-old-records', async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const result = await prisma.temporaryData.deleteMany({
        where: { createdAt: { lt: thirtyDaysAgo } }
      })

      return result.count
    })

    return { deleted }
  }
)
```

### API Route Handler

```ts
// app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import {
  sendWelcomeEmail,
  processImageWithRetry
} from '@/inngest/functions'
import {
  dailyDigest,
  cleanupOldData
} from '@/inngest/scheduled'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendWelcomeEmail,
    processImageWithRetry,
    dailyDigest,
    cleanupOldData
  ]
})
```

### Trigger Events

```tsx
// app/actions.ts
'use server'

import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'

export async function createUser(data: { name: string; email: string }) {
  const user = await prisma.user.create({ data })

  // Trigger Inngest function
  await inngest.send({
    name: 'user/created',
    data: { user }
  })

  return user
}

export async function uploadImage(url: string) {
  await inngest.send({
    name: 'image/uploaded',
    data: { imageUrl: url }
  })
}
```

## Cron Jobs

### Vercel Cron

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/hourly",
      "schedule": "0 * * * *"
    }
  ]
}
```

```ts
// app/api/cron/daily/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Run your daily tasks
  await sendDailyReports()
  await cleanupExpiredSessions()

  return Response.json({ success: true })
}
```

### Node-Cron

```bash
npm install node-cron
```

```ts
// lib/cron-jobs.ts
import cron from 'node-cron'
import { processEmailQueue } from '@/lib/email-queue'
import { cleanupTempFiles } from '@/lib/cleanup'

export function startCronJobs() {
  // Every minute
  cron.schedule('* * * * *', async () => {
    await processEmailQueue()
  })

  // Every hour
  cron.schedule('0 * * * *', async () => {
    await cleanupTempFiles()
  })

  // Every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    await generateDailyReports()
  })

  console.log('Cron jobs started')
}
```

```ts
// server.ts (custom server)
import { startCronJobs } from '@/lib/cron-jobs'

startCronJobs()
```

## Serverless Functions

### Long-Running Functions (Vercel)

```ts
// app/api/long-task/route.ts
export const maxDuration = 300 // 5 minutes (Pro plan)

export async function POST(request: Request) {
  const { taskId } = await request.json()

  // Long-running task
  const result = await processLongTask(taskId)

  return Response.json(result)
}
```

### Background Function with Webhook

```ts
// app/api/process/route.ts
export async function POST(request: Request) {
  const { data, callbackUrl } = await request.json()

  // Start processing in background
  processDataInBackground(data, callbackUrl)

  // Return immediately
  return Response.json({ status: 'processing' }, { status: 202 })
}

async function processDataInBackground(data: any, callbackUrl: string) {
  try {
    const result = await heavyProcessing(data)

    // Notify via webhook
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', result })
    })
  } catch (error) {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', error: error.message })
    })
  }
}
```

## Job Monitoring

### Dashboard for BullMQ

```bash
npm install @bull-board/api @bull-board/nextjs
```

```ts
// app/admin/queues/route.ts
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { NextAdapter } from '@bull-board/nextjs'
import { emailQueue, imageQueue } from '@/lib/queue'

const serverAdapter = new NextAdapter()

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(imageQueue)
  ],
  serverAdapter
})

serverAdapter.setBasePath('/admin/queues')

export const { GET, POST } = serverAdapter.registerPlugin()
```

### Custom Job Status Page

```tsx
// app/jobs/[jobId]/page.tsx
import { emailQueue } from '@/lib/queue'

export default async function JobStatusPage({
  params
}: {
  params: { jobId: string }
}) {
  const job = await emailQueue.getJob(params.jobId)

  if (!job) {
    return <div>Job not found</div>
  }

  const state = await job.getState()
  const progress = job.progress

  return (
    <div>
      <h1>Job Status</h1>
      <dl>
        <dt>ID:</dt>
        <dd>{job.id}</dd>
        <dt>State:</dt>
        <dd>{state}</dd>
        <dt>Progress:</dt>
        <dd>{progress}%</dd>
        {job.failedReason && (
          <>
            <dt>Error:</dt>
            <dd>{job.failedReason}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
```

### Job Metrics

```tsx
// app/api/jobs/metrics/route.ts
import { emailQueue, imageQueue } from '@/lib/queue'

export async function GET() {
  const [emailCounts, imageCounts] = await Promise.all([
    emailQueue.getJobCounts(),
    imageQueue.getJobCounts()
  ])

  return Response.json({
    email: emailCounts,
    image: imageCounts,
    total: {
      waiting: emailCounts.waiting + imageCounts.waiting,
      active: emailCounts.active + imageCounts.active,
      completed: emailCounts.completed + imageCounts.completed,
      failed: emailCounts.failed + imageCounts.failed
    }
  })
}
```

## Best Practices

1. **Use queues for async tasks** - Email, image processing, webhooks
2. **Implement retries** - With exponential backoff for failed jobs
3. **Monitor jobs** - Set up dashboards and alerts
4. **Rate limiting** - Respect third-party API limits
5. **Job priorities** - Critical jobs should have higher priority
6. **Idempotency** - Jobs should be safe to retry
7. **Logging** - Log job starts, completions, and failures
8. **Cleanup** - Remove old completed jobs periodically
9. **Graceful shutdown** - Wait for active jobs before shutdown
10. **Dead letter queue** - Handle permanently failed jobs

## Patterns

### Webhook Processing

```tsx
// app/actions.ts
'use server'

import { webhookQueue } from '@/lib/queue'

export async function processWebhook(url: string, data: any) {
  await webhookQueue.add(
    'send-webhook',
    { url, data },
    {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    }
  )
}
```

### Batch Processing

```ts
// workers/batch-worker.ts
import { Worker } from 'bullmq'

export const batchWorker = new Worker(
  'batch-processing',
  async (job) => {
    const { items } = job.data

    const results = []
    for (let i = 0; i < items.length; i++) {
      const result = await processItem(items[i])
      results.push(result)

      // Update progress
      await job.updateProgress((i + 1) / items.length * 100)
    }

    return results
  },
  { connection }
)
```

## Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Node-Cron](https://github.com/node-cron/node-cron)
