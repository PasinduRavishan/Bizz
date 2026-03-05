"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("@bitcoin-computer/lib");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const Quiz_deploy_js_1 = require("@bizz/contracts/deploy/Quiz.deploy.js");
const Payment_deploy_js_1 = require("@bizz/contracts/deploy/Payment.deploy.js");
const QuizAttempt_deploy_js_1 = require("@bizz/contracts/deploy/QuizAttempt.deploy.js");
const QuizAccess_deploy_js_1 = require("@bizz/contracts/deploy/QuizAccess.deploy.js");
const QuizRedemption_deploy_js_1 = require("@bizz/contracts/deploy/QuizRedemption.deploy.js");
const AnswerProof_deploy_js_1 = require("@bizz/contracts/deploy/AnswerProof.deploy.js");
const PrizeSwap_deploy_js_1 = require("@bizz/contracts/deploy/PrizeSwap.deploy.js");
dotenv.config({ path: path.join(__dirname, '../.env') });
async function deployContracts() {
    console.log('\n' + '='.repeat(80));
    console.log('  📦 DEPLOYING CONTRACT MODULES');
    console.log('='.repeat(80) + '\n');
    console.log('Environment:');
    console.log(`  Network: ${process.env.BC_NETWORK}`);
    console.log(`  Chain: ${process.env.BC_CHAIN}\n`);
    console.log('🔧 Initializing Bitcoin Computer...');
    const computer = new lib_1.Computer({
        chain: process.env.BC_CHAIN || 'LTC',
        network: process.env.BC_NETWORK || 'regtest',
    });
    const address = computer.getAddress();
    console.log(`✅ Wallet address: ${address}\n`);
    if (process.env.BC_NETWORK === 'regtest') {
        try {
            console.log('💰 Funding wallet from faucet...');
            await computer.faucet(10000000);
            console.log('✅ Wallet funded with 10,000,000 sats\n');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        catch (error) {
            console.warn('⚠️ Faucet funding failed:', error.message);
            console.warn('Continuing with existing balance...\n');
        }
    }
    const moduleIds = {};
    try {
        console.log('📝 Deploying Quiz Module (Token + Quiz)...');
        const quizHelper = new Quiz_deploy_js_1.QuizHelper(computer);
        const quizModId = await quizHelper.deploy(Quiz_deploy_js_1.Token, Quiz_deploy_js_1.Quiz);
        moduleIds.QUIZ_MODULE_ID = quizModId;
        console.log(`✅ Quiz Module: ${quizModId}\n`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('💰 Deploying Payment Module...');
        const paymentHelper = new Payment_deploy_js_1.PaymentHelper(computer);
        const paymentModId = await paymentHelper.deploy();
        moduleIds.PAYMENT_MODULE_ID = paymentModId;
        console.log(`✅ Payment Module: ${paymentModId}\n`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('📊 Deploying QuizAttempt Module...');
        const attemptHelper = new QuizAttempt_deploy_js_1.QuizAttemptHelper(computer);
        const attemptModId = await attemptHelper.deploy();
        moduleIds.QUIZ_ATTEMPT_MODULE_ID = attemptModId;
        console.log(`✅ QuizAttempt Module: ${attemptModId}\n`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('🔐 Deploying QuizAccess Module...');
        const accessHelper = new QuizAccess_deploy_js_1.QuizAccessHelper(computer);
        const accessModId = await accessHelper.deploy();
        moduleIds.QUIZ_ACCESS_MODULE_ID = accessModId;
        console.log(`✅ QuizAccess Module: ${accessModId}\n`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('🎁 Deploying QuizRedemption Module...');
        const redemptionHelper = new QuizRedemption_deploy_js_1.QuizRedemptionHelper(computer);
        const redemptionModId = await redemptionHelper.deploy();
        moduleIds.QUIZ_REDEMPTION_MODULE_ID = redemptionModId;
        console.log(`✅ QuizRedemption Module: ${redemptionModId}\n`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('📜 Deploying AnswerProof Module...');
        const proofHelper = new AnswerProof_deploy_js_1.AnswerProofHelper(computer);
        const proofModId = await proofHelper.deploy();
        moduleIds.ANSWER_PROOF_MODULE_ID = proofModId;
        console.log(`✅ AnswerProof Module: ${proofModId}\n`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('💎 Deploying PrizeSwap Module...');
        const swapHelper = new PrizeSwap_deploy_js_1.PrizeSwapHelper(computer);
        const swapModId = await swapHelper.deploy();
        moduleIds.PRIZE_SWAP_MODULE_ID = swapModId;
        console.log(`✅ PrizeSwap Module: ${swapModId}\n`);
        console.log('='.repeat(80));
        console.log('  ✅ ALL MODULES DEPLOYED SUCCESSFULLY');
        console.log('='.repeat(80) + '\n');
        console.log('📋 Module IDs:\n');
        Object.entries(moduleIds).forEach(([key, value]) => {
            console.log(`${key}=${value}`);
        });
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
    }
    catch (error) {
        console.error('\n❌ Deployment failed:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}
deployContracts()
    .then(() => {
    console.log('Deployment script completed successfully.');
    process.exit(0);
})
    .catch((error) => {
    console.error('Deployment script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=deploy-contracts.js.map