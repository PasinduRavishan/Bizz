'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'TEACHER' | 'STUDENT'
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) {
      router.replace('/auth/signin')
      return
    }
    if (requiredRole && user.role !== requiredRole) {
      // Wrong role — redirect to their correct dashboard
      router.replace(user.role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard')
    }
  }, [user, requiredRole, router])

  if (!user) return null
  if (requiredRole && user.role !== requiredRole) return null

  return <>{children}</>
}
