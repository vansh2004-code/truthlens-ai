import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { api, ApiError, errorMessage } from '@/lib/api'
import { resetSchema } from '@/lib/validation'

type Values = z.infer<typeof resetSchema>

export default function ResetPassword() {
  const [sp] = useSearchParams()
  const token = sp.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(resetSchema) })

  if (!token) {
    return (
      <div role="alert" className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Reset link missing</h1>
        <p className="text-sm text-muted">This page needs a valid reset link from your email.</p>
        <Link to="/forgot-password" className="text-sm text-primary underline underline-offset-4">Request a new link</Link>
      </div>
    )
  }
  if (done) {
    return (
      <div className="space-y-3 text-center" role="status">
        <CheckCircle2 className="mx-auto h-8 w-8 text-ok" aria-hidden />
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <p className="text-sm text-muted">You have been signed out everywhere. Sign in with your new password.</p>
        <Button asChild variant="primary"><Link to="/login">Sign in</Link></Button>
      </div>
    )
  }
  const onSubmit = async (v: Values) => {
    setFormError(null)
    setProblems([])
    try {
      await api('/api/auth/reset-password', { method: 'POST', json: { token, password: v.password }, noRefresh: true })
      setDone(true)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'weak_password') setProblems(e.problems)
      setFormError(errorMessage(e))
    }
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {formError && <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
        <Field label="New password" type="password" autoComplete="new-password" hint="At least 10 characters with upper and lower case letters and a digit." error={errors.password?.message} {...register('password')} />
        {problems.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-danger">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </div>
  )
}
