import { NextRequest, NextResponse } from "next/server";
import { saveBlogThumbnail } from "@/lib/upload";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { isAdmin } from "@/lib/auth";
import { resolveEditToken } from "@/actions/article-token-actions";

// 이 라우트는 이름과 달리 **어드민 전체의 공용 이미지 업로드 경로**다
// (기사·문화예술·광고·구성형 페이지·리치텍스트 에디터, 그리고 공개 기고자 화면).
//
// 기고자(/contribute/[token])는 로그인하지 않는 무계정 경로라 isAdmin()만으로 막으면
// 썸네일을 올릴 수 없다 — 실제로 403이 나던 것을 확인하고 고친다.
// 그래서 자격을 둘 중 하나로 본다: 관리자 세션 **또는** 유효한 기고 토큰.
// 토큰 소지자는 이미 그 기사를 편집할 수 있으므로 이미지 업로드를 허용해도 권한이 넓어지지 않는다.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token");

    let allowed = await isAdmin();
    if (!allowed && typeof token === "string" && token) {
      allowed = (await resolveEditToken(token)).ok;
    }
    if (!allowed) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json(
        { error: "파일을 선택해주세요" },
        { status: 400 }
      );
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일이 너무 큽니다 (최대 20MB)" },
        { status: 400 }
      );
    }

    const url = await saveBlogThumbnail(file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    console.error("Blog upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
