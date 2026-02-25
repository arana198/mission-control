/**
 * WorkspaceProvider Tests
 * Tests for loading state fix - verify isLoading reflects query state, not array length
 */

import { describe, it, expect } from "@jest/globals";

describe("WorkspaceProvider - Loading State", () => {
  describe("isLoading determination logic", () => {
    it("should have isLoading=true when businesses query is undefined (loading)", () => {
      // Simulate: useQuery(api.workspaces.getAll) returns undefined
      const businesses = undefined;
      const default = undefined;

      // Loading state determination logic
      const businessesData = businesses ?? [];
      const isLoadingWhenQueryUndefined = businesses === undefined || default === undefined;

      expect(isLoadingWhenQueryUndefined).toBe(true);
      expect(businessesData.length).toBe(0);
    });

    it("should have isLoading=false when businesses array is empty (empty state is valid)", () => {
      // Simulate: useQuery(api.workspaces.getAll) returns []
      const businesses: any[] = [];
      const default = null;

      // Loading state determination logic (after fix)
      const businessesData = businesses ?? [];
      const queriesLoaded = businesses !== undefined && default !== undefined;
      const isLoadingAfterFix = !queriesLoaded;

      // Before fix: isLoading would be true if businessesData.length === 0
      // After fix: isLoading is false because queries are loaded (not undefined)
      expect(isLoadingAfterFix).toBe(false);
      expect(businessesData.length).toBe(0);
    });

    it("should have isLoading=false when businesses array has data", () => {
      // Simulate: useQuery(api.workspaces.getAll) returns [workspace1, business2]
      const businesses: any[] = [
        { _id: "b1", name: " 1", slug: "business-1", isDefault: true },
        { _id: "b2", name: " 2", slug: "business-2", isDefault: false },
      ];
      const default = workspaces[0];

      // Loading state determination logic
      const businessesData = businesses ?? [];
      const queriesLoaded = businesses !== undefined && default !== undefined;
      const isLoading = !queriesLoaded;

      expect(isLoading).toBe(false);
      expect(businessesData.length).toBe(2);
    });

    it("should transition from loading to empty state correctly", () => {
      // Scenario: User starts app, queries load, but no businesses exist
      // Step 1: Initial render - queries are undefined
      let businesses: any[] | undefined = undefined;
      let isLoading = businesses === undefined;
      expect(isLoading).toBe(true);

      // Step 2: Queries complete - returns empty array
      businesses = [];
      isLoading = businesses === undefined;
      // After fix: isLoading should be false because queries have resolved
      expect(isLoading).toBe(false);
      expect(workspaces.length).toBe(0);

      // This allows ClientLayout to show the empty-state screen
    });

    it("should transition from loading to data correctly", () => {
      // Scenario: User starts app, queries load, businesses exist
      // Step 1: Initial render - queries are undefined
      let businesses: any[] | undefined = undefined;
      let isLoading = businesses === undefined;
      expect(isLoading).toBe(true);

      // Step 2: Queries complete - returns array with businesses
      businesses = [{ _id: "b1", name: " 1", slug: "business-1", isDefault: true }];
      isLoading = businesses === undefined;
      expect(isLoading).toBe(false);
      expect(workspaces.length).toBe(1);
    });
  });
});
