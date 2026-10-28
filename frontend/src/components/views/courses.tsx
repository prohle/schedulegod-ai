"use client";

// Faithful port of local-design.html VIEW 4: Dynamic Cohort Demand & Catalog.
import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useSchedule } from "@/lib/schedule-store";

interface CoursesViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export function CoursesView({ onToast }: CoursesViewProps) {
  const { courses, professors, getCourseCohortDemand, getScheduledCount, addCourse } = useSchedule();
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("CS");
  const [newRoom, setNewRoom] = useState("Room A101 (Cap 50)");

  const handleAdd = () => {
    const id = newId.toUpperCase().trim();
    if (!id || !newName.trim()) {
      onToast("Course code and name are required", "error");
      return;
    }
    addCourse({ id, name: newName.trim(), dept: newDept, roomNeeded: newRoom, reqProfs: [professors[0]?.id || "p1"], prereqs: ["CS101"] });
    setShowAdd(false);
    setNewId("");
    setNewName("");
    onToast(`Added Course ${id}`, "success");
  };

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      <div className="bg-muted/50 border-b border-border rounded-t-lg p-3 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm text-foreground">Dynamic Student Cohort Demand Matrix</h2>
          <p className="text-xs text-muted-foreground">Course popularity is calculated in real time based on active student cohorts and outstanding degree requirements.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} className="flex items-center space-x-1 shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Course</span>
        </Button>
      </div>

      <div className="flex-1 bg-muted/30 p-3 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {courses.map(c => {
            const demand = getCourseCohortDemand(c.id);
            const scheduledCount = getScheduledCount(c.id);
            const meetsDemand = scheduledCount >= demand.requiredSections;
            return (
              <div key={c.id} className={cn("bg-card border p-3 rounded-lg flex flex-col justify-between shadow-sm relative overflow-hidden", meetsDemand ? "border-border" : "border-amber-400 dark:border-amber-600")}>
                {!meetsDemand && <AlertTriangle className="absolute top-2 right-2 w-4 h-4 text-amber-500" />}
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-extrabold text-primary text-sm">{c.id}</span>
                    <Badge variant="default" className={demand.badgeClass}>{demand.demandCount} Students Need ({demand.demandPercentage}%)</Badge>
                  </div>
                  <h3 className="font-bold text-xs text-foreground mb-2">{c.name}</h3>
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div>Dept: <strong className="text-foreground">{c.dept}</strong></div>
                    <div>Demanding Students: <strong className="text-foreground">{demand.demandingStudents.map(s => s.name.split(" ")[0]).join(", ") || "None"}</strong></div>
                    <div>Required Room: <strong className="text-foreground">{c.roomNeeded}</strong></div>
                    <div>Prerequisites: <strong className="text-foreground">{c.prereqs.length > 0 ? c.prereqs.join(", ") : "None"}</strong></div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium">Scheduled Sections:</span>
                  <strong className={cn("font-bold text-xs", meetsDemand ? "text-emerald-600" : "text-amber-600")}>
                    {scheduledCount} / {demand.requiredSections} Needed
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Course"
        footer={
          <div className="flex items-center justify-end space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAdd}>Add Course</Button>
          </div>
        }>
        <div className="space-y-3">
          <div>
            <label className="block font-bold text-foreground mb-1">Course Code:</label>
            <input type="text" value={newId} onChange={e => setNewId(e.target.value)} placeholder="e.g., CS202" className="w-full bg-input border border-border rounded px-2 py-1 text-foreground" />
          </div>
          <div>
            <label className="block font-bold text-foreground mb-1">Course Name:</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Advanced Algorithms" className="w-full bg-input border border-border rounded px-2 py-1 text-foreground" />
          </div>
          <div>
            <label className="block font-bold text-foreground mb-1">Department:</label>
            <Select value={newDept} onChange={e => setNewDept(e.target.value)} className="w-full">
              <option value="CS">Computer Science</option>
              <option value="Business">Business</option>
              <option value="Biology">Biology</option>
              <option value="Humanities">Humanities</option>
            </Select>
          </div>
          <div>
            <label className="block font-bold text-foreground mb-1">Required Room:</label>
            <Select value={newRoom} onChange={e => setNewRoom(e.target.value)} className="w-full">
              <option value="Room A101 (Cap 50)">Room A101 (50 cap)</option>
              <option value="Room B204 (Cap 40)">Room B204 (40 cap)</option>
              <option value="Lab C108 (Cap 30)">Lab C108 (30 cap)</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}