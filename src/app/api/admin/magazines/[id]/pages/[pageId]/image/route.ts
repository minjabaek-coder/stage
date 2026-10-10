import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/upload";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { isAdmin } from "@/lib/auth";

// 기존 페이지의 **이미지만** 교체한다 (roadmap DR-C).
//
// 왜 별도 경로인가: `POST .../pages`는 행을 **새로 만들어 뒤에 붙인다**(sortOrder=최대+1).
// 2026-10-10 사고로 Storage가 사라진 뒤 그 경로로 재업로드하면 **죽은 페이지 + 새 페이지가
// 중복**되고, 목차(MagazineTocEntry)는 pageNumber로 연결돼 있어 **죽은 앞쪽 절반을 가리킨다.**
// 여기서는 행을 유지하고 `imageUrl`만 바꾼다 → sortOrder·pageNumber·articleId·목차·구성형
// layout이 모두 보존된다.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  try {
    const { id: magazineId, pageId } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일을 선택해주세요" }, { status: 400 });
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `지원하지 않는 파일 형식입니다: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (최대 20MB)` },
        { status: 400 }
      );
    }

    // magazineId를 함께 걸어 **다른 호의 페이지를 덮어쓰는 것**을 막는다.
    const page = await prisma.magazinePage.findFirst({
      where: { id: pageId, magazineId },
      select: { id: true, kind: true, imageUrl: true, pageNumber: true },
    });
    if (!page) {
      return NextResponse.json(
        { error: "페이지를 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    if (page.kind !== "image") {
      return NextResponse.json(
        { error: `이미지형 페이지만 교체할 수 있습니다 (현재: ${page.kind})` },
        { status: 400 }
      );
    }

    const imageUrl = await saveUploadedFile(file, magazineId);

    // 표지는 첫 페이지 이미지와 같은 URL을 쓰고 있다(실측: 발행본 39호 전부).
    // 페이지만 바꾸고 표지를 두면 **목록·홈의 표지가 계속 깨진 URL**을 가리킨다.
    const oldUrl = page.imageUrl;
    const [, coverUpdate] = await prisma.$transaction([
      prisma.magazinePage.update({ where: { id: page.id }, data: { imageUrl } }),
      prisma.magazine.updateMany({
        where: { id: magazineId, coverImageUrl: oldUrl },
        data: { coverImageUrl: imageUrl },
      }),
    ]);

    // 교체 후에 지운다 — 먼저 지우면 업로드가 실패했을 때 되돌릴 게 없다.
    // 다른 프로젝트(사라진 구 버킷) URL은 upload.ts가 알아서 건너뛴다.
    if (oldUrl) await deleteUploadedFile(oldUrl);

    return NextResponse.json({
      page: { id: page.id, pageNumber: page.pageNumber, imageUrl },
      coverUpdated: coverUpdate.count > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[pages/image] Replace error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
