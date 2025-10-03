import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ServiceWorkerUpdate } from "@/components/ServiceWorkerUpdate";
import { lazyNamed } from "@/lib/lazyNamed";
import { Onboarding } from "./pages/Onboarding";
import { NotFound } from "./pages/NotFound";

// Lazy load heavy routes
const Home = lazyNamed(() => import("./pages/Home"), "Home");
const Search = lazyNamed(() => import("./pages/Search"), "default");
const BrandDetail = lazyNamed(() => import("./pages/BrandDetail"), "BrandDetail");
const BrandProof = lazyNamed(() => import("./pages/BrandProof"), "default");
const Scan = lazyNamed(() => import("./pages/Scan"), "Scan");
const ScanResult = lazyNamed(() => import("./pages/ScanResult"), "default");
const Trending = lazyNamed(() => import("./pages/Trending"), "Trending");
const Lists = lazyNamed(() => import("./pages/Lists"), "Lists");
const Settings = lazyNamed(() => import("./pages/Settings"), "Settings");
const AdminReview = lazyNamed(() => import("./pages/AdminReview"), "AdminReview");
const AdminClaims = lazyNamed(() => import("./pages/AdminClaims"), "default");

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const onboardingComplete = localStorage.getItem("onboardingComplete");
  
  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <OfflineIndicator />
      <ServiceWorkerUpdate />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteFallback label="Loading home…" />}>
                  <Home />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteFallback label="Loading search…" />}>
                  <Search />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/brand/:brandId"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading brand…" />}>
                    <BrandDetail />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scan"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading scanner…" />}>
                    <Scan />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scan-result/:barcode"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading result…" />}>
                    <ScanResult />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trending"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading trending…" />}>
                    <Trending />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lists"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading lists…" />}>
                    <Lists />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading settings…" />}>
                    <Settings />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading admin review…" />}>
                    <AdminReview />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/claims"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading claims moderation…" />}>
                    <AdminClaims />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/brands/:id/proof"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading proof…" />}>
                    <BrandProof />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
