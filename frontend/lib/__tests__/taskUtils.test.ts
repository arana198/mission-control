import { isOverdue, isDueSoon } from '../taskUtils';

describe('taskUtils', () => {
  // Mock current time for consistent testing
  const NOW = 1704067200000; // 2024-01-01 00:00:00 UTC

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isOverdue', () => {
    it('returns false when dueDate is undefined', () => {
      expect(isOverdue(undefined)).toBe(false);
    });

    it('returns false when dueDate is in the future', () => {
      const futureDueDate = NOW + 86400000; // +1 day
      expect(isOverdue(futureDueDate)).toBe(false);
    });

    it('returns false when dueDate is in the past but less than 1 day ago', () => {
      const recent = NOW - 3600000; // -1 hour
      expect(isOverdue(recent)).toBe(false);
    });

    it('returns true when dueDate is more than 1 day in the past', () => {
      const pastDueDate = NOW - 86400001; // -1 day -1ms
      expect(isOverdue(pastDueDate)).toBe(true);
    });

    it('returns true when dueDate is exactly 1 day in the past', () => {
      const oneDay = NOW - 86400000; // -1 day exactly
      expect(isOverdue(oneDay)).toBe(true);
    });

    it('returns false when dueDate is exactly 1 day in the future', () => {
      const oneDay = NOW + 86400000; // +1 day exactly
      expect(isOverdue(oneDay)).toBe(false);
    });
  });

  describe('isDueSoon', () => {
    it('returns false when dueDate is undefined', () => {
      expect(isDueSoon(undefined)).toBe(false);
    });

    it('returns false when dueDate is in the past', () => {
      const pastDueDate = NOW - 86400000; // -1 day
      expect(isDueSoon(pastDueDate)).toBe(false);
    });

    it('returns false when dueDate is more than 2 days in the future', () => {
      const future = NOW + 172800001; // +2 days +1ms
      expect(isDueSoon(future)).toBe(false);
    });

    it('returns true when dueDate is within 48 hours (2 days) in the future', () => {
      const within48h = NOW + 86400000; // +1 day
      expect(isDueSoon(within48h)).toBe(true);
    });

    it('returns true when dueDate is exactly 48 hours in the future', () => {
      const exactlyTwoDays = NOW + 172800000; // +2 days exactly
      expect(isDueSoon(exactlyTwoDays)).toBe(true);
    });

    it('returns true when dueDate is 1 minute from now', () => {
      const soon = NOW + 60000; // +1 minute
      expect(isDueSoon(soon)).toBe(true);
    });

    it('returns false when dueDate is 0 (edge case)', () => {
      expect(isDueSoon(0)).toBe(false);
    });
  });
});
