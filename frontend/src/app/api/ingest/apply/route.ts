import { forward } from "@/lib/backend";

// Commit the reviewed (keep/change) extraction and make it the current term.
export async function POST(request: Request) {
  return forward("/ingest/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
