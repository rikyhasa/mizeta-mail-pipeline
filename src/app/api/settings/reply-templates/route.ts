import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withPermission } from "@/lib/auth/route-helpers";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { CaseCategory } from "@/generated/prisma/enums";

const CASE_CATEGORY_VALUES = Object.keys(CASE_CATEGORY_LABELS) as [CaseCategory, ...CaseCategory[]];
const postSchema = z.object({
  category: z.enum(CASE_CATEGORY_VALUES).nullable(),
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyText: z.string().min(1),
});

export async function POST(request: Request) {
  return withPermission("settings:manage", async () => {
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }
    const template = await prisma.replyTemplate.create({ data: parsed.data });
    return Response.json({ template }, { status: 201 });
  });
}
