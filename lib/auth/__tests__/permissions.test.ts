/**
 * Authorization and permissions tests
 */

import { isAuthorizedActor, canDeleteTask, SYSTEM_ACTOR_IDS } from "../permissions";

describe("permissions", () => {
  describe("isAuthorizedActor", () => {
    it("authorizes 'user' system actor", () => {
      expect(isAuthorizedActor("user")).toBe(true);
    });

    it("authorizes 'system' actor", () => {
      expect(isAuthorizedActor("system")).toBe(true);
    });

    it("authorizes 'jarvis' actor", () => {
      expect(isAuthorizedActor("jarvis")).toBe(true);
    });

    it("authorizes 'system:auto-claim' actor", () => {
      expect(isAuthorizedActor("system:auto-claim")).toBe(true);
    });

    it("rejects unknown actor IDs", () => {
      expect(isAuthorizedActor("unknown-agent")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isAuthorizedActor("")).toBe(false);
    });

    it("case-sensitive matching", () => {
      expect(isAuthorizedActor("User")).toBe(false);
      expect(isAuthorizedActor("SYSTEM")).toBe(false);
    });
  });

  describe("canDeleteTask", () => {
    const mockTask = { createdBy: "agent-123" };

    it("allows task creator to delete", () => {
      expect(canDeleteTask(mockTask, "agent-123")).toBe(true);
    });

    it("allows 'user' system actor to delete any task", () => {
      expect(canDeleteTask(mockTask, "user")).toBe(true);
    });

    it("allows 'system' actor to delete any task", () => {
      expect(canDeleteTask(mockTask, "system")).toBe(true);
    });

    it("allows 'jarvis' actor to delete any task", () => {
      expect(canDeleteTask(mockTask, "jarvis")).toBe(true);
    });

    it("allows 'system:auto-claim' actor to delete any task", () => {
      expect(canDeleteTask(mockTask, "system:auto-claim")).toBe(true);
    });

    it("rejects deletion by unauthorized third party", () => {
      expect(canDeleteTask(mockTask, "other-agent-456")).toBe(false);
    });

    it("rejects deletion by unknown actor", () => {
      expect(canDeleteTask(mockTask, "malicious-actor")).toBe(false);
    });
  });

  describe("SYSTEM_ACTOR_IDS", () => {
    it("is a Set with required system actors", () => {
      expect(SYSTEM_ACTOR_IDS).toBeInstanceOf(Set);
      expect(SYSTEM_ACTOR_IDS.has("user")).toBe(true);
      expect(SYSTEM_ACTOR_IDS.has("system")).toBe(true);
      expect(SYSTEM_ACTOR_IDS.has("jarvis")).toBe(true);
      expect(SYSTEM_ACTOR_IDS.has("system:auto-claim")).toBe(true);
    });

    it("contains exactly 4 system actors", () => {
      expect(SYSTEM_ACTOR_IDS.size).toBe(4);
    });
  });
});
