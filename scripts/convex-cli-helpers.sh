#!/bin/bash
#
# Convex CLI Helpers for Agents
# Simplified commands for Mission Control interactions

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Show help
show_help() {
  cat <<EOF
Mission Control CLI Helpers

Usage: ${0##*/} <command> [args]

Commands:
  check-mentions <agent-name>     Check @mentions for agent
  check-tasks <agent-name>        Check assigned tasks for agent
  post-comment <agent-name> <task-id> <message>  Comment on task
  mark-delivered <notification-id>  Mark notification delivered
  update-task <task-id> <status>  Update task status
  list-agents                     List all squad members
  list-tasks                      List recent tasks
  activity-feed                   Show recent activity
  
Examples:
  ${0##*/} check-mentions jarvis
  ${0##*/} post-comment loki "kx7..." "Draft ready for review"
  ${0##*/} update-task "kx7..." review
EOF
}

# Get agent ID by name
get_agent_id() {
  local name=$1
  npx convex run agents:getByName --arg "{\"name\": \"$name\"}" 2>/dev/null | grep -o '"_id": "[^"]*"' | head -1 | sed 's/.*"_id": "\([^"]*\)".*/\1/'
}

# Check mentions for agent
check_mentions() {
  local name=$1
  local agent_id=$(get_agent_id "$name")
  
  if [ -z "$agent_id" ]; then
    echo "❌ Agent not found: $name"
    return 1
  fi
  
  echo "🔔 Notifications for $name:"
  npx convex run notifications:getForAgent --arg "{\"agentId\": \"$agent_id\"}" | jq -r '.[] | "  [@\(.fromAgentName // "Unknown")]: \(.content) [ID: \(._id)]"'
}

# Check tasks for agent
check_tasks() {
  local name=$1
  local agent_id=$(get_agent_id "$name")
  
  if [ -z "$agent_id" ]; then
    echo "❌ Agent not found: $name"
    return 1
  fi
  
  echo "📋 Tasks for $name:"
  npx convex run tasks:getForAgent --arg "{\"agentId\": \"$agent_id\"}" | jq -r '.[] | "  [\(.status)] \(.title) (P\(.priority))"'
}

# Post comment
post_comment() {
  local name=$1
  local task_id=$2
  local message=$3
  local agent_id=$(get_agent_id "$name")
  
  if [ -z "$agent_id" ]; then
    echo "❌ Agent not found: $name"
    return 1
  fi
  
  npx convex run messages:create --arg "{\"taskId\": \"$task_id\", \"fromAgentId\": \"$agent_id\", \"content\": \"$message\", \"mentions\": []}"
  echo "✅ Comment posted"
}

# Mark notification delivered
mark_delivered() {
  local notification_id=$1
  npx convex run notifications:markDelivered --arg "{\"id\": \"$notification_id\"}"
  echo "✅ Marked delivered"
}

# Update task status
update_task() {
  local task_id=$1
  local status=$2
  local agent_id=$3
  
  if [ -z "$agent_id" ]; then
    # Try to get from current session context
    echo "⚠️ Warning: Agent ID not provided, using default"
    agent_id="null"
  fi
  
  npx convex run tasks:updateStatus --arg "{\"taskId\": \"$task_id\", \"status\": \"$status\", \"updatedBy\": \"$agent_id\"}"
  echo "✅ Task updated to: $status"
}

# List agents
list_agents() {
  echo "🤖 Squad Members:"
  npx convex run agents:getAll | jq -r '.[] | "  \(.name) [\(.role)] — \(.status)"'
}

# List tasks
list_tasks() {
  echo "📊 Recent Tasks:"
  npx convex run tasks:getAll | jq -r '.[] | "  [\(.status)] (\(.priority)) \(.title)"' | head -20
}

# Activity feed
activity_feed() {
  echo "📰 Recent Activity:"
  npx convex run activities:getRecent --arg "{\"limit\": 10}" | jq -r '.[] | "  [\(.agentName)] \(.message)"'
}

# Main
case "${1:-}" in
  check-mentions)
    shift
    check_mentions "$1"
    ;;
  check-tasks)
    shift
    check_tasks "$1"
    ;;
  post-comment)
    shift
    post_comment "$1" "$2" "$3"
    ;;
  mark-delivered)
    shift
    mark_delivered "$1"
    ;;
  update-task)
    shift
    update_task "$1" "$2" "$3"
    ;;
  list-agents)
    list_agents
    ;;
  list-tasks)
    list_tasks
    ;;
  activity-feed)
    activity_feed
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
