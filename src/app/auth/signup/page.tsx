import { SiteHeader } from "@/components/public/site-header";
import { AuthForm } from "@/components/public/auth-form";
import { signUpEmail } from "@/actions/auth-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "회원가입 | STAGE" };

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />
      <main className="flex items-center justify-center px-6 py-20">
        <AuthForm action={signUpEmail} mode="signup" />
      </main>
    </div>
  );
}
