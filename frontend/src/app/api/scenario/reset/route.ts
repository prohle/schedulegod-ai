import { forward } from "@/lib/backend";

// Return the backend to the story seed scenario.
export async function POST() {
  return forward("/scenario/reset", { method: "POST" });
}
