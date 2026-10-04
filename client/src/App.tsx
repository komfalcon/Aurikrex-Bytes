import React, { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import Seo from "./components/Seo";
import { Archive, Contact, HelpCenter, Home, HowItWorks, PostDetail, ReaderAuth, ReaderDashboard, SavedPosts, SupportPage } from "./public/ReaderPages";
import MaintenancePage from "./public/MaintenancePage";
import SsoCallbackPage from "./pages/SsoCallbackPage";
import { trpc } from "./lib/trpc";

const AdminDashboard = React.lazy(() => import("./admin/AdminPages").then(m => ({ default: m.AdminDashboard })));
const AdminLogin = React.lazy(() => import("./admin/AdminPages").then(m => ({ default: m.AdminLogin })));
const NewPostPage = React.lazy(() => import("./admin/NewPostPage").then(m => ({ default: m.NewPostPage })));
const PreviewPage = React.lazy(() => import("./admin/NewPostPage").then(m => ({ default: m.PreviewPage })));
const TeamManagement = React.lazy(() => import("./admin/AdminManagement").then(m => ({ default: m.TeamManagement })));
const AnalyticsDashboard = React.lazy(() => import("./admin/AdminManagement").then(m => ({ default: m.AnalyticsDashboard })));

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return <ScrollToTopButton />;
}

function Router() {
  const [location] = useLocation();
  const isAdminPath = location.startsWith("/admin") || location.startsWith("/falcon-system-auth");
  const maintenanceQuery = trpc.system.maintenanceStatus.useQuery(undefined, {
    refetchInterval: 30000,
  });

  if (maintenanceQuery.data?.maintenance && !isAdminPath) {
    return <MaintenancePage />;
  }

  return <Switch>
    <Route path="/dashboard" component={ReaderDashboard} />
    <Route path="/saved" component={SavedPosts} />
    <Route path="/" component={Home} />
    <Route path="/archive" component={Archive} />
    <Route path="/post/:id" component={PostDetail} />
    <Route path="/how-it-works" component={HowItWorks} />
    <Route path="/help" component={HelpCenter} />
    <Route path="/contact" component={Contact} />
    <Route path="/privacy">{() => <SupportPage kind="/privacy" />}</Route>
    <Route path="/terms">{() => <SupportPage kind="/terms" />}</Route>
    <Route path="/login"><ReaderAuth mode="login" /></Route>
    <Route path="/sso/callback" component={SsoCallbackPage} />
    <Route path="/sso/login">{() => { window.location.href = "https://cbt.aurikrex.com/api/v1/auth/sso/authorize?client_id=aurikrex_bytes&redirect_uri=" + encodeURIComponent(window.location.origin + "/sso/callback"); return null; }}</Route>
    <Route path="/signup"><ReaderAuth mode="signup" /></Route>
    <Route path="/forgot-password"><ReaderAuth mode="forgot" /></Route>
    <Route path="/reset-password"><ReaderAuth mode="reset" /></Route>
    <Route path="/verify-email"><ReaderAuth mode="verify" /></Route>
    <Route path="/falcon-system-auth">{() => <Suspense fallback={<div className="route-loading">Loading...</div>}><Seo title="Newsroom access – Aurikrex Bytes" description="Private Aurikrex Bytes newsroom access." path="/falcon-system-auth" robots="noindex,nofollow" /><AdminLogin /></Suspense>}</Route>
    <Route path="/admin">{() => <Suspense fallback={<div className="route-loading">Loading...</div>}><Seo title="Newsroom – Aurikrex Bytes" description="Private Aurikrex Bytes newsroom." path="/admin" robots="noindex,nofollow" /><AdminDashboard /></Suspense>}</Route>
    <Route path="/admin/new">{() => <Suspense fallback={<div className="route-loading">Loading...</div>}><NewPostPage /></Suspense>}</Route>
    <Route path="/admin/new/:id">{() => <Suspense fallback={<div className="route-loading">Loading...</div>}><NewPostPage /></Suspense>}</Route>
    <Route path="/admin/preview/:draftId">{() => <Suspense fallback={<div className="route-loading">Loading...</div>}><PreviewPage /></Suspense>}</Route>
    <Route path="/admin/team">{() => <Suspense fallback={<div className="route-loading">Loading...</div>}><TeamManagement /></Suspense>}</Route>
    <Route path="/admin/analytics">{() => <Suspense fallback={<div className="route-loading">Loading...</div>}><AnalyticsDashboard /></Suspense>}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}
export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><ScrollToTop /><Toaster /><Suspense fallback={<div className="route-loading">Loading...</div>}><Router /></Suspense><PWAInstallPrompt /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
