import Database from "better-sqlite3";
import { config } from "./config";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

// better-sqlite3 is synchronous — one connection, used everywhere.
// No connection pooling needed for SQLite.
const db = new Database(config.dbPath);

// WAL mode = faster writes without blocking reads.
// This is the first thing you set on any SQLite database.
db.pragma("journal_mode = WAL");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Transaction {
  signature:   string;
  slot:        number;
  block_time:  number | null;  // unix timestamp, null if not confirmed
  fee:         number;         // lamports (1 SOL = 1_000_000_000 lamports)
  status:      "success" | "failed";
  accounts:    string;         // JSON array of account public keys involved
}

export interface Block {
  slot:        number;
  block_time:  number | null;
  tx_count:    number;
  indexed_at:  number;         // unix timestamp — when WE indexed it
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      signature   TEXT PRIMARY KEY,
      slot        INTEGER NOT NULL,
      block_time  INTEGER,
      fee         INTEGER NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'success',
      accounts    TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS blocks (
      slot        INTEGER PRIMARY KEY,
      block_time  INTEGER,
      tx_count    INTEGER NOT NULL DEFAULT 0,
      indexed_at  INTEGER NOT NULL
    );

    -- Speed up the most common query: "give me all txns for wallet X"
    -- Without this index, SQLite would scan every row. With it, instant.
    CREATE INDEX IF NOT EXISTS idx_transactions_accounts ON transactions(accounts);

    CREATE INDEX IF NOT EXISTS idx_transactions_slot ON transactions(slot);
  `);

  console.log("[db] Schema ready");
}

// ---------------------------------------------------------------------------
// Write queries
// ---------------------------------------------------------------------------

// prepare() compiles the SQL once and reuses it — much faster than exec()
// inside a loop when indexing thousands of transactions.
const insertTxStmt = db.prepare<Transaction>(`
  INSERT OR IGNORE INTO transactions
    (signature, slot, block_time, fee, status, accounts)
  VALUES
    (@signature, @slot, @block_time, @fee, @status, @accounts)
`);

const insertBlockStmt = db.prepare<Block>(`
  INSERT OR REPLACE INTO blocks
    (slot, block_time, tx_count, indexed_at)
  VALUES
    (@slot, @block_time, @tx_count, @indexed_at)
`);

// db.transaction() wraps multiple inserts in a single SQLite transaction.
// This is 10-100x faster than inserting one row at a time because
// SQLite only flushes to disk once per transaction, not once per insert.
export const insertTransactions = db.transaction((txns: Transaction[]) => {
  for (const tx of txns) insertTxStmt.run(tx);
});

export function insertBlock(block: Block): void {
  insertBlockStmt.run(block);
}

// ---------------------------------------------------------------------------
// Read queries
// ---------------------------------------------------------------------------

export function getTransactionsByWallet(wallet: string, limit = 50): Transaction[] {
  // accounts is stored as a JSON array string e.g. '["ABC","DEF"]'
  // We use LIKE to search for the wallet address inside that string.
  // Good enough for a hackathon; production would use a separate accounts table.
  return db
    .prepare<{ wallet: string; limit: number }>(
      `SELECT * FROM transactions
       WHERE accounts LIKE '%' || @wallet || '%'
       ORDER BY slot DESC
       LIMIT @limit`
    )
    .all({ wallet, limit }) as Transaction[];
}

export function getTransactionBySignature(signature: string): Transaction | undefined {
  return db
    .prepare<{ signature: string }>(
      `SELECT * FROM transactions WHERE signature = @signature`
    )
    .get({ signature }) as Transaction | undefined;
}

export function getBlock(slot: number): Block | undefined {
  return db
    .prepare<{ slot: number }>(`SELECT * FROM blocks WHERE slot = @slot`)
    .get({ slot }) as Block | undefined;
}

export function getRecentBlocks(limit = 20): Block[] {
  return db
    .prepare<{ limit: number }>(
      `SELECT * FROM blocks ORDER BY slot DESC LIMIT @limit`
    )
    .all({ limit }) as Block[];
}

// ---------------------------------------------------------------------------
// Stats — used by the /stats endpoint to show the indexer is alive
// ---------------------------------------------------------------------------

export function getStats(): { total_transactions: number; total_blocks: number; latest_slot: number | null } {
  const txCount  = (db.prepare(`SELECT COUNT(*) as c FROM transactions`).get() as { c: number }).c;
  const blkCount = (db.prepare(`SELECT COUNT(*) as c FROM blocks`).get() as { c: number }).c;
  const latestSlot = (
    db.prepare(`SELECT MAX(slot) as s FROM blocks`).get() as { s: number | null }
  ).s;

  return {
    total_transactions: txCount,
    total_blocks:       blkCount,
    latest_slot:        latestSlot,
  };
}