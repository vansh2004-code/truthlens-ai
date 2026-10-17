import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES } from '@/lib/constants'
import { changePasswordSchema, loginSchema, registerSchema, resetSchema, validateUpload } from '@/lib/validation'

describe('auth schemas', () => {
  it('login requires valid email and password', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  })
  it.each([
    ['short1A', 'Use at least 10 characters.'],
    ['alllowercase123', 'Mix upper and lower case letters.'],
    ['NoDigitsHereAtAll', 'Include at least one digit.'],
  ])('register rejects weak password %s', (password, msg) => {
    const r = registerSchema.safeParse({ email: 'a@b.co', password })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toContain(msg)
  })
  it('register accepts a strong password', () => {
    expect(registerSchema.safeParse({ email: 'a@b.co', password: 'Str0ngPassw0rd', display_name: 'Ann' }).success).toBe(true)
  })
  it('reset enforces the same policy', () => {
    expect(resetSchema.safeParse({ password: 'weak' }).success).toBe(false)
    expect(resetSchema.safeParse({ password: 'Str0ngPassw0rd' }).success).toBe(true)
  })
  it('change password rejects reuse of the current password', () => {
    expect(changePasswordSchema.safeParse({ current_password: 'Str0ngPassw0rd', new_password: 'Str0ngPassw0rd' }).success).toBe(false)
  })
})

describe('upload pre-validation', () => {
  it('accepts allowed extensions case-insensitively', () => {
    for (const n of ['a.mp4', 'a.MOV', 'a.m4v', 'a.webm', 'a.mkv', 'a.avi']) expect(validateUpload({ name: n, size: 5000 })).toBeNull()
  })
  it('rejects unsupported or missing extensions', () => {
    expect(validateUpload({ name: 'a.exe', size: 5000 })).toMatch(/Unsupported file type/)
    expect(validateUpload({ name: 'noext', size: 5000 })).toMatch(/Unsupported/)
  })
  it('rejects oversize and tiny files', () => {
    expect(validateUpload({ name: 'a.mp4', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/exceeds/)
    expect(validateUpload({ name: 'a.mp4', size: 10 })).toMatch(/too small/)
    expect(validateUpload({ name: 'a.mp4', size: MAX_UPLOAD_BYTES })).toBeNull()
  })
})
