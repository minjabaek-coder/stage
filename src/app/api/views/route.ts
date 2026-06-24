import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { type, id } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    if (type === "magazine") {
      await prisma.magazine.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    } else if (type === "blog") {
      await prisma.blogPost.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    } else if (type === "article") {
      await prisma.article.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
