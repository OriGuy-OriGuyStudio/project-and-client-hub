// ============================================================
// Hand-authored to match supabase/migrations exactly.
// Regenerate from the live project anytime with:
//   npx supabase gen types typescript --linked > src/types/database.ts
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "client" | "partner";
export type PartnerLeadStatus =
  | "submitted"
  | "in_review"
  | "quote_sent"
  | "interested"
  | "closed"
  | "not_relevant";
export type PartnerProjectType =
  | "business_site"
  | "ecommerce"
  | "system"
  | "other";
export type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";
export type StageStatus = "not_started" | "in_progress" | "done" | "blocked";
export type ApprovalStatus = "pending" | "approved" | "needs_changes";
export type TaskStatus = "open" | "in_progress" | "done";
export type PaymentStatus = "pending" | "paid";
export type ReferralStatus = "submitted" | "in_progress" | "closed" | "not_relevant";
export type BrandColorRole =
  | "primary"
  | "secondary"
  | "accent"
  | "background"
  | "text"
  | "other";

export type Gender = "male" | "female" | "other";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  gender: Gender | null;
  created_at: string;
}

export type AllowedEmail = {
  email: string;
  role: UserRole;
  full_name: string | null;
  business_name: string | null;
  gender: Gender | null;
  commission_rate: number | null;
  commission_rate_min: number | null;
  commission_rate_max: number | null;
  commission_notes: string | null;
  invited_by: string | null;
  invited_at: string;
  invite_sent_at: string | null;
  invite_send_count: number;
  invite_last_status: "sent" | "failed" | null;
  invite_last_error: string | null;
}

export type PartnerTier = "bronze" | "silver" | "gold" | "platinum" | "ambassador";

export type PartnerProfile = {
  id: string;
  commission_rate: number;
  commission_rate_min: number | null;
  commission_rate_max: number | null;
  commission_notes: string | null;
  referral_code: string;
  is_active: boolean;
  joined_at: string;
  /** Performance tier (5% bronze → 10% ambassador), auto-managed unless tier_locked. */
  tier: PartnerTier;
  /** When true (e.g. a negotiated rate), the tier ladder won't auto-set commission_rate. */
  tier_locked: boolean;
  /** Active store-bought commission boost (added on top of the tier rate). */
  boost_pct: number;
  /** Closed deals the boost still applies to (auto-decrements, 0 = none). */
  boost_deals_left: number;
}

export type PartnerCoinTransaction = {
  id: string;
  partner_id: string;
  amount: number;
  reason:
    | "deal_closed"
    | "lead_submitted"
    | "reward_redeemed"
    | "manual_adjustment"
    | "gift"
    | "compensation"
    | "easter_egg"
    | null;
  lead_id: string | null;
  note: string | null;
  created_at: string;
}

export type PartnerLead = {
  id: string;
  partner_id: string;
  lead_name: string;
  lead_phone: string | null;
  lead_email: string | null;
  project_type: PartnerProjectType | null;
  notes: string | null;
  quote_requested: boolean;
  quote_file_url: string | null;
  lead_interested: boolean;
  status: PartnerLeadStatus;
  deal_value: number | null;
  commission_rate_at_close: number | null;
  commission_amount: number | null;
  payment_method: "bit" | "bank_transfer" | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ReferralTracking = {
  id: string;
  partner_id: string;
  referral_code: string;
  ip_hash: string | null;
  user_agent: string | null;
  converted_to_lead_id: string | null;
  clicked_at: string;
}

export type PartnerResource = {
  id: string;
  resource_type: "file" | "link" | "text_template" | null;
  title: string;
  description: string | null;
  content: string | null;
  file_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type StudioSettings = {
  id: boolean;
  studio_name: string;
  tagline: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  warranty_email_subject: string | null;
  warranty_email_body: string | null;
  welcome_email_subject: string | null;
  welcome_email_body: string | null;
  welcome_email_subject_partner: string | null;
  welcome_email_body_partner: string | null;
  portal_url: string | null;
  /** How many ILS one coin/credit is worth (rewards-store calculator). */
  ils_per_coin: number;
  /** Percent of full coin value shown as a monetary reward's ₪ value. */
  gift_value_pct: number;
  updated_at: string;
}

export type StageTemplateStage = {
  title: string;
  assignee: UserRole;
  tasks?: string[];
};

export type StageTemplate = {
  id: string;
  name: string;
  stages: StageTemplateStage[];
  order_index: number;
  created_at: string;
}

export type LogoFit = "auto" | "contain" | "cover";

export type ClientBrand = {
  id: string;
  client_id: string;
  business_name: string | null;
  business_description: string | null;
  logo_url: string | null;
  logo_icon_url: string | null;
  font_notes: string | null;
  website_url: string | null;
  social_links: Json;
  logo_fit: LogoFit;
  updated_at: string;
}

export type BrandColor = {
  id: string;
  client_id: string;
  hex_value: string;
  label: string | null;
  role: BrandColorRole | null;
  sort_order: number;
}

export type Project = {
  id: string;
  title: string;
  description: string | null;
  client_id: string;
  status: ProjectStatus;
  figma_url: string | null;
  figma_prototype_url: string | null;
  meeting_url: string | null;
  staging_url: string | null;
  live_url: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null; // generated column
  warranty_email_sent: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectStage = {
  id: string;
  project_id: string;
  title: string;
  assignee: UserRole | null;
  due_date: string | null;
  status: StageStatus;
  order_index: number;
}

export type StageTask = {
  id: string;
  stage_id: string;
  title: string;
  is_done: boolean;
  status: StageStatus;
  order_index: number;
  created_at: string;
}

export type Approval = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: ApprovalStatus;
  client_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FileRow = {
  id: string;
  project_id: string;
  folder_path: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  is_private: boolean;
  created_at: string;
}

export type ProjectFolder = {
  id: string;
  project_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export type ChecklistItem = {
  id: string;
  project_id: string;
  label: string;
  is_sent: boolean;
  sent_at: string | null;
  file_id: string | null;
}

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  is_private: boolean;
  created_at: string;
}

export type ProjectDoc = {
  id: string;
  project_id: string;
  title: string;
  content_html: string | null;
  is_private: boolean;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type Payment = {
  id: string;
  project_id: string;
  label: string;
  amount: number | null;
  currency: string;
  due_date: string | null;
  status: PaymentStatus;
  payment_link: string | null;
  invoice_file_id: string | null;
  paid_at: string | null;
}

export type Message = {
  id: string;
  project_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export type ActivityLog = {
  id: string;
  project_id: string;
  actor_id: string | null;
  action_type: string;
  description: string;
  created_at: string;
}

export type AdminClientNote = {
  id: string;
  client_id: string;
  content: string | null;
  gender: "male" | "female" | "other" | null;
  role_in_company: string | null;
  updated_at: string;
}

export type ClientCallLog = {
  id: string;
  client_id: string;
  summary: string;
  created_at: string;
  created_by: string | null;
}

export type Notification = {
  id: string;
  audience: "admin" | "client";
  recipient_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  project_id: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type ClientFeedback = {
  id: string;
  client_id: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

export type Referral = {
  id: string;
  referrer_id: string;
  referred_name: string;
  referred_contact: string;
  note: string | null;
  status: ReferralStatus;
  deal_value: number | null;
  payment_method: "bit" | "bank_transfer" | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CreditTransaction = {
  id: string;
  client_id: string;
  amount: number;
  reason:
    | "referral_submitted"
    | "deal_closed"
    | "reward_redeemed"
    | "manual_adjustment"
    | null;
  referral_id: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export type Reward = {
  id: string;
  name: string;
  description: string | null;
  credit_cost: number;
  reward_type: "studio_pro" | "custom" | null;
  is_active: boolean;
  created_at: string;
  /** Which program the reward belongs to ("both" = shown in both stores). */
  audience: "client" | "partner" | "both";
  /** Special handling for partner-store items. */
  kind: "generic" | "payout" | "commission_boost";
  /** Repeat policy: null = one-time, 0 = repeatable once handled, N = N-day cooldown. */
  cooldown_days: number | null;
  /** Emoji shown on the store card. */
  icon: string | null;
  /** Manual display order in the store (ascending). */
  sort_order: number;
  /** Total non-cancelled redemptions allowed across all users; null = unlimited. */
  stock: number | null;
  /** Availability window (null = open-ended). */
  available_from: string | null;
  available_until: string | null;
  /** Spotlight flag — pinned + highlighted at the top of the store. */
  is_featured: boolean;
  /** When true the store shows a derived ₪ value (cost × ils_per_coin × gift_value_pct%). */
  is_monetary: boolean;
  /** Derived client-side from `rewards_stock_used`; not a column. null = unlimited. */
  stock_left?: number | null;
}

export type PartnerRewardRedemption = {
  id: string;
  partner_id: string;
  reward_id: string;
  coins_spent: number;
  status: "pending" | "fulfilled" | "cancelled";
  note: string | null;
  created_at: string;
  fulfilled_at: string | null;
}

export type PartnerEnrollment = {
  id: string;
  client_id: string;
  enrolled_at: string;
  terms_accepted_at: string | null;
  terms_version: string | null;
}

export type RewardRedemption = {
  id: string;
  client_id: string;
  reward_id: string;
  credits_spent: number;
  redeemed_at: string;
  status: "pending" | "fulfilled" | "cancelled";
  fulfilled_at: string | null;
}

export type CoinGrant = {
  id: string;
  user_id: string;
  kind: "gift" | "compensation" | null;
  amount: number;
  reason: string | null;
  granted_by: string | null;
  email_status: "pending" | "sent" | "failed";
  notification_id: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

/** Generic helper to derive Insert/Update shapes from a Row type. */
// Insert/Update kept as Partial<Row>; required-field validity is enforced by
// the database (NOT NULL / defaults). The Row type is what drives query typing.
type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type EasterEggClaim = {
  client_id: string;
  claimed_at: string;
};

export type EasterEggClaimResult = {
  granted: boolean;
  coins?: number;
  enrolled?: boolean;
  already?: boolean;
  reason?: string;
};

export type AccessRequest = {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
}

export type UsageEvent = {
  id: string;
  user_id: string | null;
  role: string | null;
  event: string;
  path: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type AnnouncementAudience = "client" | "partner" | "both";

export type Announcement = {
  id: string;
  title: string;
  badge: string;
  body: string | null;
  audience: AnnouncementAudience;
  link_url: string | null;
  link_label: string | null;
  is_external: boolean;
  is_active: boolean;
  feature_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FeatureArea = "client" | "partner" | "both" | "admin" | "general";

export type SiteFeature = {
  id: string;
  title: string;
  description: string | null;
  area: FeatureArea;
  is_new: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AnnouncementDismissal = {
  announcement_id: string;
  user_id: string;
  dismissed_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<Profile>;
      allowed_emails: TableShape<AllowedEmail>;
      client_brand: TableShape<ClientBrand>;
      brand_colors: TableShape<BrandColor>;
      projects: TableShape<Project>;
      project_stages: TableShape<ProjectStage>;
      stage_tasks: TableShape<StageTask>;
      approvals: TableShape<Approval>;
      files: TableShape<FileRow>;
      project_folders: TableShape<ProjectFolder>;
      checklist_items: TableShape<ChecklistItem>;
      tasks: TableShape<Task>;
      project_docs: TableShape<ProjectDoc>;
      payments: TableShape<Payment>;
      messages: TableShape<Message>;
      activity_log: TableShape<ActivityLog>;
      admin_client_notes: TableShape<AdminClientNote>;
      client_call_logs: TableShape<ClientCallLog>;
      notifications: TableShape<Notification>;
      client_feedback: TableShape<ClientFeedback>;
      referrals: TableShape<Referral>;
      credit_transactions: TableShape<CreditTransaction>;
      rewards: TableShape<Reward>;
      partner_enrollments: TableShape<PartnerEnrollment>;
      reward_redemptions: TableShape<RewardRedemption>;
      coin_grants: TableShape<CoinGrant>;
      partner_profiles: TableShape<PartnerProfile>;
      partner_coin_transactions: TableShape<PartnerCoinTransaction>;
      partner_reward_redemptions: TableShape<PartnerRewardRedemption>;
      partner_leads: TableShape<PartnerLead>;
      referral_tracking: TableShape<ReferralTracking>;
      partner_resources: TableShape<PartnerResource>;
      studio_settings: TableShape<StudioSettings>;
      stage_templates: TableShape<StageTemplate>;
      easter_egg_claims: TableShape<EasterEggClaim>;
      access_requests: TableShape<AccessRequest>;
      usage_events: TableShape<UsageEvent>;
      announcements: TableShape<Announcement>;
      announcement_dismissals: TableShape<AnnouncementDismissal>;
      site_features: TableShape<SiteFeature>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_easter_egg: { Args: Record<string, never>; Returns: EasterEggClaimResult };
      log_usage_event: {
        Args: { p_event: string; p_path?: string | null; p_meta?: Record<string, unknown> | null };
        Returns: undefined;
      };
      get_my_role: { Args: Record<string, never>; Returns: string };
      ensure_my_profile: { Args: Record<string, never>; Returns: string | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      get_client_credits: { Args: { p_client_id: string }; Returns: number };
      redeem_reward: { Args: { p_reward_id: string }; Returns: string };
      get_partner_coins: { Args: { p_partner: string }; Returns: number };
      redeem_partner_reward: { Args: { p_reward_id: string }; Returns: string };
      set_partner_redemption_status: { Args: { p_id: string; p_status: string }; Returns: undefined };
      grant_coins: { Args: { p_user: string; p_amount: number; p_kind: string; p_reason?: string | null }; Returns: string };
      acknowledge_coin_grant: { Args: { p_notification_id: string }; Returns: undefined };
      set_client_redemption_status: { Args: { p_id: string; p_status: string }; Returns: undefined };
      mark_project_notifications_read: { Args: { p_project_id: string }; Returns: undefined };
      owns_project: { Args: { p_project_id: string }; Returns: boolean };
      resolve_referral: {
        Args: { p_code: string };
        Returns: { valid: boolean; partner_name?: string | null };
      };
      track_referral_click: {
        Args: { p_code: string; p_ua: string };
        Returns: string | null;
      };
      rewards_stock_used: {
        Args: { p_audience: string };
        Returns: { reward_id: string; used: number }[];
      };
      approve_access_request: { Args: { p_id: string; p_role?: string }; Returns: undefined };
      reject_access_request: { Args: { p_id: string }; Returns: undefined };
      submit_referral_lead: {
        Args: {
          p_code: string;
          p_name: string;
          p_phone: string;
          p_email: string | null;
          p_type: string | null;
          p_message: string | null;
          p_click_id: string | null;
        };
        Returns: { ok: boolean; attributed?: boolean; error?: string };
      };
      request_email_login: {
        Args: { p_email: string };
        Returns: { authorized: boolean; error?: string };
      };
      admin_user_activity: {
        Args: Record<string, never>;
        Returns: { id: string; last_sign_in_at: string | null; created_at: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
