#!/bin/bash
#
# Setup all 10 agents with staggered cron jobs
# Run once to initialize the Mission Control squad

set -e

echo "=== Mission Control Agent Setup ==="
echo "This will create 10 OpenClaw cron jobs for your agent squad"
echo ""

# Configure agents
agents=(
  "pepper|agent:email-marketing:main|0,15,30,45|Pepper, the Email Marketing Specialist"
  "shuri|agent:product-analyst:main|2,17,32,47|Shuri, the Product Analyst"
  "fury|agent:customer-researcher:main|4,19,34,49|Fury, the Customer Researcher"
  "vision|agent:seo-analyst:main|6,21,36,51|Vision, the SEO Analyst"
  "loki|agent:content-writer:main|7,22,37,52|Loki, the Content Writer"
  "wanda|agent:designer:main|8,23,38,53|Wanda, the Designer"
  "quill|agent:social-media-manager:main|10,25,40,55|Quill, the Social Media Manager"
  "friday|agent:developer:main|12,27,42,57|Friday, the Developer"
  "wong|agent:notion-agent:main|14,29,44,59|Wong, the Documentation Specialist"
)

# Base message template
generate_message() {
  local name=$1
  local role=$2
  cat <<EOF
🫀 HEARTBEAT: $(date +%H:%M) GMT — Mission Control Check

You are $role.

CHECKLIST:
1. Read WORKING.md — cat ~/.openclaw/workspace/memory/WORKING-$name.md
2. Check @mentions — npx convex run notifications:getForAgent --arg '{"agentId": "YOUR_ID"}' 
3. Check tasks — npx convex run tasks:getForAgent --arg '{"agentId": "YOUR_ID"}'
4. Take action or reply: HEARTBEAT_OK

BLOCKED? @Jarvis immediately.

— Mission Control
EOF
}

echo "Creating cron jobs for 10 agents..."
echo ""

for agent_def in "${agents[@]}"; do
  IFS='|' read -r name session_key cron_schedule role <<< "$agent_def"
  
  echo "Setting up $name..."
  
  # Generate heartbeat message
  message=$(generate_message "$name" "$role")
  
  # Create cron job
  openclaw cron add \
    --name "$name-heartbeat" \
    --cron "$cron_schedule * * * *" \
    --session "isolated" \
    --message "$message" \
    --delivery-channel telegram
  
  echo "  ✅ Cron created: $cron_schedule"
  echo ""
done

echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Run: npm run seed (populate database with agents)"
echo "2. Run: npm run daemon:start (start notification daemon)"
echo "3. Start UI: npm run dev"
echo ""
echo "Agents will begin waking on their schedules:"
echo "  :00 Pepper  :02 Shuri   :04 Fury"
echo "  :06 Vision  :07 Loki    :08 Wanda"
echo "  :10 Quill   :12 Friday  :14 Wong"
