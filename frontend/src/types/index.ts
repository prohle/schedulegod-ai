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
  duration?: number;          // 1.5 or 3.0 (hours)
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

export interface ConflictReport {
  conflicting_operation_indices: number[];
  explanation: string;
  suggestion: string;
}

export interface CandidateProposal {
  section_id: string;
  course_code: string;
  instructor_id: string;
  instructor_name: string;
  feasible: boolean;
  objective_delta?: number;
  load_after?: number;
  reason: string;
}

export interface EmergencyResponse {
  removed_instructor_id: string;
  removed_instructor_name: string;
  affected_section_ids: string[];
  proposals: CandidateProposal[];
  chosen: Record<string, string>;
  healing_notes: string[];
  result?: SolveResult;
  parser_mode: "muse-spark" | "mock";
}

// --- Data ingestion (point the tool at free-form institutional data) ---

export interface ExtractedCourse {
  code: string;
  title: string;
  pattern: string;
  room_type: string;
  seats: number;
  equipment: string[];
}

export interface ExtractedInstructor {
  name: string;
  qualified_courses: string[];
  max_sections: number;
  max_preps: number;
  availability: string;
}

export interface ExtractedRoom {
  name: string;
  building: string;
  capacity: number;
  room_type: string;
  equipment: string[];
}

export interface ExtractedCohort {
  name: string;
  program: string;
  admission_year: number;
  graduation_year: number;
  current_term: number;
  size: number;
}

export interface ExtractedRequirement {
  program: string;
  term: number;
  course: string;
  required: boolean;
}

export interface InstitutionData {
  summary: string;
  buildings: string[];
  courses: ExtractedCourse[];
  instructors: ExtractedInstructor[];
  rooms: ExtractedRoom[];
  cohorts: ExtractedCohort[];
  degree_map: ExtractedRequirement[];
}

export interface IngestResponse {
  scenario: Scenario;
  parsed: InstitutionData;
  parser_mode: "muse-spark" | "mock";
}

// --- Intelligence layer (sparse matrices + spectral radar + AI tightening) ---

export interface SparseMatrixPayload {
  name: string;
  shape: [number, number];
  row_labels: string[];
  col_labels: string[];
  rows: number[];
  cols: number[];
  values: number[];
  nnz: number;
  density: number;
  notes: string;
}

export interface CohortDepth {
  cohort_id: string;
  name: string;
  size: number;
  current_term: number;
  total_terms: number;
  terms_remaining: number;
  completion_fraction: number;
  plan_courses: string[];
  pool_courses: string[];
}

export interface MatricesReport {
  classroom: SparseMatrixPayload;
  fulfilment: SparseMatrixPayload;
  demand: SparseMatrixPayload;
  cohort_sections: SparseMatrixPayload;
  faculty_availability: SparseMatrixPayload;
  faculty_blackouts: SparseMatrixPayload;
  faculty_preferences: SparseMatrixPayload;
  qualification: SparseMatrixPayload;
  department_capacity: number[][];
  dead_zones: [number, number][];
  depth: CohortDepth[];
}

export interface GraphEdge {
  u: string;
  v: string;
  weight: number;
  kind: "cohort" | "instructor";
}

export interface SpectralReport {
  node_labels: string[];
  edges: GraphEdge[];
  laplacian_eigenvalues: number[];
  algebraic_connectivity: number;
  largest_laplacian_eigenvalue: number;
  hoffman_chromatic_lower_bound: number;
  max_clique: string[];
  fiedler_vector: number[];
  spectral_order: string[];
  components: string[][];
  spectral_partition: [string[], string[]];
  deadlock_warnings: string[];
  slot_hints: Record<string, number>;
}

export interface CohortMargin {
  cohort_id: string;
  name: string;
  size: number;
  terms_remaining: number;
  plan_courses: string[];
  pool_courses: string[];
  offered_pool_courses: string[];
  margin: number;
  ok: boolean;
  example_track: string[];
  risk: string;
}

export interface MarginsReport {
  min_courses: number;
  cohorts: CohortMargin[];
  all_ok: boolean;
}

export interface TighteningMove {
  kind: "raise_load_cap" | "add_section" | "add_qualification" | "open_elective" | "drop_request";
  instructor_id?: string;
  course_id?: string;
  cohort_id?: string;
  op_index?: number;
  rationale: string;
  verified: boolean;
  detail: string;
}

export interface TightenResponse {
  trigger: "infeasible" | "margin_shortfall" | "deadlock_warning" | "none";
  evidence: string[];
  muse_mode: "muse-spark" | "mock";
  assessment: string;
  moves: TighteningMove[];
  result?: SolveResult;
  margins?: MarginsReport;
}

export interface RoomUtilization {
  room_id: string;
  name: string;
  capacity: number;
  peak_seats: number;
  utilization: number;
}

export interface FacultyLoad {
  instructor_id: string;
  name: string;
  load: number;
  max_sections: number;
  satisfied: boolean;
  utilization: number;
}

export interface UtilizationReport {
  room_utilization: number;
  rooms: RoomUtilization[];
  faculty: FacultyLoad[];
  all_loads_met: boolean;
}

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const PERIOD_NAMES = ["8:00", "9:30", "11:00", "12:30"];
export const PATTERN_DAYS: Record<string, number[]> = { MWF: [0, 2, 4], TTh: [1, 3] };
export const BLOCK_DAYS = [1, 2, 3];
export const BLOCK_PERIODS = [2, 3];