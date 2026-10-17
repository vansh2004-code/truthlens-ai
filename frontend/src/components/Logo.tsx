import { Link } from 'react-router-dom'

export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs><linearGradient id="tl-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
      <rect width="32" height="32" rx="8" fill="#151B2B" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="url(#tl-g)" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="2.5" fill="url(#tl-g)" />
    </svg>
  )
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-md font-semibold tracking-tight" aria-label="TruthLens AI home">
      <LogoMark />
      <span>TruthLens <span className="text-gradient">AI</span></span>
    </Link>
  )
}
