// packages/types/src/index.ts
// ==========================================================
// Shared types — mirrors apps/backend/prisma/schema.prisma enums
// and defines the request/response shapes crossing the API
// boundary. Keep this the single source of truth for both
// apps/web and apps/backend so a schema change is felt at
// compile time on both sides, not discovered at runtime.
// ==========================================================

// ---- Enums (mirror Prisma) --------------------------------

export type OrgRole = "OWNER" | "FINANCE" | "MEMBER";

export type ServiceCategory =
  | "API"
  | "SERVER"
  | "DATABASE"
  | "DOMAIN"
  | "SECURITY"
  | "STORAGE"
  | "SOFTWARE"
  | "DEVELOPMENT"
  | "MAINTENANCE"
  | "CONSULTING"
  | "OTHER";

export type ServiceStatus = "ACTIVE" | "PAUSED" | "CANCELLED";

export type BillingCycle = "MONTHLY" | "YEARLY";

export type PaymentRequestStatus = "UPCOMING" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export type PaymentGateway = "PAYSTACK" | "FLUTTERWAVE";

// ---- Core entities -----------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency: string;
  yearlyDiscountPct: number;
  preferredGateway: PaymentGateway;
  isActive: boolean;
  createdAt: string;
}

export interface OrgUser {
  id: string;
  orgId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface Service {
  id: string;
  orgId: string;
  name: string;
  category: ServiceCategory;
  description: string | null;
  monthlyAmount: string; // Decimal serialized as string over the wire
  billingCycle: BillingCycle;
  status: ServiceStatus;
  nextDueDate: string;
}

export interface PaymentRequest {
  id: string;
  orgId: string;
  serviceId: string;
  service: Pick<Service, "name" | "category" | "description">;
  periodLabel: string;
  billingCycle: BillingCycle;
  amount: string;
  currency: string;
  dueDate: string;
  status: PaymentRequestStatus;
}

export interface Payment {
  id: string;
  orgId: string;
  gateway: PaymentGateway;
  gatewayRef: string;
  amount: string;
  currency: string;
  usdAmount: string;
  fxRateApplied: string | null;
  status: PaymentStatus;
  receiptNumber: string | null;
  paidAt: string | null;
}

export interface ExchangeRate {
  pair: string;
  marketRate: string;
  markupPct: string;
  effectiveRate: string; // marketRate * (1 + markupPct/100), computed server-side
  source: "manual" | "synced";
  updatedAt: string;
}

// ---- Client-facing API DTOs ---------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  mustChangePassword: boolean;
  user: Pick<OrgUser, "id" | "email" | "name" | "role">;
  org: Pick<Organization, "id" | "name" | "slug">;
}

export interface CheckoutRequest {
  paymentRequestIds: string[];
  currency?: "USD" | "NGN"; // defaults to USD
}

export interface CheckoutResponse {
  checkoutUrl: string;
  reference: string;
  total: number;
  currency: "USD" | "NGN";
  gateway: PaymentGateway; // whichever gateway actually processed this — may differ from the org's preferredGateway if a fallback occurred
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface RevenueSummary {
  totalUsdAllTime: string;
  totalUsdThisMonth: string;
  paymentsThisMonth: number;
  byOrg: Array<{ orgId: string; orgName: string; totalUsd: string; paymentsCount: number }>;
  byGateway: Array<{ gateway: PaymentGateway; totalUsd: string; paymentsCount: number }>;
  byCurrency: Array<{ currency: string; totalUsd: string; paymentsCount: number }>;
  recentPayments: Array<{
    id: string;
    orgName: string;
    amount: string;
    currency: string;
    usdAmount: string;
    gateway: PaymentGateway;
    paidAt: string | null;
    receiptNumber: string | null;
  }>;
}

// ---- Admin-facing API DTOs -----------------------------------

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  admin: { id: string; email: string; name: string | null };
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  currency?: string;
  yearlyDiscountPct?: number;
  preferredGateway?: PaymentGateway;
  ownerEmail: string;
  ownerName?: string;
}

export interface CreateServiceRequest {
  name: string;
  category: ServiceCategory;
  description?: string;
  monthlyAmount: number;
  billingCycle?: BillingCycle;
  nextDueDate: string; // ISO date
}

export interface UpdateServiceRequest {
  name?: string;
  category?: ServiceCategory;
  description?: string;
  monthlyAmount?: number;
  billingCycle?: BillingCycle;
  status?: ServiceStatus;
  nextDueDate?: string;
}
