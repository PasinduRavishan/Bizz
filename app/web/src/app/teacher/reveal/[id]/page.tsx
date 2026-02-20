'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { apiService } from '@/services/api.service'

interface AttemptStudent {
  id: string
  name: string | null
  email: string
}

interface Attempt {
  id: string
  contractId: string
  status: string
  score: number | null
  passed: boolean | null
  answerProofId: string | null
  prizePaymentId: string | null
  swapTxHex: string | null
  student: AttemptStudent
}

interface Quiz {
  id: string
  contractId: string
  symbol: string
  title: string | null
  questionCount: number
  prizePool: string
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  revealedAnswers: string[] | null
  attempts: Attempt[]
}

type PageStep = 'loading' | 'waiting' | 'ready' | 'revealing' | 'complete' | 'already_revealed' | 'error'

// Which step of the prize flow is this winner at?
type PrizeStage =
  | 'awaiting-student-verify'   // pre-graded passed, student hasn't done blockchain verify yet
  | 'awaiting-proof'            // VERIFIED, no answerProofId yet (student side)
  | 'need-payment'              // answerProofId exists, teacher must create Prize Payment
  | 'need-swap-tx'              // prizePaymentId exists, teacher must create Swap TX
  | 'awaiting-student-swap'     // swapTxHex exists, waiting for student to execute
  | 'complete'                  // PRIZE_CLAIMED

function getPrizeStage(attempt: Attempt): PrizeStage {
  if (attempt.status === 'PRIZE_CLAIMED') return 'complete'
  if (attempt.swapTxHex) return 'awaiting-student-swap'
  if (attempt.prizePaymentId) return 'need-swap-tx'
  if (attempt.answerProofId) return 'need-payment'
  if (attempt.status === 'VERIFIED') return 'awaiting-proof'
  return 'awaiting-student-verify'
}

export default function TeacherRevealPage() {
  const params = useParams()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [currentStep, setCurrentStep] = useState<PageStep>('loading')
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [prizeLoading, setPrizeLoading] = useState<Record<string, string>>({})
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await apiService.quiz.getById(quizId)
      const quizData = data.quiz
      setQuiz(quizData)

      if (quizData.status === 'REVEALED' || quizData.revealedAnswers) {
        setCurrentStep('already_revealed')
        return
      }
      const now = new Date()
      const deadline = new Date(quizData.deadline)
      setCurrentStep(now < deadline ? 'waiting' : 'ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz')
      setCurrentStep('error')
    }
  }, [quizId])

  useEffect(() => { fetchQuiz() }, [fetchQuiz])

  // Auto-refresh every 15s when on the revealed page so teacher sees student progress
  useEffect(() => {
    if (currentStep !== 'already_revealed' && currentStep !== 'complete') return
    const interval = setInterval(fetchQuiz, 15000)
    return () => clearInterval(interval)
  }, [currentStep, fetchQuiz])

  const handleReveal = async () => {
    if (!quiz) return
    try {
      setCurrentStep('revealing')
      setStatusMessage('Broadcasting correct answers to the blockchain...')
      setError(null)
      await apiService.quiz.reveal(quizId)
      setStatusMessage('Pre-grading all submissions...')
      await fetchQuiz()
      setCurrentStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal')
      setCurrentStep('error')
    }
  }

  const handleCreatePrizePayment = async (attempt: Attempt) => {
    try {
      setPrizeLoading(prev => ({ ...prev, [attempt.id]: 'payment' }))
      setActionErrors(prev => { const n = { ...prev }; delete n[attempt.id]; return n })
      await apiService.prize.createPrizePayment(attempt.id)
      await fetchQuiz()
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [attempt.id]: err instanceof Error ? err.message : 'Failed to create prize payment' }))
    } finally {
      setPrizeLoading(prev => { const n = { ...prev }; delete n[attempt.id]; return n })
    }
  }

  const handleCreateSwapTx = async (attempt: Attempt) => {
    try {
      setPrizeLoading(prev => ({ ...prev, [attempt.id]: 'swap' }))
      setActionErrors(prev => { const n = { ...prev }; delete n[attempt.id]; return n })
      await apiService.prize.createSwapTx(attempt.id)
      await fetchQuiz()
    } catch (err) {
      setActionErrors(prev => ({ ...prev, [attempt.id]: err instanceof Error ? err.message : 'Failed to create swap transaction' }))
    } finally {
      setPrizeLoading(prev => { const n = { ...prev }; delete n[attempt.id]; return n })
    }
  }

  const fmt = (sats: string | number) => {
    const n = typeof sats === 'string' ? parseInt(sats) : sats
    return n.toLocaleString()
  }

  const getCountdown = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff <= 0) return 'Deadline passed'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading quiz...</p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (currentStep === 'error' || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{error || 'Quiz Not Found'}</h3>
            <Link href="/teacher/dashboard"><Button>Back to Dashboard</Button></Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // ── Revealing (blockchain tx in progress) ────────────────────────────────────
  if (currentStep === 'revealing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Revealing & Grading</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-1">{statusMessage}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">This may take 30–60 seconds</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  // ── Waiting for deadline ─────────────────────────────────────────────────────
  if (currentStep === 'waiting') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.title || `Quiz ${quiz.symbol}`}</h1>
              <Badge variant="success">ACTIVE</Badge>
            </div>
          </CardHeader>
          <CardBody className="text-center py-10 space-y-6">
            <div className="text-6xl">⏰</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Waiting for Quiz to End</h2>
              <p className="text-gray-500 dark:text-gray-400">You can reveal answers after the deadline passes</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Time remaining</p>
              <p className="text-3xl font-bold text-blue-600">{getCountdown(quiz.deadline)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Deadline: {new Date(quiz.deadline).toLocaleString()}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
                <div className="font-bold text-gray-900 dark:text-white text-lg">{quiz.questionCount}</div>
                <div className="text-gray-500 dark:text-gray-400">Questions</div>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
                <div className="font-bold text-blue-600 text-lg">{quiz.attempts?.length || 0}</div>
                <div className="text-gray-500 dark:text-gray-400">Attempts</div>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
                <div className="font-bold text-green-600 text-lg">{fmt(quiz.prizePool)}</div>
                <div className="text-gray-500 dark:text-gray-400">sats prize</div>
              </div>
            </div>
            <Link href="/teacher/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
          </CardBody>
        </Card>
      </main>
    )
  }

  // ── Ready to reveal ──────────────────────────────────────────────────────────
  if (currentStep === 'ready') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.title || `Quiz ${quiz.symbol}`}</h1>
              <Badge variant="info">DEADLINE PASSED</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎯</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ready to Reveal & Grade</h2>
              <p className="text-gray-500 dark:text-gray-400">
                The quiz deadline has passed. Reveal correct answers on-chain — all submissions will be graded automatically.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
                <div className="font-bold text-gray-900 dark:text-white text-lg">{quiz.attempts?.length || 0}</div>
                <div className="text-gray-500 dark:text-gray-400">Submissions</div>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
                <div className="font-bold text-green-600 text-lg">{fmt(quiz.prizePool)}</div>
                <div className="text-gray-500 dark:text-gray-400">sats prize</div>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
                <div className="font-bold text-gray-900 dark:text-white text-lg">{quiz.passThreshold}%</div>
                <div className="text-gray-500 dark:text-gray-400">Pass threshold</div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">📋 What happens next</h3>
              <ol className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                <li>1. Correct answers are published on the blockchain</li>
                <li>2. All submissions are automatically graded</li>
                <li>3. Winners appear here — you create their Prize Payment &amp; Swap TX</li>
                <li>4. Students execute the swap to receive their sats</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Link href="/teacher/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Cancel</Button>
              </Link>
              <Button onClick={handleReveal} className="flex-1">
                🎯 Reveal Answers &amp; Grade
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // ── Already revealed / complete ──────────────────────────────────────────────
  const allAttempts = quiz.attempts || []
  const passedAttempts = allAttempts.filter(a => a.passed === true)
  const failedAttempts = allAttempts.filter(a => a.passed === false)
  const noSubmissionAttempts = allAttempts.filter(a => a.passed === null && a.status !== 'COMMITTED')
  const pendingGradeAttempts = allAttempts.filter(a => a.passed === null && a.status === 'COMMITTED')
  const pendingAttempts = [...noSubmissionAttempts, ...pendingGradeAttempts]

  // How many winners still need teacher action?
  const actionRequired = passedAttempts.filter(a => {
    const stage = getPrizeStage(a)
    return stage === 'need-payment' || stage === 'need-swap-tx'
  }).length

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.title || `Quiz ${quiz.symbol}`}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Quiz revealed &amp; graded</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info">REVEALED</Badge>
          <Button variant="outline" size="sm" onClick={fetchQuiz}>↻ Refresh</Button>
        </div>
      </div>

      {/* ── Just-revealed success banner ────────────────────────────────────── */}
      {currentStep === 'complete' && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200">Quiz Revealed &amp; All Submissions Graded</p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
              Winners are listed below. Complete the Prize Payment and Swap TX for each winner.
            </p>
          </div>
        </div>
      )}

      {/* ── Teacher action alert ─────────────────────────────────────────────── */}
      {actionRequired > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Action required: {actionRequired} winner{actionRequired > 1 ? 's' : ''} waiting for you
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
              Create the Prize Payment and Swap TX for each winner below so they can claim their sats.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* ── Summary stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-4 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{allAttempts.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700 p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{passedAttempts.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">🏆 Winners</div>
          <div className="text-xs text-gray-400 mt-0.5">≥{quiz.passThreshold}%</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700 p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{failedAttempts.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">❌ Failed</div>
          <div className="text-xs text-gray-400 mt-0.5">&lt;{quiz.passThreshold}%</div>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-4 text-center">
          <div className="text-3xl font-bold text-gray-500">{pendingAttempts.length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">No Answer</div>
        </div>
      </div>

      {/* ── Winners section ─────────────────────────────────────────────────── */}
      {passedAttempts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            🏆 Winners — Prize Distribution
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({passedAttempts.length})</span>
          </h2>
          <div className="space-y-4">
            {passedAttempts.map(attempt => {
              const stage = getPrizeStage(attempt)
              const isLoadingPayment = prizeLoading[attempt.id] === 'payment'
              const isLoadingSwap = prizeLoading[attempt.id] === 'swap'
              const studentName = attempt.student.name || attempt.student.email || `Student ${attempt.student.id.slice(0, 8)}`
              const actionErr = actionErrors[attempt.id]

              // Flow steps for this winner
              const steps = [
                { label: 'Student verifies result', done: attempt.status === 'VERIFIED' || attempt.status === 'PRIZE_CLAIMED' || !!attempt.answerProofId },
                { label: 'Student creates AnswerProof', done: !!attempt.answerProofId },
                { label: 'Teacher creates Prize Payment', done: !!attempt.prizePaymentId, teacherAction: true },
                { label: 'Teacher creates Swap TX', done: !!attempt.swapTxHex, teacherAction: true },
                { label: 'Student executes swap & claims', done: attempt.status === 'PRIZE_CLAIMED' },
              ]

              return (
                <div key={attempt.id} className={`rounded-xl border-2 overflow-hidden ${
                  stage === 'complete'
                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10'
                    : stage === 'need-payment' || stage === 'need-swap-tx'
                    ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10'
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                }`}>
                  {/* Card header */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap border-b border-gray-100 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        stage === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {stage === 'complete' ? '✓' : '🏆'}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{studentName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Score: <span className="font-semibold text-green-600">{attempt.score}%</span>
                          {' · '}Prize: <span className="font-semibold text-blue-600">{fmt(quiz.prizePool)} sats</span>
                        </div>
                      </div>
                    </div>
                    {stage === 'complete' && <Badge variant="success">Prize Claimed ✓</Badge>}
                    {stage === 'awaiting-student-swap' && <Badge variant="info">Waiting for Student</Badge>}
                    {(stage === 'need-payment' || stage === 'need-swap-tx') && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-600">
                        ⚡ Your Action Needed
                      </span>
                    )}
                    {(stage === 'awaiting-student-verify' || stage === 'awaiting-proof') && (
                      <Badge variant="default">Waiting for Student</Badge>
                    )}
                  </div>

                  {/* Flow steps */}
                  <div className="px-5 py-4">
                    <div className="space-y-2.5 mb-4">
                      {steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            s.done
                              ? 'bg-green-500 text-white'
                              : s.teacherAction && !s.done && (() => {
                                  // Is this step the CURRENT teacher action?
                                  if (i === 2) return stage === 'need-payment'
                                  if (i === 3) return stage === 'need-swap-tx'
                                  return false
                                })()
                              ? 'bg-amber-400 text-white animate-pulse'
                              : 'bg-gray-200 dark:bg-zinc-600 text-gray-400 dark:text-gray-500'
                          }`}>
                            {s.done ? '✓' : i + 1}
                          </div>
                          <span className={`text-sm ${
                            s.done
                              ? 'text-green-700 dark:text-green-400 line-through opacity-70'
                              : s.teacherAction && !s.done && (() => {
                                  if (i === 2) return stage === 'need-payment'
                                  if (i === 3) return stage === 'need-swap-tx'
                                  return false
                                })()
                              ? 'font-semibold text-amber-800 dark:text-amber-300'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {s.label}
                            {s.teacherAction && !s.done && (() => {
                              if (i === 2) return stage === 'need-payment'
                              if (i === 3) return stage === 'need-swap-tx'
                              return false
                            })() && <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">← your turn</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Per-attempt error */}
                    {actionErr && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                        {actionErr}
                      </div>
                    )}

                    {/* Teacher action buttons */}
                    {stage === 'need-payment' && (
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          The student has created their AnswerProof. Create the Prize Payment contract to lock {fmt(quiz.prizePool)} sats for this winner.
                        </p>
                        <Button
                          onClick={() => handleCreatePrizePayment(attempt)}
                          disabled={isLoadingPayment}
                          className="w-full"
                        >
                          {isLoadingPayment
                            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating Payment...</span>
                            : `💰 Create Prize Payment (${fmt(quiz.prizePool)} sats)`
                          }
                        </Button>
                      </div>
                    )}

                    {stage === 'need-swap-tx' && (
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Prize Payment is ready. Create the atomic Swap TX — this links the AnswerProof to the Prize Payment so the student can execute the swap trustlessly.
                        </p>
                        <Button
                          onClick={() => handleCreateSwapTx(attempt)}
                          disabled={isLoadingSwap}
                          className="w-full"
                        >
                          {isLoadingSwap
                            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating Swap TX...</span>
                            : '🔄 Create Atomic Swap TX'
                          }
                        </Button>
                      </div>
                    )}

                    {stage === 'awaiting-student-swap' && (
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          Swap TX ready — waiting for the student to execute and claim their {fmt(quiz.prizePool)} sats
                        </div>
                      </div>
                    )}

                    {stage === 'awaiting-student-verify' && (
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          Waiting for student to verify their result on-chain
                        </div>
                      </div>
                    )}

                    {stage === 'awaiting-proof' && (
                      <div className="pt-2 border-t border-gray-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          Waiting for student to create their AnswerProof
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Failed attempts ──────────────────────────────────────────────────── */}
      {failedAttempts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            ❌ Failed Attempts <span className="text-sm font-normal text-gray-500">({failedAttempts.length})</span>
          </h2>
          <div className="space-y-2">
            {failedAttempts.map(attempt => (
              <div key={attempt.id} className="flex items-center justify-between bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {attempt.student.name || attempt.student.email || `Student ${attempt.student.id.slice(0, 8)}`}
                  </span>
                  <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                    Score: <span className="text-red-600 font-medium">{attempt.score !== null ? `${attempt.score}%` : 'Pending'}</span>
                    {' '}(needed {quiz.passThreshold}%)
                  </span>
                </div>
                <Badge variant="danger">Failed</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── No submission ────────────────────────────────────────────────────── */}
      {pendingAttempts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            📭 No Answers Submitted <span className="text-sm font-normal text-gray-500">({pendingAttempts.length})</span>
          </h2>
          <div className="space-y-2">
            {pendingAttempts.map(attempt => (
              <div key={attempt.id} className="flex items-center justify-between bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
                <span className="font-medium text-gray-900 dark:text-white">
                  {attempt.student.name || attempt.student.email || `Student ${attempt.student.id.slice(0, 8)}`}
                </span>
                <Badge variant="default">No Submission</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────────── */}
      {allAttempts.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-medium">No students attempted this quiz</p>
        </div>
      )}

      <div className="mt-4">
        <Link href="/teacher/dashboard">
          <Button variant="outline" className="w-full">Back to Dashboard</Button>
        </Link>
      </div>
    </main>
  )
}
