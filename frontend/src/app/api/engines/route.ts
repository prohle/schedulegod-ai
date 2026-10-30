import { forward } from "@/lib/backend";

// Registered solver engines (plug-and-play registry on the backend).
export async function GET() {
  return forward("/engines");
}
