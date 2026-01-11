'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LandingNav } from '@/components/navigation/LandingNav'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // Only redirect if fully authenticated and not currently loading
    if (status === 'authenticated' && session?.user) {
      // Redirect authenticated users based on role
      if (session.user.role === 'TEACHER') {
        router.replace('/teacher/dashboard')
      } else if (session.user.role === 'STUDENT') {
        router.replace('/student/dashboard')
      }
    }
  }, [session, status, router])

  const handleSignIn = () => {
    router.push('/auth/signin')
  }

  const handleSignUp = () => {
    router.push('/auth/signup')
  }

  // Show loading only while checking authentication status
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

  // Don't render landing page if authenticated (will redirect)
  if (status === 'authenticated') {
    return null
  }

  // Landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      <LandingNav onSignIn={handleSignIn} onSignUp={handleSignUp} />
      
      <div className="container mx-auto px-4 pt-32 pb-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Bizz
          </h1>
          <p className="text-2xl text-gray-600 dark:text-gray-300 mb-4 max-w-3xl mx-auto">
            Decentralized Quiz Platform on Bitcoin
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Create and take quizzes with blockchain-verified results
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto mb-20">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎓</span>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">For Teachers</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Create and deploy quizzes on the blockchain
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📚</span>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">For Students</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Take quizzes and get verified results
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">Secure & Verifiable</h3>
            <p className="text-gray-600 dark:text-gray-400">
              All data stored permanently on Bitcoin
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
