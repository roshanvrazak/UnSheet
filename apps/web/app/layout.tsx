import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Unsheet',
  description: 'Deterministic spreadsheet processing engine and dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
