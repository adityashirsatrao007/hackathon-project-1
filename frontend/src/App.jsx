import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import AppRouter from "@/routes/AppRouter";
import ErrorBoundary from "@/components/common/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 min — data is "fresh" and won't re-fetch on navigation
      gcTime: 1000 * 60 * 15,          // 15 min — keep in memory even when component unmounts
      retry: 1,
      refetchOnWindowFocus: false,
      // ── Keep previous data while new data loads ─────────────────────────────
      // This is the key to zero-flicker navigation: navigating to a page you've
      // visited before instantly shows stale data while re-validating in background.
      placeholderData: (prev) => prev,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
