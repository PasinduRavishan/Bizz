'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'

export function AppHeader() {
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const role = user?.role
  const homeLink = role === 'TEACHER' ? '/teacher/dashboard' : role === 'STUDENT' ? '/student/dashboard' : '/'

  return (
    <header className="border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href={homeLink} className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/20">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-none">Bizz</h1>
            {role && (
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                {role === 'TEACHER' ? '🎓 Teacher' : '📚 Student'}
              </p>
            )}
          </div>
        </Link>

        {/* Role-based nav links */}
        {role === 'TEACHER' && (
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/teacher/dashboard"
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/teacher/create"
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Create Quiz
            </Link>
          </nav>
        )}

        {role === 'STUDENT' && (
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/student/browse"
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Browse Quizzes
            </Link>
            <Link
              href="/student/dashboard"
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              My Attempts
            </Link>
          </nav>
        )}

        {/* User info + Logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                {user.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {user.name}
              </span>
            </div>
          )}
          {user && (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
