import { forward, BACKEND_URL } from "@/lib/backend";

// Side-by-side engine comparison: CP-SAT vs the ScheduleGod home solver on
// the backend's current scenario.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    const scenario = await (await fetch(`${BACKEND_URL}/scenario`)).json();
    return forward("/solve/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, operations: body.operations || [] }),
    });
  } catch {
    return forward("/solve/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}
