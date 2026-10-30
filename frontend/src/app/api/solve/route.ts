import { forward, BACKEND_URL } from "@/lib/backend";

// The backend /solve requires the full scenario. Load the seed from the
// backend and forward it alongside any operations the client sent.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    const scenario = await (await fetch(`${BACKEND_URL}/scenario`)).json();
    return forward("/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario,
        operations: body.operations || [],
        engine: typeof body.engine === "string" ? body.engine : "cpsat",
      }),
    });
  } catch {
    return forward("/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}