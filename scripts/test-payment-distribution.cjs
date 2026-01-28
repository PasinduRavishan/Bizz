/**
 * Test Payment Distribution System
 * 
 * This script tests the complete payment distribution flow:
 * 1. Prize distribution (teacher → winners)
 * 2. Entry fee collection (students → teacher)
 * 3. Platform fee calculation
 * 4. Net teacher change
 * 
 * Run with: node scripts/test-payment-distribution.cjs <quizId>
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testPaymentDistribution(quizId) {
  console.log('\n🧪 TESTING PAYMENT DISTRIBUTION')
  console.log('='.repeat(60))
  console.log(`Quiz ID: ${quizId}\n`)

  try {
    // 1. Fetch quiz data
    console.log('📊 Step 1: Fetching quiz data...')
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
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
                    walletBalance: true
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
                name: true,
                address: true,
                walletBalance: true
              }
            }
          }
        }
      }
    })

    if (!quiz) {
      console.error('❌ Quiz not found!')
      process.exit(1)
    }

    console.log(`✅ Quiz found: ${quiz.title || quiz.contractId}`)
    console.log(`   Teacher: ${quiz.teacher.name}`)
    console.log(`   Status: ${quiz.status}`)
    console.log(`   Prize Pool: ${quiz.prizePool} sats`)
    console.log(`   Entry Fee: ${quiz.entryFee} sats`)
    console.log(`   Winners: ${quiz.winners.length}`)
    console.log(`   Attempts: ${quiz.attempts.length}`)

    // 2. Check teacher balance and UTXOs
    console.log('\n📊 Step 2: Checking teacher wallet...')
    console.log(`   Teacher balance: ${quiz.teacher.walletBalance} sats`)
    console.log(`   Teacher address: ${quiz.teacher.address}`)
    
    // Calculate required amounts
    const totalPrizes = quiz.winners.reduce((sum, w) => sum + Number(w.prizeAmount), 0)
    console.log(`   Total prizes to pay: ${totalPrizes} sats`)
    
    if (Number(quiz.teacher.walletBalance) < totalPrizes) {
      console.warn(`   ⚠️  WARNING: Teacher balance (${quiz.teacher.walletBalance}) < prizes (${totalPrizes})`)
      console.warn(`   ⚠️  Teacher wallet may need funding with ${totalPrizes - Number(quiz.teacher.walletBalance)} sats`)
    }

    // 3. Check student balances
    console.log('\n📊 Step 3: Checking student wallets...')
    const entryFeeAmount = Number(quiz.entryFee)
    const platformFeePercent = quiz.platformFee
    const teacherAmount = Math.floor(entryFeeAmount * (1 - platformFeePercent))
    
    for (const attempt of quiz.attempts) {
      console.log(`   Student: ${attempt.student.name}`)
      console.log(`      Balance: ${attempt.student.walletBalance} sats`)
      console.log(`      Entry fee to pay: ${teacherAmount} sats`)
      
      if (Number(attempt.student.walletBalance) < teacherAmount) {
        console.warn(`      ⚠️  WARNING: Student balance (${attempt.student.walletBalance}) < entry fee (${teacherAmount})`)
      }
    }

    // 4. Calculate expected outcomes
    console.log('\n📊 Step 4: Calculating expected outcomes...')
    const totalEntryFeesCollected = quiz.attempts.length * teacherAmount
    const totalPlatformFee = quiz.attempts.length * Math.floor(entryFeeAmount * platformFeePercent)
    const netTeacherChange = totalEntryFeesCollected - totalPrizes
    
    console.log(`   Total entry fees (to teacher): ${totalEntryFeesCollected} sats`)
    console.log(`   Total platform fee: ${totalPlatformFee} sats`)
    console.log(`   Total prizes to pay: ${totalPrizes} sats`)
    console.log(`   Net teacher change: ${netTeacherChange > 0 ? '+' : ''}${netTeacherChange} sats`)
    
    if (netTeacherChange > 0) {
      console.log(`   ✅ Teacher will profit ${netTeacherChange} sats`)
    } else if (netTeacherChange < 0) {
      console.log(`   ⚠️  Teacher will lose ${Math.abs(netTeacherChange)} sats`)
    } else {
      console.log(`   ➖ Teacher breaks even`)
    }

    // 5. Check for payment issues
    console.log('\n📊 Step 5: Checking for potential issues...')
    const issues = []
    
    // Check if quiz is in correct status
    if (quiz.status !== 'REVEALED' && quiz.status !== 'COMPLETED') {
      issues.push(`Quiz status is ${quiz.status}, should be REVEALED or COMPLETED`)
    }
    
    // Check teacher has address
    if (!quiz.teacher.address) {
      issues.push('Teacher has no wallet address')
    }
    
    // Check students have addresses
    for (const attempt of quiz.attempts) {
      if (!attempt.student.address) {
        issues.push(`Student ${attempt.student.name} has no wallet address`)
      }
    }
    
    // Check winners have addresses
    for (const winner of quiz.winners) {
      if (!winner.attempt.student.address) {
        issues.push(`Winner ${winner.attempt.student.name} has no wallet address`)
      }
    }

    if (issues.length > 0) {
      console.log('   ❌ Issues found:')
      issues.forEach(issue => console.log(`      - ${issue}`))
    } else {
      console.log('   ✅ No issues found')
    }

    // 6. Summary
    console.log('\n📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`Quiz: ${quiz.title || quiz.contractId}`)
    console.log(`Status: ${quiz.status}`)
    console.log(``)
    console.log(`Prize Distribution:`)
    console.log(`  ${quiz.winners.length} winners × ${quiz.winners[0]?.prizeAmount || 0} sats = ${totalPrizes} sats`)
    console.log(``)
    console.log(`Entry Fee Collection:`)
    console.log(`  ${quiz.attempts.length} attempts × ${teacherAmount} sats = ${totalEntryFeesCollected} sats`)
    console.log(`  Platform fee: ${totalPlatformFee} sats (${(platformFeePercent * 100).toFixed(1)}%)`)
    console.log(``)
    console.log(`Net Result:`)
    console.log(`  Teacher: ${netTeacherChange > 0 ? '+' : ''}${netTeacherChange} sats`)
    console.log(`  Platform: +${totalPlatformFee} sats`)
    console.log(``)
    
    if (issues.length > 0) {
      console.log(`⚠️  ${issues.length} issue(s) need to be resolved before payment processing`)
    } else {
      console.log(`✅ Ready for payment processing`)
    }
    
    console.log('='.repeat(60))

    // 7. Winner details
    if (quiz.winners.length > 0) {
      console.log('\n🏆 WINNER DETAILS')
      console.log('='.repeat(60))
      quiz.winners.forEach((winner, index) => {
        console.log(`${index + 1}. ${winner.attempt.student.name}`)
        console.log(`   Score: ${winner.score}%`)
        console.log(`   Prize: ${winner.prizeAmount} sats`)
        console.log(`   Paid: ${winner.paid ? '✅ Yes' : '❌ No'}`)
        if (winner.paidTxHash) {
          console.log(`   TX: ${winner.paidTxHash}`)
        }
        console.log(`   Address: ${winner.attempt.student.address || 'NO ADDRESS'}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run test
const quizId = process.argv[2]
if (!quizId) {
  console.error('Usage: node scripts/test-payment-distribution.js <quizId>')
  process.exit(1)
}

testPaymentDistribution(quizId)
