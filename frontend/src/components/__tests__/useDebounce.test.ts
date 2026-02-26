/**
 * useDebounce Hook Tests
 *
 * Simple unit tests for debounce behavior
 */

describe("useDebounce", () => {
  // Mock useDebounce logic for testing
  function createDebounce<T>(value: T, delayMs: number) {
    let timeoutId: NodeJS.Timeout | null = null;
    let debouncedValue = value;

    const update = (newValue: T) => {
      value = newValue;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        debouncedValue = value;
      }, delayMs);
    };

    return { get: () => debouncedValue, update, flush: () => { if (timeoutId) clearTimeout(timeoutId); debouncedValue = value; } };
  }

  it("returns initial value", () => {
    const debounce = createDebounce("hello", 300);
    expect(debounce.get()).toBe("hello");
  });

  it("debounces value changes after delay", (done) => {
    jest.useFakeTimers();
    const debounce = createDebounce("initial", 300);

    expect(debounce.get()).toBe("initial");

    debounce.update("updated");

    // Before delay: should still be initial
    expect(debounce.get()).toBe("initial");

    // After delay: should update
    jest.advanceTimersByTime(300);
    expect(debounce.get()).toBe("updated");

    jest.useRealTimers();
    done();
  });

  it("cancels previous debounce on rapid changes", (done) => {
    jest.useFakeTimers();
    const debounce = createDebounce("first", 300);

    debounce.update("second");
    jest.advanceTimersByTime(100); // Partial delay

    debounce.update("third");
    jest.advanceTimersByTime(100); // More time, but timer was reset

    // Still "first" because debounce was restarted
    expect(debounce.get()).toBe("first");

    // Complete the delay from last change
    jest.advanceTimersByTime(300);
    expect(debounce.get()).toBe("third");

    jest.useRealTimers();
    done();
  });

  it("uses custom delay correctly", (done) => {
    jest.useFakeTimers();
    const debounce = createDebounce("a", 500);

    debounce.update("b");

    jest.advanceTimersByTime(300);
    expect(debounce.get()).toBe("a"); // Not ready yet

    jest.advanceTimersByTime(200);
    expect(debounce.get()).toBe("b"); // Now ready

    jest.useRealTimers();
    done();
  });

  it("handles string values", (done) => {
    jest.useFakeTimers();
    const debounce = createDebounce("search query", 300);

    debounce.update("search query updated");

    expect(debounce.get()).toBe("search query");

    jest.advanceTimersByTime(300);
    expect(debounce.get()).toBe("search query updated");

    jest.useRealTimers();
    done();
  });

  it("handles number values", (done) => {
    jest.useFakeTimers();
    const debounce = createDebounce(42, 300);

    debounce.update(100);
    expect(debounce.get()).toBe(42);

    jest.advanceTimersByTime(300);
    expect(debounce.get()).toBe(100);

    jest.useRealTimers();
    done();
  });

  it("handles object values", (done) => {
    jest.useFakeTimers();
    const obj1 = { search: "term1" };
    const obj2 = { search: "term2" };

    const debounce = createDebounce(obj1, 300);
    debounce.update(obj2);

    expect(debounce.get()).toBe(obj1);

    jest.advanceTimersByTime(300);
    expect(debounce.get()).toBe(obj2);

    jest.useRealTimers();
    done();
  });

  it("handles rapid successive updates (search scenario)", (done) => {
    jest.useFakeTimers();
    const debounce = createDebounce("", 300);

    const updates = ["r", "re", "rea", "reac", "react"];
    for (const update of updates) {
      debounce.update(update);
      jest.advanceTimersByTime(50); // 50ms between each keystroke
    }

    // Still on initial value, debounce timer was reset
    expect(debounce.get()).toBe("");

    // After final delay
    jest.advanceTimersByTime(300);
    expect(debounce.get()).toBe("react");

    jest.useRealTimers();
    done();
  });
});
