import { NextRequest, NextResponse } from 'next/server'
import { TeacherRevealService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/teacher/quiz/[quizId]/reveal
 * Step 5: Teacher reveals answers and grades all attempts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quizId } = await params
    const teacherId = session.user.id

    // Create teacher's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(teacherId, 'TEACHER')
    const teacherComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await TeacherRevealService.revealAndGrade(teacherComputer, {
      teacherId,
      quizId
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(teacherComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in reveal quiz route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reveal quiz' },
      { status: 500 }
    )
  }
}
