import { schemaForStep, PLAN_TYPES, planProfile, STEP_KEYS } from "@vestara/shared";
import { MOCK_EXTRACTION } from "../src/modules/extraction/mockExtraction";

/**
 * Replays the 401(k) sample extraction against every plan type.
 *
 * The point is NOT that every type validates — it is that each type rejects
 * exactly the elections that are wrong for it, and names them. A 401(a) must
 * reject elective deferrals; a 403(b) must reject a trustee; a non-governmental
 * 457(b) must reject Roth, loans and the age-59½ in-service withdrawal.
 */
for (const t of PLAN_TYPES) {
  const p = planProfile(t);
  console.log(`\n=== ${p.label}   funding=${p.fundingVehicle}  deferrals=${p.electiveDeferrals}`);
  for (const key of STEP_KEYS) {
    const section: any = { ...(MOCK_EXTRACTION as any)[key] };
    delete section._confidence;
    if (key === "identity") section.planType = t;
    if (key === "trustees_funds") section.trustees = [{ name: "Wesley Scott Wilson", type: "Individual" }];
    const r = schemaForStep(key, t)!.safeParse(section);
    if (r.success) {
      console.log(`  ok   ${key}`);
      continue;
    }
    console.log(`  REJ  ${key}`);
    const seen = new Set<string>();
    for (const i of r.error.issues) {
      const line = `${String(i.path[0])}: ${i.message}`;
      if (seen.has(line)) continue;
      seen.add(line);
      console.log(`         ${line.slice(0, 110)}`);
    }
  }
}
