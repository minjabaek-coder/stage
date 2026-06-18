import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { ProfileForm } from "@/components/public/profile-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "마이페이지 | STAGE" };

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <ProfileForm
          email={user.email}
          tier={user.tier}
          proExpiresAt={user.proExpiresAt?.toISOString() ?? null}
          name={user.name}
          interests={user.interests}
          newsletterOptIn={user.newsletterOptIn}
          eventAlertOptIn={user.eventAlertOptIn}
        />
      </main>
    </div>
  );
}
