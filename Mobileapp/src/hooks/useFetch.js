import { useQuery } from '@tanstack/react-query';

/**
 * useFetch — thin wrapper for TanStack Query's useQuery.
 */
export function useFetch(queryKey, fetcher, options = {}) {
  return useQuery({
    queryKey,
    queryFn: fetcher,
    staleTime: 1000 * 30,
    retry: 1,
    ...options,
  });
}
