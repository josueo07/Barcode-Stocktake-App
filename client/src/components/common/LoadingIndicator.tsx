export function LoadingIndicator({ label = 'Cargando…' }: { label?: string }) {
  return <p className="loading-indicator">{label}</p>;
}
