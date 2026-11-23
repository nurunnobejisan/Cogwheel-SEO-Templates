#!/bin/bash
# Auto-commit and push all changes to GitHub
cd /Users/jisanjomadder/Cogwheel-SEO-Templates

# Check if there are any changes (staged, unstaged, or untracked)
if [ -z "$(git status --porcelain)" ]; then
  exit 0  # Nothing to push
fi

# Stage all changes (respects .gitignore — .env.local won't be pushed)
git add -A

# Commit with timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
git commit -m "auto: update ${TIMESTAMP}" --no-verify

# Push to GitHub
git push origin main --quiet

