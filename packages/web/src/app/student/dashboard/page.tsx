'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletWidget } from '@/components/WalletWidget'

interface QuizAttempt {
  id: string
  contractId: string
  status: string
  score: number | null
  passed: boolean | null
  createdAt: string
  quiz: {
    id: string
    contractId: string
    title: string | null
    symbol: string
    questionCount: number
    passThreshold: number
    status: string
    prizePool: string
    entryFee: string
  }
}

export default function StudentDashboard() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAttempts()
  }, [])

  const fetchAttempts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/student/attempts?studentId=temp-student-id')
      const data = await response.json()

      if (data.success) {
        setAttempts(data.attempts || [])
      } else {
        setError(data.error || 'Failed to fetch attempts')
      }
    } catch (err) {
      console.error('Error fetching attempts:', err)
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

  const getStatusBadge = (attempt: QuizAttempt) => {
    if (attempt.passed === true) {
      return <Badge variant="success">PASSED - Winner! 🏆</Badge>
    } else if (attempt.passed === false) {
      return <Badge variant="danger">FAILED</Badge>
    } else if (attempt.status === 'COMMITTED') {
      return <Badge variant="info">SUBMITTED</Badge>
    } else if (attempt.status === 'VERIFIED') {
      return <Badge variant="success">VERIFIED</Badge>
    }
    return <Badge variant="default">{attempt.status}</Badge>
  }

  const canClaimPrize = (attempt: QuizAttempt) => {
    return attempt.passed === true && attempt.quiz.status === 'REVEALED'
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          My Quiz Attempts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your quiz attempts and claim prizes
        </p>
      </div>

      {/* Wallet Info */}
      <div className="mb-6">
        <WalletWidget />
      </div>

      {/* Browse Quizzes Button */}
      <div className="mb-6">
        <Link href="/student/browse">
          <Button size="lg">🎯 Browse Quizzes</Button>
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
              Error Loading Attempts
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={fetchAttempts}>Try Again</Button>
          </CardBody>
        </Card>
      )}

      {/* Attempts List */}
      {!loading && !error && (
        <div className="space-y-4">
          {attempts.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No Attempts Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Browse quizzes and take your first quiz
                </p>
                <Link href="/student/browse">
                  <Button>Browse Quizzes</Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            attempts.map((attempt) => (
              <Card key={attempt.id} hover>
                <CardBody>
                  <div className="flex items-center justify-between gap-4">
                    {/* Attempt Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {attempt.quiz.title || `Quiz ${attempt.quiz.symbol}`}
                        </h3>
                        {getStatusBadge(attempt)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Questions: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {attempt.quiz.questionCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Your Score: </span>
                          <span className={`font-medium ${
                            attempt.passed === true
                              ? 'text-green-600'
                              : attempt.passed === false
                              ? 'text-red-600'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {attempt.score !== null ? `${attempt.score}%` : 'Pending'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Pass Needed: </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {attempt.quiz.passThreshold}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Prize Pool: </span>
                          <span className="font-medium text-green-600">
                            {formatSatoshis(attempt.quiz.prizePool)} sats
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Attempted: {formatDate(attempt.createdAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {canClaimPrize(attempt) ? (
                        <Link href={`/student/prize/${attempt.id}`}>
                          <Button variant="primary">
                            🏆 Claim Prize
                          </Button>
                        </Link>
                      ) : attempt.quiz.status === 'ACTIVE' && attempt.status === 'COMMITTED' ? (
                        <Button variant="outline" disabled>
                          ⏳ Waiting for Results
                        </Button>
                      ) : attempt.quiz.status === 'REVEALED' && !attempt.passed ? (
                        <Button variant="outline" disabled>
                          ❌ Not Passed
                        </Button>
                      ) : (
                        <Button variant="outline" disabled>
                          {attempt.status}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Summary Stats */}
      {!loading && !error && attempts.length > 0 && (
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <Card>
            <CardBody className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Attempts
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {attempts.length}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Passed (Won)
              </div>
              <div className="text-3xl font-bold text-green-600">
                {attempts.filter(a => a.passed === true).length}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Pending Results
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {attempts.filter(a => a.passed === null).length}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </main>
  )
}
