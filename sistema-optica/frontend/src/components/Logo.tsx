import { cn } from "@/lib/utils"

/**
 * Isotipo genérico de la óptica: gafas estilizadas con un destello de lente.
 * Usa `currentColor`, así hereda el color del texto donde se coloque.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      {/* Varillas */}
      <path d="M6.5 22 L4 15.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M41.5 22 L44 15.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      {/* Lentes */}
      <circle cx="15" cy="24.5" r="8.5" stroke="currentColor" strokeWidth="2.8" />
      <circle cx="33" cy="24.5" r="8.5" stroke="currentColor" strokeWidth="2.8" />
      {/* Puente */}
      <path d="M23.4 23.1 Q24 20.9 24.6 23.1" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      {/* Destellos */}
      <path d="M10.8 22.7 A4.6 4.6 0 0 1 14 19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
      <path d="M28.8 22.7 A4.6 4.6 0 0 1 32 19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}

export default LogoMark
