import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";

export const metadata: Metadata = {
  title: "광고 안내 | STAGE",
  description: "STAGE와 함께하는 광고·제휴 안내.",
};

const SLOTS = [
  {
    title: "매거진 배너",
    desc: "디지털 매거진 뷰어와 목록에 노출되는 브랜드 배너.",
  },
  {
    title: "네이티브 콘텐츠",
    desc: "기사·블로그 흐름에 자연스럽게 어울리는 협찬 콘텐츠.",
  },
  {
    title: "공연·전시 후원",
    desc: "문화예술 이벤트 페이지와 회원 혜택에 연계된 후원.",
  },
];

export default function AdvertisePage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <span className="font-label text-[11px] font-bold uppercase tracking-[0.25em] text-[#6f5c24]">
          Advertise with STAGE
        </span>
        <h1 className="mt-3 font-headline text-4xl tracking-tight">광고 안내</h1>
        <p className="mt-4 max-w-xl leading-relaxed text-[#444748]">
          STAGE는 공연·전시·클래식을 사랑하는 독자들이 모이는 문화예술 플랫폼입니다.
          브랜드의 메시지를 가장 어울리는 맥락에서 전달해 드립니다.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {SLOTS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-[#1c1b1b]/10 p-6">
              <h3 className="font-headline text-xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#444748]">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[#6f5c24]/20 bg-[#faf7f2] p-8 text-center">
          <p className="font-headline text-2xl">제휴·광고 문의</p>
          <p className="mt-3 text-sm text-[#444748]">
            매체 소개서와 단가표가 필요하시면 문의를 남겨주세요. 담당자가 빠르게
            연락드리겠습니다.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block bg-[#1c1b1b] px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24]"
          >
            문의하기
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
