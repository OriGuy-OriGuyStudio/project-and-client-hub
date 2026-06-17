import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
// import { AIWidget } from "@/components/ai-widget/AIWidget"; // hidden until the Pixel chat product is polished
import { AppShell } from "@/components/layout/AppShell";
import { PostLoginLoader } from "@/components/layout/PostLoginLoader";
import {
  RequireAdmin,
  RequireAuth,
  RequireClient,
  RequirePartner,
  RequireDenied,
  RedirectIfAuthed,
} from "@/components/auth/guards";

// Public/login screens stay eager — they're the app entry and small.
import Login from "@/pages/auth/Login";
import AdminLogin from "@/pages/auth/AdminLogin";
import PartnerLogin from "@/pages/auth/PartnerLogin";
import AccessDenied from "@/pages/auth/AccessDenied";

// Everything behind auth is code-split (loaded on demand via the AppShell
// Suspense boundary), keeping the initial login bundle lean.
const ClientDashboard = lazy(() => import("@/pages/client/Dashboard"));
const Profile = lazy(() => import("@/pages/client/Profile"));
const Partner = lazy(() => import("@/pages/client/Partner"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Clients = lazy(() => import("@/pages/admin/Clients"));
const ClientDetail = lazy(() => import("@/pages/admin/ClientDetail"));
const Projects = lazy(() => import("@/pages/admin/Projects"));
const Partners = lazy(() => import("@/pages/admin/Partners"));
const PartnerDetail = lazy(() => import("@/pages/admin/PartnerDetail"));
const Referrals = lazy(() => import("@/pages/admin/Referrals"));
const Feedback = lazy(() => import("@/pages/admin/Feedback"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const Announcements = lazy(() => import("@/pages/admin/Announcements"));
const Analytics = lazy(() => import("@/pages/admin/Analytics"));
const ProjectDetail = lazy(() => import("@/pages/shared/ProjectDetail"));
const RefLanding = lazy(() => import("@/pages/public/RefLanding"));
const PartnerDashboard = lazy(() => import("@/pages/partner/PartnerDashboard"));
const NewLead = lazy(() => import("@/pages/partner/NewLead"));
const PartnerResources = lazy(() => import("@/pages/partner/Resources"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            {/* Public auth routes */}
            <Route element={<RedirectIfAuthed />}>
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/partner-portal/login" element={<PartnerLogin />} />
            </Route>
            <Route element={<RequireDenied />}>
              <Route path="/access-denied" element={<AccessDenied />} />
            </Route>

            {/* Authenticated app frame */}
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                {/* Shared (admin + client) */}
                <Route path="/projects/:id" element={<ProjectDetail />} />

                {/* Client-only - dashboard lives at the root slug */}
                <Route element={<RequireClient />}>
                  <Route index element={<ClientDashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/partner" element={<Partner />} />
                </Route>

                {/* Partner-only (שת"פ) */}
                <Route element={<RequirePartner />}>
                  <Route path="/partner-portal" element={<PartnerDashboard />} />
                  <Route path="/partner-portal/new-lead" element={<NewLead />} />
                  <Route path="/partner-portal/resources" element={<PartnerResources />} />
                </Route>

                {/* Admin-only */}
                <Route element={<RequireAdmin />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/clients" element={<Clients />} />
                  <Route path="/admin/clients/:id" element={<ClientDetail />} />
                  <Route path="/admin/projects" element={<Projects />} />
                  <Route path="/admin/partners" element={<Partners />} />
                  <Route path="/admin/partners/:id" element={<PartnerDetail />} />
                  <Route path="/admin/referrals" element={<Referrals />} />
                  <Route path="/admin/feedback" element={<Feedback />} />
                  <Route path="/admin/announcements" element={<Announcements />} />
                  <Route path="/admin/settings" element={<Settings />} />
                  <Route path="/admin/analytics" element={<Analytics />} />
                </Route>
              </Route>
            </Route>

            {/* Public partner-referral landing (no auth) */}
            <Route
              path="/ref/:code"
              element={
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                  <RefLanding />
                </Suspense>
              }
            />

            {/* Unknown paths: send home (guards resolve role from there) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster />
          {/* Pixel floating chat temporarily removed until the product is polished.
              Restore by un-commenting the import above and this mount. */}
          {/* <AIWidget /> */}
          {/* Number/bar loader, shown once right after a successful sign-in */}
          <PostLoginLoader />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
