import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold">NNUTS Tool</h1>
        <p className="text-sm text-neutral-500">Sign in with your internal account</p>
      </div>
      <LoginForm />
    </div>
  );
}
