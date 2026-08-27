import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Plately' };

// The [locale] layout renders <html>; this root only carries global CSS.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
