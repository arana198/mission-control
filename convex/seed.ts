/**
 * Seed Data for Multi-Business Support
 *
 * ⚠️ DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION
 *
 * This file provides demo data for testing and development.
 * In production, businesses are created via API (convex/businesses.ts create mutation).
 *
 * Usage:
 * - Development: Call seedAllData mutation manually via Convex dashboard or test
 * - Production: Businesses created through API endpoints by authenticated users
 */

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const seedAllData = internalMutation({
  handler: async (ctx) => {
    console.log("[SEED DATA - DEV ONLY] Starting demo data initialization...");
    console.warn("[SEED DATA - DEV ONLY] This should NOT run in production");

    // Create two demo businesses
    const business1Id = await ctx.db.insert("businesses", {
      name: "Mission Control HQ",
      slug: "mission-control-hq",
      color: "#6366f1", // Indigo
      emoji: "🚀",
      description: "Primary command center for operations",
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const business2Id = await ctx.db.insert("businesses", {
      name: "Project Alpha",
      slug: "project-alpha",
      color: "#f59e0b", // Amber
      emoji: "⚡",
      description: "Advanced research and development initiative",
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`Created business 1: ${business1Id}`);
    console.log(`Created business 2: ${business2Id}`);

    // Create settings for each business
    // Business 1 settings
    await ctx.db.insert("settings", {
      businessId: business1Id,
      key: "ticketPrefix",
      value: "MC",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("settings", {
      businessId: business1Id,
      key: "taskCounter",
      value: "0",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("settings", {
      businessId: business1Id,
      key: "githubOrg",
      value: "mission-control",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("settings", {
      businessId: business1Id,
      key: "githubRepo",
      value: "core",
      updatedAt: Date.now(),
    });

    // Business 2 settings
    await ctx.db.insert("settings", {
      businessId: business2Id,
      key: "ticketPrefix",
      value: "PA",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("settings", {
      businessId: business2Id,
      key: "taskCounter",
      value: "0",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("settings", {
      businessId: business2Id,
      key: "githubOrg",
      value: "project-alpha",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("settings", {
      businessId: business2Id,
      key: "githubRepo",
      value: "main",
      updatedAt: Date.now(),
    });

    console.log("Created business-specific settings");

    // Create global settings
    await ctx.db.insert("settings", {
      key: "theme",
      value: "dark",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("settings", {
      key: "taskCounterFormat",
      value: "{prefix}-{n}",
      updatedAt: Date.now(),
    });

    console.log("Created global settings");

    // Create demo epic for business 1
    const epic1Id = await ctx.db.insert("epics", {
      businessId: business1Id,
      title: "Q1 Infrastructure Modernization",
      description: "Upgrade core systems and improve deployment pipeline",
      status: "active",
      progress: 0,
      taskIds: [],
      ownerId: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`Created epic for business 1: ${epic1Id}`);

    // Create demo epic for business 2
    const epic2Id = await ctx.db.insert("epics", {
      businessId: business2Id,
      title: "Advanced Features Development",
      description: "Implement next-generation capabilities and AI integration",
      status: "active",
      progress: 0,
      taskIds: [],
      ownerId: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`Created epic for business 2: ${epic2Id}`);

    // Create demo goal for business 1
    await ctx.db.insert("goals", {
      businessId: business1Id,
      title: "Achieve 99.9% Uptime",
      description: "Improve system reliability and reduce outages",
      category: "business",
      status: "active",
      progress: 0,
      deadline: Date.now() + 86400000 * 90, // 90 days from now
      keyResults: ["Reduce MTTR to < 5 min", "Achieve 99.9% SLA compliance"],
      relatedTaskIds: [],
      relatedMemoryRefs: [],
      parentGoalId: undefined,
      childGoalIds: [],
      owner: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log("Created demo goal for business 1");

    // Create demo goal for business 2
    await ctx.db.insert("goals", {
      businessId: business2Id,
      title: "Deliver AI-Powered Features",
      description: "Implement machine learning capabilities",
      category: "business",
      status: "active",
      progress: 0,
      deadline: Date.now() + 86400000 * 60, // 60 days from now
      keyResults: ["Complete model training", "Deploy to production"],
      relatedTaskIds: [],
      relatedMemoryRefs: [],
      parentGoalId: undefined,
      childGoalIds: [],
      owner: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log("Created demo goal for business 2");

    return {
      isDevelopmentOnly: true,
      businesses: [
        { id: business1Id, name: "Mission Control HQ" },
        { id: business2Id, name: "Project Alpha" },
      ],
      epics: [
        { id: epic1Id, businessId: business1Id },
        { id: epic2Id, businessId: business2Id },
      ],
      message: "[SEED DATA - DEV ONLY] Demo data initialized successfully. Production businesses created via API.",
    };
  },
});
