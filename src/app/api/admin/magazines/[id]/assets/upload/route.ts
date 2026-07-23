import { NextRequest, NextResponse } from "next/server";
import { saveMagazineAsset } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// kind=html 미디어 라이브러리 업로드 — Storage(assets 경로) 저장 + MagazineAsset DB 기록.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  const { id: magazineId } = await params;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일을 선택해주세요" }, { status: 400 });
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
      return NextResponse.json({ error: "지원하지 않는 파일 형식입니다" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: "파일이 너무 큽니다 (최대 20MB)" }, { status: 400 });

    const { url, path, filename } = await saveMagazineAsset(file, magazineId);
    const asset = await prisma.magazineAsset.create({
      data: { magazineId, url, path, filename },
      select: { id: true, url: true, path: true, filename: true, createdAt: true },
    });
    revalidatePath(`/admin/magazines/${magazineId}/edit`);
    return NextResponse.json(
      { asset: { ...asset, createdAt: asset.createdAt.toISOString() } },
      { status: 201 }
    );
  } catch (e) {
    console.error("Magazine asset upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
