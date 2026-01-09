#!/usr/bin/env node

/**
 * Blockchain Indexer CLI
 * 
 * Run this to start syncing blockchain data to PostgreSQL
 * Usage:
 *   npm run indexer        - Start continuous syncing
 *   npm run indexer:once   - Run one sync cycle and exit
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') })

import { createIndexerFromEnv } from './indexer'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'start'

  console.log('🚀 Bizz Quiz Platform - Blockchain Indexer')
  console.log('==========================================\n')

  const indexer = createIndexerFromEnv()

  switch (command) {
    case 'start':
      console.log('Starting continuous sync...')
      await indexer.start()
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down indexer...')
        indexer.stop()
        process.exit(0)
      })

      process.on('SIGTERM', async () => {
        console.log('\n\n🛑 Shutting down indexer...')
        indexer.stop()
        process.exit(0)
      })

      // Keep process alive
      await new Promise(() => {})
      break

    case 'once':
    case 'sync':
      console.log('Running single sync cycle...')
      await indexer.sync()
      
      const status = await indexer.getStatus()
      console.log('\n📊 Indexer Status:')
      console.log('   Last Sync:', status.lastSync)
      console.log('   Quizzes:', status.stats.quizzes)
      console.log('   Attempts:', status.stats.attempts)
      console.log('   Users:', status.stats.users)
      
      process.exit(0)
      break

    case 'status':
      const currentStatus = await indexer.getStatus()
      console.log('📊 Indexer Status:')
      console.log('   Running:', currentStatus.isRunning)
      console.log('   Last Sync:', currentStatus.lastSync)
      console.log('   Quizzes:', currentStatus.stats.quizzes)
      console.log('   Attempts:', currentStatus.stats.attempts)
      console.log('   Users:', currentStatus.stats.users)
      process.exit(0)
      break

    case 'help':
    default:
      console.log('Usage:')
      console.log('  indexer start   - Start continuous syncing (default)')
      console.log('  indexer once    - Run one sync cycle and exit')
      console.log('  indexer status  - Show current indexer status')
      console.log('  indexer help    - Show this help message')
      process.exit(0)
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
