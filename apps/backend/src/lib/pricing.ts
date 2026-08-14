// apps/backend/src/lib/pricing.ts
export function computeAmount(
  monthlyAmount: number,
  billingCycle: "MONTHLY" | "YEARLY",
  yearlyDiscountPct: number
) {
  return billingCycle === "YEARLY"
    ? monthlyAmount * 12 * (1 - yearlyDiscountPct / 100)
    : monthlyAmount;
}