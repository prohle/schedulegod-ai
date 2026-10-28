// Types matching the backend schema
export interface Building {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  name: string;
  building_id: string;
  capacity: number;
  room_type: string;
  equipment: string[];
}

export interface SlotRef {
  day: number;
  period?: number;
}

export interface InstructorPreference {
  kind: "prefer" | "avoid";
  day?: number;
  period?: number;
  course_id?: string;
  weight: number;
}

export interface Instructor {
  id: string;
  name: string;
  qualified_courses: string[];
  max_sections: number;
  max_preps: number;
  hard_unavailable: SlotRef[];
  preferences: InstructorPreference[];
  gridState?: Record<string, string>;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  pattern: "MWF" | "TTh" | "block";
  room_type: string;
  seats: number;
  equipment: string[];
  dept?: string;
  prereqs?: string[];
}

export interface Section {
  id: string;
  course_id: string;
}

export interface Coverage {
  role: string;
  count: number;
}

export interface RoadmapRequirement {
  course_id: string;
  required: boolean;
  seat_estimate?: number;
}

export interface Program {
  id: string;
  name: string;
  roadmap: Record<string, RoadmapRequirement[]>;
}

export interface Cohort {
  id: string;
  program_id: string;
  name: string;
  admission_year: number;
  graduation_year: number;
  current_term: number;
  size: number;
  degree?: string;
  cohortYear?: string;
  completed?: string[];
  requiredRemaining?: string[];
}

export interface RoomBlackout {
  room_id: string;
  day: number;
  period?: number;
}

export interface Scenario {
  name: string;
  buildings: Building[];
  rooms: Room[];
  instructors: Instructor[];
  courses: Course[];
  sections: Section[];
  programs: Program[];
  cohorts: Cohort[];
  distances: Record<string, Record<string, number>>;
  room_blackouts: RoomBlackout[];
  walk_limit_min: number;
  active_enrollment: Record<string, number>;
}

export interface Placement {
  section_id: string;
  course_id: string;
  course_code: string;
  instructor_id: string;
  instructor_name: string;
  days: number[];
  period?: number;
  periods: number[];
  room_id: string;
  room_name: string;
  building_id: string;
}

export interface Timetable {
  placements: Placement[];
  sections_per_instructor: Record<string, number>;
}

export interface SolveResult {
  status: "optimal" | "feasible" | "infeasible";
  timetable?: Timetable;
  objective?: number;
  solve_time_ms: number;
}

export interface Operation {
  op: "add_instructor_unavailability" | "add_instructor_preference" | "add_room_unavailability" | "remove_instructor" | "set_section_instructor" | "update_enrollment";
  instructor_id?: string;
  section_id?: string;
  room_id?: string;
  day?: number;
  period?: number;
  kind?: "prefer" | "avoid";
  weight?: number;
  value?: number;
  explanation: string;
}

export interface ResolutionOption {
  dropped_operation_index: number;
  dropped_explanation: string;
  tradeoff: string;
  result: SolveResult;
}

export interface CopilotResponse {
  summary: string;
  operations: Operation[];
  applied_operations: Operation[];
  dropped_operations: Operation[];
  healing_notes: string[];
  diagnosis?: string;
  diagnosis_mode?: string;
  options: ResolutionOption[];
  result?: SolveResult;
  parser_mode: "muse-spark" | "mock";
}

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const PERIOD_NAMES = ["8:00", "10:00", "13:00", "15:00"];
export const PATTERN_DAYS: Record<string, number[]> = { MWF: [0, 2, 4], TTh: [1, 3] };
export const BLOCK_DAYS = [1, 2, 3];
export const BLOCK_PERIODS = [2, 3];