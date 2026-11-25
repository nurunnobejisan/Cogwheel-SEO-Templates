#!/bin/sh
# Cogwheel SEO Templates — Git Pre-Commit Hook
# Prevents committing secrets or breaking SEO integrity gates

echo "🔍 Running pre-commit secret scan..."
if grep -rnE "(ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35})" src/ validators/ schemas/ exporters/ 2>/dev/null; then
  echo "❌ COMMIT BLOCKED: Secret or credential detected!"
  exit 1
fi

echo "🚀 Running 10-Gate SEO Integrity Linter..."
./node_modules/.bin/tsx tests/ts/seoLinter.ts
if [ $? -ne 0 ]; then
  echo "❌ COMMIT BLOCKED: SEO Integrity Linter failed."
  exit 1
fi

echo "✅ Pre-commit verification passed."
exit 0
