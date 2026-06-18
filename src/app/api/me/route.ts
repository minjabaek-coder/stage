import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 현재 로그인 유저(prisma User, tier 포함) 또는 null. 클라이언트 useUser 등에서 사용.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      avatarUrl: user.avatarUrl,
    },
  });
}
