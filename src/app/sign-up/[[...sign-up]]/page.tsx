import { SignUp } from "@clerk/nextjs";


export default function SignUpPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 16px", background: "#f8fafc" }}>
      <SignUp />
    </main>
  );
}
