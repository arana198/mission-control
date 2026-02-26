"use client";

/**
 * BrandMark Component
 * Displays the OC logo + "OPENCLAW / Mission Control" branding
 * Used in the sticky top header
 */
export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      {/* OC Logo square */}
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-semibold text-white shadow-sm">
        <span className="tracking-[0.15em]">OC</span>
      </div>

      {/* Text block */}
      <div className="leading-tight">
        <div className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
          OPENCLAW
        </div>
        <div className="text-[11px] font-medium text-muted-foreground">
          Mission Control
        </div>
      </div>
    </div>
  );
}
