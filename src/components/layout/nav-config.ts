import {
  LayoutDashboard,
  FolderKanban,
  Users,
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
}

export const adminNav: NavItem[] = [
  { to: "/admin", label: "לוח בקרה", icon: LayoutDashboard, end: true },
  { to: "/admin/tasks", label: "המשימות שלי", icon: ListChecks },
  { to: "/admin/discovery", label: "שיחות אפיון", icon: ClipboardList },
  { to: "/admin/clients", label: "לקוחות", icon: Users },
  {
    to: "/admin/projects",
    label: "פרויקטים",
    icon: FolderKanban,
    badgeTypes: ["file", "message", "approval", "checklist"],
  },
  { to: "/admin/leads", label: "כל הלידים", icon: Inbox, badgeTypes: ["referral"] },
  { to: "/admin/service-calls", label: "קריאות שירות", icon: LifeBuoy, badgeTypes: ["service_call"] },
  { to: "/admin/maintenance", label: "חבילות תחזוקה", icon: HeartHandshake },
  { to: "/admin/partners", label: "שותפים", icon: Handshake },
  { to: "/admin/referrals", label: "הפניות", icon: Handshake, badgeTypes: ["referral"] },
  {
    to: "/admin/feedback",
    label: "הערות לקוחות",
    icon: MessageSquareHeart,
    badgeTypes: ["feedback"],
  },
  { to: "/admin/announcements", label: "הכרזות", icon: Megaphone },
  { to: "/admin/analytics", label: "אנליטיקות", icon: BarChart3 },
  { to: "/admin/time", label: "מעקב זמן", icon: Timer },
  { to: "/admin/settings", label: "הגדרות", icon: Settings },
];

export const partnerNav: NavItem[] = [
  { to: "/partner-portal", label: "לוח בקרה", icon: LayoutDashboard, end: true },
  { to: "/partner-portal/new-lead", label: "הגשת ליד", icon: UserPlus },
  { to: "/partner-portal/resources", label: "חומרי מכירה", icon: FileText },
];

export const clientNav: NavItem[] = [
  { to: "/", label: "לוח בקרה", icon: LayoutDashboard, end: true },
  { to: "/service", label: "השירות שלך", icon: ShieldCheck },
  { to: "/partner", label: "תוכנית שותפים", icon: Gift, tourId: "partner" },
  { to: "/profile", label: "פרופיל", icon: UserCircle, tourId: "profile" },
];
