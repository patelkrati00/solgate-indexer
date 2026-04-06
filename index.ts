import { initDb } from "./src/db.js";
import { startIndexer } from "./src/indexer.js";
import "./src/server.js"; // importing starts the Express server as a side-effect

// ---------------------------------------------------------------------------
// Boot sequence — order matters:
//   1. DB first  — server and indexer both depend on it
//   2. Server    — imported above, starts listening immediately
//   3. Indexer   — long-running async loop, must not block the server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[boot] Initialising database...");
  initDb();

  console.log("[boot] Server is up. Starting indexer...");

  // startIndexer() runs forever (while-true loop).
  // We intentionally do NOT await it here — that would block the process
  // and prevent graceful shutdown handlers from registering.
  // Instead we attach a catch so unhandled indexer crashes surface clearly.
  startIndexer().catch((err) => {
    console.error("[boot] Indexer crashed with a fatal error:", err);
    process.exit(1); // non-zero exit so Docker / PM2 knows to restart
  });

  console.log("[boot] All systems running.");
}

main().catch((err) => {
  console.error("[boot] Startup failed:", err);
  process.exit(1);
});