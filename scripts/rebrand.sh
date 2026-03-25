#!/bin/bash
# Auto-rebranding script for 2501-Bot
# This script replaces Agent Zero branding with 2501-Bot branding

echo "🔄 Starting auto-rebranding..."

# Define replacements
REPLACEMENTS=(
    "agent-zero:2501-bot"
    "Agent Zero:Project 2501"
    "agent_zero:project_2501"
    "AgentZero:Project2501"
    "AGENT-ZERO:2501-BOT"
    "AGENT_ZERO:PROJECT_2501"
)

# Find files to rebrand (excluding node_modules, .git, out, build)
FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.yml" -o -name "*.html" \) \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/out/*" ! -path "*/build/*")

# Apply replacements
for file in $FILES; do
    for replacement in "${REPLACEMENTS[@]}"; do
        # Split replacement into search and replace
        search="${replacement%%:*}"
        replace="${replacement#*:}"
        
        # Apply replacement
        sed -i "s|$search|$replace|g" "$file"
    done
    echo "✅ Rebranded: $file"
done

echo "🎉 Rebranding complete!"

# Special handling for package.json
if [ -f "package.json" ]; then
    echo "📦 Updating package.json..."
    sed -i 's|"name": "agent-zero"|"name": "2501-bot"|g' package.json
    sed -i 's|"productName": "Agent Zero"|"productName": "2501 Bot"|g' package.json
    sed -i 's|"appId": "com.agent-zero"|"appId": "com.cuadralabs.2501-bot"|g' package.json
    sed -i 's|"description": "Agent Zero"|"description": "Project 2501 - AI Assistant"|g' package.json
fi

# Special handling for README.md
if [ -f "README.md" ]; then
    echo "📖 Updating README.md..."
    sed -i 's|# Agent Zero|# 2501-Bot|g' README.md
    sed -i 's|Agent Zero|Project 2501|g' README.md
    sed -i 's|agent-zero|2501-bot|g' README.md
fi

echo "✅ All done!"
