import { prisma } from "@/lib/db/prisma";
import { authErrorResponse, requireUser } from "@/lib/auth/guard";

export async function GET() {
  try {
    await requireUser();
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const cases = await prisma.case.findMany({
    include: {
      customer: true,
      supplier: true,
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ cases });
}
