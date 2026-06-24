import { permanentRedirect } from "next/navigation";

// 기사·매거진 모델 병합(2026-06): 매거진기사는 단일 Article로 이전됨.
// 구 URL `/magazines/[id]/[slug]`(매거진기사 텍스트 리더)는 `/articles/[slug]`로 영구 이동.
// 슬러그는 이전 시 그대로 재사용되어 1:1 매핑. (매거진 자체 열람은 /magazines/[id] 뷰어)
export default async function LegacyMagazineArticleRedirect({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/articles/${slug}`);
}
