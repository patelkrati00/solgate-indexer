const BASE = "http://localhost:3001";

export async function fetchStats() {
  const res = await fetch(BASE + "/stats");
  return res.json();
}

export async function fetchBlocks(limit = 20, offset = 0) {
  const res = await fetch(
    "http://localhost:3001/blocks?limit=" + limit + "&offset=" + offset,
    { headers: { "X-PAYMENT": "demo" } }
  );
  return res.json();
}

export async function fetchTransactions(account: string, limit = 20) {
  const res = await fetch(
    BASE + "/transactions?account=" + account + "&limit=" + limit,
    { headers: { "X-PAYMENT": "demo" } }
  );
  return res.json();
}

export async function fetchTransactionBySignature(signature: string) {
  const res = await fetch(BASE + "/transactions/" + signature, {
    headers: { "X-PAYMENT": "demo" },
  });
  return res.json();
}