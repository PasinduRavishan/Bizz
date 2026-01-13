import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/quizzes/[id]/payment-status
 * 
 * Get detailed payment status for a quiz
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: quizId } = await params

    // Get quiz with full payment details
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [
          { id: quizId },
          { contractId: quizId }
        ]
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            address: true,
            walletBalance: true
          }
        },
        winners: {
          include: {
            attempt: {
              include: {
                student: {
                  select: {
                    id: true,
                    name: true,
                    address: true,
                    totalEarnings: true
                  }
                }
              }
            }
          }
        },
        attempts: {
          include: {
            student: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // Calculate totals
    const totalEntryFees = quiz.entryFee * BigInt(quiz.attempts.length)
    const platformFeeAmount = BigInt(Math.floor(Number(totalEntryFees) * quiz.platformFee))
    const teacherEntryFeeAmount = totalEntryFees - platformFeeAmount

    const prizesDistributed = quiz.winners.reduce((sum, w) => sum + w.prizeAmount, BigInt(0))
    const prizesPending = quiz.winners.filter(w => !w.paid).reduce((sum, w) => sum + w.prizeAmount, BigInt(0))
    const prizesPaid = quiz.winners.filter(w => w.paid).reduce((sum, w) => sum + w.prizeAmount, BigInt(0))

    // Net teacher change
    const netTeacherChange = teacherEntryFeeAmount - prizesDistributed

    const status = {
      quizId: quiz.id,
      quizTitle: quiz.title,
      quizStatus: quiz.status,
      
      // Prize pool info
      prizePool: {
        total: quiz.prizePool.toString(),
        distributed: prizesPaid.toString(),
        pending: prizesPending.toString(),
        winnersCount: quiz.winners.length,
        paidWinners: quiz.winners.filter(w => w.paid).length
      },

      // Entry fees info
      entryFees: {
        perAttempt: quiz.entryFee.toString(),
        attemptCount: quiz.attempts.length,
        total: totalEntryFees.toString(),
        platformFee: platformFeeAmount.toString(),
        teacherAmount: teacherEntryFeeAmount.toString(),
        platformFeePercentage: (quiz.platformFee * 100).toFixed(0) + '%'
      },

      // Teacher finances
      teacher: {
        id: quiz.teacher.id,
        name: quiz.teacher.name,
        currentBalance: quiz.teacher.walletBalance?.toString() || '0',
        netChange: netTeacherChange.toString(),
        explanation: netTeacherChange >= 0 
          ? `Teacher will gain ${netTeacherChange} sats (entry fees - prizes)`
          : `Teacher will lose ${Math.abs(Number(netTeacherChange))} sats (prizes > entry fees)`
      },

      // Winners detail
      winners: quiz.winners.map(w => ({
        id: w.id,
        studentId: w.attempt.studentId,
        studentName: w.attempt.student.name,
        score: w.score,
        prizeAmount: w.prizeAmount.toString(),
        paid: w.paid,
        paidTxHash: w.paidTxHash,
        studentEarnings: w.attempt.student.totalEarnings.toString()
      })),

      // Payment actions available
      actions: {
        canDistribute: quiz.status === 'REVEALED' && quiz.winners.some(w => !w.paid),
        canRetry: quiz.status === 'COMPLETED' && quiz.winners.some(w => !w.paid),
        isComplete: quiz.status === 'COMPLETED' && quiz.winners.every(w => w.paid)
      }
    }

    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('❌ Failed to get payment status:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get payment status'
      },
      { status: 500 }
    )
  }
}
