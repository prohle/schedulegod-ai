import { forward } from "@/lib/backend";

// Load the full-university stress scenario (198 instructors / 361 sections /
// 100 cohorts / 25 programs) on the backend.
export async function POST() {
  return forward("/scenario/full-university", { method: "POST" });
}
