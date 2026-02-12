/**
 * Module Registry - Lazy deployment pattern
 * Deploys each contract module ONCE on first use and caches the module ID
 * This follows Bitcoin Computer best practices: deploy once, reuse many times
 */
// In-memory cache of deployed module IDs
const registry = {
    quizMod: null,
    paymentMod: null,
    attemptMod: null,
    accessMod: null,
    redemptionMod: null,
    answerProofMod: null,
    prizeSwapMod: null
};
// Track pending deployments to avoid duplicate deploys
const deploymentPromises = new Map();
/**
 * Generic lazy deployment function
 * Deploys module on first call, caches and reuses the module ID
 * Uses the provided Computer instance (with funds) for deployment
 */
async function deployModule(moduleName, deployFileName, computer) {
    // Return cached module ID if already deployed
    if (registry[moduleName]) {
        return registry[moduleName];
    }
    // Return existing deployment promise if already in progress
    if (deploymentPromises.has(moduleName)) {
        return deploymentPromises.get(moduleName);
    }
    // Create new deployment promise
    const deployPromise = (async () => {
        try {
            console.log(`📦 Deploying ${moduleName} module...`);
            // Check wallet balance
            const balance = await computer.getBalance();
            console.log(`   Wallet balance: ${Number(balance)} sats`);
            if (Number(balance) < 10000) {
                throw new Error(`Insufficient balance: ${Number(balance)} sats. Need at least 10,000 sats.`);
            }
            // Read pre-built deploy file
            const fs = await import('fs/promises');
            const path = await import('path');
            const deployDir = path.join(process.cwd(), '../../packages/contracts/deploy');
            const deployCode = await fs.readFile(path.join(deployDir, deployFileName), 'utf-8');
            // Deploy to blockchain using the provided Computer instance
            const moduleId = await computer.deploy(deployCode);
            // Mine a block to confirm the deployment
            const { mineBlocks } = await import('./bitcoin-computer-server');
            await mineBlocks(computer, 1);
            // Cache the module ID
            registry[moduleName] = moduleId;
            console.log(`✅ ${moduleName} deployed and confirmed: ${moduleId}`);
            return moduleId;
        }
        catch (error) {
            console.error(`❌ Failed to deploy ${moduleName}:`, error);
            throw error;
        }
        finally {
            // Clear deployment promise
            deploymentPromises.delete(moduleName);
        }
    })();
    // Store deployment promise
    deploymentPromises.set(moduleName, deployPromise);
    return deployPromise;
}
/**
 * Get Quiz module - deploys on first use using the provided Computer instance
 */
export async function getQuizModule(computer) {
    return deployModule('quizMod', 'Quiz.deploy.js', computer);
}
/**
 * Get Payment module - deploys on first use using the provided Computer instance
 */
export async function getPaymentModule(computer) {
    return deployModule('paymentMod', 'Payment.deploy.js', computer);
}
/**
 * Get QuizAttempt module - deploys on first use using the provided Computer instance
 */
export async function getAttemptModule(computer) {
    return deployModule('attemptMod', 'QuizAttempt.deploy.js', computer);
}
/**
 * Get QuizAccess module - deploys on first use using the provided Computer instance
 */
export async function getAccessModule(computer) {
    return deployModule('accessMod', 'QuizAccess.deploy.js', computer);
}
/**
 * Get QuizRedemption module - deploys on first use using the provided Computer instance
 */
export async function getRedemptionModule(computer) {
    return deployModule('redemptionMod', 'QuizRedemption.deploy.js', computer);
}
/**
 * Get AnswerProof module - deploys on first use using the provided Computer instance
 */
export async function getAnswerProofModule(computer) {
    return deployModule('answerProofMod', 'AnswerProof.deploy.js', computer);
}
/**
 * Get PrizeSwap module - deploys on first use using the provided Computer instance
 */
export async function getPrizeSwapModule(computer) {
    return deployModule('prizeSwapMod', 'PrizeSwap.deploy.js', computer);
}
//# sourceMappingURL=module-registry.js.map