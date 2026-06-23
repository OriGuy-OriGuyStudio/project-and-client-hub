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
  submitted: "התקבל",
  awaiting_intro: "ממתין לשיחת היכרות",
  intro_done: "שיחת היכרות בוצעה",
  quote_sent: "נשלחה הצעת מחיר",
  client_approved: "הלקוח אישר",
  closed: "אושר לעבודה",
  not_relevant: "נפל / לא רלוונטי",
};

export const leadStatusVariant: Record<
  PartnerLeadStatus,
  "secondary" | "warning" | "cyan" | "success" | "destructive"
> = {
  submitted: "secondary",
  awaiting_intro: "warning",
  intro_done: "cyan",
  quote_sent: "cyan",
  client_approved: "cyan",
  closed: "success",
  not_relevant: "destructive",
};

export const projectTypeHe: Record<PartnerProjectType, string> = {
  business_site: "אתר עסקי",
  ecommerce: "חנות אונליין",
  system: "מערכת",
  other: "אחר",
};
