import { forward } from "@/lib/backend";

export async function POST(request: Request) {
  return forward("/emergency", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}