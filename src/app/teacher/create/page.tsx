'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { WalletConnect } from '@/components/wallet/WalletConnect'

export default function CreateQuizPage() {
  const [questions, setQuestions] = useState([{ question: '', options: ['', '', '', ''], correctAnswer: 0 }])
  const [prizePool, setPrizePool] = useState('')
  const [entryFee, setEntryFee] = useState('')
  const [passThreshold, setPassThreshold] = useState('70')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // TODO: Implement quiz creation with Bitcoin Computer
    console.log('Creating quiz:', {
      questions,
      prizePool,
      entryFee,
      passThreshold,
      deadline
    })
    
    setTimeout(() => {
      setLoading(false)
      alert('Quiz created successfully! (Demo)')
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-600">Bizz</Link>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700 dark:text-gray-300">Create Quiz</span>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create New Quiz</h1>
          <p className="text-gray-600 dark:text-gray-400">Set up your quiz with prize pool and questions</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  helperText="Minimum 10,000 sats"
                  required
                />
                <Input
                  label="Entry Fee (satoshis)"
                  type="number"
                  placeholder="5000"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  helperText="Minimum 5,000 sats"
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
                  helperText="Percentage needed to pass"
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
                    Answer Options
                  </label>
                  {q.options.map((option, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctAnswer === oIndex}
                        onChange={() => updateQuestion(qIndex, 'correctAnswer', oIndex)}
                        className="w-4 h-4"
                      />
                      <Input
                        placeholder={`Option ${oIndex + 1}`}
                        value={option}
                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select the correct answer by clicking the radio button
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}

          {/* Add Question Button */}
          <Button
            type="button"
            variant="outline"
            onClick={addQuestion}
            className="w-full"
          >
            + Add Question
          </Button>

          {/* Submit */}
          <div className="flex gap-4">
            <Link href="/teacher/dashboard" className="flex-1">
              <Button type="button" variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creating Quiz...' : 'Create Quiz & Deploy'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
