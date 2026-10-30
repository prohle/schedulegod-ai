import { forward } from "@/lib/backend";

// Voice call-in: multipart WAV -> Muse Voice Transcribe -> verified term change.
export async function POST(request: Request) {
  const form = await request.formData();
  return forward("/term-change/audio", { method: "POST", body: form });
}
