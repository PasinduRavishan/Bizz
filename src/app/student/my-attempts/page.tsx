'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletConnect } from '@/components/wallet/WalletConnect'

// Mock data for my attempts
const mockAttempts = [
  {
    id: '1',
    quizTitle: 'JavaScript Basics',
    quizId: '1',
    status: 'verified',
    score: 80,
    passed: true,
    submitTime: new Date(Date.now() - 86400000).toISOString(),
    prize: 2500
  },
  {
    id: '2',
    quizTitle: 'Bitcoin Fundamentals',
    quizId: '2',
    status: 'revealed',
    score: null,
    passed: null,
    submitTime: new Date(Date.now() - 3600000).toISOString(),
    prize: null
  },
  {
    id: '3',
    quizTitle: 'React Hooks Deep Dive',
    quizId: '3',
    status: 'committed',
    score: null,
    passed: null,
    submitTime: new Date(Date.now() - 7200000).toISOString(),
    prize: null
  }
]

export default function MyAttemptsPage() {
  const [attempts] = useState(mockAttempts)

  const getStatusBadge = (status: string, passed: boolean | null) => {
    if (status === 'verified' && passed === true) {
      return <Badge variant="success">PASSED ✓</Badge>
    }
    if (status === 'verified' && passed === false) {
      return <Badge variant="danger">FAILED</Badge>
    }
    if (status === 'revealed') {
      return <Badge variant="warning">PENDING</Badge>
    }
    return <Badge variant="info">COMMITTED</Badge>
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalEarnings = attempts
    .filter(a => a.passed)
    .reduce((sum, a) => sum + (a.prize || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-600">Bizz</Link>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700 dark:text-gray-300">My Attempts</span>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Quiz Attempts</h1>
            <p className="text-gray-600 dark:text-gray-400">Track your quiz performance</p>
          </div>
          <Link href="/student/browse">
            <Button size="lg">Browse Quizzes</Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{attempts.length}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Passed</div>
              <div className="text-2xl font-bold text-green-600">
                {attempts.filter(a => a.passed).length}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
              <div className="text-2xl font-bold text-blue-600">
                {attempts.length > 0 
                  ? Math.round((attempts.filter(a => a.passed).length / attempts.filter(a => a.status === 'verified').length) * 100) 
                  : 0}%
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</div>
              <div className="text-2xl font-bold text-green-600">
                {(totalEarnings / 100000000).toFixed(5)} LTC
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Attempts List */}
        <div className="space-y-4">
          {attempts.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No attempts yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start taking quizzes to see your attempts here
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {attempt.quizTitle}
                        </h3>
                        {getStatusBadge(attempt.status, attempt.passed)}
                      </div>

                      <div className="grid md:grid-cols-3 gap-4 text-sm mb-2">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Status:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white capitalize">
                            {attempt.status}
                          </span>
                        </div>
                        {attempt.score !== null && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Score:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {attempt.score}%
                            </span>
                          </div>
                        )}
                        {attempt.prize && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Prize Won:</span>
                            <span className="ml-2 font-medium text-green-600">
                              {(attempt.prize / 100000000).toFixed(5)} LTC
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Submitted: {formatDate(attempt.submitTime)}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline">View Details</Button>
                      {attempt.status === 'committed' && (
                        <Button size="sm" variant="secondary">Reveal Answers</Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
