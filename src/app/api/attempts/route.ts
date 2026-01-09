import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AttemptStatus } from '@prisma/client'

// GET /api/attempts - Get attempts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get('quizId')
    const studentAddress = searchParams.get('student')
    const status = searchParams.get('status')
    
    // Build where clause
    const where: Record<string, unknown> = {}
    
    if (quizId) {
      where.quizId = quizId
    }
    
    if (studentAddress) {
      // Find student by address
      const student = await prisma.user.findUnique({
        where: { address: studentAddress }
      })
      if (student) {
        where.studentId = student.id
      }
    }
    
    if (status) {
      where.status = status.toUpperCase() as AttemptStatus
    }
    
    // Query attempts with student and quiz info
    const attempts = await prisma.quizAttempt.findMany({
      where,
      include: {
        student: {
          select: {
            address: true,
            publicKey: true
          }
        },
        quiz: {
          select: {
            id: true,
            contractId: true,
            questionCount: true,
            passThreshold: true,
            title: true
          }
        }
      },
      orderBy: {
        submitTimestamp: 'desc'
      }
    })
    
    // Convert BigInt to string for JSON serialization
    const serializedAttempts = attempts.map(attempt => ({
      ...attempt,
      prizeAmount: attempt.prizeAmount?.toString() || null
    }))
    
    return NextResponse.json({
      success: true,
      data: serializedAttempts,
      count: serializedAttempts.length
    })
  } catch (error) {
    console.error('Failed to fetch attempts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch attempts' },
      { status: 500 }
    )
  }
}

// POST /api/attempts - Create new attempt (will be used after deploying contract)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const required = ['student', 'quizId', 'answerCommitment']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    
    // Note: In production, this endpoint would:
    // 1. Deploy QuizAttempt contract to Bitcoin Computer
    // 2. Pay entry fee from student's wallet
    // 3. Wait for contract to be mined
    // 4. Save contract ID to database via indexer
    // For now, we just acknowledge the request
    
    return NextResponse.json({
      success: true,
      message: 'Attempt creation initiated. Deploy contract first, then indexer will sync it.',
      data: {
        student: body.student,
        quizId: body.quizId,
        answerCommitment: body.answerCommitment
      }
    }, { status: 202 }) // 202 Accepted
  } catch (error) {
    console.error('Failed to create attempt:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create attempt' },
      { status: 500 }
    )
  }
}
