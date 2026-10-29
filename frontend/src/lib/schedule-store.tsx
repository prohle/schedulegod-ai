"use client";

// Faithful port of local-design.html's engine: state, constraint evaluation,
// CSP auto-solver, cohort demand, student enrollment, traversal stats.

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

// ===== Calendar parameters (from design) =====
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const START_MINS = 7 * 60 + 30; // 07:30
export const END_MINS = 21 * 60;        // 21:00
export const SLOT_MINS = 30;
export const TOTAL_SLOTS = (END_MINS - START_MINS) / SLOT_MINS; // 27

export function slotToTimeStr(slotIdx: number): string {
  const mins = START_MINS + slotIdx * SLOT_MINS;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ===== Data models (from design) =====
export interface Professor {
  id: string;
  name: string;
  dept: string;
  gridState: Record<string, string>; // "day-slot" -> hard-block | hard-req | soft-pref-hi | soft-avoid
}

export interface Course {
  id: string;
  name: string;
  dept: string;
  roomNeeded: string;
  reqProfs: string[];
  prereqs: string[];
}

export interface Student {
  id: string;
  name: string;
  degree: string;
  cohortYear: string;
  completed: string[];
  requiredRemaining: string[];
}

export interface Section {
  courseId: string;
  profId: string;
  room: string;
  day: number;
  slot: number;
}

// Key format: `${day}-${slot}-${room}`
export type MasterSchedule = Record<string, Section>;

export const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CS: { bg: "bg-sky-100", text: "text-sky-950", border: "border-l-sky-600" },
  Business: { bg: "bg-amber-100", text: "text-amber-950", border: "border-l-amber-600" },
  Biology: { bg: "bg-emerald-100", text: "text-emerald-950", border: "border-l-emerald-600" },
  Humanities: { bg: "bg-purple-100", text: "text-purple-950", border: "border-l-purple-600" },
};

export const ROOM_DISTANCES: Record<string, Record<string, number>> = {
  "Room A101 (Cap 50)": { "Room A101 (Cap 50)": 0, "Room B204 (Cap 40)": 180, "Lab C108 (Cap 30)": 250 },
  "Room B204 (Cap 40)": { "Room A101 (Cap 50)": 180, "Room B204 (Cap 40)": 0, "Lab C108 (Cap 30)": 140 },
  "Lab C108 (Cap 30)": { "Room A101 (Cap 50)": 250, "Room B204 (Cap 40)": 140, "Lab C108 (Cap 30)": 0 },
};

const initialProfessors: Professor[] = [
  { id: "p1", name: "Prof. Alan Turing", dept: "CS", gridState: {} },
  { id: "p2", name: "Prof. Ada Lovelace", dept: "CS", gridState: {} },
  { id: "p3", name: "Prof. Adam Smith", dept: "Business", gridState: {} },
  { id: "p4", name: "Prof. Rosalind Franklin", dept: "Biology", gridState: {} },
];

const initialCourses: Course[] = [
  { id: "CS101", name: "Intro to Programming", dept: "CS", roomNeeded: "Room A101 (Cap 50)", reqProfs: ["p1", "p2"], prereqs: [] },
  { id: "CS301", name: "Data Structures & Algo", dept: "CS", roomNeeded: "Room B204 (Cap 40)", reqProfs: ["p1"], prereqs: ["CS101"] },
  { id: "CS302", name: "Operating Systems", dept: "CS", roomNeeded: "Lab C108 (Cap 30)", reqProfs: ["p2"], prereqs: ["CS301"] },
  { id: "CS401", name: "Database Systems", dept: "CS", roomNeeded: "Room A101 (Cap 50)", reqProfs: ["p1", "p2"], prereqs: ["CS301"] },
  { id: "BUS101", name: "Principles of Mgmt", dept: "Business", roomNeeded: "Room A101 (Cap 50)", reqProfs: ["p3"], prereqs: [] },
  { id: "BUS201", name: "Financial Accounting", dept: "Business", roomNeeded: "Room B204 (Cap 40)", reqProfs: ["p3"], prereqs: ["BUS101"] },
  { id: "BIO101", name: "General Biology I", dept: "Biology", roomNeeded: "Lab C108 (Cap 30)", reqProfs: ["p4"], prereqs: [] },
  { id: "BIO201", name: "Cellular Genetics", dept: "Biology", roomNeeded: "Lab C108 (Cap 30)", reqProfs: ["p4"], prereqs: ["BIO101"] },
];

const initialStudents: Student[] = [
  { id: "s1", name: "Alex Johnson", degree: "B.S. Computer Science", cohortYear: "2025", completed: ["CS101"], requiredRemaining: ["CS301", "CS302", "CS401", "BUS101", "BIO101"] },
  { id: "s2", name: "Jordan Miller", degree: "B.A. Business Administration", cohortYear: "2026", completed: [], requiredRemaining: ["BUS101", "BUS201", "CS101", "BIO101"] },
  { id: "s3", name: "Sam Taylor", degree: "B.S. Biology", cohortYear: "2025", completed: ["BIO101"], requiredRemaining: ["BIO201", "CS101", "BUS101", "CS401"] },
  { id: "s4", name: "Taylor Morgan", degree: "B.S. Computer Science", cohortYear: "2026", completed: [], requiredRemaining: ["CS101", "CS301", "CS302", "CS401"] },
];

export interface ConstraintHealth {
  demandOk: boolean;
  studentsOk: boolean;
  profOk: boolean;
  roomsOk: boolean;
  allPassed: boolean;
}

export interface DemandInfo {
  courseId: string;
  demandingStudents: Student[];
  demandCount: number;
  demandPercentage: number;
  requiredSections: number;
  statusLabel: string;
  badgeClass: string;
}

interface ScheduleStore {
  professors: Professor[];
  courses: Course[];
  students: Student[];
  masterSchedule: MasterSchedule;
  activeProfId: string;
  facultyViewMode: "individual" | "aggregated";
  activeFacTool: string;
  activeStudentId: string;
  addCourse: (course: Course) => void;
  setMasterSchedule: (schedule: MasterSchedule) => void;
  toggleSection: (courseId: string, profId: string, room: string, day: number, slot: number) => void;
  moveSection: (fromKey: string, day: number, slot: number) => void;
  deleteSection: (key: string) => void;
  updateSection: (key: string, profId: string, room: string) => void;
  paintFacCell: (profId: string, slotKey: string, tool: string) => void;
  clearSchedule: () => void;
  autoSolveCSP: () => boolean;
  setActiveProfId: (id: string) => void;
  setFacultyViewMode: (mode: "individual" | "aggregated") => void;
  setActiveFacTool: (tool: string) => void;
  setActiveStudentId: (id: string) => void;
  getCourseCohortDemand: (courseId: string) => DemandInfo;
  getConstraintHealth: () => ConstraintHealth;
  getStudentEnrolledCourses: (student: Student) => Section[];
  getCoursePrereqDepth: (courseId: string) => number;
  getProfTraversalStats: (profId: string) => {
    totalMeters: number;
    totalTransitions: number;
    tightTransitions: number;
    dailyBreakdown: Record<string, { from: string; to: string; dist: number; walkMins: number; time: string }[]>;
  };
  getScheduledCount: (courseId: string) => number;
}

const ScheduleContext = createContext<ScheduleStore | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [professors, setProfessors] = useState<Professor[]>(initialProfessors);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [students] = useState<Student[]>(initialStudents);
  const [masterSchedule, setMasterScheduleState] = useState<MasterSchedule>({});
  const [activeProfId, setActiveProfId] = useState("p1");
  const [facultyViewMode, setFacultyViewMode] = useState<"individual" | "aggregated">("individual");
  const [activeFacTool, setActiveFacTool] = useState("hard-req");
  const [activeStudentId, setActiveStudentId] = useState("s1");

  const setMasterSchedule = useCallback((schedule: MasterSchedule) => setMasterScheduleState(schedule), []);

  const toggleSection = useCallback((courseId: string, profId: string, room: string, day: number, slot: number) => {
    setMasterScheduleState(prev => {
      const next = { ...prev };
      const key = `${day}-${slot}-${room}`;
      if (next[key]) delete next[key];
      else next[key] = { courseId, profId, room, day, slot };
      return next;
    });
  }, []);

  const moveSection = useCallback((fromKey: string, day: number, slot: number) => {
    setMasterScheduleState(prev => {
      if (!prev[fromKey]) return prev;
      const next = { ...prev };
      const oldSec = next[fromKey];
      delete next[fromKey];
      next[`${day}-${slot}-${oldSec.room}`] = { ...oldSec, day, slot };
      return next;
    });
  }, []);

  const deleteSection = useCallback((key: string) => {
    setMasterScheduleState(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const updateSection = useCallback((key: string, profId: string, room: string) => {
    setMasterScheduleState(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      const sec = next[key];
      delete next[key];
      next[`${sec.day}-${sec.slot}-${room}`] = { ...sec, profId, room };
      return next;
    });
  }, []);

  const clearSchedule = useCallback(() => setMasterScheduleState({}), []);

  const paintFacCell = useCallback((profId: string, slotKey: string, tool: string) => {
    setProfessors(prev => prev.map(p => {
      if (p.id !== profId) return p;
      const gridState = { ...p.gridState };
      if (tool === "eraser") delete gridState[slotKey];
      else gridState[slotKey] = tool;
      return { ...p, gridState };
    }));
  }, []);

  const addCourse = useCallback((course: Course) => {
    setCourses(prev => [...prev, course]);
  }, []);

  // ===== Dynamic cohort demand engine (from design) =====
  const getCourseCohortDemand = useCallback((courseId: string): DemandInfo => {
    const demandingStudents = students.filter(s => s.requiredRemaining.includes(courseId));
    const totalCohortSize = students.length;
    const demandPercentage = Math.round((demandingStudents.length / totalCohortSize) * 100);

    let requiredSections = 0;
    let statusLabel = "Low Demand";
    let badgeClass = "bg-slate-100 text-slate-700 border-slate-300";

    if (demandingStudents.length >= 3) {
      requiredSections = 3;
      statusLabel = "High Cohort Demand (Min 3 Sections)";
      badgeClass = "bg-amber-100 text-amber-900 border-amber-300";
    } else if (demandingStudents.length > 0) {
      requiredSections = 1;
      statusLabel = "Moderate Demand (Min 1 Section)";
      badgeClass = "bg-sky-100 text-sky-800 border-sky-300";
    }

    return {
      courseId,
      demandingStudents,
      demandCount: demandingStudents.length,
      demandPercentage,
      requiredSections,
      statusLabel,
      badgeClass,
    };
  }, [students]);

  const getScheduledCount = useCallback((courseId: string) => {
    return Object.values(masterSchedule).filter(s => s.courseId === courseId).length;
  }, [masterSchedule]);

  // ===== Student conflict-free enrollment (from design) =====
  const getStudentEnrolledCourses = useCallback((stud: Student): Section[] => {
    const enrolled: Section[] = [];
    const occupiedTimeKeys = new Set<string>();
    Object.values(masterSchedule).forEach(sec => {
      if (stud.requiredRemaining.includes(sec.courseId)) {
        const timeKey = `${sec.day}-${sec.slot}`;
        if (!occupiedTimeKeys.has(timeKey) && !enrolled.some(e => e.courseId === sec.courseId)) {
          enrolled.push(sec);
          occupiedTimeKeys.add(timeKey);
        }
      }
    });
    return enrolled;
  }, [masterSchedule]);

  // ===== Constraint evaluation engine (from design) =====
  const getConstraintHealth = useCallback((): ConstraintHealth => {
    let demandOk = true, studentsOk = true, profOk = true, roomsOk = true;
    const roomOccupancy: Record<string, boolean> = {};
    const profOccupancy: Record<string, boolean> = {};

    Object.values(masterSchedule).forEach(sec => {
      const slotKey = `${sec.day}-${sec.slot}`;
      const roomKey = `${slotKey}-${sec.room}`;
      if (roomOccupancy[roomKey]) roomsOk = false;
      roomOccupancy[roomKey] = true;

      const profKey = `${slotKey}-${sec.profId}`;
      if (profOccupancy[profKey]) profOk = false;
      profOccupancy[profKey] = true;

      const prof = professors.find(p => p.id === sec.profId);
      if (prof && prof.gridState[slotKey] === "hard-block") profOk = false;
    });

    courses.forEach(c => {
      const demand = getCourseCohortDemand(c.id);
      const count = Object.values(masterSchedule).filter(s => s.courseId === c.id).length;
      if (count < demand.requiredSections) demandOk = false;
    });

    students.forEach(s => {
      const enrolled = getStudentEnrolledCourses(s);
      if (enrolled.length < 4) studentsOk = false;
    });

    return { demandOk, studentsOk, profOk, roomsOk, allPassed: demandOk && studentsOk && profOk && roomsOk };
  }, [masterSchedule, professors, courses, getCourseCohortDemand, getStudentEnrolledCourses]);

  // ===== Prerequisite depth (from design) =====
  const getCoursePrereqDepth = useCallback((courseId: string): number => {
    const course = courses.find(c => c.id === courseId);
    if (!course || course.prereqs.length === 0) return 1;
    let maxChildDepth = 0;
    course.prereqs.forEach(pId => {
      const d = getCoursePrereqDepth(pId);
      if (d > maxChildDepth) maxChildDepth = d;
    });
    return 1 + maxChildDepth;
  }, [courses]);

  // ===== Traversal stats (from design) =====
  const getProfTraversalStats = useCallback((profId: string) => {
    const prof = professors.find(p => p.id === profId);
    let totalMeters = 0, totalTransitions = 0, tightTransitions = 0;
    const dailyBreakdown: Record<string, { from: string; to: string; dist: number; walkMins: number; time: string }[]> = {};

    DAYS.forEach((dayName, dayIdx) => {
      dailyBreakdown[dayName] = [];
      let prevSec: Section | null = null;
      let prevSlot = -1;

      for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
        const sec = Object.values(masterSchedule).find(s => s.profId === profId && s.day === dayIdx && s.slot === slot);
        if (sec) {
          if (prevSec && slot === prevSlot + 1 && prevSec.room !== sec.room) {
            const dist = ROOM_DISTANCES[prevSec.room]?.[sec.room] || 150;
            const estWalkMins = Math.ceil(dist / 80);
            totalMeters += dist;
            totalTransitions++;
            if (estWalkMins > 3) tightTransitions++;
            dailyBreakdown[dayName].push({
              from: prevSec.room.split(" ")[0],
              to: sec.room.split(" ")[0],
              dist,
              walkMins: estWalkMins,
              time: slotToTimeStr(slot),
            });
          }
          prevSec = sec;
          prevSlot = slot;
        }
      }
    });
    void prof;
    return { totalMeters, totalTransitions, tightTransitions, dailyBreakdown };
  }, [professors, masterSchedule]);

  // ===== CSP auto-solver (faithful port from design) =====
  const autoSolveCSP = useCallback((): boolean => {
    const requiredSections: { courseId: string; profId: string; room: string }[] = [];
    courses.forEach(c => {
      const demand = getCourseCohortDemand(c.id);
      for (let i = 0; i < demand.requiredSections; i++) {
        requiredSections.push({ courseId: c.id, profId: c.reqProfs[0] || "p1", room: c.roomNeeded });
      }
    });

    const schedule: MasterSchedule = {};

    function isSlotValid(day: number, slot: number, profId: string, room: string): boolean {
      const slotKey = `${day}-${slot}`;
      const prof = professors.find(p => p.id === profId);
      if (prof && prof.gridState[slotKey] === "hard-block") return false;

      // Room collision
      if (schedule[`${day}-${slot}-${room}`]) return false;

      // Professor collision
      for (const sec of Object.values(schedule)) {
        if (sec.day === day && sec.slot === slot && sec.profId === profId) return false;
      }
      return true;
    }

    function solve(secIdx: number): boolean {
      if (secIdx >= requiredSections.length) return true;
      const sec = requiredSections[secIdx];
      for (let day = 0; day < DAYS.length; day++) {
        for (let slot = 0; slot < TOTAL_SLOTS; slot += 2) {
          const key = `${day}-${slot}-${sec.room}`;
          if (isSlotValid(day, slot, sec.profId, sec.room)) {
            schedule[key] = { ...sec, day, slot };
            if (solve(secIdx + 1)) return true;
            delete schedule[key];
          }
        }
      }
      return false;
    }

    const solved = solve(0);
    if (solved) setMasterScheduleState(schedule);
    return solved;
  }, [courses, professors, getCourseCohortDemand]);

  const value: ScheduleStore = {
    professors, courses, students, masterSchedule,
    activeProfId, facultyViewMode, activeFacTool, activeStudentId,
    addCourse, setMasterSchedule, toggleSection, moveSection, deleteSection,
    updateSection, paintFacCell, clearSchedule, autoSolveCSP,
    setActiveProfId, setFacultyViewMode, setActiveFacTool, setActiveStudentId,
    getCourseCohortDemand, getConstraintHealth, getStudentEnrolledCourses,
    getCoursePrereqDepth, getProfTraversalStats, getScheduledCount,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}