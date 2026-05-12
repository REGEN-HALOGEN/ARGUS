'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Filter, Download, Server, Bug, Users, Zap, Shield, Loader2 } from 'lucide-react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { apiFetch } from '@/lib/api';

// ─── Dagre Layout ────────────────────────────────────────────────

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

// ─── Custom Node ─────────────────────────────────────────────────

function ArgusNode({ data }: any) {
  const { type, label, properties } = data;

  const Icon = {
    asset: Server,
    cve: Bug,
    threat_actor: Users,
    attack_technique: Zap,
    crown_jewel: Shield,
  }[type as string] || Network;

  const colors = {
    asset: 'text-primary-400 bg-primary-500/15 ring-primary-500/30',
    cve: 'text-threat-400 bg-threat-500/15 ring-threat-500/30',
    threat_actor: 'text-warning-400 bg-warning-500/15 ring-warning-500/30',
    attack_technique: 'text-accent-400 bg-accent-500/15 ring-accent-500/30',
    crown_jewel: 'text-success-400 bg-success-500/15 ring-success-500/30',
  }[type as string] || 'text-slate-400 bg-slate-500/15 ring-slate-500/30';

  return (
    <div className="w-[200px] rounded-xl bg-[#0f1523] ring-1 ring-white/[0.06] shadow-xl overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-1 h-3 rounded-none bg-slate-500 border-none" />
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${colors}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-200 truncate">{label}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate mt-0.5">
              {type.replace('_', ' ')}
            </p>
          </div>
        </div>
        {properties?.severity && (
          <div className="mt-2 flex justify-end">
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-threat-500/20 text-threat-400 font-bold tracking-wider">
              {properties.severity}
            </span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="w-1 h-3 rounded-none bg-slate-500 border-none" />
    </div>
  );
}

const nodeTypes = { argus: ArgusNode };

// ─── Graph Page ──────────────────────────────────────────────────

export default function GraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGraph() {
      try {
        const rawData = await apiFetch<any>('/graph');
        
        // Transform backend schema to React Flow schema
        const flowNodes = rawData.nodes.map((n: any) => ({
          id: n.id,
          type: 'argus',
          data: { type: n.type, label: n.label, properties: n.properties },
          position: { x: 0, y: 0 },
        }));

        const flowEdges = rawData.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#475569', strokeWidth: 2 },
          labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: '#0f1523', fillOpacity: 0.8 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } catch (error) {
        console.error('Failed to load graph:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, [setNodes, setEdges]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Graph Explorer</h1>
          <p className="text-sm text-slate-400 mt-1">Interactive attack graph visualization</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.06]">
            <Filter className="h-4 w-4" /> Filters
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.06]">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex-1 relative rounded-2xl glass-card overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-[#0b0f19]"
          >
            <Background color="#1e293b" gap={24} size={2} />
            <Controls className="bg-[#0c1220]/80 border-white/[0.06] fill-slate-400 backdrop-blur-md" showInteractive={false} />
            <MiniMap 
               nodeColor={(node: any) => {
                  switch (node.data.type) {
                     case 'asset': return '#3b82f6';
                     case 'cve': return '#ef4444';
                     case 'threat_actor': return '#eab308';
                     case 'attack_technique': return '#8b5cf6';
                     case 'crown_jewel': return '#22c55e';
                     default: return '#64748b';
                  }
               }}
               maskColor="rgba(11, 15, 25, 0.8)"
               className="bg-[#0f1523] border-white/[0.06] rounded-xl"
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2 rounded-xl bg-[#0c1220]/90 p-4 ring-1 ring-white/[0.06] backdrop-blur-md">
          <h4 className="text-xs font-semibold text-slate-200 mb-1 uppercase tracking-wider">Node Types</h4>
          {[
            { label: 'Asset', color: 'bg-primary-500' },
            { label: 'CVE', color: 'bg-threat-500' },
            { label: 'Threat Actor', color: 'bg-warning-500' },
            { label: 'Technique', color: 'bg-accent-500' },
            { label: 'Crown Jewel', color: 'bg-success-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              <span className="text-[11px] font-medium text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
