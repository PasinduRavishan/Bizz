'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletWidget } from '@/components/WalletWidget'

interface Quiz {
  id: string
  contractId: string
  symbol: string
  title: string | null
  questionCount: number
  prizePool: string
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  createdAt: string
  teacher: {
    id: string
    name: string | null
  }
  _count?: {
    attempts: number
  }
}

export default function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuizzes()
  }, [])

  const fetchQuizzes = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/quizzes')
      const data = await response.json()

      if (data.success) {
        setQuizzes(data.quizzes || [])
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

  const formatSatoshis = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    return num.toLocaleString()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'info' | 'default' | 'danger'> = {
      ACTIVE: 'success',
      REVEALED: 'info',
      COMPLETED: 'default'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const canReveal = (quiz: Quiz) => {
    if (quiz.status !== 'ACTIVE') return false
    const now = new Date()
    const deadline = new Date(quiz.deadline)
    return now >= deadline
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          My Quizzes
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your quizzes and reveal answers
        </p>
      </div>

      {/* Wallet Info */}
      <div className="mb-6">
        <WalletWidget />
      </div>

      {/* Create Quiz Button */}
      <div className="mb-6">
        <Link href="/teacher/create">
          <Button size="lg">+ Create New Quiz</Button>
        </Link>
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
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Error Loading Quizzes
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={fetchQuizzes}>Try Again</Button>
          </CardBody>
        </Card>
      )}

      {/* Quizzes List */}
      {!loading && !error && (
        <div className="space-y-4">
          {quizzes.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No Quizzes Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first quiz to get started
                </p>
                <Link href="/teacher/create">
                  <Button>Create Quiz</Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            quizzes.map((quiz) => (
              <Card key={quiz.id} hover>
                <CardBody>
                  <div className="flex items-center justify-between gap-4">
                    {/* Quiz Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {quiz.title || `Quiz ${quiz.symbol}`}
                        </h3>
                        {getStatusBadge(quiz.status)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Questions: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {quiz.questionCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Prize: </span>
                          <span className="font-medium text-green-600">
                            {formatSatoshis(quiz.prizePool)} sats
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Entry Fee: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatSatoshis(quiz.entryFee)} sats
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Attempts: </span>
                          <span className="font-medium text-blue-600">
                            {quiz._count?.attempts || 0}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Deadline: {formatDate(quiz.deadline)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {canReveal(quiz) && quiz.status === 'ACTIVE' ? (
                        <Link href={`/teacher/reveal/${quiz.id}`}>
                          <Button variant="primary">
                            🎯 Reveal & Grade
                          </Button>
                        </Link>
                      ) : quiz.status === 'ACTIVE' ? (
                        <Button variant="outline" disabled>
                          ⏳ Waiting for Deadline
                        </Button>
                      ) : (
                        <Link href={`/teacher/reveal/${quiz.id}`}>
                          <Button variant="outline">
                            View Results
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}
    </main>
  )
}
