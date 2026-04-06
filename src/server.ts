// server.ts
// ─────────────────────────────────────────────────────────────────────────────
// Express API server for the Solana block indexer.
// Reads data from SQLite via db.ts — never touches the blockchain directly.
// Payment-gated routes use x402-express middleware.
// ─────────────────────────────────────────────────────────────────────────────

import express, { Request, Response, NextFunction } from "express";
import { paymentMiddleware, Network } from "x402-express";

import { config } from "./config";
import {
    getBlock,
    getTransactionsByWallet,
    getTransactionBySignature,
    getRecentBlocks,
} from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// Shape of query params we receive as raw strings from Express.
// We parse and validate them ourselves — never trust raw input.
interface PaginationQuery {
    limit?: string;
    offset?: string;
}

interface TransactionsQuery extends PaginationQuery {
    account?: string;
}

// What we send back on every error so the client always gets a consistent shape.
interface ErrorResponse {
    error: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100; // prevent someone requesting 1 000 000 rows at once
const MAX_OFFSET = 10_000;

/**
 * Parses a raw query-string value into a safe integer.
 * Falls back to `defaultVal` if the value is missing or not a valid number.
 * Clamps the result between `min` and `max`.
 */
function parsePagination(
    raw: string | undefined,
    defaultVal: number,
    min: number,
    max: number
): number {
    if (raw === undefined || raw.trim() === "") return defaultVal;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return defaultVal;
    return Math.min(Math.max(n, min), max);
}

/**
 * Very basic Solana public-key validator.
 * A Solana base58 address is 32–44 characters long and contains only
 * base58 characters (no 0, O, I, l).
 * This is a lightweight sanity check — not a cryptographic one.
 */
function isValidSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Wraps an async route handler so any thrown error is forwarded to
 * Express's error-handling middleware instead of crashing the process.
 * Without this you'd need try/catch in every single route.
 */
function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
    return (req: Request, res: Response, next: NextFunction): void => {
        fn(req, res, next).catch(next);
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// App setup
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// Parse JSON request bodies (needed if you ever add POST routes later).
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// x402 payment middleware
// ─────────────────────────────────────────────────────────────────────────────
// Only the routes listed in the second argument require payment.
// /health is intentionally excluded so monitoring tools always work.
//
// Assumption: config.walletAddress is a valid Solana base58 public key.
// Assumption: config.network is "mainnet" | "testnet" | "devnet" — passed
//             directly to x402 as the Network type.
// ─────────────────────────────────────────────────────────────────────────────

app.use(
    paymentMiddleware(
        // ⚠️ TEMP HACK:
        // x402 expects Ethereum (0x...) but we're using Solana address.
        // This cast bypasses TS but is NOT fully safe.
        // Replace with Solana-native payment solution later.

        config.walletAddress as unknown as `0x${string}`,                // who receives the payment
        {
            // Each key is a route pattern; value is the payment config for that route.
            "GET /blocks": {
                price: "$0.001",                  // adjust to your desired price
                network: config.network as Network,
                config: {
                    description: "Paginated list of indexed Solana blocks",
                },
            },
            "GET /transactions": {
                price: "$0.001",
                network: config.network as Network,
                config: {
                    description: "Paginated list of indexed Solana transactions",
                },
            },
            "GET /transactions/:signature": {
                price: "$0.001",
                network: config.network as Network,
                config: {
                    description: "Single Solana transaction by signature",
                },
            },
        },
        // {
        //  facilitatorUrl: config.facilitatorUrl, // x402 payment processor URL
        // }
    )
);

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /health ─────────────────────────────────────────────────────────────
// Free route — no payment required.
// Use this for uptime monitors, load balancers, Docker health checks, etc.
app.get("/health", (_req: Request, res: Response): void => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── GET /blocks?limit=20&offset=0 ────────────────────────────────────────────
// Returns a paginated list of indexed blocks from the database.
// Payment required (gated by x402 middleware above).
app.get(
    "/blocks",
    asyncHandler(async (req: Request<object, object, object, PaginationQuery>, res: Response): Promise<void> => {
        const limit = parsePagination(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
        const offset = parsePagination(req.query.offset, 0, 0, MAX_OFFSET);

        const blocks = await getRecentBlocks(limit, offset);

        // Edge case: table exists but no blocks have been indexed yet.
        if (!blocks || blocks.length === 0) {
            res.status(404).json({ error: "No blocks found. The indexer may still be warming up." });
            return;
        }

        res.json({
            data: blocks,
            limit,
            offset,
            count: blocks.length,
        });
    })
);

// ── GET /transactions?limit=20&offset=0&account=<solana_pubkey> ──────────────
// Returns a paginated list of transactions.
// Optional `account` param filters by a specific Solana wallet address.
// Payment required.
app.get(
    "/transactions",
    asyncHandler(async (req: Request<object, object, object, TransactionsQuery>, res: Response): Promise<void> => {
        const limit = parsePagination(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
        const offset = parsePagination(req.query.offset, 0, 0, Infinity);
        const account = req.query.account?.trim();

        // Edge case: account provided but looks wrong (not a valid Solana pubkey).
        if (account !== undefined && !isValidSolanaAddress(account)) {
            res.status(400).json({
                error:
                    "Invalid account address. Solana public keys are base58-encoded and 32–44 characters long.",
            } satisfies ErrorResponse);
            return;
        }

        if (!account) {
            res.status(400).json({ error: "Account is required" });
            return;
        }

        const transactions = await getTransactionsByWallet(account, limit, offset);
        // Edge case: valid request but no matching rows.
        if (!transactions || transactions.length === 0) {
            res.status(404).json({
                error: account
                    ? `No transactions found for account ${account}.`
                    : "No transactions found yet.",
            } satisfies ErrorResponse);
            return;
        }

        res.json({
            data: transactions,
            limit,
            offset,
            count: transactions.length,
            account: account ?? null,
        });
    })
);

// ── GET /transactions/:signature ─────────────────────────────────────────────
// Returns a single transaction looked up by its Solana transaction signature.
// A Solana signature is a base58-encoded 64-byte value (~88 chars).
// Payment required.
app.get(
    "/transactions/:signature",
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const signature = req.params.signature as string;

        // Edge case: someone hits /transactions/ with an empty or very short string.
        // Solana signatures are always ≥ 80 characters long.
        if (!/^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(signature)) {
            res.status(400).json({
                error:
                    "Invalid signature format. Solana transaction signatures are base58-encoded and ~88 characters long.",
            } satisfies ErrorResponse);
            return;
        }

        const tx = await getTransactionBySignature(signature);

        // Edge case: signature is well-formed but not in our database.
        // Either it's from before the indexer started, or it doesn't exist.
        if (!tx) {
            res.status(404).json({
                error: `Transaction with signature "${signature}" not found in the index.`,
            } satisfies ErrorResponse);
            return;
        }

        res.json({ data: tx });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// 404 handler — catches any route we didn't define above
// ─────────────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response): void => {
    res.status(404).json({ error: "Route not found." } satisfies ErrorResponse);
});

// ─────────────────────────────────────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────────────────────────────────────
// Express calls this whenever next(err) is invoked (via asyncHandler).
// Keeps stack traces out of API responses in production.
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error("[server] Unhandled error:", err);

    res.status(500).json({
        error:
            process.env.NODE_ENV === "production"
                ? "Internal server error."          // never leak stack traces to clients
                : err.message,                      // show details in dev
    } satisfies ErrorResponse);
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
    console.log(`[server] Listening on port ${config.port}`);
});

process.on("SIGINT", () => {
    console.log("[server] Shutting down (SIGINT)...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("[server] Shutting down (SIGTERM)...");
    process.exit(0);
});

export default app;