"use client";

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
}

export default function PaymentWall({ paymentInfo, onPay }: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const handleRealPayment = async () => {
    if (!publicKey) return alert("Connect your wallet first!");

    try {
      // Parse price — "0.001 SOL" → 0.001
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

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      onPay(signature);
    } catch (err: any) {
      alert("Payment failed: " + err.message);
    }
  };

  return (
    <div style={{
      maxWidth: "420px",
      margin: "40px auto",
      border: "1px solid #222",
      padding: "32px",
      backgroundColor: "#0a0a0a",
    }}>
      <p style={{ fontSize: "10px", color: "#555", letterSpacing: "2px", marginBottom: "24px" }}>
        x402 · PAYMENT REQUIRED
      </p>

      <p style={{ fontSize: "40px", color: "#fff", fontWeight: 600, marginBottom: "4px" }}>
        {paymentInfo.price}
      </p>
      <p style={{ fontSize: "11px", color: "#555", marginBottom: "24px" }}>
        Solana · {paymentInfo.network}
      </p>

      <div style={{ height: "1px", background: "#1a1a1a", marginBottom: "24px" }} />

      <p style={{ fontSize: "10px", color: "#444", letterSpacing: "1.5px", marginBottom: "6px" }}>
        RECEIVER
      </p>
      <p style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "20px", wordBreak: "break-all", lineHeight: 1.6 }}>
        {paymentInfo.receiver}
      </p>

      <p style={{ fontSize: "10px", color: "#444", letterSpacing: "1.5px", marginBottom: "12px" }}>
        INSTRUCTIONS
      </p>
      <div style={{ marginBottom: "28px" }}>
        {paymentInfo.instructions.map((inst, i) => (
          <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <span style={{ fontSize: "10px", color: "#333", minWidth: "20px", marginTop: "2px" }}>
              0{i + 1}
            </span>
            <span style={{ fontSize: "11px", color: "#666", lineHeight: 1.6 }}>
              {inst}
            </span>
          </div>
        ))}
      </div>

      {/* Connect wallet first if not connected */}
      {!connected ? (
        <div>
          <p style={{ fontSize: "11px", color: "#a1a1aa", marginBottom: "12px", textAlign: "center" }}>
            Connect your Phantom wallet to pay
          </p>
          <WalletMultiButton style={{
            width: "100%",
            justifyContent: "center",
            backgroundColor: "#fff",
            color: "#000",
            borderRadius: "0",
            fontSize: "11px",
            letterSpacing: "2px",
            fontFamily: "inherit",
          }} />
        </div>
      ) : (
        <button
          onClick={handleRealPayment}
          style={{
            width: "100%",
            padding: "14px",
            backgroundColor: "#fff",
            color: "#000",
            border: "none",
            fontSize: "11px",
            cursor: "pointer",
            letterSpacing: "2px",
            fontWeight: 500,
            fontFamily: "inherit",
          }}
        >
          PAY {paymentInfo.price} →
        </button>
      )}

      <p style={{ marginTop: "16px", textAlign: "center", fontSize: "10px", color: "#2a2a2a", letterSpacing: "2px" }}>
        POWERED BY x402 · SOLANA
      </p>
    </div>
  );
}