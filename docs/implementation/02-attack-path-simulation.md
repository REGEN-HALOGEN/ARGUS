# ⚔️ Attack Path Simulation UI — Implementation Guide

> **Priority:** High  
> **Estimated Effort:** 3–4 days  
> **Files:** `apps/web/src/app/(dashboard)/graph/page.tsx`, `apps/api/src/routes/v1/graph.ts`, new components

---

## Overview

The Graph Explorer currently renders a static dagre-layouted view of the knowledge graph using React Flow. This guide covers transforming it into an **interactive attack path simulator** with step-by-step playback, animated threat propagation, and source-to-target path finding.

---

## Current State

| Component | Status |
|---|---|
| `apps/web/.../graph/page.tsx` | ✅ React Flow with dagre layout, custom `ArgusNode`, legend |
| `packages/graph/src/traversal.ts` | ✅ `findShortestPath()`, `findAllPaths()`, `findAttackPathsToCrownJewels()` |
| `apps/api/src/routes/v1/graph.ts` | ✅ `/attack-paths` POST and `/attack-paths/crown-jewels` GET |
| Node pulsing effect | ❌ Not implemented |
| Threat propagation glow | ❌ Not implemented |
| Step-by-step animated playback | ❌ Not implemented |
| Source/Target path finder UI | ❌ Not implemented |
| Filters (by node type, severity) | ❌ Buttons exist but non-functional |
| Export functionality | ❌ Button exists but non-functional |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Graph Explorer Page                     │
├──────────────┬───────────────────┬───────────────────────┤
│  Toolbar     │   ReactFlow       │  Simulation Panel     │
│  - Filters   │   - ArgusNode     │  - Path Selector      │
│  - Layout    │   - AnimatedEdge  │  - Playback Controls  │
│  - Export    │   - ThreatGlow    │  - Step Details       │
└──────────────┴───────────────────┴───────────────────────┘
```

---

## Implementation Steps

### Step 1: Attack Path Simulation State

Create a simulation context to manage playback state:

```typescript
// apps/web/src/components/graph/simulation-context.tsx

'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

interface SimulationStep {
  nodeId: string;
  edgeId?: string;
  label: string;
  type: string;
  description: string;
  riskContribution: number;
}

interface SimulationState {
  isActive: boolean;
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  steps: SimulationStep[];
  speed: number; // ms per step
  attackPathId: string | null;
}

interface SimulationContextValue extends SimulationState {
  startSimulation: (steps: SimulationStep[], pathId: string) => void;
  stopSimulation: () => void;
  play: () => void;
  pause: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setSpeed: (speed: number) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SimulationState>({
    isActive: false,
    isPlaying: false,
    currentStep: 0,
    totalSteps: 0,
    steps: [],
    speed: 1500,
    attackPathId: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startSimulation = useCallback((steps: SimulationStep[], pathId: string) => {
    setState({
      isActive: true,
      isPlaying: false,
      currentStep: 0,
      totalSteps: steps.length,
      steps,
      speed: 1500,
      attackPathId: pathId,
    });
  }, []);

  const stopSimulation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState((prev) => ({
      ...prev,
      isActive: false,
      isPlaying: false,
      currentStep: 0,
      steps: [],
      attackPathId: null,
    }));
  }, []);

  const play = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true }));
    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.currentStep >= prev.totalSteps - 1) {
          clearInterval(intervalRef.current!);
          return { ...prev, isPlaying: false };
        }
        return { ...prev, currentStep: prev.currentStep + 1 };
      });
    }, state.speed);
  }, [state.speed]);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.totalSteps - 1),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, Math.min(step, prev.totalSteps - 1)),
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  return (
    <SimulationContext.Provider
      value={{ ...state, startSimulation, stopSimulation, play, pause, nextStep, prevStep, goToStep, setSpeed }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export const useSimulation = () => {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
};
```

### Step 2: Animated Custom Edge Component

Replace the default smoothstep edges with animated threat-propagation edges:

```typescript
// apps/web/src/components/graph/animated-edge.tsx

'use client';

import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { useSimulation } from './simulation-context';

export function ThreatEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, id, data } = props;
  const simulation = useSimulation();

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  // Determine if this edge is part of the active simulation
  const isActive = simulation.isActive && simulation.steps.some(
    (step, i) => step.edgeId === id && i <= simulation.currentStep,
  );

  const isCurrentStep = simulation.isActive && simulation.steps[simulation.currentStep]?.edgeId === id;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: isCurrentStep ? '#ef4444' : isActive ? '#f59e0b' : '#475569',
          strokeWidth: isCurrentStep ? 3 : isActive ? 2.5 : 1.5,
          filter: isCurrentStep ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' : 'none',
          transition: 'all 0.5s ease',
        }}
      />
      {/* Animated particle along the edge during active simulation */}
      {isCurrentStep && (
        <circle r="4" fill="#ef4444" filter="url(#glow)">
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  );
}
```

### Step 3: Enhanced ArgusNode with Pulse Animation

Update the existing `ArgusNode` in `graph/page.tsx` to support simulation state:

```typescript
// Modify the ArgusNode component to accept simulation state

function ArgusNode({ data }: any) {
  const simulation = useSimulation();
  const { type, label, properties } = data;

  // Check simulation state for this node
  const nodeStepIndex = simulation.steps.findIndex((s) => s.nodeId === data.nodeId);
  const isReached = simulation.isActive && nodeStepIndex !== -1 && nodeStepIndex <= simulation.currentStep;
  const isCurrentNode = simulation.isActive && simulation.steps[simulation.currentStep]?.nodeId === data.nodeId;

  return (
    <div
      className={`w-[200px] rounded-xl bg-[#0f1523] ring-1 shadow-xl overflow-hidden transition-all duration-500
        ${isCurrentNode
          ? 'ring-threat-500/60 shadow-threat-500/30 shadow-lg scale-110'
          : isReached
            ? 'ring-warning-500/40 shadow-warning-500/20 shadow-md'
            : 'ring-white/[0.06]'
        }`}
      style={{
        animation: isCurrentNode ? 'pulse-threat 2s infinite' : undefined,
      }}
    >
      {/* ... existing node content ... */}

      {/* Threat propagation indicator */}
      {isReached && (
        <div className="absolute inset-0 rounded-xl pointer-events-none">
          <div
            className={`absolute inset-0 rounded-xl ${
              isCurrentNode
                ? 'bg-threat-500/10 animate-pulse'
                : 'bg-warning-500/5'
            }`}
          />
        </div>
      )}
    </div>
  );
}
```

### Step 4: Simulation Control Panel

```typescript
// apps/web/src/components/graph/simulation-panel.tsx

'use client';

import { useSimulation } from './simulation-context';
import { Play, Pause, SkipForward, SkipBack, Square, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function SimulationPanel() {
  const sim = useSimulation();

  if (!sim.isActive) return null;

  const currentStep = sim.steps[sim.currentStep];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-6 right-6 z-20 w-80 rounded-2xl bg-[#0c1220]/95 ring-1 ring-white/[0.08] backdrop-blur-xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Attack Simulation</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Step {sim.currentStep + 1} of {sim.totalSteps}
            </p>
          </div>
          <button
            onClick={sim.stopSimulation}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-threat-500/15 text-threat-400 hover:bg-threat-500/25"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Current Step Info */}
        {currentStep && (
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-threat-500 animate-pulse" />
              <span className="text-xs font-medium text-threat-400 uppercase tracking-wider">
                {currentStep.type.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-slate-200 font-medium">{currentStep.label}</p>
            <p className="text-xs text-slate-400 mt-1">{currentStep.description}</p>
          </div>
        )}

        {/* Progress Bar */}
        <div className="px-4 pt-3">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-warning-500 to-threat-500"
              animate={{ width: `${((sim.currentStep + 1) / sim.totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-3 p-4">
          <button
            onClick={sim.prevStep}
            disabled={sim.currentStep === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] disabled:opacity-30"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={sim.isPlaying ? sim.pause : sim.play}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30 hover:bg-primary-500/30"
          >
            {sim.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          <button
            onClick={sim.nextStep}
            disabled={sim.currentStep >= sim.totalSteps - 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] disabled:opacity-30"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2 px-4 pb-4">
          <Gauge className="h-3 w-3 text-slate-500" />
          <span className="text-[10px] text-slate-500">Speed</span>
          <input
            type="range"
            min={500}
            max={3000}
            step={250}
            value={3500 - sim.speed}
            onChange={(e) => sim.setSpeed(3500 - Number(e.target.value))}
            className="flex-1 accent-primary-500 h-1"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

### Step 5: Path Finder Sidebar

```typescript
// apps/web/src/components/graph/path-finder.tsx

'use client';

import { useState } from 'react';
import { Search, Crosshair, Zap, Loader2 } from 'lucide-react';
import { useSimulation } from './simulation-context';
import { apiFetch } from '@/lib/api';

interface PathFinderProps {
  nodes: { id: string; data: { label: string; type: string } }[];
}

export function PathFinder({ nodes }: PathFinderProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const simulation = useSimulation();

  const handleFindPaths = async () => {
    if (!sourceId || !targetId) return;
    setLoading(true);

    try {
      const data = await apiFetch<any>('/graph/attack-paths', {
        method: 'POST',
        body: JSON.stringify({
          sourceId,
          targetId,
          maxHops: 6,
        }),
      });

      if (data.nodes.length > 0) {
        // Convert graph data to simulation steps
        const steps = data.nodes.map((node: any, i: number) => ({
          nodeId: node.id,
          edgeId: data.edges[i]?.id,
          label: node.label,
          type: node.type,
          description: `Step ${i + 1}: ${node.type.replace('_', ' ')} — ${node.label}`,
          riskContribution: node.properties?.cvss ?? 0,
        }));

        simulation.startSimulation(steps, `${sourceId}-${targetId}`);
      }
    } catch (error) {
      console.error('Path finding failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrownJewelPaths = async () => {
    setLoading(true);
    try {
      const paths = await apiFetch<any[]>('/graph/attack-paths/crown-jewels');
      if (paths.length > 0) {
        const topPath = paths[0];
        const steps = topPath.nodes.map((node: any, i: number) => ({
          nodeId: node.id,
          edgeId: topPath.edges[i]?.id,
          label: node.label,
          type: node.type,
          description: `${node.type.replace('_', ' ')} — ${node.label}`,
          riskContribution: node.properties?.cvss ?? 0,
        }));
        simulation.startSimulation(steps, topPath.id);
      }
    } catch (error) {
      console.error('Crown jewel paths failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-6 right-6 z-10 w-72 rounded-2xl bg-[#0c1220]/95 ring-1 ring-white/[0.06] backdrop-blur-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
        Path Finder
      </h4>

      {/* Source selector */}
      <select
        value={sourceId}
        onChange={(e) => setSourceId(e.target.value)}
        className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-300 ring-1 ring-white/[0.06] outline-none"
      >
        <option value="">Select source node...</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.data.label} ({n.data.type})
          </option>
        ))}
      </select>

      {/* Target selector */}
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-300 ring-1 ring-white/[0.06] outline-none"
      >
        <option value="">Select target node...</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.data.label} ({n.data.type})
          </option>
        ))}
      </select>

      {/* Actions */}
      <button
        onClick={handleFindPaths}
        disabled={loading || !sourceId || !targetId}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-500/15 px-3 py-2 text-xs font-medium text-primary-300 ring-1 ring-primary-500/30 hover:bg-primary-500/25 disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
        Find Attack Paths
      </button>

      <button
        onClick={handleCrownJewelPaths}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-threat-500/15 px-3 py-2 text-xs font-medium text-threat-300 ring-1 ring-threat-500/30 hover:bg-threat-500/25 disabled:opacity-40"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
        Crown Jewel Paths
      </button>
    </div>
  );
}
```

### Step 6: CSS Animations

Add to `apps/web/src/app/globals.css`:

```css
/* ─── Attack Simulation Animations ─────────────────────────────── */

@keyframes pulse-threat {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 20px 8px rgba(239, 68, 68, 0.15);
  }
}

@keyframes propagation-glow {
  0% { opacity: 0; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 0; transform: scale(1.2); }
}

.threat-propagation::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%);
  animation: propagation-glow 2s ease-in-out infinite;
  pointer-events: none;
}

/* SVG glow filter for edge particles */
.react-flow svg defs {
  /* defined inline */
}
```

### Step 7: SVG Glow Filter Definition

Add an SVG filter definition to the ReactFlow component:

```tsx
<ReactFlow {...props}>
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
  {/* ... rest of ReactFlow children ... */}
</ReactFlow>
```

---

## API Enhancements Needed

### Improve the attack path response format

Update `packages/graph/src/traversal.ts` → `findAttackPathsToCrownJewels()` to return ordered node sequences (currently the node ID extraction is incomplete):

```typescript
// The current implementation has a TODO — it needs to extract nodes from the path
// Fix: extract nodes directly from the path object returned by Neo4j

export async function findAttackPathsToCrownJewels(
  maxHops = 8,
  limit = 20,
): Promise<AttackPath[]> {
  const cypher = `
    MATCH path = (entry:Asset {internetFacing: true})-[*..${maxHops}]->(crown:CrownJewel)
    WITH path,
         reduce(score = 0, n IN nodes(path) | score + COALESCE(n.cvss, 0)) AS pathRisk,
         [n IN nodes(path) | {
           id: elementId(n),
           labels: labels(n),
           props: properties(n)
         }] AS pathNodes,
         [r IN relationships(path) | {
           id: elementId(r),
           type: type(r),
           source: elementId(startNode(r)),
           target: elementId(endNode(r))
         }] AS pathRels
    RETURN pathNodes, pathRels, pathRisk
    ORDER BY pathRisk DESC
    LIMIT ${limit}
  `;

  // ... transform pathNodes and pathRels into AttackPath objects
}
```

---

## Rollout Checklist

- [ ] Create `SimulationProvider` context
- [ ] Build `ThreatEdge` animated edge component
- [ ] Update `ArgusNode` with pulse/glow effects
- [ ] Build `SimulationPanel` with playback controls
- [ ] Build `PathFinder` sidebar component
- [ ] Add CSS keyframe animations to `globals.css`
- [ ] Fix `findAttackPathsToCrownJewels()` to return ordered node sequences
- [ ] Register `ThreatEdge` as a custom edge type in React Flow
- [ ] Wrap Graph page in `SimulationProvider`
- [ ] Add SVG glow filter definitions
- [ ] Implement Filters panel (filter by node type, severity, internet-facing)
- [ ] Implement Export button (PNG screenshot via `html-to-image` or JSON export)
- [ ] Test with 50+ node graphs for performance
