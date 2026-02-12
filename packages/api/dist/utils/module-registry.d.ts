/**
 * Module Registry - Lazy deployment pattern
 * Deploys each contract module ONCE on first use and caches the module ID
 * This follows Bitcoin Computer best practices: deploy once, reuse many times
 */
import { Computer } from '@bitcoin-computer/lib';
/**
 * Get Quiz module - deploys on first use using the provided Computer instance
 */
export declare function getQuizModule(computer: Computer): Promise<string>;
/**
 * Get Payment module - deploys on first use using the provided Computer instance
 */
export declare function getPaymentModule(computer: Computer): Promise<string>;
/**
 * Get QuizAttempt module - deploys on first use using the provided Computer instance
 */
export declare function getAttemptModule(computer: Computer): Promise<string>;
/**
 * Get QuizAccess module - deploys on first use using the provided Computer instance
 */
export declare function getAccessModule(computer: Computer): Promise<string>;
/**
 * Get QuizRedemption module - deploys on first use using the provided Computer instance
 */
export declare function getRedemptionModule(computer: Computer): Promise<string>;
/**
 * Get AnswerProof module - deploys on first use using the provided Computer instance
 */
export declare function getAnswerProofModule(computer: Computer): Promise<string>;
/**
 * Get PrizeSwap module - deploys on first use using the provided Computer instance
 */
export declare function getPrizeSwapModule(computer: Computer): Promise<string>;
//# sourceMappingURL=module-registry.d.ts.map