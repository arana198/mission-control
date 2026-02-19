import { v as convexVal } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Agent Self-Check System
 * Agents query for notifications on wake and auto-claim tasks
 */

/**
 * Get all pending work for an agent
 * - Unread notifications
 * - Tasks in "ready" status assigned to them
 */
export const getWorkQueue = query({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    // Get unread notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .order("desc")
      .take(20);

    // PERF-02: Get ready tasks assigned to agent using by_status index
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .take(100);
    const readyTasks = allTasks.filter(
      (t) => t.assigneeIds.includes(agentId)
    );

    return {
      agent: {
        id: agent._id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
      },
      notifications,
      readyTasks,
      hasWork: notifications.length > 0 || readyTasks.length > 0,
    };
  },
});

/**
 * Claim next available task
 * - Finds highest priority ready task assigned to agent
 * - Updates status to "in_progress"
 * - Marks related notification as read
 * - Logs activity
 */
export const claimNextTask = mutation({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    // PERF-02: Get ready tasks assigned to agent using by_status index
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .take(100);
    const readyTasks = allTasks.filter(
      (t) => t.assigneeIds.includes(agentId)
    );

    if (readyTasks.length === 0) {
      return { claimed: false, reason: "No ready tasks assigned" };
    }

    // Priority order: P0 > P1 > P2 > P3, then by creation date
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const taskToClaim = readyTasks.sort((a, b) => {
      const prioDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (prioDiff !== 0) return prioDiff;
      return a.createdAt - b.createdAt;
    })[0];

    // Claim the task (set to in_progress)
    await ctx.db.patch(taskToClaim._id, {
      status: "in_progress",
      updatedAt: Date.now(),
    });

    // Find and mark assignment notifications as read
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    const taskNotifications = notifications.filter(
      (n) => n.taskId === taskToClaim._id && n.type === "assignment"
    );

    for (const notif of taskNotifications) {
      await ctx.db.patch(notif._id, {
        read: true,
        readAt: Date.now(),
      });
    }

    // Log activity
    await ctx.db.insert("activities", {
      businessId: taskToClaim.businessId,
      type: "task_updated",
      agentId,
      agentName: agent.name,
      message: `${agent.name} claimed task "${taskToClaim.title}"`,
      taskId: taskToClaim._id,
      taskTitle: taskToClaim.title,
      oldValue: "ready",
      newValue: "in_progress",
      createdAt: Date.now(),
    });

    return {
      claimed: true,
      taskId: taskToClaim._id,
      taskTitle: taskToClaim.title,
      priority: taskToClaim.priority,
    };
  },
});

/**
 * Full agent wake workflow (action)
 * Called when agent wakes up - checks queue and claims work
 */
export const wakeAndCheck = action({
  args: { agentId: convexVal.id("agents") },
  handler: async (ctx, { agentId }): Promise<any> => {
    // Get work queue
    const queue: any = await ctx.runQuery(api.agentSelfCheck.getWorkQueue, { agentId });

    if (!queue.hasWork) {
      return {
        woke: true,
        claimed: false,
        message: "No work in queue",
        notifications: queue.notifications.length,
        readyTasks: queue.readyTasks.length,
      };
    }

    // Try to claim next task
    const claim: any = await ctx.runMutation(api.agentSelfCheck.claimNextTask, { agentId });

    return {
      woke: true,
      claimed: claim.claimed,
      task: claim.claimed
        ? { id: claim.taskId, title: claim.taskTitle, priority: claim.priority }
        : null,
      message: claim.claimed
        ? `Claimed task: ${claim.taskTitle}`
        : claim.reason,
      notifications: queue.notifications.length,
      readyTasks: queue.readyTasks.length,
    };
  },
});

// ============================================================
// NAME-BASED FUNCTIONS (for direct agent CLI usage)
// ============================================================

/**
 * Get work queue by agent NAME (string)
 * For agents that only know their name, not their Convex ID
 * Case-insensitive matching via scan
 */
export const getWorkQueueByName = query({
  args: { agentName: convexVal.string() },
  handler: async (ctx, { agentName }) => {
    // Lookup agent by name (case-insensitive scan - works for 10 agents)
    const lowerName = agentName.toLowerCase();
    const allAgents = await ctx.db.query("agents").collect();
    const agent = allAgents.find(a => a.name.toLowerCase() === lowerName);

    if (!agent) {
      return { error: `Agent "${agentName}" not found`, hasWork: false };
    }

    // Get unread notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", agent._id))
      .filter((q) => q.eq(q.field("read"), false))
      .order("desc")
      .take(20);

    // PERF-02: Get ready tasks assigned to agent using by_status index
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .take(100);
    const readyTasks = allTasks.filter(
      (t) => t.assigneeIds.includes(agent._id)
    );

    return {
      agent: {
        id: agent._id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
      },
      notifications,
      readyTasks,
      hasWork: notifications.length > 0 || readyTasks.length > 0,
    };
  },
});

/**
 * Claim next task by agent NAME (string)
 * Case-insensitive matching via scan
 */
export const claimNextTaskByName = mutation({
  args: { agentName: convexVal.string() },
  handler: async (ctx, { agentName }) => {
    // Lookup agent by name (case-insensitive scan - works for 10 agents)
    const lowerName = agentName.toLowerCase();
    const allAgents = await ctx.db.query("agents").collect();
    const agent = allAgents.find(a => a.name.toLowerCase() === lowerName);

    if (!agent) {
      return { claimed: false, error: `Agent "${agentName}" not found` };
    }

    const agentId = agent._id;

    // PERF-02: Get ready tasks assigned to agent using by_status index
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .take(100);
    const readyTasks = allTasks.filter(
      (t) => t.assigneeIds.includes(agentId)
    );

    if (readyTasks.length === 0) {
      return { claimed: false, reason: "No ready tasks assigned" };
    }

    // Priority order: P0 > P1 > P2 > P3, then by creation date
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const taskToClaim = readyTasks.sort((a, b) => {
      const prioDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (prioDiff !== 0) return prioDiff;
      return a.createdAt - b.createdAt;
    })[0];

    // Claim the task (set to in_progress)
    await ctx.db.patch(taskToClaim._id, {
      status: "in_progress",
      updatedAt: Date.now(),
    });

    // Find and mark assignment notifications as read
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    const taskNotifications = notifications.filter(
      (n) => n.taskId === taskToClaim._id && n.type === "assignment"
    );

    for (const notif of taskNotifications) {
      await ctx.db.patch(notif._id, {
        read: true,
        readAt: Date.now(),
      });
    }

    // Log activity
    await ctx.db.insert("activities", {
      businessId: taskToClaim.businessId,
      type: "agent_claimed",
      agentId,
      agentName: agent.name,
      message: `${agent.name} claimed task "${taskToClaim.title}"`,
      taskId: taskToClaim._id,
      taskTitle: taskToClaim.title,
      oldValue: "ready",
      newValue: "in_progress",
      createdAt: Date.now(),
    });

    return {
      claimed: true,
      taskId: taskToClaim._id,
      taskTitle: taskToClaim.title,
      priority: taskToClaim.priority,
    };
  },
});

/**
 * Full wake workflow by NAME (action)
 * One-call check + claim for agents
 */
export const wakeAndCheckByName = action({
  args: { agentName: convexVal.string() },
  handler: async (ctx, { agentName }): Promise<any> => {
    // Get work queue
    const queue: any = await ctx.runQuery(api.agentSelfCheck.getWorkQueueByName, { agentName });

    if (queue.error) {
      return { error: queue.error };
    }

    if (!queue.hasWork) {
      return {
        agentName,
        claimed: false,
        message: "No work in queue",
        status: "idle",
      };
    }

    // Try to claim next task
    const claim: any = await ctx.runMutation(api.agentSelfCheck.claimNextTaskByName, { agentName });

    return {
      agentName,
      claimed: claim.claimed,
      task: claim.claimed
        ? { id: claim.taskId, title: claim.taskTitle, priority: claim.priority }
        : null,
      message: claim.claimed
        ? `Claimed task: ${claim.taskTitle}`
        : claim.reason || claim.error,
      status: claim.claimed ? "working" : "idle",
    };
  },
});
