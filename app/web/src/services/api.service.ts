/**
 * API Service Layer
 *
 * Centralized service for all API calls to the NestJS backend.
 * Maps old Next.js API routes to new NestJS endpoints.
 *
 * Usage:
 * import { apiService } from '@/services/api.service';
 * const quizzes = await apiService.quiz.getAll();
 */

import { api } from '@/lib/api';

// ============================================================================
// Auth API
// ============================================================================
export const authApi = {
  /**
   * Signup new user (creates wallet automatically)
   * POST /auth/signup
   */
  signup: (data: { email: string; password: string; name: string; role: 'STUDENT' | 'TEACHER' }) =>
    api.post('/auth/signup', data),

  /**
   * Login user
   * POST /auth/login
   */
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  /**
   * Get current user profile
   * GET /auth/profile
   */
  getProfile: () =>
    api.get('/auth/profile'),
};

// ============================================================================
// Quiz API
// ============================================================================
export const quizApi = {
  /**
   * Get all quizzes
   * GET /quiz
   */
  getAll: (params?: { status?: string; teacherId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.teacherId) qs.set('teacherId', params.teacherId)
    const query = qs.toString()
    return api.get('/quiz' + (query ? `?${query}` : ''))
  },

  /**
   * Get quiz by ID
   * GET /quiz/:id
   */
  getById: (id: string) =>
    api.get(`/quiz/${id}`),

  /**
   * Create new quiz from UI (Teacher only)
   * POST /quiz/create-ui
   *
   * Accepts user-friendly data:
   * - title, questions, correctAnswers (plain text)
   * - Backend handles IPFS upload and answer hashing
   */
  create: (data: {
    title: string;
    description?: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
    }>;
    correctAnswers: string[];
    prizePool: number;
    entryFee: number;
    passThreshold: number;
    deadline: string; // ISO date string
    initialSupply?: number;
  }) =>
    api.post('/quiz/create-ui', data),

  /**
   * Reveal answers (Teacher only)
   * PUT /quiz/:id/reveal
   * answers and salt are optional — backend uses stored DB values if omitted
   */
  reveal: (id: string, data?: { answers?: string[]; salt?: string }) =>
    api.put(`/quiz/${id}/reveal`, data ?? {}),

  /**
   * Delete quiz (Teacher only)
   * DELETE /quiz/:id
   */
  delete: (id: string) =>
    api.delete(`/quiz/${id}`),
};

// ============================================================================
// Access Request API (NEW - replaces old quiz-access routes)
// ============================================================================
export const accessRequestApi = {
  /**
   * Student requests access to quiz
   * POST /access-request
   * OLD: POST /api/student/attempt/request
   */
  create: (data: { quizId: string }) =>
    api.post('/access-request', data),

  /**
   * Get student's access requests
   * GET /access-request/student
   * OLD: GET /api/access-requests/my
   */
  getMyRequests: () =>
    api.get('/access-request/student'),

  /**
   * Get teacher's pending requests
   * GET /access-request/teacher
   * OLD: GET /api/access-requests/pending
   */
  getPendingRequests: () =>
    api.get('/access-request/teacher'),

  /**
   * Teacher approves request (creates partial tx)
   * PUT /access-request/:id/approve
   * OLD: POST /api/access-requests/:id/approve
   */
  approve: (id: string) =>
    api.put(`/access-request/${id}/approve`),

  /**
   * Student pays entry fee (EXEC - completes partial tx)
   * POST /access-request/:id/pay
   * OLD: POST /api/student/quiz-access/complete
   */
  pay: (id: string) =>
    api.post(`/access-request/${id}/pay`),

  /**
   * Teacher claims entry fee payment
   * POST /access-request/:id/claim
   */
  claim: (id: string) =>
    api.post(`/access-request/${id}/claim`),

  /**
   * Student starts quiz (burns token, creates attempt)
   * POST /access-request/:id/start
   * OLD: POST /api/student/quiz-access/prepare (partially)
   */
  start: (id: string) =>
    api.post(`/access-request/${id}/start`),
};

// ============================================================================
// Quiz Attempt API
// ============================================================================
export const attemptApi = {
  /**
   * Get student's attempts
   * GET /quiz-attempt/student
   * OLD: GET /api/student/attempts
   */
  getMyAttempts: () =>
    api.get('/quiz-attempt/student'),

  /**
   * Get attempt by ID
   * GET /quiz-attempt/:id
   * OLD: GET /api/student/attempt/:id
   */
  getById: (id: string) =>
    api.get(`/quiz-attempt/${id}`),

  /**
   * Submit answer commitment
   * POST /quiz-attempt/:id/submit
   * OLD: POST /api/student/attempt/submit
   */
  submit: (id: string, data: { answerCommitment: string }) =>
    api.post(`/quiz-attempt/${id}/submit`, data),

  /**
   * Verify attempt (backend computes score server-side from answerCommitment + revealedAnswers)
   * POST /quiz-attempt/:id/verify
   * OLD: POST /api/student/attempt/:id/verify
   */
  verify: (id: string, data?: { score?: number }) =>
    api.post(`/quiz-attempt/${id}/verify`, data ?? {}),
};

// ============================================================================
// Prize API
// ============================================================================
export const prizeApi = {
  /**
   * Create AnswerProof
   * POST /prize/answer-proof
   * OLD: POST /api/student/prize/:attemptId/answer-proof
   */
  // Backend derives answers/score/passed from DB — only attemptId needed
  createAnswerProof: (data: {
    attemptId: string;
    answers?: string[];
    score?: number;
    passed?: boolean;
  }) =>
    api.post('/prize/answer-proof', data),

  /**
   * Create Prize Payment (Teacher)
   * POST /prize/:attemptId/payment
   * OLD: POST /api/teacher/prize/:attemptId/payment
   */
  createPrizePayment: (attemptId: string) =>
    api.post(`/prize/${attemptId}/payment`),

  /**
   * Create SWAP transaction (Teacher)
   * POST /prize/:attemptId/swap-tx
   * OLD: POST /api/student/prize/:attemptId/swap/prepare
   */
  createSwapTx: (attemptId: string) =>
    api.post(`/prize/${attemptId}/swap-tx`),

  /**
   * Execute SWAP (Student)
   * POST /prize/:attemptId/execute-swap
   * OLD: POST /api/student/prize/:attemptId/swap/complete
   */
  executeSwap: (attemptId: string) =>
    api.post(`/prize/${attemptId}/execute-swap`),

  /**
   * Claim prize (Student)
   * POST /prize/:attemptId/claim
   * OLD: POST /api/student/prize/claim
   */
  claim: (attemptId: string) =>
    api.post(`/prize/${attemptId}/claim`),
};

// ============================================================================
// Wallet API
// ============================================================================
export const walletApi = {
  /**
   * Get wallet balance
   * GET /wallet/balance
   * OLD: GET /api/wallet/balance
   */
  getBalance: () =>
    api.get('/wallet/balance'),

  /**
   * Fund wallet from faucet (dev only)
   * POST /wallet/faucet
   * OLD: POST /api/wallet/faucet
   */
  faucet: (data: { amount: number }) =>
    api.post('/wallet/faucet', data),
};

// ============================================================================
// Unified API Service
// ============================================================================
export const apiService = {
  auth: authApi,
  quiz: quizApi,
  accessRequest: accessRequestApi,
  attempt: attemptApi,
  prize: prizeApi,
  wallet: walletApi,
};
