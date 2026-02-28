import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { requireWorkspaceRole, WorkspaceRoleContext } from "../rbac";
import { NotFoundError } from "../errors";

// Mock ConvexHttpClient
jest.mock("convex/browser", () => ({
  ConvexHttpClient: jest.fn(),
}));

jest.mock("@/convex/_generated/api", () => ({
  api: {
    organizationMembers: {
      hasAccess: "organizationMembers.hasAccess",
    },
  },
}));

import { ConvexHttpClient } from "convex/browser";

describe("requireWorkspaceRole", () => {
  let mockConvexClient: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConvexClient = {
      query: jest.fn(),
    };
    (ConvexHttpClient as jest.Mock).mockReturnValue(mockConvexClient);
  });

  it("returns WorkspaceRoleContext when membership confirmed", async () => {
    mockConvexClient.query.mockResolvedValue(true);

    const result = await requireWorkspaceRole("ws_123", "user_456", "viewer");

    expect(result).toEqual({
      workspaceId: "ws_123",
      userId: "user_456",
      userRole: "viewer",
    });
  });

  it("throws NotFoundError (404) when hasAccess returns false", async () => {
    mockConvexClient.query.mockResolvedValue(false);

    await expect(
      requireWorkspaceRole("ws_123", "user_456", "viewer")
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError (404) when Convex throws (invalid workspaceId)", async () => {
    mockConvexClient.query.mockRejectedValue(
      new Error("Invalid workspaceId format")
    );

    await expect(
      requireWorkspaceRole("invalid_id", "user_456", "viewer")
    ).rejects.toThrow(NotFoundError);
  });

  it("defaults to viewer role when requiredRole not specified", async () => {
    mockConvexClient.query.mockResolvedValue(true);

    const result = await requireWorkspaceRole("ws_123", "user_456");

    expect(result.userRole).toBe("viewer");
  });

  it("calls hasAccess with correct workspaceId, userId, requiredRole", async () => {
    mockConvexClient.query.mockResolvedValue(true);

    await requireWorkspaceRole("ws_123", "user_456", "collaborator");

    expect(mockConvexClient.query).toHaveBeenCalledWith(
      "organizationMembers.hasAccess",
      {
        workspaceId: "ws_123",
        userId: "user_456",
        requiredRole: "collaborator",
      }
    );
  });
});
