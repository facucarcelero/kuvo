import Link from 'next/link';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="logo" aria-label="KUVO Inicio">
      <span className="logoMark" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img">
          <path d="M12 9v30M13 24 28 9M13 24l15 15M27 24 39 10M27 24l12 14" />
        </svg>
      </span>
      {!compact && <span className="logoWord">KUVO<small>NEGOCIOS + CREADORES</small></span>}
    </Link>
  );
}
