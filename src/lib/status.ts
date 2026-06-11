import type {
  ApprovalStatus,
  PaymentStatus,
  ProjectStatus,
  StageStatus,
  PartnerLeadStatus,
  PartnerProjectType,
  ReferralStatus,
} from "@/types/database";

export const referralStatusHe: Record<ReferralStatus, string> = {
  submitted: "הוגשה",
  in_progress: "בתהליך",
  closed: "נסגרה",
  not_relevant: "לא רלוונטי",
};

export const referralStatusVariant: Record<
  ReferralStatus,
  "secondary" | "warning" | "success" | "destructive"
> = {
  submitted: "secondary",
  in_progress: "warning",
  closed: "success",
  not_relevant: "destructive",
};

export const projectStatusHe: Record<ProjectStatus, string> = {
  active: "פעיל",
  on_hold: "בהמתנה",
  completed: "הושלם",
  cancelled: "בוטל",
};

export const projectStatusVariant: Record<
  ProjectStatus,
  "success" | "warning" | "cyan" | "secondary"
> = {
  active: "success",
  on_hold: "warning",
  completed: "cyan",
  cancelled: "secondary",
};

export const stageStatusHe: Record<StageStatus, string> = {
  not_started: "טרם החל",
  in_progress: "בתהליך",
  done: "הושלם",
  blocked: "חסום",
};

export const approvalStatusHe: Record<ApprovalStatus, string> = {
  pending: "ממתין לאישור",
  approved: "אושר",
  needs_changes: "נדרשים שינויים",
};

export const paymentStatusHe: Record<PaymentStatus, string> = {
  pending: "ממתין",
  paid: "שולם",
};

export const leadStatusHe: Record<PartnerLeadStatus, string> = {
  submitted: "הוגש",
  in_review: "בטיפול",
  quote_sent: "הצעת מחיר נשלחה",
  interested: "הלקוח מעוניין",
  closed: "נסגר",
  not_relevant: "לא רלוונטי",
};

export const leadStatusVariant: Record<
  PartnerLeadStatus,
  "secondary" | "warning" | "cyan" | "success" | "destructive"
> = {
  submitted: "secondary",
  in_review: "warning",
  quote_sent: "cyan",
  interested: "cyan",
  closed: "success",
  not_relevant: "destructive",
};

export const projectTypeHe: Record<PartnerProjectType, string> = {
  business_site: "אתר עסקי",
  ecommerce: "חנות אונליין",
  system: "מערכת",
  other: "אחר",
};
