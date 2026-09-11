import { ClerkProvider } from "@clerk/nextjs";

// Clerk auth pages need ClerkProvider context (it no longer lives in the
// static root layout). Edge runtime, like the sign-in/up pages themselves.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
