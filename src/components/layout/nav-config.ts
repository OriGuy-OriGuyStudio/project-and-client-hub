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
  { to: "/admin/clients", label: "לקוחות", icon: Users },
  {
    to: "/admin/projects",
    label: "פרויקטים",
    icon: FolderKanban,
    badgeTypes: ["file", "message", "approval", "checklist"],
  },
  { to: "/admin/partners", label: "שותפים", icon: Handshake },
  { to: "/admin/referrals", label: "הפניות", icon: Handshake, badgeTypes: ["referral"] },
  {
    to: "/admin/feedback",
    label: "הערות לקוחות",
    icon: MessageSquareHeart,
    badgeTypes: ["feedback"],
  },
  { to: "/admin/analytics", label: "אנליטיקות", icon: BarChart3 },
  { to: "/admin/settings", label: "הגדרות", icon: Settings },
];

export const partnerNav: NavItem[] = [
  { to: "/partner-portal", label: "לוח בקרה", icon: LayoutDashboard, end: true },
  { to: "/partner-portal/new-lead", label: "הגשת ליד", icon: UserPlus },
  { to: "/partner-portal/resources", label: "חומרי מכירה", icon: FileText },
];

export const clientNav: NavItem[] = [
  { to: "/", label: "לוח בקרה", icon: LayoutDashboard, end: true },
  { to: "/partner", label: "תוכנית שותפים", icon: Gift, tourId: "partner" },
  { to: "/profile", label: "פרופיל", icon: UserCircle, tourId: "profile" },
];
