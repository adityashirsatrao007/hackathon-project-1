import { cn } from "@/utils/helpers";
import { AlertCircle, Inbox, Search } from "lucide-react";

const ICONS = {
  empty: Inbox,
  search: Search,
  error: AlertCircle,
};

/**
 * EmptyState — shown when a list has no items.
 *
 * @param {"empty"|"search"|"error"} [variant]
 * @param {string} title
 * @param {string} [description]
 * @param {React.ReactNode} [action]  - Optional CTA button
 */
export default function EmptyState({
  variant = "empty",
  title,
  description,
  action,
  className,
}) {
  const Icon = ICONS[variant] ?? Inbox;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/60 text-slate-500">
        <Icon className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-200">{title}</h3>
        {description && (
          <p className="text-sm text-slate-400 max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
