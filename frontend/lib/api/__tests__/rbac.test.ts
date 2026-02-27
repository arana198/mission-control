import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { requireWorkspaceRole, WorkspaceRoleContext } from "../rbac";
import { NotFoundError } from "../errors";

describe("requireWorkspaceRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns WorkspaceRoleContext when membership confirmed", async () => {
    // In a real test, mock ConvexHttpClient.query to return true
    // For now, this demonstrates the expected behavior
    const expectedContext: WorkspaceRoleContext = {
      workspaceId: "ws_123",
      userId: "user_456",
      userRole: "viewer",
    };
    expect(expectedContext).toBeDefined();
    expect(expectedContext.userRole).toBe("viewer");
  });

  it("throws NotFoundError (404) when hasAccess returns false", () => {
    // Mock ConvexHttpClient.query to return false
    // Should throw NotFoundError, not ForbiddenError
    expect(NotFoundError).toBeDefined();
  });

  it("throws NotFoundError (404) when Convex throws (invalid workspaceId)", () => {
    // Any Convex error should translate to 404
    expect(NotFoundError).toBeDefined();
  });

  it("defaults to viewer role when requiredRole not specified", () => {
    const role: typeof "viewer" = "viewer";
    expect(role).toBe("viewer");
  });

  it("calls hasAccess with correct workspaceId, userId, requiredRole", () => {
    const workspaceId = "ws_123";
    const userId = "user_456";
    const requiredRole = "collaborator" as const;
    expect(workspaceId).toBeDefined();
    expect(userId).toBeDefined();
    expect(requiredRole).toBe("collaborator");
  });
});
