import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { LandingPage } from "./components/LandingPage";
import { FichajeApp } from "./components/fichaje/FichajeApp";
import { LoginPage } from "./components/admin/LoginPage";
import { AdminLayout } from "./components/admin/AdminLayout";
import { DashboardPage } from "./components/admin/DashboardPage";
import { EmpleadosPage } from "./components/admin/EmpleadosPage";
import { RegistrosPage } from "./components/admin/RegistrosPage";
import { ReportesPage } from "./components/admin/ReportesPage";
import { ConfiguracionPage } from "./components/admin/ConfiguracionPage";
import { AlertasPage } from "./components/admin/AlertasPage";
import { SuscripcionPage } from "./components/admin/SuscripcionPage";
import { RegistroPage } from "./pages/RegistroPage";
import { VerificacionEmailPage } from "./pages/VerificacionEmailPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PrivacidadPage } from "./pages/PrivacidadPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: LandingPage },
      { path: "fichaje", Component: FichajeApp },
      { path: "registro", Component: RegistroPage },
      { path: "verificacion-email", Component: VerificacionEmailPage },
      { path: "onboarding", Component: OnboardingPage },
      { path: "privacidad", Component: PrivacidadPage },
      { path: "admin/login", Component: LoginPage },
      { path: "admin/signup", Component: RegistroPage },
      {
        path: "admin",
        Component: AdminLayout,
        children: [
          { index: true, Component: DashboardPage },
          { path: "empleados", Component: EmpleadosPage },
          { path: "registros", Component: RegistrosPage },
          { path: "reportes", Component: ReportesPage },
          { path: "configuracion", Component: ConfiguracionPage },
          { path: "alertas", Component: AlertasPage },
          { path: "suscripcion", Component: SuscripcionPage },
        ],
      },
    ],
  },
]);
