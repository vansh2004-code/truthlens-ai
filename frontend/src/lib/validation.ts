import { z } from 'zod'
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MIN_UPLOAD_BYTES } from './constants'

/** Mirrors backend validate_password_strength. */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((p) => p.toLowerCase() !== p && p.toUpperCase() !== p, 'Mix upper and lower case letters.')
  .refine((p) => /\d/.test(p), 'Include at least one digit.')

const email = z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.')

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.') })
export const registerSchema = z.object({
  display_name: z.string().trim().max(120, 'Keep your name under 120 characters.').optional(),
  email,
  password: passwordSchema,
})
export const forgotSchema = z.object({ email })
export const resetSchema = z.object({ password: passwordSchema })
export const changePasswordSchema = z
  .object({ current_password: z.string().min(1, 'Enter your current password.'), new_password: passwordSchema })
  .refine((v) => v.current_password !== v.new_password, { path: ['new_password'], message: 'Choose a password different from the current one.' })

export function validateUpload(file: Pick<File, 'name' | 'size'>): string | null {
  const lower = file.name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot) : ''
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Unsupported file type${ext ? ` (${ext})` : ''}. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}.`
  }
  if (file.size < MIN_UPLOAD_BYTES) return 'This file is too small to be a valid video.'
  if (file.size > MAX_UPLOAD_BYTES) return `File exceeds the ${MAX_UPLOAD_MB} MB limit.`
  return null
}
