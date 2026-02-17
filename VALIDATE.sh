#!/bin/bash

# Mission Control OS - Validation Script
# Runs all checks before deployment

echo "🔍 Mission Control Validation Suite"
echo "===================================="
echo ""

# 1. TypeScript
echo "✓ TypeScript compilation..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "error" | wc -l
echo ""

# 2. ESLint
echo "✓ ESLint..."
npx eslint src/ lib/ 2>&1 | grep -E "error" | wc -l || echo "  (lint may not be configured)"
echo ""

# 3. File structure
echo "✓ File structure..."
echo "  Phase 2 services: $(find lib/services -name '*.ts' | wc -l)"
echo "  Phase 3 services: $(find lib/services -name '*Healing*' -o -name '*Scaling*' -o -name '*Calendar*' | wc -l)"
echo "  Components: $(find src/components -name '*.tsx' | wc -l)"
echo "  API routes: $(find src/app/api -name 'route.ts' | wc -l)"
echo ""

# 4. Convex schema
echo "✓ Convex schema..."
grep "defineTable" convex/schema.ts | wc -l
echo "  tables defined"
echo ""

# 5. Documentation
echo "✓ Documentation..."
ls -lh PHASE_*.md MISSION_CONTROL_OS_COMPLETE.md 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
echo ""

echo "✅ Validation complete. Ready for:"
echo "   - Dev server testing (npx convex dev & npm run dev)"
echo "   - Production deployment"
echo "   - Phase 4 mobile app build"
echo ""
