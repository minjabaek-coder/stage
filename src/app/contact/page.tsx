import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ContactForm } from "@/components/public/contact-form";

export const metadata: Metadata = {
  title: "문의 | STAGE",
  description: "제휴·광고·일반 문의를 보내주세요.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-headline text-4xl tracking-tight">문의하기</h1>
        <p className="mt-3 text-[#444748]">
          제휴·광고·기타 문의를 남겨주시면 확인 후 답변드리겠습니다.
        </p>
        <div className="mt-10">
          <ContactForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
