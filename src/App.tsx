import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import MarketingLayout from "./components/MarketingLayout";
import MarketingHome from "./pages/marketing/Home";
import Pricing from "./pages/marketing/Pricing";
import Login from "./pages/marketing/Login";
import Signup from "./pages/marketing/Signup";
import Solution from "./pages/marketing/Solution";

import AppLayout from "./components/AppLayout";
import { RequireRole } from "./components/RequireRole";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import AlertLog from "./pages/AlertLog";
import Tasks from "./pages/Tasks";
import Calls from "./pages/Calls";
import Escalations from "./pages/Escalations";
import Orders from "./pages/Orders";
import Kitchen from "./pages/Kitchen";
import Reservations from "./pages/Reservations";
import MenuPage from "./pages/Menu";
import Knowledge from "./pages/Knowledge";
import VoiceAgent from "./pages/VoiceAgent";
import Integrations from "./pages/Integrations";
import WebsiteChat from "./pages/WebsiteChat";
import PhoneHours from "./pages/settings/PhoneHours";
import Alerts from "./pages/settings/Alerts";
import Team from "./pages/settings/Team";
import RestaurantProfile from "./pages/settings/RestaurantProfile";
import Billing from "./pages/settings/Billing";

import SuperLayout from "./components/SuperLayout";
import SuperOverview from "./pages/super/Overview";
import SuperTenants from "./pages/super/Tenants";
import TenantDetail from "./pages/super/TenantDetail";
import CallQA from "./pages/super/CallQA";
import ScenarioLab from "./pages/super/ScenarioLab";
import SuperBilling from "./pages/super/Billing";
import VoiceAgentAdvanced from "./pages/super/VoiceAgentAdvanced";
import Telephony from "./pages/super/Telephony";
import Audit from "./pages/super/Audit";

import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Marketing */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<MarketingHome />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/solutions/:industrySlug" element={<Solution />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          {/* Admin app */}
          <Route path="/app" element={<RequireRole role="admin"><AppLayout /></RequireRole>}>
            <Route index element={<Dashboard />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="alert-log" element={<AlertLog />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="calls" element={<Calls />} />
            <Route path="escalations" element={<Escalations />} />
            <Route path="orders" element={<Orders />} />
            <Route path="kitchen" element={<Kitchen />} />
            <Route path="reservations" element={<Reservations />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="voice-agent" element={<VoiceAgent />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="website-chat" element={<WebsiteChat />} />
            <Route path="settings" element={<PhoneHours />} />
            <Route path="settings/alerts" element={<Alerts />} />
            <Route path="team" element={<Team />} />
            <Route path="profile" element={<RestaurantProfile />} />
            <Route path="billing" element={<Billing />} />
          </Route>

          {/* Super admin */}
          <Route path="/super" element={<RequireRole role="superadmin"><SuperLayout /></RequireRole>}>
            <Route index element={<SuperOverview />} />
            <Route path="tenants" element={<SuperTenants />} />
            <Route path="tenants/:locationId" element={<TenantDetail />} />
            <Route path="qa" element={<CallQA />} />
            <Route path="scenarios" element={<ScenarioLab />} />
            <Route path="calls" element={<Calls />} />
            <Route path="voice-agent" element={<VoiceAgentAdvanced />} />
            <Route path="telephony" element={<Telephony />} />
            <Route path="billing" element={<SuperBilling />} />
            <Route path="audit" element={<Audit />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
