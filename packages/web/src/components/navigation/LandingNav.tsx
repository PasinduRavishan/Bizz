'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface LandingNavProps {
  onSignIn: () => void
  onSignUp: () => void
}

export function LandingNav({ onSignIn, onSignUp }: LandingNavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Bizz
            </span>
          </Link>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="md"
              onClick={onSignIn}
            >
              Sign In
            </Button>
            <Button 
              variant="primary" 
              size="md"
              onClick={onSignUp}
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
