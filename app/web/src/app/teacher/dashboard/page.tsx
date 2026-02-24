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
  prizePerWinner: string | null   // per-winner share (set at reveal time)
  winnerCount: number             // number of passing students (set at reveal time)
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
// Quiz Detail Modal — shows request statuses + collect fee buttons only
// No approve buttons (auto-approved). No reveal button (auto-revealed).
// ──────────────────────────────────────────────────────────────────────────
function QuizDetailModal({
  quiz,
  onClose,
  onClaim,
  processingRequest,
  formatSats,
  formatDate,
}: {
  quiz: QuizWithRequests
  onClose: () => void
  onClaim: (id: string) => void
  processingRequest: string | null
  formatSats: (s: string | number) => string
  formatDate: (s: string) => string
}) {
  const router = useRouter()
  const isDeadlinePassed = new Date() >= new Date(quiz.deadline)

  const approved = quiz.requests.filter(r => r.status === 'APPROVED').length
  const paid = quiz.requests.filter(r => r.status === 'PAID').length
  const started = quiz.requests.filter(r => r.status === 'STARTED').length
  const feeClaimed = quiz.requests.filter(r => r.feeClaimedAt).length
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
              {isDeadlinePassed && (
                <span className="ml-2 text-xs text-gray-400">(Auto-reveal in progress)</span>
              )}
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
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Prize Pool (sats)</div>
            {quiz.prizePerWinner && quiz.winnerCount > 1 && (
              <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                {formatSats(quiz.prizePerWinner)}/winner × {quiz.winnerCount}
              </div>
            )}
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
            Student Pipeline
          </h3>
          <div className="flex gap-3 text-xs flex-wrap">
            {approved > 0 && <span className="text-blue-600 font-medium">💳 {approved} awaiting payment</span>}
            {paid > 0 && <span className="text-green-600 font-medium">✅ {paid} ready to collect</span>}
            {started > 0 && <span className="text-purple-600 font-medium">🎓 {started} in progress</span>}
            {submitted > 0 && <span className="text-indigo-600 font-medium">📝 {submitted} answers submitted</span>}
            {feeClaimed > 0 && <span className="text-teal-600 font-medium">💰 {feeClaimed} fees collected</span>}
            {quiz.requests.length === 0 && <span className="text-gray-400">No students yet</span>}
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
                      <div className="text-xs text-indigo-600 mt-0.5 font-medium">📝 Answers submitted</div>
                    )}
                  </div>
                  <div className="shrink-0">
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
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => router.push(`/teacher/reveal/${quiz.id}`)}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm"
          >
            📊 View Results
          </button>
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
// Status Chip helpers
// ──────────────────────────────────────────────────────────────────────────
function RequestStatusChip({
  status,
  attemptStatus,
}: {
  status: string
  attemptStatus?: string
}) {
  if (status === 'STARTED' && attemptStatus === 'COMMITTED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
        📝 Answers Submitted
      </span>
    )
  }

  const map: Record<string, { label: string; classes: string }> = {
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
    // Refresh every 15s when any quiz is pending auto-reveal, otherwise every 30s
    const interval = setInterval(() => {
      fetchData()
    }, 15000)
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

  const handleClaimEntryFee = async (requestId: string) => {
    try {
      setProcessingRequest(requestId)
      await apiService.accessRequest.claim(requestId)
      await fetchData()
      showToast('Entry fee claimed successfully! 💰', 'success')
    } catch (err) {
      showToast('Failed to claim: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error')
    } finally {
      setProcessingRequest(null)
    }
  }

  // Collect ALL unclaimed entry fees for a quiz at once
  const handleClaimAllFees = async (quizId: string, unclaimedRequestIds: string[]) => {
    if (unclaimedRequestIds.length === 0) return
    try {
      setClaimingAllFor(quizId)
      let claimed = 0
      for (const reqId of unclaimedRequestIds) {
        try {
          await apiService.accessRequest.claim(reqId)
          claimed++
        } catch (err) {
          showToast(
            `Fee ${claimed + 1}/${unclaimedRequestIds.length} failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            'error'
          )
        }
      }
      await fetchData()
      if (claimed > 0) {
        showToast(`${claimed} entry fee${claimed > 1 ? 's' : ''} collected! 🎉`, 'success')
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

  // Quizzes currently being auto-revealed (ACTIVE + deadline passed)
  const revealingQuizzes = quizzes.filter(q => q.status === 'ACTIVE' && isDeadlinePassed(q.deadline))

  const quizzesWithRequests: QuizWithRequests[] = quizzes.map(quiz => ({
    ...quiz,
    requests: requests.filter(r => r.quizId === quiz.id),
  }))

  // isFeeUnclaimed: PAID (awaiting collection) OR STARTED but fee not yet claimed
  const isFeeUnclaimed = (r: AccessRequest) =>
    (r.status === 'PAID' || (r.status === 'STARTED' && !r.feeClaimedAt))
  const claimableCount = requests.filter(isFeeUnclaimed).length
  const totalAttempts = quizzes.reduce((s, q) => s + (q._count?.attempts || 0), 0)

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
        <p className="text-gray-600 dark:text-gray-400">
          Create quizzes and collect entry fees — everything else happens automatically
        </p>
      </div>

      {/* Wallet */}
      <div className="mb-6">
        <WalletWidget />
      </div>

      {/* Global Stats */}
      {!loading && (
        <>
          {/* Auto-revealing quizzes banner */}
          {revealingQuizzes.length > 0 && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-600 rounded-xl p-4 flex items-start gap-3">
              <span className="relative flex h-3 w-3 mt-0.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-amber-800 dark:text-amber-200">
                  {revealingQuizzes.length === 1
                    ? `"${revealingQuizzes[0].title || revealingQuizzes[0].symbol}" is being auto-revealed`
                    : `${revealingQuizzes.length} quizzes are being auto-revealed`}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  Deadline passed — answers will be revealed automatically. Results appear here once done.
                </p>
              </div>
            </div>
          )}

          {/* Unclaimed entry fees banner */}
          {claimableCount > 0 && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-600 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <p className="font-bold text-green-800 dark:text-green-200">
                  {claimableCount} unclaimed entry fee{claimableCount > 1 ? 's' : ''} ready to collect
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                  Students have paid their entry fees. Use the "Collect All" button on each quiz to receive your sats.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{quizzes.length}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quizzes</div>
                <div className="text-xs text-green-600 mt-0.5">{quizzes.filter(q => q.status === 'ACTIVE').length} active</div>
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
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalAttempts}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Attempts</div>
                <div className="text-xs text-purple-600 mt-0.5">across all quizzes</div>
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
            const quizClaimable = quiz.requests.filter(r =>
              r.status === 'PAID' || (r.status === 'STARTED' && !r.feeClaimedAt)
            ).length
            const quizApproved = quiz.requests.filter(r => r.status === 'APPROVED').length
            const quizStarted = quiz.requests.filter(r => r.status === 'STARTED').length
            const quizSubmitted = quiz.requests.filter(
              r => r.status === 'STARTED' && r.attempt?.status === 'COMMITTED'
            ).length
            const totalReqs = quiz.requests.length

            return (
              <Card key={quiz.id} className="overflow-hidden">
                {/* Card Header: clickable to expand */}
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
                          {quiz.prizePerWinner && quiz.winnerCount > 1 && (
                            <span className="ml-1 text-xs text-indigo-500">
                              ({formatSats(quiz.prizePerWinner)}/winner × {quiz.winnerCount})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Entry: </span>
                          <span className="font-medium text-gray-900 dark:text-white">{formatSats(quiz.entryFee)} sats</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Students: </span>
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
                      {totalReqs > 0 && (
                        <div className="flex gap-3 mt-2 text-xs flex-wrap">
                          {quizApproved > 0 && <span className="text-blue-600">💳 {quizApproved} awaiting payment</span>}
                          {quizClaimable > 0 && <span className="text-green-600">✅ {quizClaimable} paid</span>}
                          {quizStarted > 0 && <span className="text-purple-600">🎓 {quizStarted} started</span>}
                          {quizSubmitted > 0 && <span className="text-indigo-600">📝 {quizSubmitted} submitted</span>}
                        </div>
                      )}

                      {/* Auto-reveal banner */}
                      {quiz.status === 'ACTIVE' && isDeadlinePassed(quiz.deadline) && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                          </span>
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                            Auto-revealing answers — results will appear shortly
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Summary + Details buttons */}
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
                          <Button variant="outline" size="sm">👥 Students</Button>
                        </div>
                      </div>

                      {/* Collect All Entry Fees button */}
                      {quizClaimable > 0 && (
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

                      {/* View Results — always shown for non-ACTIVE or post-deadline */}
                      <div role="none" onClick={e => e.stopPropagation()}>
                        <Link href={`/teacher/reveal/${quiz.id}`}>
                          <Button variant="outline" size="sm">
                            📊 View Results
                          </Button>
                        </Link>
                      </div>

                      {/* Expand chevron */}
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? '▲ Collapse' : `▼ Students (${totalReqs})`}
                      </span>
                    </div>
                  </CardHeader>
                </div>

                {/* Expanded student request list */}
                {isExpanded && (
                  <CardBody className="border-t border-gray-100 dark:border-gray-700 pt-4 pb-4">
                    {quiz.requests.length === 0 ? (
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                        No students enrolled yet.
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
                                    📝 Answers submitted
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0">
                                {req.status === 'APPROVED' && (
                                  <span className="text-xs text-blue-500 dark:text-blue-400 italic">
                                    Awaiting payment...
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
