import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { TipForm } from "@/components/public/tip-form";

export const metadata: Metadata = {
  title: "기사 제보 | STAGE",
  description: "공연·전시·인물·이슈 등 STAGE에 제보해주세요.",
};

export default function TipPage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-headline text-4xl tracking-tight">기사 제보</h1>
        <p className="mt-3 text-[#444748]">
          알리고 싶은 공연·전시·인물·이슈가 있다면 제보해주세요. STAGE가 취재하겠습니다.
        </p>
        <div className="mt-10">
          <TipForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
