import { forward } from "@/lib/backend";

export async function GET(_request: Request, { params }: { params: Promise<{ change: string }> }) {
  const { change } = await params;
  return forward(`/planning/whatif/${change}`);
}