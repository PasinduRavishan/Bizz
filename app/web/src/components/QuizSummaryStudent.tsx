'use client'

import type { ReactNode } from 'react'

/**
 * QuizSummaryStudent — A detailed modal showing the full lifecycle of a quiz attempt
 * or access request from the student's perspective, with per-step status indicators.
 *
 * Triggered by a 📋 button on each attempt/request card in the student dashboard.
 */

// ── Types ──────────────────────────────────────────────────────────────────

interface QuizAttempt {
  id: string
  contractId: string
  status: string
  score: number | null
  passed: boolean | null
  createdAt: string
  answerProofId?: string | null
  prizePaymentId?: string | null
  swapTxHex?: string | null
  prizeAmount?: string | null          // actual prize awarded (per-winner share)
  quiz: {
    id: string
    contractId: string
    title: string | null
    symbol: string
    questionCount: number
    passThreshold: number
    status: string
    prizePool: string
    prizePerWinner: string | null      // per-winner share (set at reveal)
    winnerCount?: number               // number of winners
    entryFee: string
    deadline?: string
  }
}

interface AccessRequest {
  id: string
  quizId: string
  status: string
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

interface Props {
  source: SummarySource
  onClose: () => void
  formatSats: (v: string | number) => string
  formatDate: (v: string) => string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StepRow({
  done,
  label,
  detail,
  skipped,
}: {
  done: boolean | 'na'
  label: string
  detail?: string
  skipped?: boolean
}) {
  const icon = done === 'na' ? '—' : done ? '✅' : '⏳'
  const textColor =
    done === 'na' || skipped
      ? 'text-gray-400 dark:text-gray-600'
      : done
      ? 'text-gray-900 dark:text-white'
      : 'text-gray-500 dark:text-gray-400'
  const iconColor =
    done === 'na' || skipped
      ? 'text-gray-300 dark:text-gray-700'
      : done
      ? 'text-green-500'
      : 'text-gray-400 dark:text-gray-500'

  return (
    <div className={`flex items-start gap-3 py-2 ${skipped ? 'opacity-50' : ''}`}>
      <span className={`text-base mt-0.5 ${iconColor}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${textColor}`}>{label}</span>
        {detail && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{detail}</span>
        )}
      </div>
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

function ResultBadge({ attempt }: { attempt: QuizAttempt }) {
  if (attempt.status === 'PRIZE_CLAIMED') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
        🎉 Prize Claimed
      </span>
    )
  }
  if (attempt.quiz.status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
        ⏳ Quiz In Progress
      </span>
    )
  }
  if (attempt.passed === true) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
        🏆 PASSED
      </span>
    )
  }
  if (attempt.passed === false) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        ❌ Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      ⏳ Awaiting Results
    </span>
  )
}

// ── Attempt Summary ────────────────────────────────────────────────────────

function AttemptSummary({
  attempt,
  formatSats,
  formatDate,
}: {
  attempt: QuizAttempt
  formatSats: (v: string | number) => string
  formatDate: (v: string) => string
}) {
  const quizRevealed = attempt.quiz.status === 'REVEALED' || attempt.quiz.status === 'COMPLETED'
  const answersSubmitted = attempt.status !== 'OWNED' // COMMITTED, VERIFIED, PRIZE_CLAIMED
  const resultVerified = attempt.status === 'VERIFIED' || attempt.status === 'PRIZE_CLAIMED'
  const hasProof = !!attempt.answerProofId
  const hasPayment = !!attempt.prizePaymentId
  const hasSwap = !!attempt.swapTxHex
  const prizeClaimed = attempt.status === 'PRIZE_CLAIMED'
  const isPassed = attempt.passed === true
  const isFailed = attempt.passed === false
  const now = new Date()
  const deadlinePassed = attempt.quiz.deadline ? new Date(attempt.quiz.deadline) < now : false

  // Resolve the effective per-student prize (per-winner share takes priority)
  const effectivePrize = attempt.prizeAmount ?? attempt.quiz.prizePerWinner ?? attempt.quiz.prizePool
  const isMultiWinner = (attempt.quiz.winnerCount ?? 1) > 1

  // Decide if prize steps are relevant
  const prizeRelevant = isPassed || resultVerified

  return (
    <>
      {/* Score Banner */}
      <div className={`p-4 rounded-xl mb-4 ${
        prizeClaimed
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : isFailed
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : attempt.quiz.status === 'ACTIVE'
          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          : 'bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <ResultBadge attempt={attempt} />
            {attempt.score !== null && attempt.quiz.status !== 'ACTIVE' && (
              <div className="mt-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Score: </span>
                <span className={`font-bold text-lg ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                  {attempt.score}%
                </span>
                <span className="text-gray-400 ml-2 text-xs">
                  (need {attempt.quiz.passThreshold}% to pass)
                </span>
              </div>
            )}
          </div>
          {isPassed && !prizeClaimed && (
            <div className="text-right text-sm">
              <div className="text-green-600 dark:text-green-400 font-bold">🏆 Prize Available</div>
              <div className="text-green-700 dark:text-green-300 text-lg font-bold">
                {formatSats(effectivePrize)} sats
              </div>
              {isMultiWinner && (
                <div className="text-xs text-indigo-500 mt-0.5">
                  {attempt.quiz.winnerCount} winners share equally
                </div>
              )}
            </div>
          )}
          {prizeClaimed && (
            <div className="text-right text-sm">
              <div className="text-green-600 dark:text-green-400 font-bold">Earned</div>
              <div className="text-green-700 dark:text-green-300 text-lg font-bold">
                {formatSats(effectivePrize)} sats
              </div>
              {isMultiWinner && (
                <div className="text-xs text-indigo-500 mt-0.5">
                  your share of {formatSats(attempt.quiz.prizePool)} sat pool
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Attempt Journey ─── */}
      <SectionHeading>Your Attempt Journey</SectionHeading>

      <StepRow
        done={true}
        label="Quiz Started"
        detail={formatDate(attempt.createdAt)}
      />
      <StepRow
        done={answersSubmitted}
        label="Answers Submitted"
        detail={answersSubmitted ? 'Commitment recorded on blockchain' : 'Not submitted yet'}
      />
      <StepRow
        done={deadlinePassed}
        label="Quiz Deadline Passed"
        detail={attempt.quiz.deadline ? formatDate(attempt.quiz.deadline) : 'No deadline'}
      />
      <StepRow
        done={quizRevealed}
        label="Teacher Revealed Answers"
        detail={quizRevealed ? 'Answers revealed and graded' : 'Waiting for teacher to reveal'}
      />
      <StepRow
        done={resultVerified}
        label="Result Verified on Blockchain"
        detail={
          resultVerified
            ? 'Blockchain verification complete'
            : quizRevealed && answersSubmitted
            ? 'Go to Verify Result to complete this step'
            : 'Waiting for quiz reveal first'
        }
      />

      {/* ── Prize Steps (only if passed or relevant) ─── */}
      {(prizeRelevant || isPassed) && (
        <>
          <SectionHeading>
            Prize Claim Steps {isPassed ? `— ${formatSats(effectivePrize)} sats${isMultiWinner ? ` (your share)` : ''}` : ''}
          </SectionHeading>

          <StepRow
            done={hasProof}
            label="Answer Proof Created"
            detail={hasProof ? 'Proof contract minted on blockchain' : 'Created when you verify your result'}
            skipped={isFailed}
          />
          <StepRow
            done={hasPayment}
            label="Prize Payment Ready"
            detail={hasPayment ? 'Teacher created your prize payment' : 'Waiting for teacher to create prize payment'}
            skipped={isFailed}
          />
          <StepRow
            done={hasSwap}
            label="Atomic Swap Prepared"
            detail={hasSwap ? 'Teacher set up the swap transaction' : 'Waiting for teacher to prepare swap'}
            skipped={isFailed}
          />
          <StepRow
            done={prizeClaimed}
            label="Swap Executed & Prize Claimed"
            detail={prizeClaimed
              ? `${formatSats(effectivePrize)} sats received in your wallet`
              : hasSwap
              ? 'Go to Claim Prize to execute the swap'
              : 'Waiting for swap to be prepared'}
            skipped={isFailed}
          />
        </>
      )}

      {isFailed && (
        <>
          <SectionHeading>Result</SectionHeading>
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            ❌ You did not pass this quiz. Better luck next time!
            {attempt.score !== null && (
              <span className="ml-2">Your score: {attempt.score}% (needed {attempt.quiz.passThreshold}%)</span>
            )}
          </div>
        </>
      )}

      {/* ── Quiz Info ─── */}
      <SectionHeading>Quiz Info</SectionHeading>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          { label: 'Questions', value: attempt.quiz.questionCount },
          { label: 'Pass Threshold', value: `${attempt.quiz.passThreshold}%` },
          { label: 'Entry Fee Paid', value: `${formatSats(attempt.quiz.entryFee)} sats` },
          {
            label: isMultiWinner ? 'Prize (Your Share)' : 'Prize Pool',
            value: isMultiWinner
              ? `${formatSats(effectivePrize)} sats (of ${formatSats(attempt.quiz.prizePool)})`
              : `${formatSats(attempt.quiz.prizePool)} sats`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800">
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="font-medium text-gray-900 dark:text-white">{value}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Request Summary ────────────────────────────────────────────────────────

function RequestSummary({
  request,
  formatSats,
  formatDate,
}: {
  request: AccessRequest
  formatSats: (v: string | number) => string
  formatDate: (v: string) => string
}) {
  const now = new Date()
  const deadlinePassed = request.quiz.deadline ? new Date(request.quiz.deadline) < now : false

  const isApproved = ['APPROVED', 'PAID', 'FEE_CLAIMED', 'STARTED'].includes(request.status)
  const isPaid = ['PAID', 'FEE_CLAIMED', 'STARTED'].includes(request.status)
  const isStarted = request.status === 'STARTED'

  const statusLabel: Record<string, { emoji: string; label: string; color: string }> = {
    PENDING: {
      emoji: '⏳',
      label: 'Awaiting Teacher Approval',
      color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
    },
    APPROVED: {
      emoji: '💳',
      label: 'Approved — Pay Entry Fee',
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
    },
    PAID: {
      emoji: '✅',
      label: 'Payment Confirmed — Ready to Start',
      color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
    },
    FEE_CLAIMED: {
      emoji: '🚀',
      label: 'Ready to Start',
      color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
    },
    STARTED: {
      emoji: '🎓',
      label: 'Quiz Started',
      color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300',
    },
  }

  const info = statusLabel[request.status] ?? {
    emoji: '📋', label: request.status, color: 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300',
  }

  return (
    <>
      {/* Status Banner */}
      <div className={`p-4 rounded-xl mb-4 border ${info.color}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{info.emoji}</span>
          <div>
            <div className="font-bold">{info.label}</div>
            <div className="text-xs mt-0.5 opacity-80">
              Entry Fee: {formatSats(request.quiz.entryFee)} sats
            </div>
          </div>
        </div>
      </div>

      {/* ── Your Journey ─── */}
      <SectionHeading>Your Journey</SectionHeading>

      <StepRow
        done={true}
        label="Requested Access"
        detail={formatDate(request.createdAt)}
      />
      <StepRow
        done={isApproved}
        label="Access Granted (Auto-Approved)"
        detail={isApproved && request.approvedAt ? formatDate(request.approvedAt) : 'Setting up automatically…'}
      />
      <StepRow
        done={isPaid}
        label="Entry Fee Paid"
        detail={
          isPaid && request.paidAt
            ? `${formatSats(request.quiz.entryFee)} sats paid on ${formatDate(request.paidAt)}`
            : isApproved
            ? `Pay ${formatSats(request.quiz.entryFee)} sats to unlock the quiz`
            : 'Waiting for access setup'
        }
      />
      <StepRow
        done={isStarted}
        label="Quiz Started"
        detail={
          isStarted && request.startedAt
            ? formatDate(request.startedAt)
            : isPaid
            ? 'Ready to start — click Start Quiz'
            : 'Complete payment to start'
        }
      />

      {/* ── Quiz Info ─── */}
      <SectionHeading>Quiz Info</SectionHeading>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          { label: 'Entry Fee', value: `${formatSats(request.quiz.entryFee)} sats` },
          {
            label: 'Deadline',
            value: request.quiz.deadline
              ? `${formatDate(request.quiz.deadline)}${deadlinePassed ? ' (Passed)' : ''}`
              : 'No deadline',
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800">
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="font-medium text-gray-900 dark:text-white">{value}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function QuizSummaryStudent({ source, onClose, formatSats, formatDate }: Props) {
  const title =
    source.type === 'attempt'
      ? source.data.quiz.title || `Quiz ${source.data.quiz.symbol}`
      : source.data.quiz.title || `Quiz ${source.data.quiz.symbol}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              📋 {source.type === 'attempt' ? 'Attempt' : 'Request'} Summary
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{title}</p>
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
          {source.type === 'attempt' ? (
            <AttemptSummary
              attempt={source.data}
              formatSats={formatSats}
              formatDate={formatDate}
            />
          ) : (
            <RequestSummary
              request={source.data}
              formatSats={formatSats}
              formatDate={formatDate}
            />
          )}
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
