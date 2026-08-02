import { cn } from "@/utils/helpers";

/**
 * Loader component.
 * - `fullPage`: centers in viewport
 * - `size`: sm | md | lg
 */
export default function Loader({ fullPage = false, size = "md", className }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };

  const spinner = (
    <div
      className={cn(
        "rounded-full border-violet-500/30 border-t-violet-500 animate-spin",
        sizes[size],
        className,
      )}
      role="status"
      aria-label="Loading..."
    />
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[hsl(224_71.4%_4.1%)] z-50">
        <div className="flex flex-col items-center gap-4">
          {spinner}
          <p className="text-sm text-slate-400 animate-pulse">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {spinner}
    </div>
  );
}

/** Inline loader for buttons / small UI areas */
export function InlineLoader({ className }) {
  return (
    <div
      className={cn(
        "h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin",
        className,
      )}
      role="status"
      aria-label="Loading..."
    />
  );
}
