import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import Seo from "./components/Seo";
import { Archive, Contact, HelpCenter, Home, HowItWorks, PostDetail, ReaderAuth, SupportPage } from "./public/ReaderPages";

const AdminDashboard = React.lazy(() => import("./admin/AdminPages").then(m => ({ default: m.AdminDashboard })));
const AdminLogin = React.lazy(() => import("./admin/AdminPages").then(m => ({ default: m.AdminLogin })));
const NewPostPage = React.lazy(() => import("./admin/NewPostPage").then(m => ({ default: m.NewPostPage })));
const PreviewPage = React.lazy(() => import("./admin/NewPostPage").then(m => ({ default: m.PreviewPage })));
const TeamManagement = React.lazy(() => import("./admin/AdminManagement").then(m => ({ default: m.TeamManagement })));
const AnalyticsDashboard = React.lazy(() => import("./admin/AdminManagement").then(m => ({ default: m.AnalyticsDashboard })));

 function Router() { return <Switch><Route path="/" component={Home} /><Route path="/archive" component={Archive} /><Route path="/post/:id" component={PostDetail} /><Route path="/how-it-works" component={HowItWorks} /><Route path="/help" component={HelpCenter} /><Route path="/contact" component={Contact} /><Route path="/privacy" component={() => <SupportPage kind="/privacy" />} /><Route path="/terms" component={() => <SupportPage kind="/terms" />} /><Route path="/login"><ReaderAuth mode="login" /></Route><Route path="/signup"><ReaderAuth mode="signup" /></Route><Route path="/forgot-password"><ReaderAuth mode="forgot" /></Route><Route path="/reset-password"><ReaderAuth mode="reset" /></Route><Route path="/verify-email"><ReaderAuth mode="verify" /></Route><Route path="/falcon-system-auth" component={() => <Suspense fallback={<div className="route-loading">Loading...</div>}><Seo title="Newsroom access – Aurikrex Bytes" description="Private Aurikrex Bytes newsroom access." path="/falcon-system-auth" robots="noindex,nofollow" /><AdminLogin /></Suspense>} /><Route path="/admin" component={() => <Suspense fallback={<div className="route-loading">Loading...</div>}><Seo title="Newsroom – Aurikrex Bytes" description="Private Aurikrex Bytes newsroom." path="/admin" robots="noindex,nofollow" /><AdminDashboard /></Suspense>} /><Route path="/admin/new" component={() => <Suspense fallback={<div className="route-loading">Loading...</div>}><NewPostPage /></Suspense>} /><Route path="/admin/new/:id" component={() => <Suspense fallback={<div className="route-loading">Loading...</div>}><NewPostPage /></Suspense>} /><Route path="/admin/preview/:draftId" component={() => <Suspense fallback={<div className="route-loading">Loading...</div>}><PreviewPage /></Suspense>} /><Route path="/admin/team" component={() => <Suspense fallback={<div className="route-loading">Loading...</div>}><TeamManagement /></Suspense>} /><Route path="/admin/analytics" component={() => <Suspense fallback={<div className="route-loading">Loading...</div>}><AnalyticsDashboard /></Suspense>} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Suspense fallback={<div className="route-loading">Loading...</div>}><Router /></Suspense><PWAInstallPrompt /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
