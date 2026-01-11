'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppHeader } from '@/components/navigation/AppHeader'

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute requiredRole="STUDENT">
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
        <AppHeader />
        {children}
      </div>
    </ProtectedRoute>
  )
}
