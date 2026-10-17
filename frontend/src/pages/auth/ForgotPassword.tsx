import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { api, errorMessage } from '@/lib/api'
import { forgotSchema } from '@/lib/validation'

type Values = z.infer<typeof forgotSchema>

export default function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(forgotSchema) })
  const onSubmit = async (v: Values) => {
    setFormError(null)
    try {
      await api('/api/auth/forgot-password', { method: 'POST', json: v, noRefresh: true })
      setSent(true)
    } catch (e) {
      setFormError(errorMessage(e))
    }
  }
  if (sent) {
    return (
      <div className="space-y-3 text-center" role="status">
        <MailCheck className="mx-auto h-8 w-8 text-ok" aria-hidden />
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted">If an account exists for that address, a reset link has been sent. The link expires in 1 hour.</p>
        <Link to="/login" className="text-sm text-primary underline underline-offset-4">Back to sign in</Link>
      </div>
    )
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">Enter your email and we will send a reset link.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {formError && <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-primary underline underline-offset-4">Back to sign in</Link></p>
    </div>
  )
}
