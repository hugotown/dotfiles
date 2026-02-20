# File Uploads in Next.js App Router

Comprehensive guide for handling file uploads, cloud storage integration, and streaming uploads.

## Table of Contents
- [Basic File Upload](#basic-file-upload)
- [Cloud Storage Integration](#cloud-storage-integration)
- [Streaming Uploads](#streaming-uploads)
- [Image Optimization](#image-optimization)
- [File Validation](#file-validation)
- [Progress Tracking](#progress-tracking)

## Basic File Upload

### Simple File Upload with Server Action

```tsx
// app/actions.ts
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function uploadFile(formData: FormData) {
  const file = formData.get('file') as File

  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Save to public/uploads directory
  const filename = `${Date.now()}-${file.name}`
  const path = join(process.cwd(), 'public', 'uploads', filename)

  await writeFile(path, buffer)

  return {
    success: true,
    url: `/uploads/${filename}`
  }
}
```

```tsx
// app/upload/page.tsx
import { uploadFile } from '@/app/actions'

export default function UploadPage() {
  return (
    <form action={uploadFile}>
      <input type="file" name="file" required />
      <button type="submit">Upload</button>
    </form>
  )
}
```

### Client-Side Upload with Progress

```tsx
// components/FileUpload.tsx
'use client'

import { useState } from 'react'

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentage = (e.loaded / e.total) * 100
          setProgress(percentage)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          console.log('Upload successful:', response)
        }
      })

      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleUpload}>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        disabled={uploading}
      />
      <button type="submit" disabled={!file || uploading}>
        Upload
      </button>

      {uploading && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
          <span>{Math.round(progress)}%</span>
        </div>
      )}
    </form>
  )
}
```

### Route Handler for Upload

```ts
// app/api/upload/route.ts
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return Response.json(
      { error: 'No file provided' },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const filename = `${Date.now()}-${file.name}`
  const path = join(process.cwd(), 'public', 'uploads', filename)

  await writeFile(path, buffer)

  return Response.json({
    success: true,
    url: `/uploads/${filename}`
  })
}
```

## Cloud Storage Integration

### AWS S3 Upload

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```ts
// lib/s3.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

export async function uploadToS3(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const key = `uploads/${Date.now()}-${file.name}`

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: file.type
  })

  await s3Client.send(command)

  return {
    key,
    url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  }
}

export async function getSignedUploadUrl(filename: string, contentType: string) {
  const key = `uploads/${Date.now()}-${filename}`

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    ContentType: contentType
  })

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600 // 1 hour
  })

  return { signedUrl, key }
}
```

```tsx
// app/actions.ts
'use server'

import { uploadToS3 } from '@/lib/s3'
import { prisma } from '@/lib/prisma'

export async function uploadFileToS3(formData: FormData) {
  const file = formData.get('file') as File

  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  const { url, key } = await uploadToS3(file)

  // Save to database
  const upload = await prisma.upload.create({
    data: {
      filename: file.name,
      url,
      key,
      size: file.size,
      contentType: file.type
    }
  })

  return { success: true, upload }
}
```

### Presigned URL Upload (Client-Side)

```ts
// app/api/upload/presigned-url/route.ts
import { getSignedUploadUrl } from '@/lib/s3'

export async function POST(request: Request) {
  const { filename, contentType } = await request.json()

  const { signedUrl, key } = await getSignedUploadUrl(filename, contentType)

  return Response.json({ signedUrl, key })
}
```

```tsx
// components/S3Upload.tsx
'use client'

import { useState } from 'react'

export function S3Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload() {
    if (!file) return

    setUploading(true)

    try {
      // Get presigned URL
      const response = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type
        })
      })

      const { signedUrl, key } = await response.json()

      // Upload directly to S3
      await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })

      console.log('Upload successful:', key)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        disabled={uploading}
      />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload to S3'}
      </button>
    </div>
  )
}
```

### Cloudinary Integration

```bash
npm install cloudinary
```

```ts
// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

export async function uploadToCloudinary(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'uploads',
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(buffer)
  })
}

export function getCloudinarySignature() {
  const timestamp = Math.round(new Date().getTime() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: 'uploads'
    },
    process.env.CLOUDINARY_API_SECRET!
  )

  return { timestamp, signature }
}
```

```tsx
// app/actions.ts
'use server'

import { uploadToCloudinary } from '@/lib/cloudinary'

export async function uploadToCloud(formData: FormData) {
  const file = formData.get('file') as File

  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  const result = await uploadToCloudinary(file) as any

  return {
    success: true,
    url: result.secure_url,
    publicId: result.public_id
  }
}
```

## Streaming Uploads

### Streaming to Disk

```ts
// app/api/upload/stream/route.ts
import { createWriteStream } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type')
  const filename = request.headers.get('x-filename') || `upload-${Date.now()}`

  if (!request.body) {
    return Response.json({ error: 'No body' }, { status: 400 })
  }

  const path = join(process.cwd(), 'public', 'uploads', filename)
  const writeStream = createWriteStream(path)

  try {
    // Stream the request body directly to disk
    await pipeline(
      request.body as any,
      writeStream
    )

    return Response.json({
      success: true,
      url: `/uploads/${filename}`
    })
  } catch (error) {
    return Response.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
```

### Chunked Upload

```tsx
// components/ChunkedUpload.tsx
'use client'

import { useState } from 'react'

const CHUNK_SIZE = 1024 * 1024 // 1MB chunks

export function ChunkedUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)

  async function uploadChunk(chunk: Blob, chunkIndex: number, totalChunks: number) {
    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('chunkIndex', chunkIndex.toString())
    formData.append('totalChunks', totalChunks.toString())
    formData.append('filename', file!.name)

    await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData
    })
  }

  async function handleUpload() {
    if (!file) return

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      await uploadChunk(chunk, i, totalChunks)

      setProgress(((i + 1) / totalChunks) * 100)
    }
  }

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload} disabled={!file}>
        Upload
      </button>
      {progress > 0 && <div>Progress: {Math.round(progress)}%</div>}
    </div>
  )
}
```

```ts
// app/api/upload/chunk/route.ts
import { appendFile, writeFile } from 'fs/promises'
import { join } from 'path'

const uploadDir = join(process.cwd(), 'public', 'uploads')

export async function POST(request: Request) {
  const formData = await request.formData()
  const chunk = formData.get('chunk') as Blob
  const chunkIndex = parseInt(formData.get('chunkIndex') as string)
  const totalChunks = parseInt(formData.get('totalChunks') as string)
  const filename = formData.get('filename') as string

  const buffer = Buffer.from(await chunk.arrayBuffer())
  const path = join(uploadDir, filename)

  if (chunkIndex === 0) {
    // First chunk - create new file
    await writeFile(path, buffer)
  } else {
    // Subsequent chunks - append to file
    await appendFile(path, buffer)
  }

  return Response.json({
    success: true,
    isComplete: chunkIndex === totalChunks - 1
  })
}
```

## Image Optimization

### Automatic Image Optimization with Sharp

```bash
npm install sharp
```

```ts
// lib/image.ts
import sharp from 'sharp'

export async function optimizeImage(buffer: Buffer) {
  return await sharp(buffer)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toBuffer()
}

export async function createThumbnail(buffer: Buffer, width = 200, height = 200) {
  return await sharp(buffer)
    .resize(width, height, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 70 })
    .toBuffer()
}
```

```tsx
// app/actions.ts
'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { optimizeImage, createThumbnail } from '@/lib/image'

export async function uploadImage(formData: FormData) {
  const file = formData.get('file') as File

  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'File must be an image' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Optimize original
  const optimized = await optimizeImage(buffer)
  const filename = `${Date.now()}-${file.name}`
  const path = join(process.cwd(), 'public', 'uploads', filename)
  await writeFile(path, optimized)

  // Create thumbnail
  const thumbnail = await createThumbnail(buffer)
  const thumbFilename = `thumb-${filename}`
  const thumbPath = join(process.cwd(), 'public', 'uploads', thumbFilename)
  await writeFile(thumbPath, thumbnail)

  return {
    success: true,
    url: `/uploads/${filename}`,
    thumbnail: `/uploads/${thumbFilename}`
  }
}
```

### Next.js Image Component Integration

```tsx
// components/UploadedImage.tsx
import Image from 'next/image'

type Props = {
  src: string
  alt: string
  width?: number
  height?: number
}

export function UploadedImage({ src, alt, width = 800, height = 600 }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="rounded-lg"
      priority={false}
      loading="lazy"
    />
  )
}
```

## File Validation

### Comprehensive File Validation

```ts
// lib/validation.ts
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
]

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF'
    }
  }

  return { valid: true }
}

export async function validateImageDimensions(
  file: File,
  maxWidth = 4000,
  maxHeight = 4000
): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      if (img.width > maxWidth || img.height > maxHeight) {
        resolve({
          valid: false,
          error: `Image dimensions must be less than ${maxWidth}x${maxHeight}px`
        })
      } else {
        resolve({ valid: true })
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ valid: false, error: 'Invalid image file' })
    }

    img.src = url
  })
}
```

```tsx
// components/ValidatedFileUpload.tsx
'use client'

import { useState } from 'react'
import { validateFile } from '@/lib/validation'

export function ValidatedFileUpload() {
  const [error, setError] = useState<string>('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateFile(file)

    if (!validation.valid) {
      setError(validation.error!)
      e.target.value = '' // Clear the input
    } else {
      setError('')
    }
  }

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        accept="image/*,application/pdf"
      />
      {error && <p className="error">{error}</p>}
    </div>
  )
}
```

## Progress Tracking

### Upload with Progress Hook

```tsx
// hooks/useUpload.ts
'use client'

import { useState, useCallback } from 'react'

type UploadState = {
  uploading: boolean
  progress: number
  error: string | null
  url: string | null
}

export function useUpload(endpoint: string = '/api/upload') {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    url: null
  })

  const upload = useCallback(async (file: File) => {
    setState({ uploading: true, progress: 0, error: null, url: null })

    const formData = new FormData()
    formData.append('file', file)

    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100
          setState(prev => ({ ...prev, progress }))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          setState({
            uploading: false,
            progress: 100,
            error: null,
            url: response.url
          })
          resolve(response.url)
        } else {
          const error = 'Upload failed'
          setState({
            uploading: false,
            progress: 0,
            error,
            url: null
          })
          reject(new Error(error))
        }
      })

      xhr.addEventListener('error', () => {
        const error = 'Upload failed'
        setState({
          uploading: false,
          progress: 0,
          error,
          url: null
        })
        reject(new Error(error))
      })

      xhr.open('POST', endpoint)
      xhr.send(formData)
    })
  }, [endpoint])

  return { ...state, upload }
}
```

```tsx
// components/UploadWithProgress.tsx
'use client'

import { useUpload } from '@/hooks/useUpload'

export function UploadWithProgress() {
  const { uploading, progress, error, url, upload } = useUpload()

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await upload(file)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={uploading} />

      {uploading && (
        <div className="progress">
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
          <span>{Math.round(progress)}%</span>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {url && <p className="success">Uploaded: {url}</p>}
    </div>
  )
}
```

## Best Practices

1. **Validate files** - Check size, type, and dimensions both client and server-side
2. **Use cloud storage** - For production apps, use S3, Cloudinary, or similar
3. **Optimize images** - Resize and compress before storing
4. **Presigned URLs** - For client-side uploads directly to cloud storage
5. **Stream large files** - Use streaming for files over 10MB
6. **Progress feedback** - Show upload progress to users
7. **Error handling** - Handle network failures and retry logic
8. **Security** - Validate file types, scan for malware, sanitize filenames
9. **Clean up** - Delete old/unused files periodically
10. **Rate limiting** - Prevent abuse with upload limits

## Resources

- [Next.js File Upload Guide](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#streaming)
- [AWS S3 SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
