import { useQuery } from "@tanstack/react-query";

/**
 * useFetch — thin wrapper for TanStack Query's useQuery.
 *
 * @param {unknown[]} queryKey   - Cache key (use QUERY_KEYS constants)
 * @param {() => Promise<unknown>} fetcher - Async function that calls the API
 * @param {import("@tanstack/react-query").UseQueryOptions} [options] - Extra TanStack options
 *
 * @example
 * const { data: issues, isLoading, error } = useFetch(
 *   QUERY_KEYS.ISSUES(projectId, { status: "open" }),
 *   () => issuesApi.listIssues(projectId, { status: "open" }),
 * );
 */
export function useFetch(queryKey, fetcher, options = {}) {
  return useQuery({
    queryKey,
    queryFn: fetcher,
    staleTime: 1000 * 30, // 30 seconds
    retry: 1,
    ...options,
  });
}
