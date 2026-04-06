// web/components/BlocksTable.tsx
"use client";

import { useEffect, useState } from "react";
import { fetchBlocks } from "@/lib/api";

interface Block {
  slot: number;
  block_time: number | null;
  tx_count: number;
  indexed_at: number;
}

const fmt = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleTimeString() : "—";

export default function BlocksTable() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlocks(20)
      .then((data) => setBlocks(data.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section style={{ padding: "24px" }}>
      <p style={{ fontSize: "11px", fontFamily: "monospace", color: "#a1a1aa", letterSpacing: "1px", marginBottom: "16px" }}>
        RECENT BLOCKS
      </p>
      {loading ? (
        <p style={{ color: "#a1a1aa", fontSize: "13px" }}>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #222" }}>
              {["Slot", "Time", "Transactions", "Indexed At"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#a1a1aa", fontWeight: 400, fontFamily: "monospace", fontSize: "11px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.slot} style={{ borderBottom: "1px solid #111" }}>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#fff" }}>
                  {b.slot.toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", color: "#a1a1aa" }}>
                  {fmt(b.block_time)}
                </td>
                <td style={{ padding: "10px 12px", color: "#fff" }}>
                  {b.tx_count}
                </td>
                <td style={{ padding: "10px 12px", color: "#a1a1aa" }}>
                  {fmt(b.indexed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}