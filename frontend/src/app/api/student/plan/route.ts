import { forward } from "@/lib/backend";

export async function POST(request: Request) {
  return forward("/student/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
