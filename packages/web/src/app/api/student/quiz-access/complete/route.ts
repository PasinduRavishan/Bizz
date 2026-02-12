import { NextRequest, NextResponse } from 'next/server'
import { QuizAccessService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@bizz/database'

/**
 * POST /api/student/quiz-access/complete
 * Step 3b: Student completes quiz access with entry fee payment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quizId, attemptId, partialExecTx } = body

    if (!quizId || !attemptId || !partialExecTx) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const studentId = session.user.id

    // Get quiz to find teacher
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    // Create computer instances using unique wallets
    const studentWalletPath = getUserWalletPath(studentId, 'STUDENT')
    const teacherWalletPath = getUserWalletPath(quiz.teacherId, 'TEACHER')
    const studentComputer = createBitcoinComputer({ path: studentWalletPath })
    const teacherComputer = createBitcoinComputer({ path: teacherWalletPath })

    // Call service
    const result = await QuizAccessService.completeAccess(
      studentComputer,
      teacherComputer,
      { studentId, quizId, attemptId, partialExecTx }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(studentComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in complete quiz access route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete quiz access' },
      { status: 500 }
    )
  }
}
