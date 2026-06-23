import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ContactForm } from "@/components/public/contact-form";

export const metadata: Metadata = {
  title: "문의 · 제보 | STAGE",
  description: "일반·광고·제휴 문의나 기사 제보를 보내주세요.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-headline text-4xl tracking-tight">문의 · 제보</h1>
        <p className="mt-3 text-ink-muted">
          일반·광고·제휴 문의나 기사 제보를 유형에서 선택해 남겨주세요. 확인 후
          입력하신 이메일로 답변드리겠습니다.
        </p>
        <div className="mt-10">
          <ContactForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
