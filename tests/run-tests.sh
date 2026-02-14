#!/bin/bash

# PO Token Test Runner
# Runs all PO token tests and generates a report

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "══════════════════════════════════════════════════════════════"
echo "           PO TOKEN TEST RUNNER"
echo "══════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PO token server is running
echo -e "${YELLOW}[CHECK]${NC} Verifying PO Token server is running..."
if ! curl -s "http://127.0.0.1:4416/health" > /dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} PO Token server is not running!"
    echo ""
    echo "Please start the app first:"
    echo "  npm run electron:dev"
    echo ""
    echo "Or in another terminal:"
    echo "  curl http://127.0.0.1:4416/health  # Should return {running: true, ...}"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} PO Token server is running"
echo ""

# Run TypeScript tests with ts-node or npx tsx
echo -e "${YELLOW}[TEST 1]${NC} Running PO Token Unit Tests..."
echo "────────────────────────────────────────────────────────────────"

cd "$PROJECT_DIR"

# Try with npx tsx first (faster), fallback to ts-node
if command -v npx &> /dev/null; then
    npx tsx tests/pot-token.test.ts 2>&1 || {
        echo ""
        echo -e "${YELLOW}[FALLBACK]${NC} tsx failed, trying ts-node..."
        npx ts-node --esm tests/pot-token.test.ts 2>&1
    }
else
    echo -e "${RED}[ERROR]${NC} npx not found. Please install node/npm."
    exit 1
fi

echo ""

# Run integration tests
echo -e "${YELLOW}[TEST 2]${NC} Running PO Token Integration Tests..."
echo "────────────────────────────────────────────────────────────────"

npx tsx tests/pot-token-integration.test.ts 2>&1 || {
    echo ""
    echo -e "${YELLOW}[FALLBACK]${NC} tsx failed, trying ts-node..."
    npx ts-node --esm tests/pot-token-integration.test.ts 2>&1
}

echo ""
echo "══════════════════════════════════════════════════════════════"
echo -e "${GREEN}All tests completed!${NC}"
echo "══════════════════════════════════════════════════════════════"
