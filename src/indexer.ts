import {
    Connection,
    PublicKey,
    ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { config } from "./config.js";
import { insertBlock, insertTransactions, Transaction } from "./db.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;  // poll every 2s — Solana produces ~1 block/400ms
// but devnet is slower, no need to hammer the RPC
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const MAX_TXS_PER_BLOCK = 100;   // cap so one huge block doesn't stall the indexer

// ---------------------------------------------------------------------------
// Logger — prefixes every log with [indexer] so it's easy to grep
// ---------------------------------------------------------------------------

const log = {
    info: (msg: string) => console.log(`[indexer] ${msg}`),
    warn: (msg: string) => console.warn(`[indexer] WARN  ${msg}`),
    error: (msg: string, err?: unknown) => console.error(`[indexer] ERROR ${msg}`, err ?? ""),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Exponential backoff — waits longer each retry so we don't spam the RPC
// when it's rate-limiting or temporarily down.
// e.g. attempt 0 = 3s, attempt 1 = 6s, attempt 2 = 12s ...
async function sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
}

function backoffDelay(attempt: number): number {
    return RETRY_DELAY_MS * Math.pow(2, attempt);
}

// Solana transaction accounts can be either a string pubkey or a structured
// object depending on whether the tx is "parsed" or "jsonParsed". This
// normalises both into a plain string array so db.ts never has to care.
function extractAccounts(tx: any): string[] {
    try {
        const keys = tx.message.accountKeys;

        return keys.map((k: any) =>
            typeof k === "string"
                ? k
                : k.pubkey.toString()
        );
    } catch {
        return [];
    }
}

// Slot tracking — persisted in memory only. On restart we resume from the
// latest confirmed slot on chain. Good enough for a hackathon; production
// would persist lastSlot in the DB.
let lastIndexedSlot: number | null = null;

// ---------------------------------------------------------------------------
// Core: fetch + parse one block
// ---------------------------------------------------------------------------

async function indexBlock(connection: Connection, slot: number): Promise<void> {
    // Edge case 1: Solana has "skipped slots" — the leader didn't produce a block.
    // getBlock() returns null for these. We skip them silently.
    const block = await connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: "full",
        rewards: false,           // we don't care about validator rewards
    });

    if (!block) {
        log.warn(`Slot ${slot} was skipped on-chain (no block produced)`);
        return;
    }

    // Edge case 2: block exists but has no transactions (empty block).
    // Still store it in blocks table so our slot history is complete.
    const rawTxs = block.transactions ?? [];

    const transactions: Transaction[] = rawTxs
        .slice(0, MAX_TXS_PER_BLOCK)  // Edge case 3: cap huge blocks
        .flatMap((entry): Transaction[] => {
            // Edge case 4: transaction itself might be null (RPC can return sparse data)
            if (!entry?.transaction) return [];

            const tx = entry.transaction;
            const meta = entry.meta;

            // Edge case 5: missing meta means we can't determine fee or status.
            // Skip rather than store garbage data.
            if (!meta) return [];

            const signature: string =
                Array.isArray(tx.signatures) ? tx.signatures[0] : "";

            if (!signature) return [];  // Edge case 6: no signature = unusable row

            return [
                {
                    signature,
                    slot,
                    block_time: block.blockTime ?? null,
                    fee: meta.fee ?? 0,
                    status: meta.err ? "failed" : "success",
                    accounts: JSON.stringify(extractAccounts(tx)),
                },
            ];
        });

    // Batch-write everything for this block in one SQLite transaction
    insertTransactions(transactions);
    insertBlock({
        slot,
        block_time: block.blockTime ?? null,
        tx_count: rawTxs.length,
        indexed_at: Math.floor(Date.now() / 1000),
    });

    log.info(
        `Slot ${slot} → ${transactions.length} txns indexed` +
        (rawTxs.length > MAX_TXS_PER_BLOCK
            ? ` (capped from ${rawTxs.length})`
            : "")
    );
}

// ---------------------------------------------------------------------------
// Core: retry wrapper around indexBlock
// ---------------------------------------------------------------------------

async function indexBlockWithRetry(
    connection: Connection,
    slot: number
): Promise<void> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            await indexBlock(connection, slot);
            return; // success — exit retry loop
        } catch (err: unknown) {
            const isLast = attempt === MAX_RETRIES - 1;

            // Edge case 7: 429 rate-limit from devnet RPC.
            // We detect it and wait longer before retrying.
            const errMsg = String(err);
            const isRateLimit = errMsg.includes("429") || errMsg.includes("rate limit");

            if (isLast) {
                log.error(`Slot ${slot} failed after ${MAX_RETRIES} attempts — skipping`, err);
                return;
            }

            const delay = isRateLimit
                ? backoffDelay(attempt) * 2   // double the wait on rate limits
                : backoffDelay(attempt);

            log.warn(
                `Slot ${slot} attempt ${attempt + 1} failed${isRateLimit ? " (rate limited)" : ""}. ` +
                `Retrying in ${delay / 1000}s...`
            );
            await sleep(delay);
        }
    }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function runIndexer(connection: Connection): Promise<void> {
    // Edge case 8: get the current confirmed slot to start from.
    // "confirmed" commitment = finalized enough for our purposes without
    // waiting for full finalization (which adds latency).
    const startSlot = await connection.getSlot("confirmed");
    lastIndexedSlot = startSlot;
    log.info(`Starting from slot ${startSlot}`);

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const currentSlot = await connection.getSlot("confirmed");

            // Edge case 9: RPC returned a slot behind what we last indexed.
            // Can happen during RPC node restarts or brief forks. Skip the poll.
            if (currentSlot <= lastIndexedSlot!) {
                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            // Edge case 10: we somehow fell behind by many slots (e.g. the process
            // was paused or the RPC was down). Cap catch-up to last 10 slots
            // so we don't get stuck in a massive backfill on startup.
            const slotsToIndex = Math.min(currentSlot - lastIndexedSlot!, 10);
            const fromSlot = currentSlot - slotsToIndex + 1;

            for (let slot = fromSlot; slot <= currentSlot; slot++) {
                await indexBlockWithRetry(connection, slot);
            }

            lastIndexedSlot = currentSlot;
        } catch (err) {
            // Edge case 11: error getting current slot itself (RPC is completely down).
            // Don't crash — just wait and try again.
            log.error("Failed to fetch current slot", err);
        }

        await sleep(POLL_INTERVAL_MS);
    }
}

// ---------------------------------------------------------------------------
// Entry point — called from index.ts
// ---------------------------------------------------------------------------

export async function startIndexer(): Promise<void> {
    log.info(`Connecting to ${config.rpcUrl}`);

    const connection = new Connection(config.rpcUrl, {
        commitment: "confirmed",
        // Edge case 12: set a fetch timeout so a hung RPC call doesn't block
        // the whole indexer loop forever. 10s is generous but safe.
        fetchMiddleware: async (url, options, fetchFn) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);

            try {
                return await fetchFn(url, { ...options, signal: controller.signal });
            } finally {
                clearTimeout(timeout);
            }
        },
    });

    // Edge case 13: verify the RPC is reachable before starting the loop.
    // A clear startup error is better than cryptic failures 30 seconds in.
    try {
        const version = await connection.getVersion();
        log.info(`RPC connected — Solana version ${version["solana-core"]}`);
    } catch (err) {
        throw new Error(
            `Cannot reach Solana RPC at ${config.rpcUrl}. Check your .env.\n${err}`
        );
    }

    await runIndexer(connection);
}