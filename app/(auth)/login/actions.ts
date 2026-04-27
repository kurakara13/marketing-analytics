"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

export type LoginActionResult = { error: string } | undefined;

export async function loginAction(
  input: LoginInput,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Data tidak valid" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email atau password salah" };
    }
    // NEXT_REDIRECT must propagate so navigation can complete.
    throw error;
  }
}
