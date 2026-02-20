'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletWidget } from '@/components/WalletWidget'
import { ToastContainer, useToast } from '@/components/ui/Toast'
import { apiService } from '@/services/api.service'
import { useAuthStore } from '@/stores/authStore'
import { QuizSummaryTeacher } from '@/components/QuizSummaryTeacher'

interface QuizAttemptSummary {
  id: string
  status: string
  passed: boolean | null
  answerProofId: string | null
  prizePaymentId: string | null
  swapTxHex: string | null
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
  createdAt: string
  attempts?: QuizAttemptSummary[]
  _count?: {
    attempts: number
  }
}

// Returns the number of winners who are waiting for a teacher prize action
function getPrizeActionCount(attempts: QuizAttemptSummary[] = []): number {
  return attempts.filter(a => {
    if (a.passed !== true) return false
    // Has AnswerProof but no Prize Payment yet → teacher must create payment
    if (a.answerProofId && !a.prizePaymentId) return true
    // Has Prize Payment but no Swap TX yet → teacher must create swap TX
    if (a.prizePaymentId && !a.swapTxHex) return true
    return false
  }).length
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

interface QuizWithRequests extends Quiz {
  requests: AccessRequest[]
}

// ──────────────────────────────────────────────────────────────────────────
// Quiz Detail Modal
// ──────────────────────────────────────────────────────────────────────────
function QuizDetailModal({
  quiz,
  onClose,
  onApprove,
  onClaim,
  processingRequest,
  formatSats,
  formatDate,
}: {
  quiz: QuizWithRequests
  onClose: () => void
  onApprove: (id: string) => void
  onClaim: (id: string) => void
  processingRequest: string | null
  formatSats: (s: string | number) => string
  formatDate: (s: string) => string
}) {
  const router = useRouter()
  const isDeadlinePassed = new Date() >= new Date(quiz.deadline)
  const canReveal = quiz.status === 'ACTIVE' && isDeadlinePassed

  const pending = quiz.requests.filter(r => r.status === 'PENDING').length
  const approved = quiz.requests.filter(r => r.status === 'APPROVED').length
  const paid = quiz.requests.filter(r => r.status === 'PAID').length
  const started = quiz.requests.filter(r => r.status === 'STARTED').length
  const submitted = quiz.requests.filter(
    r => r.status === 'STARTED' && r.attempt?.status === 'COMMITTED'
  ).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {quiz.title || `Quiz ${quiz.symbol}`}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Deadline: <span className={isDeadlinePassed ? 'text-red-500 font-medium' : ''}>
                {formatDate(quiz.deadline)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 p-6 border-b border-gray-200 dark:border-zinc-700">
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.questionCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Questions</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{formatSats(quiz.prizePool)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Prize (sats)</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{formatSats(quiz.entryFee)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Entry Fee (sats)</div>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.passThreshold}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pass Threshold</div>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{quiz._count?.attempts || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Attempts</div>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{submitted}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Answers Submitted</div>
          </div>
        </div>

        {/* Request pipeline summary */}
        <div className="px-6 pt-4 pb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm uppercase tracking-wider">
            Request Pipeline
          </h3>
          <div className="flex gap-3 text-xs flex-wrap">
            {pending > 0 && <span className="text-yellow-600 font-medium">⏳ {pending} pending approval</span>}
            {approved > 0 && <span className="text-blue-600 font-medium">💳 {approved} awaiting payment</span>}
            {paid > 0 && <span className="text-green-600 font-medium">✅ {paid} ready to collect</span>}
            {started > 0 && <span className="text-purple-600 font-medium">🎓 {started} in progress</span>}
            {submitted > 0 && <span className="text-indigo-600 font-medium">📝 {submitted} answers submitted</span>}
            {quiz.requests.length === 0 && <span className="text-gray-400">No requests yet</span>}
          </div>
        </div>

        {/* Per-request list */}
        <div className="px-6 pb-4 space-y-2 mt-2">
          {quiz.requests.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No access requests for this quiz yet.
            </p>
          ) : (
            quiz.requests.map(req => {
              const attemptStatus = req.attempt?.status
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {req.student.name || 'Unknown'}
                      </span>
                      <RequestStatusChip status={req.status} attemptStatus={attemptStatus} />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {req.student.email} · {formatDate(req.createdAt)}
                    </div>
                    {req.paidAt && (
                      <div className="text-xs text-green-600 mt-0.5">Paid {formatDate(req.paidAt)}</div>
                    )}
                    {req.startedAt && (
                      <div className="text-xs text-purple-600 mt-0.5">Started {formatDate(req.startedAt)}</div>
                    )}
                    {attemptStatus === 'COMMITTED' && (
                      <div className="text-xs text-indigo-600 mt-0.5 font-medium">📝 Answers submitted — awaiting reveal</div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {req.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => onApprove(req.id)}
                        disabled={processingRequest === req.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
                      >
                        {processingRequest === req.id ? '⏳' : 'Approve'}
                      </button>
                    )}
                    {req.status === 'APPROVED' && (
                      <span className="text-xs text-blue-500 italic">Waiting payment...</span>
                    )}
                    {(req.status === 'PAID' || (req.status === 'STARTED' && !req.feeClaimedAt)) && (
                      <button
                        type="button"
                        onClick={() => onClaim(req.id)}
                        disabled={processingRequest === req.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {processingRequest === req.id ? '⏳' : '💰 Collect Fee'}
                      </button>
                    )}
                    {(req.status === 'FEE_CLAIMED' || (req.status === 'STARTED' && req.feeClaimedAt)) && (
                      <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">✅ Fee Collected</span>
                    )}
                    {req.status === 'STARTED' && req.feeClaimedAt && attemptStatus === 'COMMITTED' && (
                      <span className="text-xs text-indigo-500 font-medium ml-2">Submitted</span>
                    )}
                    {req.status === 'STARTED' && req.feeClaimedAt && attemptStatus !== 'COMMITTED' && (
                      <span className="text-xs text-purple-400 italic ml-2">In progress</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-zinc-700">
          {canReveal ? (
            <button
              type="button"
              onClick={() => router.push(`/teacher/reveal/${quiz.id}`)}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 text-sm"
            >
              🎯 Reveal & Grade
            </button>
          ) : quiz.status !== 'ACTIVE' ? (
            <button
              type="button"
              onClick={() => router.push(`/teacher/reveal/${quiz.id}`)}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm"
            >
              View Results
            </button>
          ) : (
            <div className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-400 text-center text-sm">
              ⏳ Deadline not reached yet
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Status Chip helpers (standalone functions to avoid nested component defs)
// ──────────────────────────────────────────────────────────────────────────
function RequestStatusChip({
  status,
  attemptStatus,
}: {
  status: string
  attemptStatus?: string
}) {
  // Special case: STARTED + COMMITTED = student submitted answers
  if (status === 'STARTED' && attemptStatus === 'COMMITTED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
        📝 Answers Submitted
      </span>
    )
  }

  const map: Record<string, { label: string; classes: string }> = {
    PENDING:     { label: '⏳ Awaiting Approval',  classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
    APPROVED:    { label: '💳 Waiting Payment',    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    PAID:        { label: '💰 Ready to Collect',   classes: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    FEE_CLAIMED: { label: '✅ Fee Collected',      classes: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
    STARTED:     { label: '🎓 Quiz Started',        classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  }
  const chip = map[status] ?? { label: status, classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${chip.classes}`}>
      {chip.label}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  const [expandedQuizIds, setExpandedQuizIds] = useState<Set<string>>(new Set())
  const [selectedQuiz, setSelectedQuiz] = useState<QuizWithRequests | null>(null)
  const [summaryQuiz, setSummaryQuiz] = useState<QuizWithRequests | null>(null)
  const [claimingAllFor, setClaimingAllFor] = useState<string | null>(null)
  const { toasts, showToast, removeToast } = useToast()
  const { user } = useAuthStore()

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [quizzesData, requestsData] = await Promise.all([
        apiService.quiz.getAll({ teacherId: user?.id }),
        apiService.accessRequest.getPendingRequests(),
      ])

      setQuizzes(quizzesData.quizzes || [])
      setRequests(requestsData.requests || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    try {
      setProcessingRequest(requestId)
      await apiService.accessRequest.approve(requestId)
      await fetchData()
      showToast('Request approved! Student can now pay entry fee.', 'success')
    } catch (err) {
      showToast('Failed to approve: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error')
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleClaimEntryFee = async (requestId: string) => {
    try {
      setProcessingRequest(requestId)
      await apiService.accessRequest.claim(requestId)
      await fetchData()
      showToast('Entry fee claimed successfully!', 'success')
    } catch (err) {
      showToast('Failed to claim: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error')
    } finally {
      setProcessingRequest(null)
    }
  }

  // Collect ALL entry fees for a quiz (called after deadline passes)
  const handleClaimAllFees = async (quizId: string, paidRequestIds: string[]) => {
    if (paidRequestIds.length === 0) return
    try {
      setClaimingAllFor(quizId)
      let claimed = 0
      for (const reqId of paidRequestIds) {
        try {
          await apiService.accessRequest.claim(reqId)
          claimed++
        } catch (err) {
          showToast(
            `Fee ${claimed + 1}/${paidRequestIds.length} failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            'error'
          )
        }
      }
      await fetchData()
      if (claimed > 0) {
        showToast(`${claimed} entry fee${claimed > 1 ? 's' : ''} collected successfully! 🎉`, 'success')
      }
    } finally {
      setClaimingAllFor(null)
    }
  }

  const toggleQuizExpand = (quizId: string) => {
    setExpandedQuizIds(prev => {
      const next = new Set(prev)
      if (next.has(quizId)) next.delete(quizId)
      else next.add(quizId)
      return next
    })
  }

  const formatSats = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    if (isNaN(num)) return '0'
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

  const isDeadlinePassed = (deadline: string) => new Date() >= new Date(deadline)
  const canReveal = (quiz: Quiz) => quiz.status === 'ACTIVE' && isDeadlinePassed(quiz.deadline)

  const quizzesWithRequests: QuizWithRequests[] = quizzes.map(quiz => ({
    ...quiz,
    requests: requests.filter(r => r.quizId === quiz.id),
  }))

  // Global stats
  const pendingCount = requests.filter(r => r.status === 'PENDING').length
  // Claimable = PAID (not yet started) OR STARTED but fee not yet claimed
  const isFeeUnclaimed = (r: AccessRequest) =>
    (r.status === 'PAID' || (r.status === 'STARTED' && !r.feeClaimedAt))
  const claimableCount = requests.filter(isFeeUnclaimed).length
  const totalAttempts = quizzes.reduce((s, q) => s + (q._count?.attempts || 0), 0)
  const totalPrize = quizzes.reduce((s, q) => s + parseInt(q.prizePool || '0'), 0)
  const prizeActionCount = quizzes.reduce((s, q) => s + getPrizeActionCount(q.attempts), 0)

  const QuizStatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, 'success' | 'info' | 'default' | 'danger'> = {
      ACTIVE: 'success',
      REVEALED: 'info',
      COMPLETED: 'default',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Quiz Detail Modal */}
      {selectedQuiz && (
        <QuizDetailModal
          quiz={selectedQuiz}
          onClose={() => setSelectedQuiz(null)}
          onApprove={handleApproveRequest}
          onClaim={handleClaimEntryFee}
          processingRequest={processingRequest}
          formatSats={formatSats}
          formatDate={formatDate}
        />
      )}

      {/* Quiz Summary Modal */}
      {summaryQuiz && (
        <QuizSummaryTeacher
          quiz={summaryQuiz}
          onClose={() => setSummaryQuiz(null)}
          onClaimFee={handleClaimEntryFee}
          processingRequest={processingRequest}
          formatSats={formatSats}
          formatDate={formatDate}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Teacher Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your quizzes, approve requests, and reveal answers</p>
      </div>

      {/* Wallet */}
      <div className="mb-6">
        <WalletWidget />
      </div>

      {/* Global Stats */}
      {!loading && (
        <>
          {/* Prize action banner — shown prominently when winners are waiting */}
          {prizeActionCount > 0 && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-600 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-bold text-amber-800 dark:text-amber-200">
                  {prizeActionCount} winner{prizeActionCount > 1 ? 's' : ''} waiting for prize payment
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  Go to the quiz results page to create Prize Payments and Swap TXs for your winners.
                </p>
              </div>
            </div>
          )}

          {/* Unclaimed entry fees banner — shown when students have paid but teacher hasn't collected */}
          {claimableCount > 0 && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-600 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <p className="font-bold text-green-800 dark:text-green-200">
                  {claimableCount} unclaimed entry fee{claimableCount > 1 ? 's' : ''} ready to collect
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                  Students have paid their entry fees. Click "Collect Fee" on each quiz to receive your sats.
                  After the quiz deadline passes, use the "Collect All" button for bulk collection.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{quizzes.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quizzes</div>
                <div className="text-xs text-green-600 mt-0.5">{quizzes.filter(q => q.status === 'ACTIVE').length} active</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className={`text-3xl font-bold ${pendingCount > 0 ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
                  {pendingCount}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Need Approval</div>
                <div className="text-xs text-gray-400 mt-0.5">pending requests</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className={`text-3xl font-bold ${claimableCount > 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                  {claimableCount}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ready to Collect</div>
                <div className="text-xs text-gray-400 mt-0.5">entry fees paid</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className={`text-2xl font-bold ${prizeActionCount > 0 ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
                  {prizeActionCount > 0 ? prizeActionCount : totalAttempts}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {prizeActionCount > 0 ? 'Prize Pending' : 'Total Attempts'}
                </div>
                <div className="text-xs text-purple-600 mt-0.5">
                  {prizeActionCount > 0 ? 'winners need payment' : `${formatSats(totalPrize)} sats prize`}
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {/* Create Button */}
      <div className="mb-6">
        <Link href="/teacher/create">
          <Button size="lg" className="gap-2">✨ Create New Quiz</Button>
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-16">
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
            <Button onClick={fetchData}>Try Again</Button>
          </CardBody>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && quizzes.length === 0 && (
        <Card>
          <CardBody className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Quizzes Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first quiz to get started</p>
            <Link href="/teacher/create">
              <Button size="lg">Create Quiz</Button>
            </Link>
          </CardBody>
        </Card>
      )}

      {/* Per-Quiz Cards */}
      {!loading && !error && quizzesWithRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Quizzes</h2>

          {quizzesWithRequests.map(quiz => {
            const isExpanded = expandedQuizIds.has(quiz.id)
            const quizPending = quiz.requests.filter(r => r.status === 'PENDING').length
            const quizClaimable = quiz.requests.filter(r =>
              r.status === 'PAID' || (r.status === 'STARTED' && !r.feeClaimedAt)
            ).length
            const quizApproved = quiz.requests.filter(r => r.status === 'APPROVED').length
            const quizStarted = quiz.requests.filter(r => r.status === 'STARTED').length
            const quizSubmitted = quiz.requests.filter(
              r => r.status === 'STARTED' && r.attempt?.status === 'COMMITTED'
            ).length
            const totalReqs = quiz.requests.length
            const quizPrizeWaiting = getPrizeActionCount(quiz.attempts)

            return (
              <Card key={quiz.id} className="overflow-hidden">
                {/* ── Card Header: clickable div (NOT a button) to avoid nesting ── */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  className="w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  onClick={() => toggleQuizExpand(quiz.id)}
                  onKeyDown={e => e.key === 'Enter' && toggleQuizExpand(quiz.id)}
                >
                  <CardHeader className="flex items-start justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    {/* Left: Quiz Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                          {quiz.title || `Quiz ${quiz.symbol}`}
                        </h3>
                        <QuizStatusBadge status={quiz.status} />
                        {quizPending > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            {quizPending} pending
                          </span>
                        )}
                        {quizClaimable > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-300 dark:border-green-600">
                            💰 {quizClaimable} fee{quizClaimable > 1 ? 's' : ''} to collect
                          </span>
                        )}
                        {quizSubmitted > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            {quizSubmitted} submitted
                          </span>
                        )}
                        {quizPrizeWaiting > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-600 animate-pulse">
                            ⚡ {quizPrizeWaiting} prize pending
                          </span>
                        )}
                      </div>

                      {/* Key stats */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Questions: </span>
                          <span className="font-medium text-gray-900 dark:text-white">{quiz.questionCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Prize: </span>
                          <span className="font-medium text-green-600">{formatSats(quiz.prizePool)} sats</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Entry: </span>
                          <span className="font-medium text-gray-900 dark:text-white">{formatSats(quiz.entryFee)} sats</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Requests: </span>
                          <span className="font-medium text-blue-600">{totalReqs}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Deadline: </span>
                          <span className={`font-medium ${isDeadlinePassed(quiz.deadline) ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {formatDate(quiz.deadline)}
                          </span>
                        </div>
                      </div>

                      {/* Mini pipeline */}
                      {(totalReqs > 0 || quizPrizeWaiting > 0) && (
                        <div className="flex gap-3 mt-2 text-xs flex-wrap">
                          {quizPending > 0 && <span className="text-yellow-600">⏳ {quizPending} pending</span>}
                          {quizApproved > 0 && <span className="text-blue-600">💳 {quizApproved} approved</span>}
                          {quizClaimable > 0 && <span className="text-green-600">✅ {quizClaimable} paid</span>}
                          {quizStarted > 0 && <span className="text-purple-600">🎓 {quizStarted} started</span>}
                          {quizSubmitted > 0 && <span className="text-indigo-600">📝 {quizSubmitted} submitted</span>}
                          {quizPrizeWaiting > 0 && <span className="text-amber-600 font-semibold">⚡ {quizPrizeWaiting} winner{quizPrizeWaiting > 1 ? 's' : ''} need prize payment</span>}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions (stop propagation so quiz expand isn't triggered) */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Top row: Summary + Details */}
                      <div className="flex items-center gap-2">
                        <div
                          role="none"
                          onClick={e => {
                            e.stopPropagation()
                            setSummaryQuiz(quiz)
                          }}
                        >
                          <Button variant="outline" size="sm">📋 Summary</Button>
                        </div>
                        <div
                          role="none"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedQuiz(quiz)
                          }}
                        >
                          <Button variant="outline" size="sm">👥 Requests</Button>
                        </div>
                      </div>

                      {/* Collect All Entry Fees — prominent after deadline passes */}
                      {quizClaimable > 0 && isDeadlinePassed(quiz.deadline) && (
                        <div role="none" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={claimingAllFor === quiz.id}
                            onClick={() =>
                              handleClaimAllFees(
                                quiz.id,
                                quiz.requests.filter(r =>
                                  r.status === 'PAID' || (r.status === 'STARTED' && !r.feeClaimedAt)
                                ).map(r => r.id)
                              )
                            }
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-semibold flex items-center gap-1.5"
                          >
                            {claimingAllFor === quiz.id ? (
                              <>⏳ Collecting...</>
                            ) : (
                              <>💰 Collect {quizClaimable} Fee{quizClaimable > 1 ? 's' : ''}</>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Collect note — before deadline */}
                      {quizClaimable > 0 && !isDeadlinePassed(quiz.deadline) && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          💰 {quizClaimable} fee{quizClaimable > 1 ? 's' : ''} ready (via Requests)
                        </span>
                      )}

                      {/* Primary reveal / results action */}
                      {canReveal(quiz) ? (
                        <div role="none" onClick={e => e.stopPropagation()}>
                          <Link href={`/teacher/reveal/${quiz.id}`}>
                            <Button variant="primary" size="sm">🎯 Reveal & Grade</Button>
                          </Link>
                        </div>
                      ) : quiz.status !== 'ACTIVE' ? (
                        <div role="none" onClick={e => e.stopPropagation()}>
                          <Link href={`/teacher/reveal/${quiz.id}`}>
                            <Button
                              variant={quizPrizeWaiting > 0 ? 'primary' : 'outline'}
                              size="sm"
                            >
                              {quizPrizeWaiting > 0 ? `⚡ Pay ${quizPrizeWaiting} Winner${quizPrizeWaiting > 1 ? 's' : ''}` : 'View Results'}
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">⏳ Deadline not reached</span>
                      )}

                      {/* Expand chevron */}
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? '▲ Collapse' : `▼ Requests (${totalReqs})`}
                      </span>
                    </div>
                  </CardHeader>
                </div>

                {/* Expanded request list */}
                {isExpanded && (
                  <CardBody className="border-t border-gray-100 dark:border-gray-700 pt-4 pb-4">
                    {quiz.requests.length === 0 ? (
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                        No access requests yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {quiz.requests.map(req => {
                          const attemptStatus = req.attempt?.status
                          return (
                            <div
                              key={req.id}
                              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                                    {req.student.name || 'Unknown'}
                                  </span>
                                  <RequestStatusChip status={req.status} attemptStatus={attemptStatus} />
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {req.student.email} · {formatDate(req.createdAt)}
                                </div>
                                {req.paidAt && (
                                  <div className="text-xs text-green-600 mt-0.5">
                                    Paid {formatDate(req.paidAt)}
                                  </div>
                                )}
                                {req.startedAt && (
                                  <div className="text-xs text-purple-600 mt-0.5">
                                    Started {formatDate(req.startedAt)}
                                  </div>
                                )}
                                {attemptStatus === 'COMMITTED' && (
                                  <div className="text-xs text-indigo-600 mt-0.5 font-medium">
                                    📝 Answers submitted — awaiting reveal
                                  </div>
                                )}
                              </div>

                              {/* Action buttons — plain buttons, no Link wrapping */}
                              <div className="shrink-0">
                                {req.status === 'PENDING' && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); handleApproveRequest(req.id) }}
                                    disabled={processingRequest === req.id}
                                    className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
                                  >
                                    {processingRequest === req.id ? '⏳ Approving...' : 'Approve'}
                                  </button>
                                )}
                                {req.status === 'APPROVED' && (
                                  <span className="text-xs text-blue-500 dark:text-blue-400 italic">
                                    Waiting for payment...
                                  </span>
                                )}
                                {(req.status === 'PAID' || (req.status === 'STARTED' && !req.feeClaimedAt)) && (
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); handleClaimEntryFee(req.id) }}
                                    disabled={processingRequest === req.id}
                                    className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 font-medium"
                                  >
                                    {processingRequest === req.id ? '⏳ Collecting...' : '💰 Collect Fee'}
                                  </button>
                                )}
                                {req.status === 'FEE_CLAIMED' && (
                                  <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">✅ Fee Collected</span>
                                )}
                                {req.status === 'STARTED' && req.feeClaimedAt && attemptStatus === 'COMMITTED' && (
                                  <span className="text-xs text-indigo-500 font-medium">Submitted</span>
                                )}
                                {req.status === 'STARTED' && req.feeClaimedAt && attemptStatus !== 'COMMITTED' && (
                                  <span className="text-xs text-purple-400 italic">In progress</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardBody>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
