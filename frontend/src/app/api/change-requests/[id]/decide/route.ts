import { forward } from "@/lib/backend";

function authInit(request: Request, method: string, body?: string): RequestInit {
  const headers: Record<string, string> = {};
  const auth = request.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;
  if (body) headers["Content-Type"] = "application/json";
  return { method, headers, body };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward(`/change-requests/${id}/decide`, authInit(request, "POST", await request.text()));
}
