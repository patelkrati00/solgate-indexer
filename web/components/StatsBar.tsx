// components/StatsBar.tsx
"use client";

import { useEffect, useState } from "react";
import {fetchStats} from "@/lib/api";

interface Stats {
  total_blocks: number;
  total_transactions: number;
  latest_slot: number | null;
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);



 useEffect(() => {
  fetchStats().then(setStats).catch(console.error);
}, []);


  const items = [
    { label: "Total Blocks", value: stats?.total_blocks ?? "—" },
    { label: "Total Transactions", value: stats?.total_transactions ?? "—" },
    { label: "Latest Slot", value: stats?.latest_slot ?? "—" },
  ];

  return (
    <section style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "1px",
      borderBottom: "1px solid #222222",
      backgroundColor: "#222222",
    }}>
      {items.map((item) => (
        <article key={item.label} style={{
          padding: "20px 24px",
          backgroundColor: "#0a0a0a",
        }}>
          <p style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "6px", fontFamily: "monospace", letterSpacing: "0.5px" }}>
            {item.label}
          </p>
          <p style={{ fontSize: "22px", fontWeight: 500, color: "#ffffff", fontFamily: "monospace" }}>
            {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
          </p>
        </article>
      ))}
    </section>
  );
}