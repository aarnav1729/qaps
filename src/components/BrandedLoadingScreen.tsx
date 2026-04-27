import React from "react";
import { cn } from "@/lib/utils";

interface BrandedLoadingScreenProps {
  message?: string;
  subtitle?: string;
  fullscreen?: boolean;
  className?: string;
}

const BrandedLoadingScreen: React.FC<BrandedLoadingScreenProps> = ({
  message = "Loading your workspace",
  subtitle = "Please wait while we prepare the latest information.",
  fullscreen = false,
  className,
}) => {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden",
        fullscreen
          ? "flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.14),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-10"
          : "flex min-h-[220px] items-center justify-center rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-10",
        className
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60" />
      </div>

      <div className="relative flex max-w-md flex-col items-center text-center">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="absolute inset-2 rounded-full border border-sky-100" />
          <img
            src="/l.png"
            alt="Premier Energies logo"
            className="relative h-16 w-16 object-contain drop-shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
            style={{ animation: "spin 10s linear infinite" }}
          />
        </div>

        <div className="mt-6 text-lg font-semibold tracking-tight text-slate-950">
          {message}
        </div>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
          {subtitle}
        </p>

        <div className="mt-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          <span>Preparing interface</span>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        </div>
      </div>
    </div>
  );
};

export default BrandedLoadingScreen;
