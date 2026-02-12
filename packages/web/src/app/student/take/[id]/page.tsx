'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface Quiz {
  id: string
  contractId: string
  symbol: string
  title: string | null
  description: string | null
  questionCount: number
  questionHashIPFS: string
  prizePool: string
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  teacher: {
    id: string
    name: string | null
  }
}

interface Question {
  question: string
  options: string[]
}

type FlowStep =
  | 'loading-quiz'
  | 'confirm-purchase'
  | 'requesting-attempt'
  | 'preparing-access'
  | 'completing-access'
  | 'taking-quiz'
  | 'submitting-answers'
  | 'complete'
  | 'error'

export default function TakeQuizPage() {
  const params = useParams()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [flowStep, setFlowStep] = useState<FlowStep>('loading-quiz')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(3600)
  const [error, setError] = useState<string | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  // Fetch quiz data
  const fetchQuiz = useCallback(async () => {
    try {
      setStatusMessage('Loading quiz details...')
      const response = await fetch(`/api/quizzes/${quizId}`)
      const data = await response.json()

      if (data.success && data.quiz) {
        const quizData = data.quiz

        // Check if deadline has passed
        const now = new Date()
        const deadline = new Date(quizData.deadline)
        if (now >= deadline) {
          setError('Quiz deadline has passed. You can no longer take this quiz.')
          setFlowStep('error')
          return
        }

        // Check if quiz is active
        if (quizData.status !== 'ACTIVE') {
          setError(`This quiz is not accepting attempts (status: ${quizData.status})`)
          setFlowStep('error')
          return
        }

        setQuiz(quizData)

        // Try to load questions from IPFS
        if (quizData.questionHashIPFS) {
          try {
            setStatusMessage('Fetching questions from IPFS...')
            const { fetchQuestionsFromIPFS } = await import('@/lib/ipfs')
            const ipfsQuestions = await fetchQuestionsFromIPFS(quizData.questionHashIPFS)

            if (ipfsQuestions && ipfsQuestions.length > 0) {
              setQuestions(ipfsQuestions)
              setFlowStep('confirm-purchase')
              return
            }
          } catch (ipfsError) {
            console.error('Failed to fetch from IPFS:', ipfsError)
          }
        }

        setError('Quiz questions not available. Please contact the quiz creator.')
        setFlowStep('error')
      } else {
        setError('Quiz not found')
        setFlowStep('error')
      }
    } catch (err) {
      console.error('Error fetching quiz:', err)
      setError('Failed to load quiz')
      setFlowStep('error')
    }
  }, [quizId])

  useEffect(() => {
    fetchQuiz()
  }, [fetchQuiz])

  // Timer countdown
  useEffect(() => {
    if (flowStep !== 'taking-quiz') return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [flowStep])

  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }))
  }

  // Step 2 & 3: Request attempt, prepare access, complete access (purchase with entry fee)
  const handlePurchaseAttempt = async () => {
    if (!quiz) return

    try {
      // Step 2: Request attempt
      setFlowStep('requesting-attempt')
      setStatusMessage('Creating quiz attempt...')
      setError(null)

      const requestResponse = await fetch('/api/student/attempt/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id  // Database ID, not contractId
        })
      })

      const requestResult = await requestResponse.json()
      if (!requestResult.success) {
        setError(requestResult.error || 'Failed to create attempt')
        setFlowStep('error')
        return
      }

      const createdAttemptId = requestResult.attemptId
      setAttemptId(createdAttemptId)

      // Step 3a: Prepare quiz access
      setFlowStep('preparing-access')
      setStatusMessage('Preparing quiz access transaction...')

      const prepareResponse = await fetch('/api/student/quiz-access/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id })  // Database ID
      })

      const prepareResult = await prepareResponse.json()
      if (!prepareResult.success) {
        setError(prepareResult.error || 'Failed to prepare access')
        setFlowStep('error')
        return
      }

      // Step 3b: Complete quiz access (EXEC with entry fee)
      setFlowStep('completing-access')
      setStatusMessage('Completing access with entry fee payment...')

      const completeResponse = await fetch('/api/student/quiz-access/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,  // Database ID
          attemptId: createdAttemptId,
          partialExecTx: prepareResult.partialExecTx
        })
      })

      const completeResult = await completeResponse.json()
      if (!completeResult.success) {
        setError(completeResult.error || 'Failed to complete access')
        setFlowStep('error')
        return
      }

      // Access granted! Start taking quiz
      setFlowStep('taking-quiz')
    } catch (err) {
      console.error('Purchase error:', err)
      setError(err instanceof Error ? err.message : 'Failed to purchase attempt')
      setFlowStep('error')
    }
  }

  // Step 4: Submit answers
  const handleSubmitAnswers = async () => {
    if (!quiz || !attemptId) return

    setFlowStep('submitting-answers')
    setStatusMessage('Submitting your answers...')
    setError(null)

    try {
      // Convert answers to string array (option text)
      const answerStrings = questions.map((q, index) => {
        const selectedOption = answers[index]
        return selectedOption !== undefined ? q.options[selectedOption] : ''
      })

      const response = await fetch('/api/student/attempt/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          answers: answerStrings
        })
      })

      const result = await response.json()

      if (result.success) {
        setFlowStep('complete')
      } else {
        setError(result.error || 'Failed to submit answers')
        setFlowStep('error')
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit')
      setFlowStep('error')
    }
  }

  const allAnswered = Object.keys(answers).length === questions.length && questions.length > 0

  const formatSatoshis = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    return num.toLocaleString()
  }

  // Loading State
  if (flowStep === 'loading-quiz') {
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
  if (flowStep === 'error' || !quiz) {
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
            <Link href="/student/browse">
              <Button>Back to Browse</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Confirm Purchase Step
  if (flowStep === 'confirm-purchase') {
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
            {quiz.teacher && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                by {quiz.teacher.name || 'Anonymous Teacher'}
              </p>
            )}
          </CardHeader>

          <CardBody className="space-y-6">
            {/* Quiz Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Quiz Details</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {quiz.questionCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Pass Threshold:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {quiz.passThreshold}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Prize Pool:</span>
                  <span className="font-semibold text-green-600">
                    {formatSatoshis(quiz.prizePool)} sats
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Entry Fee:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatSatoshis(quiz.entryFee)} sats
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Deadline:</span>
                  <span className="font-semibold text-orange-600">
                    {new Date(quiz.deadline).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">How it works:</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">1.</span>
                  <span>Pay {formatSatoshis(quiz.entryFee)} sats entry fee to purchase quiz attempt</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">2.</span>
                  <span>Answer all {quiz.questionCount} questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">3.</span>
                  <span>Your answers are hashed and committed to the blockchain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">4.</span>
                  <span>Teacher reveals correct answers after deadline</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">5.</span>
                  <span>
                    If you score ≥{quiz.passThreshold}%, you win a share of the {formatSatoshis(quiz.prizePool)} sats prize pool!
                  </span>
                </li>
              </ul>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Entry fee is non-refundable. Make sure to complete the quiz before the deadline.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Link href="/student/browse" className="flex-1">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button onClick={handlePurchaseAttempt} className="flex-1">
                Pay {formatSatoshis(quiz.entryFee)} sats & Start
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    )
  }

  // Processing Steps (requesting, preparing, completing)
  if (['requesting-attempt', 'preparing-access', 'completing-access'].includes(flowStep)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Purchasing Quiz Attempt
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

  // Taking Quiz
  if (flowStep === 'taking-quiz') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
        <header className="border-b bg-white dark:bg-zinc-800 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {quiz.title || quiz.symbol}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.keys(answers).length} of {questions.length} answered
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Time remaining</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            {questions.map((q, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white flex-1">
                      {q.question}
                    </h3>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="space-y-2">
                    {q.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        onClick={() => handleAnswer(index, optionIndex)}
                        className={`
                          w-full text-left px-4 py-3 rounded-lg border-2 transition-all
                          ${
                            answers[index] === optionIndex
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-zinc-700 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`
                            w-5 h-5 rounded-full border-2 flex items-center justify-center
                            ${
                              answers[index] === optionIndex
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-gray-300 dark:border-zinc-600'
                            }
                          `}
                          >
                            {answers[index] === optionIndex && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                          <span className="text-gray-900 dark:text-white">{option}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* Submit Button */}
          <div className="sticky bottom-0 bg-white dark:bg-zinc-800 border-t mt-8 -mx-4 px-4 py-4">
            <div className="container mx-auto max-w-4xl">
              <Button onClick={handleSubmitAnswers} disabled={!allAnswered} size="lg" className="w-full">
                {allAnswered
                  ? 'Submit Answers to Blockchain'
                  : `Answer all questions (${Object.keys(answers).length}/${questions.length})`}
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Submitting
  if (flowStep === 'submitting-answers') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Submitting to Blockchain
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

  // Complete
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
      <Card className="max-w-2xl">
        <CardBody className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✓</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Answers Submitted Successfully!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Your answers have been committed to the blockchain.
          </p>
          {attemptId && (
            <p className="text-sm text-gray-500 dark:text-gray-500 font-mono mb-6">
              Attempt ID: {attemptId.substring(0, 20)}...
            </p>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6 text-left">
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">What Happens Next:</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">1.</span>
                <span>Wait for the quiz deadline to pass</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">2.</span>
                <span>Teacher will reveal correct answers and grade all attempts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">3.</span>
                <span>Results will be calculated automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">4.</span>
                <span>If you pass ({quiz.passThreshold}%+), you can claim your prize!</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Link href="/student/dashboard" className="flex-1">
              <Button variant="outline" className="w-full">
                View My Attempts
              </Button>
            </Link>
            <Link href="/student/browse" className="flex-1">
              <Button className="w-full">Browse More Quizzes</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
