import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import type { z } from 'zod'
import { GoogleButton } from '@/components/GoogleButton'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/input'
import { ApiError, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { registerSchema } from '@/lib/validation'

type Values = z.infer<typeof registerSchema>

export default function Register() {
  const { register: signUp, user } = useAuth()
  const nav = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(registerSchema) })

  if (user) return <Navigate to="/dashboard" replace />

  const onSubmit = async (v: Values) => {
    setFormError(null)
    setProblems([])
    try {
      await signUp({ email: v.email, password: v.password, display_name: v.display_name ?? '' })
      nav('/dashboard', { replace: true })
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'weak_password') setProblems(e.problems)
        if (e.code === 'email_taken') setError('email', { message: e.message })
        const fe = e.fieldErrors
        for (const [f, m] of Object.entries(fe)) if (f === 'email' || f === 'password' || f === 'display_name') setError(f, { message: m })
        if (e.code !== 'email_taken' && Object.keys(fe).length === 0) setFormError(e.message)
      } else setFormError(errorMessage(e))
    }
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Analyze videos and keep control of your data. No uploads are used for training by default.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <GoogleButton label="Sign up with Google" />
        {formError && <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
        <Field label="Display name (optional)" autoComplete="name" error={errors.display_name?.message} {...register('display_name')} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label="Password" type="password" autoComplete="new-password" hint="At least 10 characters with upper and lower case letters and a digit." error={errors.password?.message} {...register('password')} />
        {problems.length > 0 && <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-danger">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-4 text-xs text-muted">By creating an account you agree to the handling described in the <Link to="/privacy" className="underline underline-offset-4">privacy notice</Link>.</p>
      <p className="mt-4 text-center text-sm text-muted">Already registered? <Link to="/login" className="text-primary underline underline-offset-4">Sign in</Link></p>
    </div>
  )
}
