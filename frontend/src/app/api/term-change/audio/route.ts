import { forward } from "@/lib/backend";

// Voice note: multipart WAV -> Muse Voice Transcribe -> a reviewable text
// draft. Voice never changes the term by itself (a recording cannot prove
// who is speaking); a signed-in coordinator submits the text as a request.
export async function POST(request: Request) {
  const form = await request.formData();
  return forward("/term-change/audio", { method: "POST", body: form });
}
