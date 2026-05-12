'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth';

interface AuthContextType {
  user: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isPending) {
      if (!data?.user && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
        router.push('/login');
      } else if (data?.user && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
        router.push('/dashboard');
      }
    }
  }, [data, isPending, router, pathname]);

  return (
    <AuthContext.Provider value={{ user: data?.user ?? null, loading: isPending }}>
      {isPending ? (
        <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
