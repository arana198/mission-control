/**
 * ApiError Class Tests
 * Validates standardized error handling for REST API
 */

import { ApiError, ErrorCode } from "../ApiError";

describe("ApiError", () => {
  describe("instantiation", () => {
    it("should create an error with all required fields", () => {
      const error = new ApiError(
        ErrorCode.NOT_FOUND,
        "Resource not found",
        { resourceId: "123" }
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe("Resource not found");
      expect(error.details).toEqual({ resourceId: "123" });
      expect(error.statusCode).toBe(404);
    });

    it("should have correct statusCode for each error code", () => {
      const testCases = [
        [ErrorCode.VALIDATION_ERROR, 422],
        [ErrorCode.NOT_FOUND, 404],
        [ErrorCode.CONFLICT, 409],
        [ErrorCode.FORBIDDEN, 403],
        [ErrorCode.LIMIT_EXCEEDED, 429],
        [ErrorCode.INTERNAL_ERROR, 500],
        [ErrorCode.SERVICE_UNAVAILABLE, 503],
      ] as const;

      testCases.forEach(([code, expectedStatus]) => {
        const error = new ApiError(code, `Test ${code}`);
        expect(error.statusCode).toBe(expectedStatus);
      });
    });

    it("should generate unique requestId for each error", () => {
      const error1 = new ApiError(ErrorCode.NOT_FOUND, "Not found");
      const error2 = new ApiError(ErrorCode.NOT_FOUND, "Not found");

      expect(error1.requestId).toBeDefined();
      expect(error2.requestId).toBeDefined();
      expect(error1.requestId).not.toBe(error2.requestId);
    });

    it("should allow optional details", () => {
      const error1 = new ApiError(ErrorCode.VALIDATION_ERROR, "Invalid input");
      const error2 = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid input",
        { field: "email" }
      );

      expect(error1.details).toBeUndefined();
      expect(error2.details).toEqual({ field: "email" });
    });

    it("should have retryable flag for transient errors", () => {
      const transientError = new ApiError(
        ErrorCode.SERVICE_UNAVAILABLE,
        "Service temporarily down"
      );
      const permanentError = new ApiError(
        ErrorCode.NOT_FOUND,
        "Resource not found"
      );

      expect(transientError.isRetryable()).toBe(true);
      expect(permanentError.isRetryable()).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should serialize to JSON with all fields", () => {
      const error = new ApiError(
        ErrorCode.CONFLICT,
        "Resource already exists",
        { existingId: "456" }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: ErrorCode.CONFLICT,
        statusCode: 409,
        message: "Resource already exists",
        details: { existingId: "456" },
        requestId: expect.any(String),
        retryable: false,
      });
    });

    it("should not include undefined details in JSON", () => {
      const error = new ApiError(ErrorCode.NOT_FOUND, "Not found");
      const json = error.toJSON();

      expect(json.details).toBeUndefined();
    });
  });

  describe("isRetryable", () => {
    it("should return true for transient errors", () => {
      const transientCodes = [
        ErrorCode.SERVICE_UNAVAILABLE,
        // Add any other transient codes here
      ];

      transientCodes.forEach((code) => {
        const error = new ApiError(code, `Test ${code}`);
        expect(error.isRetryable()).toBe(true);
      });
    });

    it("should return false for permanent errors", () => {
      const permanentCodes = [
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.NOT_FOUND,
        ErrorCode.CONFLICT,
        ErrorCode.FORBIDDEN,
        ErrorCode.INTERNAL_ERROR,
      ];

      permanentCodes.forEach((code) => {
        const error = new ApiError(code, `Test ${code}`);
        expect(error.isRetryable()).toBe(false);
      });
    });
  });

  describe("static factory methods", () => {
    it("should create NOT_FOUND error", () => {
      const error = ApiError.notFound("User", { userId: "123" });

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain("User");
      expect(error.details).toEqual({ userId: "123" });
    });

    it("should create VALIDATION_ERROR", () => {
      const error = ApiError.validationError("Invalid email format", {
        field: "email",
        value: "invalid",
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(422);
    });

    it("should create CONFLICT error", () => {
      const error = ApiError.conflict("User already exists", {
        email: "user@example.com",
      });

      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.statusCode).toBe(409);
    });

    it("should create FORBIDDEN error", () => {
      const error = ApiError.forbidden("Access denied", {
        businessId: "123",
        userId: "456",
      });

      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.statusCode).toBe(403);
    });

    it("should create INTERNAL_ERROR", () => {
      const error = ApiError.internal("Unexpected error", {
        originalError: "Database connection failed",
      });

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
    });
  });
});
