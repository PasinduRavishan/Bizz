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
  prizePerWinner: string | null   // per-winner share after reveal
  winnerCount: number             // number of passing students (set at reveal)
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  revealedAnswers: string[] | null
  attempts: Attempt[]
}

// Prize flow stage for a winner (read-only — teacher no longer acts on these)
type PrizeStage =
  | 'awaiting-student-verify'   // student hasn't done blockchain verify yet
  | 'awaiting-proof'            // VERIFIED, no answerProofId yet (student side)
  | 'awaiting-swap'             // prize payment + swap tx auto-created, waiting for student
  | 'complete'                  // PRIZE_CLAIMED

function getPrizeStage(attempt: Attempt): PrizeStage {
  if (attempt.status === 'PRIZE_CLAIMED') return 'complete'
  if (attempt.swapTxHex) return 'awaiting-swap'
  if (attempt.status === 'VERIFIED') return 'awaiting-proof'
  return 'awaiting-student-verify'
}

const getCountdown = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Deadline passed'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`
}

const fmt = (sats: string | number) => {
  const n = typeof sats === 'string' ? parseInt(sats) : sats
  return n.toLocaleString()
}

export default function TeacherRevealPage() {
  const params = useParams()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await apiService.quiz.getById(quizId)
      setQuiz(data.quiz)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => { fetchQuiz() }, [fetchQuiz])

  // Auto-refresh every 15s so teacher sees student progress in real time
  useEffect(() => {
    const interval = setInterval(fetchQuiz, 15000)
    return () => clearInterval(interval)
  }, [fetchQuiz])

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
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
  if (error || !quiz) {
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

  // ── Quiz still active — show live monitor ────────────────────────────────────
  if (quiz.status === 'ACTIVE') {
    const isDeadlinePassed = new Date() >= new Date(quiz.deadline)
    const committedCount = (quiz.attempts || []).filter(a => a.status === 'COMMITTED').length

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
            <div className="text-6xl">{isDeadlinePassed ? '⏰' : '🎓'}</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {isDeadlinePassed ? 'Auto-Reveal in Progress…' : 'Quiz is Live'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                {isDeadlinePassed
                  ? 'The deadline has passed. Answers will be revealed automatically by the system within ~1 minute.'
                  : 'Students are taking the quiz. Answers will be revealed automatically once the deadline passes.'}
              </p>
            </div>

            {!isDeadlinePassed && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Time remaining</p>
                <p className="text-3xl font-bold text-blue-600">{getCountdown(quiz.deadline)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Deadline: {new Date(quiz.deadline).toLocaleString()}
                </p>
              </div>
            )}

            {isDeadlinePassed && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6">
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                  ⏰ The system is broadcasting correct answers to the blockchain and grading all submissions.
                  This page will automatically update when complete.
                </p>
              </div>
            )}

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
                <div className="font-bold text-indigo-600 text-lg">{committedCount}</div>
                <div className="text-gray-500 dark:text-gray-400">Submitted</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/teacher/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Back to Dashboard</Button>
              </Link>
              <Button variant="outline" onClick={fetchQuiz} className="flex-1">
                ↻ Refresh
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // ── Revealed/Completed — Results View ───────────────────────────────────────
  const allAttempts = quiz.attempts || []
  const passedAttempts = allAttempts.filter(a => a.passed === true)
  const failedAttempts = allAttempts.filter(a => a.passed === false)
  const pendingAttempts = allAttempts.filter(a => a.passed === null)

  const claimedCount = passedAttempts.filter(a => a.status === 'PRIZE_CLAIMED').length
  const awaitingSwapCount = passedAttempts.filter(a => a.swapTxHex && a.status !== 'PRIZE_CLAIMED').length
  const preparingCount = passedAttempts.filter(a => !a.swapTxHex && a.status !== 'PRIZE_CLAIMED').length

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.title || `Quiz ${quiz.symbol}`}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Results — answers revealed &amp; graded automatically</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info">{quiz.status}</Badge>
          <Button variant="outline" size="sm" onClick={fetchQuiz}>↻ Refresh</Button>
        </div>
      </div>

      {/* ── Automation info banner ────────────────────────────────────────────── */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">🤖</span>
        <div>
          <p className="font-semibold text-blue-800 dark:text-blue-200">Fully Automated</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
            Answers were revealed automatically. Prize payments and swap transactions are being prepared for winners.
            Students can claim their prize as soon as their swap tx is ready — no teacher action needed.
          </p>
        </div>
      </div>

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
          <div className="text-3xl font-bold text-teal-600">{claimedCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">✅ Prizes Claimed</div>
          <div className="text-xs text-gray-400 mt-0.5">of {passedAttempts.length} winner{passedAttempts.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* ── Winners section ─────────────────────────────────────────────────── */}
      {passedAttempts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            🏆 Winners
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({passedAttempts.length})</span>
            {awaitingSwapCount > 0 && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                · {awaitingSwapCount} awaiting student claim
              </span>
            )}
            {preparingCount > 0 && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                · {preparingCount} preparing prize...
              </span>
            )}
          </h2>
          {/* Multi-winner distribution summary */}
          {passedAttempts.length > 1 && quiz.prizePerWinner && (
            <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg px-4 py-3 text-sm text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
              <span>🏅</span>
              <span>
                Prize pool of <strong>{fmt(quiz.prizePool)} sats</strong> split equally among{' '}
                <strong>{quiz.winnerCount} winners</strong> — each receives{' '}
                <strong>{fmt(quiz.prizePerWinner)} sats</strong>
              </span>
            </div>
          )}
          <div className="space-y-4">
            {passedAttempts.map(attempt => {
              const stage = getPrizeStage(attempt)
              const studentName = attempt.student.name || attempt.student.email || `Student ${attempt.student.id.slice(0, 8)}`

              // Steps for this winner — all automated, just showing status
              const steps = [
                { label: 'Answers revealed on blockchain', done: true },
                { label: 'Result graded automatically', done: attempt.score !== null },
                { label: 'Student verifies result', done: attempt.status !== 'COMMITTED' && attempt.status !== 'OWNED' },
                { label: 'AnswerProof created', done: !!attempt.answerProofId },
                { label: 'Prize Payment & Swap TX prepared (auto)', done: !!attempt.swapTxHex },
                { label: 'Student executes swap & claims prize', done: attempt.status === 'PRIZE_CLAIMED' },
              ]

              return (
                <div key={attempt.id} className={`rounded-xl border-2 overflow-hidden ${
                  stage === 'complete'
                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10'
                    : stage === 'awaiting-swap'
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10'
                    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                }`}>
                  {/* Card header */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap border-b border-gray-100 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        stage === 'complete' ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'
                      }`}>
                        {stage === 'complete' ? '✓' : '🏆'}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{studentName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Score: <span className="font-semibold text-green-600">{attempt.score !== null ? `${attempt.score}%` : '—'}</span>
                          {' · '}Prize: <span className="font-semibold text-blue-600">
                            {fmt(quiz.prizePerWinner ?? quiz.prizePool)} sats
                          </span>
                          {(quiz.winnerCount ?? 0) > 1 && (
                            <span className="ml-1 text-xs text-gray-400">
                              ({quiz.winnerCount} winners share {fmt(quiz.prizePool)} sats equally)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {stage === 'complete' && <Badge variant="success">Prize Claimed ✓</Badge>}
                    {stage === 'awaiting-swap' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Awaiting student
                      </span>
                    )}
                    {(stage === 'awaiting-student-verify' || stage === 'awaiting-proof') && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Preparing…
                      </span>
                    )}
                  </div>

                  {/* Flow steps — read-only progress indicator */}
                  <div className="px-5 py-4">
                    <div className="space-y-2">
                      {steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            s.done
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 dark:bg-zinc-600 text-gray-400 dark:text-gray-500'
                          }`}>
                            {s.done ? '✓' : i + 1}
                          </div>
                          <span className={`text-sm ${
                            s.done
                              ? 'text-green-700 dark:text-green-400 line-through opacity-70'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {s.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Status messages */}
                    {stage === 'awaiting-swap' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          Swap TX is ready — waiting for the student to execute and claim {fmt(quiz.prizePerWinner ?? quiz.prizePool)} sats
                        </div>
                      </div>
                    )}
                    {(stage === 'awaiting-student-verify' || stage === 'awaiting-proof') && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          {stage === 'awaiting-student-verify'
                            ? 'Waiting for student to verify their result on-chain'
                            : 'Preparing prize automatically — student can claim soon'}
                        </div>
                      </div>
                    )}
                    {stage === 'complete' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          ✅ Student has claimed their {fmt(quiz.prizePerWinner ?? quiz.prizePool)} sats
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
                    Score: <span className="text-red-600 font-medium">{attempt.score !== null ? `${attempt.score}%` : 'Grading...'}</span>
                    {' '}(needed {quiz.passThreshold}%)
                  </span>
                </div>
                <Badge variant="danger">Failed</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pending grade ────────────────────────────────────────────────────── */}
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
