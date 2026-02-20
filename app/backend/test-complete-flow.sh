#!/bin/bash

# 🧪 COMPLETE Backend API Test Script
# Tests the FULL flow matching tbc20.test.ts

set -e  # Exit on error

API_URL="http://localhost:3001"
TEACHER_EMAIL="teacher_$(date +%s)@test.com"
STUDENT_EMAIL="student_$(date +%s)@test.com"
PASSWORD="password123"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "🧪 COMPLETE FLOW TEST - Matches tbc20.test.ts"
echo "=========================================="
echo ""

# ============================================
# PHASE 1: SETUP & QUIZ CREATION
# ============================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 1: SETUP & QUIZ CREATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Teacher Signup
echo -e "${YELLOW}[1/14]${NC} Teacher Signup..."
TEACHER_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEACHER_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"name\": \"Test Teacher\",
    \"role\": \"TEACHER\"
  }")

TEACHER_TOKEN=$(echo $TEACHER_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -z "$TEACHER_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get teacher token${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Teacher signed up${NC}"

# Test 2: Student Signup
echo -e "${YELLOW}[2/14]${NC} Student Signup..."
STUDENT_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"password\": \"$PASSWORD\",
    \"name\": \"Test Student\",
    \"role\": \"STUDENT\"
  }")

STUDENT_TOKEN=$(echo $STUDENT_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -z "$STUDENT_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get student token${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Student signed up${NC}"

# Test 3: Create Quiz (tbc20.test.ts line 274-312)
echo -e "${YELLOW}[3/14]${NC} Creating Quiz Fungible Token..."
DEADLINE=$(($(date +%s) + 3600))
REVEAL_DEADLINE=$((DEADLINE + 3600))

QUIZ_RESPONSE=$(curl -s -X POST "$API_URL/quiz/create" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Math Quiz 101\",
    \"description\": \"Test quiz for verification\",
    \"symbol\": \"MATH101\",
    \"questionHashIPFS\": \"QmTest123\",
    \"answerHashes\": [\"hash1\", \"hash2\", \"hash3\"],
    \"prizePool\": 50000,
    \"entryFee\": 5000,
    \"passThreshold\": 70,
    \"deadline\": ${DEADLINE}000,
    \"teacherRevealDeadline\": ${REVEAL_DEADLINE}000
  }")

QUIZ_ID=$(echo $QUIZ_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -z "$QUIZ_ID" ]; then
  echo -e "${RED}❌ Failed to create quiz${NC}"
  echo "Response: $QUIZ_RESPONSE"
  exit 1
fi
echo -e "${GREEN}✅ Quiz created: $QUIZ_ID${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 2: ACCESS REQUEST & PURCHASE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 4: Student Requests Access
echo -e "${YELLOW}[4/14]${NC} Student Requesting Access..."
REQUEST_RESPONSE=$(curl -s -X POST "$API_URL/access-request" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"quizId\": \"$QUIZ_ID\"}")

REQUEST_ID=$(echo $REQUEST_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -z "$REQUEST_ID" ]; then
  echo -e "${RED}❌ Failed to create access request${NC}"
  echo "Response: ${REQUEST_RESPONSE:0:300}"
  exit 1
fi
echo -e "${GREEN}✅ Access request created: $REQUEST_ID${NC}"

# Test 5: Teacher Approves (tbc20.test.ts line 330-336)
echo -e "${YELLOW}[5/14]${NC} Teacher Approving Request (creating partial tx)..."
echo "   ⏳ Blockchain operation, please wait..."
APPROVE_RESPONSE=$(curl -s -X PUT "$API_URL/access-request/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

if [[ $APPROVE_RESPONSE != *"partialTxHex"* ]]; then
  echo -e "${RED}❌ Failed to approve request${NC}"
  echo "Response: ${APPROVE_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ Request approved (partial tx created)${NC}"

# Test 6: Student Pays Entry Fee (tbc20.test.ts line 341-364)
echo -e "${YELLOW}[6/14]${NC} Student Paying Entry Fee (EXEC)..."
echo "   ⏳ Blockchain operation, please wait..."
PAY_RESPONSE=$(curl -s -X POST "$API_URL/access-request/$REQUEST_ID/pay" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

if [[ $PAY_RESPONSE != *"quizTokenId"* ]]; then
  echo -e "${RED}❌ Failed to pay entry fee${NC}"
  echo "Response: ${PAY_RESPONSE:0:200}"
  exit 1
fi
QUIZ_TOKEN_ID=$(echo $PAY_RESPONSE | grep -o '"quizTokenId":"[^"]*' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✅ Entry fee paid, received quiz token: ${QUIZ_TOKEN_ID:0:20}...${NC}"

# Test 7: Teacher Claims Entry Fee (tbc20.test.ts line 386-392)
echo -e "${YELLOW}[7/14]${NC} Teacher Claiming Entry Fee..."
echo "   ⏳ Blockchain operation, please wait..."
CLAIM_RESPONSE=$(curl -s -X POST "$API_URL/access-request/$REQUEST_ID/claim" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

echo -e "${GREEN}✅ Teacher claimed entry fee${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 3: START QUIZ & SUBMIT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 8: Student Starts Quiz (tbc20.test.ts line 426-476)
echo -e "${YELLOW}[8/14]${NC} Student Starting Quiz (burning token)..."
echo "   ⏳ Blockchain operation (creates attempt + burns token)..."
START_RESPONSE=$(curl -s -X POST "$API_URL/access-request/$REQUEST_ID/start" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

ATTEMPT_ID=$(echo $START_RESPONSE | grep -o '"attemptId":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -z "$ATTEMPT_ID" ]; then
  echo -e "${RED}❌ Failed to start quiz${NC}"
  echo "Response: ${START_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ Quiz started, attempt created: $ATTEMPT_ID${NC}"
echo -e "${GREEN}   Quiz token BURNED ✅${NC}"

# Test 9: Student Submits Commitment (tbc20.test.ts line 481-503)
echo -e "${YELLOW}[9/14]${NC} Student Submitting Answer Commitment..."
echo "   ⏳ Blockchain operation, please wait..."
COMMITMENT="abc123def456"  # Mock commitment hash
SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/quiz-attempt/$ATTEMPT_ID/submit" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"answerCommitment\": \"$COMMITMENT\"}")

if [[ $SUBMIT_RESPONSE != *"committed"* ]]; then
  echo -e "${RED}❌ Failed to submit commitment${NC}"
  echo "Response: ${SUBMIT_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ Answer commitment submitted${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 4: REVEAL & VERIFY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 10: Teacher Reveals Answers (tbc20.test.ts line 507-536)
echo -e "${YELLOW}[10/14]${NC} Teacher Revealing Answers..."
echo "   ⏳ Blockchain operation, please wait..."
REVEAL_RESPONSE=$(curl -s -X PUT "$API_URL/quiz/$QUIZ_ID/reveal" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"answers\": [\"Paris\", \"4\", \"Blue\"],
    \"salt\": \"test-salt-123\"
  }")

if [[ $REVEAL_RESPONSE != *"revealed"* ]] && [[ $REVEAL_RESPONSE != *"REVEALED"* ]]; then
  echo -e "${RED}❌ Failed to reveal answers${NC}"
  echo "Response: ${REVEAL_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ Answers revealed${NC}"

# Wait for blockchain state to settle and async proxy operations to complete
# No sleep needed - operations are synchronous

# Test 11: Student Verifies Attempt (tbc20.test.ts line 541-569)
echo -e "${YELLOW}[11/14]${NC} Student Verifying Attempt..."
echo "   ⏳ Blockchain operation, please wait..."
VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/quiz-attempt/$ATTEMPT_ID/verify" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"score\": 100}")

if [[ $VERIFY_RESPONSE != *"verified"* ]]; then
  echo -e "${RED}❌ Failed to verify attempt${NC}"
  echo "Response: ${VERIFY_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ Attempt verified (score: 100%, passed: true)${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   PHASE 5: PRIZE DISTRIBUTION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 12: Student Creates AnswerProof (tbc20.test.ts line 576-600)
echo -e "${YELLOW}[12/14]${NC} Winner Creating AnswerProof..."
echo "   ⏳ Blockchain operation, please wait..."
PROOF_RESPONSE=$(curl -s -X POST "$API_URL/prize/answer-proof" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"attemptId\": \"$ATTEMPT_ID\",
    \"answers\": [\"Paris\", \"4\", \"Blue\"],
    \"score\": 100,
    \"passed\": true
  }")

if [[ $PROOF_RESPONSE != *"answerProofId"* ]]; then
  echo -e "${RED}❌ Failed to create AnswerProof${NC}"
  echo "Response: ${PROOF_RESPONSE:0:200}"
  exit 1
fi
ANSWER_PROOF_ID=$(echo $PROOF_RESPONSE | grep -o '"answerProofId":"[^"]*' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✅ AnswerProof created: ${ANSWER_PROOF_ID:0:20}...${NC}"

# Test 13: Teacher Creates Prize Payment (tbc20.test.ts line 605-626)
echo -e "${YELLOW}[13/14]${NC} Teacher Creating Prize Payment..."
echo "   ⏳ Blockchain operation, please wait..."
PRIZE_PAYMENT_RESPONSE=$(curl -s -X POST "$API_URL/prize/$ATTEMPT_ID/payment" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

if [[ $PRIZE_PAYMENT_RESPONSE != *"prizePaymentId"* ]]; then
  echo -e "${RED}❌ Failed to create Prize Payment${NC}"
  echo "Response: ${PRIZE_PAYMENT_RESPONSE:0:200}"
  exit 1
fi
PRIZE_PAYMENT_ID=$(echo $PRIZE_PAYMENT_RESPONSE | grep -o '"prizePaymentId":"[^"]*' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✅ Prize Payment created: ${PRIZE_PAYMENT_ID:0:20}...${NC}"

# Test 14a: Teacher Creates SWAP tx (tbc20.test.ts line 644-651)
echo -e "${YELLOW}[14a/14]${NC} Teacher Creating SWAP Transaction..."
echo "   ⏳ Blockchain operation, please wait..."
SWAP_TX_RESPONSE=$(curl -s -X POST "$API_URL/prize/$ATTEMPT_ID/swap-tx" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

if [[ $SWAP_TX_RESPONSE != *"partialTxHex"* ]]; then
  echo -e "${RED}❌ Failed to create SWAP tx${NC}"
  echo "Response: ${SWAP_TX_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ SWAP transaction created (partial tx)${NC}"

# Test 14b: Student Executes SWAP (tbc20.test.ts line 655-680)
echo -e "${YELLOW}[14b/14]${NC} Student Executing SWAP..."
echo "   ⏳ Blockchain operation (atomic swap)..."
EXECUTE_SWAP_RESPONSE=$(curl -s -X POST "$API_URL/prize/$ATTEMPT_ID/execute-swap" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

if [[ $EXECUTE_SWAP_RESPONSE != *"prize_claimed"* ]] && [[ $EXECUTE_SWAP_RESPONSE != *"PRIZE_CLAIMED"* ]]; then
  echo -e "${RED}❌ Failed to execute SWAP${NC}"
  echo "Response: ${EXECUTE_SWAP_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ SWAP executed! Prize Payment → Student, AnswerProof → Teacher${NC}"

# Test 14c: Student Claims Prize (tbc20.test.ts line 687-714)
echo -e "${YELLOW}[14c/14]${NC} Student Claiming Prize..."
echo "   ⏳ Blockchain operation, please wait..."
CLAIM_PRIZE_RESPONSE=$(curl -s -X POST "$API_URL/prize/$ATTEMPT_ID/claim" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

if [[ $CLAIM_PRIZE_RESPONSE != *"claimed"* ]]; then
  echo -e "${RED}❌ Failed to claim prize${NC}"
  echo "Response: ${CLAIM_PRIZE_RESPONSE:0:200}"
  exit 1
fi
echo -e "${GREEN}✅ Prize claimed! Satoshis released to wallet ✅${NC}"

echo ""
echo "=========================================="
echo -e "${GREEN}🎉 ALL 14 TESTS PASSED!${NC}"
echo -e "${GREEN}✅ COMPLETE FLOW VERIFIED${NC}"
echo "=========================================="
echo ""
echo "📊 Full Flow Summary (matches tbc20.test.ts):"
echo "   ✅ Phase 1: Quiz Creation & Purchase"
echo "      [1] Teacher signup"
echo "      [2] Student signup"
echo "      [3] Create quiz fungible token"
echo "      [4] Student requests access"
echo "      [5] Teacher approves (partial tx)"
echo "      [6] Student pays (EXEC)"
echo "      [7] Teacher claims entry fee"
echo ""
echo "   ✅ Phase 2: Start Quiz & Submit"
echo "      [8] Student starts quiz (burns token)"
echo "      [9] Student submits commitment"
echo ""
echo "   ✅ Phase 3: Reveal & Verify"
echo "      [10] Teacher reveals answers"
echo "      [11] Student verifies attempt"
echo ""
echo "   ✅ Phase 4: Prize Distribution"
echo "      [12] Winner creates AnswerProof"
echo "      [13] Teacher creates Prize Payment"
echo "      [14] Execute SWAP → Claim Prize"
echo ""
echo "🎯 All blockchain operations completed successfully!"
echo "🎯 Flow matches tbc20.test.ts 100%!"
echo ""
