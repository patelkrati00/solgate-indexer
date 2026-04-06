import dotenv from "dotenv";
import { Network } from "x402-express";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  dbPath: process.env.DB_PATH ?? "./indexer.db",
  port: Number(process.env.PORT ?? 3001),

  walletAddress: required("RECEIVER_WALLET"),

  pricePerRequest: Number(process.env.PRICE_PER_REQUEST ?? 0.001),
  facilitatorUrl: process.env.FACILITATOR_URL ?? "https://x402.org/facilitator",

  network: (process.env.NETWORK ?? "devnet") as Network,
} as const;

export type Config = typeof config;