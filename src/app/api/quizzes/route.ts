import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { QuizStatus } from '@prisma/client'

// GET /api/quizzes - Get all quizzes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const teacherAddress = searchParams.get('teacher')
    
    // Build where clause
    const where: Record<string, unknown> = {}
    
    if (status) {
      where.status = status.toUpperCase() as QuizStatus
    }
    
    if (teacherAddress) {
      // Find teacher by address
      const teacher = await prisma.user.findUnique({
        where: { address: teacherAddress }
      })
      if (teacher) {
        where.teacherId = teacher.id
      }
    }
    
    // Query quizzes with teacher info
    const quizzes = await prisma.quiz.findMany({
      where,
      include: {
        teacher: {
          select: {
            address: true,
            publicKey: true
          }
        },
        _count: {
          select: {
            attempts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Convert BigInt to string for JSON serialization
    const serializedQuizzes = quizzes.map(quiz => ({
      ...quiz,
      prizePool: quiz.prizePool.toString(),
      entryFee: quiz.entryFee.toString(),
      attemptCount: quiz._count.attempts
    }))
    
    return NextResponse.json({
      success: true,
      data: serializedQuizzes,
      count: serializedQuizzes.length
    })
  } catch (error) {
    console.error('Failed to fetch quizzes:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quizzes' },
      { status: 500 }
    )
  }
}

// POST /api/quizzes - Create new quiz (will be used after deploying contract)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const required = ['teacher', 'questionHashIPFS', 'answerHashes', 'prizePool', 'entryFee', 'passThreshold', 'deadline']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    
    // Note: In production, this endpoint would:
    // 1. Deploy Quiz contract to Bitcoin Computer
    // 2. Wait for contract to be mined
    // 3. Save contract ID to database via indexer
    // For now, we just acknowledge the request
    
    return NextResponse.json({
      success: true,
      message: 'Quiz creation initiated. Deploy contract first, then indexer will sync it.',
      data: {
        teacher: body.teacher,
        questionHashIPFS: body.questionHashIPFS,
        questionCount: body.answerHashes.length,
        prizePool: body.prizePool,
        entryFee: body.entryFee
      }
    }, { status: 202 }) // 202 Accepted
  } catch (error) {
    console.error('Failed to create quiz:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create quiz' },
      { status: 500 }
    )
  }
}
