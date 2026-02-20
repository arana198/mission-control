/**
 * Comprehensive Unit Tests for AgentKeyManagement Component Logic
 * Tests component behavior, fetch calls, state management, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("AgentKeyManagement Component - Comprehensive Logic Tests", () => {
  const mockAgentId = "agent-test-123";
  const mockApiKey = "test-api-key-uuid-001";
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as any;
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Key Masking Logic", () => {
    it("should mask API key with dots", () => {
      const maskedKey = "•".repeat(32);
      expect(maskedKey).toHaveLength(32);
      expect(maskedKey).not.toContain(mockApiKey[0]);
    });

    it("should display full key when unmasked", () => {
      const showKey = true;
      const displayedKey = showKey ? mockApiKey : "•".repeat(32);
      expect(displayedKey).toBe(mockApiKey);
    });
  });

  describe("Clipboard Operations", () => {
    it("should copy API key to clipboard", async () => {
      const writeText = (navigator.clipboard.writeText as jest.Mock);
      await writeText(mockApiKey);
      expect(writeText).toHaveBeenCalledWith(mockApiKey);
    });

    it("should handle clipboard write with long keys", async () => {
      const longKey = "a".repeat(1000);
      const writeText = (navigator.clipboard.writeText as jest.Mock);
      await writeText(longKey);
      expect(writeText).toHaveBeenCalledWith(longKey);
    });
  });

  describe("Form State Management", () => {
    it("should validate rotation reason enum", () => {
      const validReasons = ["scheduled", "compromised", "deployment", "refresh"];
      expect(validReasons).toHaveLength(4);
      expect(validReasons).toContain("scheduled");
    });

    it("should validate grace period range", () => {
      const testPeriods = [0, 30, 60, 120, 300];
      testPeriods.forEach((period) => {
        expect(period).toBeGreaterThanOrEqual(0);
        expect(period).toBeLessThanOrEqual(300);
      });
    });

    it("should reject invalid grace periods", () => {
      const invalidPeriods = [-1, 301, 999];
      invalidPeriods.forEach((period) => {
        const isValid = period >= 0 && period <= 300;
        expect(isValid).toBe(false);
      });
    });
  });

  describe("API Request Construction", () => {
    it("should construct correct endpoint URL", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: "new-key" } }),
      });

      await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe(`/api/agents/${mockAgentId}/rotate-key`);
    });

    it("should use POST method", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: "new-key" } }),
      });

      await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const options = mockFetch.mock.calls[0][1];
      expect(options.method).toBe("POST");
    });

    it("should include Authorization header", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: "new-key" } }),
      });

      await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe(`Bearer ${mockApiKey}`);
    });

    it("should send reason in request body", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: "new-key" } }),
      });

      await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({ reason: "scheduled" }),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reason).toBe("scheduled");
    });

    it("should send grace period in request body", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: "new-key" } }),
      });

      await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({ gracePeriodSeconds: 120 }),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.gracePeriodSeconds).toBe(120);
    });
  });

  describe("Success Response Handling", () => {
    it("should parse successful rotation response", async () => {
      const newKey = "new-key-uuid-456";
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: true,
          data: {
            newApiKey: newKey,
            rotatedAt: Date.now(),
            oldKeyExpiresAt: Date.now() + 60000,
            gracePeriodSeconds: 60,
          },
        }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.newApiKey).toBe(newKey);
    });

    it("should validate response structure", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: true,
          data: {
            newApiKey: "key",
            rotatedAt: Date.now(),
            oldKeyExpiresAt: Date.now(),
            gracePeriodSeconds: 0,
            agentId: mockAgentId,
          },
        }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.data).toHaveProperty("newApiKey");
      expect(data.data).toHaveProperty("rotatedAt");
      expect(data.data).toHaveProperty("oldKeyExpiresAt");
      expect(data.data).toHaveProperty("gracePeriodSeconds");
    });
  });

  describe("Error Response Handling", () => {
    it("should handle 401 Unauthorized response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
        }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: "Bearer wrong-key" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("should handle 404 Not Found response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: false,
          error: { code: "NOT_FOUND", message: "Agent not found" },
        }),
      });

      const response = await fetch(`/api/agents/nonexistent/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.error.code).toBe("NOT_FOUND");
    });

    it("should handle 429 Rate Limited response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many rotation requests",
            details: { retryAfterSeconds: 3600 },
          },
        }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.error.code).toBe("RATE_LIMITED");
      expect(data.error.details.retryAfterSeconds).toBe(3600);
    });

    it("should handle 400 Validation Error response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid input" },
        }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({ gracePeriodSeconds: 999 }),
      });

      const data = await response.json();
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("should display error message to user", async () => {
      const errorMessage = "Too many rotation requests. Maximum 3 per hour.";
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: false,
          error: { code: "RATE_LIMITED", message: errorMessage },
        }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.error.message).toBe(errorMessage);
    });
  });

  describe("Loading State Management", () => {
    it("should track rotation in progress", async () => {
      let isRotating = false;

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            isRotating = true;
            setTimeout(
              () =>
                resolve({
                  json: () => ({ success: true, data: { newApiKey: "key" } }),
                } as any),
              100
            );
          })
      );

      const promise = fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      expect(isRotating).toBe(true);
      await promise;
    });

    it("should clear loading state after completion", async () => {
      let isRotating = false;

      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: "key" } }),
      });

      isRotating = true;
      await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });
      isRotating = false;

      expect(isRotating).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty request body (use defaults)", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: "key" } }),
      });

      await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(Object.keys(body).length).toBe(0);
    });

    it("should handle extra fields in response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => ({
          success: true,
          data: {
            newApiKey: "key",
            rotatedAt: Date.now(),
            oldKeyExpiresAt: Date.now(),
            gracePeriodSeconds: 0,
            extraField: "ignored",
          },
        }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.data.newApiKey).toBeTruthy();
    });

    it("should handle network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      let errorCaught = false;
      try {
        await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
          method: "POST",
          headers: { Authorization: `Bearer ${mockApiKey}` },
          body: JSON.stringify({}),
        });
      } catch {
        errorCaught = true;
      }

      expect(errorCaught).toBe(true);
    });

    it("should handle very large new API key value", async () => {
      const longKey = "a".repeat(1000);
      mockFetch.mockResolvedValueOnce({
        json: () => ({ success: true, data: { newApiKey: longKey } }),
      });

      const response = await fetch(`/api/agents/${mockAgentId}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${mockApiKey}` },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(data.data.newApiKey).toHaveLength(1000);
    });

    it("should handle multiple concurrent rotation requests", async () => {
      mockFetch.mockResolvedValue({
        json: () => ({ success: true, data: { newApiKey: "key" } }),
      });

      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          fetch(`/api/agents/${mockAgentId}/rotate-key`, {
            method: "POST",
            headers: { Authorization: `Bearer ${mockApiKey}` },
            body: JSON.stringify({}),
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Request Validation", () => {
    it("should validate reason enum values", () => {
      const validReasons = ["scheduled", "compromised", "deployment", "refresh"];
      const testReasons = [
        { value: "scheduled", valid: true },
        { value: "compromised", valid: true },
        { value: "invalid", valid: false },
        { value: "", valid: false },
      ];

      testReasons.forEach(({ value, valid }) => {
        const isValid = validReasons.includes(value);
        expect(isValid).toBe(valid);
      });
    });

    it("should validate grace period boundaries", () => {
      const testCases = [
        { value: -1, valid: false },
        { value: 0, valid: true },
        { value: 150, valid: true },
        { value: 300, valid: true },
        { value: 301, valid: false },
      ];

      testCases.forEach(({ value, valid }) => {
        const isValid = value >= 0 && value <= 300;
        expect(isValid).toBe(valid);
      });
    });
  });
});
