import { NextRequest, NextResponse } from 'next/server'
import { QuizAccessService, createBitcoinComputer } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@bizz/database'

/**
 * POST /api/student/quiz-access/prepare
 * Step 3a: Teacher prepares quiz access transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quizId } = body

    if (!quizId) {
      return NextResponse.json({ error: 'quizId is required' }, { status: 400 })
    }

    // Get quiz to find teacher
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    // Create teacher's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(quiz.teacherId, 'TEACHER')
    const teacherComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await QuizAccessService.prepareAccess(teacherComputer, { quizId })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in prepare quiz access route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prepare quiz access' },
      { status: 500 }
    )
  }
}
