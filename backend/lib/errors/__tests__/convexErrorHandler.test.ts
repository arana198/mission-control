/**
 * Convex Error Handler Tests
 */

import {
  wrapConvexHandler,
  isApiError,
  extractApiError,
  formatApiErrorResponse,
} from "../convexErrorHandler";
import { ApiError, ErrorCode } from "../ApiError";

describe("convexErrorHandler", () => {
  describe("isApiError", () => {
    it("should identify ApiError instances", () => {
      const apiError = new ApiError(ErrorCode.NOT_FOUND, "Not found");
      const regularError = new Error("Regular error");

      expect(isApiError(apiError)).toBe(true);
      expect(isApiError(regularError)).toBe(false);
    });
  });

  describe("wrapConvexHandler", () => {
    it("should pass through successful result", async () => {
      const handler = wrapConvexHandler(async (ctx, args) => {
        return { success: true, data: "test" };
      });

      const result = await handler({}, {});
      expect(result).toEqual({ success: true, data: "test" });
    });

    it("should pass through ApiError as-is", async () => {
      const testError = new ApiError(ErrorCode.NOT_FOUND, "Not found");

      const handler = wrapConvexHandler(async (ctx, args) => {
        throw testError;
      });

      await expect(handler({}, {})).rejects.toThrow(ApiError);
      await expect(handler({}, {})).rejects.toEqual(testError);
    });

    it("should convert unexpected errors to ApiError", async () => {
      const regularError = new Error("Unexpected error");

      const handler = wrapConvexHandler(async (ctx, args) => {
        throw regularError;
      });

      let caughtError: any;
      try {
        await handler({}, {});
      } catch (error) {
        caughtError = error;
      }

      expect(isApiError(caughtError)).toBe(true);
      expect(caughtError.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(caughtError.statusCode).toBe(500);
      expect(caughtError.message).toBe("An unexpected error occurred");
      expect(caughtError.details?.originalError).toBe("Unexpected error");
    });

    it("should preserve stack trace in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const regularError = new Error("Test error");
      const handler = wrapConvexHandler(async (ctx, args) => {
        throw regularError;
      });

      let caughtError: any;
      try {
        await handler({}, {});
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError.details?.stack).toBeDefined();
      process.env.NODE_ENV = originalEnv;
    });

    it("should not expose stack trace in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const regularError = new Error("Test error");
      const handler = wrapConvexHandler(async (ctx, args) => {
        throw regularError;
      });

      let caughtError: any;
      try {
        await handler({}, {});
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError.details?.stack).toBeUndefined();
      process.env.NODE_ENV = originalEnv;
    });

    it("should pass context and args through", async () => {
      let receivedCtx: any;
      let receivedArgs: any;

      const handler = wrapConvexHandler(async (ctx, args) => {
        receivedCtx = ctx;
        receivedArgs = args;
        return "ok";
      });

      const testCtx = { db: {} };
      const testArgs = { id: "123" };

      await handler(testCtx, testArgs);

      expect(receivedCtx).toBe(testCtx);
      expect(receivedArgs).toBe(testArgs);
    });
  });

  describe("extractApiError", () => {
    it("should return ApiError as-is", () => {
      const apiError = new ApiError(ErrorCode.NOT_FOUND, "Not found");
      const extracted = extractApiError(apiError);

      expect(extracted).toBe(apiError);
    });

    it("should extract from serialized error object", () => {
      const serialized = {
        code: ErrorCode.CONFLICT,
        statusCode: 409,
        message: "Resource already exists",
        details: { id: "123" },
      };

      const extracted = extractApiError(serialized);

      expect(extracted.code).toBe(ErrorCode.CONFLICT);
      expect(extracted.statusCode).toBe(409);
      expect(extracted.message).toBe("Resource already exists");
      expect(extracted.details).toEqual({ id: "123" });
    });

    it("should convert unknown error to INTERNAL_ERROR", () => {
      const unknownError = new Error("Unknown");
      const extracted = extractApiError(unknownError);

      expect(extracted.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(extracted.statusCode).toBe(500);
      expect(extracted.details?.originalError).toBe("Unknown");
    });
  });

  describe("formatApiErrorResponse", () => {
    it("should format error with all fields", () => {
      const apiError = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid email",
        { field: "email" }
      );

      const response = formatApiErrorResponse(apiError);

      expect(response).toEqual({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          statusCode: 422,
          message: "Invalid email",
          details: { field: "email" },
          requestId: expect.any(String),
          retryable: false,
        },
      });
    });

    it("should not include undefined details", () => {
      const apiError = new ApiError(ErrorCode.NOT_FOUND, "Not found");
      const response = formatApiErrorResponse(apiError);

      expect(response.error.details).toBeUndefined();
    });
  });
});
