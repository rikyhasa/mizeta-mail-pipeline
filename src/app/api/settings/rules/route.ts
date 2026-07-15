import { withPermission } from "@/lib/auth/route-helpers";
import { ruleSettingsInputSchema, updateRuleSettings } from "@/lib/rules/settings-repository";

export async function PATCH(request: Request) {
  return withPermission("settings:manage", async (user) => {
    const parsed = ruleSettingsInputSchema.partial().safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
    }
    const settings = await updateRuleSettings(parsed.data, user.id);
    return Response.json({ settings });
  });
}
