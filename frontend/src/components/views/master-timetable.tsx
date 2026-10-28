"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Sparkles, Filter, X, ChevronLeft, ChevronRight, Plus, Minus, Calendar, Clock, Building, User, Edit, Trash2, GripVertical, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import type { Scenario, Placement, Course, Room, Instructor } from "@/types";

interface MasterTimetableViewProps {
  scenario: Scenario;
  onCopilotMessage: (message: string) => Promise<void>;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIOD_NAMES = ["8:00", "10:00", "13:00", "15:00"];
const TOTAL_SLOTS = 4;
const SLOT_HEIGHT = 80;

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CS: { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-900 dark:text-sky-100", border: "border-l-sky-500" },
  Business: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-900 dark:text-amber-100", border: "border-l-amber-500" },
  Biology: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-900 dark:text-emerald-100", border: "border-l-emerald-500" },
  Humanities: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-900 dark:text-purple-100", border: "border-l-purple-500" },
  default: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-900 dark:text-slate-100", border: "border-l-slate-500" },
};

export function MasterTimetableView({ scenario, onCopilotMessage }: MasterTimetableViewProps) {
  const [roomFilter, setRoomFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState<Placement | null>(null);
  const [dragOver, setDragOver] = useState<{ day: number; slot: number } | null>(null);
  const [draggedPlacement, setDraggedPlacement] = useState<Placement | null>(null);

  // Get unique rooms for filter
  const rooms = useMemo(() => [...new Set(scenario.rooms.map(r => r.name))], [scenario.rooms]);
  const departments = useMemo(() => [...new Set(scenario.courses.map(c => c.dept || "default"))], [scenario.courses]);

  // Build placement map for quick lookup
  const placementMap = useMemo(() => {
    const map = new Map<string, Placement>();
    scenario.rooms.forEach(room => {
      DAY_NAMES.forEach((_, day) => {
        PERIOD_NAMES.forEach((_, slot) => {
          // Key format: day-slot-room
        });
      });
    });
    scenario.sections.forEach(section => {
      const course = scenario.courses.find(c => c.id === section.course_id);
      // We'd need actual placements from the solver result
    });
    return map;
  }, [scenario]);

  // For now, we'll render a sample grid since we need the actual timetable from the solver
  // The real data comes from response.result.timetable.placements

  const handleCellClick = (day: number, slot: number) => {
    // In a real implementation, this would add a new section
  };

  const handleDragOver = (e: React.DragEvent, day: number, slot: number) => {
    e.preventDefault();
    setDragOver({ day, slot });
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, day: number, slot: number) => {
    e.preventDefault();
    setDragOver(null);
    if (!draggedPlacement) return;
    
    const newKey = `${day}-${slot}-${draggedPlacement.room_name}`;
    // In real implementation, this would call an API to move the section
    onCopilotMessage(`Move ${draggedPlacement.course_code} to ${DAY_NAMES[day]} at ${PERIOD_NAMES[slot]} in ${draggedPlacement.room_name}`);
    setDraggedPlacement(null);
  };

  const handleDragStart = (e: React.DragEvent, placement: Placement) => {
    setDraggedPlacement(placement);
    e.dataTransfer.setData("text/plain", placement.section_id);
  };

  const openEditModal = (placement: Placement) => {
    setEditingPlacement(placement);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingPlacement(null);
  };

  const handleSavePlacement = (newInstructorId: string, newRoomName: string) => {
    if (!editingPlacement) return;
    onCopilotMessage(`Move ${editingPlacement.course_code} to ${newRoomName} with instructor ${scenario.instructors.find(i => i.id === newInstructorId)?.name}`);
    closeEditModal();
  };

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      {/* Controls Bar */}
      <div className="bg-muted/50 border-b border-border rounded-t-lg px-3 py-1.5 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-1">
          <span className="font-bold text-muted-foreground text-[11px]">Filters:</span>
          <Select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="w-auto min-w-[150px]">
            <option value="ALL">All Rooms</option>
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-auto min-w-[150px]">
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="primary" size="sm" onClick={() => onCopilotMessage("Auto-solve the full timetable for all cohorts and constraints.")} className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Solve</span>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onCopilotMessage("Clear the entire schedule and start fresh.")} className="flex items-center space-x-1">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Master Timetable Grid */}
      <div className="flex-1 overflow-hidden bg-background flex flex-col min-h-0">
        <TimetableGrid
          scenario={scenario}
          roomFilter={roomFilter}
          deptFilter={deptFilter}
          dragOver={dragOver}
          draggedPlacement={draggedPlacement}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onCellClick={handleCellClick}
          onEdit={openEditModal}
        />
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title="Edit Section Assignment"
        footer={
          <div className="flex items-center justify-end space-x-2">
            <Button variant="destructive" size="sm" onClick={() => onCopilotMessage(`Delete section ${editingPlacement?.section_id}`)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete
            </Button>
            <Button variant="primary" size="sm" onClick={() => {
              const profSelect = document.getElementById("modal-prof-select") as HTMLSelectElement;
              const roomSelect = document.getElementById("modal-room-select") as HTMLSelectElement;
              if (profSelect && roomSelect && editingPlacement) {
                handleSavePlacement(profSelect.value, roomSelect.value);
              }
            }}>
              Save Changes
            </Button>
          </div>
        }
      >
        {editingPlacement && (
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-foreground mb-1">Course:</label>
              <input id="modal-course-id" type="text" readOnly value={editingPlacement.course_code} className="w-full bg-muted border border-input rounded px-2 py-1 font-bold text-primary" />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Assigned Professor:</label>
              <Select id="modal-prof-select" value={editingPlacement.instructor_id} onChange={e => {}} className="w-full">
                {scenario.instructors.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.qualified_courses.join(", ")})</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Assigned Classroom:</label>
              <Select id="modal-room-select" value={editingPlacement.room_name} onChange={e => {}} className="w-full">
                {scenario.rooms.map(r => (
                  <option key={r.name} value={r.name}>{r.name} (Cap {r.capacity}, {r.room_type})</option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TimetableGrid({
  scenario,
  roomFilter,
  deptFilter,
  dragOver,
  draggedPlacement,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onCellClick,
  onEdit,
}: {
  scenario: Scenario;
  roomFilter: string;
  deptFilter: string;
  dragOver: { day: number; slot: number } | null;
  draggedPlacement: any | null;
  onDragOver: (e: React.DragEvent, day: number, slot: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, day: number, slot: number) => void;
  onDragStart: (e: React.DragEvent, placement: any) => void;
  onCellClick: (day: number, slot: number) => void;
  onEdit: (placement: any) => void;
}) {
  // In a real implementation, this would come from the solver result
  // For now, we'll show the structure with empty cells
  // The actual placements would come from response.result.timetable.placements

  const placements = new Map<string, any[]>(); // Would be populated from solver result

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header Row */}
      <div className="grid grid-cols-7 bg-muted/50 border-b border-border font-bold text-[11px] text-muted-foreground shrink-0">
        <div className="p-1.5 text-center border-r border-border bg-muted/50 flex items-center justify-center">Time</div>
        {DAY_NAMES.map(day => (
          <div key={day} className="p-1.5 text-center border-r border-border last:border-r-0 flex items-center justify-center">{day}</div>
        ))}
      </div>

      {/* Grid Rows */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {PERIOD_NAMES.map((periodName, slot) => (
          <div key={slot} className="flex-1 min-h-[80px] grid grid-cols-7 border-t border-border/60">
            <div className="text-[9px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center text-center px-0.5 leading-none">
              {periodName}
            </div>
            {DAY_NAMES.map((_, day) => (
              <TimetableCell
                key={`${day}-${slot}`}
                day={day}
                slot={slot}
                dragOver={dragOver?.day === day && dragOver?.slot === slot}
                onDragOver={(e) => onDragOver(e, day, slot)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, day, slot)}
                onClick={() => onCellClick(day, slot)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimetableCell({
  day,
  slot,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  day: number;
  slot: number;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={cn(
        "border-r border-border/60 last:border-r-0 cursor-pointer p-1 hover:bg-accent/50 transition flex flex-wrap gap-0.5 items-center justify-center min-h-[80px]",
        dragOver && "drag-over-valid"
      )}
    >
      <span className="text-[9px] text-muted-foreground pointer-events-none">+</span>
    </div>
  );
}