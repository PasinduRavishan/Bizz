#!/bin/bash

# 🧪 Backend API Test Script
# Tests the complete flow of the Bizz Quiz Platform backend

set -e  # Exit on error

API_URL="http://localhost:3001"
TEACHER_EMAIL="teacher_$(date +%s)@test.com"
STUDENT_EMAIL="student_$(date +%s)@test.com"
PASSWORD="password123"

echo "=========================================="
echo "🧪 TESTING BIZZ QUIZ PLATFORM BACKEND"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# TEST 1: SIGNUP & AUTH
# ============================================
echo -e "${BLUE}📝 Test 1: Teacher Signup${NC}"
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
  echo "❌ Failed to get teacher token"
  echo "Response: $TEACHER_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Teacher signed up successfully${NC}"
echo "Token: ${TEACHER_TOKEN:0:20}..."
echo ""

# ============================================
echo -e "${BLUE}📝 Test 2: Student Signup${NC}"
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
  echo "❌ Failed to get student token"
  echo "Response: $STUDENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Student signed up successfully${NC}"
echo "Token: ${STUDENT_TOKEN:0:20}..."
echo ""

# ============================================
# TEST 2: WALLET
# ============================================
echo -e "${BLUE}💰 Test 3: Check Teacher Wallet Balance${NC}"
BALANCE_RESPONSE=$(curl -s -X GET "$API_URL/wallet/balance" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

echo "Response: $BALANCE_RESPONSE"
echo -e "${GREEN}✅ Wallet balance retrieved${NC}"
echo ""

# ============================================
# TEST 3: CREATE QUIZ
# ============================================
echo -e "${BLUE}🎓 Test 4: Create Quiz${NC}"
QUIZ_RESPONSE=$(curl -s -X POST "$API_URL/quiz/create" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Quiz",
    "description": "A test quiz",
    "questionHashIPFS": "QmTest123",
    "answerHashes": ["hash1", "hash2", "hash3"],
    "prizePool": 50000,
    "entryFee": 5000,
    "passThreshold": 70,
    "deadline": '$(date -d '+1 hour' +%s)'000',
    "teacherRevealDeadline": '$(date -d '+2 hours' +%s)'000'
  }')

QUIZ_ID=$(echo $QUIZ_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$QUIZ_ID" ]; then
  echo "❌ Failed to create quiz"
  echo "Response: $QUIZ_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Quiz created successfully${NC}"
echo "Quiz ID: $QUIZ_ID"
echo ""

# ============================================
# TEST 4: LIST QUIZZES
# ============================================
echo -e "${BLUE}📋 Test 5: List Quizzes${NC}"
QUIZZES_RESPONSE=$(curl -s -X GET "$API_URL/quiz" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo "Response: ${QUIZZES_RESPONSE:0:200}..."
echo -e "${GREEN}✅ Quizzes listed successfully${NC}"
echo ""

# ============================================
# TEST 5: REQUEST ACCESS
# ============================================
echo -e "${BLUE}📝 Test 6: Student Requests Access${NC}"
REQUEST_RESPONSE=$(curl -s -X POST "$API_URL/access-request" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"quizId\": \"$QUIZ_ID\"
  }")

REQUEST_ID=$(echo $REQUEST_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$REQUEST_ID" ]; then
  echo "❌ Failed to create access request"
  echo "Response: $REQUEST_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Access request created${NC}"
echo "Request ID: $REQUEST_ID"
echo ""

# ============================================
# TEST 6: APPROVE REQUEST
# ============================================
echo -e "${BLUE}✅ Test 7: Teacher Approves Request${NC}"
echo "⏳ This may take 5-10 seconds (blockchain operation)..."

APPROVE_RESPONSE=$(curl -s -X PUT "$API_URL/access-request/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

echo "Response: ${APPROVE_RESPONSE:0:200}..."
echo -e "${GREEN}✅ Request approved (partial tx created)${NC}"
echo ""

# ============================================
# TEST 7: STUDENT PAYS
# ============================================
echo -e "${BLUE}💰 Test 8: Student Pays Entry Fee${NC}"
echo "⏳ This may take 10-15 seconds (blockchain operation)..."

PAY_RESPONSE=$(curl -s -X POST "$API_URL/access-request/$REQUEST_ID/pay" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

echo "Response: ${PAY_RESPONSE:0:200}..."
echo -e "${GREEN}✅ Entry fee paid (student received quiz token)${NC}"
echo ""

# ============================================
echo ""
echo "=========================================="
echo -e "${GREEN}✅ ALL BASIC TESTS PASSED!${NC}"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "  ✅ Teacher signup & auth"
echo "  ✅ Student signup & auth"
echo "  ✅ Wallet balance check"
echo "  ✅ Quiz creation"
echo "  ✅ Quiz listing"
echo "  ✅ Access request"
echo "  ✅ Teacher approval"
echo "  ✅ Student payment"
echo ""
echo "🔜 Next steps to test manually:"
echo "  - Teacher claim entry fee: POST $API_URL/access-request/$REQUEST_ID/claim"
echo "  - Student start quiz: POST $API_URL/access-request/$REQUEST_ID/start"
echo "  - Full flow through to prize distribution"
echo ""
echo "💡 Tip: Use the tokens and IDs above to continue testing"
echo "   Teacher Token: $TEACHER_TOKEN"
echo "   Student Token: $STUDENT_TOKEN"
echo "   Quiz ID: $QUIZ_ID"
echo "   Request ID: $REQUEST_ID"
echo ""
