'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export function AppHeader() {
  const { data: session } = useSession()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
    router.refresh()
  }

  const role = session?.user?.role

  // Determine home link based on role
  const homeLink = role === 'TEACHER' ? '/teacher/dashboard' : role === 'STUDENT' ? '/student/dashboard' : '/'

  return (
    <header className="border-b bg-white dark:bg-zinc-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href={homeLink} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bizz</h1>
            {role && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {role === 'TEACHER' ? '🎓 Teacher' : '📚 Student'}
              </p>
            )}
          </div>
        </Link>

        {/* Navigation - Empty for cleaner UI, logo goes to dashboard */}

        {/* User & Logout */}
        <div className="flex items-center gap-2">
          {session && (
            <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">
              {session.user.name}
            </span>
          )}
          {session && (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
