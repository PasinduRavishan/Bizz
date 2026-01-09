/**
 * Blockchain Indexer Service
 * 
 * Syncs Quiz and QuizAttempt contracts from Bitcoin Computer blockchain to PostgreSQL
 * This enables fast queries, filtering, and pagination in the UI
 */

// @ts-expect-error - Bitcoin Computer lib doesn't have proper TypeScript types
import { Computer } from '@bitcoin-computer/lib'
import { prisma } from '../lib/prisma'
import { QuizStatus, AttemptStatus } from '@prisma/client'

// Import contract classes so Bitcoin Computer can deserialize them
import Quiz from '../../contracts/Quiz.js'
import QuizAttempt from '../../contracts/QuizAttempt.js'

interface IndexerConfig {
  chain: 'LTC' | 'BTC' | 'DOGE'
  network: 'mainnet' | 'testnet' | 'regtest'
  url: string
  pollInterval?: number // milliseconds between sync cycles
  batchSize?: number    // number of contracts to process per batch
}

interface QuizContract {
  _id: string
  _rev: string
  teacher: string
  questionHashIPFS: string
  answerHashes: string[]
  questionCount: number
  prizePool: bigint | number | string
  entryFee: bigint | number | string
  passThreshold: number
  platformFee?: number
  deadline: number | string | Date
  studentRevealDeadline: number | string | Date
  teacherRevealDeadline: number | string | Date
  status?: string
  revealedAnswers?: string[]
  salt?: string
}

interface AttemptContract {
  _id: string
  _rev: string
  student: string
  quizRef: string
  answerCommitment: string
  revealedAnswers?: string[]
  nonce?: string
  score?: number
  passed?: boolean
  prizeAmount?: bigint | number | string
  status?: string
  submitTimestamp: number | string | Date
  revealTimestamp?: number | string | Date
}

export class BlockchainIndexer {
  private computer: typeof Computer.prototype
  private config: IndexerConfig
  private isRunning = false
  private syncInterval?: NodeJS.Timeout

  constructor(config: IndexerConfig) {
    this.config = {
      pollInterval: 30000, // 30 seconds default
      batchSize: 100,
      ...config
    }

    // Create computer instance with mnemonic if available
    const computerConfig: any = {
      chain: this.config.chain,
      network: this.config.network,
      url: this.config.url
    }
    
    // Use shared wallet if mnemonic is provided
    if (process.env.BITCOIN_COMPUTER_MNEMONIC) {
      computerConfig.mnemonic = process.env.BITCOIN_COMPUTER_MNEMONIC
    }
    
    this.computer = new Computer(computerConfig)

    console.log('🔍 Blockchain Indexer initialized')
    console.log('   Chain:', this.config.chain)
    console.log('   Network:', this.config.network)
    console.log('   URL:', this.config.url)
    console.log('   Address:', this.computer.getAddress())
  }

  /**
   * Start continuous syncing
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Indexer already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting blockchain indexer...')

    // Initial sync
    await this.sync()

    // Schedule periodic syncs
    this.syncInterval = setInterval(() => {
      this.sync().catch(err => {
        console.error('❌ Sync error:', err)
      })
    }, this.config.pollInterval)

    console.log(`✅ Indexer running (polling every ${this.config.pollInterval}ms)`)
  }

  /**
   * Stop syncing
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Indexer not running')
      return
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.isRunning = false
    console.log('🛑 Indexer stopped')
  }

  /**
   * Main sync function - syncs all contract types
   */
  async sync() {
    try {
      console.log('\n🔄 Starting sync cycle...')
      const startTime = Date.now()

      // Sync in order: Users -> Quizzes -> Attempts
      await this.syncQuizzes()
      await this.syncAttempts()
      await this.updateIndexerState()

      const duration = Date.now() - startTime
      console.log(`✅ Sync completed in ${duration}ms\n`)
    } catch (error) {
      console.error('❌ Sync failed:', error)
      throw error
    }
  }

  /**
   * Sync Quiz contracts from blockchain
   */
  private async syncQuizzes() {
    try {
      console.log('📚 Syncing quizzes...')

      // Query all Quiz contracts from Bitcoin Computer
      // Note: This requires your Quiz contract to be published
      const quizContracts = await this.queryQuizContracts()

      let newCount = 0
      let updatedCount = 0

      for (const contract of quizContracts) {
        const exists = await prisma.quiz.findUnique({
          where: { contractId: contract._id }
        })

        if (exists) {
          // Update existing quiz
          await this.updateQuiz(contract)
          updatedCount++
        } else {
          // Create new quiz
          await this.createQuiz(contract)
          newCount++
        }
      }

      console.log(`   ✓ Quizzes: ${newCount} new, ${updatedCount} updated`)
    } catch (error) {
      console.error('   ✗ Quiz sync error:', error)
      throw error
    }
  }

  /**
   * Query all Quiz contracts from blockchain
   */
  private async queryQuizContracts(): Promise<QuizContract[]> {
    try {
      const contracts: QuizContract[] = []
      
      try {
        // Try to use the internal DB API directly
        const computer2 = this.computer as any
        
        // Get all object revisions from the blockchain
        if (computer2.db && computer2.db.getRevs) {
          const allRevs = await computer2.db.getRevs()
          
          for (const rev of allRevs) {
            try {
              const obj = await computer2.db.get(rev)
              if (this.isQuizContract(obj)) {
                contracts.push(obj as QuizContract)
              }
            } catch (err) {
              continue
            }
          }
        } else {
          // Query returns revision strings that need to be synced
          const revisions = await this.computer.query({ publicKey: this.computer.getPublicKey() })
          
          for (const rev of revisions) {
            try {
              // Sync the revision to get the actual object
              const synced = await this.computer.sync(rev)
              
              if (this.isQuizContract(synced)) {
                contracts.push(synced as QuizContract)
              }
            } catch (syncErr) {
              // Skip objects we can't sync
              continue
            }
          }
        }
      } catch (queryError: unknown) {
        const error = queryError as Error
        console.log(`   ℹ️  Query failed: ${error.message}`)
      }

      return contracts
    } catch (error) {
      console.error('Failed to query Quiz contracts:', error)
      return []
    }
  }

  /**
   * Check if an object is a Quiz contract
   */
  private isQuizContract(obj: unknown): obj is QuizContract {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      '_id' in obj &&
      'teacher' in obj &&
      'questionHashIPFS' in obj &&
      'answerHashes' in obj &&
      Array.isArray((obj as QuizContract).answerHashes) &&
      'prizePool' in obj &&
      (obj as QuizContract).prizePool !== undefined &&
      'entryFee' in obj &&
      (obj as QuizContract).entryFee !== undefined
    )
  }

  /**
   * Create a new quiz in database
   */
  private async createQuiz(contract: QuizContract) {
    // Ensure teacher user exists
    const teacher = await this.ensureUser(contract.teacher, 'TEACHER')

    // Map status
    const status = this.mapQuizStatus(contract.status)

    await prisma.quiz.create({
      data: {
        contractId: contract._id,
        contractRev: contract._rev,
        teacherId: teacher.id,
        questionHashIPFS: contract.questionHashIPFS,
        answerHashes: contract.answerHashes,
        questionCount: contract.questionCount,
        prizePool: BigInt(contract.prizePool),
        entryFee: BigInt(contract.entryFee),
        passThreshold: contract.passThreshold,
        platformFee: contract.platformFee || 0.02,
        deadline: new Date(contract.deadline),
        studentRevealDeadline: new Date(contract.studentRevealDeadline),
        teacherRevealDeadline: new Date(contract.teacherRevealDeadline),
        status,
        revealedAnswers: contract.revealedAnswers || [],
        salt: contract.salt,
      }
    })
  }

  /**
   * Update existing quiz in database
   */
  private async updateQuiz(contract: QuizContract) {
    const status = this.mapQuizStatus(contract.status)

    await prisma.quiz.update({
      where: { contractId: contract._id },
      data: {
        contractRev: contract._rev,
        status,
        revealedAnswers: contract.revealedAnswers || [],
        salt: contract.salt || null,
        updatedAt: new Date()
      }
    })
  }

  /**
   * Sync QuizAttempt contracts from blockchain
   */
  private async syncAttempts() {
    try {
      console.log('📝 Syncing quiz attempts...')

      const attemptContracts = await this.queryAttemptContracts()

      let newCount = 0
      let updatedCount = 0

      for (const contract of attemptContracts) {
        const exists = await prisma.quizAttempt.findUnique({
          where: { contractId: contract._id }
        })

        if (exists) {
          await this.updateAttempt(contract)
          updatedCount++
        } else {
          await this.createAttempt(contract)
          newCount++
        }
      }

      console.log(`   ✓ Attempts: ${newCount} new, ${updatedCount} updated`)
    } catch (error) {
      console.error('   ✗ Attempt sync error:', error)
      throw error
    }
  }

  /**
   * Query all QuizAttempt contracts from blockchain
   */
  private async queryAttemptContracts(): Promise<AttemptContract[]> {
    try {
      const contracts: AttemptContract[] = []
      
      try {
        const computer2 = this.computer as any
        
        if (computer2.db && computer2.db.getRevs) {
          const allRevs = await computer2.db.getRevs()
          
          for (const rev of allRevs) {
            try {
              const obj = await computer2.db.get(rev)
              if (this.isAttemptContract(obj)) {
                contracts.push(obj as AttemptContract)
              }
            } catch (err) {
              continue
            }
          }
        } else {
          const revisions = await this.computer.query({ publicKey: this.computer.getPublicKey() })
          
          for (const rev of revisions) {
            try {
              const synced = await this.computer.sync(rev)
              
              if (this.isAttemptContract(synced)) {
                contracts.push(synced as AttemptContract)
              }
            } catch (err) {
              continue
            }
          }
        }
      } catch (queryError: unknown) {
        const error = queryError as Error
        console.log(`   ℹ️  Query failed: ${error.message}`)
      }

      return contracts
    } catch (error) {
      console.error('Failed to query QuizAttempt contracts:', error)
      return []
    }
  }

  /**
   * Check if an object is a QuizAttempt contract
   */
  private isAttemptContract(obj: unknown): obj is AttemptContract {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      '_id' in obj &&
      'student' in obj &&
      'quizRef' in obj &&
      'answerCommitment' in obj
    )
  }


  /**
   * Create a new attempt in database
   */
  private async createAttempt(contract: AttemptContract) {
    // Ensure student user exists
    const student = await this.ensureUser(contract.student, 'STUDENT')

    // Find the quiz
    const quiz = await prisma.quiz.findUnique({
      where: { contractId: contract.quizRef }
    })

    if (!quiz) {
      console.warn(`Quiz not found for attempt: ${contract.quizRef}`)
      return
    }

    const status = this.mapAttemptStatus(contract.status)

    await prisma.quizAttempt.create({
      data: {
        contractId: contract._id,
        contractRev: contract._rev,
        studentId: student.id,
        quizId: quiz.id,
        answerCommitment: contract.answerCommitment,
        revealedAnswers: contract.revealedAnswers || [],
        nonce: contract.nonce,
        score: contract.score,
        passed: contract.passed,
        prizeAmount: contract.prizeAmount ? BigInt(contract.prizeAmount) : null,
        status,
        submitTimestamp: new Date(contract.submitTimestamp),
        revealTimestamp: contract.revealTimestamp ? new Date(contract.revealTimestamp) : null,
      }
    })
  }

  /**
   * Update existing attempt in database
   */
  private async updateAttempt(contract: AttemptContract) {
    const status = this.mapAttemptStatus(contract.status)

    await prisma.quizAttempt.update({
      where: { contractId: contract._id },
      data: {
        contractRev: contract._rev,
        revealedAnswers: contract.revealedAnswers || [],
        nonce: contract.nonce || null,
        score: contract.score || null,
        passed: contract.passed || null,
        prizeAmount: contract.prizeAmount ? BigInt(contract.prizeAmount) : null,
        status,
        revealTimestamp: contract.revealTimestamp ? new Date(contract.revealTimestamp) : null,
        updatedAt: new Date()
      }
    })
  }

  /**
   * Ensure user exists in database, create if not
   */
  private async ensureUser(publicKey: string, defaultRole: 'TEACHER' | 'STUDENT' = 'STUDENT') {
    // For now, use publicKey as address (you may want to derive proper address)
    const address = publicKey.substring(0, 40)

    let user = await prisma.user.findUnique({
      where: { publicKey }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          publicKey,
          address,
          role: defaultRole
        }
      })
    }

    return user
  }

  /**
   * Map blockchain quiz status to database enum
   */
  private mapQuizStatus(status?: string): QuizStatus {
    switch (status?.toLowerCase()) {
      case 'revealed': return QuizStatus.REVEALED
      case 'completed': return QuizStatus.COMPLETED
      case 'refunded': return QuizStatus.REFUNDED
      default: return QuizStatus.ACTIVE
    }
  }

  /**
   * Map blockchain attempt status to database enum
   */
  private mapAttemptStatus(status?: string): AttemptStatus {
    switch (status?.toLowerCase()) {
      case 'revealed': return AttemptStatus.REVEALED
      case 'verified': return AttemptStatus.VERIFIED
      case 'failed': return AttemptStatus.FAILED
      default: return AttemptStatus.COMMITTED
    }
  }

  /**
   * Update indexer state in database
   */
  private async updateIndexerState() {
    await prisma.indexerState.upsert({
      where: { id: 'singleton' },
      update: {
        lastSyncTime: new Date()
      },
      create: {
        id: 'singleton',
        lastBlockHeight: 0,
        lastSyncTime: new Date()
      }
    })
  }

  /**
   * Get indexer status
   */
  async getStatus() {
    const state = await prisma.indexerState.findUnique({
      where: { id: 'singleton' }
    })

    const quizCount = await prisma.quiz.count()
    const attemptCount = await prisma.quizAttempt.count()
    const userCount = await prisma.user.count()

    return {
      isRunning: this.isRunning,
      lastSync: state?.lastSyncTime,
      stats: {
        quizzes: quizCount,
        attempts: attemptCount,
        users: userCount
      }
    }
  }
}

/**
 * Create indexer from environment variables
 */
export function createIndexerFromEnv(): BlockchainIndexer {
  return new BlockchainIndexer({
    chain: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC') as 'LTC' | 'BTC' | 'DOGE',
    network: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest') as 'mainnet' | 'testnet' | 'regtest',
    url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io',
    pollInterval: parseInt(process.env.INDEXER_POLL_INTERVAL || '30000'),
    batchSize: parseInt(process.env.INDEXER_BATCH_SIZE || '100')
  })
}
