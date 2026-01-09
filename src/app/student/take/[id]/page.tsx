'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletConnect } from '@/components/wallet/WalletConnect'

// Mock quiz data
const mockQuizData: Record<string, {
  id: string
  title: string
  teacher: string
  questions: Array<{
    id: number
    question: string
    options: string[]
  }>
  prizePool: number
  entryFee: number
  passThreshold: number
  deadline: string
}> = {
  '1': {
    id: '1',
    title: 'JavaScript Basics',
    teacher: 'Alice',
    questions: [
      {
        id: 1,
        question: 'What is the result of: typeof null?',
        options: ['null', 'undefined', 'object', 'number']
      },
      {
        id: 2,
        question: 'Which method is used to add elements to the end of an array?',
        options: ['push()', 'pop()', 'shift()', 'unshift()']
      },
      {
        id: 3,
        question: 'What does "===" check in JavaScript?',
        options: ['Value only', 'Type only', 'Value and type', 'Reference']
      },
      {
        id: 4,
        question: 'Which keyword is used to declare a constant?',
        options: ['var', 'let', 'const', 'static']
      },
      {
        id: 5,
        question: 'What is a closure in JavaScript?',
        options: [
          'A function with access to its own scope',
          'A function with access to outer function scope',
          'A closed function',
          'An IIFE'
        ]
      }
    ],
    prizePool: 50000,
    entryFee: 5000,
    passThreshold: 70,
    deadline: new Date(Date.now() + 86400000 * 2).toISOString()
  },
  '2': {
    id: '2',
    title: 'Bitcoin Fundamentals',
    teacher: 'Bob',
    questions: [
      {
        id: 1,
        question: 'Who created Bitcoin?',
        options: ['Vitalik Buterin', 'Satoshi Nakamoto', 'Hal Finney', 'Nick Szabo']
      },
      {
        id: 2,
        question: 'What is the maximum supply of Bitcoin?',
        options: ['21 million', '100 million', '1 billion', 'Unlimited']
      }
    ],
    prizePool: 100000,
    entryFee: 10000,
    passThreshold: 80,
    deadline: new Date(Date.now() + 86400000 * 5).toISOString()
  }
}

export default function TakeQuizPage() {
  const params = useParams()
  const quizId = params.id as string
  const quiz = mockQuizData[quizId]

  const [currentStep, setCurrentStep] = useState<'confirm' | 'taking' | 'submitting' | 'complete'>('confirm')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(3600)

  // Timer countdown effect
  useEffect(() => {
    if (currentStep !== 'taking') return
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [currentStep])

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-12">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Quiz Not Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">This quiz doesn&apos;t exist or has been removed</p>
            <Link href="/student/browse">
              <Button>Back to Browse</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  const handleAnswer = (questionId: number, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }))
  }

  const handleStartQuiz = async () => {
    // TODO: Pay entry fee via Bitcoin Computer
    console.log('Paying entry fee:', quiz.entryFee)
    setCurrentStep('taking')
  }

  const handleSubmit = async () => {
    setCurrentStep('submitting')
    
    // TODO: Create commitment hash and submit to blockchain
    console.log('Submitting answers:', answers)
    
    // Simulate blockchain transaction
    setTimeout(() => {
      setCurrentStep('complete')
    }, 2000)
  }

  const allAnswered = Object.keys(answers).length === quiz.questions.length

  // Confirm Step
  if (currentStep === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
        <header className="border-b bg-white dark:bg-zinc-800">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-2xl font-bold text-blue-600">Bizz</Link>
              <span className="text-gray-400">→</span>
              <span className="text-gray-700 dark:text-gray-300">{quiz.title}</span>
            </div>
            <WalletConnect />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
                <Badge variant="success">ACTIVE</Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-1">by {quiz.teacher}</p>
            </CardHeader>

            <CardBody className="space-y-6">
              {/* Quiz Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Quiz Details</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{quiz.questions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Pass Threshold:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{quiz.passThreshold}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Prize Pool:</span>
                    <span className="font-semibold text-green-600">{(quiz.prizePool / 100000000).toFixed(5)} LTC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Entry Fee:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{(quiz.entryFee / 100000000).toFixed(5)} LTC</span>
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
                    <span>Your answers are hashed and committed to the blockchain (commit phase)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">4.</span>
                    <span>After the deadline, reveal your answers (reveal phase)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600">5.</span>
                    <span>If you score ≥{quiz.passThreshold}%, you&apos;ll win a share of the prize pool!</span>
                  </li>
                </ul>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Entry fee is non-refundable. Make sure to reveal your answers after the deadline or you&apos;ll forfeit your entry.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Link href="/student/browse" className="flex-1">
                  <Button variant="outline" className="w-full">Cancel</Button>
                </Link>
                <Button onClick={handleStartQuiz} className="flex-1">
                  Pay {(quiz.entryFee / 100000000).toFixed(5)} LTC & Start
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.keys(answers).length} of {quiz.questions.length} answered
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
            {quiz.questions.map((q, index) => (
              <Card key={q.id}>
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
                        onClick={() => handleAnswer(q.id, optionIndex)}
                        className={`
                          w-full text-left px-4 py-3 rounded-lg border-2 transition-all
                          ${answers[q.id] === optionIndex
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-zinc-700 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-5 h-5 rounded-full border-2 flex items-center justify-center
                            ${answers[q.id] === optionIndex
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-gray-300 dark:border-zinc-600'
                            }
                          `}>
                            {answers[q.id] === optionIndex && (
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
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered}
                size="lg"
                className="w-full"
              >
                {allAnswered ? 'Submit Answers' : `Answer all questions (${Object.keys(answers).length}/${quiz.questions.length})`}
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
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your answers have been committed to the blockchain. Remember to reveal them after the deadline!
          </p>

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

          <div className="flex gap-4">
            <Link href="/student/my-attempts" className="flex-1">
              <Button variant="outline" className="w-full">View My Attempts</Button>
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
