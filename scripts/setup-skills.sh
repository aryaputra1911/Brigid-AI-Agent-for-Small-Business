#!/usr/bin/env bash
# Install the agent skills used for the Brigid project.
# Run from the repository root: bash scripts/setup-skills.sh
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .agents/skills

echo "==> clone-website"
npx -y skillfish add hemkumar247/ai-skills clone-website

echo "==> code-reviewer"
npx -y skillfish add swiftyjunnos/claude-code-with-tdd code-reviewer

echo "==> anti-slop (Antigravity plugin)"
agy plugin install https://github.com/miqdadbadjuber/anti-slop

echo "==> ui-ux-pro-max (global CLI)"
npm install -g ui-ux-pro-max-cli

echo "==> logo-design-skill"
if [ ! -d .agents/skills/logo-design ]; then
  git clone --depth 1 https://github.com/kaankiziltug/logo-design-skill .agents/skills/logo-design
fi

# skillfish may install into .claude/skills. Antigravity discovers .agents/skills,
# so mirror anything found there.
if [ -d .claude/skills ]; then
  for dir in .claude/skills/*/; do
    name="$(basename "$dir")"
    [ -e ".agents/skills/$name" ] || cp -r "$dir" ".agents/skills/$name"
  done
fi

echo "Done. Installed skills:"
ls -1 .agents/skills
