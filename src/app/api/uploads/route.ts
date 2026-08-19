import { NextRequest, NextResponse } from "next/server";
import { saveUploadedImage } from "@/lib/upload";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { isAdmin } from "@/lib/auth";
import { resolveEditToken } from "@/actions/article-token-actions";

// 공용 이미지 업로드 — 기사·문화예술·광고·구성형 페이지·리치텍스트 에디터,
// 그리고 공개 기고자 화면(/contribute/[token])이 모두 이 경로를 쓴다.
//
// 이전 경로는 `/api/admin/blog/upload`였다. `blog`도 아니고(BlogPost는 레거시·0행)
// `admin` 전용도 아니어서(기고자도 쓴다) 이름이 두 군데서 실제와 어긋났다 — 실제로
// "죽은 라우트"로 오인해 제거를 검토한 적이 있다.
//
// 자격은 둘 중 하나: 관리자 세션 **또는** 유효한 기고 토큰. 토큰 소지자는 이미 그 기사를
// 편집할 수 있으므로 이미지 업로드를 허용해도 권한이 넓어지지 않는다.
// (`admin` 경로 밖으로 옮긴 이유 = "admin 경로는 관리자만"이라는 규칙을 흐리지 않기 위함.
//  대신 자격 검사를 이 안에서 명시적으로 한다.)
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

    const url = await saveUploadedImage(file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    console.error("[upload] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
