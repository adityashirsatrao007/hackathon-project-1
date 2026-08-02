import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/helpers";

/**
 * PageHeader — consistent top-of-page header with optional breadcrumb and actions.
 *
 * @param {string} title
 * @param {string} [description]
 * @param {{ label: string, to?: string }[]} [breadcrumbs]
 * @param {React.ReactNode} [actions]   - Right-aligned action buttons
 */
export default function PageHeader({ title, description, breadcrumbs = [], actions, className }) {
  return (
    <div className={cn("space-y-2 pb-6", className)}>
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-slate-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-slate-300 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-400">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">{title}</h1>
          {description && (
            <p className="text-sm text-slate-400">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
