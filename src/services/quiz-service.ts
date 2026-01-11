/**
 * Quiz Service
 *
 * Handles quiz creation by calling the API route that deploys contracts.
 * The API route runs on the server with proper Node.js environment.
 */

export interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
}

export interface CreateQuizParams {
  questions: QuizQuestion[]
  prizePool: number // in satoshis
  entryFee: number // in satoshis
  passThreshold: number // 0-100
  deadline: Date
  title?: string
  description?: string
  teacherPublicKey?: string // Optional - only if wallet is connected
}

export interface CreateQuizResult {
  success: boolean
  quizId?: string
  quizRev?: string
  error?: string
  salt?: string // Store this securely - needed for reveal
  correctAnswers?: string[]
}

/**
 * Create a new quiz by calling the server API
 *
 * This function:
 * 1. Calls POST /api/quizzes/create
 * 2. Server handles contract deployment
 * 3. Returns quiz ID and salt for teacher
 *
 * @param params - Quiz creation parameters
 * @returns Result with quiz ID or error
 */
export async function createQuiz(
  params: CreateQuizParams
): Promise<CreateQuizResult> {
  try {
    // Validate inputs on client side
    if (params.questions.length === 0) {
      return { success: false, error: 'At least one question is required' }
    }
    if (params.prizePool < 10000) {
      return { success: false, error: 'Prize pool must be at least 10,000 satoshis' }
    }
    if (params.entryFee < 5000) {
      return { success: false, error: 'Entry fee must be at least 5,000 satoshis' }
    }
    if (params.passThreshold < 0 || params.passThreshold > 100) {
      return { success: false, error: 'Pass threshold must be between 0 and 100' }
    }
    if (params.deadline <= new Date()) {
      return { success: false, error: 'Deadline must be in the future' }
    }

    console.log('� Calling API to create quiz...')

    // Call server API to deploy contract
    const response = await fetch('/api/quizzes/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        questions: params.questions,
        prizePool: params.prizePool,
        entryFee: params.entryFee,
        passThreshold: params.passThreshold,
        deadline: params.deadline.toISOString(),
        title: params.title,
        description: params.description,
        teacherPublicKey: params.teacherPublicKey
      })
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to create quiz'
      }
    }

    console.log('✅ Quiz created successfully!')
    console.log('  Quiz ID:', result.quizId)

    // Store salt and answers locally (teacher needs these for reveal)
    if (typeof window !== 'undefined' && result.quizId) {
      localStorage.setItem(`quiz_salt_${result.quizId}`, result.salt)
      localStorage.setItem(`quiz_answers_${result.quizId}`, JSON.stringify(result.correctAnswers))
      
      if (params.title) {
        localStorage.setItem(`quiz_title_${result.quizId}`, params.title)
      }
    }

    return {
      success: true,
      quizId: result.quizId,
      quizRev: result.quizRev,
      salt: result.salt,
      correctAnswers: result.correctAnswers
    }
  } catch (error) {
    console.error('❌ Failed to create quiz:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create quiz'
    }
  }
}

/**
 * Get stored salt for a quiz (for teacher reveal)
 *
 * @param quizId - Quiz contract ID
 * @returns Salt string or null
 */
export function getQuizSalt(quizId: string): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`quiz_salt_${quizId}`)
  }
  return null
}

/**
 * Get stored correct answers for a quiz (for teacher reveal)
 *
 * @param quizId - Quiz contract ID
 * @returns Array of correct answers or null
 */
export function getQuizAnswers(quizId: string): string[] | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`quiz_answers_${quizId}`)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  return null
}
