import { NextRequest, NextResponse } from 'next/server'
import { TeacherQuizService } from '@bizz/api/services/teacher-quiz.service'
import { createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api/utils/bitcoin-computer-server'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/teacher/quiz/create
 * Step 1: Teacher creates quiz
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { questions, correctAnswers, prizePool, entryFee, passThreshold, deadline, title } = body

    const teacherId = session.user.id

    // Create teacher's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(teacherId, 'TEACHER')
    const teacherComputer = createBitcoinComputer({ path: walletPath })

    // Upload questions to IPFS
    let questionHashIPFS = 'QmTest123' // Default for testing
    if (questions && Array.isArray(questions)) {
      try {
        const { uploadQuestionsToIPFS } = await import('@/lib/ipfs')
        questionHashIPFS = await uploadQuestionsToIPFS(questions)
        console.log('📤 Questions uploaded to IPFS:', questionHashIPFS)
      } catch (ipfsError) {
        console.warn('⚠️ IPFS upload failed, using test hash:', ipfsError)
        // Continue with test hash - in production this should fail
      }
    }

    // Generate quiz symbol from title
    const symbol = title
      ? title.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
      : 'QUIZ' + Date.now().toString().substring(0, 6)

    // Call service layer
    const result = await TeacherQuizService.createQuiz(teacherComputer, {
      teacherId,
      symbol,
      questionHashIPFS,
      correctAnswers,
      prizePool,
      entryFee,
      passThreshold,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      title,
      questions // Store for later retrieval
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait for mempool and mine block
    await waitForMempool()
    await mineBlocks(teacherComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in create quiz route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create quiz' },
      { status: 500 }
    )
  }
}
