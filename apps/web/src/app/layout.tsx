import './globals.css';
import { AuthProvider } from '@/components/providers/auth-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f19] text-slate-300 antialiased selection:bg-primary-500/30">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
