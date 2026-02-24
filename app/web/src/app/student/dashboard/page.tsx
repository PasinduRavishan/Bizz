'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletWidget } from '@/components/WalletWidget'
import { ToastContainer, useToast } from '@/components/ui/Toast'
import { apiService } from '@/services/api.service'
import { QuizSummaryStudent } from '@/components/QuizSummaryStudent'

interface QuizAttempt {
  id: string
  contractId: string
  status: string
  score: number | null
  passed: boolean | null
  createdAt: string
  // Prize-tracking fields (returned by backend but not previously declared in interface)
  answerProofId?: string | null
  prizePaymentId?: string | null
  swapTxHex?: string | null
  quiz: {
    id: string
    contractId: string
    title: string | null
    symbol: string
    questionCount: number
    passThreshold: number
    status: string
    prizePool: string
    prizePerWinner: string | null    // per-winner share (set at reveal time)
    winnerCount?: number             // number of winners
    entryFee: string
    deadline?: string
  }
}

interface AccessRequest {
  id: string
  quizId: string
  status: string  // PENDING | APPROVED | PAID | STARTED
  createdAt: string
  approvedAt?: string
  paidAt?: string
  startedAt?: string
  attemptId?: string
  quiz: {
    id: string
    title: string | null
    symbol: string
    entryFee: string
    deadline?: string
  }
}

type SummarySource =
  | { type: 'attempt'; data: QuizAttempt }
  | { type: 'request'; data: AccessRequest }

export default function StudentDashboard() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summarySource, setSummarySource] = useState<SummarySource | null>(null)
  const { toasts, showToast, removeToast } = useToast()

  useEffect(() => {
    fetchAll()
    // Auto-refresh every 15s so students see results appear as soon as auto-reveal completes
    const interval = setInterval(fetchAll, 15000)
    return () => clearInterval(interval)
  }, [])

  const fetchAll = async () => {
    try {
      setLoading(true)
      setError(null)

      const [attemptsData, requestsData] = await Promise.all([
        apiService.attempt.getMyAttempts(),
        apiService.accessRequest.getMyRequests().catch(() => ({ requests: [] })),
      ])

      setAttempts(attemptsData.attempts || [])
      const now = new Date()
      // Only show actionable requests:
      // - not STARTED (those have attempts shown in the attempts section)
      // - deadline not yet passed (no point showing "Pay & Start" when quiz is over)
      setRequests((requestsData.requests || []).filter(
        (r: AccessRequest) => {
          if (r.status === 'STARTED') return false
          if (r.quiz?.deadline && new Date(r.quiz.deadline) < now) return false
          return true
        }
      ))
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const formatSats = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    return num.toLocaleString()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getAttemptBadge = (attempt: QuizAttempt) => {
    // Prize claimed — always show this first
    if (attempt.status === 'PRIZE_CLAIMED') return <Badge variant="success">Prize Claimed 🎉</Badge>

    // Quiz still active — answers not graded yet
    if (attempt.quiz.status === 'ACTIVE') {
      const deadlinePassed = attempt.quiz.deadline && new Date(attempt.quiz.deadline) < new Date()
      if (attempt.status === 'COMMITTED') {
        if (deadlinePassed) return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Auto-Revealing...
          </span>
        )
        return <Badge variant="info">Submitted — Awaiting Results</Badge>
      }
      if (attempt.status === 'OWNED') return <Badge variant="default">In Progress</Badge>
      return <Badge variant="default">{attempt.status}</Badge>
    }

    // Quiz has been revealed
    // COMMITTED: needs blockchain verify step (regardless of pre-graded score in DB)
    if (attempt.status === 'COMMITTED') return <Badge variant="info">Needs Verification</Badge>

    // VERIFIED: blockchain verify done — show result
    if (attempt.status === 'VERIFIED') {
      if (attempt.passed === true) return <Badge variant="success">PASSED — Claim Prize 🏆</Badge>
      if (attempt.passed === false) return <Badge variant="danger">FAILED</Badge>
      return <Badge variant="info">VERIFIED</Badge>
    }

    // Fallback: use pre-graded DB values for display
    if (attempt.passed === true) return <Badge variant="success">PASSED 🏆</Badge>
    if (attempt.passed === false) return <Badge variant="danger">FAILED</Badge>
    return <Badge variant="default">{attempt.status}</Badge>
  }

  // Prize can only be claimed after the blockchain verify step (status === 'VERIFIED')
  // Pre-graded passed=true at reveal time is not enough — student must complete blockchain verify first
  const canClaimPrize = (attempt: QuizAttempt) =>
    attempt.status === 'VERIFIED' && attempt.passed === true && attempt.quiz.status === 'REVEALED'

  // Status display for access requests
  // NOTE: PENDING status no longer shows in the actionable list since auto-approval
  // is instant. If a PENDING request is ever shown, it means approval is still in
  // progress (e.g. network delay). Show a helpful "setting up" message.
  const requestStatusInfo = (status: string) => {
    const map: Record<string, { emoji: string; label: string; description: string; color: string }> = {
      PENDING:  {
        emoji: '⚙️', label: 'Setting Up',
        description: 'Access is being set up automatically — this should be instant!',
        color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
      },
      APPROVED: {
        emoji: '💳', label: 'Pay Entry Fee',
        description: 'Access ready! Pay the entry fee to receive your quiz token',
        color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
      },
      PAID: {
        emoji: '✅', label: 'Ready to Start',
        description: 'Entry fee confirmed. Start the quiz to begin!',
        color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
      },
      FEE_CLAIMED: {
        emoji: '🚀', label: 'Ready to Start',
        description: 'All set! Start the quiz whenever you\'re ready.',
        color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
      },
    }
    return map[status] ?? {
      emoji: '📋', label: status, description: '',
      color: 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
    }
  }

  // Actionable requests: APPROVED → pay fee, PAID/FEE_CLAIMED → start quiz
  // PENDING is transient (auto-approve is near-instant) but keep it for edge cases
  const actionableRequests = requests.filter(r => ['PENDING', 'APPROVED', 'PAID', 'FEE_CLAIMED'].includes(r.status))
  const readyToAct = actionableRequests.filter(r => ['APPROVED', 'PAID', 'FEE_CLAIMED'].includes(r.status))

  // Attempts summary
  const passed = attempts.filter(a => a.passed === true).length
  const pending = attempts.filter(a => a.passed === null).length

  // Attempts where the quiz deadline has passed but quiz is still ACTIVE (auto-reveal in progress)
  const awaitingAutoReveal = attempts.filter(
    a =>
      a.status === 'COMMITTED' &&
      a.quiz.status === 'ACTIVE' &&
      a.quiz.deadline &&
      new Date(a.quiz.deadline) < new Date()
  )

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Quiz Summary Modal */}
      {summarySource && (
        <QuizSummaryStudent
          source={summarySource}
          onClose={() => setSummarySource(null)}
          formatSats={formatSats}
          formatDate={formatDate}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Track your quiz requests, attempts, and prizes</p>
      </div>

      {/* Wallet */}
      <div className="mb-6">
        <WalletWidget />
      </div>

      {/* Browse Button */}
      <div className="mb-6">
        <Link href="/student/browse">
          <Button size="lg">🎯 Browse Quizzes</Button>
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Data</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={fetchAll}>Try Again</Button>
          </CardBody>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* ===== SECTION 1: Actionable Requests ===== */}
          {actionableRequests.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                📬 Active Quiz Requests
                {readyToAct.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    {readyToAct.length} action needed
                  </span>
                )}
              </h2>
              <div className="space-y-3">
                {actionableRequests.map(req => {
                  const info = requestStatusInfo(req.status)
                  return (
                    <Card key={req.id} className={`border ${info.color}`}>
                      <CardBody>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xl">{info.emoji}</span>
                              <h3 className="font-bold text-gray-900 dark:text-white">
                                {req.quiz.title || `Quiz ${req.quiz.symbol}`}
                              </h3>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${info.color}`}>
                                {info.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{info.description}</p>
                            <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span>Entry Fee: {formatSats(req.quiz.entryFee)} sats</span>
                              <span>Requested: {formatDate(req.createdAt)}</span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            {/* Summary button */}
                            <button
                              type="button"
                              onClick={() => setSummarySource({ type: 'request', data: req })}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium"
                            >
                              📋 Summary
                            </button>
                            {req.status === 'PENDING' && (
                              <span className="text-sm text-blue-600 dark:text-blue-400 italic flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                Setting up...
                              </span>
                            )}
                            {req.status === 'APPROVED' && (
                              <Link href={`/student/take/${req.quizId}`}>
                                <Button variant="primary" size="sm">
                                  💳 Pay Entry Fee
                                </Button>
                              </Link>
                            )}
                            {(req.status === 'PAID' || req.status === 'FEE_CLAIMED') && (
                              <Link href={`/student/take/${req.quizId}`}>
                                <Button variant="primary" size="sm">
                                  🚀 Start Quiz
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )
                })}
              </div>
            </section>
          )}

          {/* Auto-reveal in-progress banner */}
          {awaitingAutoReveal.length > 0 && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-600 rounded-xl p-4 flex items-start gap-3">
              <span className="relative flex h-3 w-3 mt-0.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-amber-800 dark:text-amber-200">
                  {awaitingAutoReveal.length === 1
                    ? `"${awaitingAutoReveal[0].quiz.title || awaitingAutoReveal[0].quiz.symbol}" is being auto-revealed`
                    : `${awaitingAutoReveal.length} quiz results are being auto-revealed`}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  Answers are being revealed automatically. Your results will appear here in a moment — this page refreshes every 15 seconds.
                </p>
              </div>
            </div>
          )}

          {/* ===== SECTION 2: Quiz Attempts ===== */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📝 My Attempts</h2>

            {attempts.length === 0 ? (
              <Card>
                <CardBody className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Attempts Yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Browse quizzes and take your first quiz</p>
                  <Link href="/student/browse"><Button>Browse Quizzes</Button></Link>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-4">
                {attempts.map(attempt => (
                  <Card key={attempt.id} hover>
                    <CardBody>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                              {attempt.quiz.title || `Quiz ${attempt.quiz.symbol}`}
                            </h3>
                            {getAttemptBadge(attempt)}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Questions: </span>
                              <span className="font-medium">{attempt.quiz.questionCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Score: </span>
                              <span className={`font-medium ${
                                attempt.quiz.status === 'ACTIVE' ? 'text-gray-900 dark:text-white'
                                : attempt.passed === true ? 'text-green-600'
                                : attempt.passed === false ? 'text-red-600'
                                : 'text-gray-900 dark:text-white'
                              }`}>
                                {attempt.quiz.status === 'ACTIVE' ? 'Pending reveal' : attempt.score !== null ? `${attempt.score}%` : 'Pending'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Pass Needed: </span>
                              <span className="font-medium">{attempt.quiz.passThreshold}%</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Prize: </span>
                              <span className="font-medium text-green-600">
                                {formatSats(attempt.quiz.prizePerWinner ?? attempt.quiz.prizePool)} sats
                              </span>
                              {(attempt.quiz.winnerCount ?? 0) > 1 && (
                                <span className="ml-1 text-xs text-gray-400">/{attempt.quiz.winnerCount} winners</span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Attempted: {formatDate(attempt.createdAt)}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {/* Summary button always shown */}
                          <button
                            type="button"
                            onClick={() => setSummarySource({ type: 'attempt', data: attempt })}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium"
                          >
                            📋 Summary
                          </button>
                          <div className="flex gap-2">
                            {attempt.status === 'PRIZE_CLAIMED' ? (
                              // Already done
                              <Button variant="outline" disabled>✅ Prize Claimed</Button>
                            ) : attempt.quiz.status === 'ACTIVE' ? (
                              // Quiz still running — check if deadline passed (auto-reveal in progress)
                              attempt.quiz.deadline && new Date(attempt.quiz.deadline) < new Date() ? (
                                <Button variant="outline" disabled className="border-amber-400 text-amber-700 dark:text-amber-300">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                    </span>
                                    Auto-Revealing...
                                  </span>
                                </Button>
                              ) : (
                                <Button variant="outline" disabled>⏳ Awaiting Results</Button>
                              )
                            ) : attempt.quiz.status === 'REVEALED' && attempt.status === 'COMMITTED' ? (
                              // Quiz revealed + student has committed answers → must do blockchain verify first
                              <Link href={`/student/prize/${attempt.id}`}>
                                <Button variant="primary">🎯 Verify Result</Button>
                              </Link>
                            ) : canClaimPrize(attempt) ? (
                              // Blockchain verified + passed → proceed with prize claiming steps
                              <Link href={`/student/prize/${attempt.id}`}>
                                <Button variant="primary">🏆 Claim Prize</Button>
                              </Link>
                            ) : attempt.status === 'VERIFIED' && attempt.passed === false ? (
                              // Verified but didn't pass
                              <Button variant="outline" disabled>❌ Not Passed</Button>
                            ) : (
                              <Button variant="outline" disabled>{attempt.status}</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Summary Stats (only if has attempts) */}
          {attempts.length > 0 && (
            <div className="mt-8 grid md:grid-cols-3 gap-4">
              <Card>
                <CardBody className="text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Attempts</div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">{attempts.length}</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Passed (Won)</div>
                  <div className="text-3xl font-bold text-green-600">{passed}</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pending Results</div>
                  <div className="text-3xl font-bold text-blue-600">{pending}</div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Completely empty state */}
          {actionableRequests.length === 0 && attempts.length === 0 && (
            <Card>
              <CardBody className="text-center py-16">
                <div className="text-6xl mb-4">🎓</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ready to Start?</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Browse available quizzes and win Bitcoin!</p>
                <Link href="/student/browse">
                  <Button size="lg">🎯 Browse Quizzes</Button>
                </Link>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </main>
  )
}
