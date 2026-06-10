'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
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
    <div className="h-[calc(100vh-6rem)] w-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Organisation Map</h1>
        <p className="text-sm text-muted-foreground mt-1">3D topology of your network assets, users, and vulnerabilities</p>
      </div>
      <div className="flex-1 glass-card overflow-hidden relative border border-card-border/50 rounded-xl">
        <Suspense fallback={<Spinner />}>
          <MapClient />
        </Suspense>
      </div>
    </div>
  );
}
