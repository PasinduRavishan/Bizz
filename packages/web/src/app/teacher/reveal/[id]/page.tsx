'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PaymentStatus } from '@/components/quiz/PaymentStatus'
import { revealQuizAnswers, getQuizRevealStatus } from '@/services/quiz-service'

interface RevealStatus {
  quizId: string
  contractId: string
  status: string
  title: string | null
  questionCount: number
  deadline: string
  teacherRevealDeadline: string
  canReveal: boolean
  isRevealed: boolean
  revealedAnswers: string[] | null
  reason: string | null
  attemptStats: {
    total: number
    committed: number
    revealed: number
    verified: number
    failed: number
  }
  salt: string | null
}

interface StoredQuizData {
  answers: string[]
  salt: string
  timestamp: number
}

type PageStep = 'loading' | 'waiting' | 'ready' | 'revealing' | 'complete' | 'already_revealed' | 'error'

export default function TeacherRevealPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [revealStatus, setRevealStatus] = useState<RevealStatus | null>(null)
  const [storedData, setStoredData] = useState<StoredQuizData | null>(null)
  const [currentStep, setCurrentStep] = useState<PageStep>('loading')
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string | null>(null)
  const [scoringResults, setScoringResults] = useState<{ processed: number; passed: number; failed: number } | null>(null)

  // Fetch reveal status from API
  const fetchRevealStatus = useCallback(async () => {
    try {
      const result = await getQuizRevealStatus(quizId)

      if (result.success && result.data) {
        setRevealStatus(result.data)

        if (result.data.isRevealed) {
          setCurrentStep('already_revealed')
          return
        }

        // Check if quiz deadline has passed
        const now = new Date()
        const quizDeadline = new Date(result.data.deadline)
        if (now < quizDeadline) {
          setCurrentStep('waiting')
          return
        }

        if (!result.data.canReveal) {
          setError(result.data.reason || 'Cannot reveal at this time')
          setCurrentStep('error')
          return
        }

        // Server has encrypted data - no localStorage needed
        // Mark as ready since server will decrypt during reveal
        setStoredData({
          answers: [], // Will be fetched from server
          salt: '',    // Will be fetched from server
          timestamp: Date.now()
        })

        setCurrentStep('ready')
      } else {
        setError(result.error || 'Failed to get reveal status')
        setCurrentStep('error')
      }
    } catch (err) {
      console.error('Error fetching reveal status:', err)
      setError('Failed to connect to server')
      setCurrentStep('error')
    }
  }, [quizId])

  useEffect(() => {
    fetchRevealStatus()
  }, [fetchRevealStatus])

  const handleReveal = async () => {
    setCurrentStep('revealing')
    setError(null)

    try {
      // Server will decrypt and use stored encrypted data
      const result = await revealQuizAnswers({
        quizId
        // No answers or salt needed - server decrypts from encryptedRevealData
      })

      if (result.success) {
        setTxId(result.txId || null)
        setScoringResults(result.scoringResults || null)
        setCurrentStep('complete')
      } else {
        setError(result.error || 'Failed to reveal answers')
        setCurrentStep('ready')
      }
    } catch (err) {
      console.error('Reveal error:', err)
      setError(err instanceof Error ? err.message : 'Failed to reveal')
      setCurrentStep('ready')
    }
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

  const getTimeRemaining = (deadline: string) => {
    const now = new Date()
    const end = new Date(deadline)
    const diff = end.getTime() - now.getTime()

    if (diff <= 0) return 'Passed'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days} day${days > 1 ? 's' : ''} remaining`
    }
    return `${hours}h ${minutes}m remaining`
  }

  const getTimeUntil = (deadline: string) => {
    const now = new Date()
    const end = new Date(deadline)
    const diff = end.getTime() - now.getTime()

    if (diff <= 0) return 'Now'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `in ${days} day${days > 1 ? 's' : ''}`
    }
    return `in ${hours}h ${minutes}m`
  }

  // Loading State
  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading quiz status...</p>
        </div>
      </div>
    )
  }

  // Error State
  if (currentStep === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Cannot Reveal
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                Go Back
              </Button>
              <Button onClick={fetchRevealStatus}>Retry</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Waiting for Quiz Deadline
  if (currentStep === 'waiting' && revealStatus) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-lg">
          <CardBody className="text-center py-12">
            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">⏳</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Quiz Still Active
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Wait for the quiz deadline to reveal answers and grade submissions.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Quiz deadline:
              </div>
              <div className="text-xl font-bold text-blue-600">
                {formatDate(revealStatus.deadline)}
              </div>
              <div className="text-sm text-blue-500 mt-1">
                {getTimeUntil(revealStatus.deadline)}
              </div>
            </div>

            {/* Attempt Stats */}
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Current Attempts</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {revealStatus.attemptStats.total}
                  </div>
                  <div className="text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {revealStatus.attemptStats.committed}
                  </div>
                  <div className="text-gray-500">Awaiting Reveal</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {revealStatus.attemptStats.revealed}
                  </div>
                  <div className="text-gray-500">Revealed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {revealStatus.attemptStats.failed}
                  </div>
                  <div className="text-gray-500">Failed</div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link href="/teacher/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Back to Dashboard</Button>
              </Link>
              <Button onClick={fetchRevealStatus} className="flex-1">
                Refresh Status
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Already Revealed State
  if (currentStep === 'already_revealed' && revealStatus) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-lg">
          <CardBody className="text-center py-12">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✓</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Quiz Answers Revealed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {revealStatus.title || 'This quiz'} has been graded and results are available.
            </p>

            {revealStatus.revealedAnswers && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Correct Answers:</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {revealStatus.revealedAnswers.map((answer, i) => (
                    <li key={i}>{answer}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Attempt Stats */}
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Results Summary</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {revealStatus.attemptStats.verified}
                  </div>
                  <div className="text-gray-500">Graded</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {revealStatus.attemptStats.verified - revealStatus.attemptStats.failed}
                  </div>
                  <div className="text-gray-500">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {revealStatus.attemptStats.failed}
                  </div>
                  <div className="text-gray-500">Failed</div>
                </div>
              </div>
            </div>

            <Link href="/teacher/dashboard">
              <Button className="w-full">Back to Dashboard</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Ready to Reveal State
  if (currentStep === 'ready' && revealStatus) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Reveal Quiz Answers
                </h1>
                <Badge variant="warning">ACTION REQUIRED</Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {revealStatus.title || `Quiz ${quizId.slice(0, 8)}...`}
              </p>
            </CardHeader>

            <CardBody className="space-y-6">
              {/* Timing Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Quiz Deadline:</span>
                    <div className="font-semibold text-green-600">
                      Passed
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Your Reveal Deadline:</span>
                    <div className="font-semibold text-orange-600">
                      {formatDate(revealStatus.teacherRevealDeadline)}
                    </div>
                    <div className="text-xs text-orange-500">
                      {getTimeRemaining(revealStatus.teacherRevealDeadline)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attempt Stats */}
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Student Attempts</h4>
                <div className="grid grid-cols-3 gap-3 text-sm text-center">
                  <div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {revealStatus.attemptStats.total}
                    </div>
                    <div className="text-gray-500 text-xs">Total</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-blue-600">
                      {revealStatus.attemptStats.committed}
                    </div>
                    <div className="text-gray-500 text-xs">Submitted</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-green-600">
                      {revealStatus.attemptStats.verified}
                    </div>
                    <div className="text-gray-500 text-xs">Graded</div>
                  </div>
                </div>
                {revealStatus.attemptStats.committed > 0 && (
                  <p className="text-xs text-blue-600 mt-3">
                    {revealStatus.attemptStats.committed} attempts will be auto-graded when you reveal.
                  </p>
                )}
              </div>

              {/* Server Storage Info */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600">✓</span>
                  <span className="font-semibold text-green-800 dark:text-green-200">
                    Ready to Reveal
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Correct answers and salt are encrypted on our servers and ready to reveal
                </p>
              </div>

              {/* What happens */}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">When you reveal:</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">1.</span>
                    <span>Correct answers are published to the blockchain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">2.</span>
                    <span>All revealed student attempts are scored automatically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">3.</span>
                    <span>Students who passed are marked as winners</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">4.</span>
                    <span>Prize pool is distributed to winners</span>
                  </li>
                </ul>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ <strong>Important:</strong> If you don&apos;t reveal before the deadline, the quiz will be refunded to students.
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">❌ {error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Link href="/teacher/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full">Cancel</Button>
                </Link>
                <Button
                  onClick={handleReveal}
                  className="flex-1"
                >
                  Reveal Answers & Grade
                </Button>
              </div>
            </CardBody>
          </Card>
        </main>
      </div>
    )
  }

  // Revealing State
  if (currentStep === 'revealing') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Revealing & Grading
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Publishing answers and calculating scores...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              This may take 30-60 seconds
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Complete State
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Success Header */}
      <div className="mb-8">
        <Card>
          <CardBody className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✓</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Quiz Revealed Successfully!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Answers published and all attempts have been graded.
            </p>
            {txId && (
              <p className="text-sm text-gray-500 dark:text-gray-500 font-mono">
                TX: {txId.substring(0, 20)}...
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Scoring Results */}
      {scoringResults && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <h4 className="font-bold text-gray-900 dark:text-white">📊 Grading Results</h4>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    {scoringResults.processed}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Graded</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {scoringResults.passed}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Passed</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
                  <div className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
                    {scoringResults.failed}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Failed</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Payment Status */}
      <div className="mb-8">
        <PaymentStatus quizId={quizId} />
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Link href="/teacher/dashboard">
          <Button size="lg">← Back to Dashboard</Button>
        </Link>
      </div>
    </main>
  )
}
