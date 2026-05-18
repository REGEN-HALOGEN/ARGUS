'use client';

import React from 'react';

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-colors duration-300">
      {/* Outer premium glow container */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Soft background pulse glow */}
        <div className="absolute inset-0 -m-10 animate-pulse-soft rounded-full bg-primary-500/5 blur-3xl pointer-events-none" />

        {/* Spinning SVG Loader */}
        <div className="relative">
          {/* Inner core accent glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary-500/20 to-accent-500/20 blur-xl animate-pulse" />
          
          {/* Spinning Logo Image */}
          <img
            src="/images/loader.svg"
            alt="ARGUS Loading..."
            className="relative z-10 h-28 w-28 animate-spin select-none pointer-events-none drop-shadow-[0_0_25px_rgba(59,130,246,0.25)] dark:drop-shadow-[0_0_35px_rgba(59,130,246,0.45)]"
          />
        </div>

        {/* Loading text with premium tracked font */}
        <div className="relative z-10 flex flex-col items-center gap-1.5 mt-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-500/80 dark:text-primary-400/90 animate-pulse">
            Establishing Secure Link
          </span>
          <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40">
            Initializing threat telemetry
          </span>
        </div>
      </div>
    </div>
  );
}
