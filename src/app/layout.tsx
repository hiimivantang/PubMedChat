import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'PubMedChat',
  description: 'Fixture-backed PubMed search and article explorer.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="site-header">
            <div>
              <p className="eyebrow">PubMedChat prototype</p>
              <h1>PubMed search and article detail</h1>
            </div>
            <p className="site-note">
              Literature discovery only. Not medical advice.
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
