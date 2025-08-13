import './globals.css';
import dynamic from 'next/dynamic';
const UserNav = dynamic(() => import('./user-nav'), { ssr: false });
const FeedbackButton = dynamic(() => import('./feedback-button'), { ssr: false });
export const metadata = { title: 'Expensely' };
export default function RootLayout({ children }: { children: React.ReactNode }){
  const rawVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
  const version = rawVersion.startsWith('v')? rawVersion: `v${rawVersion}`;
  return (
    <html lang="en"><body>
      <header className="brand-header shadow sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/" className="font-semibold text-white">Expensely</a>
            <nav className="hidden md:flex items-center gap-4 text-white/90 text-sm">
              <a href="/admin" className="hover:underline">Admin</a>
              <a href="/coordinator" className="hover:underline">Coordinator</a>
              <a href="/accounting" className="hover:underline">Accounting</a>
              <a href="/upload" className="hover:underline">Upload</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/70 text-xs">{version}</span>
            <FeedbackButton/>
            <UserNav/>
          </div>
        </div>
      </header>
      {children}
    </body></html>
  );
}

 

