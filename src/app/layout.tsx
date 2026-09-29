import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Rave · Intent-to-RFQ Explorer',
  description:
    'Inspect Bebop RFQ quotes from a simplified LI.FI-style intent. Ethereum and Base. No signing or execution.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
