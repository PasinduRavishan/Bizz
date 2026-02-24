'use client'

import type { ReactNode } from 'react'

/**
 * QuizSummaryTeacher — A detailed modal showing the full lifecycle of a quiz
 * from the teacher's perspective, with per-step status indicators.
 *
 * Triggered by a 📋 button on each quiz card in the teacher dashboard.
 */

interface QuizAttemptSummary {
  id: string
  status: string
  passed: boolean | null
  answerProofId: string | null
  prizePaymentId: string | null
  swapTxHex: string | null
}

interface AttemptSummary {
  id: string
  status: string
  score: number | null
  passed: boolean | null
}

interface AccessRequest {
  id: string
  quizId: string
  studentId: string
  status: string
  createdAt: string
  approvedAt?: string
  paidAt?: string
  feeClaimedAt?: string | null
  startedAt?: string
  attemptId?: string
  attempt?: AttemptSummary | null
  quiz: {
    id: string
    title: string | null
    symbol: string
    entryFee: string
  }
  student: {
    id: string
    name: string | null
    email: string
  }
}

interface Quiz {
  id: string
  contractId: string
  symbol: string
  title: string | null
  questionCount: number
  prizePool: string
  prizePerWinner?: string | null   // per-winner share (set at reveal time)
  winnerCount?: number             // number of passing students (set at reveal time)
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  createdAt: string
  attempts?: QuizAttemptSummary[]
  _count?: { attempts: number }
}

interface QuizWithRequests extends Quiz {
  requests: AccessRequest[]
}

interface Props {
  quiz: QuizWithRequests
  onClose: () => void
  onClaimFee: (requestId: string) => Promise<void>
  processingRequest: string | null
  formatSats: (v: string | number) => string
  formatDate: (v: string) => string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StepRow({
  done,
  label,
  detail,
  action,
  warn,
}: {
  done: boolean | 'warn'
  label: string
  detail?: string
  action?: ReactNode
  warn?: boolean
}) {
  const icon =
    done === 'warn' ? '⚠️'
    : done ? '✅'
    : '⏳'
  const iconClass =
    done === 'warn' ? 'text-amber-500'
    : done ? 'text-green-500'
    : 'text-gray-400 dark:text-gray-500'

  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`text-base mt-0.5 ${iconClass}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${done ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
          {label}
        </span>
        {detail && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{detail}</span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-5 mb-1 border-t border-gray-100 dark:border-gray-700 pt-4">
      {children}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function QuizSummaryTeacher({
  quiz,
  onClose,
  onClaimFee,
  processingRequest,
  formatSats,
  formatDate,
}: Props) {
  const now = new Date()
  const deadlinePassed = new Date(quiz.deadline) < now

  const requests = quiz.requests || []
  const attempts = quiz.attempts || []

  // Counts
  const pendingRequests = requests.filter(r => r.status === 'PENDING')
  const approvedRequests = requests.filter(r => r.status === 'APPROVED')
  const paidRequests = requests.filter(r =>
    r.status === 'PAID' || (r.status === 'STARTED' && !r.feeClaimedAt)
  )  // Fee not yet claimed (PAID or STARTED without feeClaimedAt)
  const feeClaimedRequests = requests.filter(r =>
    r.status === 'FEE_CLAIMED' || (r.status === 'STARTED' && !!r.feeClaimedAt)
  ) // Fee collected
  const startedRequests = requests.filter(r => r.status === 'STARTED')
  const committedRequests = requests.filter(r => r.attempt?.status === 'COMMITTED')

  const totalAttempts = attempts.length
  const passedAttempts = attempts.filter(a => a.passed === true)
  const failedAttempts = attempts.filter(a => a.passed === false)
  const pendingResultAttempts = attempts.filter(a => a.passed === null)

  // Winners and their prize state
  const winners = attempts.filter(a => a.passed === true)
  const winnersWithProof = winners.filter(a => a.answerProofId)
  const winnersWithPayment = winners.filter(a => a.prizePaymentId)
  const winnersWithSwap = winners.filter(a => a.swapTxHex)
  const winnersComplete = winners.filter(
    a => a.answerProofId && a.prizePaymentId && a.swapTxHex && a.status === 'PRIZE_CLAIMED'
  )

  // Helper: get student name for an attempt (via request match)
  const getStudentForAttempt = (attemptId: string) => {
    const req = requests.find(r => r.attemptId === attemptId)
    return req?.student?.name || req?.student?.email || 'Student'
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      REVEALED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    }
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${map[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    )
  }

  const requestStatusBadge = (status: string, attemptStatus?: string) => {
    if (status === 'STARTED' && attemptStatus === 'COMMITTED') {
      return <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">📝 Submitted</span>
    }
    const map: Record<string, string> = {
      PENDING:     'text-yellow-600 dark:text-yellow-400',
      APPROVED:    'text-blue-600 dark:text-blue-400',
      PAID:        'text-green-600 dark:text-green-400',
      FEE_CLAIMED: 'text-teal-600 dark:text-teal-400',
      STARTED:     'text-purple-600 dark:text-purple-400',
    }
    const labels: Record<string, string> = {
      PENDING: '⏳ Pending', APPROVED: '💳 Approved', PAID: '💰 Paid', FEE_CLAIMED: '✅ Fee Collected', STARTED: '🎓 Started',
    }
    return <span className={`text-xs font-medium ${map[status] || 'text-gray-500'}`}>{labels[status] || status}</span>
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📋 Quiz Summary
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                {quiz.title || `Quiz ${quiz.symbol}`}
              </span>
              {statusBadge(quiz.status)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4">

          {/* ── SECTION: Quiz Lifecycle ──────────────────────────── */}
          <SectionHeading>Quiz Lifecycle</SectionHeading>

          <StepRow
            done={true}
            label="Quiz Created"
            detail={formatDate(quiz.createdAt)}
          />
          <StepRow
            done={requests.length > 0}
            label={`Access Requests (${requests.length})`}
            detail={
              requests.length > 0
                ? [
                    pendingRequests.length > 0 && `${pendingRequests.length} pending`,
                    approvedRequests.length > 0 && `${approvedRequests.length} approved`,
                    paidRequests.length > 0 && `${paidRequests.length} paid`,
                    feeClaimedRequests.length > 0 && `${feeClaimedRequests.length} fee collected`,
                    startedRequests.length > 0 && `${startedRequests.length} started`,
                  ].filter(Boolean).join(' · ') || 'No requests yet'
                : 'No requests yet'
            }
          />
          <StepRow
            done={deadlinePassed}
            label="Quiz Deadline"
            detail={`${formatDate(quiz.deadline)}${deadlinePassed ? ' — Passed' : ' — Not yet reached'}`}
          />
          <StepRow
            done={quiz.status === 'REVEALED' || quiz.status === 'COMPLETED'}
            label="Answers Revealed & Graded"
            detail={
              quiz.status === 'ACTIVE'
                ? deadlinePassed
                  ? 'Deadline passed — ready to reveal'
                  : 'Quiz still active'
                : 'Answers revealed, scores computed'
            }
          />

          {/* ── SECTION: Entry Fees ─────────────────────────────── */}
          <SectionHeading>Entry Fees — {formatSats(quiz.entryFee)} sats per student</SectionHeading>

          {paidRequests.length > 0 && (
            <div className="mb-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-800 dark:text-green-300">
                    💰 {paidRequests.length} entry fee{paidRequests.length > 1 ? 's' : ''} ready to collect
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    Total available: {formatSats(paidRequests.length * parseInt(quiz.entryFee))} sats
                  </p>
                </div>
              </div>
            </div>
          )}

          {requests.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-2 italic">No students enrolled yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map(req => {
                const feeUnclaimed = req.status === 'PAID' || (req.status === 'STARTED' && !req.feeClaimedAt)
                const feeClaimed = req.status === 'FEE_CLAIMED' || (req.status === 'STARTED' && !!req.feeClaimedAt)
                const notPaidYet = req.status === 'PENDING' || req.status === 'APPROVED'

                return (
                  <div
                    key={req.id}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border text-sm ${
                      feeUnclaimed
                        ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800'
                        : feeClaimed
                        ? 'bg-teal-50 dark:bg-teal-900/15 border-teal-200 dark:border-teal-800'
                        : notPaidYet
                        ? 'bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700'
                        : 'bg-white dark:bg-zinc-800/40 border-gray-100 dark:border-zinc-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {req.student.name || req.student.email}
                      </span>
                      <span className="ml-2">
                        {requestStatusBadge(req.status, req.attempt?.status)}
                      </span>
                      {req.paidAt && (
                        <span className="ml-2 text-xs text-gray-400">Paid {formatDate(req.paidAt)}</span>
                      )}
                      {req.feeClaimedAt && (
                        <span className="ml-2 text-xs text-teal-600">Fee claimed {formatDate(req.feeClaimedAt)}</span>
                      )}
                    </div>
                    {/* Collect Fee button — for PAID or STARTED without feeClaimedAt */}
                    {feeUnclaimed && (
                      <button
                        type="button"
                        onClick={() => onClaimFee(req.id)}
                        disabled={processingRequest === req.id}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {processingRequest === req.id ? '⏳ Collecting...' : '💰 Collect Fee'}
                      </button>
                    )}
                    {/* Fee already collected */}
                    {feeClaimed && (
                      <span className="shrink-0 text-xs text-teal-600 dark:text-teal-400 font-medium">✅ Fee Collected</span>
                    )}
                    {notPaidYet && (
                      <span className="shrink-0 text-xs text-gray-400 italic">Not paid yet</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── SECTION: Quiz Results ───────────────────────────── */}
          <SectionHeading>Quiz Results</SectionHeading>

          {totalAttempts === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">No students have started the quiz yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="text-xl font-bold text-green-700 dark:text-green-400">{passedAttempts.length}</div>
                  <div className="text-xs text-green-600 dark:text-green-500">Passed 🏆</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">{failedAttempts.length}</div>
                  <div className="text-xs text-red-500 dark:text-red-400">Failed ❌</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                  <div className="text-xl font-bold text-gray-600 dark:text-gray-300">{pendingResultAttempts.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Pending ⏳</div>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                Answers submitted: {committedRequests.length} / {totalAttempts} students
              </div>
            </>
          )}

          {/* ── SECTION: Prize Distribution ─────────────────────── */}
          {(quiz.status === 'REVEALED' || quiz.status === 'COMPLETED' || passedAttempts.length > 0) && (
            <>
              <SectionHeading>
                Prize Distribution —{' '}
                {quiz.prizePerWinner && (quiz.winnerCount ?? 0) > 1
                  ? `${formatSats(quiz.prizePerWinner)} sats/winner × ${quiz.winnerCount} (pool: ${formatSats(quiz.prizePool)})`
                  : `${formatSats(quiz.prizePool)} sats per winner`}
              </SectionHeading>

              {winners.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-2">No winners yet (quiz not graded or no passes).</p>
              ) : (
                <div className="space-y-3">
                  {winners.map((winner, i) => {
                    const studentName = getStudentForAttempt(winner.id)
                    const hasProof = !!winner.answerProofId
                    const hasPayment = !!winner.prizePaymentId
                    const hasSwap = !!winner.swapTxHex
                    const isClaimed = winner.status === 'PRIZE_CLAIMED'

                    // Determine overall winner state
                    let overallStatus: 'complete' | 'student-action' | 'teacher-action' | 'waiting'
                    if (isClaimed) overallStatus = 'complete'
                    else if (hasProof && hasPayment && hasSwap) overallStatus = 'student-action'
                    else if (hasProof && !hasPayment) overallStatus = 'teacher-action'
                    else if (hasPayment && !hasSwap) overallStatus = 'teacher-action'
                    else overallStatus = 'waiting'

                    const statusColors = {
                      complete: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                      'student-action': 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                      'teacher-action': 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
                      waiting: 'bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700',
                    }

                    return (
                      <div key={winner.id} className={`p-3 rounded-lg border ${statusColors[overallStatus]}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white">
                            🏆 {studentName}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isClaimed ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            : overallStatus === 'teacher-action' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : overallStatus === 'student-action' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {isClaimed ? '✅ Prize Claimed'
                              : overallStatus === 'teacher-action' ? '⚡ Your Action Needed'
                              : overallStatus === 'student-action' ? '🔄 Waiting for Student'
                              : '⏳ Waiting'}
                          </span>
                        </div>

                        {/* Step checklist */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={hasProof ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}>
                              {hasProof ? '✅' : '⏳'}
                            </span>
                            <span className={hasProof ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}>
                              Answer Proof created by student
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={hasPayment ? 'text-green-500' : hasProof ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}>
                              {hasPayment ? '✅' : hasProof ? '⚡' : '⏳'}
                            </span>
                            <span className={hasPayment ? 'text-gray-700 dark:text-gray-300' : hasProof ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-400'}>
                              Prize Payment created {hasProof && !hasPayment ? '← Your action' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={hasSwap ? 'text-green-500' : hasPayment ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}>
                              {hasSwap ? '✅' : hasPayment ? '⚡' : '⏳'}
                            </span>
                            <span className={hasSwap ? 'text-gray-700 dark:text-gray-300' : hasPayment ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-400'}>
                              Swap TX created {hasPayment && !hasSwap ? '← Your action' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={isClaimed ? 'text-green-500' : hasSwap ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}>
                              {isClaimed ? '✅' : hasSwap ? '🔄' : '⏳'}
                            </span>
                            <span className={isClaimed ? 'text-gray-700 dark:text-gray-300' : hasSwap ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>
                              Student executes swap & receives prize {hasSwap && !isClaimed ? '← Waiting for student' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Overall prize summary */}
              {winners.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-center">
                  <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                    <div className="font-bold text-green-700 dark:text-green-400">{winnersComplete.length}/{winners.length}</div>
                    <div className="text-green-600 dark:text-green-500">Prizes Claimed</div>
                  </div>
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                    <div className="font-bold text-amber-700 dark:text-amber-400">
                      {winners.length - winnersComplete.length}
                    </div>
                    <div className="text-amber-600 dark:text-amber-500">Pending Distribution</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── SECTION: Quick Stats ────────────────────────────── */}
          <SectionHeading>Quiz Info</SectionHeading>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { label: 'Questions', value: quiz.questionCount },
              { label: 'Pass Threshold', value: `${quiz.passThreshold}%` },
              { label: 'Entry Fee', value: `${formatSats(quiz.entryFee)} sats` },
              { label: 'Prize Pool', value: `${formatSats(quiz.prizePool)} sats` },
              { label: 'Symbol', value: quiz.symbol },
              { label: 'Created', value: formatDate(quiz.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800">
                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 px-6 py-3 flex justify-end rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
