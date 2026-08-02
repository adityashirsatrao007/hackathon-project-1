import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Loader from "@/components/common/Loader";

/**
 * PublicOnlyRoute — shows the landing page for guests.
 * Authenticated users are immediately sent to /dashboard.
 */
export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Loader fullPage />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return children;
}
