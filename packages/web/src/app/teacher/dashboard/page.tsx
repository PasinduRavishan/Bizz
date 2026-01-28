'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletBalance } from '@/components/wallet/WalletBalance'
import { PaymentStatus } from '@/components/quiz/PaymentStatus'
import { QuizFinancialDetails } from '@/components/quiz/QuizFinancialDetails'
import { CountdownTimer } from '@/components/ui/CountdownTimer'

interface Quiz {
  id: string
  contractId: string
  title: string | null
  description: string | null
  questionCount: number
  prizePool: string
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  teacherRevealDeadline: string
  distributionDeadline?: string
  createdAt: string
  _count: {
    attempts: number
    winners: number
  }
}

interface DashboardData {
  quizzes: Quiz[]
  stats: {
    totalQuizzes: number
    activeQuizzes: number
    revealedQuizzes: number
    completedQuizzes: number
    abandonedQuizzes: number
    totalAttempts: number
    totalRevenue: string
    refundedAttempts: number
  }
}

export default function TeacherDashboard() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuizForPayment, setSelectedQuizForPayment] = useState<string | null>(null)
  const [selectedQuizForDetails, setSelectedQuizForDetails] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/teacher/dashboard')
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

  const formatSatoshis = (satoshis: string | number) => {
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return sats.toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      ACTIVE: 'success',
      REVEALED: 'info',
      COMPLETED: 'default',
      REFUNDED: 'abandoned',
      ABANDONED: 'abandoned'
    } as const

    const icons = {
      ACTIVE: '🟢',
      REVEALED: '🔓',
      COMPLETED: '✅',
      REFUNDED: '⚠️',
      ABANDONED: '⚠️'
    }

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {icons[status as keyof typeof icons]} {status}
      </Badge>
    )
  }

  const filteredQuizzes = data?.quizzes.filter(quiz => {
    if (filter === 'all') return true
    if (filter === 'active') return quiz.status === 'ACTIVE'
    if (filter === 'revealed') return quiz.status === 'REVEALED'
    if (filter === 'completed') return quiz.status === 'COMPLETED'
    if (filter === 'abandoned') return quiz.status === 'REFUNDED' || quiz.status === 'ABANDONED'
    return true
  }) || []

  const canReveal = (quiz: Quiz) => {
    const now = new Date()
    const deadline = new Date(quiz.deadline)
    const teacherRevealDeadline = new Date(quiz.teacherRevealDeadline)
    
    return (
      quiz.status === 'ACTIVE' &&
      now >= deadline &&
      now <= teacherRevealDeadline
    )
  }

  const getRevealStatus = (quiz: Quiz) => {
    const now = new Date()
    const deadline = new Date(quiz.deadline)
    const teacherRevealDeadline = new Date(quiz.teacherRevealDeadline)
    
    if (quiz.status !== 'ACTIVE') {
      return { message: quiz.status, canReveal: false }
    }
    
    if (now < deadline) {
      return { message: 'Quiz still active', canReveal: false }
    }
    
    if (now > teacherRevealDeadline) {
      return { message: 'Reveal window closed', canReveal: false }
    }
    
    return { message: '✨ Ready to reveal!', canReveal: true }
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Quizzes</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your created quizzes</p>
        </div>
        <Link href="/teacher/create">
          <Button size="lg">+ Create New Quiz</Button>
        </Link>
      </div>

      {/* Wallet Balance */}
      <div className="mb-8">
        <WalletBalance />
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Quizzes</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : data?.stats.totalQuizzes || 0}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '...' : data?.stats.activeQuizzes || 0}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? '...' : data?.stats.completedQuizzes || 0}
            </div>
          </CardBody>
        </Card>
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
            <div className="text-sm text-gray-600 dark:text-gray-400">Refunded</div>
            <div className="text-2xl font-bold text-purple-600">
              {loading ? '...' : data?.stats.refundedAttempts || 0}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter Buttons */}
      {!loading && !error && data && data.quizzes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={filter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({data.stats.totalQuizzes})
          </Button>
          <Button
            variant={filter === 'active' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
          >
            Active ({data.stats.activeQuizzes})
          </Button>
          <Button
            variant={filter === 'revealed' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('revealed')}
          >
            Revealed ({data.stats.revealedQuizzes})
          </Button>
          <Button
            variant={filter === 'completed' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('completed')}
          >
            Completed ({data.stats.completedQuizzes})
          </Button>
          <Button
            variant={filter === 'abandoned' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('abandoned')}
          >
            Abandoned ({data.stats.abandonedQuizzes})
          </Button>
        </div>
      )}

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

      {/* Quizzes List */}
      {!loading && !error && data && (
        <div className="space-y-4">
          {filteredQuizzes.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No quizzes yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first quiz to get started and start earning!
                </p>
                <Link href="/teacher/create">
                  <Button>Create Quiz</Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            filteredQuizzes.map((quiz) => (
              <Card key={quiz.id} hover>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {quiz.title || `Quiz ${quiz.contractId.slice(0, 8)}...`}
                        </h3>
                        {getStatusBadge(quiz.status)}
                      </div>

                      {quiz.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                          {quiz.description}
                        </p>
                      )}

                      <div className="grid md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {quiz.questionCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Prize Pool:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {formatSatoshis(quiz.prizePool)} sats
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Entry Fee:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {formatSatoshis(quiz.entryFee)} sats
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Attempts:</span>
                          <span className="ml-2 font-medium text-blue-600">
                            {quiz._count?.attempts || 0}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Deadline: {formatDate(quiz.deadline)}</span>
                        <span>•</span>
                        <span>Pass: {quiz.passThreshold}%</span>
                        <span>•</span>
                        <span>Created: {formatDate(quiz.createdAt)}</span>
                        {quiz._count?.winners > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-green-600">🏆 {quiz._count.winners} winners</span>
                          </>
                        )}
                      </div>

                      {/* Deadline countdown for ACTIVE quizzes */}
                      {quiz.status === 'ACTIVE' && new Date() < new Date(quiz.deadline) && (
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 text-sm">
                          <span className="text-blue-900 dark:text-blue-100">Submission closes in: </span>
                          <CountdownTimer deadline={quiz.deadline} className="font-medium" />
                        </div>
                      )}

                      {/* Distribution deadline warning for REVEALED quizzes */}
                      {quiz.status === 'REVEALED' && quiz.distributionDeadline && (
                        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div className="flex items-start gap-2">
                            <span className="text-orange-600 text-xl">⚠️</span>
                            <div className="flex-1 text-sm">
                              <div className="font-medium text-orange-900 dark:text-orange-100">
                                Distribution Deadline Approaching
                              </div>
                              <div className="text-orange-700 dark:text-orange-300 mt-1">
                                Distribute prizes within <CountdownTimer deadline={quiz.distributionDeadline} className="font-bold" /> or quiz will be abandoned and students can claim refunds.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Abandoned quiz status */}
                      {(quiz.status === 'REFUNDED' || quiz.status === 'ABANDONED') && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="abandoned">⚠️ ABANDONED</Badge>
                            <span className="text-gray-600 dark:text-gray-400">
                              Students can claim refunds
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {canReveal(quiz) ? (
                        <Link href={`/teacher/reveal/${quiz.id}`}>
                          <Button size="sm" className="whitespace-nowrap">
                            🔓 Reveal & Grade
                          </Button>
                        </Link>
                      ) : quiz.status === 'ACTIVE' ? (
                        <Badge variant="info" className="text-xs">
                          {getRevealStatus(quiz).message}
                        </Badge>
                      ) : (quiz.status === 'REVEALED' || quiz.status === 'COMPLETED') ? (
                        <>
                          <Badge variant="success" className="text-xs mb-1">
                            ✓ Completed
                          </Badge>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedQuizForPayment(quiz.id)}
                          >
                            💰 View Payments
                          </Button>
                        </>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedQuizForDetails(quiz.id)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Payment Status Modal */}
      {selectedQuizForPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Details</h2>
              <button
                onClick={() => setSelectedQuizForPayment(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <PaymentStatus
                quizId={selectedQuizForPayment}
                onRetry={() => {
                  // Refresh dashboard after retry
                  window.location.reload()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quiz Financial Details Modal */}
      {selectedQuizForDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <QuizFinancialDetails
                quizId={selectedQuizForDetails}
                viewerRole="TEACHER"
                onClose={() => setSelectedQuizForDetails(null)}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
