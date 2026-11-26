import type { Metadata } from 'next';
import './globals.css';
import './wide-layout.css';

export const metadata: Metadata = {
  title: '経費申請',
  description: 'AI経費申請・管理アプリ',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
