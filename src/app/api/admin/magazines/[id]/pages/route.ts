import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/upload";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { isAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  try {
    const { id: magazineId } = await params;

    const magazine = await prisma.magazine.findUnique({
      where: { id: magazineId },
    });

    if (!magazine) {
      return NextResponse.json(
        { error: "매거진을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "파일을 선택해주세요" },
        { status: 400 }
      );
    }

    // Validate all files first
    for (const file of files) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${file.name}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `파일이 너무 큽니다: ${file.name} (최대 20MB)` },
          { status: 400 }
        );
      }
    }

    // Get current max sort order
    const lastPage = await prisma.magazinePage.findFirst({
      where: { magazineId },
      orderBy: { sortOrder: "desc" },
    });

    let nextSortOrder = (lastPage?.sortOrder ?? -1) + 1;

    const createdPages = [];

    for (const file of files) {
      const pageNumber = nextSortOrder + 1;
      // 고유 파일명으로 저장(pageNumber 미전달) — 파일명이 어긋난 매거진(예: 2호)이나
      // "페이지 삭제 후 추가" 시 `{pageNumber}.webp`가 기존 파일과 충돌("이미 존재")해
      // 업로드가 500으로 실패하던 문제 방지. 표시용 번호는 "파일명 정리" 버튼으로 정규화.
      const imageUrl = await saveUploadedFile(file, magazineId);

      const page = await prisma.magazinePage.create({
        data: {
          magazineId,
          pageNumber,
          imageUrl,
          sortOrder: nextSortOrder,
        },
      });

      createdPages.push(page);
      nextSortOrder++;
    }

    // Set cover image if this is the first page
    if (!magazine.coverImageUrl && createdPages.length > 0) {
      await prisma.magazine.update({
        where: { id: magazineId },
        data: { coverImageUrl: createdPages[0].imageUrl },
      });
    }

    return NextResponse.json({ pages: createdPages }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[pages/route] Upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
