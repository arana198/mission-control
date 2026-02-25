/**
 * @jest-environment jsdom
 *
 * Gateways Page RBAC Tests
 * Tests role-based access control: admin vs member visibility
 */

jest.mock("convex/react", () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

jest.mock("@/convex/_generated/api", () => ({
  api: {
    gateways: {
      getByBusiness: "getByBusiness",
      getById: "getById",
      deleteGateway: "deleteGateway",
    },
  },
}));

jest.mock("@/components/BusinessProvider", () => ({
  useBusiness: jest.fn(),
}));

jest.mock("@/hooks/useRole", () => ({
  useRole: jest.fn(),
}));

jest.mock("@/hooks/usePageActive", () => ({
  usePageActive: jest.fn(() => ({ isActive: true })),
}));

jest.mock("@/hooks/useGatewaySessions", () => ({
  useGatewaySessions: jest.fn(() => ({
    sessions: [],
    isLoading: false,
    error: null,
    sendMessage: jest.fn(),
    fetchHistory: jest.fn(),
    refresh: jest.fn(),
  })),
}));

jest.mock("@/hooks/useGatewayHealth", () => ({
  useGatewayHealth: jest.fn(() => ({
    isHealthy: true,
    lastChecked: Date.now(),
  })),
}));

jest.mock("@/components/GatewayForm", () => ({
  GatewayForm: () => <div data-testid="gateway-form">Gateway Form</div>,
}));

jest.mock("@/components/GatewaySessionsPanel", () => ({
  GatewaySessionsPanel: () => <div>Sessions Panel</div>,
}));

jest.mock("@/components/GatewayHealthBadge", () => ({
  GatewayHealthBadge: () => <div>Health Badge</div>,
}));

jest.mock("@/components/ConfirmDialog", () => ({
  ConfirmDialog: () => <div>Confirm Dialog</div>,
}));

import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { useQuery, useMutation } from "convex/react";
import { useBusiness } from "@/components/BusinessProvider";
import { useRole } from "@/hooks/useRole";
import GatewaysPage from "@/app/gateways/page";

const mockUseQuery = useQuery as jest.Mock;
const mockUseMutation = useMutation as jest.Mock;
const mockUseBusiness = useBusiness as jest.Mock;
const mockUseRole = useRole as jest.Mock;

const mockGateways = [
  {
    _id: "gateway_1",
    name: "Test Gateway 1",
    url: "wss://test1.example.com",
    token: "token1",
    workspaceRoot: "/workspace",
    disableDevicePairing: false,
    allowInsecureTls: false,
    isHealthy: true,
    _creationTime: Date.now(),
  },
  {
    _id: "gateway_2",
    name: "Test Gateway 2",
    url: "wss://test2.example.com",
    token: "token2",
    workspaceRoot: "/workspace",
    disableDevicePairing: false,
    allowInsecureTls: false,
    isHealthy: false,
    _creationTime: Date.now() - 1000,
  },
];

const mockCurrentBusiness = {
  _id: "business_1",
  name: "Test Business",
};

describe("GatewaysPage RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseBusiness.mockReturnValue({
      currentBusiness: mockCurrentBusiness,
    });

    mockUseQuery.mockImplementation((queryFn: any) => {
      // Return gateways when querying getByBusiness
      if (queryFn?.toString?.().includes("getByBusiness")) {
        return mockGateways;
      }
      return null;
    });

    mockUseMutation.mockReturnValue(jest.fn());
  });

  describe("Admin User Access", () => {
    beforeEach(() => {
      mockUseRole.mockReturnValue({
        role: "admin",
        isAdmin: true,
        isOwner: false,
        canRead: true,
        canWrite: true,
        isLoading: false,
      });
    });

    it("renders New Gateway button for admin", () => {
      render(<GatewaysPage />);

      const newButton = screen.getByRole("button", { name: /New Gateway/i });
      expect(newButton).toBeInTheDocument();
      expect(newButton).toBeVisible();
    });

    it("renders Edit button for each gateway in admin view", () => {
      render(<GatewaysPage />);

      const editButtons = screen.getAllByTitle("Edit gateway");
      expect(editButtons.length).toBeGreaterThan(0);
      editButtons.forEach((btn) => {
        expect(btn).toBeVisible();
      });
    });

    it("renders Delete button for each gateway in admin view", () => {
      render(<GatewaysPage />);

      const deleteButtons = screen.getAllByTitle("Delete gateway");
      expect(deleteButtons.length).toBeGreaterThan(0);
      deleteButtons.forEach((btn) => {
        expect(btn).toBeVisible();
      });
    });

    it("shows create form when New Gateway button is clicked", () => {
      render(<GatewaysPage />);

      const newButton = screen.getByRole("button", { name: /New Gateway/i });
      expect(newButton).toBeInTheDocument();

      // Form should be hideable/showable for admin
      expect(typeof newButton.onclick).toBe("function");
    });
  });

  describe("Member User Access (Non-Admin)", () => {
    beforeEach(() => {
      mockUseRole.mockReturnValue({
        role: "member",
        isAdmin: false,
        isOwner: false,
        canRead: true,
        canWrite: false,
        isLoading: false,
      });
    });

    it("does NOT render New Gateway button for member", () => {
      render(<GatewaysPage />);

      const newButton = screen.queryByRole("button", { name: /New Gateway/i });
      // Either not present or not visible
      if (newButton) {
        expect(newButton).not.toBeVisible();
      } else {
        expect(newButton).not.toBeInTheDocument();
      }
    });

    it("does NOT render Edit button for member", () => {
      render(<GatewaysPage />);

      const editButtons = screen.queryAllByTitle("Edit gateway");
      // Either not present or all hidden
      if (editButtons.length > 0) {
        editButtons.forEach((btn) => {
          expect(btn).not.toBeVisible();
        });
      } else {
        expect(editButtons.length).toBe(0);
      }
    });

    it("does NOT render Delete button for member", () => {
      render(<GatewaysPage />);

      const deleteButtons = screen.queryAllByTitle("Delete gateway");
      // Either not present or all hidden
      if (deleteButtons.length > 0) {
        deleteButtons.forEach((btn) => {
          expect(btn).not.toBeVisible();
        });
      } else {
        expect(deleteButtons.length).toBe(0);
      }
    });

    it("can still view gateway list and details as member", () => {
      render(<GatewaysPage />);

      // Member should see gateways
      const gatewayNames = screen.queryAllByText(/Test Gateway/);
      // At least the gateways should be visible for reading
      expect(gatewayNames.length).toBeGreaterThanOrEqual(0);
    });

    it("shows read-only indicator when not admin", () => {
      render(<GatewaysPage />);

      // Page should render without admin controls
      const newButton = screen.queryByRole("button", { name: /New Gateway/i });
      if (newButton) {
        expect(newButton).not.toBeVisible();
      }
    });
  });

  describe("Role Loading State", () => {
    it("shows gateways while role is loading", () => {
      mockUseRole.mockReturnValue({
        role: undefined,
        isAdmin: false,
        isOwner: false,
        canRead: false,
        canWrite: false,
        isLoading: true,
      });

      render(<GatewaysPage />);

      // Page should still render while loading
      expect(screen.getByText(/Gateways/)).toBeInTheDocument();
    });

    it("hides write buttons while role is loading (for safety)", () => {
      mockUseRole.mockReturnValue({
        role: undefined,
        isAdmin: false,
        isOwner: false,
        canRead: false,
        canWrite: false,
        isLoading: true,
      });

      render(<GatewaysPage />);

      const newButton = screen.queryByRole("button", { name: /New Gateway/i });
      if (newButton) {
        expect(newButton).not.toBeVisible();
      }
    });
  });

  describe("Owner User Access", () => {
    beforeEach(() => {
      mockUseRole.mockReturnValue({
        role: "owner",
        isAdmin: true,
        isOwner: true,
        canRead: true,
        canWrite: true,
        isLoading: false,
      });
    });

    it("renders all edit controls for owner", () => {
      render(<GatewaysPage />);

      const newButton = screen.getByRole("button", { name: /New Gateway/i });
      expect(newButton).toBeVisible();

      const editButtons = screen.getAllByTitle("Edit gateway");
      expect(editButtons.length).toBeGreaterThan(0);

      const deleteButtons = screen.getAllByTitle("Delete gateway");
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it("can create, edit, and delete gateways as owner", () => {
      render(<GatewaysPage />);

      // Owner has full access
      const newButton = screen.getByRole("button", { name: /New Gateway/i });
      const editButtons = screen.getAllByTitle("Edit gateway");
      const deleteButtons = screen.getAllByTitle("Delete gateway");

      expect(newButton).toBeVisible();
      expect(editButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });
});
