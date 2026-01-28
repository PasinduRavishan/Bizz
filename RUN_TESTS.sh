#!/bin/bash

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  🧪 BITCOIN COMPUTER QUIZ PLATFORM - COMPREHENSIVE TEST SUITE"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  This will run the complete integration test suite that verifies:"
echo "    • Quiz creation with prize pool locking"
echo "    • Student attempts with commit-reveal scheme"
echo "    • Teacher reveal and auto-scoring"
echo "    • Prize distribution via Payment contracts"
echo "    • Winner prize claiming"
echo "    • Complete fund flow tracking"
echo ""
echo "  Expected duration: ~90 seconds"
echo "  Tests: 24 test cases across 9 suites"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "  ⚠️  Dependencies not installed. Running npm install..."
    npm install
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo ""
    echo "  ⚠️  WARNING: .env.local not found!"
    echo "  Please ensure the following environment variables are set:"
    echo "    NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK=regtest"
    echo "    NEXT_PUBLIC_BITCOIN_COMPUTER_URL=https://rltc.node.bitcoincomputer.io"
    echo ""
    read -p "  Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "  🚀 Starting test suite..."
echo ""

# Run the tests
npm run test:flow

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo "  ✅ ALL TESTS PASSED!"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "  🎉 Your Bitcoin Computer Quiz Platform is PRODUCTION READY!"
    echo ""
    echo "  What was verified:"
    echo "    ✅ Smart contract deployment and execution"
    echo "    ✅ Fund locking and transfer on blockchain"
    echo "    ✅ Commit-reveal security scheme"
    echo "    ✅ Automatic scoring and verification"
    echo "    ✅ Prize distribution mechanics"
    echo "    ✅ Payment claiming functionality"
    echo "    ✅ Complete fund flow accuracy"
    echo "    ✅ Error handling and edge cases"
    echo ""
    echo "════════════════════════════════════════════════════════════════════════════════"
else
    echo ""
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo "  ❌ TESTS FAILED"
    echo "════════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "  Please review the error messages above and:"
    echo "    1. Check that regtest node is accessible"
    echo "    2. Verify environment variables are set correctly"
    echo "    3. Ensure faucet is working"
    echo "    4. Try running again (mempool conflicts can occur)"
    echo ""
    echo "  For help, see: TEST_GUIDE.md"
    echo ""
    echo "════════════════════════════════════════════════════════════════════════════════"
    exit 1
fi
