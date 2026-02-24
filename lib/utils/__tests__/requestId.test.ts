/**
 * Request ID Utility Tests
 */

import {
  generateRequestId,
  getRequestIdAge,
  isValidRequestId,
} from "../requestId";

describe("requestId", () => {
  describe("generateRequestId", () => {
    it("should generate a valid request ID", () => {
      const requestId = generateRequestId();
      expect(isValidRequestId(requestId)).toBe(true);
    });

    it("should generate unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it("should follow correct format", () => {
      const requestId = generateRequestId();
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it("should start with req_ prefix", () => {
      const requestId = generateRequestId();
      expect(requestId).toMatch(/^req_/);
    });

    it("should contain timestamp after prefix", () => {
      const before = Date.now();
      const requestId = generateRequestId();
      const after = Date.now();

      const match = requestId.match(/^req_(\d+)_/);
      expect(match).toBeTruthy();

      const timestamp = parseInt(match![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("getRequestIdAge", () => {
    it("should calculate age of request ID", () => {
      const requestId = generateRequestId();
      const age = getRequestIdAge(requestId);

      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(100); // Should be nearly immediate
    });

    it("should return -1 for invalid request ID", () => {
      expect(getRequestIdAge("invalid")).toBe(-1);
      expect(getRequestIdAge("req_invalid")).toBe(-1);
    });

    it("should handle older request IDs", (done) => {
      const requestId = generateRequestId();

      setTimeout(() => {
        const age = getRequestIdAge(requestId);
        expect(age).toBeGreaterThanOrEqual(50);
        done();
      }, 50);
    });
  });

  describe("isValidRequestId", () => {
    it("should validate correct format", () => {
      const requestId = generateRequestId();
      expect(isValidRequestId(requestId)).toBe(true);
    });

    it("should reject malformed IDs", () => {
      const invalidIds = [
        "",
        "invalid",
        "req_",
        "req_abc_def",
        "req_123",
        "REQ_1234567890_abc123",
        "req_1234567890_",
      ];

      invalidIds.forEach((id) => {
        expect(isValidRequestId(id)).toBe(false);
      });
    });
  });
});
