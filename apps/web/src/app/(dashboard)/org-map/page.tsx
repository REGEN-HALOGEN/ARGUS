'use client';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/spinner';

const MapClient = dynamic(() => import('./map-client'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Spinner size="lg" />
    </div>
  ),
});

export default function OrgMapPage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      <div className="mb-3 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Organisation Map</h1>
        <p className="text-sm text-muted-foreground mt-1">
          3D topology of your network assets, users, and vulnerabilities
        </p>
      </div>
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-card-border/50 relative">
        <MapClient />
      </div>
    </div>
  );
}
