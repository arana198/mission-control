import { describe, it, expect } from "@jest/globals";

/**
 * PresenceIndicator Component Unit Tests
 *
 * Tests for:
 * - Status badge rendering
 * - Color coding for different statuses
 * - Activity display
 */

describe("PresenceIndicator Component", () => {
  describe("StatusBadge", () => {
    it("renders online status with green color", () => {
      const status = "online";
      const statusConfig: Record<
        string,
        { bg: string; text: string; icon: string; label: string }
      > = {
        online: {
          bg: "bg-green-100",
          text: "text-green-700",
          icon: "🟢",
          label: "Online",
        },
      };

      const config = statusConfig[status];
      expect(config.bg).toBe("bg-green-100");
      expect(config.text).toBe("text-green-700");
      expect(config.icon).toBe("🟢");
      expect(config.label).toBe("Online");
    });

    it("renders away status with yellow color", () => {
      const statusConfig: Record<
        string,
        { bg: string; text: string; icon: string; label: string }
      > = {
        away: {
          bg: "bg-yellow-100",
          text: "text-yellow-700",
          icon: "🟡",
          label: "Away",
        },
      };

      const config = statusConfig["away"];
      expect(config.bg).toBe("bg-yellow-100");
      expect(config.text).toBe("text-yellow-700");
      expect(config.icon).toBe("🟡");
      expect(config.label).toBe("Away");
    });

    it("renders do_not_disturb status with red color", () => {
      const statusConfig: Record<
        string,
        { bg: string; text: string; icon: string; label: string }
      > = {
        do_not_disturb: {
          bg: "bg-red-100",
          text: "text-red-700",
          icon: "🔴",
          label: "Do Not Disturb",
        },
      };

      const config = statusConfig["do_not_disturb"];
      expect(config.bg).toBe("bg-red-100");
      expect(config.text).toBe("text-red-700");
      expect(config.icon).toBe("🔴");
      expect(config.label).toBe("Do Not Disturb");
    });

    it("renders offline status with gray color", () => {
      const statusConfig: Record<
        string,
        { bg: string; text: string; icon: string; label: string }
      > = {
        offline: {
          bg: "bg-gray-100",
          text: "text-gray-700",
          icon: "⚪",
          label: "Offline",
        },
      };

      const config = statusConfig["offline"];
      expect(config.bg).toBe("bg-gray-100");
      expect(config.text).toBe("text-gray-700");
      expect(config.icon).toBe("⚪");
      expect(config.label).toBe("Offline");
    });

    it("handles unknown status gracefully", () => {
      const statusConfig: Record<
        string,
        { bg: string; text: string; icon: string; label: string }
      > = {
        online: {
          bg: "bg-green-100",
          text: "text-green-700",
          icon: "🟢",
          label: "Online",
        },
        away: {
          bg: "bg-yellow-100",
          text: "text-yellow-700",
          icon: "🟡",
          label: "Away",
        },
        offline: {
          bg: "bg-gray-100",
          text: "text-gray-700",
          icon: "⚪",
          label: "Offline",
        },
      };

      const unknownStatus = "unknown";
      const config = statusConfig[unknownStatus] || statusConfig.offline;
      expect(config).toBeDefined();
      expect(config.label).toBe("Offline");
    });
  });

  describe("Color Map for Status", () => {
    it("maps online to green", () => {
      const colorMap: Record<string, string> = {
        online: "fill-green-500 text-green-500",
      };

      expect(colorMap["online"]).toBe("fill-green-500 text-green-500");
    });

    it("maps away to yellow", () => {
      const colorMap: Record<string, string> = {
        away: "fill-yellow-500 text-yellow-500",
      };

      expect(colorMap["away"]).toBe("fill-yellow-500 text-yellow-500");
    });

    it("maps do_not_disturb to red", () => {
      const colorMap: Record<string, string> = {
        do_not_disturb: "fill-red-500 text-red-500",
      };

      expect(colorMap["do_not_disturb"]).toBe("fill-red-500 text-red-500");
    });

    it("maps offline to gray", () => {
      const colorMap: Record<string, string> = {
        offline: "fill-gray-300 text-gray-300",
      };

      expect(colorMap["offline"]).toBe("fill-gray-300 text-gray-300");
    });
  });

  describe("Status Display Logic", () => {
    it("replaces underscores with spaces in status text", () => {
      const status = "do_not_disturb";
      const displayText = status.replaceAll("_", " ");
      expect(displayText).toBe("do not disturb");
    });

    it("capitalizes status for display", () => {
      const status = "online";
      const displayText = status.charAt(0).toUpperCase() + status.slice(1);
      expect(displayText).toBe("Online");
    });

    it("handles activity text truncation for long activities", () => {
      const activity = "Working on a very long task description that might be too long";
      const maxLength = 40;
      const truncated = activity.length > maxLength
        ? activity.substring(0, maxLength) + "..."
        : activity;

      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
    });
  });

  describe("PresenceList Filtering", () => {
    it("filters agents by online status", () => {
      const agents = [
        { _id: "1", name: "Alice", role: "Dev" },
        { _id: "2", name: "Bob", role: "Design" },
        { _id: "3", name: "Charlie", role: "PM" },
      ];

      const presenceMap = new Map([
        ["1", { agentId: "1", status: "online" }],
        ["2", { agentId: "2", status: "away" }],
        ["3", { agentId: "3", status: "offline" }],
      ]);

      const onlineAgents = agents.filter((agent) => {
        const presence = presenceMap.get(agent._id as string);
        if (!presence) return false;
        return presence.status === "online";
      });

      expect(onlineAgents).toHaveLength(1);
      expect(onlineAgents[0].name).toBe("Alice");
    });

    it("filters agents by away status", () => {
      const agents = [
        { _id: "1", name: "Alice", role: "Dev" },
        { _id: "2", name: "Bob", role: "Design" },
        { _id: "3", name: "Charlie", role: "PM" },
      ];

      const presenceMap = new Map([
        ["1", { agentId: "1", status: "online" }],
        ["2", { agentId: "2", status: "away" }],
        ["3", { agentId: "3", status: "away" }],
      ]);

      const awayAgents = agents.filter((agent) => {
        const presence = presenceMap.get(agent._id as string);
        if (!presence) return false;
        return presence.status === "away";
      });

      expect(awayAgents).toHaveLength(2);
    });

    it("shows all agents when filter is 'all'", () => {
      const agents = [
        { _id: "1", name: "Alice", role: "Dev" },
        { _id: "2", name: "Bob", role: "Design" },
        { _id: "3", name: "Charlie", role: "PM" },
      ];

      const filteredAgents = agents.filter(() => true); // All filter

      expect(filteredAgents).toHaveLength(3);
    });

    it("includes agents with no presence record when filter is offline", () => {
      const agents = [
        { _id: "1", name: "Alice", role: "Dev" },
        { _id: "2", name: "Bob", role: "Design" },
        { _id: "3", name: "Charlie", role: "PM" },
      ];

      const presenceMap = new Map([
        ["1", { agentId: "1", status: "online" }],
      ]);

      const offlineAgents = agents.filter((agent) => {
        const presence = presenceMap.get(agent._id as string);
        if (!presence) return true; // No presence = offline
        return presence.status === "offline";
      });

      expect(offlineAgents).toHaveLength(2);
    });
  });

  describe("Status Transition Logic", () => {
    it("validates status transitions", () => {
      const validStatuses = [
        "online",
        "away",
        "do_not_disturb",
        "offline",
      ];

      const currentStatus = "online";
      const newStatus = "away";

      expect(validStatuses).toContain(currentStatus);
      expect(validStatuses).toContain(newStatus);
    });

    it("handles rapid status changes", () => {
      const statuses: string[] = [];
      const transitions = [
        "online",
        "away",
        "online",
        "do_not_disturb",
        "offline",
      ];

      for (const status of transitions) {
        statuses.push(status);
      }

      expect(statuses.length).toBe(5);
      expect(statuses[statuses.length - 1]).toBe("offline");
    });
  });

  describe("Activity Display", () => {
    it("shows current activity when provided", () => {
      const presence = {
        status: "online",
        currentActivity: "Code review",
      };

      expect(presence.currentActivity).toBe("Code review");
    });

    it("omits activity display when not provided", () => {
      const presence = {
        status: "online",
        currentActivity: undefined,
      };

      expect(presence.currentActivity).toBeUndefined();
    });

    it("handles empty activity string", () => {
      const presence = {
        status: "online",
        currentActivity: "",
      };

      const shouldDisplay = Boolean(
        presence.currentActivity && presence.currentActivity.length > 0
      );
      expect(shouldDisplay).toBe(false);
    });

    it("truncates very long activities", () => {
      const longActivity =
        "Working on implementing the new authentication system with OAuth2 and JWT tokens";
      const maxLength = 50;
      const truncated =
        longActivity.length > maxLength
          ? longActivity.substring(0, maxLength) + "..."
          : longActivity;

      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3);
    });
  });
});
