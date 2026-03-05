import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <div       onClick={onClick}      className={`
        bg-white dark:bg-zinc-900 
        border border-gray-200 dark:border-zinc-800 
        rounded-lg shadow-sm 
        ${hover ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 dark:border-zinc-800 ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 dark:border-zinc-800 ${className}`}>
      {children}
    </div>
  )
}
