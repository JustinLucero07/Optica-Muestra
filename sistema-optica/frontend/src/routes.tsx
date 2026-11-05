import { Navigate, Outlet, createBrowserRouter } from "react-router-dom"

import Layout from "@/components/Layout"
import LoginPage from "@/pages/Login"
import { useAuthStore } from "@/store/auth"
import { lazyPage } from "@/lib/lazyPage"

// Cada pantalla se descarga recién cuando se abre (la app inicial pesa mucho menos).
const Dashboard = lazyPage(() => import("@/pages/Dashboard"))
const Pacientes = lazyPage(() => import("@/pages/Pacientes"))
const PacienteDetalle = lazyPage(() => import("@/pages/PacienteDetalle"))
const ConsultaForm = lazyPage(() => import("@/pages/ConsultaForm"))
const Consultas = lazyPage(() => import("@/pages/Consultas"))
const ConsultaDetalle = lazyPage(() => import("@/pages/ConsultaDetalle"))
const Inventario = lazyPage(() => import("@/pages/Inventario"))
const Ventas = lazyPage(() => import("@/pages/Ventas"))
const VentaNueva = lazyPage(() => import("@/pages/VentaNueva"))
const VentaDetalle = lazyPage(() => import("@/pages/VentaDetalle"))
const Cobros = lazyPage(() => import("@/pages/Cobros"))
const Creditos = lazyPage(() => import("@/pages/Creditos"))
const Turnos = lazyPage(() => import("@/pages/Turnos"))
const Ordenes = lazyPage(() => import("@/pages/Ordenes"))
const Reportes = lazyPage(() => import("@/pages/Reportes"))
const Usuarios = lazyPage(() => import("@/pages/Usuarios"))
const Configuracion = lazyPage(() => import("@/pages/Configuracion"))
const SRIImport = lazyPage(() => import("@/pages/SRIImport"))
const Proveedores = lazyPage(() => import("@/pages/Proveedores"))
const Presupuestos = lazyPage(() => import("@/pages/Presupuestos"))
const OrdenesSinVenta = lazyPage(() => import("@/pages/OrdenesSinVenta"))
const CuentasPorCobrar = lazyPage(() => import("@/pages/CuentasPorCobrar"))
const CajaDiariaPage = lazyPage(() => import("@/pages/CajaDiaria"))
const Sueldos = lazyPage(() => import("@/pages/Sueldos"))
const Auditoria = lazyPage(() => import("@/pages/Auditoria"))

function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function RedirectIfAuth() {
  const token = useAuthStore((s) => s.token)
  if (token) return <Navigate to="/" replace />
  return <LoginPage />
}


export const router = createBrowserRouter([
  { path: "/login", element: <RedirectIfAuth /> },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },

          // Pacientes
          { path: "pacientes", element: <Pacientes /> },
          { path: "pacientes/:id", element: <PacienteDetalle /> },

          // Consultas (nueva y editar desde el paciente)
          { path: "pacientes/:pacienteId/consultas/nueva", element: <ConsultaForm /> },
          { path: "pacientes/:pacienteId/consultas/:consultaId/editar", element: <ConsultaForm /> },

          // Consulta detalle (acceso directo)
          { path: "consultas/:id", element: <ConsultaDetalle /> },

          // Inventario y Ventas
          { path: "inventario", element: <Inventario /> },
          { path: "ventas", element: <Ventas /> },
          { path: "ventas/nueva", element: <VentaNueva /> },
          { path: "ventas/:id", element: <VentaDetalle /> },

          // Agenda y Órdenes (Fase 4)
          { path: "turnos", element: <Turnos /> },
          { path: "ordenes", element: <Ordenes /> },

          // Cobros / Tesorería / Créditos
          { path: "caja", element: <CajaDiariaPage /> },
          { path: "cobros", element: <Cobros /> },
          { path: "creditos", element: <Creditos /> },
          // Rutas antiguas → nuevas (marcadores y enlaces guardados siguen funcionando)
          { path: "cxc", element: <Navigate to="/cuentas-por-cobrar" replace /> },
          { path: "cuentas-por-cobrar", element: <CuentasPorCobrar /> },
          { path: "proformas", element: <Navigate to="/ordenes-sin-venta" replace /> },
          { path: "consultas", element: <Consultas /> },
          { path: "ordenes-sin-venta", element: <OrdenesSinVenta /> },
          { path: "presupuestos", element: <Presupuestos /> },
          { path: "reportes", element: <Reportes /> },
          { path: "usuarios", element: <Usuarios /> },
          { path: "configuracion", element: <Configuracion /> },
          { path: "sri-import", element: <SRIImport /> },
          { path: "proveedores", element: <Proveedores /> },
          { path: "sueldos", element: <Sueldos /> },
          { path: "auditoria", element: <Auditoria /> },

          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
])
