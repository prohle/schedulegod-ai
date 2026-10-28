import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { operations } = await request.json();
    
    // Mock response
    const mockResult = {
      status: "optimal",
      timetable: {
        placements: [],
        sections_per_instructor: {},
      },
      objective: -6,
      solve_time_ms: 47,
    };

    return NextResponse.json(mockResult);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to solve" }, { status: 500 });
  }
}