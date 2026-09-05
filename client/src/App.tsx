import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { AllBytesStub, Home, PublicPostDetail, ReaderAuth } from "./public/ReaderPages";
import { AdminDashboard, AdminLogin, NewPostPlaceholder } from "./admin/AdminPages";
import { NewPostPage, PreviewPage } from "./admin/NewPostPage";
function Router() { return <Switch><Route path="/" component={Home} /><Route path="/all-bytes" component={AllBytesStub} /><Route path="/bytes/:id" component={PublicPostDetail} /><Route path="/login"><ReaderAuth mode="login" /></Route><Route path="/signup"><ReaderAuth mode="signup" /></Route><Route path="/forgot-password"><ReaderAuth mode="forgot" /></Route><Route path="/reset-password"><ReaderAuth mode="reset" /></Route><Route path="/verify-email"><ReaderAuth mode="verify" /></Route><Route path="/newsroom-7x" component={AdminLogin} /><Route path="/admin/new/:draftId" component={NewPostPage} /><Route path="/admin/new" component={NewPostPage} /><Route path="/admin/preview/:draftId" component={PreviewPage} /><Route path="/admin" component={AdminDashboard} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
