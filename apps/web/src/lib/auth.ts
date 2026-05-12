/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAuthClient } from "better-auth/react";

const authClient: any = createAuthClient({
  baseURL: 'http://localhost:4000/api/v1/auth',
});

export const signIn: any = authClient.signIn;
export const signUp: any = authClient.signUp;
export const signOut: any = authClient.signOut;
export const useSession: () => { data: any; isPending: boolean } = authClient.useSession;
