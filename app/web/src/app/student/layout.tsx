'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppHeader } from '@/components/navigation/AppHeader'
import { FloatingWallet } from '@/components/FloatingWallet'

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
        <FloatingWallet />
      </div>
    </ProtectedRoute>
  )
}
