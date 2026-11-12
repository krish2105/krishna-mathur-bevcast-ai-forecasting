"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f9fc", color: "#172b4d", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }} role="alert">
          <h1 style={{ fontSize: 20 }}>BEVCAST AI hit an unexpected error</h1>
          <p style={{ color: "#667085", fontSize: 14 }}>Please reload the page. If it keeps happening, the reference results remain available in the notebook.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: 0, background: "#087e8b", color: "#fff", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
