"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/blocks", label: "Blocks" },
  { href: "/transactions", label: "Transactions" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      height: "56px",
      borderBottom: "1px solid #222222",
      backgroundColor: "#0a0a0a",
    }}>

      <span style={{ fontFamily: "monospace", fontSize: "25px", fontWeight: 600, letterSpacing: "3px", color: "#ffffff" }}>
        SOLGATE
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} style={{
            fontSize: "17px",
            color: pathname === link.href ? "#ffffff" : "#a1a1aa",
            fontWeight: pathname === link.href ? 500 : 400,
          }}>
            {link.label}
          </Link>
        ))}
        <span style={{
          fontSize: "15px",
          fontFamily: "monospace",
          padding: "2px 10px",
          borderRadius: "99px",
          border: "1px solid #222222",
          color: "#a1a1aa",
        }}>
          Devnet
        </span>
      </div>

    </nav>
  );
}