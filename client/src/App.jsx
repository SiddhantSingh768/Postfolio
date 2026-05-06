import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary }   from './components/ui/ErrorBoundary';
import { PrivateRoute }    from './routes/PrivateRoute';

// Auth pages
import { Login }          from './pages/auth/Login';
import { Register }       from './pages/auth/Register';
import { VerifyEmail }    from './pages/auth/VerifyEmail';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword }  from './pages/auth/ResetPassword';

// App pages
import { DashboardHome }  from './pages/dashboard/DashboardHome';
import { ClientList }     from './pages/clients/ClientList';
import { ClientDetail }   from './pages/clients/ClientDetail';
import { ProjectList }    from './pages/projects/ProjectList';
import { ProjectDetail }  from './pages/projects/ProjectDetail';
import { InvoiceList }    from './pages/invoices/InvoiceList';
import { InvoiceCreate }  from './pages/invoices/InvoiceCreate';
import { InvoiceDetail }  from './pages/invoices/InvoiceDetail';
import { PortalView }     from './pages/portal/PortalView';
import { Settings }       from './pages/settings/Settings';

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login"           element={<Login />} />
        <Route path="/register"        element={<Register />} />
        <Route path="/verify-email"    element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/auth/callback"   element={<Login />} />

        {/* Portal — public, no auth needed */}
        <Route path="/portal/:projectId" element={<PortalView />} />

        {/* Protected app routes */}
        <Route path="/dashboard"
          element={<PrivateRoute><DashboardHome /></PrivateRoute>}
        />
        <Route path="/clients"
          element={<PrivateRoute><ClientList /></PrivateRoute>}
        />
        <Route path="/clients/:id"
          element={<PrivateRoute><ClientDetail /></PrivateRoute>}
        />
        <Route path="/projects"
          element={<PrivateRoute><ProjectList /></PrivateRoute>}
        />
        <Route path="/projects/:id"
          element={<PrivateRoute><ProjectDetail /></PrivateRoute>}
        />
        <Route path="/invoices"
          element={<PrivateRoute><InvoiceList /></PrivateRoute>}
        />
        <Route path="/invoices/new"
          element={<PrivateRoute><InvoiceCreate /></PrivateRoute>}
        />
        <Route path="/invoices/:id"
          element={<PrivateRoute><InvoiceDetail /></PrivateRoute>}
        />
        <Route path="/settings"
          element={<PrivateRoute><Settings /></PrivateRoute>}
        />

        {/* Default redirect */}
        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;