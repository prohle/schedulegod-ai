import { forward } from "@/lib/backend";

export async function POST(request: Request) {
  return forward("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
