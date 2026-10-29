import { forward } from "@/lib/backend";

// Commit a verified proposal to the backend's current term state.
export async function POST(request: Request) {
  return forward("/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
