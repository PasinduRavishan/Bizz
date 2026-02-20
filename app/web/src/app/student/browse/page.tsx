'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { ToastContainer, useToast } from '@/components/ui/Toast'
import { apiService } from '@/services/api.service'

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
  teacher: {
    id: string
    name: string | null
    email: string
    address: string | null
  }
  _count: {
    attempts: number
  }
}

interface AccessRequest {
  id: string
  quizId: string
  status: string          // PENDING | APPROVED | PAID | STARTED
  attemptId?: string
  createdAt: string
}

// Maps quizId → student's request (if any)
type RequestMap = Record<string, AccessRequest>

export default function BrowseQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [requestMap, setRequestMap] = useState<RequestMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [requesting, setRequesting] = useState<string | null>(null)  // quizId being requested
  const { toasts, showToast, removeToast } = useToast()

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [quizzesData, requestsData] = await Promise.all([
        apiService.quiz.getAll({ status: 'ACTIVE' }),
        apiService.accessRequest.getMyRequests().catch(() => ({ requests: [] })),
      ])

      const now = new Date()
      const all: Quiz[] = (quizzesData.quizzes || []).filter(
        (q: Quiz) => new Date(q.deadline) > now
      )
      setQuizzes(all)

      // Build a map quizId → request
      const map: RequestMap = {}
      for (const req of (requestsData.requests || [])) {
        map[req.quizId] = req
      }
      setRequestMap(map)
    } catch (err) {
      console.error('Error fetching quizzes:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleRequestAccess = async (quizId: string) => {
    setRequesting(quizId)
    try {
      await apiService.accessRequest.create({ quizId })
      showToast('Access requested! Waiting for teacher approval.', 'success')
      await fetchAll()
    } catch (err) {
      showToast(
        'Request failed: ' + (err instanceof Error ? err.message : 'Unknown error'),
        'error'
      )
    } finally {
      setRequesting(null)
    }
  }

  const filteredQuizzes = quizzes.filter(quiz => {
    const title = (quiz.title || '').toLowerCase()
    const teacherName = (quiz.teacher?.name || quiz.teacher?.email || '').toLowerCase()
    const term = searchTerm.toLowerCase()
    return title.includes(term) || teacherName.includes(term)
  })

  const formatTimeLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now()
    if (diff < 0) return 'Expired'
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 60) return `${mins}m left`
    if (hrs < 24) return `${hrs}h left`
    if (days === 1) return '1 day left'
    return `${days} days left`
  }

  const formatSats = (sats: string | number) => {
    const n = typeof sats === 'string' ? parseInt(sats) : sats
    return (n / 100_000_000).toFixed(5)
  }

  const totalPrize = quizzes.reduce((s, q) => s + parseInt(q.prizePool || '0'), 0)
  const totalAttempts = quizzes.reduce((s, q) => s + (q._count?.attempts || 0), 0)

  // Returns the correct CTA for this quiz based on request state
  const QuizAction = ({ quiz }: { quiz: Quiz }) => {
    const req = requestMap[quiz.id]

    if (!req) {
      return (
        <Button
          className="w-full"
          size="lg"
          onClick={() => handleRequestAccess(quiz.id)}
          disabled={requesting === quiz.id}
        >
          {requesting === quiz.id ? '⏳ Requesting...' : '🎯 Request Access'}
        </Button>
      )
    }

    if (req.status === 'PENDING') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <span className="text-lg">⏳</span>
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Awaiting Approval</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">Teacher is reviewing your request</p>
            </div>
          </div>
        </div>
      )
    }

    if (req.status === 'APPROVED') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <span className="text-lg">💳</span>
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Approved! Ready to Pay</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">Pay entry fee to start the quiz</p>
            </div>
          </div>
          <Link href={`/student/take/${quiz.id}`}>
            <Button className="w-full" size="lg" variant="primary">
              💳 Pay &amp; Start Quiz
            </Button>
          </Link>
        </div>
      )
    }

    if (req.status === 'PAID') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Payment Confirmed</p>
              <p className="text-xs text-green-700 dark:text-green-400">You can now start the quiz</p>
            </div>
          </div>
          <Link href={`/student/take/${quiz.id}`}>
            <Button className="w-full" size="lg" variant="primary">
              🚀 Start Quiz
            </Button>
          </Link>
        </div>
      )
    }

    if (req.status === 'STARTED') {
      const continueHref = req.attemptId
        ? `/student/take/${quiz.id}`
        : `/student/take/${quiz.id}`
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <span className="text-lg">🎓</span>
            <div>
              <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Quiz In Progress</p>
              <p className="text-xs text-purple-700 dark:text-purple-400">Return to continue your attempt</p>
            </div>
          </div>
          <Link href={continueHref}>
            <Button className="w-full" size="lg" variant="outline">
              ↩ Continue Quiz
            </Button>
          </Link>
        </div>
      )
    }

    return (
      <Link href={`/student/take/${quiz.id}`}>
        <Button className="w-full" size="lg">🎯 Go to Quiz</Button>
      </Link>
    )
  }

  // Small status badge shown in quiz card header
  const RequestBadge = ({ quizId }: { quizId: string }) => {
    const req = requestMap[quizId]
    if (!req) return null
    const map: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'danger' }> = {
      PENDING:  { label: '⏳ Requested',  variant: 'default' },
      APPROVED: { label: '💳 Approved',   variant: 'info' },
      PAID:     { label: '✅ Paid',       variant: 'success' },
      STARTED:  { label: '🎓 In Progress', variant: 'info' },
    }
    const chip = map[req.status]
    if (!chip) return null
    return <Badge variant={chip.variant}>{chip.label}</Badge>
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Available Quizzes</h1>
        <p className="text-gray-600 dark:text-gray-400">Choose a quiz to attempt and win Bitcoin</p>
      </div>

      {/* Dashboard link */}
      <div className="mb-6">
        <Link href="/student/dashboard">
          <Button variant="outline" size="sm">← My Dashboard &amp; Attempts</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search by quiz title or teacher name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Stats Bar */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Quizzes</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : quizzes.length}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Prize Pool</div>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '...' : `${formatSats(totalPrize)} LTC`}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</div>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? '...' : totalAttempts}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Quizzes</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={fetchAll}>Try Again</Button>
          </CardBody>
        </Card>
      )}

      {/* Quiz Grid */}
      {!loading && !error && (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredQuizzes.map(quiz => (
            <Card key={quiz.id} hover>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 truncate">
                      {quiz.title || `Quiz ${quiz.contractId.slice(0, 8)}...`}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      by {quiz.teacher?.name || quiz.teacher?.email || 'Teacher'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="success">ACTIVE</Badge>
                    <RequestBadge quizId={quiz.id} />
                  </div>
                </div>
              </CardHeader>

              <CardBody className="space-y-4">
                {/* Prize Box */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Prize Pool</span>
                    <span className="text-xl font-bold text-green-600">{formatSats(quiz.prizePool)} LTC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Entry Fee</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatSats(quiz.entryFee)} LTC
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Questions</span>
                    <span className="font-medium">{quiz.questionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Pass Threshold</span>
                    <span className="font-medium">{quiz.passThreshold}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Attempts</span>
                    <span className="font-medium">{quiz._count?.attempts || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Deadline</span>
                    <span className="font-medium text-orange-600">{formatTimeLeft(quiz.deadline)}</span>
                  </div>
                </div>

                {/* CTA — depends on request state */}
                <QuizAction quiz={quiz} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredQuizzes.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-6xl mb-4">{searchTerm ? '🔍' : '📝'}</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No quizzes found' : 'No active quizzes'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm ? 'Try adjusting your search' : 'Check back later for new quizzes'}
            </p>
          </CardBody>
        </Card>
      )}
    </main>
  )
}
