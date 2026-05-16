'use client';

import { CommandPalette } from '@/components/layout/command-palette';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-grid">
      <Sidebar />
      <div className="flex-1 ml-[260px] transition-all duration-300">
        <Header />
        <main className="p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
