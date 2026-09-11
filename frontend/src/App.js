import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Issue from "./pages/Issue";
import Verify from "./pages/Verify";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Certificates from "./pages/Certificates";
import CertificateDetails from "./pages/CertificateDetails";
import NotFound from "./pages/NotFound";
import { AuthenticatedLayout, PublicHeader } from "./components/Layout";

function isLoggedIn() {
  return !!localStorage.getItem("certchain_token");
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function VerifyRoute() {
  return isLoggedIn() ? <AuthenticatedLayout><Verify /></AuthenticatedLayout> : <><PublicHeader /><Verify /></>;
}

function PublicCertificateRoute() {
  return <><PublicHeader /><Verify /></>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-shell">
      <Routes>
        <Route path="/" element={<><PublicHeader /><Home /></>} />
        <Route path="/login" element={<><PublicHeader /><Login /></>} />
        <Route path="/signup" element={<><PublicHeader /><Signup /></>} />
        <Route path="/forgot-password" element={<><PublicHeader /><ForgotPassword /></>} />
        <Route path="/reset-password" element={<><PublicHeader /><ResetPassword /></>} />
        <Route path="/verify" element={<VerifyRoute />} />
        <Route path="/verify/:certificateId" element={<PublicCertificateRoute />} />
        <Route path="/dashboard" element={<PrivateRoute><AuthenticatedLayout><Dashboard /></AuthenticatedLayout></PrivateRoute>} />
        <Route path="/certificates" element={<PrivateRoute><AuthenticatedLayout><Certificates /></AuthenticatedLayout></PrivateRoute>} />
        <Route path="/certificates/:certId" element={<PrivateRoute><AuthenticatedLayout><CertificateDetails /></AuthenticatedLayout></PrivateRoute>} />
        <Route
          path="/issue"
          element={
            <PrivateRoute>
              <AuthenticatedLayout><Issue /></AuthenticatedLayout>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<><PublicHeader /><NotFound /></>} />
      </Routes>
      </div>
    </BrowserRouter>
  );
}
