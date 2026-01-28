'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

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
    address: string
    publicKey: string
  }
  _count: {
    attempts: number
  }
}

export default function BrowseQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchQuizzes()
  }, [])

  const fetchQuizzes = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/quizzes?status=ACTIVE')
      const data = await response.json()

      if (data.success) {
        // Filter out quizzes with passed deadlines
        const now = new Date()
        const activeQuizzes = (data.data || []).filter((quiz: Quiz) => {
          const deadline = new Date(quiz.deadline)
          return deadline > now
        })
        setQuizzes(activeQuizzes)
      } else {
        setError(data.error || 'Failed to fetch quizzes')
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const filteredQuizzes = quizzes.filter(quiz => {
    const title = quiz.title || ''
    const teacherAddress = quiz.teacher?.address || ''
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacherAddress.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMs < 0) return 'Expired'
    if (diffMinutes < 60) return `${diffMinutes}m left`
    if (diffHours < 24) return `${diffHours}h left`
    if (diffDays === 1) return '1 day left'
    return `${diffDays} days left`
  }

  const formatSatoshis = (satoshis: string | number) => {
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return (sats / 100000000).toFixed(5)
  }

  const totalPrizePool = quizzes.reduce((sum, q) => sum + parseInt(q.prizePool || '0'), 0)
  const totalAttempts = quizzes.reduce((sum, q) => sum + (q._count?.attempts || 0), 0)

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Available Quizzes</h1>
        <p className="text-gray-600 dark:text-gray-400">Choose a quiz to attempt and win Bitcoin</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search quizzes by title or teacher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Stats */}
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
              {loading ? '...' : `${formatSatoshis(totalPrizePool)} LTC`}
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
                Error Loading Quizzes
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <Button onClick={fetchQuizzes}>Try Again</Button>
            </CardBody>
          </Card>
        )}

        {/* Quizzes Grid */}
        {!loading && !error && (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredQuizzes.map((quiz) => (
              <Card key={quiz.id} hover>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {quiz.title || `Quiz ${quiz.contractId.slice(0, 8)}...`}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        by {quiz.teacher?.address?.slice(0, 8)}...{quiz.teacher?.address?.slice(-6)}
                      </p>
                    </div>
                    <Badge variant="success">ACTIVE</Badge>
                  </div>
                </CardHeader>

                <CardBody className="space-y-4">
                  {/* Prize Info */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Prize Pool</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatSatoshis(quiz.prizePool)} LTC
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Entry Fee</span>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatSatoshis(quiz.entryFee)} LTC
                      </span>
                    </div>
                  </div>

                  {/* Quiz Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Questions</span>
                      <span className="font-medium text-gray-900 dark:text-white">{quiz.questionCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Pass Threshold</span>
                      <span className="font-medium text-gray-900 dark:text-white">{quiz.passThreshold}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Attempts</span>
                      <span className="font-medium text-gray-900 dark:text-white">{quiz._count?.attempts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Deadline</span>
                      <span className="font-medium text-orange-600">{formatDate(quiz.deadline)}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link href={`/student/take/${quiz.id}`}>
                    <Button className="w-full" size="lg">
                      🎯 Take Quiz
                    </Button>
                  </Link>
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
                {searchTerm
                  ? 'Try adjusting your search'
                  : 'Check back later for new quizzes'}
              </p>
            </CardBody>
          </Card>
        )}
      </main>
  )
}
