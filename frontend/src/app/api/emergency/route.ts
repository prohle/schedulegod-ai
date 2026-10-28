import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    const mockEmergency = {
      removed_instructor_id: "chen",
      removed_instructor_name: "Dr. Chen",
      affected_section_ids: ["sec-cs301", "sec-cs310"],
      proposals: [
        {
          section_id: "sec-cs301",
          course_code: "CS 301",
          instructor_id: "okafor",
          instructor_name: "Dr. Okafor",
          feasible: true,
          objective_delta: 0,
          load_after: 2,
          reason: "qualified for CS 301; load 2/3; zero-ripple swap verified by CP-SAT",
        },
        {
          section_id: "sec-cs310",
          course_code: "CS 310",
          instructor_id: "nguyen",
          instructor_name: "Dr. Nguyen",
          feasible: true,
          objective_delta: 8,
          load_after: 1,
          reason: "qualified for CS 310; load 1/2; preference delta 8; zero-ripple swap verified by CP-SAT",
        },
        {
          section_id: "sec-cs301",
          course_code: "CS 301",
          instructor_id: "nguyen",
          instructor_name: "Dr. Nguyen",
          feasible: true,
          objective_delta: 8,
          load_after: 1,
          reason: "qualified for CS 301; load 1/2; preference delta 8; zero-ripple swap verified by CP-SAT",
        },
      ],
      chosen: {
        "sec-cs301": "okafor",
        "sec-cs310": "nguyen",
      },
      healing_notes: [
        "Base timetable built (optimal, 13 ms) — 2 section(s) assigned to Dr. Chen.",
        "Dr. Okafor covers CS 301: qualified for CS 301; load 2/3; zero-ripple swap verified by CP-SAT.",
        "Dr. Nguyen covers CS 310: qualified for CS 310; load 1/2; zero-ripple swap verified by CP-SAT.",
      ],
      result: {
        status: "optimal",
        timetable: {
          placements: [],
          sections_per_instructor: {},
        },
        objective: -6,
        solve_time_ms: 26,
      },
      parser_mode: "mock",
    };

    return NextResponse.json(mockEmergency);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to process emergency" }, { status: 500 });
  }
}