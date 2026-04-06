/**
 * client.ts — demo script
 *
 * Simulates what any AI agent or developer would do:
 *  1. Hit a gated endpoint with no payment → get 402 back
 *  2. x402/fetch auto-pays using the Solana wallet
 *  3. Retry → get real data back
 *
 * Run with:  npm run client
 */

import { wrapFetchWithPayment } from "@x402/fetch";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { createClient, Network } from "x402-express";

dotenv.config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = `http://localhost:${process.env.PORT ?? 3000}`;

// ---------------------------------------------------------------------------
// Wallet loading
// ---------------------------------------------------------------------------
// Looks for a keypair JSON file at CLIENT_KEYPAIR_PATH (default: ./client-wallet.json).
// If it doesn't exist, generates a fresh one and saves it so you can fund it
// once and reuse it across runs.
//
// To fund on devnet:
//   solana airdrop 1 <your-pubkey> --url devnet
// Then get test USDC from: https://faucet.circle.com

function loadOrCreateWallet(): Keypair {
    const walletPath = path.resolve(
        process.env.CLIENT_KEYPAIR_PATH ?? "./client-wallet.json"
    );

    if (fs.existsSync(walletPath)) {
        const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8")) as number[];
        console.log(`[client] Loaded wallet from ${walletPath}`);
        return Keypair.fromSecretKey(Uint8Array.from(raw));
    }

    const keypair = Keypair.generate();
    fs.writeFileSync(walletPath, JSON.stringify(Array.from(keypair.secretKey)));
    console.log(`[client] Generated new wallet → ${walletPath}`);
    console.log(`[client] Fund it on devnet: solana airdrop 1 ${keypair.publicKey.toString()} --url devnet`);
    return keypair;
}

const wallet = loadOrCreateWallet();

const client = createClient({
    walletAddress: wallet,
    network: (process.env.NETWORK ?? "devnet") as Network,
});

// ---------------------------------------------------------------------------
// Pretty printer
// ---------------------------------------------------------------------------

function printResult(label: string, data: unknown): void {
    console.log(`\n── ${label} ${"─".repeat(50 - label.length)}`);
    console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Demo calls
// ---------------------------------------------------------------------------

async function runDemo(fetch: typeof globalThis.fetch): Promise<void> {

    // 1. Health — no payment needed, always works
    const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    printResult("GET /health", health);

    // 2. Recent blocks — x402 gated
    // The wrapped fetch will:
    //   a. Make the request
    //   b. Receive 402 with payment instructions
    //   c. Sign + send USDC on Solana
    //   d. Retry with X-PAYMENT header
    //   e. Return the successful response transparently
    const blocks = await fetch(`${BASE_URL}/blocks?limit=5`).then((r) => r.json());
    printResult("GET /blocks?limit=5", blocks);

    // 3. Transactions — x402 gated
    const txns = await fetch(`${BASE_URL}/transactions?limit=5`).then((r) => r.json());
    printResult("GET /transactions?limit=5", txns);

    // 4. Single transaction by signature — x402 gated
    // Only runs if step 3 returned at least one transaction
    if (txns?.data?.[0]?.signature) {
        const sig = txns.data[0].signature as string;
        const tx = await fetch(`${BASE_URL}/transactions/${sig}`).then((r) => r.json());
        printResult(`GET /transactions/${sig.slice(0, 20)}...`, tx);
    }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    console.log(`[client] Targeting server at ${BASE_URL}\n`);

    const wallet = loadOrCreateWallet();
    console.log(`[client] Wallet public key: ${wallet.publicKey.toString()}`);

    // wrapFetchWithPayment intercepts 402 responses, pays, and retries.
    // The third arg is the network — must match what the server expects.
    const payingFetch = wrapFetchWithPayment(globalThis.fetch, client);

    try {
        await runDemo(payingFetch as typeof globalThis.fetch);
        console.log("\n[client] Demo complete.");
    } catch (err: unknown) {
        // Surface payment failures clearly — most common issue is insufficient USDC
        const msg = String(err);
        if (msg.includes("insufficient") || msg.includes("balance")) {
            console.error(
                "\n[client] Payment failed — your wallet likely has no test USDC.\n" +
                `Fund it: solana airdrop 1 ${wallet.publicKey.toString()} --url devnet\n` +
                "Then get test USDC from: https://faucet.circle.com"
            );
        } else {
            console.error("\n[client] Unexpected error:", err);
        }
        process.exit(1);
    }
}

main();