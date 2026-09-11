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

export type PaymentGateway = "PAYSTACK" | "FLUTTERWAVE" | "MANUAL";

export type EmailDirection = "OUTBOUND" | "INBOUND";

export type TenantType = "PLATFORM" | "AGENCY";
export type TenantFeeModel = "TRANSACTION_PCT" | "FX_SPREAD_SHARE" | "FLAT_SUBSCRIPTION";
export type TenantStatus = "PENDING_ONBOARDING" | "ACTIVE" | "SUSPENDED";

// ContactEnquiry.topic is a plain String (with a default) in Prisma, not
// a database enum — the fixed option list lives here instead, once,
// so the marketing site's form and the backend's validation can't drift
// out of sync the way two independently-typed string arrays eventually would.
export type ContactTopic = "General enquiry" | "Agency sign-up" | "Support" | "Partnership / press";

export const CONTACT_TOPICS: ContactTopic[] = [
  "General enquiry",
  "Agency sign-up",
  "Support",
  "Partnership / press",
];

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

export interface PaymentHistoryItem {
  id: string; // PaymentRequest id
  periodLabel: string;
  amount: string;
  currency: string;
  dueDate: string;
  service: Pick<Service, "name" | "category">;
  payment: {
    id: string;
    gateway: PaymentGateway;
    receiptNumber: string | null;
    paidAt: string | null;
    amount: string;
    currency: string;
  } | null;
}

export interface EmailMessage {
  id: string;
  orgId: string;
  userId: string | null;
  user: Pick<OrgUser, "id" | "name" | "email"> | null;
  direction: EmailDirection;
  subject: string;
  bodyText: string;
  fromAddress: string;
  toAddress: string;
  createdAt: string;
}

// ---- Tenants -------------------------------------------------

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  status: TenantStatus;
  supportEmail: string | null;
  flutterwaveSubaccountId: string | null;
  flutterwaveOnboardedAt: string | null;
  feeModel: TenantFeeModel;
  feePct: string; // Decimal serialized as string over the wire
  flatFeeUsd: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface TenantWithCounts extends Tenant {
  _count: { organizations: number; payments: number };
}

export interface TenantSignupRequest {
  tenantName: string;
  slug: string;
  adminEmail: string;
  adminName?: string;
  password: string;
}

export interface TenantSignupResponse {
  token: string;
  admin: { id: string; email: string; name: string | null };
  tenant: Pick<Tenant, "id" | "name" | "slug" | "status">;
  nextStep: "connect_payment";
}

export interface ConnectFlutterwaveRequest {
  flutterwaveSubaccountId: string;
}

export interface UpdateMyTenantRequest {
  name?: string;
  supportEmail?: string;
}

export interface PlatformUpdateTenantRequest {
  feeModel?: TenantFeeModel;
  feePct?: number;
  flatFeeUsd?: number;
  status?: TenantStatus;
  isActive?: boolean;
}

// ---- Contact enquiries (marketing site) -----------------------
// Deliberately not tied to a Tenant/Organization — submitted by
// prospects, not existing customers. Visible only to platform
// (RunServ staff) admins.

export interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: ContactTopic;
  message: string;
  handled: boolean;
  createdAt: string;
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
  platformFeeUsdAllTime: string | null; // only populated for platform admins
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

// Public — the marketing site's contact form. No auth, same tier as
// login/forgotPassword above.
export interface SubmitContactEnquiryRequest {
  name: string;
  email: string;
  company?: string;
  topic: ContactTopic;
  message: string;
  hp_website?: string; // honeypot — always empty for real visitors; non-empty means silently drop the submission
}

export interface SubmitContactEnquiryResponse {
  ok: true;
}

// ---- Admin-facing API DTOs -----------------------------------

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  admin: { id: string; email: string; name: string | null };
  tenant: Pick<Tenant, "id" | "name" | "slug" | "type" | "status">;
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

export interface DeleteServiceResponse {
  message: string;
  cancelled: boolean; // true if it had paid history and was cancelled instead of removed
}

export interface SendMessageRequest {
  subject: string;
  body: string; // Markdown
  recipientUserId?: string; // omit to send to every active user in the org
}

export interface SendMessageResponse {
  message: string;
}

export interface MarkPaymentsPaidRequest {
  paymentRequestIds: string[];
  note?: string;
}

export interface MarkPaymentsPaidResponse {
  message: string;
  paymentId: string;
}

// Platform (RunServ staff) only — these are leads for RunServ itself,
// not scoped to any tenant/agency. See ContactEnquiry above.
export interface ListContactEnquiriesResponse {
  enquiries: ContactEnquiry[];
}

export interface UpdateContactEnquiryRequest {
  handled: boolean;
}

export interface UpdateContactEnquiryResponse {
  enquiry: ContactEnquiry;
}
