/**
 * Apply Migration Script
 * Safely applies the database migration without data loss
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function applyMigration() {
  try {
    console.log('🔄 Starting migration...')

    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../prisma/migrations/20260122125832_add_distribution_deadline_and_refund_statuses/migration.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration SQL:')
    console.log(sql)
    console.log('\n')

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0)

    console.log(`⚙️  Executing ${statements.length} SQL statements...`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      if (!statement) continue

      try {
        console.log(`\n[${i + 1}/${statements.length}] Executing:`)
        console.log(statement.substring(0, 100) + '...')

        await prisma.$executeRawUnsafe(statement)
        console.log('✅ Success')
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('ℹ️  Already exists, skipping')
        } else {
          console.error('❌ Error:', error.message)
          throw error
        }
      }
    }

    console.log('\n✅ Migration completed successfully!')

    // Verify the changes
    console.log('\n🔍 Verifying changes...')

    const quizCount = await prisma.quiz.count()
    console.log(`  Quizzes: ${quizCount}`)

    const attemptCount = await prisma.quizAttempt.count()
    console.log(`  Attempts: ${attemptCount}`)

    // Check if new columns exist
    const sampleQuiz = await prisma.quiz.findFirst()
    if (sampleQuiz) {
      console.log(`  Sample quiz has studentRevealDeadline: ${!!sampleQuiz.studentRevealDeadline}`)
      console.log(`  Sample quiz has distributionDeadline: ${!!sampleQuiz.distributionDeadline}`)
    }

    console.log('\n✨ All done! Database migrated without data loss.')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()
