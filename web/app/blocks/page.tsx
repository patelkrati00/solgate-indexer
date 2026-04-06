"use client";

import { useEffect, useState } from "react";
import { fetchBlocks } from "@/lib/api";
import PaymentWall from "@/components/PaymentWall";

interface Block {
  slot: number;
  block_time: number | null;
  tx_count: number;
  indexed_at: number;
}

const fmt = (ts: number | null) =>
  ts ? new Date(ts * 1000).toLocaleTimeString() : "—";

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const LIMIT = 20;

  const load = (off: number, sig: string | null) => {
    setLoading(true);
    fetchBlocks(LIMIT, off, sig)
      .then(({ status, data }) => {
        if (status === 402) {
          setPaymentInfo(data);
          setBlocks([]);
        } else {
          setPaymentInfo(null);
          setBlocks(data.data ?? []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0, null); }, []);

  const handlePay = (sig: string) => {
    setSignature(sig);
    load(offset, sig);
  };

  const prev = () => {
    const newOffset = Math.max(0, offset - LIMIT);
    setOffset(newOffset);
    load(newOffset, signature);
  };

  const next = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    load(newOffset, signature);
  };

  

  return (
    <main style={{ padding: "24px" }}>
      <p style={{ fontSize: "11px", color: "#a1a1aa", letterSpacing: "1px", marginBottom: "16px" }}>
        BLOCKS
      </p>

      {loading && (
        <p style={{ color: "#a1a1aa", fontSize: "13px" }}>Loading...</p>
      )}

      {!loading && paymentInfo && (
        <PaymentWall storageKey="paid:blocks" paymentInfo={paymentInfo} onPay={handlePay} />
      )}

      {!loading && blocks.length > 0 && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Slot", "Time", "Transactions", "Indexed At"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#a1a1aa", fontWeight: 400, fontSize: "11px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.slot} style={{ borderBottom: "1px solid #111" }}>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>{b.slot.toLocaleString()}</td>
                  <td style={{ padding: "10px 12px", color: "#a1a1aa" }}>{fmt(b.block_time)}</td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>{b.tx_count}</td>
                  <td style={{ padding: "10px 12px", color: "#a1a1aa" }}>{fmt(b.indexed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "24px" }}>
            <button onClick={prev} disabled={offset === 0} style={{ padding: "6px 16px", backgroundColor: "transparent", border: "1px solid #222", color: offset === 0 ? "#444" : "#fff", fontSize: "12px", cursor: offset === 0 ? "not-allowed" : "pointer" }}>
              ← Prev
            </button>
            <span style={{ color: "#a1a1aa", fontSize: "12px" }}>{offset + 1} – {offset + blocks.length}</span>
            <button onClick={next} disabled={blocks.length < LIMIT} style={{ padding: "6px 16px", backgroundColor: "transparent", border: "1px solid #222", color: blocks.length < LIMIT ? "#444" : "#fff", fontSize: "12px", cursor: blocks.length < LIMIT ? "not-allowed" : "pointer" }}>
              Next →
            </button>
          </div>
        </>
      )}
    </main>
  );
}