'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WalletConnect } from '@/components/wallet/WalletConnect'

// Mock data
const mockQuizzes = [
  {
    id: '1',
    title: 'JavaScript Basics',
    questions: 5,
    prizePool: 50000,
    entryFee: 5000,
    passThreshold: 70,
    status: 'active',
    attempts: 12,
    deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '2',
    title: 'Bitcoin Fundamentals',
    questions: 10,
    prizePool: 100000,
    entryFee: 10000,
    passThreshold: 80,
    status: 'revealed',
    attempts: 25,
    deadline: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  }
]

export default function TeacherDashboard() {
  const [quizzes] = useState(mockQuizzes)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'success',
      revealed: 'info',
      completed: 'default',
      refunded: 'danger'
    } as const
    
    return <Badge variant={variants[status as keyof typeof variants]}>{status.toUpperCase()}</Badge>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-600">Bizz</Link>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700 dark:text-gray-300">Teacher Dashboard</span>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Quizzes</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your created quizzes</p>
          </div>
          <Link href="/teacher/create">
            <Button size="lg">+ Create New Quiz</Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Quizzes</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{quizzes.length}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Quizzes</div>
              <div className="text-2xl font-bold text-green-600">
                {quizzes.filter(q => q.status === 'active').length}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Attempts</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {quizzes.reduce((sum, q) => sum + q.attempts, 0)}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</div>
              <div className="text-2xl font-bold text-blue-600">
                {(quizzes.reduce((sum, q) => sum + (q.attempts * q.entryFee * 0.98), 0) / 100000000).toFixed(4)} LTC
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quizzes List */}
        <div className="space-y-4">
          {quizzes.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No quizzes yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first quiz to get started
                </p>
                <Link href="/teacher/create">
                  <Button>Create Quiz</Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            quizzes.map((quiz) => (
              <Card key={quiz.id} hover>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {quiz.title}
                        </h3>
                        {getStatusBadge(quiz.status)}
                      </div>
                      
                      <div className="grid md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {quiz.questions}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Prize Pool:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {quiz.prizePool.toLocaleString()} sats
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Entry Fee:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {quiz.entryFee.toLocaleString()} sats
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Attempts:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {quiz.attempts}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Deadline: {formatDate(quiz.deadline)}</span>
                        <span>•</span>
                        <span>Pass: {quiz.passThreshold}%</span>
                        <span>•</span>
                        <span>Created: {formatDate(quiz.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline">View Details</Button>
                      {quiz.status === 'active' && (
                        <Button size="sm" variant="secondary">Reveal Answers</Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
