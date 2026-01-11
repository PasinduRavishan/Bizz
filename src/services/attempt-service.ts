/**
 * Quiz Attempt Service
 *
 * Handles student quiz attempts by calling the API route that deploys contracts.
 * The API route runs on the server with proper Node.js environment.
 * Implements the commit-reveal pattern for secure quiz submissions.
 */

export interface SubmitAttemptParams {
  quizId: string // Quiz contract ID
  quizRev: string // Quiz contract revision
  answers: string[] // Array of selected answers
  entryFee: number // Entry fee in satoshis
  studentPublicKey?: string // Optional - uses custodial wallet if not provided
}

export interface SubmitAttemptResult {
  success: boolean
  attemptId?: string
  attemptRev?: string
  nonce?: string // Store this - needed for reveal phase
  commitment?: string
  error?: string
}

export interface RevealAnswersParams {
  attemptRev: string // Attempt contract revision
  answers: string[] // Original answers
  nonce: string // Original nonce used for commitment
}

export interface RevealAnswersResult {
  success: boolean
  error?: string
}

/**
 * Submit a quiz attempt by calling the server API
 *
 * This function:
 * 1. Calls POST /api/attempts/submit
 * 2. Server handles contract deployment
 * 3. Returns attempt ID and nonce for reveal phase
 *
 * @param params - Attempt submission parameters
 * @returns Result with attempt ID and nonce
 */
export async function submitAttempt(
  params: SubmitAttemptParams
): Promise<SubmitAttemptResult> {
  try {
    // Validate inputs on client side
    if (!params.quizRev) {
      return { success: false, error: 'Quiz reference is required' }
    }
    if (!params.answers || params.answers.length === 0) {
      return { success: false, error: 'Answers are required' }
    }
    if (params.entryFee < 5000) {
      return { success: false, error: 'Entry fee must be at least 5,000 satoshis' }
    }
    if (!params.studentPublicKey) {
      return { success: false, error: 'Student public key is required' }
    }

    console.log('� Calling API to submit attempt...')

    // Call server API to deploy contract
    const response = await fetch('/api/attempts/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        studentPublicKey: params.studentPublicKey,
        quizContractId: params.quizId,
        quizContractRev: params.quizRev,
        answers: params.answers,
        entryFee: params.entryFee
      })
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to submit attempt'
      }
    }

    console.log('✅ Attempt submitted successfully!')
    console.log('  Attempt ID:', result.attemptId)

    // Store nonce and answers locally for reveal phase
    // IMPORTANT: Student needs this to reveal later!
    if (typeof window !== 'undefined' && result.attemptId) {
      const attemptData = {
        attemptId: result.attemptId,
        attemptRev: result.attemptRev,
        quizId: params.quizId,
        quizRev: params.quizRev,
        answers: params.answers,
        nonce: result.nonce,
        commitment: result.commitment,
        submittedAt: Date.now()
      }
      localStorage.setItem(`attempt_${result.attemptId}`, JSON.stringify(attemptData))

      // Also store by quiz ID for easy lookup
      const quizAttempts = JSON.parse(localStorage.getItem(`quiz_attempts_${params.quizId}`) || '[]')
      quizAttempts.push(result.attemptId)
      localStorage.setItem(`quiz_attempts_${params.quizId}`, JSON.stringify(quizAttempts))
    }

    return {
      success: true,
      attemptId: result.attemptId,
      attemptRev: result.attemptRev,
      nonce: result.nonce,
      commitment: result.commitment
    }
  } catch (error) {
    console.error('❌ Failed to submit attempt:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit attempt'
    }
  }
}

/**
 * Get stored attempt data for reveal
 *
 * @param attemptId - Attempt contract ID
 * @returns Stored attempt data or null
 */
export function getStoredAttempt(attemptId: string): {
  attemptId: string
  attemptRev: string
  quizId: string
  quizRev: string
  answers: string[]
  nonce: string
  commitment: string
  submittedAt: number
} | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`attempt_${attemptId}`)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  return null
}

/**
 * Reveal answers for an attempt (Phase 2 of commit-reveal)
 *
 * This should be called after the quiz deadline but before reveal deadline.
 *
 * @param computer - Bitcoin Computer instance
 * @param params - Reveal parameters
 * @returns Result
 */
export async function revealAnswers(
  computer: { sync: (rev: string) => Promise<{ reveal: (answers: string[], nonce: string) => void }> },
  params: RevealAnswersParams
): Promise<RevealAnswersResult> {
  try {
    // Sync the attempt contract
    console.log('Syncing attempt contract...')
    const attempt = await computer.sync(params.attemptRev)

    // Call reveal method
    console.log('Revealing answers...')
    attempt.reveal(params.answers, params.nonce)

    console.log('Answers revealed successfully!')

    return { success: true }
  } catch (error) {
    console.error('Failed to reveal answers:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reveal answers'
    }
  }
}

/**
 * Get all attempts for a quiz from local storage
 *
 * @param quizId - Quiz contract ID
 * @returns Array of attempt IDs
 */
export function getQuizAttempts(quizId: string): string[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(`quiz_attempts_${quizId}`)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  return []
}
