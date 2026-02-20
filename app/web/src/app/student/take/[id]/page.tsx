'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FlowProgress } from '@/components/ui/FlowProgress'
import { apiService } from '@/services/api.service'
import { isInsufficientFunds } from '@/lib/api'

interface QuizQuestion {
  question: string
  options: string[]
}

interface Quiz {
  id: string
  contractId: string
  symbol: string
  title: string | null
  description: string | null
  questionCount: number
  questionHashIPFS: string
  questions: QuizQuestion[] | null  // Stored in DB — always present for UI-created quizzes
  prizePool: string
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  teacher: {
    name: string | null
  }
}

interface Question {
  question: string
  options: string[]
}

// ── Insufficient-funds banner (inline, no separate file needed) ───────────────
function LowBalanceBanner({ actionLabel, onFunded }: { actionLabel: string; onFunded: () => void }) {
  const [funding, setFunding] = useState(false)
  const [funded, setFunded] = useState(false)
  const [fundErr, setFundErr] = useState<string | null>(null)

  const handleFaucet = async () => {
    try {
      setFunding(true)
      setFundErr(null)
      await apiService.wallet.faucet({ amount: 1_000_000 })
      setFunded(true)
      setTimeout(onFunded, 800)
    } catch (err) {
      setFundErr(err instanceof Error ? err.message : 'Faucet failed')
    } finally {
      setFunding(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 overflow-hidden">
      <div className="px-5 py-4 bg-orange-100 dark:bg-orange-900/30 flex items-center gap-3">
        <span className="text-3xl">💸</span>
        <div>
          <p className="font-bold text-orange-900 dark:text-orange-200">Insufficient Wallet Balance</p>
          <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
            Not enough sats to pay the blockchain fee for: <strong>{actionLabel}</strong>
          </p>
        </div>
      </div>
      <div className="px-5 py-4">
        {funded ? (
          <p className="text-green-700 dark:text-green-400 font-semibold text-sm flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</span>
            Funded! +1,000,000 sats added. You can retry now.
          </p>
        ) : (
          <>
            <button
              onClick={handleFaucet}
              disabled={funding}
              className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-60 transition-colors"
            >
              {funding ? 'Adding funds…' : '💰 Add 1,000,000 Test Sats & Retry'}
            </button>
            {fundErr && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{fundErr}</p>}
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
              Free regtest faucet — not real Bitcoin
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// Flow matches test-complete-flow.sh steps 4, 6, 8, 9
type FlowStep =
  | 'loading'           // Loading quiz
  | 'view-quiz'         // Show quiz details, request access button (Step 4)
  | 'requesting'        // Requesting access
  | 'waiting-approval'  // Waiting for teacher approval
  | 'ready-to-pay'      // Teacher approved, ready to pay (Step 6)
  | 'paying'            // Paying entry fee (EXEC)
  | 'ready-to-start'    // Paid, have quiz token, ready to start (Step 8)
  | 'starting'          // Starting quiz (burning token)
  | 'taking-quiz'       // Taking quiz, answering questions
  | 'submitting'        // Submitting answers (Step 9)
  | 'complete'          // Submitted successfully
  | 'error'

export default function TakeQuizPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [flowStep, setFlowStep] = useState<FlowStep>('loading')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  // actionLoading separates "button is processing" from the overall flowStep
  // (avoids TS narrowing issues when comparing flowStep inside a narrowed block)
  const [actionLoading, setActionLoading] = useState(false)

  // Access request tracking
  const [accessRequestId, setAccessRequestId] = useState<string | null>(null)
  const [quizTokenId, setQuizTokenId] = useState<string | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [lowBalanceAction, setLowBalanceAction] = useState<string | null>(null) // label of failed action

  // Fetch quiz and check access status
  const fetchQuiz = useCallback(async () => {
    try {
      setStatusMessage('Loading quiz...')
      const data = await apiService.quiz.getById(quizId)
      const quizData = data.quiz
      setQuiz(quizData)

      // Check if deadline passed
      if (new Date() >= new Date(quizData.deadline)) {
        setError('Quiz deadline has passed')
        setFlowStep('error')
        return
      }

      // Check if quiz is active
      if (quizData.status !== 'ACTIVE') {
        setError(`Quiz is not active (status: ${quizData.status})`)
        setFlowStep('error')
        return
      }

      // Load questions — prefer DB-stored questions (always available for UI-created quizzes)
      if (quizData.questions && quizData.questions.length > 0) {
        setQuestions(quizData.questions)
      } else if (quizData.questionHashIPFS && quizData.questionHashIPFS !== 'QmTest123') {
        // Fall back to IPFS for older quizzes that predate DB storage
        try {
          const { fetchQuestionsFromIPFS } = await import('@/lib/ipfs')
          const ipfsQuestions = await fetchQuestionsFromIPFS(quizData.questionHashIPFS)
          if (ipfsQuestions && ipfsQuestions.length > 0) {
            setQuestions(ipfsQuestions)
          } else {
            throw new Error('No questions returned from IPFS')
          }
        } catch (err) {
          console.warn('IPFS fetch failed:', err)
          setError('Could not load quiz questions. Please try again.')
          setFlowStep('error')
          return
        }
      } else {
        setError('This quiz has no questions configured.')
        setFlowStep('error')
        return
      }

      // Check if student already has an access request
      const myRequests = await apiService.accessRequest.getMyRequests()
      const existingRequest = myRequests.requests?.find((r: any) => r.quizId === quizId)

      if (existingRequest) {
        setAccessRequestId(existingRequest.id)

        // Determine current step based on request status
        if (existingRequest.status === 'PENDING') {
          setFlowStep('waiting-approval')
        } else if (existingRequest.status === 'APPROVED') {
          setFlowStep('ready-to-pay')
        } else if (existingRequest.status === 'PAID') {
          setFlowStep('ready-to-start')
        } else if (existingRequest.status === 'STARTED') {
          // Already started, redirect to dashboard
          router.push('/student/dashboard')
        } else {
          setFlowStep('view-quiz')
        }
      } else {
        setFlowStep('view-quiz')
      }
    } catch (err) {
      console.error('Error loading quiz:', err)
      setError(err instanceof Error ? err.message : 'Failed to load quiz')
      setFlowStep('error')
    }
  }, [quizId, router])

  useEffect(() => {
    fetchQuiz()
  }, [fetchQuiz])

  // Test Step 4: Student Requests Access
  const handleRequestAccess = async () => {
    if (!quiz) return
    try {
      setActionLoading(true)
      setFlowStep('requesting')
      setStatusMessage('Requesting access to quiz...')
      setError(null)
      const result = await apiService.accessRequest.create({ quizId: quiz.id })
      setAccessRequestId(result.request.id)
      setStatusMessage('Access requested! Waiting for teacher approval...')
      setFlowStep('waiting-approval')
    } catch (err) {
      console.error('Request access error:', err)
      setError(err instanceof Error ? err.message : 'Failed to request access')
      setFlowStep('view-quiz')
    } finally {
      setActionLoading(false)
    }
  }

  // Test Step 6: Student Pays Entry Fee (EXEC)
  const handlePayEntryFee = async () => {
    if (!accessRequestId) return
    try {
      setActionLoading(true)
      setFlowStep('paying')
      setStatusMessage('Paying entry fee (blockchain transaction)...')
      setError(null)
      setLowBalanceAction(null)
      const result = await apiService.accessRequest.pay(accessRequestId)
      setQuizTokenId(result.quizTokenId)
      setFlowStep('ready-to-start')
    } catch (err) {
      console.error('Payment error:', err)
      if (isInsufficientFunds(err)) {
        setLowBalanceAction(`Pay Entry Fee (${quiz ? parseInt(quiz.entryFee).toLocaleString() : '?'} sats)`)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to pay entry fee')
      }
      setFlowStep('ready-to-pay')
    } finally {
      setActionLoading(false)
    }
  }

  // Test Step 8: Student Starts Quiz (burns token, creates attempt)
  const handleStartQuiz = async () => {
    if (!accessRequestId) return
    try {
      setActionLoading(true)
      setFlowStep('starting')
      setStatusMessage('Starting quiz (burning token, creating attempt)...')
      setError(null)
      setLowBalanceAction(null)
      const result = await apiService.accessRequest.start(accessRequestId)
      setAttemptId(result.attemptId)
      setFlowStep('taking-quiz')
    } catch (err) {
      console.error('Start quiz error:', err)
      if (isInsufficientFunds(err)) {
        setLowBalanceAction('Burn Token & Start Quiz')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start quiz')
      }
      setFlowStep('ready-to-start')
    } finally {
      setActionLoading(false)
    }
  }

  // Faucet handler for take-quiz page
  const handleFaucetAndRetry = async (retryStep: FlowStep) => {
    try {
      await apiService.wallet.faucet({ amount: 1_000_000 })
      setLowBalanceAction(null)
      setFlowStep(retryStep)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Faucet failed')
    }
  }

  // Test Step 9: Student Submits Answers
  const handleSubmitAnswers = async () => {
    if (!attemptId || !quiz) return
    if (Object.keys(answers).length !== questions.length) {
      setError('Please answer all questions before submitting')
      return
    }
    try {
      setActionLoading(true)
      setFlowStep('submitting')
      setStatusMessage('Submitting your answers...')
      setError(null)
      const answerArray = Object.keys(answers).sort((a, b) => parseInt(a) - parseInt(b))
        .map(key => answers[parseInt(key)])
      const commitment = `commitment-${JSON.stringify(answerArray)}-${Date.now()}`
      await apiService.attempt.submit(attemptId, { answerCommitment: commitment })
      setFlowStep('complete')

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/student/dashboard')
      }, 2000)
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit answers')
      setFlowStep('taking-quiz')
    } finally {
      setActionLoading(false)
    }
  }

  const formatSatoshis = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    return num.toLocaleString()
  }

  const getTimeRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff < 0) return 'Expired'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    return `${hours}h ${minutes}m`
  }

  // Flow progress configuration
  const flowSteps = [
    { id: 'request', label: 'Request Access', description: 'Ask teacher for permission', icon: '📝' },
    { id: 'approve', label: 'Approval', description: 'Wait for teacher', icon: '👨‍🏫' },
    { id: 'pay', label: 'Pay Fee', description: 'Entry fee payment', icon: '💰' },
    { id: 'start', label: 'Start Quiz', description: 'Begin answering', icon: '🎯' },
    { id: 'submit', label: 'Submit', description: 'Send answers', icon: '✅' },
  ]

  const getCompletedSteps = () => {
    const completed: string[] = []
    if (accessRequestId) completed.push('request')
    if (flowStep !== 'view-quiz' && flowStep !== 'requesting' && flowStep !== 'waiting-approval') completed.push('approve')
    if (quizTokenId) completed.push('pay')
    if (attemptId) completed.push('start')
    if (flowStep === 'complete') completed.push('submit')
    return completed
  }

  const getCurrentFlowStepId = () => {
    if (flowStep === 'view-quiz' || flowStep === 'requesting') return 'request'
    if (flowStep === 'waiting-approval') return 'approve'
    if (flowStep === 'ready-to-pay' || flowStep === 'paying') return 'pay'
    if (flowStep === 'ready-to-start' || flowStep === 'starting') return 'start'
    if (flowStep === 'taking-quiz' || flowStep === 'submitting') return 'submit'
    if (flowStep === 'complete') return 'submit'
    return 'request'
  }

  // Loading state
  if (flowStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{statusMessage}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (flowStep === 'error' || !quiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {error || 'Quiz Not Available'}
            </h3>
            <Link href="/student/browse">
              <Button>Browse Quizzes</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // View Quiz & Request Access (Step 4)
  if (flowStep === 'view-quiz') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Flow Progress */}
        <FlowProgress
          steps={flowSteps}
          currentStep={getCurrentFlowStepId()}
          completedSteps={getCompletedSteps()}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {quiz.title || `Quiz ${quiz.symbol}`}
              </h1>
              <Badge variant="success">ACTIVE</Badge>
            </div>
          </CardHeader>

          <CardBody className="space-y-6">
            {quiz.description && (
              <p className="text-gray-600 dark:text-gray-400">{quiz.description}</p>
            )}

            {/* Quiz Details */}
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                <span className="font-bold text-gray-900 dark:text-white">{quiz.questionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Entry Fee:</span>
                <span className="font-bold text-blue-600">{formatSatoshis(quiz.entryFee)} sats</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Prize Pool:</span>
                <span className="font-bold text-green-600">{formatSatoshis(quiz.prizePool)} sats</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pass Threshold:</span>
                <span className="font-bold text-gray-900 dark:text-white">{quiz.passThreshold}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Time Remaining:</span>
                <span className="font-bold text-orange-600">{getTimeRemaining(quiz.deadline)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Teacher:</span>
                <span className="font-medium text-gray-900 dark:text-white">{quiz.teacher.name || 'Anonymous'}</span>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Quiz Flow:</h3>
              <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>1. Request access</li>
                <li>2. Wait for teacher approval</li>
                <li>3. Pay {formatSatoshis(quiz.entryFee)} sats entry fee</li>
                <li>4. Start quiz & submit answers</li>
                <li>5. Win {formatSatoshis(quiz.prizePool)} sats if you score ≥ {quiz.passThreshold}%</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Link href="/student/browse" className="flex-1">
                <Button variant="outline" className="w-full">Back</Button>
              </Link>
              <Button
                onClick={handleRequestAccess}
                className="flex-1"
                disabled={actionLoading}
              >
                {actionLoading ? 'Requesting...' : 'Request Access'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Waiting for Teacher Approval
  if (flowStep === 'waiting-approval') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-6xl mb-4">⏳</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Waiting for Teacher Approval
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your access request is pending. The teacher will approve it shortly.
            </p>
            <Button onClick={fetchQuiz} variant="outline">
              Check Status
            </Button>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Ready to Pay Entry Fee (Step 6)
  if (flowStep === 'ready-to-pay') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Insufficient funds banner */}
        {lowBalanceAction && (
          <LowBalanceBanner
            actionLabel={lowBalanceAction}
            onFunded={() => handleFaucetAndRetry('ready-to-pay')}
          />
        )}

        {/* Regular error */}
        {error && !lowBalanceAction && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200 text-sm">
            ⚠️ {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pay Entry Fee
            </h1>
          </CardHeader>

          <CardBody className="space-y-6">
            <div className="text-center py-6">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Approved by Teacher!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Pay the entry fee to receive your quiz token
              </p>
            </div>

            {/* Payment Details */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Entry Fee</div>
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {formatSatoshis(quiz.entryFee)} sats
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Prize: {formatSatoshis(quiz.prizePool)} sats
              </div>
            </div>

            {/* Actions */}
            <Button
              onClick={handlePayEntryFee}
              className="w-full"
              size="lg"
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : `Pay ${formatSatoshis(quiz.entryFee)} sats`}
            </Button>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Ready to Start Quiz (Step 8)
  if (flowStep === 'ready-to-start') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Insufficient funds banner */}
        {lowBalanceAction && (
          <LowBalanceBanner
            actionLabel={lowBalanceAction}
            onFunded={() => handleFaucetAndRetry('ready-to-start')}
          />
        )}

        {/* Regular error */}
        {error && !lowBalanceAction && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200 text-sm">
            ⚠️ {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Ready to Start Quiz
            </h1>
          </CardHeader>

          <CardBody className="space-y-6">
            <div className="text-center py-6">
              <div className="text-6xl mb-4">🎟️</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                You Have a Quiz Token!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Click below to redeem your token and start
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                <span className="font-bold">{quiz.questionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pass Threshold:</span>
                <span className="font-bold">{quiz.passThreshold}%</span>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> Token will be BURNED. Make sure you're ready!
              </p>
            </div>

            {/* Actions */}
            <Button
              onClick={handleStartQuiz}
              className="w-full"
              size="lg"
              disabled={actionLoading}
            >
              {actionLoading ? 'Starting...' : 'Burn Token & Start Quiz'}
            </Button>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Taking Quiz
  if (flowStep === 'taking-quiz') {
    const progress = (Object.keys(answers).length / questions.length) * 100

    return (
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {quiz.title || `Quiz ${quiz.symbol}`}
              </h1>
              <Badge variant="success">IN PROGRESS</Badge>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress: {Object.keys(answers).length} / {questions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-6">
            {questions.map((q, qIndex) => (
              <Card key={qIndex}>
                <CardBody>
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                      Question {qIndex + 1}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">{q.question}</p>
                  </div>

                  <div className="space-y-2">
                    {q.options.map((option, oIndex) => (
                      <label
                        key={oIndex}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          answers[qIndex] === oIndex
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${qIndex}`}
                          checked={answers[qIndex] === oIndex}
                          onChange={() => setAnswers({ ...answers, [qIndex]: oIndex })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-900 dark:text-white">{option}</span>
                      </label>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}

            <div className="sticky bottom-0 bg-white dark:bg-zinc-900 pt-6 pb-4">
              <Button
                onClick={handleSubmitAnswers}
                className="w-full"
                size="lg"
                disabled={Object.keys(answers).length !== questions.length || actionLoading}
              >
                {actionLoading
                  ? 'Submitting...'
                  : `Submit Answers (${Object.keys(answers).length}/${questions.length})`
                }
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Complete
  if (flowStep === 'complete') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Answers Submitted!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Wait for the teacher to reveal and grade. Good luck!
            </p>
            <Link href="/student/dashboard">
              <Button>View My Attempts</Button>
            </Link>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Processing states
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
      <Card className="max-w-md">
        <CardBody className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{statusMessage}</p>
        </CardBody>
      </Card>
    </div>
  )
}
