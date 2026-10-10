import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";
import { safeRead } from "@/lib/db-safe";

// 현재 Supabase Auth 세션의 유저 (없으면 null)
export async function getAuthUser(): Promise<SupabaseUser | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Supabase Auth 유저 → prisma User upsert (authId 기준). 가입/로그인 후 동기화에 사용.
export async function syncUserToDB(authUser: SupabaseUser) {
  const email = authUser.email ?? "";
  const meta = authUser.user_metadata ?? {};
  const name =
    (meta.name as string) || (meta.full_name as string) || "";
  const avatarUrl = (meta.avatar_url as string) || null;
  const snsProvider = authUser.app_metadata?.provider ?? null;

  return prisma.user.upsert({
    where: { authId: authUser.id },
    update: {
      email,
      ...(name ? { name } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(snsProvider ? { snsProvider } : {}),
    },
    create: { authId: authUser.id, email, name, avatarUrl, snsProvider },
  });
}

// 현재 로그인 유저의 prisma User(tier 포함). 미로그인 시 null.
export async function getCurrentUser() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  return prisma.user.findUnique({ where: { authId: authUser.id } });
}

// 현재 유저가 운영 권한(admin)인지. 서버 액션 방어용.
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

// ── 읽기 전용(공개 페이지) 용 best-effort 변형 ──────────────────────────────
// DB가 죽으면 위 두 함수는 throw하고, 공개 페이지는 세션 확인만으로 500이 된다.
// 읽기 경로에서는 "누군지 모르겠다 = 비로그인"으로 떨어뜨리는 쪽이 낫다.
//
// **쓰기 경로(서버 액션·API)에서는 쓰지 말 것.** 권한 판정이 장애 시 조용히
// false가 되면 "권한 없음"이라는 틀린 이유를 사용자에게 보여주게 된다.
// 쓰기는 `isAdmin()`을 그대로 써서 장애가 장애로 드러나게 둔다.

export async function tryGetCurrentUser() {
  const { data } = await safeRead(() => getCurrentUser(), null, "getCurrentUser");
  return data;
}

export async function tryIsAdmin(): Promise<boolean> {
  const { data } = await safeRead(() => isAdmin(), false, "isAdmin");
  return data;
}
