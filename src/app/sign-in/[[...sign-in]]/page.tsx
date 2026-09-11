import { SignIn } from "@clerk/nextjs";

export const runtime = "edge";

export default function SignInPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 16px", background: "#f8fafc" }}>
      <SignIn />
    </main>
  );
}
