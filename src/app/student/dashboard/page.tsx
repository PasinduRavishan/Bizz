'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletBalance } from '@/components/wallet/WalletBalance'

interface QuizAttempt {
  id: string
  score: number
  passed: boolean
  status: string
  submitTimestamp: string
  prizeAmount: string | null
  quiz: {
    id: string
    title: string | null
    description: string | null
    questionCount: number
    passThreshold: number
    status: string
    deadline: string
    studentRevealDeadline: string
    teacherRevealDeadline: string
  }
}

interface DashboardData {
  attempts: QuizAttempt[]
  stats: {
    totalAttempts: number
    completedAttempts: number
    passedQuizzes: number
    totalEarnings: string
  }
}

export default function StudentDashboard() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/student/dashboard')
        const result = await response.json()

        if (response.ok) {
          setData(result)
        } else {
          setError(result.error || 'Failed to fetch dashboard data')
        }
      } catch (err) {
        console.error('Error fetching dashboard:', err)
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchDashboard()
    }
  }, [session])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      COMMITTED: 'warning',
      REVEALED: 'info',
      VERIFIED: 'success',
      FAILED: 'danger',
    } as const

    return <Badge variant={variants[status as keyof typeof variants] || 'default'}>{status}</Badge>
  }

  const canReveal = (attempt: QuizAttempt) => {
    const now = new Date()
    const deadline = new Date(attempt.quiz.deadline)
    const studentRevealDeadline = new Date(attempt.quiz.studentRevealDeadline)
    
    return (
      attempt.status === 'COMMITTED' &&
      now >= deadline &&
      now <= studentRevealDeadline
    )
  }

  const getRevealStatus = (attempt: QuizAttempt) => {
    const now = new Date()
    const deadline = new Date(attempt.quiz.deadline)
    const studentRevealDeadline = new Date(attempt.quiz.studentRevealDeadline)
    
    if (attempt.status !== 'COMMITTED') {
      return { message: attempt.status, canReveal: false }
    }
    
    if (now < deadline) {
      return { message: 'Quiz deadline not reached', canReveal: false }
    }
    
    if (now > studentRevealDeadline) {
      return { message: 'Reveal window closed', canReveal: false }
    }
    
    return { message: '✨ Ready to reveal!', canReveal: true }
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Attempts</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your quiz progress and earnings</p>
        </div>
        <Link href="/student/browse">
          <Button size="lg">Browse Quizzes</Button>
        </Link>
      </div>

      {/* Wallet Balance */}
      <div className="mb-8">
        <WalletBalance />
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : data?.stats.totalAttempts || 0}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? '...' : data?.stats.completedAttempts || 0}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Passed</div>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '...' : data?.stats.passedQuizzes || 0}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</div>
            <div className="text-2xl font-bold text-purple-600">
              {loading ? '...' : `${data?.stats.totalEarnings || '0.00000000'} BTC`}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Error Loading Dashboard
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardBody>
        </Card>
      )}

      {/* Attempts List */}
      {!loading && !error && data && (
        <div className="space-y-4">
          {data.attempts.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No attempts yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start taking quizzes to earn rewards and test your knowledge!
                </p>
                <Link href="/student/browse">
                  <Button>Browse Available Quizzes</Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            data.attempts.map((attempt) => (
              <Card key={attempt.id} hover>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {attempt.quiz.title || 'Untitled Quiz'}
                        </h3>
                        {getStatusBadge(attempt.status)}
                        {attempt.passed && (
                          <Badge variant="success">✓ Passed</Badge>
                        )}
                        {attempt.status === 'VERIFIED' && !attempt.passed && (
                          <Badge variant="danger">✗ Failed</Badge>
                        )}
                      </div>

                      {attempt.quiz.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                          {attempt.quiz.description}
                        </p>
                      )}

                      <div className="grid md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Score:</span>
                          <span className={`ml-2 font-medium ${
                            attempt.passed ? 'text-green-600' : 'text-gray-900 dark:text-white'
                          }`}>
                            {attempt.score}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Required:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {attempt.quiz.passThreshold}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {attempt.quiz.questionCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Prize:</span>
                          <span className="ml-2 font-medium text-purple-600">
                            {attempt.prizeAmount ? `${(Number(attempt.prizeAmount) / 100000000).toFixed(8)} BTC` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Submitted: {formatDate(attempt.submitTimestamp)}</span>
                        <span>•</span>
                        <span>Quiz Status: {attempt.quiz.status}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {canReveal(attempt) ? (
                        <Link href={`/student/reveal/${attempt.id}`}>
                          <Button size="sm" className="whitespace-nowrap">
                            🔓 Reveal Answers
                          </Button>
                        </Link>
                      ) : attempt.status === 'COMMITTED' ? (
                        <Badge variant="warning" className="text-xs">
                          {getRevealStatus(attempt).message}
                        </Badge>
                      ) : attempt.status === 'REVEALED' ? (
                        <Badge variant="info" className="text-xs">
                          ⏳ Awaiting teacher reveal
                        </Badge>
                      ) : null}
                      {attempt.status === 'VERIFIED' && (
                        <Button size="sm" variant="outline">View Results</Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Quick Actions */}
      {!loading && !error && data && data.attempts.length > 0 && (
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <Card hover>
            <CardBody className="text-center py-8">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Browse More Quizzes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Discover new quizzes and earn more rewards
              </p>
              <Link href="/student/browse">
                <Button>Explore Quizzes</Button>
              </Link>
            </CardBody>
          </Card>
          <Card hover>
            <CardBody className="text-center py-8">
              <div className="text-4xl mb-3">🏆</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Your Achievements
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {data.stats.passedQuizzes} quizzes passed • {data.stats.totalEarnings} BTC earned
              </p>
              <Button variant="outline" disabled>Coming Soon</Button>
            </CardBody>
          </Card>
        </div>
      )}
    </main>
  )
}
