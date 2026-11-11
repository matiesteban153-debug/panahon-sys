import { Outlet } from "react-router";
import { AuthProvider } from "../lib/auth-context";
import { PWAIconInjector } from "./PWAIconInjector";

export function RootLayout() {
  return (
    <AuthProvider>
      <PWAIconInjector />
      <Outlet />
    </AuthProvider>
  );
}