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
const Service = lazy(() => import("@/pages/client/Service"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const TaskBoard = lazy(() => import("@/pages/admin/TaskBoard"));
const Discovery = lazy(() => import("@/pages/admin/Discovery"));
const DiscoverySessionPage = lazy(() => import("@/pages/admin/DiscoverySession"));
const Clients = lazy(() => import("@/pages/admin/Clients"));
const ClientDetail = lazy(() => import("@/pages/admin/ClientDetail"));
const Projects = lazy(() => import("@/pages/admin/Projects"));
const Partners = lazy(() => import("@/pages/admin/Partners"));
const PartnerDetail = lazy(() => import("@/pages/admin/PartnerDetail"));
const Referrals = lazy(() => import("@/pages/admin/Referrals"));
const Leads = lazy(() => import("@/pages/admin/Leads"));
const Feedback = lazy(() => import("@/pages/admin/Feedback"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const Announcements = lazy(() => import("@/pages/admin/Announcements"));
const Analytics = lazy(() => import("@/pages/admin/Analytics"));
const TimeReports = lazy(() => import("@/pages/admin/TimeReports"));
const ProjectDetail = lazy(() => import("@/pages/shared/ProjectDetail"));
const ProjectGuide = lazy(() => import("@/pages/shared/ProjectGuide"));
const RefLanding = lazy(() => import("@/pages/public/RefLanding"));
const DiscoverySummary = lazy(() => import("@/pages/public/DiscoverySummary"));
const PartnerDashboard = lazy(() => import("@/pages/partner/PartnerDashboard"));
const NewLead = lazy(() => import("@/pages/partner/NewLead"));
const PartnerResources = lazy(() => import("@/pages/partner/Resources"));
// DEV-ONLY visual harnesses. The ternary is statically false in a production
// build, so Rollup drops the imports — the chunks never ship.
const TimerLab = import.meta.env.DEV ? lazy(() => import("@/pages/dev/TimerLab")) : null;
const ReportsLab = import.meta.env.DEV ? lazy(() => import("@/pages/dev/ReportsLab")) : null;
const ProjectsLab = import.meta.env.DEV ? lazy(() => import("@/pages/dev/ProjectsLab")) : null;
const ServiceLab = import.meta.env.DEV ? lazy(() => import("@/pages/dev/ServiceLab")) : null;
const ServiceClientLab = import.meta.env.DEV ? lazy(() => import("@/pages/dev/ServiceClientLab")) : null;

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
                <Route path="/projects/:id/guide" element={<ProjectGuide />} />

                {/* Client-only - dashboard lives at the root slug */}
                <Route element={<RequireClient />}>
                  <Route index element={<ClientDashboard />} />
                  <Route path="/service" element={<Service />} />
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
                  <Route path="/admin/tasks" element={<TaskBoard />} />
                  <Route path="/admin/discovery" element={<Discovery />} />
                  <Route path="/admin/discovery/:id" element={<DiscoverySessionPage />} />
                  <Route path="/admin/clients" element={<Clients />} />
                  <Route path="/admin/clients/:id" element={<ClientDetail />} />
                  <Route path="/admin/projects" element={<Projects />} />
                  <Route path="/admin/partners" element={<Partners />} />
                  <Route path="/admin/partners/:id" element={<PartnerDetail />} />
                  <Route path="/admin/referrals" element={<Referrals />} />
                  <Route path="/admin/leads" element={<Leads />} />
                  <Route path="/admin/feedback" element={<Feedback />} />
                  <Route path="/admin/announcements" element={<Announcements />} />
                  <Route path="/admin/settings" element={<Settings />} />
                  <Route path="/admin/analytics" element={<Analytics />} />
                  <Route path="/admin/time" element={<TimeReports />} />
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

            {/* Public discovery-call summary (no auth, token-gated) */}
            <Route
              path="/discovery/:token"
              element={
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                  <DiscoverySummary />
                </Suspense>
              }
            />

            {/* DEV-ONLY: timer visual harness, no auth. Stripped from prod builds. */}
            {import.meta.env.DEV && TimerLab && (
              <Route
                path="/__timerlab"
                element={
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <TimerLab />
                  </Suspense>
                }
              />
            )}
            {import.meta.env.DEV && ReportsLab && (
              <Route
                path="/__reportslab"
                element={
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <ReportsLab />
                  </Suspense>
                }
              />
            )}
            {import.meta.env.DEV && ProjectsLab && (
              <Route
                path="/__projectslab"
                element={
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <ProjectsLab />
                  </Suspense>
                }
              />
            )}
            {import.meta.env.DEV && ServiceLab && (
              <Route
                path="/__servicelab"
                element={
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <ServiceLab />
                  </Suspense>
                }
              />
            )}
            {import.meta.env.DEV && ServiceClientLab && (
              <Route
                path="/__serviceclient"
                element={
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <ServiceClientLab />
                  </Suspense>
                }
              />
            )}

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
