/**
 * React Hooks for Performance Optimization
 *
 * Provides easy-to-use hooks for memoization, caching, and performance monitoring
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { metrics, monitor } from "@/lib/monitoring";
import { log } from "@/lib/logger";

/**
 * Hook to monitor component render time
 */
export function useRenderMonitoring(componentName: string) {
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = performance.now();

    return () => {
      const duration = performance.now() - startTimeRef.current;
      metrics.recordComponentRender(componentName, duration);

      if (duration > 100) {
        log.warn(`Component ${componentName} took ${duration.toFixed(2)}ms to render`);
      }
    };
  }, [componentName]);
}

/**
 * Hook to track async operations with timing
 */
export function useAsyncOperation<T>(
  asyncFn: () => Promise<T>,
  operationName: string,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const startTime = performance.now();
      const result = await asyncFn();
      const duration = performance.now() - startTime;

      metrics.recordApiCall(operationName, duration, true);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      metrics.recordApiCall(operationName, 0, false);
      log.error(`Async operation failed: ${operationName}`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, deps);

  return { data, error, isLoading, execute };
}

/**
 * Hook for debounced callbacks to reduce re-renders
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Hook for throttled callbacks
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 300
): T {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args) => {
      const now = Date.now();
      if (now - lastCallRef.current >= interval) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [interval]
  );
}

/**
 * Hook for memoizing expensive computations with conditional invalidation
 */
export function useComputation<T>(
  computeFn: () => T,
  deps: any[],
  shouldRecompute: () => boolean = () => true
): T {
  const [value, setValue] = useState<T>(() => computeFn());
  const shouldRecomputeRef = useRef(shouldRecompute);

  useEffect(() => {
    shouldRecomputeRef.current = shouldRecompute;
  }, [shouldRecompute]);

  useEffect(() => {
    if (shouldRecomputeRef.current()) {
      setValue(computeFn());
    }
  }, deps);

  return value;
}

/**
 * Hook for lazy loading data with caching
 */
export function useLazyQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  cacheTime: number = 5 * 60 * 1000 // 5 min
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cacheRef = useRef<{ data: T; timestamp: number } | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh && cacheRef.current) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < cacheTime) {
        setData(cacheRef.current.data);
        return cacheRef.current.data;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const startTime = performance.now();
      const result = await queryFn();
      const duration = performance.now() - startTime;

      metrics.recordQuery(key, duration, 1);
      cacheRef.current = { data: result, timestamp: Date.now() };
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      metrics.recordQuery(key, 0, 0);
      log.error(`Query failed: ${key}`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [key, queryFn, cacheTime]);

  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return { data, error, isLoading, load, invalidateCache };
}

/**
 * Hook for batch operations with deduplication
 */
export function useBatchOperation<Item, Result>(
  batchFn: (items: Item[]) => Promise<Result[]>,
  batchSize: number = 10,
  debounceMs: number = 100
) {
  const [items, setItems] = useState<Item[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();
  const batchedResults = useRef<Map<Item, Result>>(new Map());

  const add = useCallback((item: Item) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const process = useCallback(async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const batch = items.slice(0, batchSize);

    try {
      const startTime = performance.now();
      const batchResults = await batchFn(batch);
      const duration = performance.now() - startTime;

      metrics.recordBulkOperation(
        "batch_operation",
        batch.length,
        duration,
        true
      );

      batch.forEach((item, index) => {
        batchedResults.current.set(item, batchResults[index]);
      });

      setItems((prev) => prev.slice(batchSize));
      setResults(Array.from(batchedResults.current.values()));
    } catch (error) {
      log.error("Batch operation failed", error as Error);
      metrics.recordBulkOperation("batch_operation", batch.length, 0, false);
    } finally {
      setIsProcessing(false);
    }
  }, [items, isProcessing, batchSize, batchFn]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (items.length >= batchSize) {
      process();
    } else if (items.length > 0) {
      timerRef.current = setTimeout(process, debounceMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, batchSize, debounceMs, process]);

  return { add, isProcessing, results };
}

/**
 * Hook to track user interactions
 */
export function useInteractionTracking(actionName: string) {
  const startTimeRef = useRef<number>(0);

  const trackStart = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const trackEnd = useCallback(
    (success: boolean, error?: string) => {
      const duration = performance.now() - startTimeRef.current;
      metrics.recordInteraction({
        action: actionName,
        duration,
        success,
        error,
      });
    },
    [actionName]
  );

  return { trackStart, trackEnd };
}
