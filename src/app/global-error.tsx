"use client";

/**
 * Root error boundary. Replaces the whole document when the root layout itself
 * throws, so it must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#1e293b" }}>
        <main
          style={{
            maxWidth: "36rem",
            margin: "0 auto",
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "0 1.5rem",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#e11d48" }}>
            Application error
          </span>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Cogwheel hit an unexpected error</h1>
          <p style={{ fontSize: "0.875rem", color: "#475569" }}>
            The application failed to start this view. Please retry.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: "0.75rem",
              background: "#a3d11b",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "#0f172a",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Reference: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
