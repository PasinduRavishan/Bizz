'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { apiService } from '@/services/api.service'
import { isInsufficientFunds } from '@/lib/api'

interface QuizAttempt {
  id: string
  contractId: string
  status: string
  score: number | null
  passed: boolean | null
  answerProofId: string | null
  prizePaymentId: string | null
  swapTxHex: string | null
  quiz: {
    id: string
    title: string | null
    symbol: string
    passThreshold: number
    prizePool: string
    status: string
    teacherId: string
  }
}

type PageStep =
  | 'loading'
  | 'verify'          // COMMITTED + REVEALED → ready to verify (backend computes score)
  | 'verifying'
  | 'create-proof'    // VERIFIED + passed → create AnswerProof
  | 'creating-proof'
  | 'wait-teacher'    // AnswerProof created, waiting for teacher to create Prize Payment
  | 'wait-swap-tx'    // Prize Payment created, waiting for teacher to create Swap TX
  | 'execute-swap'    // Swap TX ready → student executes atomic swap + claim (combined)
  | 'executing-swap'
  | 'complete'        // Prize claimed (swap + claim done in one step)
  | 'failed'          // Did not pass
  | 'error'

const POLL_INTERVAL = 10_000 // 10 seconds

function deriveStep(a: QuizAttempt): PageStep {
  if (a.status === 'PRIZE_CLAIMED') return 'complete'

  if (a.status === 'VERIFIED') {
    if (a.passed === false) return 'failed'
    if (!a.answerProofId) return 'create-proof'
    // AnswerProof exists — now check teacher progress
    if (a.swapTxHex) return 'execute-swap'        // Teacher created swap TX → student executes + claims
    if (a.prizePaymentId) return 'wait-swap-tx'   // Teacher created prize payment, needs swap TX
    return 'wait-teacher'                          // Waiting for teacher to create prize payment
  }

  if (a.status === 'COMMITTED') {
    if (a.quiz.status !== 'REVEALED') return 'error'
    return 'verify'
  }

  return 'error'
}

// ── Small sub-components ─────────────────────────────────────────────────────

function Spinner({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg'
    ? 'w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin'
    : 'w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block'
  return <div className={cls} />
}

function ChecklistItem({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 py-2 ${active ? 'font-semibold' : ''}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
        done
          ? 'bg-green-500 text-white'
          : active
          ? 'bg-blue-500 text-white animate-pulse'
          : 'bg-gray-200 dark:bg-zinc-700 text-gray-400'
      }`}>
        {done ? '✓' : active ? '→' : '○'}
      </div>
      <span className={`text-sm ${
        done
          ? 'text-green-700 dark:text-green-400'
          : active
          ? 'text-blue-700 dark:text-blue-300'
          : 'text-gray-500 dark:text-gray-400'
      }`}>
        {label}
      </span>
      {active && <Spinner size="sm" />}
    </div>
  )
}

function LastCheckedBar({ ts }: { ts: Date | null }) {
  if (!ts) return null
  return (
    <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
      Last checked: {ts.toLocaleTimeString()}
    </p>
  )
}

// ── Progress bar across top ──────────────────────────────────────────────────

const FLOW_STEPS = [
  { id: 'verify',       label: 'Verify' },
  { id: 'create-proof', label: 'Proof' },
  { id: 'wait-teacher', label: 'Payment' },
  { id: 'execute-swap', label: 'Swap & Claim' },
]

function stepIndex(step: PageStep): number {
  // Map each page step to a 0-based progress bar index
  const map: Partial<Record<PageStep, number>> = {
    'verify':        0,
    'create-proof':  1,
    'wait-teacher':  2,
    'wait-swap-tx':  2,  // same bar position as wait-teacher (both are "Payment" stage)
    'execute-swap':  3,
    'complete':      4,  // all done
  }
  return map[step] ?? 0
}

function ProgressBar({ step }: { step: PageStep }) {
  const current = stepIndex(step)
  return (
    <div className="mb-8">
      <div className="flex items-center">
        {FLOW_STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                done
                  ? 'bg-green-500 text-white'
                  : active
                  ? 'bg-blue-600 text-white ring-2 ring-blue-200 dark:ring-blue-900'
                  : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-gray-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div className={`h-1 flex-1 transition-colors ${done ? 'bg-green-500' : 'bg-gray-200 dark:bg-zinc-700'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex mt-2">
        {FLOW_STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={s.id} className={`flex-1 text-center text-xs font-medium ${
              done ? 'text-green-600 dark:text-green-400' : active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
            }`}>
              {s.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Insufficient-funds banner ─────────────────────────────────────────────────

function InsufficientFundsCard({
  onFunded,
  actionLabel,
}: {
  onFunded: () => void
  actionLabel: string
}) {
  const [funding, setFunding] = useState(false)
  const [funded, setFunded] = useState(false)
  const [fundErr, setFundErr] = useState<string | null>(null)

  const handleFaucet = async () => {
    try {
      setFunding(true)
      setFundErr(null)
      await apiService.wallet.faucet({ amount: 1_000_000 })
      setFunded(true)
      setTimeout(onFunded, 800) // short delay so user sees the success tick
    } catch (err) {
      setFundErr(err instanceof Error ? err.message : 'Faucet failed')
    } finally {
      setFunding(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 overflow-hidden">
      {/* Banner header */}
      <div className="px-5 py-4 bg-orange-100 dark:bg-orange-900/30 flex items-center gap-3">
        <span className="text-3xl">💸</span>
        <div>
          <p className="font-bold text-orange-900 dark:text-orange-200 text-base">
            Insufficient Wallet Balance
          </p>
          <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
            Your wallet doesn't have enough sats to cover the blockchain transaction fee for: <strong>{actionLabel}</strong>
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-orange-200 dark:border-orange-700 p-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">What happened?</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Each step of the prize claiming flow requires a small blockchain transaction fee (a few thousand sats).
            Your wallet balance was too low to broadcast this transaction.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-orange-200 dark:border-orange-700 p-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Fix it — top up your wallet</p>
          {funded ? (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold text-sm">
              <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</span>
              Funded! +1,000,000 sats added. Retrying…
            </div>
          ) : (
            <>
              <Button onClick={handleFaucet} disabled={funding} className="w-full">
                {funding ? <><Spinner /> Adding funds…</> : '💰 Add 1,000,000 Test Sats & Retry'}
              </Button>
              {fundErr && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{fundErr}</p>
              )}
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                This uses the regtest faucet — free test sats, not real Bitcoin
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StudentPrizePage() {
  const params = useParams()
  const attemptId = params.id as string

  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [step, setStep] = useState<PageStep>('loading')
  const [error, setError] = useState<string | null>(null)
  const [lowBalance, setLowBalance] = useState<string | null>(null) // action label when funds insufficient
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAttempt = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null)
      const data = await apiService.attempt.getById(attemptId)
      const a: QuizAttempt = data.attempt
      setAttempt(a)
      setLastChecked(new Date())

      const derived = deriveStep(a)
      if (derived === 'error' && a.status !== 'COMMITTED') {
        setError(`Cannot process prize for attempt in status: ${a.status}`)
      } else if (derived === 'error') {
        setError('Teacher has not revealed answers yet. Check back later.')
      }
      setStep(derived)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load attempt')
        setStep('error')
      }
    }
  }, [attemptId])

  useEffect(() => { fetchAttempt() }, [fetchAttempt])

  // ── Auto-poll while waiting for teacher ───────────────────────────────────
  useEffect(() => {
    const shouldPoll = step === 'wait-teacher' || step === 'wait-swap-tx'
    if (shouldPoll) {
      pollRef.current = setInterval(() => fetchAttempt(true), POLL_INTERVAL)
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [step, fetchAttempt])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const handleError = (err: unknown, fallbackMsg: string, prevStep: PageStep) => {
    if (isInsufficientFunds(err)) {
      setLowBalance(fallbackMsg)
      setStep(prevStep)
    } else {
      setError(err instanceof Error ? err.message : fallbackMsg)
      setStep(prevStep)
    }
  }

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleVerify = async () => {
    try {
      setLoading(true)
      setStep('verifying')
      setError(null)
      setLowBalance(null)
      await apiService.attempt.verify(attemptId, {})
      await fetchAttempt()
    } catch (err) {
      handleError(err, 'Verify Result', 'verify')
    } finally { setLoading(false) }
  }

  const handleCreateAnswerProof = async () => {
    try {
      setLoading(true)
      setStep('creating-proof')
      setError(null)
      setLowBalance(null)
      await apiService.prize.createAnswerProof({ attemptId })
      await fetchAttempt()
    } catch (err) {
      handleError(err, 'Create AnswerProof', 'create-proof')
    } finally { setLoading(false) }
  }

  const handleExecuteSwap = async () => {
    try {
      setLoading(true)
      setStep('executing-swap')
      setError(null)
      setLowBalance(null)
      // Backend executes the atomic swap AND claims the prize payment in one call
      // so the student's wallet balance increases immediately after this completes
      await apiService.prize.executeSwap(attemptId)
      await fetchAttempt()
    } catch (err) {
      handleError(err, 'Execute Swap & Claim', 'execute-swap')
    } finally { setLoading(false) }
  }

  // ── Full-screen spinners ───────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your results…</p>
        </div>
      </div>
    )
  }

  const loadingLabels: Partial<Record<PageStep, string>> = {
    verifying: 'Verifying your result on the blockchain…',
    'creating-proof': 'Creating AnswerProof on the blockchain…',
    'executing-swap': 'Executing atomic swap and claiming your prize — releasing sats to your wallet…',
  }
  if (loadingLabels[step]) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            <div className="flex justify-center mb-6"><Spinner size="lg" /></div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Processing</h3>
            <p className="text-gray-600 dark:text-gray-400">{loadingLabels[step]}</p>
            <p className="text-sm text-gray-400 mt-3">This may take 30–60 seconds</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (step === 'error' || !attempt) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Link href="/student/dashboard"><Button>Back to Dashboard</Button></Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // ── Failed ─────────────────────────────────────────────────────────────────
  if (step === 'failed') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Better Luck Next Time</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-1">
              Your score: <span className="font-bold text-red-600">{attempt.score ?? 0}%</span>
            </p>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              Required {attempt.quiz.passThreshold}% to pass
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/student/browse"><Button>Browse More Quizzes</Button></Link>
              <Link href="/student/dashboard"><Button variant="outline">Dashboard</Button></Link>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  if (step === 'complete') {
    const prizePool = parseInt(attempt.quiz.prizePool).toLocaleString()
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="border-2 border-green-400 dark:border-green-600">
          <CardBody className="text-center py-14">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Prize Claimed!</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-1">
              <span className="text-2xl font-bold text-green-600">{prizePool} sats</span>
            </p>
            <p className="text-gray-500 text-sm mb-8">have been added to your wallet</p>
            <div className="flex gap-3 justify-center">
              <Link href="/student/dashboard"><Button>Back to Dashboard</Button></Link>
              <Link href="/student/browse"><Button variant="outline">Browse More Quizzes</Button></Link>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // ── Main flow ──────────────────────────────────────────────────────────────
  const quizTitle = attempt.quiz.title || `Quiz ${attempt.quiz.symbol}`
  const prizePool = parseInt(attempt.quiz.prizePool).toLocaleString()

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/student/dashboard" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quizTitle}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Prize Claiming Flow</p>
      </div>

      {/* Progress bar */}
      <ProgressBar step={step} />

      {/* Insufficient funds card — replaces error banner when balance is too low */}
      {lowBalance ? (
        <InsufficientFundsCard
          actionLabel={lowBalance}
          onFunded={() => {
            setLowBalance(null)
            // Re-derive step from attempt so the correct action button is shown
            fetchAttempt()
          }}
        />
      ) : error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200 text-sm flex items-start gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 1: Verify ──────────────────────────────────────────────────── */}
      {step === 'verify' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verify Your Result</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                🎯 The teacher has revealed the correct answers. Click below to verify your result on the blockchain.
                Your score is computed automatically — no manual input needed.
              </p>
            </div>

            <div className="space-y-1">
              <ChecklistItem done={false} active={true}  label="Verify result on blockchain" />
              <ChecklistItem done={false} active={false} label="Create AnswerProof" />
              <ChecklistItem done={false} active={false} label="Wait for teacher's Prize Payment" />
              <ChecklistItem done={false} active={false} label="Execute atomic swap" />
              <ChecklistItem done={false} active={false} label="Claim prize" />
            </div>

            <div className="flex gap-3">
              <Link href="/student/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Cancel</Button>
              </Link>
              <Button onClick={handleVerify} className="flex-1" disabled={loading}>
                {loading ? <><Spinner /> Verifying…</> : '🎯 Verify My Result'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Step 2: Create AnswerProof ──────────────────────────────────────── */}
      {step === 'create-proof' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Answer Proof</h2>
              </div>
              <Badge variant="success">PASSED ✓</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {/* Score banner */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-5 text-center">
              <div className="text-5xl mb-2">🏆</div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">{attempt.score}%</div>
              <div className="text-sm text-green-700 dark:text-green-300 mt-1">Prize: {prizePool} sats</div>
            </div>

            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold mb-1">What is an AnswerProof?</p>
              <p>An AnswerProof is a small contract on the blockchain that records your correct answers. The teacher will use it in the atomic swap — they give you the prize, you give them the proof.</p>
            </div>

            <div className="space-y-1">
              <ChecklistItem done={true}  active={false} label="Verified result on blockchain" />
              <ChecklistItem done={false} active={true}  label="Create AnswerProof on blockchain" />
              <ChecklistItem done={false} active={false} label="Wait for teacher's Prize Payment" />
              <ChecklistItem done={false} active={false} label="Execute atomic swap" />
              <ChecklistItem done={false} active={false} label="Claim prize" />
            </div>

            <Button onClick={handleCreateAnswerProof} className="w-full" disabled={loading}>
              {loading ? <><Spinner /> Creating…</> : '📜 Create AnswerProof'}
            </Button>
          </CardBody>
        </Card>
      )}

      {/* ── Step 3a: Wait for Prize Payment (teacher action) ───────────────── */}
      {step === 'wait-teacher' && (
        <Card className="border-2 border-amber-300 dark:border-amber-600">
          <CardHeader className="bg-amber-50 dark:bg-amber-900/20 rounded-t-lg">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">3</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Waiting for Teacher</h2>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 ml-9">
              Teacher needs to create the Prize Payment — checking automatically
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Polling for update…</p>
                <p className="text-sm text-gray-500">Checking every 10 seconds</p>
              </div>
            </div>

            <div className="space-y-1">
              <ChecklistItem done={true}  active={false} label="Verified result on blockchain" />
              <ChecklistItem done={true}  active={false} label="Created AnswerProof on blockchain" />
              <ChecklistItem done={false} active={true}  label="Teacher creates Prize Payment (waiting…)" />
              <ChecklistItem done={false} active={false} label="Teacher creates atomic Swap TX" />
              <ChecklistItem done={false} active={false} label="Execute atomic swap" />
              <ChecklistItem done={false} active={false} label="Claim prize" />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">💡 What happens next?</p>
              <p>Your teacher will see your AnswerProof on their dashboard and create a Prize Payment of <strong>{prizePool} sats</strong>. This page will update automatically when they do.</p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => fetchAttempt()}
                variant="outline"
                className="flex-1"
                disabled={loading}
              >
                {loading ? <><Spinner /> Checking…</> : '🔄 Check Now'}
              </Button>
            </div>
            <LastCheckedBar ts={lastChecked} />
          </CardBody>
        </Card>
      )}

      {/* ── Step 3b: Wait for Swap TX (teacher action) ────────────────────── */}
      {step === 'wait-swap-tx' && (
        <Card className="border-2 border-amber-300 dark:border-amber-600">
          <CardHeader className="bg-amber-50 dark:bg-amber-900/20 rounded-t-lg">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">3</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Almost There!</h2>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 ml-9">
              Prize Payment received — waiting for teacher to set up the swap
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Polling for swap TX…</p>
                <p className="text-sm text-gray-500">Checking every 10 seconds</p>
              </div>
            </div>

            <div className="space-y-1">
              <ChecklistItem done={true}  active={false} label="Verified result on blockchain" />
              <ChecklistItem done={true}  active={false} label="Created AnswerProof on blockchain" />
              <ChecklistItem done={true}  active={false} label="Teacher created Prize Payment ✓" />
              <ChecklistItem done={false} active={true}  label="Teacher creates atomic Swap TX (waiting…)" />
              <ChecklistItem done={false} active={false} label="Execute atomic swap" />
              <ChecklistItem done={false} active={false} label="Claim prize" />
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-sm text-green-800 dark:text-green-200">
              <p className="font-semibold mb-1">🎯 Prize Payment locked in!</p>
              <p>The teacher has reserved <strong>{prizePool} sats</strong> for you. They are setting up the atomic swap now — this page will update automatically.</p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => fetchAttempt()}
                variant="outline"
                className="flex-1"
                disabled={loading}
              >
                {loading ? <><Spinner /> Checking…</> : '🔄 Check Now'}
              </Button>
            </div>
            <LastCheckedBar ts={lastChecked} />
          </CardBody>
        </Card>
      )}

      {/* ── Step 4: Execute Swap & Claim ────────────────────────────────────── */}
      {step === 'execute-swap' && (
        <Card className="border-2 border-green-400 dark:border-green-600">
          <CardHeader className="bg-green-50 dark:bg-green-900/20 rounded-t-lg">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">4</span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Execute Swap &amp; Claim Prize</h2>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1 ml-9">
              The swap is ready — click once to receive your sats!
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 text-center border border-green-200 dark:border-green-700">
              <div className="text-5xl mb-2">🔄</div>
              <p className="font-bold text-green-800 dark:text-green-200 text-lg">Swap is Ready!</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                You will receive <strong>{prizePool} sats</strong> directly to your wallet
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <p className="font-semibold mb-2">What happens when you click:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Your AnswerProof is exchanged for the Prize Payment atomically</li>
                <li>The {prizePool} sats are immediately released to your wallet</li>
                <li>Both steps happen in one click — no separate claim needed</li>
              </ul>
            </div>

            <div className="space-y-1">
              <ChecklistItem done={true}  active={false} label="Verified result on blockchain" />
              <ChecklistItem done={true}  active={false} label="Created AnswerProof on blockchain" />
              <ChecklistItem done={true}  active={false} label="Teacher created Prize Payment" />
              <ChecklistItem done={true}  active={false} label="Teacher created Swap TX" />
              <ChecklistItem done={false} active={true}  label="Execute swap &amp; claim sats to wallet" />
            </div>

            <Button onClick={handleExecuteSwap} className="w-full" disabled={loading}>
              {loading ? <><Spinner /> Executing…</> : `⚡ Execute Swap & Claim ${prizePool} sats`}
            </Button>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 text-center">
        <Link href="/student/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  )
}
