import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Unsheet',
  description: 'Turn spreadsheets into clear, interactive dashboards. Explore your data, ask questions, and find your next insight with Unsheet.',
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
