'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { Input } from '@/components/ui/Input'

// Mock data
const mockQuizzes = [
  {
    id: '1',
    title: 'JavaScript Basics',
    teacher: 'Alice',
    questions: 5,
    prizePool: 50000,
    entryFee: 5000,
    passThreshold: 70,
    status: 'active',
    attempts: 12,
    deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
  },
  {
    id: '2',
    title: 'Bitcoin Fundamentals',
    teacher: 'Bob',
    questions: 10,
    prizePool: 100000,
    entryFee: 10000,
    passThreshold: 80,
    status: 'active',
    attempts: 25,
    deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
  },
  {
    id: '3',
    title: 'React Hooks Deep Dive',
    teacher: 'Carol',
    questions: 8,
    prizePool: 75000,
    entryFee: 7500,
    passThreshold: 75,
    status: 'active',
    attempts: 18,
    deadline: new Date(Date.now() + 86400000).toISOString(),
  }
]

export default function BrowseQuizzesPage() {
  const [quizzes] = useState(mockQuizzes)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quiz.teacher.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffDays > 1) return `${diffDays} days left`
    if (diffHours > 1) return `${diffHours} hours left`
    return 'Ending soon'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-600">Bizz</Link>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700 dark:text-gray-300">Browse Quizzes</span>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Available Quizzes</h1>
          <p className="text-gray-600 dark:text-gray-400">Choose a quiz to attempt and win Bitcoin</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search quizzes by title or teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Quizzes</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{quizzes.length}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Prize Pool</div>
              <div className="text-2xl font-bold text-green-600">
                {(quizzes.reduce((sum, q) => sum + q.prizePool, 0) / 100000000).toFixed(4)} LTC
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</div>
              <div className="text-2xl font-bold text-blue-600">
                {quizzes.reduce((sum, q) => sum + q.attempts, 0)}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quizzes Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {filteredQuizzes.map((quiz) => (
            <Card key={quiz.id} hover>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {quiz.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      by {quiz.teacher}
                    </p>
                  </div>
                  <Badge variant="success">ACTIVE</Badge>
                </div>
              </CardHeader>
              
              <CardBody className="space-y-4">
                {/* Prize Info */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Prize Pool</span>
                    <span className="text-xl font-bold text-green-600">
                      {(quiz.prizePool / 100000000).toFixed(5)} LTC
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Entry Fee</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {(quiz.entryFee / 100000000).toFixed(5)} LTC
                    </span>
                  </div>
                </div>

                {/* Quiz Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Questions</span>
                    <span className="font-medium text-gray-900 dark:text-white">{quiz.questions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Pass Threshold</span>
                    <span className="font-medium text-gray-900 dark:text-white">{quiz.passThreshold}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Attempts</span>
                    <span className="font-medium text-gray-900 dark:text-white">{quiz.attempts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Deadline</span>
                    <span className="font-medium text-orange-600">{formatDate(quiz.deadline)}</span>
                  </div>
                </div>

                {/* Action Button */}
                <Link href={`/student/take/${quiz.id}`}>
                  <Button className="w-full" size="lg">
                    Take Quiz
                  </Button>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>

        {filteredQuizzes.length === 0 && (
          <Card>
            <CardBody className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                No quizzes found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Try adjusting your search
              </p>
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  )
}
