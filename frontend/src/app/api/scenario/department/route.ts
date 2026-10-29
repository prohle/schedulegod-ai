import { forward } from "@/lib/backend";

// Load the department-scale scenario (26 instructors / 25 sections /
// 12 cohorts) on the backend — the one-click scale proof.
export async function POST() {
  return forward("/scenario/department", { method: "POST" });
}
