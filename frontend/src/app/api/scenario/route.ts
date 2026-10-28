import { NextResponse } from "next/server";
import seedScenario from "@/data/seed_scenario.json";

export async function GET() {
  return NextResponse.json(seedScenario);
}