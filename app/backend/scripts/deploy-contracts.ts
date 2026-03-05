/**
 * Deploy Contract Modules Script
 *
 * Deploys all contract modules once and outputs module IDs for .env
 * Run: npx ts-node scripts/deploy-contracts.ts
 */

import { Computer } from '@bitcoin-computer/lib';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Import contract helpers
import { Token, Quiz, QuizHelper } from '@bizz/contracts/deploy/Quiz.deploy.js';
import { Payment, PaymentHelper } from '@bizz/contracts/deploy/Payment.deploy.js';
import { QuizAttempt, QuizAttemptHelper } from '@bizz/contracts/deploy/QuizAttempt.deploy.js';
import { QuizAccess, QuizAccessHelper } from '@bizz/contracts/deploy/QuizAccess.deploy.js';
import { QuizRedemption, QuizRedemptionHelper } from '@bizz/contracts/deploy/QuizRedemption.deploy.js';
import { AnswerProof, AnswerProofHelper } from '@bizz/contracts/deploy/AnswerProof.deploy.js';
import { PrizeSwap, PrizeSwapHelper } from '@bizz/contracts/deploy/PrizeSwap.deploy.js';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function deployContracts() {
  console.log('\n' + '='.repeat(80));
  console.log('  📦 DEPLOYING CONTRACT MODULES');
  console.log('='.repeat(80) + '\n');

  console.log('Environment:');
  console.log(`  Network: ${process.env.BC_NETWORK}`);
  console.log(`  Chain: ${process.env.BC_CHAIN}\n`);

  // Initialize Computer instance
  console.log('🔧 Initializing Bitcoin Computer...');
  const computer = new Computer({
    chain: process.env.BC_CHAIN || 'LTC',
    network: process.env.BC_NETWORK || 'regtest',
  });

  const address = computer.getAddress();
  console.log(`✅ Wallet address: ${address}\n`);

  // Fund wallet if on regtest
  if (process.env.BC_NETWORK === 'regtest') {
    try {
      console.log('💰 Funding wallet from faucet...');
      await computer.faucet(10000000); // 10M sats
      console.log('✅ Wallet funded with 10,000,000 sats\n');

      // Wait for mempool
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn('⚠️ Faucet funding failed:', error.message);
      console.warn('Continuing with existing balance...\n');
    }
  }

  const moduleIds: Record<string, string> = {};

  try {
    // 1. Deploy Quiz Module (Token + Quiz)
    console.log('📝 Deploying Quiz Module (Token + Quiz)...');
    const quizHelper = new QuizHelper(computer);
    const quizModId = await quizHelper.deploy(Token, Quiz);
    moduleIds.QUIZ_MODULE_ID = quizModId;
    console.log(`✅ Quiz Module: ${quizModId}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Deploy Payment Module
    console.log('💰 Deploying Payment Module...');
    const paymentHelper = new PaymentHelper(computer);
    const paymentModId = await paymentHelper.deploy();
    moduleIds.PAYMENT_MODULE_ID = paymentModId;
    console.log(`✅ Payment Module: ${paymentModId}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Deploy QuizAttempt Module
    console.log('📊 Deploying QuizAttempt Module...');
    const attemptHelper = new QuizAttemptHelper(computer);
    const attemptModId = await attemptHelper.deploy();
    moduleIds.QUIZ_ATTEMPT_MODULE_ID = attemptModId;
    console.log(`✅ QuizAttempt Module: ${attemptModId}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Deploy QuizAccess Module
    console.log('🔐 Deploying QuizAccess Module...');
    const accessHelper = new QuizAccessHelper(computer);
    const accessModId = await accessHelper.deploy();
    moduleIds.QUIZ_ACCESS_MODULE_ID = accessModId;
    console.log(`✅ QuizAccess Module: ${accessModId}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Deploy QuizRedemption Module
    console.log('🎁 Deploying QuizRedemption Module...');
    const redemptionHelper = new QuizRedemptionHelper(computer);
    const redemptionModId = await redemptionHelper.deploy();
    moduleIds.QUIZ_REDEMPTION_MODULE_ID = redemptionModId;
    console.log(`✅ QuizRedemption Module: ${redemptionModId}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 6. Deploy AnswerProof Module
    console.log('📜 Deploying AnswerProof Module...');
    const proofHelper = new AnswerProofHelper(computer);
    const proofModId = await proofHelper.deploy();
    moduleIds.ANSWER_PROOF_MODULE_ID = proofModId;
    console.log(`✅ AnswerProof Module: ${proofModId}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 7. Deploy PrizeSwap Module
    console.log('💎 Deploying PrizeSwap Module...');
    const swapHelper = new PrizeSwapHelper(computer);
    const swapModId = await swapHelper.deploy();
    moduleIds.PRIZE_SWAP_MODULE_ID = swapModId;
    console.log(`✅ PrizeSwap Module: ${swapModId}\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('  ✅ ALL MODULES DEPLOYED SUCCESSFULLY');
    console.log('='.repeat(80) + '\n');

    console.log('📋 Module IDs:\n');
    Object.entries(moduleIds).forEach(([key, value]) => {
      console.log(`${key}=${value}`);
    });

    // Update .env file
    console.log('\n📝 Updating .env file...');
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    Object.entries(moduleIds).forEach(([key, value]) => {
      const regex = new RegExp(`${key}=.*`, 'g');
      envContent = envContent.replace(regex, `${key}=${value}`);
    });

    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file updated!\n');

    console.log('='.repeat(80));
    console.log('  🎉 DEPLOYMENT COMPLETE!');
    console.log('  You can now restart the backend to use the deployed modules.');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployContracts()
  .then(() => {
    console.log('Deployment script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deployment script failed:', error);
    process.exit(1);
  });
