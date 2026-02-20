'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'

export default function Home() {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user?.role === 'TEACHER') {
      router.replace('/teacher/dashboard')
    } else if (user?.role === 'STUDENT') {
      router.replace('/student/dashboard')
    }
  }, [user, router])

  // If logged in, show nothing while redirecting
  if (user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Bizz
        </h1>
        <div className="flex gap-3">
          <Link
            href="/auth/signin"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-24 pb-16 text-center">
        {/* Hero */}
        <div className="mb-20">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <span>⛓️</span> Built on Bitcoin Computer
          </div>
          <h2 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
            Bizz
          </h2>
          <p className="text-2xl text-gray-600 dark:text-gray-300 mb-4 max-w-2xl mx-auto">
            Decentralized Quiz Platform
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-10">
            Create quizzes, earn Bitcoin rewards. Every answer verified on-chain.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/auth/signup"
              className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-lg shadow-lg shadow-blue-500/25"
            >
              Start Earning →
            </Link>
            <Link
              href="/auth/signin"
              className="px-8 py-4 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-20">
          {[
            {
              icon: '🎓',
              title: 'For Teachers',
              desc: 'Create quizzes, set prize pools, approve students and reveal answers — all on-chain.',
              color: 'blue',
            },
            {
              icon: '📚',
              title: 'For Students',
              desc: 'Browse quizzes, pay entry fee, submit answers and claim Bitcoin prizes if you win.',
              color: 'purple',
            },
            {
              icon: '🔒',
              title: 'Fully Verifiable',
              desc: 'Commit-reveal scheme ensures fair grading. Every step cryptographically verified.',
              color: 'green',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-zinc-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-zinc-700 text-left"
            >
              <div className={`w-14 h-14 bg-${f.color}-100 dark:bg-${f.color}-900/30 rounded-xl flex items-center justify-center mb-4`}>
                <span className="text-3xl">{f.icon}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Flow Steps */}
        <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-zinc-700 text-left">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center">
            How it works
          </h3>
          <div className="space-y-4">
            {[
              { step: '1', label: 'Teacher creates quiz', sub: 'Sets questions, prize pool & entry fee', icon: '✏️' },
              { step: '2', label: 'Student requests access', sub: 'Teacher approves the request on-chain', icon: '🤝' },
              { step: '3', label: 'Student pays & takes quiz', sub: 'Entry fee exchanged for quiz token', icon: '💰' },
              { step: '4', label: 'Submit & commit answers', sub: 'Cryptographic commitment stored on chain', icon: '📝' },
              { step: '5', label: 'Teacher reveals & grades', sub: 'Results verified, winners determined', icon: '🎯' },
              { step: '6', label: 'Winners claim Bitcoin', sub: 'Atomic swap: answer proof for prize', icon: '🏆' },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
                  {s.step}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {s.icon} {s.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Ready to get started?</p>
          <Link
            href="/auth/signup"
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-lg shadow-lg"
          >
            Create Free Account →
          </Link>
        </div>
      </div>
    </div>
  )
}
