import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";

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
