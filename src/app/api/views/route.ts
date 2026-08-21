import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIpFrom, hitLimit } from "@/lib/rate-limit";

// 조회수 기록. **인증이 없는 공개 엔드포인트**라 반복 호출로 수치를 부풀릴 수 있었다.
// 클라이언트(ViewTracker)가 sessionStorage로 중복을 막고 있었지만 그건 화면 쪽 편의일
// 뿐, API를 직접 두드리면 그만이다. 조회수는 어드민 '인기 Top 5'의 근거이자 편집 판단에
// 쓰이므로, 같은 IP·같은 콘텐츠는 **하루 한 번만** 센다(서버 측 중복 제거).
//
// 한도를 넘으면 오류가 아니라 **조용히 세지 않는다** — 정상 이용자의 재방문을 막을
// 이유가 없고, 공격자에게 판정 결과를 알려줄 이유도 없다.
export async function POST(request: NextRequest) {
  try {
    const { type, id } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (!["magazine", "blog", "article"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const { exceeded } = await hitLimit(
      `view:${type}:${id}`,
      clientIpFrom(request.headers),
      1,
    );
    if (exceeded) return new NextResponse(null, { status: 204 });

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
    } else {
      await prisma.article.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
