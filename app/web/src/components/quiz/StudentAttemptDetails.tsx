'use client'

import { useState, useEffect } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ClaimPrizeButton } from './ClaimPrizeButton'

// Gas fee constants (in satoshis)
const GAS_FEES = {
  QUIZ_ATTEMPT: 1500,
  STUDENT_REVEAL: 1000,
}

interface AttemptDetails {
  id: string
  contractId: string
  status: string
  score: number | null
  passed: boolean | null
  prizeAmount: string | null
  submitTimestamp: string
  revealTimestamp: string | null
  answerCommitment: string
  quiz: {
    id: string
    contractId: string
    title: string | null
    description: string | null
    questionCount: number
    passThreshold: number
    status: string
    prizePool: string
    entryFee: string
    deadline: string
    winnersCount: number
    totalAttempts: number
  }
  rank?: number
}

interface StudentAttemptDetailsProps {
  attemptId: string
  onClose?: () => void
}

export function StudentAttemptDetails({ attemptId, onClose }: StudentAttemptDetailsProps) {
  const [data, setData] = useState<AttemptDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/attempts/${attemptId}`)
        const result = await response.json()

        if (response.ok && result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to fetch attempt details')
        }
      } catch (err) {
        console.error('Error fetching attempt details:', err)
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [attemptId])

  const formatSatoshis = (satoshis: string | number | null) => {
    if (!satoshis) return '0'
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return sats.toLocaleString()
  }

  const satsToBTC = (satoshis: string | number | null) => {
    if (!satoshis) return '0.00000000'
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return (sats / 100000000).toFixed(8)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string, passed: boolean | null) => {
    if (status === 'VERIFIED' && passed === true) {
      return <Badge variant="success">PASSED</Badge>
    }
    if (status === 'VERIFIED' && passed === false) {
      return <Badge variant="danger">FAILED</Badge>
    }
    if (status === 'REVEALED') {
      return <Badge variant="warning">AWAITING RESULTS</Badge>
    }
    if (status === 'FAILED') {
      return <Badge variant="danger">FAILED</Badge>
    }
    return <Badge variant="info">COMMITTED</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading attempt details...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 mb-4">{error || 'No data available'}</p>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    )
  }

  const entryFee = parseInt(data.quiz.entryFee || '0')
  const prizeAmount = parseInt(data.prizeAmount || '0')
  const totalGasFees = GAS_FEES.QUIZ_ATTEMPT + GAS_FEES.STUDENT_REVEAL
  const netResult = prizeAmount - entryFee - totalGasFees
  const isWinner = data.passed === true && prizeAmount > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.quiz.title || 'Quiz Attempt'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Attempt Details</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(data.status, data.passed)}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl ml-4"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Result Summary */}
      <Card>
        <CardBody>
          <div className={`p-6 rounded-lg ${
            isWinner
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
              : data.passed === false
              ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {isWinner ? 'Congratulations!' : data.passed === false ? 'Better luck next time!' : 'Awaiting Results'}
                </p>
                {data.score !== null ? (
                  <>
                    <p className="text-5xl font-bold text-gray-900 dark:text-white">
                      {data.score}%
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Required: {data.quiz.passThreshold}% to pass
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    Score pending...
                  </p>
                )}
              </div>
              <div className="text-6xl">
                {isWinner ? '🏆' : data.passed === false ? '📚' : '⏳'}
              </div>
            </div>

            {/* Progress Bar */}
            {data.score !== null && (
              <div className="mt-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      data.passed ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(data.score, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span className="font-medium">Pass: {data.quiz.passThreshold}%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Financial Breakdown */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-white">💰 Financial Breakdown</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {/* Costs Section */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Your Costs</h4>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Entry Fee</span>
                    <p className="text-xs text-gray-400">Paid to join quiz</p>
                  </div>
                  <span className="font-medium text-red-600">-{formatSatoshis(entryFee)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Submit Gas Fee</span>
                    <p className="text-xs text-gray-400">Contract deployment</p>
                  </div>
                  <span className="font-medium text-orange-600">~{formatSatoshis(GAS_FEES.QUIZ_ATTEMPT)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Reveal Gas Fee</span>
                    <p className="text-xs text-gray-400">Answer reveal transaction</p>
                  </div>
                  <span className="font-medium text-orange-600">~{formatSatoshis(GAS_FEES.STUDENT_REVEAL)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-red-50 dark:bg-red-900/20 px-3 rounded-lg">
                  <span className="font-semibold text-gray-900 dark:text-white">Total Costs</span>
                  <span className="font-bold text-red-600">-{formatSatoshis(entryFee + totalGasFees)} sats</span>
                </div>
              </div>
            </div>

            {/* Earnings Section */}
            {isWinner && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Your Earnings</h4>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Prize Won</span>
                      {data.rank && <p className="text-xs text-gray-400">Rank #{data.rank}</p>}
                    </div>
                    <span className="font-medium text-green-600">+{formatSatoshis(prizeAmount)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-green-50 dark:bg-green-900/20 px-3 rounded-lg">
                    <span className="font-semibold text-gray-900 dark:text-white">Total Earnings</span>
                    <span className="font-bold text-green-600">+{formatSatoshis(prizeAmount)} sats</span>
                  </div>
                </div>
              </div>
            )}

            {/* Net Result */}
            <div className={`p-4 rounded-lg ${
              netResult > 0
                ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30'
                : 'bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Net Result</p>
                  <p className="text-xs text-gray-500">After all fees and prizes</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${netResult > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netResult > 0 ? '+' : ''}{formatSatoshis(netResult)} sats
                  </p>
                  <p className="text-xs text-gray-500">≈ {satsToBTC(Math.abs(netResult))} BTC</p>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Claim Prize Section - Only show for winners */}
      {isWinner && data.prizeAmount && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white">🎁 Claim Your Prize</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-4 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">🏆</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                      Congratulations! You won!
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      You earned <span className="font-mono font-bold text-green-600">{formatSatoshis(prizeAmount)} sats</span> as a prize.
                      Click the button below to claim your prize and release the funds to your wallet.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>This will call the Payment contract's claim() method to release funds</span>
                    </div>
                  </div>
                </div>
              </div>

              <ClaimPrizeButton
                attemptId={data.id}
                prizeAmount={data.prizeAmount}
                onSuccess={() => {
                  // Reload to show updated status
                  window.location.reload()
                }}
              />

              <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                <p className="font-semibold mb-1">💡 How it works:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Your prize is locked in a Payment smart contract on the blockchain</li>
                  <li>Claiming reduces the contract to dust (546 sats) and releases {formatSatoshis(prizeAmount - 546)} sats to your wallet</li>
                  <li>Small gas fee (~1,000 sats) will be deducted from the prize</li>
                  <li>Net amount: ~{formatSatoshis(prizeAmount - 546 - 1000)} sats</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Quiz Info */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-white">📝 Quiz Information</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Prize Pool</p>
              <p className="font-bold text-blue-600">{formatSatoshis(data.quiz.prizePool)} sats</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Questions</p>
              <p className="font-bold text-gray-900 dark:text-white">{data.quiz.questionCount}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Participants</p>
              <p className="font-bold text-purple-600">{data.quiz.totalAttempts}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Winners</p>
              <p className="font-bold text-green-600">{data.quiz.winnersCount}</p>
            </div>
          </div>

          {data.quiz.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">{data.quiz.description}</p>
          )}
        </CardBody>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-white">📅 Timeline</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                <span className="text-lg">✏️</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">Submitted Answers</p>
                <p className="text-sm text-gray-500">{formatDate(data.submitTimestamp)}</p>
              </div>
              <Badge variant="success">Done</Badge>
            </div>

            {data.revealTimestamp && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center shrink-0">
                  <span className="text-lg">🔓</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">Revealed Answers</p>
                  <p className="text-sm text-gray-500">{formatDate(data.revealTimestamp)}</p>
                </div>
                <Badge variant="success">Done</Badge>
              </div>
            )}

            {data.status === 'VERIFIED' && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                  <span className="text-lg">✓</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">Graded</p>
                  <p className="text-sm text-gray-500">Score: {data.score}%</p>
                </div>
                <Badge variant="success">Done</Badge>
              </div>
            )}

            {isWinner && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                  <span className="text-lg">🏆</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">Prize Awarded</p>
                  <p className="text-sm text-gray-500">{formatSatoshis(prizeAmount)} sats added to balance</p>
                </div>
                <Badge variant="success">Done</Badge>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Technical Details (Collapsed) */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          View Technical Details
        </summary>
        <Card className="mt-2">
          <CardBody>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Attempt ID:</span>
                <span className="text-gray-900 dark:text-white">{data.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Contract ID:</span>
                <span className="text-gray-900 dark:text-white">{data.contractId.slice(0, 20)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quiz Contract:</span>
                <span className="text-gray-900 dark:text-white">{data.quiz.contractId.slice(0, 20)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Commitment Hash:</span>
                <span className="text-gray-900 dark:text-white">{data.answerCommitment.slice(0, 20)}...</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </details>
    </div>
  )
}
