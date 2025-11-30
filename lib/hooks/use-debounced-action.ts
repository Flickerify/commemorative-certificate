import { useCallback, useRef } from 'react';

/**
 * A hook that debounces an async action to prevent rapid-fire calls.
 * Useful for preventing race conditions with webhook updates.
 */
export function useDebouncedAction<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  action: T,
  delay: number = 500,
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRef = useRef<{
    args: Parameters<T>;
    resolve: (value: ReturnType<T>) => void;
    reject: (error: unknown) => void;
  } | null>(null);

  const debouncedAction = useCallback(
    (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return new Promise((resolve, reject) => {
        // Clear any pending timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Store the latest call
        pendingRef.current = { args, resolve, reject };

        // Set up debounced execution
        timeoutRef.current = setTimeout(async () => {
          const pending = pendingRef.current;
          if (pending) {
            try {
              const result = await action(...pending.args);
              pending.resolve(result);
            } catch (error) {
              pending.reject(error);
            } finally {
              pendingRef.current = null;
            }
          }
        }, delay);
      });
    },
    [action, delay],
  );

  return debouncedAction;
}
