'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { apiService } from '@/services/api.service'

interface Question {
  question: string
  options: string[]
  correctAnswer: number
}

type DeploymentStep = 'idle' | 'validating' | 'deploying' | 'success' | 'error'

export default function CreateQuizPage() {
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([
    { question: '', options: ['', '', '', ''], correctAnswer: 0 }
  ])
  const [prizePool, setPrizePool] = useState('')
  const [entryFee, setEntryFee] = useState('')
  const [passThreshold, setPassThreshold] = useState('70')
  const [deadline, setDeadline] = useState('')

  const [deploymentStep, setDeploymentStep] = useState<DeploymentStep>('idle')
  const [deploymentMessage, setDeploymentMessage] = useState('')
  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', '', '', ''], correctAnswer: 0 }])
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, field: string, value: string | number) => {
    const updated = [...questions]
    if (field === 'question') {
      updated[index].question = value as string
    } else if (field === 'correctAnswer') {
      updated[index].correctAnswer = value as number
    }
    setQuestions(updated)
  }

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions]
    updated[qIndex].options[oIndex] = value
    setQuestions(updated)
  }

  const validateForm = (): string | null => {
    // Remove wallet requirement - authentication is enough
    if (!title.trim()) {
      return 'Please enter a quiz title'
    }

    const prizePoolNum = parseInt(prizePool)
    const entryFeeNum = parseInt(entryFee)

    if (prizePoolNum < 10000) {
      return 'Prize pool must be at least 10,000 satoshis'
    }

    if (entryFeeNum < 5000) {
      return 'Entry fee must be at least 5,000 satoshis'
    }

    if (!deadline) {
      return 'Please set a deadline'
    }

    const deadlineDate = new Date(deadline)
    if (deadlineDate <= new Date()) {
      return 'Deadline must be in the future'
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question.trim()) {
        return `Question ${i + 1} is empty`
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          return `Question ${i + 1}, Option ${j + 1} is empty`
        }
      }
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Step 1: Validate
    setDeploymentStep('validating')
    setDeploymentMessage('Validating quiz data...')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setDeploymentStep('error')
      return
    }

    // Step 2: Deploy contract
    setDeploymentStep('deploying')
    setDeploymentMessage('Deploying quiz contract to blockchain... This may take 30-60 seconds.')

    try {
      // Extract correct answers from questions
      const correctAnswers = questions.map(q => q.options[q.correctAnswer])

      // Call NestJS backend via apiService
      const result = await apiService.quiz.create({
        title: title.trim(),
        questions,
        correctAnswers,
        prizePool: parseInt(prizePool),
        entryFee: parseInt(entryFee),
        passThreshold: parseInt(passThreshold),
        deadline: new Date(deadline).toISOString()
      })

      // Backend returns { success: true, quizId: contractId, quiz: { id, ... } }
      // Use quiz.id (DB primary key) for navigation links
      const dbId = result.quiz?.id || result.quizId
      if (result.success && dbId) {
        setCreatedQuizId(dbId)
        setDeploymentStep('success')
        setDeploymentMessage('Quiz created successfully!')
      } else {
        setError('Failed to create quiz')
        setDeploymentStep('error')
      }
    } catch (err) {
      console.error('Quiz creation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create quiz')
      setDeploymentStep('error')
    }
  }

  const isLoading = deploymentStep === 'validating' || deploymentStep === 'deploying'

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create New Quiz</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Set up your quiz with prize pool and questions
        </p>
      </div>

        {/* Success State */}
        {deploymentStep === 'success' && createdQuizId && (
          <Card className="mb-6 border-green-500">
            <CardBody className="bg-green-50 dark:bg-green-900/20">
              <div className="text-center py-4">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
                  Quiz Created Successfully!
                </h2>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  Your quiz has been deployed to the blockchain.
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mb-6 font-mono">
                  Contract ID: {createdQuizId.substring(0, 20)}...
                </p>
                <div className="flex gap-4 justify-center">
                  <Link href="/teacher/dashboard">
                    <Button>Go to Dashboard</Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeploymentStep('idle')
                      setCreatedQuizId(null)
                      setTitle('')
                      setQuestions([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }])
                      setPrizePool('')
                      setEntryFee('')
                      setDeadline('')
                    }}
                  >
                    Create Another
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Deployment Progress */}
        {isLoading && (
          <Card className="mb-6 border-blue-500">
            <CardBody className="bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">{deploymentMessage}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Please don&apos;t close this page...
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-red-500">
            <CardBody className="bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Error</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Form - Hide when success */}
        {deploymentStep !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quiz Title */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quiz Details</h2>
              </CardHeader>
              <CardBody>
                <Input
                  label="Quiz Title"
                  placeholder="Enter a title for your quiz"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </CardBody>
            </Card>

            {/* Quiz Settings */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quiz Settings</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Prize Pool (satoshis)"
                    type="number"
                    placeholder="50000"
                    value={prizePool}
                    onChange={(e) => setPrizePool(e.target.value)}
                    helperText="Minimum 10,000 sats. This amount will be locked in the contract."
                    required
                  />
                  <Input
                    label="Entry Fee (satoshis)"
                    type="number"
                    placeholder="5000"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    helperText="Minimum 5,000 sats. Students pay this to attempt."
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Pass Threshold (%)"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="70"
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(e.target.value)}
                    helperText="Percentage needed to pass and win prize"
                    required
                  />
                  <Input
                    label="Deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    helperText="When submissions close"
                    required
                  />
                </div>
              </CardBody>
            </Card>

            {/* Questions */}
            {questions.map((q, qIndex) => (
              <Card key={qIndex}>
                <CardHeader className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Question {qIndex + 1}
                  </h3>
                  {questions.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeQuestion(qIndex)}
                    >
                      Remove
                    </Button>
                  )}
                </CardHeader>
                <CardBody className="space-y-4">
                  <Textarea
                    label="Question"
                    placeholder="Enter your question..."
                    value={q.question}
                    onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                    rows={2}
                    required
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Answer Options (select the correct one)
                    </label>
                    {q.options.map((option, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${qIndex}`}
                          checked={q.correctAnswer === oIndex}
                          onChange={() => updateQuestion(qIndex, 'correctAnswer', oIndex)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <Input
                          placeholder={`Option ${oIndex + 1}`}
                          value={option}
                          onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                          required
                        />
                        {q.correctAnswer === oIndex && (
                          <span className="text-green-600 text-sm font-medium">Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}

            {/* Add Question Button */}
            <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
              + Add Question
            </Button>

            {/* Submit */}
            <div className="flex gap-4">
              <Link href="/teacher/dashboard" className="flex-1">
                <Button type="button" variant="secondary" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? 'Deploying...' : 'Create Quiz & Deploy'}
              </Button>
            </div>
          </form>
        )}
      </main>
  )
}
