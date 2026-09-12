import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerkAppearance";

// Clerk auth pages need ClerkProvider context (it no longer lives in the
// static root layout). Appearance = Dark Studio (cascades to <SignIn />).

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}
