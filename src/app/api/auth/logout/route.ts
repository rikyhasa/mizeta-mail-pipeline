import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { destroySession, getCurrentUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "USER_LOGOUT", entityType: "User", entityId: user.id },
    });
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
