// The owner's review queue. The owner pass travels as X-Wron-Owner, which the kit
// attaches automatically; the Worker refuses every op without it.
import { cloudCall } from "../wron-kit/cloud.js";

/** Shares waiting for a decision, plus how many were published or rejected before. */
export async function pendingShares() {
  const { rows, counts } = await cloudCall("moderate", { op: "list" });
  return { rows: rows || [], counts: counts || {} };
}

export const publishShare = (id) => cloudCall("moderate", { op: "publish", id });
export const rejectShare = (id) => cloudCall("moderate", { op: "reject", id });
