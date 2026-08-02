import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Loader from "@/components/common/Loader";

/**
 * ProtectedRoute — wraps any route that requires authentication.
 * - While auth is loading: shows a full-page spinner.
 * - If not authenticated: redirects to /login (preserving the intended URL).
 * - If authenticated: renders the nested route via <Outlet />.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loader fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
