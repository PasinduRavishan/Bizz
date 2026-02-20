'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

/**
 * AuthWidget Component
 *
 * Demonstrates using Zustand for state management
 * - Shows login/signup forms when not authenticated
 * - Shows user info when authenticated
 * - Demonstrates Zustand's simple API
 */
export function AuthWidget() {
  // Access Zustand store - that's it! No providers needed
  const { user, isLoading, error, login, signup, logout, clearError } = useAuthStore()

  // Local state for form inputs
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    try {
      if (isSignup) {
        await signup(email, password, name, role)
      } else {
        await login(email, password)
      }
      // Clear form on success
      setEmail('')
      setPassword('')
      setName('')
    } catch (err) {
      // Error is handled in the store
      console.error('Auth error:', err)
    }
  }

  // If user is logged in, show their info
  if (user) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Welcome back!</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{user.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Role: <span className="font-semibold">{user.role}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Wallet</div>
                <div className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {user.address?.slice(0, 6)}...{user.address?.slice(-4)}
                </div>
              </div>
            </div>
            <Button onClick={logout} size="sm" variant="secondary" className="w-full">
              Logout
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  // Show login/signup form
  return (
    <Card>
      <CardBody className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              size="sm"
              variant={!isSignup ? 'primary' : 'secondary'}
              onClick={() => setIsSignup(false)}
              className="flex-1"
            >
              Login
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isSignup ? 'primary' : 'secondary'}
              onClick={() => setIsSignup(true)}
              className="flex-1"
            >
              Signup
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {isSignup && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'STUDENT' | 'TEACHER')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
              </select>
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Please wait...' : isSignup ? 'Create Account' : 'Login'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
