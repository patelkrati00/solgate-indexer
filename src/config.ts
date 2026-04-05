import dotenv from "dotenv";
dotenv.config();

// Hard-fail at startup if a required env var is missing.
// Better to crash early than to silently use undefined values.
function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  rpcUrl:           process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  dbPath:           process.env.DB_PATH        ?? "./indexer.db",
  port:             Number(process.env.PORT    ?? 3000),
  receiverWallet:   required("RECEIVER_WALLET"),
  pricePerRequest:  process.env.PRICE_PER_REQUEST  ?? "0.001",
  facilitatorUrl:   process.env.FACILITATOR_URL    ?? "https://x402.org/facilitator",
} as const;

export type Config = typeof config;