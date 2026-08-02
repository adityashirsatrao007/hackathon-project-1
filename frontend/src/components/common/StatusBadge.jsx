import { cn } from "@/utils/helpers";

const STATUS_MAP = {
  open: { label: "Open", class: "bg-red-500/15 text-red-400 border-red-500/30" },
  resolved: { label: "Resolved", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  ignored: { label: "Ignored", class: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const LEVEL_MAP = {
  error: { label: "Error", class: "bg-red-500/15 text-red-400 border-red-500/30" },
  warning: { label: "Warning", class: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  info: { label: "Info", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

/**
 * StatusBadge — displays issue status or level as a colored pill.
 *
 * @param {"open"|"resolved"|"ignored"} [status]
 * @param {"error"|"warning"|"info"} [level]
 */
export default function StatusBadge({ status, level, className }) {
  const map = status ? STATUS_MAP[status] : level ? LEVEL_MAP[level] : null;

  if (!map) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        map.class,
        className,
      )}
    >
      {map.label}
    </span>
  );
}
