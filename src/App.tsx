import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { ServiceWorkerUpdate } from "@/components/ServiceWorkerUpdate";
import { DebugFlagsBadge } from "@/components/DebugFlagsBadge";
import { FEATURES } from "@/lib/featureFlags";
import { lazyNamed } from "@/lib/lazyNamed";
import { Onboarding } from "./pages/Onboarding";
import { NotFound } from "./pages/NotFound";
import { AdminRoute } from "@/components/routes/AdminRoute";
import { ProtectedRoute } from "@/components/routes/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import { ScrollToTop } from "@/components/ScrollToTop";

const Forbidden = lazyNamed(() => import("./pages/Forbidden"), "default");
const Auth = lazyNamed(() => import("./pages/Auth"), "default");
const BrandRedirect = lazyNamed(() => import("./components/routes/BrandRedirect"), "BrandRedirect");

// Lazy load heavy routes
const Home = lazyNamed(() => import("./pages/Home"), "Home");
const Search = lazyNamed(() => import("./pages/Search"), "default");
const Discover = lazyNamed(() => import("./pages/Discover"), "default");
// V1 Consumer Contract - simplified pages
const BrandProfile = lazyNamed(() => import("./pages/BrandProfileV1"), "default");
const BrandProof = lazyNamed(() => import("./pages/BrandProof"), "default");
const Scan = lazyNamed(() => import("./pages/Scan"), "Scan");
const ScanResult = lazyNamed(() => import("./pages/ScanResultV1"), "default");
const Trending = lazyNamed(() => import("./pages/Trending"), "Trending");
const Lists = lazyNamed(() => import("./pages/Lists"), "Lists");
const Settings = lazyNamed(() => import("./pages/Settings"), "Settings");
const AdminReview = lazyNamed(() => import("./pages/AdminReview"), "AdminReview");
const AdminClaims = lazyNamed(() => import("./pages/AdminClaims"), "default");
const AdminHealth = lazyNamed(() => import("./pages/AdminHealth"), "default");
const AdminEvidence = lazyNamed(() => import("./pages/AdminEvidence"), "default");
const AdminTriggers = lazyNamed(() => import("./pages/AdminTriggers"), "AdminTriggers");
const AdminIngestion = lazyNamed(() => import("./pages/AdminIngestion"), "AdminIngestion");
const AdminNewsTest = lazyNamed(() => import("./pages/AdminNewsTest"), "default");
const AdminEvents = lazyNamed(() => import("./pages/AdminEvents"), "default");
const AdminDashboard = lazyNamed(() => import("./pages/AdminDashboard"), "default");
const AdminCategoryTester = lazyNamed(() => import("./pages/AdminCategoryTester"), "default");
const AdminTestScorer = lazyNamed(() => import("./pages/AdminTestScorer"), "default");
const AdminOpsHealth = lazyNamed(() => import("./pages/AdminOpsHealth"), "default");
const AdminIngestionHealth = lazyNamed(() => import("./pages/AdminIngestionHealth"), "default");
const AdminRSSMonitor = lazyNamed(() => import("./pages/AdminRSSMonitor"), "default");
const AdminEnrichmentMonitor = lazyNamed(() => import("./pages/AdminEnrichmentMonitor"), "default");
const AdminCommunityRatings = lazyNamed(() => import("./pages/AdminCommunityRatings"), "default");
const AdminBatchEnrich = lazyNamed(() => import("./pages/AdminBatchEnrich"), "default");
const AdminBulkEnrichFortune500 = lazyNamed(() => import("./pages/AdminBulkEnrichFortune500"), "default");
const AdminSeeding = lazyNamed(() => import("./pages/AdminSeeding"), "default");
const AdminUsers = lazyNamed(() => import("./pages/AdminUsers"), "default");
const AdminTest = lazyNamed(() => import("./pages/AdminTest"), "default");
const Feed = lazyNamed(() => import("./pages/Feed"), "default");
const BootstrapAdmin = lazyNamed(() => import("./pages/BootstrapAdmin"), "default");
const Privacy = lazyNamed(() => import("./pages/Privacy"), "default");
const Terms = lazyNamed(() => import("./pages/Terms"), "default");
const Methodology = lazyNamed(() => import("./pages/Methodology"), "default");
const InvestorProfile = lazyNamed(() => import("./pages/InvestorProfile"), "default");
const PersonProfile = lazyNamed(() => import("./pages/PersonProfile"), "default");

const queryClient = new QueryClient();

const HeaderWrapper = () => {
  const location = useLocation();
  if (location.pathname === "/onboarding") return null;
  return <Header />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OfflineIndicator />
        <ServiceWorkerUpdate />
        <DebugFlagsBadge flags={FEATURES} />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <HeaderWrapper />
          <Routes>
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute requireOnboarding={false}>
                <Onboarding />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/auth"
            element={
              <Suspense fallback={<RouteFallback label="Loading…" />}>
                <Auth />
              </Suspense>
            } 
          />
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
            path="/discover"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteFallback label="Loading discover…" />}>
                  <Discover />
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
                    <BrandProfile />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          {/* Canonical brand profile route */}
          <Route
            path="/brand/:id"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading brand profile…" />}>
                    <BrandProfile />
                  </Suspense>
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />
          {/* Redirect /brands/:id to /brand/:id - canonical route */}
          <Route
            path="/brands/:id"
            element={
              <Suspense fallback={<RouteFallback label="Redirecting…" />}>
                <BrandRedirect />
              </Suspense>
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
            path="/scan-result"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteFallback label="Loading…" />}>
                  <ScanResult />
                </Suspense>
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
            path="/feed"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback label="Loading feed…" />}>
                    <Feed />
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
            path="/admin/health"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading system health…" />}>
                      <AdminHealth />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/evidence/new"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading evidence form…" />}>
                      <AdminEvidence />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/triggers"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading triggers…" />}>
                      <AdminTriggers />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rss-monitor"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading RSS monitor…" />}>
                      <AdminRSSMonitor />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/enrichment"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading enrichment monitor…" />}>
                      <AdminEnrichmentMonitor />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/community-ratings"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading community ratings…" />}>
                      <AdminCommunityRatings />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/batch-enrich"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading batch enrichment…" />}>
                      <AdminBatchEnrich />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/fortune-500-enrich"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading Fortune 500 enrichment…" />}>
                      <AdminBulkEnrichFortune500 />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading users…" />}>
                      <AdminUsers />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/seeding"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading seeding…" />}>
                      <AdminSeeding />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ingestion"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading ingestion control…" />}>
                      <AdminIngestion />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/news-test"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading news test…" />}>
                      <AdminNewsTest />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading event management…" />}>
                      <AdminEvents />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading admin dashboard…" />}>
                      <AdminDashboard />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/category-tester"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading category tester…" />}>
                      <AdminCategoryTester />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/test-scorer"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading scorer test…" />}>
                      <AdminTestScorer />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ops-health"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading ops health…" />}>
                      <AdminOpsHealth />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ingestion-health"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading ingestion health…" />}>
                      <AdminIngestionHealth />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/test"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback label="Loading function tester…" />}>
                      <AdminTest />
                    </Suspense>
                  </RouteErrorBoundary>
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bootstrap-admin"
            element={
              <Suspense fallback={<RouteFallback label="Loading…" />}>
                <BootstrapAdmin />
              </Suspense>
            }
          />
          <Route
            path="/forbidden"
            element={
              <Suspense fallback={<RouteFallback label="Loading…" />}>
                <Forbidden />
              </Suspense>
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
          <Route
            path="/privacy"
            element={
              <Suspense fallback={<RouteFallback label="Loading…" />}>
                <Privacy />
              </Suspense>
            }
          />
          <Route
            path="/terms"
            element={
              <Suspense fallback={<RouteFallback label="Loading…" />}>
                <Terms />
              </Suspense>
            }
          />
          <Route
            path="/methodology"
            element={
              <Suspense fallback={<RouteFallback label="Loading…" />}>
                <Methodology />
              </Suspense>
            }
          />
          <Route
            path="/investor/:id"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteFallback label="Loading investor…" />}>
                  <InvestorProfile />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/person/:id"
            element={
              <ProtectedRoute>
                <Suspense fallback={<RouteFallback label="Loading person…" />}>
                  <PersonProfile />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
