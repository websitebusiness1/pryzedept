import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { RequireMember, RequireOwner } from '@/auth/guards';
import { PageLoader } from '@/components/ui';
import FeatureGate from '@/components/FeatureGate';
import OwnerLayout from '@/layouts/OwnerLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';

const OwnerOverview = lazy(() => import('@/pages/owner/OwnerOverview'));
const OwnerStores = lazy(() => import('@/pages/owner/OwnerStores'));
const OwnerStoreNew = lazy(() => import('@/pages/owner/OwnerStoreNew'));
const OwnerStoreDetail = lazy(() => import('@/pages/owner/OwnerStoreDetail'));
const OwnerMembers = lazy(() => import('@/pages/owner/OwnerMembers'));
const OwnerPackages = lazy(() => import('@/pages/owner/OwnerPackages'));
const DashboardOverview = lazy(() => import('@/pages/dashboard/DashboardOverview'));
const Products = lazy(() => import('@/pages/dashboard/Products'));
const ProductEditor = lazy(() => import('@/pages/dashboard/ProductEditor'));
const Inventory = lazy(() => import('@/pages/dashboard/Inventory'));
const Orders = lazy(() => import('@/pages/dashboard/Orders'));
const OrderDetail = lazy(() => import('@/pages/dashboard/OrderDetail'));
const StoreSettings = lazy(() => import('@/pages/dashboard/StoreSettings'));
const Homepage = lazy(() => import('@/pages/dashboard/Homepage'));
const Lookbooks = lazy(() => import('@/pages/dashboard/Lookbooks'));
const LookbookEditor = lazy(() => import('@/pages/dashboard/LookbookEditor'));
const Videos = lazy(() => import('@/pages/dashboard/Videos'));
const VideoEditor = lazy(() => import('@/pages/dashboard/VideoEditor'));
const Media = lazy(() => import('@/pages/dashboard/Media'));
const Appearance = lazy(() => import('@/pages/dashboard/Appearance'));
const Preview = lazy(() => import('@/pages/dashboard/Preview'));

function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-4xl">Page not found</h1>
      <p className="mt-3 text-sm text-sand-500">That address doesn’t lead anywhere.</p>
      <Link to="/" className="btn-outline mt-6 self-start">Back to home</Link>
    </div>
  );
}

function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToHash />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          <Route path="/owner" element={<RequireOwner><OwnerLayout /></RequireOwner>}>
            <Route index element={<OwnerOverview />} />
            <Route path="stores" element={<OwnerStores />} />
            <Route path="stores/new" element={<OwnerStoreNew />} />
            <Route path="stores/:id" element={<OwnerStoreDetail />} />
            <Route path="members" element={<OwnerMembers />} />
            <Route path="packages" element={<OwnerPackages />} />
          </Route>

          <Route path="/dashboard" element={<RequireMember><DashboardLayout /></RequireMember>}>
            <Route index element={<DashboardOverview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductEditor mode="new" />} />
            <Route path="products/:id" element={<ProductEditor mode="edit" />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="homepage" element={<Homepage />} />
            <Route path="lookbooks" element={<FeatureGate feature="lookbooks" title="Lookbooks"><Lookbooks /></FeatureGate>} />
            <Route path="lookbooks/new" element={<FeatureGate feature="lookbooks" title="Lookbooks"><LookbookEditor mode="new" /></FeatureGate>} />
            <Route path="lookbooks/:id" element={<FeatureGate feature="lookbooks" title="Lookbooks"><LookbookEditor mode="edit" /></FeatureGate>} />
            <Route path="videos" element={<FeatureGate feature="videos" title="Videos"><Videos /></FeatureGate>} />
            <Route path="videos/new" element={<FeatureGate feature="videos" title="Videos"><VideoEditor mode="new" /></FeatureGate>} />
            <Route path="videos/:id" element={<FeatureGate feature="videos" title="Videos"><VideoEditor mode="edit" /></FeatureGate>} />
            <Route path="media" element={<FeatureGate feature="media_library" title="Media library"><Media /></FeatureGate>} />
            <Route path="appearance" element={<FeatureGate feature="custom_fonts" title="Fonts"><Appearance /></FeatureGate>} />
            <Route path="preview" element={<Preview />} />
            <Route path="store-settings" element={<StoreSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
