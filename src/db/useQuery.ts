import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { getVersion, subscribe } from './database';

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  refetch: () => void;
}

/**
 * Runs a repository read and re-runs it whenever `deps` change or any
 * repository write calls notifyChange(). Previous data stays visible while
 * a refresh is in flight. `deps` must be primitives.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([version, nonce, ...deps]);
  const [state, setState] = useState<{ key?: string; data?: T; error?: Error }>({});

  useEffect(() => {
    let cancelled = false;
    fn()
      .then((data) => {
        if (!cancelled) setState({ key, data });
      })
      .catch((error: Error) => {
        if (!cancelled) setState((s) => ({ key, data: s.data, error }));
      });
    return () => {
      cancelled = true;
    };
    // `fn` is re-created every render; `key` captures everything it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.data, error: state.error, loading: state.key !== key, refetch };
}
