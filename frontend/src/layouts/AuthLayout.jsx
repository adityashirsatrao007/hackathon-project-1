import { Outlet, Navigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * AuthLayout — wraps login and signup pages.
 * - Dark glassmorphism card centered on a gradient background.
 * - Redirects to dashboard if already authenticated.
 */
export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(224_71.4%_4.1%)] relative overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute top-[-200px] left-[-200px] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-200px] h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-600/30">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Tracelify</h1>
            <p className="text-sm text-slate-400 mt-0.5">Production error tracking</p>
          </div>
        </div>

        {/* Page content (Login / Signup form) */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-xl shadow-2xl p-8 animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
