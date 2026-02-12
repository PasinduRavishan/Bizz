/**
 * Quiz Attempt Service
 *
 * Handles student quiz attempts by calling the API route that deploys contracts.
 * The API route runs on the server with proper Node.js environment.
 * Implements the commit-reveal pattern for secure quiz submissions.
 */
/**
 * Submit a quiz attempt by calling the server API
 *
 * This function:
 * 1. Calls POST /api/attempts/submit
 * 2. Server handles contract deployment
 * 3. Returns attempt ID and nonce for reveal phase
 *
 * @param params - Attempt submission parameters
 * @returns Result with attempt ID and nonce
 */
export async function submitAttempt(params) {
    try {
        // Validate inputs on client side
        if (!params.quizRev) {
            return { success: false, error: 'Quiz reference is required' };
        }
        if (!params.answers || params.answers.length === 0) {
            return { success: false, error: 'Answers are required' };
        }
        if (params.entryFee < 5000) {
            return { success: false, error: 'Entry fee must be at least 5,000 satoshis' };
        }
        console.log('📤 Calling API to submit attempt...');
        // Call server API to deploy contract
        const response = await fetch('/api/attempts/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                studentPublicKey: params.studentPublicKey,
                quizContractId: params.quizId,
                quizContractRev: params.quizRev,
                answers: params.answers,
                entryFee: params.entryFee
            })
        });
        const result = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: result.error || 'Failed to submit attempt'
            };
        }
        console.log('✅ Attempt submitted successfully!');
        console.log('  Attempt ID:', result.attemptId);
        // Note: Nonce and answers are stored in database via API
        // No need for localStorage - fetch from API when needed for reveal
        return {
            success: true,
            attemptId: result.attemptId,
            attemptRev: result.attemptRev,
            nonce: result.nonce,
            commitment: result.commitment
        };
    }
    catch (error) {
        console.error('❌ Failed to submit attempt:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to submit attempt'
        };
    }
}
/**
 * Get attempt data from API (production approach)
 *
 * @param attemptId - Attempt contract ID
 * @returns Attempt data from database
 */
export async function getAttemptData(attemptId) {
    try {
        const response = await fetch(`/api/attempts/${attemptId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch attempt data');
        }
        const data = await response.json();
        return data.success ? data.data : null;
    }
    catch (error) {
        console.error('Error fetching attempt:', error);
        return null;
    }
}
/**
 * Reveal answers for an attempt (Phase 2 of commit-reveal)
 *
 * This should be called after the quiz deadline but before reveal deadline.
 * Calls the server API which handles blockchain interaction.
 *
 * @param params - Reveal parameters
 * @returns Result with reveal confirmation
 */
export async function revealAnswers(params) {
    try {
        // Validate inputs on client side
        if (!params.attemptId) {
            return { success: false, error: 'Attempt ID is required' };
        }
        console.log('🔓 Calling API to reveal answers...');
        console.log('  Server will decrypt answers and nonce from encrypted storage');
        // Call server API to reveal on blockchain
        // Server fetches and decrypts answers/nonce from encryptedRevealData
        const response = await fetch(`/api/attempts/${params.attemptId}/reveal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // Answers and nonce are optional - server decrypts from database
                ...(params.answers && { answers: params.answers }),
                ...(params.nonce && { nonce: params.nonce })
            })
        });
        const result = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: result.error || 'Failed to reveal answers'
            };
        }
        console.log('✅ Answers revealed successfully!');
        console.log('  TX ID:', result.data?.txId);
        return {
            success: true,
            attemptId: result.data?.attemptId,
            contractRev: result.data?.contractRev,
            txId: result.data?.txId,
            status: result.data?.status,
            revealTimestamp: result.data?.revealTimestamp
        };
    }
    catch (error) {
        console.error('❌ Failed to reveal answers:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to reveal answers'
        };
    }
}
/**
 * Get reveal status for an attempt
 *
 * @param attemptId - Attempt ID (database or contract ID)
 * @returns Reveal status information
 */
export async function getRevealStatus(attemptId) {
    try {
        const response = await fetch(`/api/attempts/${attemptId}/reveal`);
        if (!response.ok) {
            const result = await response.json();
            return {
                success: false,
                error: result.error || 'Failed to get reveal status'
            };
        }
        const data = await response.json();
        return {
            success: true,
            data: data.data
        };
    }
    catch (error) {
        console.error('Error fetching reveal status:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get reveal status'
        };
    }
}
/**
 * Get quiz attempts from API (production approach)
 *
 * @param quizId - Quiz contract ID
 * @returns Array of attempt IDs from database
 */
export async function getQuizAttempts(quizId) {
    try {
        const response = await fetch(`/api/quizzes/${quizId}/attempts`);
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        return data.success && data.attempts ? data.attempts.map((a) => a.id) : [];
    }
    catch (error) {
        console.error('Error fetching quiz attempts:', error);
        return [];
    }
}
//# sourceMappingURL=attempt-service.js.map