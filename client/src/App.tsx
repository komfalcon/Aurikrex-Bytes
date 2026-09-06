import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { Archive, Contact, HelpCenter, Home, HowItWorks, PostDetail, ReaderAuth, SupportPage } from "./public/ReaderPages";
import { AdminDashboard, AdminLogin } from "./admin/AdminPages";
import { NewPostPage, PreviewPage } from "./admin/NewPostPage";
import { TeamManagement, AnalyticsDashboard } from "./admin/AdminManagement";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/archive" component={Archive} /><Route path="/post/:id" component={PostDetail} /><Route path="/how-it-works" component={HowItWorks} /><Route path="/help" component={HelpCenter} /><Route path="/contact" component={Contact} /><Route path="/privacy" component={() => <SupportPage kind="/privacy" />} /><Route path="/terms" component={() => <SupportPage kind="/terms" />} /><Route path="/login"><ReaderAuth mode="login" /></Route><Route path="/signup"><ReaderAuth mode="signup" /></Route><Route path="/forgot-password"><ReaderAuth mode="forgot" /></Route><Route path="/reset-password"><ReaderAuth mode="reset" /></Route><Route path="/verify-email"><ReaderAuth mode="verify" /></Route><Route path="/newsroom-7x" component={AdminLogin} /><Route path="/admin" component={AdminDashboard} /><Route path="/admin/new" component={NewPostPage} /><Route path="/admin/new/:id" component={NewPostPage} /><Route path="/admin/preview/:draftId" component={PreviewPage} /><Route path="/admin/team" component={TeamManagement} /><Route path="/admin/analytics" component={AnalyticsDashboard} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Router /><PWAInstallPrompt /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
