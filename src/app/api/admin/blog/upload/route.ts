import { NextRequest, NextResponse } from "next/server";
import { saveBlogThumbnail } from "@/lib/upload";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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
