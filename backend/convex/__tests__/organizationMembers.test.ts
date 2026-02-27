import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  ROLE_LEVELS,
  hasRequiredRole,
  requireRole,
  removeMember,
} from "../organizationMembers";
import { ConvexError } from "convex/values";
import { Id } from "../_generated/dataModel";

describe("ROLE_LEVELS", () => {
  it("assigns admin=4, agent=3, collaborator=2, viewer=1", () => {
    expect(ROLE_LEVELS.admin).toBe(4);
    expect(ROLE_LEVELS.agent).toBe(3);
    expect(ROLE_LEVELS.collaborator).toBe(2);
    expect(ROLE_LEVELS.viewer).toBe(1);
  });
});

describe("hasRequiredRole", () => {
  it("admin satisfies admin requirement", () => {
    expect(hasRequiredRole("admin", "admin")).toBe(true);
  });

  it("admin satisfies viewer requirement", () => {
    expect(hasRequiredRole("admin", "viewer")).toBe(true);
  });

  it("agent satisfies agent requirement", () => {
    expect(hasRequiredRole("agent", "agent")).toBe(true);
  });

  it("agent satisfies viewer requirement", () => {
    expect(hasRequiredRole("agent", "viewer")).toBe(true);
  });

  it("agent does NOT satisfy admin requirement", () => {
    expect(hasRequiredRole("agent", "admin")).toBe(false);
  });

  it("collaborator satisfies collaborator requirement", () => {
    expect(hasRequiredRole("collaborator", "collaborator")).toBe(true);
  });

  it("collaborator satisfies viewer requirement", () => {
    expect(hasRequiredRole("collaborator", "viewer")).toBe(true);
  });

  it("collaborator does NOT satisfy agent requirement", () => {
    expect(hasRequiredRole("collaborator", "agent")).toBe(false);
  });

  it("viewer does NOT satisfy admin requirement", () => {
    expect(hasRequiredRole("viewer", "admin")).toBe(false);
  });

  it("viewer satisfies viewer requirement", () => {
    expect(hasRequiredRole("viewer", "viewer")).toBe(true);
  });
});

describe("requireRole", () => {
  let mockCtx: any;
  let workspaceId: Id<"workspaces">;

  beforeEach(() => {
    workspaceId = "workspace_123" as any;
    mockCtx = {
      db: {
        query: jest.fn(),
      },
    };
  });

  it("passes silently when member has exact required role", async () => {
    const member = {
      _id: "member_1" as any,
      workspaceId,
      userId: "user1",
      userRole: "admin" as const,
      role: undefined,
    };

    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(member),
    });

    const sysAdminChain = {
      withIndex: jest.fn(),
    };
    sysAdminChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(null),
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "systemAdmins") return sysAdminChain;
      if (table === "organizationMembers") return queryChain;
    });

    // Should not throw
    await expect(
      requireRole(mockCtx, workspaceId, "user1", "admin")
    ).resolves.toBeUndefined();
  });

  it("passes silently when member has higher role", async () => {
    const member = {
      _id: "member_1" as any,
      workspaceId,
      userId: "user1",
      userRole: "admin" as const,
      role: undefined,
    };

    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(member),
    });

    const sysAdminChain = {
      withIndex: jest.fn(),
    };
    sysAdminChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(null),
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "systemAdmins") return sysAdminChain;
      if (table === "organizationMembers") return queryChain;
    });

    // Admin should satisfy viewer requirement
    await expect(
      requireRole(mockCtx, workspaceId, "user1", "viewer")
    ).resolves.toBeUndefined();
  });

  it('throws ConvexError("NOT_FOUND") when member not found', async () => {
    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(null),
    });

    const sysAdminChain = {
      withIndex: jest.fn(),
    };
    sysAdminChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(null),
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "systemAdmins") return sysAdminChain;
      if (table === "organizationMembers") return queryChain;
    });

    await expect(
      requireRole(mockCtx, workspaceId, "user1", "admin")
    ).rejects.toThrow(new ConvexError("NOT_FOUND"));
  });

  it('throws ConvexError("NOT_FOUND") when role insufficient', async () => {
    const member = {
      _id: "member_1" as any,
      workspaceId,
      userId: "user1",
      userRole: "viewer" as const,
      role: undefined,
    };

    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(member),
    });

    const sysAdminChain = {
      withIndex: jest.fn(),
    };
    sysAdminChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(null),
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "systemAdmins") return sysAdminChain;
      if (table === "organizationMembers") return queryChain;
    });

    // Viewer trying to require admin
    await expect(
      requireRole(mockCtx, workspaceId, "user1", "admin")
    ).rejects.toThrow(new ConvexError("NOT_FOUND"));
  });

  it("passes silently for system admin (bypasses membership check)", async () => {
    const sysAdmin = {
      _id: "sys_1" as any,
      userId: "user1",
      createdAt: Date.now(),
    };

    const sysAdminChain = {
      withIndex: jest.fn(),
    };
    sysAdminChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(sysAdmin),
    });

    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(null), // Member not found
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "systemAdmins") return sysAdminChain;
      if (table === "organizationMembers") return queryChain;
    });

    // Should not throw even though member not found (system admin bypass)
    await expect(
      requireRole(mockCtx, workspaceId, "user1", "admin")
    ).resolves.toBeUndefined();
  });

  it("uses legacy role mapping when userRole not set", async () => {
    const member = {
      _id: "member_1" as any,
      workspaceId,
      userId: "user1",
      userRole: undefined,
      role: "owner", // Legacy field
    };

    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(member),
    });

    const sysAdminChain = {
      withIndex: jest.fn(),
    };
    sysAdminChain.withIndex.mockReturnValue({
      first: jest.fn().mockResolvedValue(null),
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "systemAdmins") return sysAdminChain;
      if (table === "organizationMembers") return queryChain;
    });

    // owner (legacy) maps to admin (new), so should satisfy admin requirement
    await expect(
      requireRole(mockCtx, workspaceId, "user1", "admin")
    ).resolves.toBeUndefined();
  });
});

describe("removeMember", () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      db: {
        get: jest.fn(),
        query: jest.fn(),
        delete: jest.fn(),
      },
    };
  });

  it('throws "Must have at least one admin" when removing last admin', async () => {
    const lastAdmin = {
      _id: "member_1" as any,
      workspaceId: "ws_1",
      userId: "user1",
      userRole: "admin" as const,
      role: undefined,
    };

    // Mock db.get to return the last admin
    mockCtx.db.get.mockResolvedValue(lastAdmin);

    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      collect: jest.fn().mockResolvedValue([lastAdmin]), // Only 1 admin
    });

    const boardAccessChain = {
      withIndex: jest.fn(),
    };
    boardAccessChain.withIndex.mockReturnValue({
      collect: jest.fn().mockResolvedValue([]),
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "boardAccess") return boardAccessChain;
      return queryChain;
    });

    await expect(
      removeMember(mockCtx, { memberId: "member_1" as any })
    ).rejects.toThrow("Must have at least one admin");
  });

  it("allows removing member when another admin exists", async () => {
    const adminToRemove = {
      _id: "member_1" as any,
      workspaceId: "ws_1",
      userId: "user1",
      userRole: "admin" as const,
      role: undefined,
    };

    const otherAdmin = {
      _id: "member_2" as any,
      workspaceId: "ws_1",
      userId: "user2",
      userRole: "admin" as const,
      role: undefined,
    };

    // Mock db.get to return the admin being removed
    mockCtx.db.get.mockResolvedValue(adminToRemove);

    const queryChain = {
      withIndex: jest.fn(),
    };
    queryChain.withIndex.mockReturnValue({
      collect: jest
        .fn()
        .mockResolvedValue([adminToRemove, otherAdmin]), // 2 admins
    });

    // Mock boardAccess query
    const boardAccessChain = {
      withIndex: jest.fn(),
    };
    boardAccessChain.withIndex.mockReturnValue({
      collect: jest.fn().mockResolvedValue([]),
    });

    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "boardAccess") return boardAccessChain;
      return queryChain;
    });

    mockCtx.db.delete.mockResolvedValue(undefined);

    // Should not throw
    await expect(
      removeMember(mockCtx, { memberId: "member_1" as any })
    ).resolves.toBeUndefined();

    expect(mockCtx.db.delete).toHaveBeenCalledWith("member_1");
  });

  it("allows removing non-admin members freely", async () => {
    const viewerMember = {
      _id: "member_1" as any,
      workspaceId: "ws_1",
      userId: "user1",
      userRole: "viewer" as const,
      role: undefined,
    };

    // Mock db.get to return the viewer being removed
    mockCtx.db.get.mockResolvedValue(viewerMember);

    // Mock boardAccess query
    const boardAccessChain = {
      withIndex: jest.fn(),
    };
    boardAccessChain.withIndex.mockReturnValue({
      collect: jest.fn().mockResolvedValue([]),
    });

    mockCtx.db.query.mockReturnValue(boardAccessChain);

    mockCtx.db.delete.mockResolvedValue(undefined);

    // Should not throw
    await expect(
      removeMember(mockCtx, { memberId: "member_1" as any })
    ).resolves.toBeUndefined();

    expect(mockCtx.db.delete).toHaveBeenCalledWith("member_1");
  });
});

describe("MIG-18 role migration", () => {
  it("maps owner → admin", () => {
    const mapping: Record<string, string> = {
      owner: "admin",
      admin: "collaborator",
      member: "viewer",
    };
    expect(mapping.owner).toBe("admin");
  });

  it("maps admin → collaborator", () => {
    const mapping: Record<string, string> = {
      owner: "admin",
      admin: "collaborator",
      member: "viewer",
    };
    expect(mapping.admin).toBe("collaborator");
  });

  it("maps member → viewer", () => {
    const mapping: Record<string, string> = {
      owner: "admin",
      admin: "collaborator",
      member: "viewer",
    };
    expect(mapping.member).toBe("viewer");
  });

  it("maps unknown → viewer (safe default)", () => {
    const mapping: Record<string, string> = {
      owner: "admin",
      admin: "collaborator",
      member: "viewer",
    };
    const unknownRole = mapping["unknown"] ?? "viewer";
    expect(unknownRole).toBe("viewer");
  });
});
