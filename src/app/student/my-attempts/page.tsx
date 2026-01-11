'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useWallet } from '@/contexts/WalletContext'

interface Attempt {
  id: string
  contractId: string
  status: string
  score: number | null
  passed: boolean | null
  prizeAmount: string | null
  submitTimestamp: string
  revealTimestamp: string | null
  quiz: {
    id: string
    contractId: string
    title: string | null
    passThreshold: number
  }
}

export default function MyAttemptsPage() {
  const { address, connected } = useWallet()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAttempts = useCallback(async () => {
    if (!address) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/attempts?student=${address}`)
      const data = await response.json()

      if (data.success) {
        setAttempts(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch attempts')
      }
    } catch (err) {
      console.error('Error fetching attempts:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (connected && address) {
      fetchAttempts()
    } else {
      setLoading(false)
    }
  }, [connected, address, fetchAttempts])

  const getStatusBadge = (status: string, passed: boolean | null) => {
    if (status === 'VERIFIED' && passed === true) {
      return <Badge variant="success">PASSED</Badge>
    }
    if (status === 'VERIFIED' && passed === false) {
      return <Badge variant="danger">FAILED</Badge>
    }
    if (status === 'REVEALED') {
      return <Badge variant="warning">PENDING</Badge>
    }
    if (status === 'FAILED') {
      return <Badge variant="danger">FAILED</Badge>
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

  const formatSatoshis = (satoshis: string | number | null) => {
    if (!satoshis) return '0'
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return (sats / 100000000).toFixed(5)
  }

  const verifiedAttempts = attempts.filter(a => a.status === 'VERIFIED')
  const passedAttempts = attempts.filter(a => a.passed === true)
  const totalEarnings = attempts
    .filter(a => a.passed)
    .reduce((sum, a) => sum + parseInt(a.prizeAmount || '0'), 0)
  const successRate = verifiedAttempts.length > 0
    ? Math.round((passedAttempts.length / verifiedAttempts.length) * 100)
    : 0

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Not Connected State */}
      {!connected && (
          <Card>
            <CardBody className="text-center py-12">
              <div className="text-6xl mb-4">🔐</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please connect your wallet to view your quiz attempts
              </p>
            </CardBody>
          </Card>
        )}

        {connected && (
          <>
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
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? '...' : attempts.length}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Passed</div>
                  <div className="text-2xl font-bold text-green-600">
                    {loading ? '...' : passedAttempts.length}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {loading ? '...' : `${successRate}%`}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</div>
                  <div className="text-2xl font-bold text-green-600">
                    {loading ? '...' : `${formatSatoshis(totalEarnings)} LTC`}
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
                                {attempt.quiz?.title || `Quiz ${attempt.quiz?.contractId?.slice(0, 8)}...`}
                              </h3>
                              {getStatusBadge(attempt.status, attempt.passed)}
                            </div>

                            <div className="grid md:grid-cols-3 gap-4 text-sm mb-2">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                <span className="ml-2 font-medium text-gray-900 dark:text-white capitalize">
                                  {attempt.status.toLowerCase()}
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
                              {attempt.prizeAmount && parseInt(attempt.prizeAmount) > 0 && (
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">Prize Won:</span>
                                  <span className="ml-2 font-medium text-green-600">
                                    {formatSatoshis(attempt.prizeAmount)} LTC
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Submitted: {formatDate(attempt.submitTimestamp)}
                              {attempt.revealTimestamp && (
                                <span className="ml-4">
                                  Revealed: {formatDate(attempt.revealTimestamp)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button size="sm" variant="outline">View Details</Button>
                            {attempt.status === 'COMMITTED' && (
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
  )
}
