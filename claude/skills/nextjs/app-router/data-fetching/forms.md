# Forms and Form Handling

Next.js App Router provides powerful form handling capabilities with Server Actions, progressive enhancement, and excellent user experience patterns.

## Basic Form with Server Action

```tsx
// app/contact/page.tsx
import { submitContactForm } from '@/app/actions'

export default function ContactPage() {
  return (
    <form action={submitContactForm}>
      <input type="text" name="name" required />
      <input type="email" name="email" required />
      <textarea name="message" required />
      <button type="submit">Send Message</button>
    </form>
  )
}
```

```tsx
// app/actions.ts
'use server'

export async function submitContactForm(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const message = formData.get('message') as string

  // Save to database
  await db.contact.create({
    data: { name, email, message }
  })

  // Send email notification
  await sendEmail({
    to: 'admin@example.com',
    subject: 'New contact form submission',
    body: message
  })

  revalidatePath('/contact')
}
```

## Form Validation

### Server-Side Validation with Zod

```tsx
// lib/schemas.ts
import { z } from 'zod'

export const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

export type ContactFormData = z.infer<typeof ContactFormSchema>
```

```tsx
// app/actions.ts
'use server'

import { ContactFormSchema } from '@/lib/schemas'

export async function submitContactForm(formData: FormData) {
  const validatedFields = ContactFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation failed'
    }
  }

  const { name, email, message } = validatedFields.data

  try {
    await db.contact.create({
      data: { name, email, message }
    })
  } catch (error) {
    return {
      message: 'Database error: Failed to create contact.'
    }
  }

  revalidatePath('/contact')
  return { message: 'Message sent successfully!' }
}
```

### Display Validation Errors

```tsx
'use client'

import { useFormState } from 'react-dom'
import { submitContactForm } from '@/app/actions'

const initialState = {
  message: '',
  errors: {},
}

export default function ContactForm() {
  const [state, formAction] = useFormState(submitContactForm, initialState)

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          aria-describedby="name-error"
        />
        {state.errors?.name && (
          <div id="name-error" className="text-red-500">
            {state.errors.name[0]}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          aria-describedby="email-error"
        />
        {state.errors?.email && (
          <div id="email-error" className="text-red-500">
            {state.errors.email[0]}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          aria-describedby="message-error"
        />
        {state.errors?.message && (
          <div id="message-error" className="text-red-500">
            {state.errors.message[0]}
          </div>
        )}
      </div>

      {state.message && (
        <div className="text-green-500">{state.message}</div>
      )}

      <button type="submit">Send Message</button>
    </form>
  )
}
```

## Pending States

```tsx
'use client'

import { useFormStatus } from 'react-dom'
import { submitContactForm } from '@/app/actions'

export default function ContactForm() {
  return (
    <form action={submitContactForm}>
      <input type="text" name="name" required />
      <input type="email" name="email" required />
      <textarea name="message" required />
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Sending...' : 'Send Message'}
    </button>
  )
}
```

## Form Reset After Submission

```tsx
'use client'

import { useRef } from 'react'
import { useFormState } from 'react-dom'
import { submitContactForm } from '@/app/actions'

export default function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useFormState(submitContactForm, { message: '' })

  // Reset form on successful submission
  if (state.message === 'Message sent successfully!' && formRef.current) {
    formRef.current.reset()
  }

  return (
    <form ref={formRef} action={formAction}>
      <input type="text" name="name" required />
      <input type="email" name="email" required />
      <textarea name="message" required />
      <button type="submit">Send Message</button>
      {state.message && <p>{state.message}</p>}
    </form>
  )
}
```

## Optimistic Updates

```tsx
'use client'

import { useOptimistic } from 'react'
import { addComment } from '@/app/actions'

interface Comment {
  id: number
  text: string
  author: string
}

export default function CommentList({ comments }: { comments: Comment[] }) {
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    (state, newComment: Comment) => [...state, newComment]
  )

  async function handleSubmit(formData: FormData) {
    const text = formData.get('text') as string
    const author = formData.get('author') as string

    // Optimistically add comment
    addOptimisticComment({
      id: Date.now(),
      text,
      author,
    })

    // Actually add comment on server
    await addComment(formData)
  }

  return (
    <div>
      <ul>
        {optimisticComments.map((comment) => (
          <li key={comment.id}>
            <strong>{comment.author}:</strong> {comment.text}
          </li>
        ))}
      </ul>

      <form action={handleSubmit}>
        <input type="text" name="author" placeholder="Your name" required />
        <input type="text" name="text" placeholder="Your comment" required />
        <button type="submit">Add Comment</button>
      </form>
    </div>
  )
}
```

## Multi-Step Forms

```tsx
'use client'

import { useState } from 'react'
import { submitRegistration } from '@/app/actions'

export default function RegistrationForm() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    address: '',
    phone: '',
  })

  function handleNext(data: Partial<typeof formData>) {
    setFormData({ ...formData, ...data })
    setStep(step + 1)
  }

  async function handleSubmit() {
    await submitRegistration(formData)
  }

  return (
    <div>
      {step === 1 && (
        <Step1Form onNext={(data) => handleNext(data)} />
      )}
      {step === 2 && (
        <Step2Form onNext={(data) => handleNext(data)} />
      )}
      {step === 3 && (
        <Step3Form
          formData={formData}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

function Step1Form({ onNext }: { onNext: (data: any) => void }) {
  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      onNext({
        name: formData.get('name'),
        email: formData.get('email'),
      })
    }}>
      <h2>Step 1: Personal Information</h2>
      <input type="text" name="name" required />
      <input type="email" name="email" required />
      <button type="submit">Next</button>
    </form>
  )
}
```

## File Upload Forms

```tsx
'use client'

import { uploadAvatar } from '@/app/actions'
import { useState } from 'react'

export default function AvatarUploadForm() {
  const [preview, setPreview] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <form action={uploadAvatar}>
      <div>
        <label htmlFor="avatar">Choose avatar</label>
        <input
          id="avatar"
          type="file"
          name="avatar"
          accept="image/*"
          onChange={handleFileChange}
          required
        />
      </div>

      {preview && (
        <div>
          <img src={preview} alt="Preview" width={200} height={200} />
        </div>
      )}

      <button type="submit">Upload</button>
    </form>
  )
}
```

```tsx
// app/actions.ts
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function uploadAvatar(formData: FormData) {
  const file = formData.get('avatar') as File

  if (!file) {
    return { error: 'No file provided' }
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { error: 'File must be an image' }
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File must be less than 5MB' }
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const filename = `${Date.now()}-${file.name}`
  const path = join(process.cwd(), 'public/uploads', filename)

  await writeFile(path, buffer)

  // Update user profile with avatar URL
  await db.user.update({
    where: { id: userId },
    data: { avatar: `/uploads/${filename}` }
  })

  revalidatePath('/profile')
  return { success: true }
}
```

## Dynamic Form Fields

```tsx
'use client'

import { useState } from 'react'
import { createPost } from '@/app/actions'

export default function PostForm() {
  const [tags, setTags] = useState([''])

  function addTag() {
    setTags([...tags, ''])
  }

  function removeTag(index: number) {
    setTags(tags.filter((_, i) => i !== index))
  }

  function updateTag(index: number, value: string) {
    const newTags = [...tags]
    newTags[index] = value
    setTags(newTags)
  }

  return (
    <form action={createPost}>
      <input type="text" name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />

      <div>
        <label>Tags</label>
        {tags.map((tag, index) => (
          <div key={index}>
            <input
              type="text"
              name="tags[]"
              value={tag}
              onChange={(e) => updateTag(index, e.target.value)}
              placeholder={`Tag ${index + 1}`}
            />
            <button type="button" onClick={() => removeTag(index)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addTag}>
          Add Tag
        </button>
      </div>

      <button type="submit">Create Post</button>
    </form>
  )
}
```

## Dependent Form Fields

```tsx
'use client'

import { useState, useEffect } from 'react'

export default function LocationForm() {
  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')

  useEffect(() => {
    // Fetch countries on mount
    fetch('/api/countries')
      .then(r => r.json())
      .then(setCountries)
  }, [])

  useEffect(() => {
    // Fetch cities when country changes
    if (selectedCountry) {
      fetch(`/api/cities?country=${selectedCountry}`)
        .then(r => r.json())
        .then(setCities)
    }
  }, [selectedCountry])

  return (
    <form action="/api/submit">
      <select
        name="country"
        value={selectedCountry}
        onChange={(e) => setSelectedCountry(e.target.value)}
        required
      >
        <option value="">Select a country</option>
        {countries.map((country) => (
          <option key={country.id} value={country.id}>
            {country.name}
          </option>
        ))}
      </select>

      <select name="city" required disabled={!selectedCountry}>
        <option value="">Select a city</option>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {city.name}
          </option>
        ))}
      </select>

      <button type="submit">Submit</button>
    </form>
  )
}
```

## Form with Confirmation

```tsx
'use client'

import { useState } from 'react'
import { deleteAccount } from '@/app/actions'

export default function DeleteAccountForm() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit(formData: FormData) {
    if (!confirmed) {
      setShowConfirm(true)
      return
    }

    await deleteAccount(formData)
  }

  if (showConfirm) {
    return (
      <div>
        <h2>Are you sure?</h2>
        <p>This action cannot be undone.</p>
        <button onClick={() => setConfirmed(true)}>
          Yes, delete my account
        </button>
        <button onClick={() => setShowConfirm(false)}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <form action={handleSubmit}>
      <p>Delete your account</p>
      <input type="password" name="password" placeholder="Enter password" required />
      <button type="submit">Delete Account</button>
    </form>
  )
}
```

## Search Form with Debouncing

```tsx
'use client'

import { useEffect, useState } from 'react'
import { searchProducts } from '@/app/actions'
import { useDebouncedCallback } from 'use-debounce'

export default function SearchForm() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  const debouncedSearch = useDebouncedCallback(async (value: string) => {
    if (value.length > 2) {
      const products = await searchProducts(value)
      setResults(products)
    } else {
      setResults([])
    }
  }, 300)

  useEffect(() => {
    debouncedSearch(query)
  }, [query, debouncedSearch])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />

      <ul>
        {results.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Best Practices

1. **Progressive Enhancement** - Forms should work without JavaScript
2. **Validate on server** - Never trust client-side validation alone
3. **Provide feedback** - Show loading states and success/error messages
4. **Use semantic HTML** - Proper form elements for accessibility
5. **Handle errors gracefully** - Show specific error messages per field
6. **Reset forms appropriately** - Clear form after successful submission
7. **Disable during submission** - Prevent duplicate submissions
8. **Use TypeScript** - Type your form data and validation schemas
9. **Sanitize input** - Clean data before storing
10. **Test accessibility** - Ensure forms work with keyboard and screen readers

## Security Considerations

1. **CSRF Protection** - Next.js provides this automatically
2. **Input validation** - Validate and sanitize all inputs
3. **Rate limiting** - Prevent form spam
4. **File upload validation** - Check file types and sizes
5. **SQL injection prevention** - Use parameterized queries
6. **XSS prevention** - Sanitize user content
7. **Authentication** - Verify user identity for sensitive actions
8. **Authorization** - Check user permissions
9. **Error messages** - Don't expose sensitive information
10. **Logging** - Track form submissions for audit trails

## Common Patterns

### Form with Server-Side Default Values

```tsx
import { getPost } from '@/lib/data'
import { updatePost } from '@/app/actions'

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id)

  return (
    <form action={updatePost}>
      <input type="hidden" name="id" value={post.id} />
      <input
        type="text"
        name="title"
        defaultValue={post.title}
        required
      />
      <textarea
        name="content"
        defaultValue={post.content}
        required
      />
      <button type="submit">Update Post</button>
    </form>
  )
}
```

### Form with Multiple Submit Buttons

```tsx
export default function PostForm() {
  async function handleSubmit(formData: FormData) {
    'use server'

    const action = formData.get('action')

    if (action === 'draft') {
      await saveDraft(formData)
    } else if (action === 'publish') {
      await publishPost(formData)
    }
  }

  return (
    <form action={handleSubmit}>
      <input type="text" name="title" required />
      <textarea name="content" required />

      <button type="submit" name="action" value="draft">
        Save as Draft
      </button>
      <button type="submit" name="action" value="publish">
        Publish
      </button>
    </form>
  )
}
```
