'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { revealAnswers, getRevealStatus } from '@/services/attempt-service'

interface RevealStatus {
  attemptId: string
  contractId: string
  status: string
  quizTitle: string | null
  quizDeadline: string
  studentRevealDeadline: string
  canReveal: boolean
  isRevealed: boolean
  revealedAnswers: string[] | null
  revealTimestamp: string | null
  reason: string | null
}

interface StoredAttemptData {
  answers: string[]
  nonce: string
  quizId: string
  timestamp: number
}

type PageStep = 'loading' | 'ready' | 'revealing' | 'complete' | 'already_revealed' | 'error'

export default function RevealAnswersPage() {
  const params = useParams()
  const router = useRouter()
  const attemptId = params.id as string

  const [revealStatus, setRevealStatus] = useState<RevealStatus | null>(null)
  const [storedData, setStoredData] = useState<StoredAttemptData | null>(null)
  const [currentStep, setCurrentStep] = useState<PageStep>('loading')
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string | null>(null)

  // Fetch reveal status from API
  const fetchRevealStatus = useCallback(async () => {
    try {
      const result = await getRevealStatus(attemptId)

      if (result.success && result.data) {
        setRevealStatus(result.data)

        if (result.data.isRevealed) {
          setCurrentStep('already_revealed')
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
          nonce: '',   // Will be fetched from server
          quizId: '',
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
  }, [attemptId])

  useEffect(() => {
    fetchRevealStatus()
  }, [fetchRevealStatus])

  const handleReveal = async () => {
    setCurrentStep('revealing')
    setError(null)

    try {
      // Server will decrypt and use stored encrypted data
      const result = await revealAnswers({
        attemptId
        // No answers or nonce needed - server decrypts from encryptedRevealData
      })

      if (result.success) {
        setTxId(result.txId || null)
        setCurrentStep('complete')
        // Clean up localStorage after successful reveal
        localStorage.removeItem(`attempt_${attemptId}`)
        if (revealStatus?.contractId) {
          localStorage.removeItem(`quiz_attempt_${revealStatus.contractId}`)
        }
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

    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days} day${days > 1 ? 's' : ''} remaining`
    }
    return `${hours}h ${minutes}m remaining`
  }

  // Loading State
  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading reveal status...</p>
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
              Already Revealed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your answers have already been revealed for this attempt.
            </p>

            {revealStatus.revealedAnswers && (
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Your Revealed Answers:</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {revealStatus.revealedAnswers.map((answer, i) => (
                    <li key={i}>{answer}</li>
                  ))}
                </ol>
                {revealStatus.revealTimestamp && (
                  <p className="text-xs text-gray-500 mt-3">
                    Revealed on: {formatDate(revealStatus.revealTimestamp)}
                  </p>
                )}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Waiting for the teacher to reveal the correct answers. Check back after the teacher reveal deadline to see your results.
              </p>
            </div>

            <Link href="/student/dashboard">
              <Button className="w-full">View All Attempts</Button>
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
                  Reveal Your Answers
                </h1>
                <Badge variant="warning">ACTION REQUIRED</Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {revealStatus.quizTitle || `Attempt ${attemptId.slice(0, 8)}...`}
              </p>
            </CardHeader>

            <CardBody className="space-y-6">
              {/* Timing Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Quiz Deadline:</span>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatDate(revealStatus.quizDeadline)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Reveal Deadline:</span>
                    <div className="font-semibold text-orange-600">
                      {formatDate(revealStatus.studentRevealDeadline)}
                    </div>
                    <div className="text-xs text-orange-500">
                      {getTimeRemaining(revealStatus.studentRevealDeadline)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Server Storage Info */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600">✓</span>
                  <span className="font-semibold text-green-800 dark:text-green-200">
                    Your Answers Are Securely Stored
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your answers and nonce are encrypted on our servers and ready to reveal
                </p>
              </div>

              {/* What happens next */}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">What happens when you reveal:</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">1.</span>
                    <span>Your answers and nonce are sent to the blockchain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">2.</span>
                    <span>The system verifies they match your original commitment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">3.</span>
                    <span>After teacher reveals, your score will be calculated</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">4.</span>
                    <span>If you pass, you&apos;ll receive your share of the prize pool</span>
                  </li>
                </ul>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">❌ {error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Link href="/student/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full">Cancel</Button>
                </Link>
                <Button
                  onClick={handleReveal}
                  className="flex-1"
                >
                  Reveal Answers
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
              Revealing Answers
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Broadcasting reveal transaction to the blockchain...
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
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
      <Card className="max-w-2xl">
        <CardBody className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✓</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Answers Revealed Successfully!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Your answers have been revealed on the blockchain.
          </p>
          {txId && (
            <p className="text-sm text-gray-500 dark:text-gray-500 font-mono mb-6">
              TX: {txId.substring(0, 20)}...
            </p>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6 text-left">
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">What Happens Next:</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">1.</span>
                <span>Wait for the student reveal window to close</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">2.</span>
                <span>Teacher will reveal the correct answers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">3.</span>
                <span>Your score will be calculated automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">4.</span>
                <span>If you passed, prize will be distributed to your wallet</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Link href="/student/dashboard" className="flex-1">
              <Button variant="outline" className="w-full">
                View All Attempts
              </Button>
            </Link>
            <Link href="/student/browse" className="flex-1">
              <Button className="w-full">Browse More Quizzes</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
