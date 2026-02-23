import { getTaskIdRange } from "../rangeSelect";

describe("getTaskIdRange", () => {
  const taskIds = ["task-a", "task-b", "task-c", "task-d", "task-e"];

  describe("basic range selection", () => {
    it("returns inclusive range between two IDs in correct order", () => {
      const result = getTaskIdRange(taskIds, "task-b", "task-d");
      expect(result).toEqual(["task-b", "task-c", "task-d"]);
    });

    it("handles reversed selection (toId before fromId)", () => {
      const result = getTaskIdRange(taskIds, "task-d", "task-b");
      expect(result).toEqual(["task-b", "task-c", "task-d"]);
    });

    it("returns single item when fromId === toId", () => {
      const result = getTaskIdRange(taskIds, "task-c", "task-c");
      expect(result).toEqual(["task-c"]);
    });

    it("returns range from first to last ID", () => {
      const result = getTaskIdRange(taskIds, "task-a", "task-e");
      expect(result).toEqual(["task-a", "task-b", "task-c", "task-d", "task-e"]);
    });

    it("returns range with just two adjacent IDs", () => {
      const result = getTaskIdRange(taskIds, "task-a", "task-b");
      expect(result).toEqual(["task-a", "task-b"]);
    });
  });

  describe("edge cases with missing IDs", () => {
    it("returns [toId] when fromId is not in list", () => {
      const result = getTaskIdRange(taskIds, "task-invalid", "task-c");
      expect(result).toEqual(["task-c"]);
    });

    it("returns [toId] when toId is not in list", () => {
      const result = getTaskIdRange(taskIds, "task-b", "task-invalid");
      expect(result).toEqual(["task-invalid"]);
    });

    it("returns [toId] when both IDs are not in list", () => {
      const result = getTaskIdRange(taskIds, "task-invalid1", "task-invalid2");
      expect(result).toEqual(["task-invalid2"]);
    });

    it("handles empty list gracefully", () => {
      const result = getTaskIdRange([], "task-a", "task-b");
      expect(result).toEqual(["task-b"]);
    });
  });

  describe("single element lists", () => {
    it("handles range selection with single-item list (found)", () => {
      const result = getTaskIdRange(["task-x"], "task-x", "task-x");
      expect(result).toEqual(["task-x"]);
    });

    it("handles range selection with single-item list (not found)", () => {
      const result = getTaskIdRange(["task-x"], "task-y", "task-z");
      expect(result).toEqual(["task-z"]);
    });
  });

  describe("duplicate IDs in list", () => {
    it("uses first occurrence of fromId and toId", () => {
      const withDuplicates = ["task-1", "task-2", "task-1", "task-3"];
      const result = getTaskIdRange(withDuplicates, "task-2", "task-3");
      expect(result).toEqual(["task-2", "task-1", "task-3"]);
    });
  });

  describe("real-world usage scenarios", () => {
    it("simulates shift+clicking from task 2 to task 4 in a column", () => {
      const columnTaskIds = [
        "65a1234b567c8d90e1f2g3h4",
        "65a1234b567c8d90e1f2g3h5",
        "65a1234b567c8d90e1f2g3h6",
        "65a1234b567c8d90e1f2g3h7",
        "65a1234b567c8d90e1f2g3h8",
      ];
      const result = getTaskIdRange(
        columnTaskIds,
        "65a1234b567c8d90e1f2g3h5",
        "65a1234b567c8d90e1f2g3h7"
      );
      expect(result).toEqual([
        "65a1234b567c8d90e1f2g3h5",
        "65a1234b567c8d90e1f2g3h6",
        "65a1234b567c8d90e1f2g3h7",
      ]);
    });

    it("handles numeric string IDs (common in databases)", () => {
      const numericIds = ["1", "2", "3", "4", "5"];
      const result = getTaskIdRange(numericIds, "2", "4");
      expect(result).toEqual(["2", "3", "4"]);
    });

    it("handles mixed case string IDs", () => {
      const mixedCaseIds = ["TASK-A", "task-b", "Task-C", "TASK-D"];
      const result = getTaskIdRange(mixedCaseIds, "task-b", "TASK-D");
      expect(result).toEqual(["task-b", "Task-C", "TASK-D"]);
    });
  });

  describe("deterministic behavior", () => {
    it("produces consistent results with same input", () => {
      const result1 = getTaskIdRange(taskIds, "task-b", "task-d");
      const result2 = getTaskIdRange(taskIds, "task-b", "task-d");
      expect(result1).toEqual(result2);
    });

    it("produces same result regardless of selection direction", () => {
      const result1 = getTaskIdRange(taskIds, "task-b", "task-d");
      const result2 = getTaskIdRange(taskIds, "task-d", "task-b");
      expect(result1).toEqual(result2);
    });
  });
});
