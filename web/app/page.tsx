import StatsBar from "@/components/StatsBar";

export default function Home() {
  return (
    <main>
      {/* <StatsBar /> */}

      <section className="hero-section">
        <div className="hero-grid" aria-hidden="true" />

        {/* Glow orb */}
        <div className="hero-glow" aria-hidden="true" />

        <div className="hero-inner">

          {/* Badge */}
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Powered by x402 Protocol
          </div>

          {/* Headline */}
          <h1 className="hero-title">
            <span className="hero-title-sol">SOL</span>GATE
          </h1>

          {/* Subheadline */}
          <p className="hero-tagline">
            A high-performance Solana blockchain indexer —<br />
            explore blocks, trace transactions, and query wallet activity in real time.
          </p>

          {/* CTA — above the fold, prominent */}
          <div className="hero-cta">
            <a href="/blocks" className="cta-btn cta-primary">Explore Blocks</a>
            <a href="/transactions" className="cta-btn cta-secondary">Search Transactions</a>
          </div>

          {/* Divider */}
          <div className="hero-divider">
            <span>What you can do</span>
          </div>

          {/* Feature Cards */}
          <div className="hero-features">
            <div className="feature-card">
              <div className="feature-icon">⬡</div>
              <div className="feature-label">Block Explorer</div>
              <div className="feature-desc">
                Browse every block on-chain with slot numbers, timestamps, and transaction counts.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⇄</div>
              <div className="feature-label">Transactions by Wallet</div>
              <div className="feature-desc">
                Enter any wallet address to retrieve its full transaction history, instantly indexed.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">◎</div>
              <div className="feature-label">Lookup by Signature</div>
              <div className="feature-desc">
                Paste a transaction signature to fetch decoded instructions, status, and fee details.
              </div>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}