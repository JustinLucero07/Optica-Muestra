import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Calendar, PackageCheck, Stethoscope, ClipboardX, HandCoins, Cake, Eye, ChevronRight, Phone,
} from "lucide-react"

import { api } from "@/lib/api"
import { fmtMoney, fmtDate, hoyISO } from "@/lib/format"
import { useAuthStore } from "@/store/auth"
import { useBrandStore } from "@/store/brand"
import { primerNombre } from "@/lib/nombres"

/**
 * Inicio para optometrista, vendedor y cajero: lo que tienen que hacer HOY.
 * No muestra ventas, ganancias ni egresos del negocio (eso es solo del admin).
 */

interface Alertas {
  turnos_hoy: { id: number; paciente_id: number | null; nombres: string; apellidos: string; telefono: string | null; hora_inicio: string; motivo: string }[]
  cumpleanos_proximos: { id: number; nombres: string; apellidos: string; es_hoy: boolean; dias_para: number }[]
  controles_proximos: { paciente_id: number; nombres: string; apellidos: string; proximo_control: string; dias_para: number }[]
}
interface OrdenLista { id: number; numero: string; paciente_id: number; paciente_nombre: string | null; tipo: string }
interface ConsultaItem { id: number; numero: string; paciente_id: number; paciente_nombre: string; motivo_consulta: string | null }

function Panel({ icon: Icon, titulo, to, accion, children, vacio }: {
  icon: typeof Calendar; titulo: string; to?: string; accion?: string; children: React.ReactNode; vacio?: string | false
}) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/30">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {titulo}</h2>
        {to && <Link to={to} className="text-xs text-primary hover:underline flex items-center">{accion ?? "Ver todo"} <ChevronRight className="h-3.5 w-3.5" /></Link>}
      </header>
      <div className="flex-1">
        {vacio ? <p className="px-4 py-8 text-sm text-center text-muted-foreground">{vacio}</p> : children}
      </div>
    </section>
  )
}

function Cifra({ icon: Icon, label, valor, to, tono }: { icon: typeof Calendar; label: string; valor: string | number; to: string; tono: string }) {
  return (
    <Link to={to} className="rounded-2xl border bg-card p-4 flex items-center gap-4 hover:bg-muted/40 transition-colors">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tono}`}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{valor}</p>
      </div>
    </Link>
  )
}

export default function InicioOperativo() {
  const user = useAuthStore(s => s.user)
  const rol = user?.role ?? ""
  const { primaryHex } = useBrandStore()
  const esOptom = rol === "optometrista"
  const veDinero = rol === "vendedor" || rol === "cajero"
  const hoy = hoyISO()

  const { data: alertas } = useQuery<Alertas>({
    queryKey: ["inicio-alertas"],
    queryFn: () => api.get("/reportes/alertas").then(r => r.data),
    refetchInterval: 60_000,
  })
  const { data: listas = [] } = useQuery<OrdenLista[]>({
    queryKey: ["inicio-ordenes-listas"],
    queryFn: () => api.get("/ordenes", { params: { estado: "listo", limit: 50 } }).then(r => r.data),
    refetchInterval: 60_000,
  })
  const { data: consultasHoy = [] } = useQuery<ConsultaItem[]>({
    queryKey: ["inicio-consultas-hoy", hoy],
    queryFn: () => api.get("/consultas", { params: { desde: hoy, hasta: hoy, limit: 50 } }).then(r => r.data),
    enabled: esOptom,
  })
  const { data: sinVenta } = useQuery<{ total: number }>({
    queryKey: ["nav-badge-sin-venta"],
    queryFn: () => api.get("/ordenes/count", { params: { sin_venta: true } }).then(r => r.data),
    enabled: veDinero,
  })
  const { data: cartera } = useQuery<{ resumen: { total_vencido: number } }>({
    queryKey: ["cxc-aging"],
    queryFn: () => api.get("/cxc/aging").then(r => r.data),
    enabled: veDinero,
  })

  const turnos = alertas?.turnos_hoy ?? []
  const cumple = (alertas?.cumpleanos_proximos ?? []).filter(c => c.es_hoy)
  const controles = (alertas?.controles_proximos ?? []).filter(c => c.dias_para <= 7)

  const hora = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches"

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {saludo}, <span style={{ color: primaryHex }}>{primerNombre(user?.full_name)}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 first-letter:uppercase">
          {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${veDinero ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Cifra icon={Calendar} label="Turnos de hoy" valor={turnos.length} to="/turnos" tono="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" />
        <Cifra icon={PackageCheck} label="Lentes listos para entregar" valor={listas.length} to="/ordenes" tono="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
        {esOptom && <Cifra icon={Stethoscope} label="Consultas de hoy" valor={consultasHoy.length} to="/consultas" tono="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" />}
        {veDinero && <Cifra icon={ClipboardX} label="Órdenes sin venta" valor={sinVenta?.total ?? 0} to="/ordenes-sin-venta" tono="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />}
        {veDinero && <Cifra icon={HandCoins} label="Cuotas vencidas" valor={fmtMoney(cartera?.resumen.total_vencido ?? 0)} to="/cuentas-por-cobrar?tab=cuotas" tono="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={Calendar} titulo="Agenda de hoy" to="/turnos" accion="Abrir agenda" vacio={turnos.length === 0 && "No hay turnos para hoy"}>
          <ul className="divide-y">
            {turnos.map(t => (
              <li key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="font-mono text-sm font-semibold w-12 shrink-0">{t.hora_inicio}</span>
                <div className="min-w-0 flex-1">
                  {t.paciente_id
                    ? <Link to={`/pacientes/${t.paciente_id}`} className="text-sm font-medium hover:text-primary hover:underline truncate block">{t.apellidos} {t.nombres}</Link>
                    : <p className="text-sm font-medium truncate">{t.apellidos} {t.nombres}</p>}
                  <p className="text-xs text-muted-foreground truncate">{t.motivo}</p>
                </div>
                {t.telefono && <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1"><Phone className="h-3 w-3" />{t.telefono}</span>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel icon={PackageCheck} titulo="Lentes listos para entregar" to="/ordenes" vacio={listas.length === 0 && "No hay lentes esperando entrega"}>
          <ul className="divide-y">
            {listas.slice(0, 8).map(o => (
              <li key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/pacientes/${o.paciente_id}`} className="text-sm font-medium hover:text-primary hover:underline truncate block">{o.paciente_nombre ?? `Paciente #${o.paciente_id}`}</Link>
                  <p className="text-xs text-muted-foreground">{o.numero} · {o.tipo}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">Listo</span>
              </li>
            ))}
          </ul>
        </Panel>

        {esOptom && (
          <Panel icon={Stethoscope} titulo="Consultas de hoy" to="/consultas" vacio={consultasHoy.length === 0 && "Todavía no hay consultas registradas hoy"}>
            <ul className="divide-y">
              {consultasHoy.map(c => (
                <li key={c.id} className="px-4 py-2.5">
                  <Link to={`/consultas/${c.id}`} className="text-sm font-medium hover:text-primary hover:underline">{c.paciente_nombre}</Link>
                  <p className="text-xs text-muted-foreground">{c.numero}{c.motivo_consulta ? ` · ${c.motivo_consulta}` : ""}</p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel icon={Eye} titulo="Controles de la semana y cumpleaños" vacio={controles.length + cumple.length === 0 && "Nada pendiente esta semana"}>
          <ul className="divide-y">
            {cumple.map(c => (
              <li key={`c${c.id}`} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                <Cake className="h-4 w-4 text-pink-500 shrink-0" />
                <Link to={`/pacientes/${c.id}`} className="font-medium hover:text-primary hover:underline">{c.apellidos} {c.nombres}</Link>
                <span className="text-xs text-muted-foreground">cumple años hoy</span>
              </li>
            ))}
            {controles.map(c => (
              <li key={`k${c.paciente_id}`} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-sky-500 shrink-0" />
                <Link to={`/pacientes/${c.paciente_id}`} className="font-medium hover:text-primary hover:underline">{c.apellidos} {c.nombres}</Link>
                <span className="text-xs text-muted-foreground">control {c.dias_para <= 0 ? "hoy" : `el ${fmtDate(c.proximo_control)}`}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
