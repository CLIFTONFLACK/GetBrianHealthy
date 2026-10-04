"use server";

import { cookies } from "next/headers";
import { REGION_COOKIE, parseRegion } from "./region";

/**
 * Footer country switch. Stores the visitor's own choice, and only that: the
 * value is checked against the two known regions, and the cookie is scoped to
 * the site root (path "/"), so nothing a request sends can set anything else.
 */
export async function setRegion(formData: FormData): Promise<void> {
  const region = parseRegion(String(formData.get("region") ?? ""));
  if (!region) return;
  (await cookies()).set(REGION_COOKIE, region, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
