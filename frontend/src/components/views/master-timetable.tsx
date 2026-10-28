"use client";

// Faithful port of local-design.html VIEW 1: Master Schedule Builder.
// 27 thirty-minute slots (7:30–21:00) × 6 days, drag-and-drop sections,
// add-section controls, dept color cards, edit modal.

import { useState } from "react";
import { Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useSchedule, DAYS, TOTAL_SLOTS, START_MINS, SLOT_MINS, slotToTimeStr, DEPT_COLORS, type Section } from "@/lib/schedule-store";

interface MasterTimetableViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export function MasterTimetableView({ onToast }: MasterTimetableViewProps) {
  const {
    professors, courses, masterSchedule,
    toggleSection, moveSection, deleteSection, updateSection, clearSchedule,
  } = useSchedule();

  const [roomFilter, setRoomFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [addCourse, setAddCourse] = useState("CS101");
  const [addProf, setAddProf] = useState("p1");
  const [addRoom, setAddRoom] = useState("Room A101 (Cap 50)");
  const [editModalKey, setEditModalKey] = useState<string | null>(null);
  const [modalProf, setModalProf] = useState("p1");
  const [modalRoom, setModalRoom] = useState("Room A101 (Cap 50)");
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const rooms = ["Room A101 (Cap 50)", "Room B204 (Cap 40)", "Lab C108 (Cap 30)"];
  const departments = [...new Set(courses.map(c => c.dept))];

  const handleClickCell = (day: number, slot: number) => {
    toggleSection(addCourse, addProf, addRoom, day, slot);
  };

  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedKey(key);
    e.dataTransfer.setData("text/plain", key);
  };

  const handleDragOver = (e: React.DragEvent, day: number, slot: number) => {
    e.preventDefault();
    setDragOverCell(`${day}-${slot}`);
  };

  const handleDragLeave = () => setDragOverCell(null);

  const handleDrop = (e: React.DragEvent, day: number, slot: number) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedKey || !masterSchedule[draggedKey]) return;
    moveSection(draggedKey, day, slot);
    setDraggedKey(null);
    onToast("Section Moved", "success");
  };

  const openEditModal = (key: string) => {
    const sec = masterSchedule[key];
    if (!sec) return;
    setEditModalKey(key);
    setModalProf(sec.profId);
    setModalRoom(sec.room);
  };

  const editingSection: Section | null = editModalKey ? masterSchedule[editModalKey] ?? null : null;

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      {/* Controls Bar */}
      <div className="bg-muted/50 border-b border-border rounded-t-lg px-3 py-1.5 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-1">
          <span className="font-bold text-muted-foreground text-[11px]">Add Section:</span>
          <Select value={addCourse} onChange={e => setAddCourse(e.target.value)}>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.id} - {c.name}</option>
            ))}
          </Select>
          <Select value={addProf} onChange={e => setAddProf(e.target.value)}>
            {professors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={addRoom} onChange={e => setAddRoom(e.target.value)}>
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <span className="text-muted-foreground text-[10px]">(Click slot or Drag section)</span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground font-medium text-[11px]">Filter View:</span>
          <Select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}>
            <option value="ALL">All Rooms</option>
            {rooms.map(r => <option key={r} value={r}>{r.split(" (")[0]}</option>)}
          </Select>
          <Select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Button variant="destructive" size="sm" onClick={() => { clearSchedule(); onToast("Master Schedule Cleared"); }}>
            Clear
          </Button>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="flex-1 overflow-hidden bg-background flex flex-col min-h-0">
        {/* Header Row */}
        <div className="grid grid-cols-7 bg-muted border-b border-border font-bold text-[11px] text-muted-foreground shrink-0">
          <div className="p-1.5 text-center border-r border-border bg-muted/70 flex items-center justify-center">Time</div>
          {DAYS.map(day => (
            <div key={day} className="p-1.5 text-center border-r border-border last:border-r-0 flex items-center justify-center">{day}</div>
          ))}
        </div>

        {/* Slot Rows */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
            const timeStr = slotToTimeStr(slot);
            const isHour = (START_MINS + slot * SLOT_MINS) % 60 === 0;
            const borderClass = isHour ? "border-t border-border" : "border-t border-border/50";

            return (
              <div key={slot} className="flex-1 min-h-[28px] grid grid-cols-7 border-t border-border/60">
                <div className={cn("text-[9px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center text-center px-0.5 leading-none", isHour && "border-t-2")}>
                  {timeStr}
                </div>

                {DAYS.map((_, day) => {
                  const cellKey = `${day}-${slot}`;
                  const sectionsInSlot = Object.entries(masterSchedule)
                    .filter(([key, sec]) => {
                      if (sec.day !== day || sec.slot !== slot) return false;
                      const course = courses.find(c => c.id === sec.courseId);
                      return (roomFilter === "ALL" || sec.room === roomFilter) &&
                             (deptFilter === "ALL" || course?.dept === deptFilter);
                    });

                  const isDragOver = dragOverCell === cellKey;

                  return (
                    <div
                      key={`${day}-${slot}`}
                      onClick={() => handleClickCell(day, slot)}
                      onDragOver={e => { e.preventDefault(); setDragOverCell(cellKey); }}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, day, slot)}
                      className={cn(
                        "border-r border-border/50 last:border-r-0 cursor-pointer p-0.5 hover:bg-accent/30 transition flex flex-wrap gap-0.5 items-center justify-center min-h-[30px] relative",
                        isDragOver && "drag-over-valid"
                      )}
                    >
                      {sectionsInSlot.length > 0 ? (
                        sectionsInSlot.map(([key, sec]) => {
                          const prof = professors.find(p => p.id === sec.profId);
                          const course = courses.find(c => c.id === sec.courseId);
                          const colors = DEPT_COLORS[course?.dept || "CS"] || DEPT_COLORS.CS;
                          return (
                            <div
                              key={key}
                              draggable
                              onDragStart={e => handleDragStart(e, key)}
                              onClick={e => { e.stopPropagation(); openEditModal(key); }}
                              className={cn(
                                "flex-1 min-w-[50px] p-0.5 rounded text-[8px] font-bold border-l-2 shadow-sm hover:brightness-95 transition flex flex-col justify-center items-center cursor-grab active:cursor-grabbing",
                                colors.bg, colors.text, colors.border
                              )}
                            >
                              <span className="truncate w-full text-center">{sec.courseId}</span>
                              <span className="text-[7px] opacity-80 truncate w-full text-center">{prof ? prof.name.split(" ").pop() : ""}</span>
                              <span className="text-[6px] opacity-70 truncate w-full text-center">{sec.room.split(" ")[0]}</span>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-[9px] text-muted-foreground/40 pointer-events-none">+</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editModalKey}
        onClose={() => setEditModalKey(null)}
        title="Edit Section Assignment"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (editModalKey) {
                  deleteSection(editModalKey);
                  setEditModalKey(null);
                  onToast("Section Deleted", "success");
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete Section
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (editModalKey) {
                  updateSection(editModalKey, modalProf, modalRoom);
                  setEditModalKey(null);
                  onToast("Section Updated", "success");
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        {editingSection && (
          <div className="space-y-2">
            <div>
              <label className="block font-bold text-foreground mb-1">Course:</label>
              <input
                type="text"
                readOnly
                value={editingSection.courseId}
                className="w-full bg-muted border border-input rounded px-2 py-1 font-bold text-primary"
              />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Assigned Professor:</label>
              <Select value={modalProf} onChange={e => setModalProf(e.target.value)} className="w-full">
                {professors.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Assigned Classroom:</label>
              <Select value={modalRoom} onChange={e => setModalRoom(e.target.value)} className="w-full">
                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-muted-foreground pt-1">
              <GripVertical className="w-3 h-3" />
              Drag the section card to move it to another slot.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}