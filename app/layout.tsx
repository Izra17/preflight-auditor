import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PreFlight — Landing Page Readiness & Tracking Auditor',
  description: 'Validate analytics, conversion tracking, technical health, and user interactions in a real browser session before you spend on traffic.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-ink-50 antialiased">{children}</body>
    </html>
  );
}
