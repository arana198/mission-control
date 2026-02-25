/**
 * Skill Inference System
 *
 * Automatically infers agent skills from completed tasks and maintains
 * confidence scores based on task count, quality ratings, and practice recency.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Calculate confidence score based on task count and rating
 * Formula: 50 + min(25 * (count - 1), 45), capped at 95
 * Adjusted by rating: -5 to +10 range
 * Final range: 30-100
 */
function calculateConfidence(
  taskCount: number,
  avgRating: number = 3,
  daysSinceLastTask: number = 0
): number {
  const baseConfidence = Math.min(50 + 25 * (taskCount - 1), 95);
  const ratingAdjust = (avgRating / 5 - 0.5) * 10; // -5 to +10
  const withRating = Math.max(30, Math.min(100, baseConfidence + ratingAdjust));

  // Decay confidence if skill not practiced recently (2% per day)
  const decayRate = 0.02;
  const decayedConfidence = Math.max(
    20,
    withRating * (1 - decayRate * daysSinceLastTask)
  );

  return Math.round(decayedConfidence * 100) / 100;
}

/**
 * Detect skill level from task count
 * Junior: 1-3 tasks
 * Mid: 4-10 tasks
 * Senior: 11+ tasks
 */
function detectSkillLevel(taskCount: number): "junior" | "mid" | "senior" {
  if (taskCount <= 3) return "junior";
  if (taskCount <= 10) return "mid";
  return "senior";
}

/**
 * Infer agent skills from completed tasks
 */
export const inferAgentSkills = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    // Get all completed tasks for this agent with good ratings
    const allTasks = await ctx.db.query("tasks" as any).collect();
    const tasks = (allTasks as any[]).filter(
      (t: any) => t.agentId === args.agentId && t.status === "completed"
    );

    // Filter to high-quality completions (rating >= 3)
    const goodTasks = tasks.filter(
      (t: any) => t.rating === undefined || (t.rating as number) >= 3
    );

    if (goodTasks.length === 0) {
      return [];
    }

    // Group tasks by type and calculate confidence for each skill
    const skillMap = new Map<
      string,
      { count: number; totalRating: number; lastTaskTime: number }
    >();

    for (const task of goodTasks) {
      const skillName = (task.type as string).replace("_task", "");
      const current = skillMap.get(skillName) || {
        count: 0,
        totalRating: 0,
        lastTaskTime: 0,
      };

      current.count += 1;
      current.totalRating += (task.rating as number) || 3;
      current.lastTaskTime = Math.max(
        current.lastTaskTime,
        (task.completedAt as number) || Date.now()
      );

      skillMap.set(skillName, current);
    }

    // Create or update skill entries
    const results = [];
    for (const [skillName, stats] of skillMap) {
      const avgRating = stats.totalRating / stats.count;
      const daysSince = (Date.now() - stats.lastTaskTime) / (1000 * 60 * 60 * 24);
      const confidence = calculateConfidence(stats.count, avgRating, daysSince);

      // Check if skill already exists
      const allSkills = await ctx.db.query("agentSkills" as any).collect();
      const existing = (allSkills as any[]).find(
        (s: any) => s.agentId === args.agentId && s.skill === skillName
      );

      if (existing) {
        // Update existing skill
        await ctx.db.patch(existing._id, {
          confidence,
          inferredFromTaskCount: stats.count,
          updatedAt: Date.now(),
        });
        results.push(existing._id);
      } else {
        // Create new skill entry
        const skillId = await ctx.db.insert("agentSkills", {
          agentId: args.agentId,
          skill: skillName,
          confidence,
          inferredFromTaskCount: stats.count,
          manuallyOverridden: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.push(skillId);
      }
    }

    return results;
  },
});

/**
 * Get all skills for an agent
 */
export const getAgentSkills = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("agentSkills" as any).collect();
    return ((all as any[])
      .filter((s: any) => s.agentId === args.agentId)
      .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0)));
  },
});

/**
 * Get skills by workspace (for reporting)
 */
export const getSkillsBy = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    // Note: Agents are global (not workspace-scoped), so we return all agent skills
    // In the future, if agents become workspace-scoped, filter by workspaceId
    const allAgentSkills = await ctx.db.query("agentSkills" as any).collect();
    const skills = (allAgentSkills as any[]);

    // Get all agents to map IDs to names
    const allAgents = await ctx.db.query("agents" as any).collect();
    const agentMap = new Map(allAgents.map((a: any) => [a._id, a.name || "Unknown"]));

    // Group skills by skill name
    const skillMap = new Map<string, { agents: string[]; avgConfidence: number }>();

    for (const skill of skills) {
      const current = skillMap.get(skill.skill) || {
        agents: [],
        avgConfidence: 0,
      };

      const agentName = agentMap.get(skill.agentId) || "Unknown";
      current.agents.push(agentName);
      current.avgConfidence += skill.confidence || 0;

      skillMap.set(skill.skill, current);
    }

    // Calculate averages
    return Array.from(skillMap).map(([skill, data]) => ({
      skill,
      agentCount: data.agents.length,
      avgConfidence: Math.round((data.avgConfidence / data.agents.length) * 100) / 100,
      agents: data.agents,
    }));
  },
});

/**
 * Manually update agent skill with override flag
 */
export const updateSkillManually = mutation({
  args: {
    agentId: v.id("agents"),
    skill: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if skill exists
    const allSkills = await ctx.db.query("agentSkills" as any).collect();
    const existing = (allSkills as any[]).find(
      (s: any) => s.agentId === args.agentId && s.skill === args.skill
    );

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        confidence: args.confidence,
        manuallyOverridden: true,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new
      return await ctx.db.insert("agentSkills", {
        agentId: args.agentId,
        skill: args.skill,
        confidence: args.confidence,
        inferredFromTaskCount: 0,
        manuallyOverridden: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Get suggested skills for new agent based on role
 */
export const getSuggestedSkillsByRole = query({
  args: {
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const roleSkillMap: Record<string, string[]> = {
      "Design Lead": ["design", "ux_research", "wireframing"],
      Designer: ["design", "ui_design", "prototyping"],
      Developer: ["backend", "frontend", "debugging"],
      "Backend Developer": ["backend", "database", "api_design"],
      "Frontend Developer": ["frontend", "css", "javascript"],
      "QA Engineer": ["testing", "automation", "qa"],
      "DevOps Engineer": ["infrastructure", "deployment", "monitoring"],
      Manager: ["leadership", "planning", "communication"],
    };

    return roleSkillMap[args.role] || [];
  },
});

/**
 * Detect skill degradation (not practiced recently)
 */
export const detectDegradedSkills = query({
  args: {
    agentId: v.id("agents"),
    daysThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("agentSkills" as any).collect();
    const skills = (all as any[]).filter((s: any) => s.agentId === args.agentId);

    const degradedThresholdMs = args.daysThreshold * 24 * 60 * 60 * 1000;

    return skills.filter(
      (s) =>
        Date.now() - (s.updatedAt || 0) > degradedThresholdMs
    );
  },
});
