'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { submitAttempt } from '@/services/attempt-service'

interface Quiz {
  id: string
  contractId: string
  contractRev: string
  title: string | null
  questionCount: number
  prizePool: string
  entryFee: string
  passThreshold: number
  status: string
  deadline: string
  teacher: {
    address: string
  }
}

interface Question {
  question: string
  options: string[]
  correctAnswer?: number // Only available for locally stored quizzes
}

type CurrentStep = 'loading' | 'confirm' | 'taking' | 'submitting' | 'complete' | 'error'

export default function TakeQuizPage() {
  const params = useParams()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentStep, setCurrentStep] = useState<CurrentStep>('loading')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(3600)
  const [error, setError] = useState<string | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)

  // Fetch quiz data from API
  const fetchQuiz = useCallback(async () => {
    try {
      const response = await fetch(`/api/quizzes?id=${quizId}`)
      const data = await response.json()

      if (data.success && data.data && data.data.length > 0) {
        const quizData = data.data[0]
        
        // Check if deadline has passed
        const now = new Date()
        const deadline = new Date(quizData.deadline)
        if (now >= deadline) {
          setError('Quiz deadline has passed. You can no longer take this quiz.')
          setCurrentStep('error')
          return
        }

        // Check if quiz is active
        if (quizData.status !== 'ACTIVE') {
          setError(`This quiz is not accepting attempts (status: ${quizData.status})`)
          setCurrentStep('error')
          return
        }

        setQuiz(quizData)

        // Production approach: Try database first, then IPFS as backup
        console.log('📚 Loading quiz questions...')
        
        // 1. Try to get questions from database (most reliable)
        if (quizData.questions && Array.isArray(quizData.questions) && quizData.questions.length > 0) {
          console.log('✅ Loaded questions from database')
          setQuestions(quizData.questions)
          setCurrentStep('confirm')
          return
        }
        
        // 2. Try IPFS if available
        if (quizData.questionHashIPFS) {
          console.log('📡 Attempting to fetch from IPFS:', quizData.questionHashIPFS)
          try {
            const { fetchQuestionsFromIPFS } = await import('@/lib/ipfs')
            const ipfsQuestions = await fetchQuestionsFromIPFS(quizData.questionHashIPFS)
            
            if (ipfsQuestions && ipfsQuestions.length > 0) {
              console.log('✅ Loaded questions from IPFS')
              setQuestions(ipfsQuestions)
              setCurrentStep('confirm')
              return
            }
          } catch (ipfsError) {
            console.error('⚠️ Failed to fetch from IPFS:', ipfsError)
          }
        }
        
        // 3. Last resort: error state (no placeholders in production)
        console.error('❌ No questions found in database or IPFS')
        setError('Quiz questions not available. Please contact the quiz creator.')
        setCurrentStep('error')
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

  // Timer countdown effect
  useEffect(() => {
    if (currentStep !== 'taking') return

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
  }, [currentStep])

  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }))
  }

  const handleStartQuiz = async () => {
    if (!quiz) return
    setCurrentStep('taking')
  }

  const handleSubmit = async () => {
    if (!quiz) return

    setCurrentStep('submitting')
    setError(null)

    try {
      // Convert answers to string array (option text)
      const answerStrings = questions.map((q, index) => {
        const selectedOption = answers[index]
        return selectedOption !== undefined ? q.options[selectedOption] : ''
      })

      const result = await submitAttempt({
        quizId: quiz.contractId,
        quizRev: quiz.contractRev,
        answers: answerStrings,
        entryFee: parseInt(quiz.entryFee)
      })

      if (result.success && result.attemptId) {
        setAttemptId(result.attemptId)
        // Store answers and nonce for reveal phase
        if (result.nonce) {
          localStorage.setItem(`attempt_${result.attemptId}`, JSON.stringify({
            answers: answerStrings,
            nonce: result.nonce,
            quizId: quiz.contractId,
            timestamp: Date.now()
          }))
          console.log('Stored attempt data for reveal:', result.attemptId)
        }
        setCurrentStep('complete')
      } else {
        setError(result.error || 'Failed to submit attempt')
        setCurrentStep('error')
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit')
      setCurrentStep('error')
    }
  }

  const allAnswered = Object.keys(answers).length === questions.length && questions.length > 0

  const formatSatoshis = (sats: string | number) => {
    const num = typeof sats === 'string' ? parseInt(sats) : sats
    return (num / 100000000).toFixed(5)
  }

  // Loading State
  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading quiz...</p>
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
            <Link href="/student/browse">
              <Button>Back to Browse</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Confirm Step
  if (currentStep === 'confirm') {
    return (
      <div>
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {quiz.title || `Quiz ${quiz.contractId.slice(0, 8)}...`}
                </h1>
                <Badge variant="success">ACTIVE</Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                by {quiz.teacher?.address?.slice(0, 8)}...{quiz.teacher?.address?.slice(-6)}
              </p>
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
                      {formatSatoshis(quiz.prizePool)} LTC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Entry Fee:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatSatoshis(quiz.entryFee)} LTC
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

              {/* Rules */}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">How it works:</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">1.</span>
                    <span>Pay the entry fee to start the quiz</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">2.</span>
                    <span>Answer all questions before the deadline</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">3.</span>
                    <span>Your answers are hashed and committed to the blockchain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">4.</span>
                    <span>After the deadline, reveal your answers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">5.</span>
                    <span>
                      If you score &ge;{quiz.passThreshold}%, you&apos;ll win a share of the prize
                      pool!
                    </span>
                  </li>
                </ul>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Entry fee is non-refundable. Make sure to reveal your answers after the
                  deadline or you&apos;ll forfeit your entry.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">❌ {error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Link href="/student/browse" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button onClick={handleStartQuiz} className="flex-1">
                  Pay {formatSatoshis(quiz.entryFee)} LTC & Start
                </Button>
              </div>
            </CardBody>
          </Card>
        </main>
      </div>
    )
  }

  // Taking Quiz Step
  if (currentStep === 'taking') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
        <header className="border-b bg-white dark:bg-zinc-800 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {quiz.title || 'Quiz'}
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
              <Button onClick={handleSubmit} disabled={!allAnswered} size="lg" className="w-full">
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

  // Submitting Step
  if (currentStep === 'submitting') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardBody className="text-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Submitting to Blockchain
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Creating commitment hash and broadcasting transaction...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              This may take 30-60 seconds
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  // Complete Step
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
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">Next Steps:</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">1.</span>
                <span>Wait for the quiz deadline to pass</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">2.</span>
                <span>Return to reveal your answers within 24 hours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">3.</span>
                <span>Teacher will reveal correct answers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">4.</span>
                <span>Results will be calculated and prizes distributed</span>
              </li>
            </ul>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Important:</strong> Your answers are stored locally. Don&apos;t clear your
              browser data until you&apos;ve revealed your answers!
            </p>
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
