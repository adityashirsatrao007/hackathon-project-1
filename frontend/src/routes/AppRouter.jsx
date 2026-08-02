/**
 * AppRouter — route-level code splitting with React.lazy
 *
 * Every page component is loaded on-demand. The initial JS bundle only contains
 * React, React-router, and the auth pages. All other pages load in parallel with
 * the first API call, so the user sees content faster.
 */
import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";
import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";

// Landing page
import Landing from "@/pages/Landing";

// ── Auth pages (always needed at startup — not lazy) ─────────────────────────
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
// ── App pages — lazy loaded ───────────────────────────────────────────────────
const Dashboard     = lazy(() => import("@/pages/dashboard/Dashboard"));
const Projects      = lazy(() => import("@/pages/projects/Projects"));
const ProjectDetails = lazy(() => import("@/pages/projects/ProjectDetails"));
const ErrorsList    = lazy(() => import("@/pages/errors/ErrorsList"));
const ErrorDetails  = lazy(() => import("@/pages/errors/ErrorDetails"));
const Settings      = lazy(() => import("@/pages/settings/Settings"));
const DocsPage      = lazy(() => import("@/pages/docs/DocsPage"));
const DocsIndex     = lazy(() => import("@/pages/docs/DocsIndex"));

// ── Lightweight page skeleton shown while any lazy page loads ─────────────────
function PageSkeleton() {
  return (
    <div className="animate-fade-in space-y-5 p-1">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="skeleton h-3 w-32 rounded-md" />
        <div className="skeleton h-6 w-64 rounded-md" />
        <div className="skeleton h-3 w-48 rounded-md" />
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="skeleton rounded-xl h-[88px]" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="skeleton rounded-xl h-48" />
      <div className="skeleton rounded-xl h-32" />
    </div>
  );
}

const router = createBrowserRouter([
  // ── Landing page — public, redirect to dashboard if already logged in ──────
  { path: "/", element: <PublicOnlyRoute><Landing /></PublicOnlyRoute> },

  // ── Public auth routes ────────────────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      { path: "/login",  element: <Login /> },
      { path: "/signup", element: <Signup /> },
    ],
  },


  // ── Protected app routes ──────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          // Root redirect
          { path: "/", element: <Navigate to="/dashboard" replace /> },

          // Dashboard
          { path: "/dashboard", element: <Dashboard /> },

          // Projects — scoped under org
          { path: "/orgs/:orgId/projects", element: <Projects /> },
          { path: "/orgs/:orgId/projects/:projectId", element: <ProjectDetails /> },

          // Issues — scoped under project
          {
            path: "/orgs/:orgId/projects/:projectId/issues",
            element: <Suspense fallback={<PageSkeleton />}><ErrorsList /></Suspense>,
          },
          {
            path: "/orgs/:orgId/projects/:projectId/issues/:issueId",
            element: <Suspense fallback={<PageSkeleton />}><ErrorDetails /></Suspense>,
          },
          {
            path: "/orgs/:orgId/projects/:projectId/docs",
            element: <Suspense fallback={<PageSkeleton />}><DocsPage /></Suspense>,
          },
          {
            path: "/docs",
            element: <Suspense fallback={<PageSkeleton />}><DocsIndex /></Suspense>,
          },
          {
            path: "/settings",
            element: <Suspense fallback={<PageSkeleton />}><Settings /></Suspense>,
          },
        ],
      },
    ],
  },

  // Catch-all
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
