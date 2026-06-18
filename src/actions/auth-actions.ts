"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createSupabaseServer } from "@/lib/supabase-server";
import { syncUserToDB } from "@/lib/auth";

const credsSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
});

export async function signUpEmail(_prev: unknown, formData: FormData) {
  const parsed = credsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };
  if (data.user) {
    try {
      await syncUserToDB(data.user);
    } catch (e) {
      console.error("[auth] syncUserToDB(signup) failed:", e);
    }
  }
  redirect("/");
}

export async function signInEmail(_prev: unknown, formData: FormData) {
  const parsed = credsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  if (data.user) {
    try {
      await syncUserToDB(data.user);
    } catch (e) {
      console.error("[auth] syncUserToDB(signin) failed:", e);
    }
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
