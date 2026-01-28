import { Computer } from '@bitcoin-computer/lib'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))

async function deploy() {
  console.log('\n🚀 Deploying Bitcoin Computer Smart Contracts...\n')

  // Initialize computer
  const computer = new Computer({
    chain: process.env.CHAIN || 'LTC',
    network: process.env.NETWORK || 'regtest',
    url: process.env.BCN_URL || 'http://127.0.0.1:1031',
    mnemonic: process.env.MNEMONIC
  })

  console.log(`📍 Using wallet: ${computer.getAddress()}`)
  console.log(`💰 Funding wallet...\n`)

  // Fund wallet if on regtest
  if (process.env.NETWORK === 'regtest') {
    await computer.faucet(5e8) // 5 BTC worth of satoshis
  }

  const balance = await computer.getBalance()
  console.log(`✅ Balance: ${balance.balance} sats\n`)

  // Read contract files
  const quizContract = readFileSync(join(__dirname, '../contracts/Quiz.ts'), 'utf8')
  const attemptContract = readFileSync(join(__dirname, '../contracts/QuizAttempt.ts'), 'utf8')
  const paymentContract = readFileSync(join(__dirname, '../contracts/Payment.ts'), 'utf8')

  console.log('📦 Deploying Quiz contract...')
  const quizModule = await computer.deploy(quizContract)
  console.log(`   ✅ Quiz module: ${quizModule}\n`)

  console.log('📦 Deploying QuizAttempt contract...')
  const attemptModule = await computer.deploy(attemptContract)
  console.log(`   ✅ QuizAttempt module: ${attemptModule}\n`)

  console.log('📦 Deploying Payment contract...')
  const paymentModule = await computer.deploy(paymentContract)
  console.log(`   ✅ Payment module: ${paymentModule}\n`)

  // Save module specifiers to .env.local
  const envContent = readFileSync('.env.local', 'utf8')
  let newEnvContent = envContent

  // Update or add module specifiers
  const updates = {
    QUIZ_MODULE: quizModule,
    ATTEMPT_MODULE: attemptModule,
    PAYMENT_MODULE: paymentModule
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(newEnvContent)) {
      newEnvContent = newEnvContent.replace(regex, `${key}=${value}`)
    } else {
      newEnvContent += `\n${key}=${value}`
    }
  }

  writeFileSync('.env.local', newEnvContent)

  console.log('✅ Module specifiers saved to .env.local\n')
  console.log('='.repeat(60))
  console.log('🎉 Deployment Complete!')
  console.log('='.repeat(60))
  console.log('\nModule Specifiers:')
  console.log(`  QUIZ_MODULE=${quizModule}`)
  console.log(`  ATTEMPT_MODULE=${attemptModule}`)
  console.log(`  PAYMENT_MODULE=${paymentModule}`)
  console.log('\n')
}

deploy().catch(console.error)
