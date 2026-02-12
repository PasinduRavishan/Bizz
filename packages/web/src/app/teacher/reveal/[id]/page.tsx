'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

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
  attempts: Array<{
    id: string
    contractId: string
    status: string
    score: number | null
    passed: boolean | null
    student: {
      id: string
      name: string | null
    }
  }>
}

type PageStep = 'loading' | 'waiting' | 'ready' | 'revealing' | 'complete' | 'already_revealed' | 'error'

export default function TeacherRevealPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [currentStep, setCurrentStep] = useState<PageStep>('loading')
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  const fetchQuiz = useCallback(async () => {
    try {
      setStatusMessage('Loading quiz details...')
      const response = await fetch(`/api/quizzes/${quizId}`)
      const data = await response.json()

      if (data.success && data.quiz) {
        const quizData = data.quiz
        setQuiz(quizData)

        // Check if already revealed
        if (quizData.status === 'REVEALED' || quizData.revealedAnswers) {
          setCurrentStep('already_revealed')
          return
        }

        // Check if deadline has passed
        const now = new Date()
        const deadline = new Date(quizData.deadline)
        if (now < deadline) {
          setCurrentStep('waiting')
          return
        }

        // Ready to reveal
        setCurrentStep('ready')
      } else {
        setError('Quiz not found')
        setCurrentStep('error')
      }
    } catch (err) {
      console.error('Error fetching quiz:', err)
      setError('Failed to load quiz')
      setCurrentStep('error')
    }
  }, [quizId])

  useEffect(() => {
    fetchQuiz()
  }, [fetchQuiz])

  const handleReveal = async () => {
    if (!quiz) return

    try {
      setCurrentStep('revealing')
      setStatusMessage('Revealing correct answers...')
      setError(null)

      const response = await fetch(`/api/teacher/quiz/${quizId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const result = await response.json()

      if (result.success) {
        setStatusMessage('Grading all attempts...')
        // Refresh quiz data to get updated attempts
        await fetchQuiz()
        setCurrentStep('complete')
      } else {
        setError(result.error || 'Failed to reveal and grade')
        setCurrentStep('error')
      }
    } catch (err) {
      console.error('Reveal error:', err)
      setError(err instanceof Error ? err.message : 'Failed to reveal')
      setCurrentStep('error')
    }
  }

  const formatSatoshis = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    return num.toLocaleString()
  }

  const getDeadlineCountdown = (deadline: string) => {
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diff = deadlineDate.getTime() - now.getTime()

    if (diff < 0) return 'Deadline passed'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days} day${days > 1 ? 's' : ''} remaining`
    }

    return `${hours}h ${minutes}m remaining`
  }

  // Loading State
  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{statusMessage}</p>
        </div>
      </div>
    )
  }

  // Error State
  if (currentStep === 'error' || !quiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">❌</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {error || 'Quiz Not Found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || "This quiz doesn't exist or has been removed"}
            </p>
            <Link href="/teacher/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Waiting for Deadline
  if (currentStep === 'waiting') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {quiz.title || `Quiz ${quiz.symbol}`}
              </h1>
              <Badge variant="success">ACTIVE</Badge>
            </div>
          </CardHeader>

          <CardBody className="text-center py-12">
            <div className="text-6xl mb-4">⏰</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Waiting for Deadline
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You can reveal answers and grade attempts after the quiz deadline
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Time remaining:
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {getDeadlineCountdown(quiz.deadline)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Deadline: {new Date(quiz.deadline).toLocaleString()}
              </div>
            </div>

            <div className="text-left bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Questions: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {quiz.questionCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Attempts: </span>
                  <span className="font-medium text-blue-600">
                    {quiz.attempts?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Prize Pool: </span>
                  <span className="font-medium text-green-600">
                    {formatSatoshis(quiz.prizePool)} sats
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Pass Threshold: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {quiz.passThreshold}%
                  </span>
                </div>
              </div>
            </div>

            <Link href="/teacher/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Ready to Reveal
  if (currentStep === 'ready') {
    return (
      <main className="container mx-auto px-4 py-8 max-w-3xl">
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
            <div className="text-center py-6">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Ready to Reveal & Grade
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                The quiz deadline has passed. Click below to reveal answers and grade all attempts.
              </p>
            </div>

            {/* Quiz Stats */}
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-6">
              <h4 className="font-bold text-gray-900 dark:text-white mb-4">Quiz Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Questions: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {quiz.questionCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Attempts: </span>
                  <span className="font-medium text-blue-600">
                    {quiz.attempts?.length || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Prize Pool: </span>
                  <span className="font-medium text-green-600">
                    {formatSatoshis(quiz.prizePool)} sats
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Pass Threshold: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {quiz.passThreshold}%
                  </span>
                </div>
              </div>
            </div>

            {/* What Happens */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">What happens when you reveal:</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">1.</span>
                  <span>Correct answers will be revealed on the blockchain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">2.</span>
                  <span>All {quiz.attempts?.length || 0} attempts will be automatically graded</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">3.</span>
                  <span>Winners (score ≥ {quiz.passThreshold}%) will be identified</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">4.</span>
                  <span>Winners can claim their share of the prize pool</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Link href="/teacher/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button onClick={handleReveal} className="flex-1">
                🎯 Reveal & Grade All Attempts
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Revealing (Processing)
  if (currentStep === 'revealing') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Revealing & Grading
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{statusMessage}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              This may take 30-60 seconds
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Already Revealed or Complete
  const passedAttempts = quiz.attempts?.filter(a => a.passed) || []
  const failedAttempts = quiz.attempts?.filter(a => a.passed === false) || []

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {quiz.title || `Quiz ${quiz.symbol}`}
            </h1>
            <Badge variant="info">REVEALED</Badge>
          </div>
        </CardHeader>

        <CardBody className="space-y-6">
          {/* Success Message */}
          {currentStep === 'complete' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6 text-center">
              <div className="text-5xl mb-3">✅</div>
              <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
                Quiz Revealed & Graded Successfully!
              </h3>
              <p className="text-green-700 dark:text-green-300">
                All attempts have been graded. Winners can now claim their prizes.
              </p>
            </div>
          )}

          {/* Results Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardBody className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Attempts
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {quiz.attempts?.length || 0}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Passed (Winners)
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {passedAttempts.length}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Failed
                </div>
                <div className="text-3xl font-bold text-red-600">
                  {failedAttempts.length}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Winners List */}
          {passedAttempts.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                🏆 Winners ({passedAttempts.length})
              </h3>
              <div className="space-y-2">
                {passedAttempts.map((attempt) => (
                  <Card key={attempt.id}>
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {attempt.student.name || `Student ${attempt.student.id.slice(0, 8)}`}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Score: {attempt.score}% (Passed)
                          </div>
                        </div>
                        <Badge variant="success">PASSED</Badge>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Failed Attempts */}
          {failedAttempts.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Failed Attempts ({failedAttempts.length})
              </h3>
              <div className="space-y-2">
                {failedAttempts.map((attempt) => (
                  <Card key={attempt.id}>
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {attempt.student.name || `Student ${attempt.student.id.slice(0, 8)}`}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Score: {attempt.score}% (Needed {quiz.passThreshold}%)
                          </div>
                        </div>
                        <Badge variant="danger">FAILED</Badge>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Back Button */}
          <Link href="/teacher/dashboard">
            <Button variant="outline" className="w-full">
              Back to Dashboard
            </Button>
          </Link>
        </CardBody>
      </Card>
    </main>
  )
}
