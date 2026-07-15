import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/config/env";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      emailProvider: env.EMAIL_PROVIDER,
      llmProvider: env.LLM_PROVIDER,
    });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
