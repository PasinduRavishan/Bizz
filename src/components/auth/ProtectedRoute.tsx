'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'TEACHER' | 'STUDENT'
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Wait for session to load
    if (status === 'loading') return

    // Redirect to signin if not authenticated
    if (status === 'unauthenticated') {
      router.replace('/auth/signin')
      return
    }

    // Check role mismatch and redirect accordingly
    if (status === 'authenticated' && requiredRole && session?.user?.role !== requiredRole) {
      if (session.user.role === 'TEACHER') {
        router.replace('/teacher/dashboard')
      } else if (session.user.role === 'STUDENT') {
        router.replace('/student/dashboard')
      }
    }
  }, [session, status, requiredRole, router])

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null
  }

  // Don't render if wrong role
  if (requiredRole && session?.user?.role !== requiredRole) {
    return null
  }

  // Render children if all checks pass
  return <>{children}</>
}
