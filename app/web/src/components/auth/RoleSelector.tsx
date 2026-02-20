'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function RoleSelector() {
  const { setRole } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSelectRole = async (selectedRole: 'TEACHER' | 'STUDENT') => {
    setIsLoading(true)
    try {
      setRole(selectedRole)
      
      // Redirect to appropriate dashboard
      if (selectedRole === 'TEACHER') {
        router.push('/teacher/dashboard')
      } else {
        router.push('/student/browse')
      }
    } catch (error) {
      console.error('Failed to set role:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Choose Your Role
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Select how you want to use the platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Teacher Card */}
          <Card hover>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🎓</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Teacher</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Create quizzes with prize pools and earn from entry fees
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Create & manage quizzes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Set prize pools & fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Monitor student attempts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Earn from entry fees</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => handleSelectRole('TEACHER')}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Continue as Teacher'}
              </Button>
            </CardBody>
          </Card>

          {/* Student Card */}
          <Card hover>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Student</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Take quizzes and earn Bitcoin for correct answers
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Browse available quizzes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Compete for prizes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Track your attempts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Earn Bitcoin rewards</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                variant="primary"
                onClick={() => handleSelectRole('STUDENT')}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Continue as Student'}
              </Button>
            </CardBody>
          </Card>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          You can switch roles anytime from your profile
        </p>
      </div>
    </div>
  )
}
