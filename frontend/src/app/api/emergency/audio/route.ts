import { forward } from "@/lib/backend";

// Voice call-in: multipart WAV -> Muse Voice Transcribe -> verified emergency.
export async function POST(request: Request) {
  const form = await request.formData();
  return forward("/emergency/audio", { method: "POST", body: form });
}
