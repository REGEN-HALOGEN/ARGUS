'use client';

import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  showText?: boolean;
}

export function Logo({ className = '', width = 32, height = 32, showText = true }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width, height }} className={className} />;
  }

  const isDark = resolvedTheme === 'dark';
  const logoSrc = isDark ? '/images/argus-dark.svg' : '/images/argus-light.svg';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative shrink-0" style={{ width, height }}>
        <Image src={logoSrc} alt="ARGUS Logo" fill className="object-contain" priority />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-foreground leading-none">
            ARGUS
          </span>
          <p className="text-[10px] font-medium text-muted-foreground leading-none mt-1">
            Security Intelligence
          </p>
        </div>
      )}
    </div>
  );
}
