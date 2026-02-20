'use client'

import { useState, useEffect } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

// Gas fee constants (in satoshis)
const GAS_FEES = {
  QUIZ_CREATION: 2000,      // ~2000 sats for quiz contract deployment
  QUIZ_ATTEMPT: 1500,       // ~1500 sats for attempt contract deployment
  STUDENT_REVEAL: 1000,     // ~1000 sats for student reveal transaction
  TEACHER_REVEAL: 1500,     // ~1500 sats for teacher reveal + grading
  PRIZE_DISTRIBUTION: 500,  // ~500 sats per winner for prize tx (custodial = 0)
  PLATFORM_FEE_PERCENT: 2,  // 2% platform fee
}

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

interface QuizFinancialData {
  quizId: string
  quizTitle: string
  quizStatus: string
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

interface QuizFinancialDetailsProps {
  quizId: string
  viewerRole: 'TEACHER' | 'STUDENT'
  studentId?: string
  onClose?: () => void
}

export function QuizFinancialDetails({
  quizId,
  viewerRole,
  studentId,
  onClose
}: QuizFinancialDetailsProps) {
  const [data, setData] = useState<QuizFinancialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'transactions'>('overview')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/quizzes/${quizId}/payment-status`)
        const result = await response.json()

        if (response.ok) {
          const statusData = result.data || result
          setData(statusData)
        } else {
          setError(result.error || 'Failed to fetch financial details')
        }
      } catch (err) {
        console.error('Error fetching financial details:', err)
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [quizId])

  const formatSatoshis = (satoshis: string | number) => {
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return sats.toLocaleString()
  }

  const satsToBTC = (satoshis: string | number) => {
    const sats = typeof satoshis === 'string' ? parseInt(satoshis) : satoshis
    return (sats / 100000000).toFixed(8)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading financial details...</span>
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

  // Safe data extraction
  const prizePool = data.prizePool || { total: '0', distributed: '0', pending: '0', winnersCount: 0, paidWinners: 0 }
  const entryFees = data.entryFees || { perAttempt: '0', attemptCount: 0, total: '0', platformFee: '0', teacherAmount: '0', platformFeePercentage: '0%' }
  const teacher = data.teacher || { id: '', name: '', currentBalance: '0', netChange: '0', explanation: '' }
  const winners = data.winners || []

  // Calculate gas fee estimates
  const estimatedGasFees = {
    quizCreation: GAS_FEES.QUIZ_CREATION,
    attempts: GAS_FEES.QUIZ_ATTEMPT * entryFees.attemptCount,
    studentReveals: GAS_FEES.STUDENT_REVEAL * entryFees.attemptCount,
    teacherReveal: GAS_FEES.TEACHER_REVEAL,
    prizeDistribution: 0, // Custodial model = no on-chain prize distribution
    totalTeacherGas: GAS_FEES.QUIZ_CREATION + GAS_FEES.TEACHER_REVEAL,
    totalStudentGas: GAS_FEES.QUIZ_ATTEMPT + GAS_FEES.STUDENT_REVEAL,
  }

  const netChangeNum = parseInt(teacher.netChange || '0')
  const isProfit = netChangeNum > 0
  const isLoss = netChangeNum < 0

  // Find current student's data if viewing as student
  const currentStudentWinner = studentId ? winners.find(w => w.studentId === studentId) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Financial Details
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{data.quizTitle || 'Quiz'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.quizStatus === 'COMPLETED' ? 'success' : 'info'}>
            {data.quizStatus}
          </Badge>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {['overview', 'breakdown', 'transactions'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-4 py-2 font-medium text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody className="text-center p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Prize Pool</p>
                <p className="text-xl font-bold text-blue-600">{formatSatoshis(prizePool.total)}</p>
                <p className="text-xs text-gray-400">sats</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Entry Fees</p>
                <p className="text-xl font-bold text-purple-600">{formatSatoshis(entryFees.total)}</p>
                <p className="text-xs text-gray-400">sats total</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Participants</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{entryFees.attemptCount}</p>
                <p className="text-xs text-gray-400">students</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Winners</p>
                <p className="text-xl font-bold text-green-600">{prizePool.winnersCount}</p>
                <p className="text-xs text-gray-400">{prizePool.paidWinners} paid</p>
              </CardBody>
            </Card>
          </div>

          {/* Teacher/Student Specific Summary */}
          {viewerRole === 'TEACHER' ? (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900 dark:text-white">Your Financial Summary</h3>
              </CardHeader>
              <CardBody>
                <div className={`p-6 rounded-lg mb-4 ${
                  isProfit
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
                    : isLoss
                    ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20'
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Net Result</p>
                      <p className={`text-4xl font-bold ${
                        isProfit ? 'text-green-600' : isLoss ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {netChangeNum > 0 ? '+' : ''}{formatSatoshis(teacher.netChange)} sats
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ≈ {satsToBTC(teacher.netChange)} BTC
                      </p>
                    </div>
                    <div className="text-5xl">
                      {isProfit ? '📈' : isLoss ? '📉' : '➖'}
                    </div>
                  </div>
                </div>

                {/* Breakdown Table */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Prize Pool (Your Investment)</span>
                    <span className="font-medium text-red-600">-{formatSatoshis(prizePool.total)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Entry Fees Collected</span>
                    <span className="font-medium text-green-600">+{formatSatoshis(entryFees.total)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Platform Fee ({entryFees.platformFeePercentage})</span>
                    <span className="font-medium text-red-600">-{formatSatoshis(entryFees.platformFee)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Est. Gas Fees (Quiz Creation + Reveal)</span>
                    <span className="font-medium text-orange-600">~{formatSatoshis(estimatedGasFees.totalTeacherGas)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-gray-50 dark:bg-gray-800 px-3 rounded-lg">
                    <span className="font-semibold text-gray-900 dark:text-white">Your Net Earnings</span>
                    <span className={`font-bold text-xl ${isProfit ? 'text-green-600' : isLoss ? 'text-red-600' : 'text-gray-600'}`}>
                      {formatSatoshis(entryFees.teacherAmount)} sats
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : currentStudentWinner ? (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900 dark:text-white">Your Earnings</h3>
              </CardHeader>
              <CardBody>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Prize Won</p>
                      <p className="text-4xl font-bold text-green-600">
                        +{formatSatoshis(currentStudentWinner.prizeAmount)} sats
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ≈ {satsToBTC(currentStudentWinner.prizeAmount)} BTC
                      </p>
                    </div>
                    <div className="text-5xl">🏆</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Entry Fee Paid</span>
                    <span className="font-medium text-red-600">-{formatSatoshis(entryFees.perAttempt)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Est. Gas Fees (Submit + Reveal)</span>
                    <span className="font-medium text-orange-600">~{formatSatoshis(estimatedGasFees.totalStudentGas)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Prize Won</span>
                    <span className="font-medium text-green-600">+{formatSatoshis(currentStudentWinner.prizeAmount)} sats</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-gray-50 dark:bg-gray-800 px-3 rounded-lg">
                    <span className="font-semibold text-gray-900 dark:text-white">Net Profit</span>
                    <span className="font-bold text-xl text-green-600">
                      +{formatSatoshis(parseInt(currentStudentWinner.prizeAmount) - parseInt(entryFees.perAttempt) - estimatedGasFees.totalStudentGas)} sats
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900 dark:text-white">Your Participation</h3>
              </CardHeader>
              <CardBody>
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    You participated in this quiz but didn&apos;t win a prize.
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600 dark:text-gray-400">Entry Fee Paid</span>
                      <span className="font-medium text-red-600">-{formatSatoshis(entryFees.perAttempt)} sats</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600 dark:text-gray-400">Est. Gas Fees</span>
                      <span className="font-medium text-orange-600">~{formatSatoshis(estimatedGasFees.totalStudentGas)} sats</span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Breakdown Tab */}
      {activeTab === 'breakdown' && (
        <div className="space-y-6">
          {/* Prize Distribution */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900 dark:text-white">🏆 Prize Pool Distribution</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {/* Visual Bar */}
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${(parseInt(prizePool.distributed) / parseInt(prizePool.total || '1')) * 100}%` }}
                  >
                    Paid
                  </div>
                  <div
                    className="bg-orange-500 h-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${(parseInt(prizePool.pending) / parseInt(prizePool.total || '1')) * 100}%` }}
                  >
                    Pending
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Total Pool</p>
                    <p className="text-lg font-bold text-blue-600">{formatSatoshis(prizePool.total)} sats</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Distributed</p>
                    <p className="text-lg font-bold text-green-600">{formatSatoshis(prizePool.distributed)} sats</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-lg font-bold text-orange-600">{formatSatoshis(prizePool.pending)} sats</p>
                  </div>
                </div>

                {/* Winners List */}
                {winners.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Winners Breakdown</h4>
                    <div className="space-y-2">
                      {winners.map((winner, index) => (
                        <div
                          key={winner.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {winner.studentName}
                                {currentStudentWinner?.id === winner.id && (
                                  <Badge variant="info" className="ml-2">You</Badge>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">Score: {winner.score}%</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatSatoshis(winner.prizeAmount)} sats</p>
                            <Badge variant={winner.paid ? 'success' : 'warning'} className="text-xs">
                              {winner.paid ? 'Paid ✓' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Entry Fees Breakdown */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900 dark:text-white">💵 Entry Fees Breakdown</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Per Student</p>
                  <p className="text-2xl font-bold text-purple-600">{formatSatoshis(entryFees.perAttempt)} sats</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Total Collected</p>
                  <p className="text-2xl font-bold text-blue-600">{formatSatoshis(entryFees.total)} sats</p>
                  <p className="text-xs text-gray-400">{entryFees.attemptCount} × {formatSatoshis(entryFees.perAttempt)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Gross Entry Fees</span>
                  <span className="font-medium">{formatSatoshis(entryFees.total)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                    <span className="text-xs text-gray-400 ml-2">({entryFees.platformFeePercentage})</span>
                  </div>
                  <span className="font-medium text-red-600">-{formatSatoshis(entryFees.platformFee)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-green-50 dark:bg-green-900/20 px-3 rounded-lg">
                  <span className="font-semibold text-gray-900 dark:text-white">Teacher Receives</span>
                  <span className="font-bold text-xl text-green-600">{formatSatoshis(entryFees.teacherAmount)} sats</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Gas Fees Estimate */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">⛽ Estimated Gas Fees</h3>
                <Badge variant="warning">Estimates</Badge>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-gray-500 mb-4">
                Gas fees are paid to the blockchain network for transaction processing. These are estimates based on typical transaction sizes.
              </p>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 dark:text-gray-300">Teacher Costs</h4>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 pl-4">
                  <span className="text-gray-600 dark:text-gray-400">Quiz Contract Deployment</span>
                  <span className="font-mono text-orange-600">~{formatSatoshis(GAS_FEES.QUIZ_CREATION)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 pl-4">
                  <span className="text-gray-600 dark:text-gray-400">Reveal & Grade Transaction</span>
                  <span className="font-mono text-orange-600">~{formatSatoshis(GAS_FEES.TEACHER_REVEAL)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-orange-50 dark:bg-orange-900/20 px-3 rounded-lg">
                  <span className="font-semibold">Total Teacher Gas</span>
                  <span className="font-bold text-orange-600">~{formatSatoshis(estimatedGasFees.totalTeacherGas)} sats</span>
                </div>

                <h4 className="font-medium text-gray-700 dark:text-gray-300 mt-4">Per Student Costs</h4>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 pl-4">
                  <span className="text-gray-600 dark:text-gray-400">Submit Attempt (Contract Deploy)</span>
                  <span className="font-mono text-orange-600">~{formatSatoshis(GAS_FEES.QUIZ_ATTEMPT)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700 pl-4">
                  <span className="text-gray-600 dark:text-gray-400">Reveal Answers</span>
                  <span className="font-mono text-orange-600">~{formatSatoshis(GAS_FEES.STUDENT_REVEAL)} sats</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-orange-50 dark:bg-orange-900/20 px-3 rounded-lg">
                  <span className="font-semibold">Total Per Student</span>
                  <span className="font-bold text-orange-600">~{formatSatoshis(estimatedGasFees.totalStudentGas)} sats</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Prizes are distributed using a custodial model - funds are tracked in your account balance rather than sent via individual blockchain transactions, eliminating per-winner gas fees.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900 dark:text-white">📜 Transaction History</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {/* Quiz Creation */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-lg">📝</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">Quiz Created</p>
                    <p className="text-xs text-gray-500">Contract deployed with prize pool</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-white">-{formatSatoshis(prizePool.total)} sats</p>
                    <Badge variant="success">Confirmed</Badge>
                  </div>
                </div>

                {/* Entry Fees */}
                {entryFees.attemptCount > 0 && (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <span className="text-lg">👥</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Entry Fees Collected</p>
                      <p className="text-xs text-gray-500">{entryFees.attemptCount} students joined</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">+{formatSatoshis(entryFees.teacherAmount)} sats</p>
                      <Badge variant="success">Collected</Badge>
                    </div>
                  </div>
                )}

                {/* Reveal */}
                {data.quizStatus !== 'ACTIVE' && (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                      <span className="text-lg">🔓</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Answers Revealed</p>
                      <p className="text-xs text-gray-500">Quiz graded, winners determined</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="success">Complete</Badge>
                    </div>
                  </div>
                )}

                {/* Prize Distribution */}
                {winners.map((winner) => (
                  <div key={winner.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <span className="text-lg">🏆</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Prize to {winner.studentName}</p>
                      <p className="text-xs text-gray-500">Score: {winner.score}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">{formatSatoshis(winner.prizeAmount)} sats</p>
                      <Badge variant={winner.paid ? 'success' : 'warning'}>
                        {winner.paid ? 'Paid' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))}

                {/* Platform Fee */}
                {parseInt(entryFees.platformFee) > 0 && (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                      <span className="text-lg">🏛️</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Platform Fee</p>
                      <p className="text-xs text-gray-500">{entryFees.platformFeePercentage} of entry fees</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-600">{formatSatoshis(entryFees.platformFee)} sats</p>
                      <Badge variant="default">Deducted</Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
