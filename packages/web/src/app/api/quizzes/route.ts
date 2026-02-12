import { NextResponse } from 'next/server'
import { prisma } from '@bizz/database'

/**
 * GET /api/quizzes
 * Get all quizzes (with optional filters)
 */
export async function GET() {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: {
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        contractId: true,
        symbol: true,
        questionHashIPFS: true,
        questionCount: true,
        prizePool: true,
        entryFee: true,
        passThreshold: true,
        deadline: true,
        status: true,
        title: true,
        description: true,
        createdAt: true,
        teacher: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            attempts: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: quizzes.map(q => ({
        ...q,
        prizePool: q.prizePool.toString(),
        entryFee: q.entryFee.toString()
      }))
    })
  } catch (error) {
    console.error('Error fetching quizzes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quizzes' },
      { status: 500 }
    )
  }
}
