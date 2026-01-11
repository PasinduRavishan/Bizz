'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { useWallet } from '@/contexts/WalletContext'

interface Quiz {
  id: string
  contractId: string
  title: string | null
  questionCount: number
  prizePool: string
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  createdAt: string
  _count: {
    attempts: number
  }
}

export default function TeacherDashboard() {
  const { address, connected } = useWallet()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQuizzes = useCallback(async () => {
    if (!address) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/quizzes?teacher=${address}`)
      const data = await response.json()

      if (data.success) {
        setQuizzes(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch quizzes')
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (connected && address) {
      fetchQuizzes()
    } else {
      setLoading(false)
    }
  }, [connected, address, fetchQuizzes])

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
      REFUNDED: 'danger'
    } as const

    return <Badge variant={variants[status as keyof typeof variants] || 'default'}>{status}</Badge>
  }

  const totalAttempts = quizzes.reduce((sum, q) => sum + (q._count?.attempts || 0), 0)
  const activeQuizzes = quizzes.filter(q => q.status === 'ACTIVE').length
  const totalEarnings = quizzes.reduce((sum, q) => {
    const attempts = q._count?.attempts || 0
    const entryFee = parseInt(q.entryFee || '0')
    return sum + (attempts * entryFee * 0.98)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-600">Bizz</Link>
            <span className="text-gray-400">&rarr;</span>
            <span className="text-gray-700 dark:text-gray-300">Teacher Dashboard</span>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Not Connected State */}
        {!connected && (
          <Card>
            <CardBody className="text-center py-12">
              <div className="text-6xl mb-4">🔐</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please connect your wallet to view your quizzes
              </p>
            </CardBody>
          </Card>
        )}

        {connected && (
          <>
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

            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Quizzes</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? '...' : quizzes.length}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active Quizzes</div>
                  <div className="text-2xl font-bold text-green-600">
                    {loading ? '...' : activeQuizzes}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? '...' : totalAttempts}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {loading ? '...' : `${(totalEarnings / 100000000).toFixed(5)} LTC`}
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

            {/* Quizzes List */}
            {!loading && !error && (
              <div className="space-y-4">
                {quizzes.length === 0 ? (
                  <Card>
                    <CardBody className="text-center py-12">
                      <div className="text-6xl mb-4">📝</div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No quizzes yet
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
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {quiz.title || `Quiz ${quiz.contractId.slice(0, 8)}...`}
                              </h3>
                              {getStatusBadge(quiz.status)}
                            </div>

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
                                <span className="ml-2 font-medium text-gray-900 dark:text-white">
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
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button size="sm" variant="outline">View Details</Button>
                            {quiz.status === 'ACTIVE' && (
                              <Button size="sm" variant="secondary">Reveal Answers</Button>
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
