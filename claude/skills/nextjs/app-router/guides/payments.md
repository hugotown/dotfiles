# Payments Integration in Next.js App Router

Comprehensive guide for integrating Stripe payments, handling webhooks, and managing subscriptions.

## Table of Contents
- [Stripe Setup](#stripe-setup)
- [One-Time Payments](#one-time-payments)
- [Subscriptions](#subscriptions)
- [Webhooks](#webhooks)
- [Customer Portal](#customer-portal)
- [Testing](#testing)

## Stripe Setup

### Installation

```bash
npm install stripe @stripe/stripe-js
```

### Initialize Stripe

```ts
// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
  typescript: true
})
```

```ts
// lib/stripe-client.ts
'use client'

import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)
```

### Environment Variables

```env
# .env.local
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## One-Time Payments

### Create Checkout Session

```tsx
// app/actions.ts
'use server'

import { stripe } from '@/lib/stripe'
import { auth } from '@/lib/auth'

export async function createCheckoutSession(priceId: string) {
  const session = await auth()

  if (!session?.user?.email) {
    throw new Error('Not authenticated')
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: session.user.email,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
    metadata: {
      userId: session.user.id
    }
  })

  return { url: checkoutSession.url }
}
```

### Checkout Button Component

```tsx
// components/CheckoutButton.tsx
'use client'

import { useState } from 'react'
import { createCheckoutSession } from '@/app/actions'

export function CheckoutButton({ priceId }: { priceId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)

    try {
      const { url } = await createCheckoutSession(priceId)

      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error(error)
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Loading...' : 'Buy Now'}
    </button>
  )
}
```

### Custom Payment Form

```tsx
// components/PaymentForm.tsx
'use client'

import { useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'

export function PaymentForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!stripe || !elements) return

    setLoading(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success`
      }
    })

    if (error) {
      console.error(error)
      alert(error.message)
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe || loading}>
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  )
}
```

```tsx
// app/checkout/page.tsx
'use client'

import { Elements } from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe-client'
import { PaymentForm } from '@/components/PaymentForm'

export default function CheckoutPage({
  searchParams
}: {
  searchParams: { client_secret: string }
}) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: searchParams.client_secret,
        appearance: {
          theme: 'stripe'
        }
      }}
    >
      <PaymentForm clientSecret={searchParams.client_secret} />
    </Elements>
  )
}
```

### Create Payment Intent

```tsx
// app/actions.ts
'use server'

import { stripe } from '@/lib/stripe'

export async function createPaymentIntent(amount: number) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true
    }
  })

  return { clientSecret: paymentIntent.client_secret }
}
```

## Subscriptions

### Create Products and Prices

```ts
// scripts/create-products.ts
import { stripe } from '@/lib/stripe'

async function createProducts() {
  // Create product
  const product = await stripe.products.create({
    name: 'Pro Plan',
    description: 'Access to all premium features'
  })

  // Create monthly price
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 1999, // $19.99
    currency: 'usd',
    recurring: {
      interval: 'month'
    }
  })

  // Create annual price
  const annualPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 19900, // $199.00
    currency: 'usd',
    recurring: {
      interval: 'year'
    }
  })

  console.log('Product:', product.id)
  console.log('Monthly Price:', monthlyPrice.id)
  console.log('Annual Price:', annualPrice.id)
}

createProducts()
```

### Subscription Checkout

```tsx
// app/actions.ts
'use server'

import { stripe } from '@/lib/stripe'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function createSubscriptionCheckout(priceId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }

  // Get or create Stripe customer
  let customer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true }
  })

  let customerId = customer?.stripeCustomerId

  if (!customerId) {
    const stripeCustomer = await stripe.customers.create({
      email: session.user.email!,
      metadata: {
        userId: session.user.id
      }
    })

    customerId = stripeCustomer.id

    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId }
    })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscribed=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    subscription_data: {
      metadata: {
        userId: session.user.id
      }
    }
  })

  return { url: checkoutSession.url }
}
```

### Subscription Status

```tsx
// lib/subscription.ts
import { prisma } from '@/lib/prisma'

export async function getSubscriptionStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true }
  })

  if (!user?.subscription) {
    return { status: 'none' }
  }

  const sub = user.subscription

  return {
    status: sub.status,
    planId: sub.planId,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd
  }
}

export async function isSubscriptionActive(userId: string) {
  const status = await getSubscriptionStatus(userId)
  return status.status === 'active' || status.status === 'trialing'
}
```

### Manage Subscription

```tsx
// app/actions.ts
'use server'

import { stripe } from '@/lib/stripe'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function cancelSubscription() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true }
  })

  if (!user?.subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription')
  }

  await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
    cancel_at_period_end: true
  })

  await prisma.subscription.update({
    where: { id: user.subscription.id },
    data: { cancelAtPeriodEnd: true }
  })

  return { success: true }
}

export async function resumeSubscription() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true }
  })

  if (!user?.subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription')
  }

  await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
    cancel_at_period_end: false
  })

  await prisma.subscription.update({
    where: { id: user.subscription.id },
    data: { cancelAtPeriodEnd: false }
  })

  return { success: true }
}
```

## Webhooks

### Webhook Handler

```ts
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed')
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object)
        break
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return Response.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId

  if (!userId) return

  if (session.mode === 'subscription') {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    )

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status,
        planId: subscription.items.data[0].price.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      },
      update: {
        status: subscription.status,
        planId: subscription.items.data[0].price.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      }
    })
  } else {
    // Handle one-time payment
    await prisma.purchase.create({
      data: {
        userId,
        stripePaymentIntentId: session.payment_intent as string,
        amount: session.amount_total!,
        currency: session.currency!,
        status: 'completed'
      }
    })
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status,
      planId: subscription.items.data[0].price.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'canceled',
      canceledAt: new Date()
    }
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Record successful payment
  await prisma.invoice.create({
    data: {
      stripeInvoiceId: invoice.id,
      subscriptionId: invoice.subscription as string,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      paidAt: new Date(invoice.status_transitions.paid_at! * 1000)
    }
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Notify user of payment failure
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription as string },
    include: { user: true }
  })

  if (subscription?.user.email) {
    // Send email notification
    await sendPaymentFailedEmail(subscription.user.email)
  }
}
```

### Webhook Local Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Customer Portal

### Create Portal Session

```tsx
// app/actions.ts
'use server'

import { stripe } from '@/lib/stripe'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function createPortalSession() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true }
  })

  if (!user?.stripeCustomerId) {
    throw new Error('No customer ID found')
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
  })

  return { url: portalSession.url }
}
```

### Portal Button

```tsx
// components/ManageSubscriptionButton.tsx
'use client'

import { useState } from 'react'
import { createPortalSession } from '@/app/actions'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)

    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch (error) {
      console.error(error)
      alert('Failed to open portal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Loading...' : 'Manage Subscription'}
    </button>
  )
}
```

## Testing

### Test Cards

```
# Successful payment
4242 4242 4242 4242

# Requires authentication
4000 0025 0000 3155

# Declined
4000 0000 0000 9995

# Insufficient funds
4000 0000 0000 9995
```

### Test Mode

```tsx
// components/TestModeIndicator.tsx
export function TestModeIndicator() {
  if (process.env.NODE_ENV === 'production') return null

  return (
    <div className="bg-yellow-500 text-white p-2 text-center">
      Stripe Test Mode - Use test cards only
    </div>
  )
}
```

### Webhook Testing

```ts
// scripts/test-webhook.ts
import { stripe } from '@/lib/stripe'

async function testWebhook() {
  const event = stripe.webhooks.generateTestHeaderString({
    payload: JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          mode: 'subscription',
          metadata: { userId: 'user_123' }
        }
      }
    }),
    secret: process.env.STRIPE_WEBHOOK_SECRET!
  })

  console.log('Test webhook signature:', event)
}

testWebhook()
```

## Best Practices

1. **Use webhooks** - Never rely solely on client-side success pages
2. **Idempotency** - Handle duplicate webhook events gracefully
3. **Verify signatures** - Always verify webhook signatures
4. **Test mode** - Use test mode during development
5. **Error handling** - Handle all payment errors gracefully
6. **Metadata** - Use metadata to link Stripe objects to your database
7. **Customer portal** - Let users manage their own subscriptions
8. **Logging** - Log all payment events for debugging
9. **PCI compliance** - Never store card details yourself
10. **Refunds** - Implement refund handling if needed

## Common Patterns

### Usage-Based Billing

```tsx
// app/actions.ts
'use server'

import { stripe } from '@/lib/stripe'

export async function recordUsage(subscriptionItemId: string, quantity: number) {
  await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment'
  })
}
```

### Coupons and Discounts

```tsx
// app/actions.ts
'use server'

import { stripe } from '@/lib/stripe'

export async function createCheckoutWithCoupon(
  priceId: string,
  couponCode: string
) {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Not authenticated')

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: session.user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    discounts: [{ coupon: couponCode }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`
  })

  return { url: checkoutSession.url }
}
```

### Trial Periods

```tsx
// app/actions.ts
'use server'

export async function createTrialCheckout(priceId: string) {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Not authenticated')

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: session.user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`
  })

  return { url: checkoutSession.url }
}
```

## Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Next.js Stripe Example](https://github.com/vercel/next.js/tree/canary/examples/with-stripe-typescript)
