# Email in Next.js App Router

Comprehensive guide for sending transactional emails, managing templates, and integrating email providers.

## Table of Contents
- [Email Providers](#email-providers)
- [Resend Integration](#resend-integration)
- [SendGrid Integration](#sendgrid-integration)
- [Email Templates](#email-templates)
- [React Email](#react-email)
- [Email Verification](#email-verification)

## Email Providers

### Comparison

| Provider | Free Tier | Features | Best For |
|----------|-----------|----------|----------|
| Resend | 100/day | Modern API, React Email | New projects |
| SendGrid | 100/day | Mature, analytics | Enterprise |
| Postmark | 100/month | Transactional focus | High deliverability |
| AWS SES | 62,000/month | Cost-effective | High volume |
| Mailgun | 5,000/month | Flexible | Developers |

## Resend Integration

### Setup Resend

```bash
npm install resend
```

```ts
// lib/resend.ts
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
```

### Basic Email Sending

```tsx
// app/actions.ts
'use server'

import { resend } from '@/lib/resend'

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@yourdomain.com',
      to: email,
      subject: 'Welcome to Our Platform',
      html: `
        <h1>Welcome, ${name}!</h1>
        <p>Thank you for joining us.</p>
      `
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to send email'
    }
  }
}
```

### Email with Attachments

```tsx
// app/actions.ts
'use server'

import { resend } from '@/lib/resend'
import { readFile } from 'fs/promises'

export async function sendInvoiceEmail(
  email: string,
  invoicePath: string
) {
  const invoiceBuffer = await readFile(invoicePath)

  const { data, error } = await resend.emails.send({
    from: 'billing@yourdomain.com',
    to: email,
    subject: 'Your Invoice',
    html: '<p>Please find your invoice attached.</p>',
    attachments: [
      {
        filename: 'invoice.pdf',
        content: invoiceBuffer
      }
    ]
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
```

### Batch Email Sending

```tsx
// app/actions.ts
'use server'

import { resend } from '@/lib/resend'

export async function sendBatchEmails(recipients: string[]) {
  const emails = recipients.map(email => ({
    from: 'newsletter@yourdomain.com',
    to: email,
    subject: 'Monthly Newsletter',
    html: '<p>Here is your monthly newsletter...</p>'
  }))

  const { data, error } = await resend.batch.send(emails)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
```

## SendGrid Integration

### Setup SendGrid

```bash
npm install @sendgrid/mail
```

```ts
// lib/sendgrid.ts
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export { sgMail }
```

### Send Email with SendGrid

```tsx
// app/actions.ts
'use server'

import { sgMail } from '@/lib/sendgrid'

export async function sendEmailWithSendGrid(
  to: string,
  subject: string,
  html: string
) {
  try {
    await sgMail.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject,
      html
    })

    return { success: true }
  } catch (error: any) {
    console.error('SendGrid error:', error.response?.body)
    return {
      success: false,
      error: error.message
    }
  }
}
```

### SendGrid Template Email

```tsx
// app/actions.ts
'use server'

import { sgMail } from '@/lib/sendgrid'

export async function sendTemplateEmail(
  to: string,
  templateId: string,
  dynamicData: Record<string, any>
) {
  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL!,
    templateId,
    dynamicTemplateData: dynamicData
  })
}

// Example usage
export async function sendPasswordResetEmail(email: string, resetLink: string) {
  await sendTemplateEmail(
    email,
    'd-xxxxxxxxxxxxx', // Your template ID
    {
      resetLink,
      userName: 'User'
    }
  )
}
```

### SendGrid with Tracking

```tsx
// app/actions.ts
'use server'

import { sgMail } from '@/lib/sendgrid'

export async function sendTrackedEmail(
  to: string,
  subject: string,
  html: string
) {
  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL!,
    subject,
    html,
    trackingSettings: {
      clickTracking: {
        enable: true,
        enableText: true
      },
      openTracking: {
        enable: true,
        substitutionTag: '%open-track%'
      }
    }
  })
}
```

## Email Templates

### Simple Template System

```tsx
// lib/email-templates.ts
export const templates = {
  welcome: (name: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Our Platform!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for signing up. We're excited to have you on board!</p>
            <p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/get-started" class="button">
                Get Started
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `,

  passwordReset: (resetLink: string) => `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </body>
    </html>
  `,

  orderConfirmation: (orderNumber: string, items: any[], total: number) => `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Order Confirmation</h1>
        <p>Order #${orderNumber}</p>
        <h2>Items:</h2>
        <ul>
          ${items.map(item => `
            <li>${item.name} - $${item.price} x ${item.quantity}</li>
          `).join('')}
        </ul>
        <p><strong>Total: $${total}</strong></p>
      </body>
    </html>
  `
}
```

```tsx
// app/actions.ts
'use server'

import { resend } from '@/lib/resend'
import { templates } from '@/lib/email-templates'

export async function sendWelcomeEmail(email: string, name: string) {
  await resend.emails.send({
    from: 'onboarding@yourdomain.com',
    to: email,
    subject: 'Welcome!',
    html: templates.welcome(name)
  })
}
```

## React Email

### Setup React Email

```bash
npm install react-email @react-email/components
npm install -D @react-email/tailwind
```

```json
// package.json
{
  "scripts": {
    "email:dev": "email dev",
    "email:export": "email export"
  }
}
```

### Create Email Components

```tsx
// emails/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text
} from '@react-email/components'

interface WelcomeEmailProps {
  name: string
}

export default function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to our platform!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome, {name}!</Heading>
          <Text style={text}>
            Thank you for joining our platform. We're excited to have you on board!
          </Text>
          <Section style={buttonContainer}>
            <Button
              style={button}
              href={`${process.env.NEXT_PUBLIC_APP_URL}/get-started`}
            >
              Get Started
            </Button>
          </Section>
          <Text style={text}>
            If you have any questions, feel free to reach out to our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px'
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0'
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px'
}

const buttonContainer = {
  padding: '27px 0'
}

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px'
}
```

```tsx
// emails/password-reset.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text
} from '@react-email/components'

interface PasswordResetEmailProps {
  resetLink: string
}

export default function PasswordResetEmail({ resetLink }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Password Reset Request</Heading>
          <Text style={text}>
            You requested to reset your password. Click the button below to proceed:
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={resetLink}>
              Reset Password
            </Button>
          </Section>
          <Text style={text}>
            This link will expire in 1 hour.
          </Text>
          <Text style={text}>
            If you didn't request this, please ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px'
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0'
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px'
}

const buttonContainer = {
  padding: '27px 0'
}

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px'
}
```

### Send React Email

```tsx
// lib/email.ts
import { render } from '@react-email/components'
import { resend } from '@/lib/resend'
import WelcomeEmail from '@/emails/welcome'
import PasswordResetEmail from '@/emails/password-reset'

export async function sendWelcomeEmail(email: string, name: string) {
  const emailHtml = render(WelcomeEmail({ name }))

  await resend.emails.send({
    from: 'onboarding@yourdomain.com',
    to: email,
    subject: 'Welcome to Our Platform',
    html: emailHtml
  })
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`
  const emailHtml = render(PasswordResetEmail({ resetLink }))

  await resend.emails.send({
    from: 'security@yourdomain.com',
    to: email,
    subject: 'Reset Your Password',
    html: emailHtml
  })
}
```

### Email with Tailwind

```tsx
// emails/tailwind-email.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind
} from '@react-email/components'

export default function TailwindEmail({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome!</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto my-8 max-w-2xl bg-white p-8 rounded-lg">
            <Heading className="text-2xl font-bold text-gray-900 mb-4">
              Welcome, {name}!
            </Heading>
            <Text className="text-gray-700 text-base mb-4">
              Thank you for joining our platform.
            </Text>
            <Section className="my-6">
              <Button
                className="bg-blue-600 text-white px-6 py-3 rounded-md"
                href="https://example.com"
              >
                Get Started
              </Button>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
```

## Email Verification

### Email Verification Flow

```tsx
// app/actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export async function createVerificationToken(userId: string) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      expires
    }
  })

  return token
}

export async function sendVerificationEmailAction(email: string, userId: string) {
  const token = await createVerificationToken(userId)
  await sendVerificationEmail(email, token)

  return { success: true }
}

export async function verifyEmail(token: string) {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true }
  })

  if (!verificationToken) {
    return { success: false, error: 'Invalid token' }
  }

  if (verificationToken.expires < new Date()) {
    return { success: false, error: 'Token expired' }
  }

  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { emailVerified: new Date() }
  })

  await prisma.verificationToken.delete({
    where: { token }
  })

  return { success: true }
}
```

```tsx
// emails/verify-email.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text
} from '@react-email/components'

interface VerifyEmailProps {
  verificationLink: string
}

export default function VerifyEmail({ verificationLink }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address</Preview>
      <Body>
        <Container>
          <Heading>Verify Your Email</Heading>
          <Text>
            Please click the button below to verify your email address:
          </Text>
          <Button href={verificationLink}>
            Verify Email
          </Button>
          <Text>
            This link will expire in 24 hours.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

```tsx
// app/verify-email/page.tsx
import { verifyEmail } from '@/app/actions'
import { redirect } from 'next/navigation'

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: { token: string }
}) {
  const result = await verifyEmail(searchParams.token)

  if (result.success) {
    redirect('/dashboard?verified=true')
  }

  return (
    <div>
      <h1>Email Verification Failed</h1>
      <p>{result.error}</p>
    </div>
  )
}
```

### Email Queue System

```tsx
// lib/email-queue.ts
import { prisma } from '@/lib/prisma'

export async function queueEmail(data: {
  to: string
  subject: string
  html: string
  from?: string
}) {
  return await prisma.emailQueue.create({
    data: {
      ...data,
      from: data.from || process.env.DEFAULT_FROM_EMAIL!,
      status: 'pending'
    }
  })
}

export async function processEmailQueue() {
  const emails = await prisma.emailQueue.findMany({
    where: {
      status: 'pending',
      attempts: { lt: 3 }
    },
    take: 10
  })

  for (const email of emails) {
    try {
      await resend.emails.send({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html
      })

      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'sent',
          sentAt: new Date()
        }
      })
    } catch (error) {
      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
  }
}
```

```ts
// lib/cron.ts (for scheduled processing)
import { processEmailQueue } from '@/lib/email-queue'

// Run every minute
export async function emailQueueCron() {
  await processEmailQueue()
}
```

## Best Practices

1. **Use environment variables** - Never hardcode API keys
2. **Email verification** - Verify user emails before sending important notifications
3. **Templates** - Use React Email or template engines for maintainability
4. **Batch sending** - Send bulk emails in batches to avoid rate limits
5. **Error handling** - Log failures and implement retry logic
6. **Queue system** - For high-volume apps, queue emails for processing
7. **Unsubscribe links** - Always include unsubscribe options for marketing emails
8. **Testing** - Test emails in development with services like Mailtrap
9. **Deliverability** - Configure SPF, DKIM, and DMARC records
10. **Track metrics** - Monitor open rates, click rates, and bounces

## Testing Emails

### Development Email Testing with Mailtrap

```ts
// lib/email-test.ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.mailtrap.io',
  port: 2525,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
})

export async function sendTestEmail(to: string, subject: string, html: string) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test emails only in development')
  }

  await transporter.sendMail({
    from: 'test@example.com',
    to,
    subject,
    html
  })
}
```

## Resources

- [Resend Documentation](https://resend.com/docs)
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [React Email Documentation](https://react.email/)
- [Email Best Practices](https://sendgrid.com/blog/email-marketing-best-practices/)
