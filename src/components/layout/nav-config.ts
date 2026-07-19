import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Building2,
  Settings,
  BarChart3,
  Gift,
  UserCircle,
  Handshake,
  UserPlus,
  FileText,
  MessageSquareHeart,
  Megaphone,
  ListChecks,
  ClipboardList,
  Inbox,
  Timer,
  ShieldCheck,
  LifeBuoy,
  HeartHandshake,
  PackageOpen,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Notification types whose unread count should badge this item. */
  badgeTypes?: string[];
  /** data-tour hook for the onboarding tour. */
  tourId?: string;
  /** Sidebar group heading this item sits under (used by the admin nav, which
   *  has grown long enough to warrant categories). A run of items sharing the
   *  same section renders under one heading, in array order. */
  section?: string;
}

export const adminNav: NavItem[] = [
  // ── ראשי ──
  { to: "/admin", label: "לוח בקרה", icon: LayoutDashboard, end: true, section: "ראשי" },
  { to: "/admin/tasks", label: "המשימות שלי", icon: ListChecks, section: "ראשי" },

  // ── לקוחות ופרויקטים ──
  { to: "/admin/businesses", label: "עסקים", icon: Building2, section: "לקוחות ופרויקטים" },
  { to: "/admin/clients", label: "לקוחות", icon: Users, section: "לקוחות ופרויקטים" },
  {
    to: "/admin/projects",
    label: "פרויקטים",
    icon: FolderKanban,
    badgeTypes: ["file", "message", "approval", "checklist"],
    section: "לקוחות ופרויקטים",
  },
  { to: "/admin/discovery", label: "שיחות אפיון", icon: ClipboardList, section: "לקוחות ופרויקטים" },
  { to: "/admin/tools", label: "ארגז כלים", icon: Wrench, section: "לקוחות ופרויקטים" },

  // ── לידים ושותפים ──
  { to: "/admin/leads", label: "כל הלידים", icon: Inbox, badgeTypes: ["referral"], section: "לידים ושותפים" },
  { to: "/admin/partners", label: "שותפים", icon: Handshake, section: "לידים ושותפים" },
  { to: "/admin/referrals", label: "חנות הפרסים", icon: Gift, section: "לידים ושותפים" },

  // ── שירות וחבילות ──
  {
    to: "/admin/service-calls",
    label: "קריאות שירות",
    icon: LifeBuoy,
    badgeTypes: ["service_call"],
    section: "שירות וחבילות",
  },
  { to: "/admin/maintenance", label: "חבילות תחזוקה", icon: HeartHandshake, section: "שירות וחבילות" },
  { to: "/admin/plans", label: "עריכת חבילות", icon: PackageOpen, section: "שירות וחבילות" },

  // ── תקשורת ──
  {
    to: "/admin/feedback",
    label: "הערות לקוחות",
    icon: MessageSquareHeart,
    badgeTypes: ["feedback"],
    section: "תקשורת",
  },
  { to: "/admin/announcements", label: "הכרזות", icon: Megaphone, section: "תקשורת" },

  // ── מדדים ומערכת ──
  { to: "/admin/analytics", label: "אנליטיקות", icon: BarChart3, section: "מדדים ומערכת" },
  { to: "/admin/time", label: "מעקב זמן", icon: Timer, section: "מדדים ומערכת" },
  { to: "/admin/settings", label: "הגדרות", icon: Settings, section: "מדדים ומערכת" },
];

export const partnerNav: NavItem[] = [
  { to: "/partner-portal", label: "לוח בקרה", icon: LayoutDashboard, end: true },
  { to: "/partner-portal/businesses", label: "העסקים שלי", icon: Building2, tourId: "partner-businesses" },
  { to: "/partner-portal/new-lead", label: "הגשת ליד", icon: UserPlus },
  { to: "/partner-portal/resources", label: "חומרי מכירה", icon: FileText },
];

export const clientNav: NavItem[] = [
  { to: "/", label: "לוח בקרה", icon: LayoutDashboard, end: true },
  { to: "/service", label: "השירות שלך", icon: ShieldCheck, tourId: "service" },
  { to: "/partner", label: "תוכנית שותפים", icon: Gift, tourId: "partner" },
  { to: "/profile", label: "פרופיל", icon: UserCircle, tourId: "profile" },
];
