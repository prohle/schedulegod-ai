# ScheduleGod AI — Constraint Catalog (Academic Course Scheduling)

The problem a department scheduler actually solves each term, broken into
entities and constraints. This catalog is the source of truth for three
things: (1) the CP-SAT model, (2) the Muse Spark parsing vocabulary (what
natural-language requests map into), (3) the README/judge documentation.

Entities are deliberately rich because the *offering decision* depends on
cohort progression — you cannot know what to schedule without knowing how far
along each cohort is.

---

## Entities

| Entity | Key attributes |
|---|---|
| **Program** | code, degree roadmap (term-indexed requirements) |
| **Degree roadmap** | per program, per term: **typed requirements** — required courses + **elective pools** with estimated take-up (e.g., "term 5: CS 210, CS 301 required + 1 elective from the pool") |
| **Cohort** | program + **year of admission** + **expected graduation year** + **current term index** ("how far along") → derives the exact set of courses this cohort needs *this term* |
| **Course** | code, credits, meeting pattern (C29), room type need, **equipment needs** (projector, computers, lecture-capture...), seats per section |
| **Section** | offering instance of a course → needs instructor + timeslot(s) + room; **active enrollment** (actual registered count) overrides the projection after add/drop |
| **Instructor** | qualification set, **hard schedule** (blocked slots), **soft schedule** (preferences: mornings, no-Friday, day-off requests), load caps, course preferences — **recorded at the beginning of the semester via intake windows** |
| **Room** | capacity, type (lecture / lab / seminar), **equipment inventory**, building, maintenance blackouts |
| **Building** | node in the **walk-distance matrix** (minutes between every building pair); facility-level closures expressed as room blackouts |
| **Timeslot grid** | days × periods + institutional blackouts |

### Coverage map (the checklist that drives this catalog)

| Real-world consideration | Constraint IDs |
|---|---|
| Facility constraints (closures, maintenance) | C26, C38 |
| Classroom equipment requirements | C34 |
| Classroom size | C24, C25 |
| Campus map distance | C32 |
| Classroom duration (meeting patterns) | C29 |
| Cohort information (admission/grad year, progression) | Entities + C1, C12 |
| Degree map requirements | C1, C2, C4, C35 |
| Course optionality (required vs elective) | C35, C36 |
| Active enrollment (post-registration reality) | C37 |
| Professor hard + soft constraints (semester-start intake) | C13–C22 + intake windows |

---

## A. Offerings & degree requirements — "what to offer"

| ID | Constraint | Type | v1 |
|---|---|---|---|
| C1 | Every course required this term by any active cohort's roadmap position (from admission year + current term index) must be offered ≥1 section | Hard | ✓ |
| C2 | Graduation-critical courses for final-year cohorts must be offered (else graduation slips) | Hard | ✓ |
| C3 | Each cohort should see ≥ N elective sections offered this term | Soft | later |
| C4 | Fall-only / spring-only courses only offered in their allowed term | Hard | ✓ (seed) |
| C5 | Sections per course ≥ ceil(total cohort demand / seats) | Hard | ✓ (seed) |
| C6 | Cross-listed courses (CS 495 = MATH 495) share room+time | Hard | later |

## B. Cohort / student-facing — "a student can actually take the plan"

| ID | Constraint | Type | v1 |
|---|---|---|---|
| C7 | Courses in the same cohort's term plan must not overlap in time | Hard | ✓ |
| C8 | A cohort's plan has ≤ K meetings per day | Hard | ✓ |
| C9 | Cohort load spread across the week (no one-day pileup) | Soft | ✓ |
| C10 | Cohort back-to-back meetings need buildings within walk distance for the gap | Soft→Hard by gap | ✓ |
| C11 | Preserve a common lunch window per cohort | Soft | later |
| C12 | Only cohorts whose progression satisfies prerequisites count demand for a course | Hard (demand model) | ✓ (seed) |

## C. Instructor — "hard and soft schedule + preference" (per instructor)

| ID | Constraint | Type | v1 |
|---|---|---|---|
| C13 | Instructor may only teach courses in their qualification set | Hard | ✓ |
| C14 | Instructor **hard unavailability** (committee, clinical, research days) | Hard | ✓ |
| C15 | Teaching load cap (courses / contact hours per term) | Hard | ✓ |
| C16 | Preparation cap (distinct courses per term) | Hard | ✓ |
| C17 | No overlapping assignments for one instructor | Hard | ✓ |
| C18 | Fatigue cap: ≤ max consecutive teaching periods | Hard | ✓ |
| C19 | **Soft schedule**: preferred days/periods, day-off requests — penalty-weighted | Soft | ✓ |
| C20 | Course preferences (wants / avoid teaching X) | Soft | ✓ |
| C21 | Instructor back-to-back in distant buildings needs adequate gap | Soft→Hard by gap | ✓ |
| C22 | Same course meetings prefer same room/building | Soft | later |

## D. Room & facility

| ID | Constraint | Type | v1 |
|---|---|---|---|
| C23 | One section per room per slot | Hard | ✓ |
| C24 | Room capacity ≥ projected enrollment (sum of cohort demand for that section) | Hard | ✓ |
| C25 | Room type match (labs in lab rooms, etc.) | Hard | ✓ |
| C26 | Room maintenance blackouts | Hard | ✓ |
| C27 | Same course section keeps one room across its weekly meetings | Soft | later |
| C28 | Room utilization spread | Soft | later |

## E. Timeslot structure

| ID | Constraint | Type | v1 |
|---|---|---|---|
| C29 | Meeting-pattern integrity: credits → fixed pattern (MWF 1h, TTh 1.5h, weekly lab block) | Hard | ✓ |
| C30 | Institutional blackouts (convocation, university hour) | Hard | ✓ (seed) |
| C31 | Peak-slot spreading (don't pile everything at 10:00 Tue) | Soft | later |

## F. Campus geography

| ID | Constraint | Type | v1 |
|---|---|---|---|
| C32 | Walk matrix: any person (instructor or cohort) with consecutive obligations needs gap ≥ building-pair walk time | Hard | ✓ |
| C33 | Distance penalties for near-misses (gap barely too short) | Soft | later |

## G. Equipment, electives, enrollment

| ID | Constraint | Type | v1 |
|---|---|---|---|
| C34 | Equipment match: a course's required equipment (projector, computers, lecture-capture, video-conf...) must be a subset of the room's inventory | Hard | ✓ |
| C35 | Elective offerings: each cohort's term plan electives must be offered; seat demand = estimated take-up (explicit estimate or default fraction), not full cohort size | Hard (offering) / Soft (demand) | ✓ |
| C36 | Elective conflict-freedom: for students who choose an elective, it must not overlap that cohort's required courses (v1: conservatively applies to all electives in the term plan) | Hard | ✓ |
| C37 | Active enrollment: after registration closes, actual per-section counts replace projections and re-trigger C24 capacity checks | Hard | ✓ |
| C38 | Building-level closures: a facility outage blacklists all rooms in the building (expressed as per-room blackout operations) | Hard | ✓ |

---

## Live change requests — the Muse Spark parsing vocabulary

What a chair/secretary actually says mid-term, and what each maps to:

| Human says | Operation |
|---|---|
| **(intake window)** "I can't do Mondays, committee Wed 2-4, I'd love CS310, keep me ≤2 preps" | same vocabulary below — parsed from instructor submissions, not just chair directives |
| "Dr. Chen can't teach Tuesdays anymore — committee duty" | `add_instructor_unavailability` (hard) |
| "Dr. Rao would rather not teach before 10" | `add_instructor_preference` (soft) |
| "The CS 2025 cohort tested out of MATH201; they need CS310 this term" | `update_cohort_plan` (changes demand + C1) |
| "East lab is closed for renovation all October" | `add_room_unavailability` |
| "Enrollment surged — CS210 needs another section" | `add_section` (re-opens offering decision) |
| "Dr. Lee is covering for Dr. Okafor in CS220" | `set_section_instructor` |
| "Move the intro lecture to the big hall, the small one is packed" | `set_section_room` |
| "CS 350 enrollment jumped to 45 after registration ended" | `update_enrollment` (re-triggers C24 capacity) |
| **(emergency)** "Dr. Chen is out all next week — who can cover her sections?" | `propose_candidates` — a **query**, not an edit: ranked coverage proposals |

Every operation is guarded by a CP-SAT assumption literal — infeasible
requests produce the minimal conflicting subset, the self-healing hook.

---

## Scheduling lifecycle

### Phase 1 — Intake (per-user constraint windows)
- Department opens a term intake window; **each instructor gets their own
  window with a deadline** to specify hard and soft constraints.
- Instructors submit free text ("I can't do Mondays, committee Wed 2-4, I'd
  love CS310, keep me under 3 preps").
- **Muse Spark parses each submission into the typed constraint vocabulary**
  (C14 → hard schedule, C19/C20 → soft preferences, C15/C16 → load caps),
  validates against the roster/catalog, and bounces structured errors back
  inside the window before it closes.
- Provenance is stored (who said what, when) — the audit trail.

### Phase 2 — Build
- Scheduler runs the CP-SAT model over the merged constraint set.

### Phase 3 — Operate (emergency resource changes)
- An emergency arrives (text or voice — Muse Voice Transcribe):
  "Dr. Chen is out all next week."
- **Impact analysis:** which sections/meetings lose their instructor.
- **Coverage proposal — "who could potentially be available":**
  1. Candidates = qualified for the course (C13) ∩ not hard-blocked in the
     affected slots (C14) ∩ load headroom (C15).
  2. Each candidate is **probed with CP-SAT**: force the candidate onto the
     section → hard-feasible? soft-penalty delta?
  3. Ranked result: `{instructor, feasible?, preference fit, load after,
     distance impact, plain-English reason}` — the LLM explains, the solver
     verifies.
- Scheduler picks a candidate → change applies → timetable re-solves → diff.

---

## v1 solver scope

Decisions: for each section → (instructor, timeslot set, room).
Fixed by seed: program offerings (C1/C2/C5 precomputed from cohorts),
course catalog, room inventory, walk matrix.
Modeled now: C7, C8, C9, C10, C13-C21, C23-C26, C29, C30, C32, C34-C38.
Deferred: C3, C6, C11, C22, C27, C28, C31, C33.

Lifecycle features:
- Intake windows: single-user flow in v1 (one instructor submits free text →
  parse → validate → merge); multi-user windows + deadlines v2.
- Emergency coverage proposals: `propose_candidates` for a lost instructor
  (CP-SAT probe per candidate, ranked) — v1 core, it's the demo centerpiece.
- Persistence (SQLite): constraint provenance + change/event log — powers
  the self-healing execution stream UI. Postgres via docker-compose stays a
  drop-in swap later.
