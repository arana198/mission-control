#!/bin/bash
#
# Heartbeat Coordinator
# Generates and sends heartbeat messages to all 10 agents

set -e

echo "=== Mission Control Heartbeat Coordinator ==="
echo "Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# Agent definitions: name|session_key|cron_minute
AGENTS=(
  "pepper|agent:email-marketing:main|00,15,30,45"
  "shuri|agent:product-analyst:main|02,17,32,47"
  "fury|agent:customer-researcher:main|04,19,34,49"
  "vision|agent:seo-analyst:main|06,21,36,51"
  "loki|agent:content-writer:main|07,22,37,52"
  "wanda|agent:designer:main|08,23,38,53"
  "quill|agent:social-media-manager:main|10,25,40,55"
  "friday|agent:developer:main|12,27,42,57"
  "wong|agent:notion-agent:main|14,29,44,59"
)

# Get current minute
CURRENT_MIN=$(date '+%M')
CURRENT_MIN_NO_LEAD=${CURRENT_MIN#0}

echo "Checking agents for minute $CURRENT_MIN..."
echo ""

# Check each agent
for agent_def in "${AGENTS[@]}"; do
  IFS='|' read -r name session_key cron_mins <<< "$agent_def"
  
  # Check if current minute matches this agent's schedule
  if [[ ",$cron_mins," == *,$CURRENT_MIN,* ]]; then
    echo "🔔 Waking $name (session: $session_key)"
    
    # Send heartbeat message
    MESSAGE="🫀 HEARTBEAT: $(date '+%H:%M') GMT

Your mission control check:

1. Read your WORKING.md
   cat ~/.openclaw/workspace/memory/WORKING-$name.md

2. Check @mentions
   npx convex run notifications:getForAgent --arg '{\"agentId\": \"$(npx convex run agents:getByName --arg '{\"name\": \"'$name'\"}' | jq -r '._id')\"}'

3. Check assigned tasks
   npx convex run tasks:getForAgent --arg '{\"agentId\": \"...\"}'

4. Take action or reply: HEARTBEAT_OK

If blocked >30 min: @Jarvis with reason."

    openclaw sessions send \
      --session "$session_key" \
      --message "$MESSAGE" || echo "Warning: Failed to reach $name (may be offline)"
    
    echo "✅ Sent to $name"
    echo ""
  fi
done

echo "=== Coordinator complete ==="
