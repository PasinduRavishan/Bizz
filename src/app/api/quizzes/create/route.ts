import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateSalt, hashAnswers } from '@/lib/crypto'
import { uploadQuestionsToIPFS, storeQuestionsLocally } from '@/lib/ipfs'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
}

interface CreateQuizRequest {
  questions: QuizQuestion[]
  prizePool: number
  entryFee: number
  passThreshold: number
  deadline: string
  title?: string
  description?: string
  teacherPublicKey?: string // Optional - from wallet if connected
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'TEACHER') {
      return NextResponse.json(
        { success: false, error: 'Only teachers can create quizzes' },
        { status: 403 }
      )
    }

    const body: CreateQuizRequest = await request.json()

    if (!body.questions || body.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one question is required' },
        { status: 400 }
      )
    }

    if (body.prizePool < 10000) {
      return NextResponse.json(
        { success: false, error: 'Prize pool must be at least 10,000 satoshis' },
        { status: 400 }
      )
    }

    if (body.entryFee < 5000) {
      return NextResponse.json(
        { success: false, error: 'Entry fee must be at least 5,000 satoshis' },
        { status: 400 }
      )
    }

    if (body.passThreshold < 0 || body.passThreshold > 100) {
      return NextResponse.json(
        { success: false, error: 'Pass threshold must be between 0 and 100' },
        { status: 400 }
      )
    }

    const deadline = new Date(body.deadline)
    if (deadline <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'Deadline must be in the future' },
        { status: 400 }
      )
    }

    // @ts-expect-error
    const { Computer } = await import('@bitcoin-computer/lib')

    const computer = new Computer({
      chain: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC') as 'LTC',
      network: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest') as 'regtest',
      url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io',
      ...(process.env.BITCOIN_COMPUTER_MNEMONIC && { mnemonic: process.env.BITCOIN_COMPUTER_MNEMONIC })
    })

    console.log('🚀 Server wallet address:', computer.getAddress())
    console.log('🚀 Creating quiz contract...')
    console.log('  Teacher ID:', session.user.id)
    console.log('  Teacher Public Key:', body.teacherPublicKey?.substring(0, 20) + '...' || 'None (using session)')
    console.log('  Questions:', body.questions.length)
    console.log('  Prize Pool:', body.prizePool, 'sats')
    console.log('  Entry Fee:', body.entryFee, 'sats')

    // Use teacherPublicKey from wallet if provided, otherwise use server wallet as placeholder
    const teacherPublicKey = body.teacherPublicKey || computer.getPublicKey()

    const salt = generateSalt()
    const tempQuizId = `quiz-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const correctAnswers = body.questions.map((q) => q.options[q.correctAnswer])
    const answerHashes = hashAnswers(tempQuizId, correctAnswers, salt)

    const questionsForIPFS = body.questions.map((q) => ({
      question: q.question,
      options: q.options
    }))

    const questionHashIPFS = await uploadQuestionsToIPFS(questionsForIPFS)

    // Define Quiz contract inline (pure JavaScript, no imports)
    const QuizContract = `
      export class Quiz extends Contract {
        constructor(teacher, questionHashIPFS, answerHashes, prizePool, entryFee, passThreshold, deadline) {
          if (!teacher) throw new Error('Teacher public key required')
          if (!questionHashIPFS) throw new Error('Question hash required')
          if (!Array.isArray(answerHashes) || answerHashes.length === 0) {
            throw new Error('Answer hashes must be a non-empty array')
          }
          if (prizePool < 10000n) {
            throw new Error('Prize pool must be at least 10,000 satoshis')
          }
          if (entryFee < 5000n) {
            throw new Error('Entry fee must be at least 5,000 satoshis')
          }
          if (passThreshold < 0 || passThreshold > 100) {
            throw new Error('Pass threshold must be between 0 and 100')
          }
          if (deadline <= Date.now()) {
            throw new Error('Deadline must be in the future')
          }

          const STUDENT_REVEAL_WINDOW = 24 * 3600 * 1000
          const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000

          super({
            _owners: [teacher],
            _satoshis: prizePool,
            teacher: teacher,
            questionHashIPFS: questionHashIPFS,
            answerHashes: answerHashes,
            questionCount: answerHashes.length,
            entryFee: entryFee,
            prizePool: prizePool,
            passThreshold: passThreshold,
            platformFee: 0.02,
            deadline: deadline,
            studentRevealDeadline: deadline + STUDENT_REVEAL_WINDOW,
            teacherRevealDeadline: deadline + STUDENT_REVEAL_WINDOW + TEACHER_REVEAL_WINDOW,
            status: 'active',
            revealedAnswers: null,
            salt: null,
            winners: [],
            createdAt: Date.now(),
            version: '1.0.0'
          })
        }

        revealAnswers(answers, salt) {
          if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can reveal answers')
          }
          if (Date.now() < this.studentRevealDeadline) {
            throw new Error('Must wait for student reveal window to close')
          }
          if (Date.now() > this.teacherRevealDeadline) {
            throw new Error('Teacher reveal deadline has passed')
          }
          if (this.status !== 'active') {
            throw new Error('Quiz is not in active status')
          }
          if (answers.length !== this.answerHashes.length) {
            throw new Error('Answer count does not match')
          }
          this.revealedAnswers = answers
          this.salt = salt
          this.status = 'revealed'
        }

        complete(winners) {
          if (this.status !== 'revealed') {
            throw new Error('Quiz must be revealed first')
          }
          this.winners = winners
          this.status = 'completed'
        }

        triggerRefund() {
          if (this.status !== 'active') {
            throw new Error('Quiz is not in active status')
          }
          if (Date.now() <= this.teacherRevealDeadline) {
            throw new Error('Teacher still has time to reveal')
          }
          this.status = 'refunded'
        }

        getInfo() {
          return {
            quizId: this._id,
            quizRev: this._rev,
            teacher: this.teacher,
            questionHashIPFS: this.questionHashIPFS,
            questionCount: this.questionCount,
            entryFee: this.entryFee,
            prizePool: this._satoshis,
            passThreshold: this.passThreshold,
            deadline: this.deadline,
            studentRevealDeadline: this.studentRevealDeadline,
            teacherRevealDeadline: this.teacherRevealDeadline,
            status: this.status,
            createdAt: this.createdAt
          }
        }
      }
    `

    console.log('📦 Deploying Quiz contract module...')
    const moduleSpecifier = await computer.deploy(QuizContract)
    console.log('✅ Module deployed:', moduleSpecifier)

    console.log('🎓 Creating quiz instance from module...')
    
    const { tx, effect } = await computer.encode({
      mod: moduleSpecifier,
      exp: `new Quiz("${teacherPublicKey}", "${questionHashIPFS}", ${JSON.stringify(answerHashes)}, BigInt(${body.prizePool}), BigInt(${body.entryFee}), ${body.passThreshold}, ${deadline.getTime()})`
    })

    const txId = await computer.broadcast(tx)
    const quiz = effect.res as { _id: string; _rev: string }

    console.log('✅ Quiz created!')
    console.log('  Contract ID:', quiz._id)
    console.log('  Contract Rev:', quiz._rev)
    console.log('  TX ID:', txId)

    storeQuestionsLocally(quiz._id, body.questions)

    // Save to database immediately (don't wait for indexer)
    try {
      // Use authenticated user from session
      const teacher = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!teacher) {
        throw new Error('Teacher user not found')
      }

      // Update user's publicKey if provided and not already set
      if (body.teacherPublicKey && !teacher.publicKey) {
        await prisma.user.update({
          where: { id: teacher.id },
          data: {
            publicKey: body.teacherPublicKey,
            address: body.teacherPublicKey.substring(0, 40)
          }
        })
        console.log('👤 Updated teacher wallet info')
      }

      // Calculate reveal deadlines
      const STUDENT_REVEAL_WINDOW = 24 * 3600 * 1000
      const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000

      await prisma.quiz.create({
        data: {
          contractId: quiz._id,
          contractRev: quiz._rev,
          teacherId: session.user.id,
          title: body.title || null,
          questionHashIPFS: questionHashIPFS,
          answerHashes: answerHashes,
          questionCount: body.questions.length,
          prizePool: BigInt(body.prizePool),
          entryFee: BigInt(body.entryFee),
          passThreshold: body.passThreshold,
          platformFee: 0.02,
          deadline: deadline,
          studentRevealDeadline: new Date(deadline.getTime() + STUDENT_REVEAL_WINDOW),
          teacherRevealDeadline: new Date(deadline.getTime() + STUDENT_REVEAL_WINDOW + TEACHER_REVEAL_WINDOW),
          status: 'ACTIVE',
          salt: salt
        }
      })
      console.log('💾 Quiz saved to database')
    } catch (dbError) {
      console.error('⚠️ Failed to save to database (indexer will catch it):', dbError)
    }

    return NextResponse.json({
      success: true,
      quizId: quiz._id,
      quizRev: quiz._rev,
      salt: salt,
      correctAnswers: correctAnswers
    })

  } catch (error) {
    console.error('❌ Failed to create quiz:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create quiz'
      },
      { status: 500 }
    )
  }
}