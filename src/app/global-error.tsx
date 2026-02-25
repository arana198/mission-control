"use client";

/**
 * Global Error Fallback
 * Uses inline styles because CSS may not be loaded during critical errors.
 * This is intentional and should not be refactored to use CSS tokens.
 * Colors are manually selected for error state visibility.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", backgroundColor: "#fff", padding: "16px" }}>
        <div style={{ padding: "32px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", maxWidth: "448px", width: "100%" }}>
          <h2 style={{ color: "#7f1d1d", marginBottom: "8px" }}>Application Error</h2>
          <p style={{ color: "#991b1b", fontSize: "14px", marginBottom: "16px" }}>{error.message || "A critical error occurred. Please refresh."}</p>
          <button onClick={reset} style={{ padding: "8px 12px", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
