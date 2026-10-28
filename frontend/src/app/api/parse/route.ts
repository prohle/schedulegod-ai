import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    const mockParsed = {
      summary: `Mock parse: ${message}`,
      operations: [
        {
          op: "add_instructor_unavailability",
          instructor_id: "patel",
          day: 0,
          explanation: "Prof. Patel can't teach on Mondays.",
        },
      ],
    };

    return NextResponse.json(mockParsed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}