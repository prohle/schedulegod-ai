import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    // In a real implementation, this would call the backend Python service
    // For now, return a mock response
    const mockResponse = {
      summary: `Processed: "${message}"`,
      operations: [
        {
          op: "add_instructor_unavailability",
          instructor_id: "patel",
          day: 0,
          explanation: "Prof. Patel can't teach on Mondays.",
        },
        {
          op: "add_instructor_preference",
          instructor_id: "patel",
          kind: "avoid",
          period: 0,
          weight: 6,
          explanation: "Prof. Patel prefers to avoid teaching at 8:00.",
        },
      ],
      applied_operations: [
        {
          op: "add_instructor_unavailability",
          instructor_id: "patel",
          day: 0,
          explanation: "Prof. Patel can't teach on Mondays.",
        },
        {
          op: "add_instructor_preference",
          instructor_id: "patel",
          kind: "avoid",
          period: 0,
          weight: 6,
          explanation: "Prof. Patel prefers to avoid teaching at 8:00.",
        },
      ],
      dropped_operations: [],
      healing_notes: [],
      diagnosis: "Patel unavailable Mondays, prefers to avoid 8am, assigned to CS 350.",
      diagnosis_mode: "mock",
      options: [],
      result: {
        status: "optimal",
        timetable: {
          placements: [],
          sections_per_instructor: {},
        },
        objective: -6,
        solve_time_ms: 47,
      },
      parser_mode: "mock",
    };

    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}