"use server";

import { cookies } from "next/headers";
import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";

/** InsForge auth mutations. They run on the server so the refresh token lands in an httpOnly cookie. Only safe data is returned. */
export type AuthResult = { ok: boolean; needsCode?: boolean; email?: string; error?: string };

const fail = (e: { message?: string } | null | undefined, fallback: string): AuthResult => ({ ok: false, error: e?.message || fallback });

async function actions() {
  return createAuthActions({ cookies: await cookies() });
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await (await actions()).signInWithPassword({ email, password });
  if (error?.statusCode === 403 || /verif/i.test(error?.message ?? "")) return { ok: false, needsCode: true, email };
  return data?.user ? { ok: true, email: data.user.email } : fail(error, "Sign in failed");
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await (await actions()).signUp({ email, password });
  if (error) return fail(error, "Sign up failed");
  // email verification is on for this project: InsForge emails a 6-digit code before the first session
  return data?.requireEmailVerification ? { ok: false, needsCode: true, email } : { ok: true, email };
}

export async function verifyCode(email: string, otp: string): Promise<AuthResult> {
  const { data, error } = await (await actions()).verifyEmail({ email, otp });
  return data?.user ? { ok: true, email: data.user.email } : fail(error, "That code didn't work");
}

export async function resendCode(email: string): Promise<AuthResult> {
  const { error } = await createServerClient().auth.resendVerificationEmail({ email });
  return error ? fail(error, "Couldn't resend the code") : { ok: true, email };
}

export async function signOut(): Promise<void> {
  await (await actions()).signOut();
}
