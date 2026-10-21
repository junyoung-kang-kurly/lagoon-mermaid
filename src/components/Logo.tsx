import { useId } from 'react'

export function Logo({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M6.5 20.5c3.2 0 3.2-3.6 6.4-3.6s3.2 3.6 6.4 3.6 3.2-3.6 6.4-3.6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M11 10.5h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".75" />
      <circle cx="9" cy="10.5" r="2.6" fill="#fff" />
      <circle cx="23" cy="10.5" r="2.6" fill="#fff" />
    </svg>
  )
}
