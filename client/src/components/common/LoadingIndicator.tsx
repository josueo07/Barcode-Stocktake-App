export function LoadingIndicator({ label = 'Loading…' }: { label?: string }) {
  return <p className="loading-indicator">{label}</p>;
}
