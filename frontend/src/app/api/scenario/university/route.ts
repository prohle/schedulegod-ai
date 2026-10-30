import { forward } from "@/lib/backend";

// Load the university-scale scenario (38 instructors / 41 sections /
// 20 cohorts / 5 programs) on the backend.
export async function POST() {
  return forward("/scenario/university", { method: "POST" });
}
