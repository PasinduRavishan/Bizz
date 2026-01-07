/**
 * Quiz Verification Logic
 * 
 * Handles scoring, verification, and payouts
 * This is NOT a contract, just helper functions
 */

/**
 * Calculate score for a student attempt
 * 
 * @param {string[]} studentAnswers - Student's revealed answers
 * @param {string[]} correctAnswers - Teacher's revealed correct answers
 * @returns {Object} Score details
 */
export function calculateScore(studentAnswers, correctAnswers) {
  if (!studentAnswers || !correctAnswers) {
    throw new Error('Answers required')
  }

  if (studentAnswers.length !== correctAnswers.length) {
    throw new Error('Answer count mismatch')
  }

  let correct = 0
  const total = correctAnswers.length

  for (let i = 0; i < total; i++) {
    if (studentAnswers[i] === correctAnswers[i]) {
      correct++
    }
  }

  const percentage = Math.floor((correct / total) * 100)

  return {
    correct,
    total,
    percentage,
    incorrectCount: total - correct
  }
}

/**
 * Determine if student passed based on score and threshold
 * Always rounds UP the required correct answers
 * 
 * @param {number} score - Student's percentage score
 * @param {number} threshold - Pass threshold percentage
 * @param {number} totalQuestions - Total questions in quiz
 * @returns {boolean} Whether student passed
 */
export function didPass(score, threshold, totalQuestions) {
  // Calculate required correct answers (round UP)
  const requiredCorrect = Math.ceil((threshold / 100) * totalQuestions)
  const actualCorrect = Math.floor((score / 100) * totalQuestions)
  
  return actualCorrect >= requiredCorrect
}

/**
 * Verify all attempts for a quiz and determine winners
 * 
 * @param {Object} quiz - Quiz contract instance
 * @param {Array} attempts - Array of QuizAttempt instances
 * @param {Object} computer - Bitcoin Computer instance
 * @returns {Object} Verification results
 */
export async function verifyQuiz(quiz, attempts, computer) {
  if (quiz.status !== 'revealed') {
    throw new Error('Quiz must be revealed first')
  }

  if (!quiz.revealedAnswers) {
    throw new Error('Correct answers not revealed')
  }

  const results = {
    totalAttempts: attempts.length,
    revealed: 0,
    notRevealed: 0,
    passed: [],
    failed: [],
    scores: []
  }

  // Process each attempt
  for (const attempt of attempts) {
    // Skip if student didn't reveal
    if (attempt.status !== 'revealed') {
      results.notRevealed++
      continue
    }

    results.revealed++

    // Calculate score
    const score = calculateScore(
      attempt.revealedAnswers,
      quiz.revealedAnswers
    )

    // Determine if passed
    const passed = didPass(
      score.percentage,
      quiz.passThreshold,
      quiz.questionCount
    )

    // Store result
    const result = {
      attemptId: attempt._id,
      student: attempt.student,
      score: score.percentage,
      correct: score.correct,
      total: score.total,
      passed
    }

    results.scores.push(result)

    if (passed) {
      results.passed.push(result)
    } else {
      results.failed.push(result)
    }
  }

  return results
}

/**
 * Calculate payouts for quiz
 * 
 * @param {Object} quiz - Quiz contract
 * @param {Array} winners - Array of winner objects from verifyQuiz
 * @returns {Object} Payout distribution
 */
export function calculatePayouts(quiz, winners) {
  const totalEntryFees = BigInt(quiz.attemptRefs.length) * quiz.entryFee
  const platformFee = BigInt(Math.floor(Number(totalEntryFees) * quiz.platformFee))
  const teacherFees = totalEntryFees - platformFee
  const prizePool = quiz._satoshis

  const payouts = {
    platform: platformFee,
    teacher: teacherFees,
    students: []
  }

  if (winners.length === 0) {
    // No winners: teacher gets prize back + entry fees
    payouts.teacher = teacherFees + prizePool
  } else {
    // Winners split prize pool equally
    const prizePerWinner = prizePool / BigInt(winners.length)
    
    for (const winner of winners) {
      payouts.students.push({
        student: winner.student,
        amount: prizePerWinner,
        score: winner.score
      })
    }
  }

  return payouts
}

/**
 * Calculate refunds if teacher doesn't reveal
 * 
 * @param {Object} quiz - Quiz contract
 * @returns {Object} Refund distribution
 */
export function calculateRefunds(quiz) {
  const totalEntryFees = BigInt(quiz.attemptRefs.length) * quiz.entryFee
  const platformFee = BigInt(Math.floor(Number(totalEntryFees) * quiz.platformFee))
  const refundPool = totalEntryFees - platformFee + quiz._satoshis
  
  const perStudent = quiz.attemptRefs.length > 0 
    ? refundPool / BigInt(quiz.attemptRefs.length)
    : 0n

  return {
    platform: platformFee,
    perStudent,
    totalStudents: quiz.attemptRefs.length,
    totalRefund: refundPool
  }
}