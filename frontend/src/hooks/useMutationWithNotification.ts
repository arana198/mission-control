/**
 * useMutationWithNotification Hook
 *
 * Reusable hook that combines Convex mutation execution with error handling and notifications.
 * Eliminates repeated try-catch-notification pattern throughout components.
 *
 * Usage:
 * ```tsx
 * const { execute, isLoading } = useMutationWithNotification(
 *   updateTask,
 *   {
 *     successMessage: "Task updated successfully",
 *     errorMap: {
 *       "CIRCULAR_DEPENDENCY": "Cannot add dependency: would create circular reference"
 *     }
 *   }
 * );
 *
 * const handleUpdate = async (args) => {
 *   await execute(args);
 * };
 * ```
 */

import { useCallback, useState } from 'react';
import { useNotification } from './useNotification';

interface UseMutationWithNotificationOptions {
  successMessage?: string;
  errorMap?: Record<string, string>;
  onSuccess?: (result?: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for executing Convex mutations with automatic error handling and notifications
 */
export function useMutationWithNotification<TArgs = any, TResult = any>(
  mutation: (args: TArgs) => Promise<TResult>,
  options: UseMutationWithNotificationOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const notif = useNotification();

  const {
    successMessage = 'Operation completed successfully',
    errorMap = {},
    onSuccess,
    onError,
  } = options;

  const execute = useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      setIsLoading(true);
      try {
        const result = await mutation(args);
        notif.success(successMessage);
        onSuccess?.(result);
        return result;
      } catch (error: any) {
        const errorMessage = error?.message || 'An error occurred';

        // Check if error matches mapped error codes
        let displayMessage = successMessage;
        for (const [errorCode, message] of Object.entries(errorMap)) {
          if (errorMessage.includes(errorCode)) {
            displayMessage = message;
            break;
          }
        }

        // Use mapped message if found, otherwise use generic error
        if (displayMessage === successMessage) {
          displayMessage = `Error: ${errorMessage}`;
        }

        notif.error(displayMessage);
        onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [mutation, notif, successMessage, errorMap, onSuccess, onError]
  );

  return { execute, isLoading };
}
