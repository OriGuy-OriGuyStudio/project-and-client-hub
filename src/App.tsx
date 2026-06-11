import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import { AIWidget } from "@/components/ai-widget/AIWidget";
import { AppShell } from "@/components/layout/AppShell";
import {
  RequireAdmin,
  RequireAuth,
  RequireClient,
  RequirePartner,
  RequireDenied,
  RedirectIfAuthed,
} from "@/components/auth/guards";

import Login from "@/pages/auth/Login";
import AdminLogin from "@/pages/auth/AdminLogin";
import PartnerLogin from "@/pages/auth/PartnerLogin";
import AccessDenied from "@/pages/auth/AccessDenied";
import ClientDashboard from "@/pages/client/Dashboard";
import Profile from "@/pages/client/Profile";
import Partner from "@/pages/client/Partner";
import AdminDashboard from "@/pages/admin/Dashboard";
import Clients from "@/pages/admin/Clients";
import ClientDetail from "@/pages/admin/ClientDetail";
import Projects from "@/pages/admin/Projects";
import Partners from "@/pages/admin/Partners";
import Referrals from "@/pages/admin/Referrals";
import Feedback from "@/pages/admin/Feedback";
import Settings from "@/pages/admin/Settings";
import ProjectDetail from "@/pages/shared/ProjectDetail";
import PartnerDashboard from "@/pages/partner/PartnerDashboard";
import NewLead from "@/pages/partner/NewLead";
import PartnerResources from "@/pages/partner/Resources";

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

                {/* Client-only — dashboard lives at the root slug */}
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
                  <Route path="/admin/referrals" element={<Referrals />} />
                  <Route path="/admin/feedback" element={<Feedback />} />
                  <Route path="/admin/settings" element={<Settings />} />
                </Route>
              </Route>
            </Route>

            {/* Unknown paths: send home (guards resolve role from there) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster />
          {/* Persistent across navigation — outside the router outlet */}
          <AIWidget />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
