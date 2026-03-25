#!/bin/bash

# Auto-rebranding script for 2501-Bot
# Replaces 'agent-zero' with '2501-bot' and 'Agent Zero' with 'Project 2501'

set -e

echo "🔄 Starting auto-rebranding..."

# Define replacements
REPLACEMENTS=(
    "agent-zero:2501-bot"
    "Agent Zero:Project Zero"
    "agent_zero:project_zero"
    "agent-zero:2501-bot"
    "AgentZero:ProjectZero"
    "AGENT-ZERO:2501-BOT"
    "AGENT_ZERO:PROJECT_ZERO"
)

# Find files to rebrand (excluding node_modules, .git, out, build)
find . -type f \
    -not -path "./node_modules/*" \
    -not -path "./.git/*" \
    -not -path "./out/*" \
    -not -path "./build/*" \
    -not -path "./dist/*" \
    -not -name "*.lock" \
    -not -name "package-lock.json" \
    -not -name "yarn.lock" \
    -not -name "pnpm-lock.yaml" \
    \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.md" -o -name "*.yml" -o -name "*.yaml" -o -name "*.sh" \) \
    -print0 | while IFS= read -r -d '' file; do
    
    for replacement in "${REPLACEMENTS[@]}"; do
        old="${replacement%%:*}"
        new="${replacement#*:}"
        
        # Check if file contains the old string
        if grep -q "$old" "$file" 2>/dev/null; then
            echo "📝 Replacing '$old' with '$new' in $file"
            sed -i "s/$old/$new/g" "$file"
        fi
    done
done

echo "✅ Auto-rebranding complete!"
echo ""
echo "📋 Summary of changes:"
echo "   - agent-zero → 2501-bot"
echo "   - Agent Zero → Project 2501"
echo "   - agent_zero → project_2501"
echo "   - AgentZero → Project2501"
echo "   - AGENT-ZERO → 2501-BOT"
echo "   - AGENT_ZERO → PROJECT_2501"
