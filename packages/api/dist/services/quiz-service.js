/**
 * Quiz Service
 *
 * Handles quiz creation by calling the API route that deploys contracts.
 * The API route runs on the server with proper Node.js environment.
 */
/**
 * Create a new quiz by calling the server API
 *
 * This function:
 * 1. Calls POST /api/quizzes/create
 * 2. Server handles contract deployment
 * 3. Returns quiz ID and salt for teacher
 *
 * @param params - Quiz creation parameters
 * @returns Result with quiz ID or error
 */
export async function createQuiz(params) {
    try {
        // Validate inputs on client side
        if (params.questions.length === 0) {
            return { success: false, error: 'At least one question is required' };
        }
        if (params.prizePool < 10000) {
            return { success: false, error: 'Prize pool must be at least 10,000 satoshis' };
        }
        if (params.entryFee < 5000) {
            return { success: false, error: 'Entry fee must be at least 5,000 satoshis' };
        }
        if (params.passThreshold < 0 || params.passThreshold > 100) {
            return { success: false, error: 'Pass threshold must be between 0 and 100' };
        }
        if (params.deadline <= new Date()) {
            return { success: false, error: 'Deadline must be in the future' };
        }
        console.log('� Calling API to create quiz...');
        // Call server API to deploy contract
        const response = await fetch('/api/quizzes/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                questions: params.questions,
                prizePool: params.prizePool,
                entryFee: params.entryFee,
                passThreshold: params.passThreshold,
                deadline: params.deadline.toISOString(),
                title: params.title,
                description: params.description,
                teacherPublicKey: params.teacherPublicKey
            })
        });
        const result = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: result.error || 'Failed to create quiz'
            };
        }
        console.log('✅ Quiz created successfully!');
        console.log('  Quiz ID:', result.quizId);
        // Note: Salt and answers are stored in database via API
        // No need for localStorage - fetch from API when needed for reveal
        return {
            success: true,
            quizId: result.quizId,
            quizRev: result.quizRev,
            salt: result.salt,
            correctAnswers: result.correctAnswers
        };
    }
    catch (error) {
        console.error('❌ Failed to create quiz:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create quiz'
        };
    }
}
/**
 * Get quiz salt from API (production approach)
 *
 * @param quizId - Quiz contract ID
 * @returns Salt string from database or null
 */
export async function getQuizSalt(quizId) {
    try {
        const response = await fetch(`/api/quizzes/${quizId}`);
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return data.success && data.quiz ? data.quiz.salt : null;
    }
    catch (error) {
        console.error('Error fetching quiz salt:', error);
        return null;
    }
}
/**
 * Get quiz answers from API (production approach)
 * Note: This should only be accessible to the quiz creator
 *
 * @param quizId - Quiz contract ID
 * @returns Array of correct answers from database or null
 */
export async function getQuizAnswers(quizId) {
    try {
        const response = await fetch(`/api/quizzes/${quizId}/answers`);
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return data.success && data.answers ? data.answers : null;
    }
    catch (error) {
        console.error('Error fetching quiz answers:', error);
        return null;
    }
}
/**
 * Reveal correct answers for a quiz (teacher action)
 *
 * This should be called after student reveal window closes but before
 * teacher reveal deadline.
 *
 * @param params - Reveal parameters with quiz ID, answers, and salt
 * @returns Result with reveal confirmation and scoring results
 */
export async function revealQuizAnswers(params) {
    try {
        // Validate inputs on client side
        if (!params.quizId) {
            return { success: false, error: 'Quiz ID is required' };
        }
        console.log('🔓 Calling API to reveal quiz answers...');
        console.log('  Server will decrypt answers and salt from encrypted storage');
        // Call server API to reveal on blockchain
        // Server fetches and decrypts answers/salt from encryptedRevealData
        const response = await fetch(`/api/quizzes/${params.quizId}/reveal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // Answers and salt are optional - server decrypts from database
                ...(params.answers && { answers: params.answers }),
                ...(params.salt && { salt: params.salt })
            })
        });
        const result = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: result.error || 'Failed to reveal answers'
            };
        }
        console.log('✅ Quiz answers revealed successfully!');
        console.log('  TX ID:', result.data?.txId);
        console.log('  Scoring Results:', result.data?.scoringResults);
        return {
            success: true,
            quizId: result.data?.quizId,
            contractRev: result.data?.contractRev,
            txId: result.data?.txId,
            status: result.data?.status,
            revealTimestamp: result.data?.revealTimestamp,
            scoringResults: result.data?.scoringResults
        };
    }
    catch (error) {
        console.error('❌ Failed to reveal quiz answers:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to reveal answers'
        };
    }
}
/**
 * Get reveal status for a quiz
 *
 * @param quizId - Quiz ID (database or contract ID)
 * @returns Reveal status information including attempt stats
 */
export async function getQuizRevealStatus(quizId) {
    try {
        const response = await fetch(`/api/quizzes/${quizId}/reveal`);
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
        console.error('Error fetching quiz reveal status:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get reveal status'
        };
    }
}
//# sourceMappingURL=quiz-service.js.map