"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

interface PaymentInfo {
  price: string;
  network: string;
  receiver: string;
  instructions: string[];
}

interface Props {
  paymentInfo: PaymentInfo;
  onPay: (signature: string) => void;
  /**
   * Unique localStorage key per page/feature.
   * e.g. "paid:transactions" | "paid:blocks" | "paid:account"
   * Each page stores its own signature independently.
   */
  storageKey: string;
}

export default function PaymentWall({ paymentInfo, onPay, storageKey }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [status, setStatus] = useState<"idle" | "paying" | "confirming" | "done">("idle");
  const [txSig, setTxSig] = useState<string | null>(null);

  // On mount: if this page was already paid, skip the wall immediately
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) onPay(saved);
  }, [storageKey]);

  const handleRealPayment = async () => {
    if (!publicKey) return alert("Connect your wallet first!");

    try {
      setStatus("paying");
      const amount = parseFloat(paymentInfo.price.replace(" SOL", ""));
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(paymentInfo.receiver),
          lamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      setStatus("confirming");
      setTxSig(signature);

      await connection.confirmTransaction(signature, "confirmed");

      // Persist signature — this page is unlocked for all future visits
      localStorage.setItem(storageKey, signature);

      setStatus("done");
      setTimeout(() => onPay(signature), 1500);
    } catch (err: any) {
      setStatus("idle");
      if (err.message?.includes("rejected")) return;
      alert("Payment failed: " + err.message);
    }
  };

  return (
    <div style={{
      maxWidth: "400px",
      margin: "24px auto",
      border: "0.5px solid #2a2a2a",
      padding: "20px 22px",
      backgroundColor: "#111",
      borderRadius: "12px",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>

      <p style={{
        fontSize: "11px",
        color: "#888",
        letterSpacing: "2px",
        marginBottom: "16px",
        fontWeight: 500,
        textTransform: "uppercase",
      }}>
        x402 · PAYMENT REQUIRED
      </p>

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
        <span style={{ fontSize: "36px", color: "#ffffff", fontWeight: 300, lineHeight: 1, letterSpacing: "-1px" }}>
          {paymentInfo.price.replace(" SOL", "")}
        </span>
        <span style={{ fontSize: "16px", color: "#ffffff", fontWeight: 600 }}>SOL</span>
      </div>
      <p style={{ fontSize: "12px", color: "#aaa", marginBottom: "16px", fontWeight: 500 }}>
        Solana · {paymentInfo.network}
      </p>

      <div style={{ height: "0.5px", background: "#2a2a2a", marginBottom: "16px" }} />

      <p style={{ fontSize: "11px", color: "#fff", letterSpacing: "1.5px", marginBottom: "6px", fontWeight: 700, textTransform: "uppercase" }}>
        Receiver
      </p>
      <p style={{
        fontSize: "11px",
        color: "#bbb",
        marginBottom: "16px",
        wordBreak: "break-all",
        lineHeight: 1.6,
        fontWeight: 500,
        backgroundColor: "#1a1a1a",
        padding: "8px 10px",
        borderRadius: "6px",
        border: "0.5px solid #2a2a2a",
      }}>
        {paymentInfo.receiver}
      </p>

      <p style={{ fontSize: "11px", color: "#fff", letterSpacing: "1.5px", marginBottom: "10px", fontWeight: 700, textTransform: "uppercase" }}>
        Instructions
      </p>
      <div style={{ marginBottom: "20px" }}>
        {paymentInfo.instructions.map((inst, i) => (
          <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "8px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "11px", color: "#9945FF", minWidth: "18px", fontWeight: 700, marginTop: "1px" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: "12px", color: "#ccc", lineHeight: 1.55, fontWeight: 500 }}>
              {inst}
            </span>
          </div>
        ))}
      </div>

      {status === "paying" && (
        <p style={{ fontSize: "13px", color: "#facc15", marginBottom: "14px", letterSpacing: "0.5px", fontWeight: 600 }}>
          ⏳ Waiting for wallet confirmation...
        </p>
      )}
      {status === "confirming" && (
        <p style={{ fontSize: "13px", color: "#facc15", marginBottom: "14px", letterSpacing: "0.5px", fontWeight: 600 }}>
          ⏳ Confirming on-chain...
        </p>
      )}
      {status === "done" && (
        <div style={{ marginBottom: "14px", backgroundColor: "#0f2b1a", padding: "12px 14px", borderRadius: "6px", border: "0.5px solid #166534" }}>
          <p style={{ fontSize: "13px", color: "#4ade80", marginBottom: "6px", letterSpacing: "1px", fontWeight: 700 }}>
            ✓ PAYMENT CONFIRMED
          </p>
          <p style={{ fontSize: "11px", color: "#6b7280", wordBreak: "break-all", fontWeight: 500, lineHeight: 1.6 }}>
            {txSig}
          </p>
        </div>
      )}

      {!connected ? (
        <div>
          <p style={{ fontSize: "13px", color: "#bbb", marginBottom: "14px", textAlign: "center", fontWeight: 500 }}>
            Connect your Phantom wallet to pay
          </p>
         <div style={{
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  width: "100%",
}}>
  <WalletMultiButton
    style={{
      width: "fit-content", // important change
      backgroundColor: "#9945FF",
      color: "#fff",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: 700,
      letterSpacing: "1.5px",
      fontFamily: "inherit",
      padding: "13px 24px",
    }}
  />
</div>
        </div>
      ) : (
        <button
          onClick={handleRealPayment}
          disabled={status !== "idle"}
          style={{
            width: "100%",
            padding: "13px",
            backgroundColor: status === "done" ? "#14532d" : "#9945FF",
            color: status === "done" ? "#4ade80" : "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            cursor: status !== "idle" ? "not-allowed" : "pointer",
            letterSpacing: "1.5px",
            fontWeight: 700,
            fontFamily: "inherit",
            opacity: status !== "idle" && status !== "done" ? 0.7 : 1,
            transition: "opacity 0.2s, background-color 0.2s",
          }}
        >
          {status === "idle" && `PAY ${paymentInfo.price} →`}
          {status === "paying" && "WAITING..."}
          {status === "confirming" && "CONFIRMING..."}
          {status === "done" && "✓ PAID"}
        </button>
      )}

      <p style={{ marginTop: "12px", textAlign: "center", fontSize: "10px", color: "#444", letterSpacing: "2px", fontWeight: 600 }}>
        POWERED BY x402 · SOLANA
      </p>
    </div>
  );
}