"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signIn } from "@/lib/auth";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";

export type RegisterActionResult = { error: string } | undefined;

export async function registerAction(
  input: RegisterInput,
): Promise<RegisterActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Data tidak valid" };
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: "Email sudah terdaftar" };
  }

  const hash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ name, email, password: hash });

  // Auto sign-in after registration. signIn redirects on success
  // (NEXT_REDIRECT must propagate).
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Akun berhasil dibuat, silakan masuk" };
    }
    throw error;
  }
}
