import Link from 'next/link';
import { Logo } from '@/components/Logo';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="publicPage">
      <header className="siteHeader">
        <div className="headerInner">
          <Logo />
          <nav className="mainNav">
            <Link href="/">Inicio</Link>
            <Link href="/explorar">Explorar</Link>
            <Link href="/login">Ingresar</Link>
          </nav>
          <div className="headerActions">
            <Link className="primaryBtn headerRegister" href="/registro">Registrarse</Link>
          </div>
        </div>
      </header>
      <main className="container publicMain">{children}</main>
    </div>
  );
}
