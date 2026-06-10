/* eslint-disable @typescript-eslint/no-explicit-any */
import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const authClient: any = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:4000/api/v1/auth',
  plugins: [organizationClient()],
  sessionOptions: {
    // Prevent the entire app from refetching session + /me + dashboard data
    // every time the user alt-tabs back to the browser window.
    refetchOnWindowFocus: false,
  },
});

export const signIn: any = authClient.signIn;
export const signUp: any = authClient.signUp;
export const signOut: any = authClient.signOut;
export const useSession: () => { data: any; isPending: boolean } = authClient.useSession;
export const useActiveOrganization: () => { data: any; isPending: boolean } =
  authClient.useActiveOrganization;
