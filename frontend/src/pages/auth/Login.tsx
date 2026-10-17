import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import type { z } from 'zod'
import { GoogleButton } from '@/components/GoogleButton'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { safeNext } from '@/lib/safeNext'
import { loginSchema } from '@/lib/validation'

type Values = z.infer<typeof loginSchema>

export default function Login() {
  const { login, user } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const next = safeNext(sp.get('next'))
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(loginSchema) })

  if (user) return <Navigate to={next} replace />

  const onSubmit = async (v: Values) => {
    setFormError(null)
    try {
      await login(v)
      nav(next, { replace: true })
    } catch (e) {
      setFormError(errorMessage(e))
    }
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Sign in to continue to your analyses.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <GoogleButton label="Continue with Google" />
        {formError && <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="text-right text-sm"><Link to="/forgot-password" className="text-primary underline underline-offset-4">Forgot password?</Link></div>
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">New here? <Link to="/register" className="text-primary underline underline-offset-4">Create an account</Link></p>
    </div>
  )
}
