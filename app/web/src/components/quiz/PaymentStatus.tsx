'use client'

import { useState, useEffect } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Winner {
  id: string
  studentId: string
  studentName: string
  score: number
  prizeAmount: string
  paid: boolean
  paidTxHash: string | null
  studentEarnings: string
}

interface PaymentStatusData {
  quizId: string
  quizTitle: string
  status: string
  prizePool: {
    total: string
    distributed: string
    pending: string
    winnersCount: number
    paidWinners: number
  }
  entryFees: {
    perAttempt: string
    attemptCount: number
    total: string
    platformFee: string
    teacherAmount: string
    platformFeePercentage: string
  }
  teacher: {
    id: string
    name: string
    currentBalance: string
    netChange: string
    explanation: string
  }
  winners: Winner[]
  actions: {
    canDistribute: boolean
    canRetry: boolean
    isComplete: boolean
  }
}

interface PaymentStatusProps {
  quizId: string
  onRetry?: () => void
}

export function PaymentStatus({ quizId, onRetry }: PaymentStatusProps) {
  const [data, setData] = useState<PaymentStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/quizzes/${quizId}/payment-status`)
      const result = await response.json()

      if (response.ok) {
        // API returns { success: true, data: {...} } - extract the data
        const statusData = result.data || result
        setData(statusData)
      } else {
        setError(result.error || 'Failed to fetch payment status')
      }
    } catch (err) {
      console.error('Error fetching payment status:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async () => {
    try {
      setRetrying(true)
      const response = await fetch(`/api/quizzes/${quizId}/distribute`, {
        method: 'POST'
      })
      const result = await response.json()

      if (response.ok) {
        await fetchStatus()
        if (onRetry) onRetry()
      } else {
        setError(result.error || 'Failed to retry distribution')
      }
    } catch (err) {
      console.error('Error retrying distribution:', err)
      setError('Failed to retry distribution')
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [quizId])

  const formatSatoshis = (satoshis: string | number) => {
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return sats.toLocaleString()
  }

  const shortenTxHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading payment status...</span>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardBody>
          <div className="text-center py-8">
            <p className="text-red-600 dark:text-red-400 mb-4">{error || 'No payment data available'}</p>
            <Button onClick={fetchStatus} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  // Safely access nested properties with fallbacks
  const prizePool = data.prizePool || { total: '0', distributed: '0', pending: '0', winnersCount: 0, paidWinners: 0 }
  const entryFees = data.entryFees || { perAttempt: '0', attemptCount: 0, total: '0', platformFee: '0', teacherAmount: '0', platformFeePercentage: '0%' }
  const teacher = data.teacher || { id: '', name: '', currentBalance: '0', netChange: '0', explanation: '' }
  const winners = data.winners || []
  const actions = data.actions || { canDistribute: false, canRetry: false, isComplete: false }

  const isComplete = actions.isComplete ?? false
  const hasFailures = (prizePool.pending !== '0') || winners.some(w => !w.paid) || false
  const netChangeNum = parseInt(teacher.netChange || '0')
  const isProfit = netChangeNum > 0
  const isLoss = netChangeNum < 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Payment Status</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{data.quizTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {isComplete ? (
                <Badge variant="success">✅ Complete</Badge>
              ) : hasFailures ? (
                <Badge variant="danger">⚠️ Incomplete</Badge>
              ) : (
                <Badge variant="info">⏳ Processing</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Prize Pool Status */}
      <Card>
        <CardHeader>
          <h4 className="font-semibold text-gray-900 dark:text-white">🏆 Prize Distribution</h4>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Prize Pool</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatSatoshis(prizePool.total)} sats
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Distributed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatSatoshis(prizePool.distributed)} sats
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {prizePool.paidWinners} of {prizePool.winnersCount} winners paid
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatSatoshis(prizePool.pending)} sats
              </p>
            </div>
          </div>

          {/* Winners List */}
          {winners.length > 0 && (
            <div className="mt-6">
              <h5 className="font-medium text-gray-900 dark:text-white mb-3">Winners</h5>
              <div className="space-y-2">
                {winners.map((winner) => (
                  <div
                    key={winner.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${winner.paid ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{winner.studentName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Score: {winner.score}% • Prize: {formatSatoshis(winner.prizeAmount)} sats
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {winner.paid ? (
                        <>
                          <Badge variant="success">Paid ✓</Badge>
                          {winner.paidTxHash && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                              TX: {shortenTxHash(winner.paidTxHash)}
                            </p>
                          )}
                        </>
                      ) : (
                        <Badge variant="danger">Pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Entry Fees Breakdown */}
      <Card>
        <CardHeader>
          <h4 className="font-semibold text-gray-900 dark:text-white">💰 Entry Fees Collection</h4>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Entry Fees</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatSatoshis(entryFees.total)} sats
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {entryFees.attemptCount} attempts × {formatSatoshis(entryFees.perAttempt)} sats
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Platform Fee ({entryFees.platformFeePercentage})</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {formatSatoshis(entryFees.platformFee)} sats
                </p>
              </div>
            </div>

            <div className="border-t dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Teacher Receives</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    After platform fee deduction
                  </p>
                </div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatSatoshis(entryFees.teacherAmount)} sats
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Teacher Net Change */}
      <Card>
        <CardHeader>
          <h4 className="font-semibold text-gray-900 dark:text-white">📊 Financial Summary</h4>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className={`p-6 rounded-lg ${
              isProfit 
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' 
                : isLoss 
                ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20'
                : 'bg-gray-50 dark:bg-gray-800'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Change</p>
                  <p className={`text-4xl font-bold ${
                    isProfit 
                      ? 'text-green-600 dark:text-green-400' 
                      : isLoss 
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600'
                  }`}>
                    {netChangeNum > 0 ? '+' : ''}{formatSatoshis(teacher.netChange)} sats
                  </p>
                </div>
                {isProfit ? (
                  <div className="text-5xl">📈</div>
                ) : isLoss ? (
                  <div className="text-5xl">📉</div>
                ) : (
                  <div className="text-5xl">➖</div>
                )}
              </div>
              <div className="bg-white/50 dark:bg-gray-900/50 p-3 rounded">
                <p className="text-sm text-gray-700 dark:text-gray-300">{teacher.explanation}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                <p className="text-gray-600 dark:text-gray-400">Entry Fees Collected</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  +{formatSatoshis(entryFees.teacherAmount)} sats
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                <p className="text-gray-600 dark:text-gray-400">Prizes Distributed</p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  -{formatSatoshis(prizePool.distributed)} sats
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Balance</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatSatoshis(teacher.currentBalance)} sats
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      {(actions.canRetry || !isComplete) && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Payment Actions</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {actions.canRetry
                    ? 'Some payments failed. You can retry the distribution.'
                    : 'Payment processing in progress...'}
                </p>
              </div>
              {actions.canRetry && (
                <Button 
                  onClick={handleRetry} 
                  disabled={retrying}
                  variant="outline"
                >
                  {retrying ? 'Retrying...' : '🔄 Retry Distribution'}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
