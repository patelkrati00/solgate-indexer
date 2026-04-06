"use client";

import { useState } from "react";
import { fetchTransactions } from "@/lib/api";

interface Transaction {
  signature: string;
  slot: number;
  block_time: number | null;
  fee: number;
  status: "success" | "failed";
  accounts: string;
}

const fmt = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleTimeString() : "—";

const truncate = (str: string, n = 20) =>
  str.length > n ? str.slice(0, n) + "..." : str;

export default function TransactionsPage() {
  const [account, setAccount] = useState("");
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!account.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await fetchTransactions(account.trim());
      if (data.error) {
        setError(data.error);
        setTxns([]);
      } else {
        setTxns(data.data ?? []);
      }
    } catch {
      setError("Failed to fetch transactions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "24px" }}>

      <p style={{ fontSize: "11px", fontFamily: "monospace", color: "#a1a1aa", letterSpacing: "1px", marginBottom: "16px" }}>
        TRANSACTIONS
      </p>

      {/* Search */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        <input
          type="text"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Enter Solana wallet address..."
          style={{
            flex: 1,
            padding: "8px 12px",
            backgroundColor: "#111",
            border: "1px solid #222",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <button onClick={search} style={{
          padding: "8px 20px",
          backgroundColor: "#fff",
          color: "#000",
          border: "none",
          fontFamily: "monospace",
          fontSize: "13px",
          cursor: "pointer",
        }}>
          Search
        </button>
      </div>

      {/* States */}
      {loading && <p style={{ color: "#a1a1aa", fontSize: "13px" }}>Loading...</p>}
      {error && <p style={{ color: "#ef4444", fontSize: "13px", fontFamily: "monospace" }}>{error}</p>}
      {searched && !loading && !error && txns.length === 0 && (
        <p style={{ color: "#a1a1aa", fontSize: "13px" }}>No transactions found.</p>
      )}

      {/* Table */}
      {txns.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #222" }}>
              {["Signature", "Slot", "Time", "Fee (lamports)", "Status"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#a1a1aa", fontWeight: 400, fontFamily: "monospace", fontSize: "11px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.map((tx) => (
              <tr key={tx.signature} style={{ borderBottom: "1px solid #111" }}>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#a1a1aa" }}>
                  {truncate(tx.signature)}
                </td>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#fff" }}>
                  {tx.slot.toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", color: "#a1a1aa" }}>
                  {fmt(tx.block_time)}
                </td>
                <td style={{ padding: "10px 12px", color: "#fff" }}>
                  {tx.fee.toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    padding: "2px 8px",
                    borderRadius: "99px",
                    backgroundColor: tx.status === "success" ? "#14532d" : "#450a0a",
                    color: tx.status === "success" ? "#86efac" : "#fca5a5",
                  }}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}