"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Clock, GraduationCap, AlertTriangle, CheckCircle2, Target, AlertCircle, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Scenario, Course, Cohort } from "@/types";

interface GraphViewProps {
  scenario: Scenario;
}

export function GraphView({ scenario }: GraphViewProps) {
  const [selectedStudentId, setSelectedStudentId] = useState(scenario.cohorts[0]?.id || "");
  const [currentTerm, setCurrentTerm] = useState(1);
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");

  const selectedStudent = scenario.cohorts.find(s => s.id === selectedStudentId) || scenario.cohorts[0];

  // Build nodes and edges for the DAG
  const { nodes, edges, nodePositions } = useMemo(() => {
    return buildDAG(scenario, selectedStudent);
  }, [scenario, selectedStudent]);

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="bg-muted/50 border-b border-border rounded-t-lg p-2.5 shrink-0 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              Course Prerequisites & DAG Graduation Timeline
            </h2>
            <p className="text-[11px] text-muted-foreground">Directed Acyclic Graph (DAG) for prerequisite dependencies and term path traversals.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <span className="font-medium text-muted-foreground">Highlight Cohort Path:</span>
          <Select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="bg-primary/10 text-primary font-bold border-primary/50 rounded px-2 py-0.5 text-xs">
            {scenario.cohorts.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.degree})</option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => setLayout(l => l === "horizontal" ? "vertical" : "horizontal")} className="text-[11px]">
            {layout === "horizontal" ? "Vertical" : "Horizontal"} Layout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* DAG Visualization */}
        <div className="flex-1 min-h-[400px] bg-muted/30 relative p-4 overflow-auto custom-scrollbar">
          <DAGVisualization
            nodes={nodes}
            edges={edges}
            layout={layout}
            student={selectedStudent}
            nodePositions={nodePositions}
          />
        </div>

        {/* Graduation Timeline Metrics Side Panel */}
        <div className="w-full lg:w-96 bg-card p-3 flex flex-col overflow-y-auto custom-scrollbar shrink-0 lg:border-l lg:border-border">
          <h3 className="font-bold text-xs text-foreground mb-2 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            Graduation Timeline & Traversal Simulator
          </h3>

          {/* Traversal Player Bar */}
          <div className="bg-muted/50 border border-border rounded-lg p-2 mb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-foreground mb-1.5">
              <span>Term Traversal Simulator:</span>
              <span className="text-primary">Term {currentTerm} (Intro)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => setCurrentTerm(t => Math.max(1, t - 1))} disabled={currentTerm <= 1} className="px-2 py-1">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all duration-300" style={{ width: `${(currentTerm / 4) * 100}%` }} />
              </div>
              <Button variant="primary" size="sm" onClick={() => setCurrentTerm(t => Math.min(4, t + 1))} disabled={currentTerm >= 4} className="px-2 py-1">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <GraduationTimelineDetails scenario={scenario} student={selectedStudent} currentTerm={currentTerm} />
        </div>
      </div>
    </div>
  );
}

// DAG Visualization Component
function DAGVisualization({ 
  nodes, 
  edges, 
  layout, 
  student, 
  nodePositions 
}: { 
  nodes: DAGNode[]; 
  edges: DAGEdge[]; 
  layout: "horizontal" | "vertical";
  student: Cohort;
  nodePositions: Record<string, { x: number; y: number }>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Calculate positions if not provided
  const positions = useMemo(() => {
    if (Object.keys(nodePositions).length > 0) return nodePositions;
    return calculateLayout(nodes, edges, layout, dimensions);
  }, [nodes, edges, layout, dimensions, nodePositions]);

  return (
    <svg 
      ref={svgRef} 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="bg-transparent"
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
        </marker>
        <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
      </defs>
      
      {/* Edges */}
      <g stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)">
        {edges.map(edge => {
          const source = positions[edge.from];
          const target = positions[edge.to];
          if (!source || !target) return null;
          
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          
          // Curved path
          const cpX = layout === "horizontal" 
            ? source.x + (target.x - source.x) * 0.5
            : source.x;
          const cpY = layout === "horizontal"
            ? source.y
            : source.y + (target.y - source.y) * 0.5;
          
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={`M ${source.x} ${source.y} Q ${cpX} ${cpY} ${target.x} ${target.y}`}
              stroke="#94a3b8"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
      </g>
      
      {/* Nodes */}
      <g>
        {nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          
          const isCompleted = student.completed?.includes(node.id) || false;
          const isRequired = student.requiredRemaining?.includes(node.id) || false;
          const isCurrent = node.id === student.requiredRemaining?.[0];
          
          let borderColor = "#0284c7";
          let bgColor = "url(#nodeGradient)";
          if (isCompleted) borderColor = "#10b981";
          else if (isRequired) borderColor = "#f59e0b";
          else if (isCurrent) borderColor = "#8b5cf6";
          
          return (
            <g key={node.id} transform={`translate(${pos.x - 100}, ${pos.y - 40})`}>
              <rect
                x="0" y="0"
                width="200" height="80"
                rx="8"
                fill="url(#nodeGradient)"
                stroke={borderColor}
                strokeWidth={isRequired || isCompleted ? 3 : 1}
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
              />
              <text x="100" y="25" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0f172a">
                {node.code}
              </text>
              <text x="100" y="45" textAnchor="middle" fontSize="10" fill="#64748b">
                {node.title}
              </text>
              <text x="100" y="65" textAnchor="middle" fontSize="9" fill="#94a3b8">
                {node.pattern} • {node.room_type}
              </text>
              {isCompleted && (
                <text x="190" y="15" textAnchor="end" fontSize="10" fill="#10b981">✓</text>
              )}
              {isCurrent && !isCompleted && (
                <text x="190" y="15" textAnchor="end" fontSize="10" fill="#0284c7">●</text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

interface DAGNode {
  id: string;
  code: string;
  title: string;
  pattern: string;
  room_type: string;
}

interface DAGEdge {
  from: string;
  to: string;
}

function buildDAG(scenario: Scenario, student: Cohort) {
  const nodes: DAGNode[] = scenario.courses.map(course => ({
    id: course.id,
    code: course.code,
    title: course.title,
    pattern: course.pattern,
    room_type: course.room_type,
  }));

  const edges: DAGEdge[] = [];
  scenario.courses.forEach(course => {
    if (course.prereqs) {
      course.prereqs.forEach((prereq: string) => {
        edges.push({ from: prereq, to: course.id });
      });
    }
  });

  return { nodes, edges, nodePositions: {} as Record<string, { x: number; y: number }> };
}

function calculateLayout(
  nodes: DAGNode[], 
  edges: DAGEdge[], 
  layout: "horizontal" | "vertical",
  dimensions: { width: number; height: number }
) {
  const positions: Record<string, { x: number; y: number }> = {};
  
  // Simple topological layout
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  
  function assignLevel(nodeId: string): number {
    if (visited.has(nodeId)) return levels.get(nodeId) || 0;
    visited.add(nodeId);
    
    const incomingEdges = edges.filter(e => e.to === nodeId);
    if (incomingEdges.length === 0) {
      levels.set(nodeId, 0);
      return 0;
    }
    
    const maxLevel = Math.max(...incomingEdges.map(e => assignLevel(e.from)));
    const level = maxLevel + 1;
    levels.set(nodeId, level);
    return level;
  }
  
  nodes.forEach(n => assignLevel(n.id));
  
  const maxLevel = Math.max(...Array.from(levels.values()));
  const levelCounts = new Map<number, number>();
  levels.forEach((level) => {
    levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
  });
  
  const levelOffsets = new Map<number, number>();
  levelCounts.forEach((count, level) => {
    levelOffsets.set(level, -((count - 1) * 220) / 2);
  });
  
  const levelIndex = new Map<number, number>();
  
  nodes.forEach(node => {
    const level = levels.get(node.id) || 0;
    const index = levelIndex.get(level) || 0;
    levelIndex.set(level, index + 1);
    
    const offset = levelOffsets.get(level) || 0;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    
    if (layout === "horizontal") {
      positions[node.id] = {
        x: centerX + (level - maxLevel / 2) * 250 + (levelOffsets.get(level) || 0) + (Array.from(levels.values()).filter(l => l === level).indexOf(level) * 220),
        y: centerY + offset
      };
    } else {
      positions[node.id] = {
        x: centerX + offset,
        y: centerY + (level - maxLevel / 2) * 120 + (levelOffsets.get(level) || 0) + (Array.from(levels.values()).filter(l => l === level).indexOf(level) * 120)
      };
    }
  });
  
  return positions;
}

function GraduationTimelineDetails({ scenario, student, currentTerm }: { scenario: Scenario; student: Cohort; currentTerm: number }) {
  return (
    <div>
      <div className="bg-muted/50 border border-border rounded-lg p-3 mb-3">
        <div className="font-bold text-sm text-foreground mb-2">{student.name}</div>
        <div className="text-[11px] text-muted-foreground">{student.degree}</div>
        <div className="text-[10px] text-muted-foreground mt-1">Cohort: {student.cohortYear} | Admitted: {student.admission_year}</div>
      </div>

      <div className="space-y-2">
        {scenario.courses.slice(0, 8).map((course, idx) => {
          const isCompleted = student.completed?.includes(course.id) || false;
          const isRequired = student.requiredRemaining?.includes(course.id) || false;
          const isCurrent = idx === currentTerm - 1;

          let statusIcon = <Clock className="w-3.5 h-3.5 text-slate-400" />;
          let statusClass = "text-slate-500";
          let statusLabel = "Upcoming";

          if (isCompleted) { statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />; statusClass = "text-emerald-600"; statusLabel = "Completed"; }
          else if (isCurrent) { statusIcon = <Target className="w-3.5 h-3.5 text-sky-500" />; statusClass = "text-sky-600"; statusLabel = "Current"; }
          else if (isRequired) { statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />; statusClass = "text-amber-600"; statusLabel = "Required"; }

          return (
            <div key={course.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {statusIcon}
                </div>
                <div>
                  <div className="font-bold text-xs text-foreground">{course.code}</div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{course.title}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={isCompleted ? "success" : isCurrent ? "info" : isRequired ? "warning" : "default"} className="text-[10px]">{statusLabel}</Badge>
                {course.prereqs && course.prereqs.length > 0 && (
                  <Badge variant="info" className="text-[9px]">{course.prereqs.length} prereqs</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start space-x-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-800 dark:text-amber-200">Degree Delay Risk</div>
            <div className="text-amber-700 dark:text-amber-300 mt-1">
              Missing required courses may delay graduation. Review course sequence before registration.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];