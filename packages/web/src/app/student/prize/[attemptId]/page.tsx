'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface Attempt {
  id: string
  contractId: string
  status: string
  score: number
  passed: boolean
  answerProofId: string | null
  prizePaymentId: string | null
  quiz: {
    id: string
    contractId: string
    symbol: string
    title: string | null
    questionCount: number
    prizePool: string
    passThreshold: number
    status: string
    _count?: {
      attempts: number
    }
  }
  student: {
    id: string
    name: string | null
  }
}

type ClaimStep =
  | 'loading'
  | 'not-eligible'
  | 'ready'
  | 'creating-proof'
  | 'preparing-swap'
  | 'completing-swap'
  | 'claiming'
  | 'complete'
  | 'error'

export default function PrizeClaimPage() {
  const params = useParams()
  const router = useRouter()
  const attemptId = params.attemptId as string

  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [claimStep, setClaimStep] = useState<ClaimStep>('loading')
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [prizeAmount, setPrizeAmount] = useState<number | null>(null)

  const fetchAttempt = useCallback(async () => {
    try {
      setStatusMessage('Loading attempt details...')
      const response = await fetch(`/api/student/attempt/${attemptId}`)
      const data = await response.json()

      if (data.success && data.attempt) {
        const attemptData = data.attempt
        setAttempt(attemptData)

        // Check if eligible to claim
        if (!attemptData.passed) {
          setError('You did not pass this quiz. Only winners can claim prizes.')
          setClaimStep('not-eligible')
          return
        }

        if (attemptData.quiz.status !== 'REVEALED') {
          setError('Quiz has not been revealed yet. Wait for the teacher to reveal answers.')
          setClaimStep('not-eligible')
          return
        }

        if (attemptData.status === 'PRIZE_CLAIMED') {
          setClaimStep('complete')
          return
        }

        // Calculate prize share
        const winnersCount = attemptData.quiz._count?.attempts || 1
        const totalPrize = parseInt(attemptData.quiz.prizePool)
        const share = Math.floor(totalPrize / winnersCount)
        setPrizeAmount(share)

        setClaimStep('ready')
      } else {
        setError('Attempt not found')
        setClaimStep('error')
      }
    } catch (err) {
      console.error('Error fetching attempt:', err)
      setError('Failed to load attempt')
      setClaimStep('error')
    }
  }, [attemptId])

  useEffect(() => {
    fetchAttempt()
  }, [fetchAttempt])

  const handleClaimPrize = async () => {
    if (!attempt) return

    try {
      setError(null)

      // Step 6a: Create AnswerProof
      setClaimStep('creating-proof')
      setStatusMessage('Creating answer proof...')

      const proofResponse = await fetch(`/api/student/prize/${attemptId}/answer-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const proofResult = await proofResponse.json()
      if (!proofResult.success) {
        setError(proofResult.error || 'Failed to create answer proof')
        setClaimStep('error')
        return
      }

      // Step 6b: Prepare Prize Swap
      setClaimStep('preparing-swap')
      setStatusMessage('Preparing prize swap transaction...')

      const prepareResponse = await fetch(`/api/student/prize/${attemptId}/swap/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const prepareResult = await prepareResponse.json()
      if (!prepareResult.success) {
        setError(prepareResult.error || 'Failed to prepare swap')
        setClaimStep('error')
        return
      }

      // Step 6c: Complete Prize Swap
      setClaimStep('completing-swap')
      setStatusMessage('Completing atomic swap...')

      const completeResponse = await fetch(`/api/student/prize/${attemptId}/swap/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partialSwapTx: prepareResult.partialSwapTx,
          prizePaymentId: prepareResult.prizePaymentId,
          answerProofId: proofResult.answerProofId
        })
      })

      const completeResult = await completeResponse.json()
      if (!completeResult.success) {
        setError(completeResult.error || 'Failed to complete swap')
        setClaimStep('error')
        return
      }

      // Step 6d: Claim Prize Payment
      setClaimStep('claiming')
      setStatusMessage('Claiming prize payment...')

      const claimResponse = await fetch('/api/student/prize/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prizePaymentId: prepareResult.prizePaymentId
        })
      })

      const claimResult = await claimResponse.json()
      if (!claimResult.success) {
        setError(claimResult.error || 'Failed to claim prize')
        setClaimStep('error')
        return
      }

      // Success!
      setClaimStep('complete')
    } catch (err) {
      console.error('Prize claim error:', err)
      setError(err instanceof Error ? err.message : 'Failed to claim prize')
      setClaimStep('error')
    }
  }

  const formatSatoshis = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    return num.toLocaleString()
  }

  // Loading State
  if (claimStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{statusMessage}</p>
        </div>
      </div>
    )
  }

  // Error or Not Eligible State
  if (claimStep === 'error' || claimStep === 'not-eligible' || !attempt) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">
              {claimStep === 'not-eligible' ? '⚠️' : '❌'}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {error || 'Cannot Claim Prize'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || "You are not eligible to claim a prize for this attempt"}
            </p>
            <Link href="/student/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Processing States
  if (['creating-proof', 'preparing-swap', 'completing-swap', 'claiming'].includes(claimStep)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Claiming Your Prize
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{statusMessage}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              This may take 30-60 seconds
            </p>

            {/* Progress Steps */}
            <div className="mt-6 space-y-2 text-sm text-left">
              <div className={`flex items-center gap-2 ${
                claimStep === 'creating-proof' ? 'text-blue-600' : 'text-green-600'
              }`}>
                <span>{claimStep === 'creating-proof' ? '⏳' : '✅'}</span>
                <span>Creating answer proof</span>
              </div>
              <div className={`flex items-center gap-2 ${
                claimStep === 'preparing-swap' ? 'text-blue-600' :
                ['completing-swap', 'claiming'].includes(claimStep) ? 'text-green-600' : 'text-gray-400'
              }`}>
                <span>{claimStep === 'preparing-swap' ? '⏳' :
                       ['completing-swap', 'claiming'].includes(claimStep) ? '✅' : '○'}</span>
                <span>Preparing prize swap</span>
              </div>
              <div className={`flex items-center gap-2 ${
                claimStep === 'completing-swap' ? 'text-blue-600' :
                claimStep === 'claiming' ? 'text-green-600' : 'text-gray-400'
              }`}>
                <span>{claimStep === 'completing-swap' ? '⏳' :
                       claimStep === 'claiming' ? '✅' : '○'}</span>
                <span>Completing atomic swap</span>
              </div>
              <div className={`flex items-center gap-2 ${
                claimStep === 'claiming' ? 'text-blue-600' : 'text-gray-400'
              }`}>
                <span>{claimStep === 'claiming' ? '⏳' : '○'}</span>
                <span>Claiming prize payment</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Complete State
  if (claimStep === 'complete') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardBody className="text-center py-12">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🏆</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Prize Claimed Successfully!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Congratulations! Your prize has been claimed and is now in your wallet.
            </p>

            {prizeAmount && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6 mb-6">
                <div className="text-sm text-green-700 dark:text-green-300 mb-2">
                  Prize Amount
                </div>
                <div className="text-4xl font-bold text-green-600 mb-1">
                  {formatSatoshis(prizeAmount)} sats
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  ≈ {(prizeAmount / 100000000).toFixed(8)} LTC
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6 text-left">
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">Quiz Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Quiz:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {attempt.quiz.title || attempt.quiz.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Your Score:</span>
                  <span className="font-medium text-green-600">
                    {attempt.score}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Pass Threshold:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {attempt.quiz.passThreshold}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Link href="/student/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">
                  View My Attempts
                </Button>
              </Link>
              <Link href="/student/browse" className="flex-1">
                <Button className="w-full">
                  Take Another Quiz
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Ready to Claim
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Claim Your Prize
            </h1>
            <Badge variant="success">WINNER 🏆</Badge>
          </div>
        </CardHeader>

        <CardBody className="space-y-6">
          <div className="text-center py-6">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Congratulations!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You passed the quiz and won a prize. Claim it now!
            </p>
          </div>

          {/* Prize Amount */}
          {prizeAmount && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-8 text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Your Prize
              </div>
              <div className="text-5xl font-bold text-green-600 mb-2">
                {formatSatoshis(prizeAmount)} sats
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                ≈ {(prizeAmount / 100000000).toFixed(8)} LTC
              </div>
            </div>
          )}

          {/* Quiz Details */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-6">
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">Quiz Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Quiz: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {attempt.quiz.title || attempt.quiz.symbol}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Questions: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {attempt.quiz.questionCount}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Your Score: </span>
                <span className="font-medium text-green-600">
                  {attempt.score}%
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Pass Needed: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {attempt.quiz.passThreshold}%
                </span>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">How prize claiming works:</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">1.</span>
                <span>Create proof of your submitted answers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">2.</span>
                <span>Atomic swap: Exchange your answer proof for the prize payment</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">3.</span>
                <span>Claim the prize payment (releases satoshis to your wallet)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">4.</span>
                <span>Prize appears in your wallet immediately</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Link href="/student/dashboard" className="flex-1">
              <Button variant="outline" className="w-full">
                Maybe Later
              </Button>
            </Link>
            <Button onClick={handleClaimPrize} className="flex-1">
              🏆 Claim {prizeAmount && `${formatSatoshis(prizeAmount)} sats`}
            </Button>
          </div>
        </CardBody>
      </Card>
    </main>
  )
}
