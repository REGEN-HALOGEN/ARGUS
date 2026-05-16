'use client';

import {
  Background,
  ConnectionLineType,
  type Edge,
  Handle,
  MarkerType,
  MiniMap,
  type Node,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { motion } from 'framer-motion';
import { Bug, Download, Filter, Loader2, Network, Server, Shield, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { apiFetch } from '@/lib/api';
import dagre from 'dagre';

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

  const Icon =
    {
      asset: Server,
      cve: Bug,
      threat_actor: Users,
      attack_technique: Zap,
      crown_jewel: Shield,
    }[type as string] || Network;

  const colors =
    {
      asset: 'text-primary-400 bg-primary-500/15 ring-primary-500/30',
      cve: 'text-threat-400 bg-threat-500/15 ring-threat-500/30',
      threat_actor: 'text-warning-400 bg-warning-500/15 ring-warning-500/30',
      attack_technique: 'text-accent-400 bg-accent-500/15 ring-accent-500/30',
      crown_jewel: 'text-success-400 bg-success-500/15 ring-success-500/30',
    }[type as string] || 'text-muted-foreground bg-slate-500/15 ring-slate-500/30';

  return (
    <div className="w-[200px] rounded-xl bg-card border border-card-border shadow-xl overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="w-1 h-3 rounded-none bg-muted-foreground border-none"
      />
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${colors}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{label}</p>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider truncate mt-0.5">
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
      <Handle
        type="source"
        position={Position.Right}
        className="w-1 h-3 rounded-none bg-muted-foreground border-none"
      />
    </div>
  );
}

const nodeTypes = { argus: ArgusNode };

// ─── Graph Page ──────────────────────────────────────────────────

export default function GraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<{ nodes: any[]; edges: any[] } | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['asset', 'cve', 'threat_actor', 'attack_technique', 'crown_jewel']),
  );

  const toggleFilter = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  useEffect(() => {
    async function loadGraph() {
      try {
        const data = await apiFetch<any>('/graph');
        setRawData(data);
      } catch (error) {
        console.error('Failed to load graph:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGraph();
  }, []);

  useEffect(() => {
    if (!rawData) return;

    // Filter nodes based on selected types
    const flowNodes = rawData.nodes
      .filter((n: any) => visibleTypes.has(n.type))
      .map((n: any) => ({
        id: n.id,
        type: 'argus',
        data: { type: n.type, label: n.label, properties: n.properties },
        position: { x: 0, y: 0 },
      }));

    // Filter edges to only include those between visible nodes
    const visibleNodeIds = new Set(flowNodes.map((n: any) => n.id));
    const flowEdges = rawData.edges
      .filter((e: any) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.type,
        type: 'smoothstep',
        animated: true,
                style: { stroke: 'var(--muted-foreground)', strokeWidth: 2, opacity: 0.6 },
        labelStyle: { fill: 'var(--foreground)', fontSize: 12, fontWeight: 700 },
        labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.95 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--muted-foreground)' },
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowEdges,
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [rawData, visibleTypes, setNodes, setEdges]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 h-[calc(100vh-100px)] flex flex-col"
    >
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Graph Explorer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interactive attack graph visualization
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 transition-all ${
              filtersOpen || visibleTypes.size < 5
                ? 'bg-primary-500/20 text-primary-300 ring-primary-500/40'
                : 'bg-card/50 text-muted-foreground border border-card-border hover:bg-card/60'
            }`}
          >
            <Filter className="h-4 w-4" /> Filters
            {visibleTypes.size < 5 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500/30 text-[10px] font-bold text-primary-200">
                {visibleTypes.size}
              </span>
            )}
          </button>

          {filtersOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 rounded-xl bg-card/95 border border-card-border shadow-2xl backdrop-blur-xl z-50">
              <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
                Node Visibility
              </h4>
              <div className="space-y-1">
                {[
                  { id: 'asset', label: 'Assets' },
                  { id: 'crown_jewel', label: 'Crown Jewels' },
                  { id: 'cve', label: 'Vulnerabilities' },
                  { id: 'threat_actor', label: 'Threat Actors' },
                  { id: 'attack_technique', label: 'Techniques' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg p-2 hover:bg-card/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleTypes.has(item.id)}
                      onChange={() => toggleFilter(item.id)}
                      className="h-3.5 w-3.5 accent-primary-500 rounded border-card-border bg-card/50"
                    />
                    <span className="text-sm text-muted-foreground/80">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="flex items-center gap-2 rounded-lg bg-card/50 px-3 py-2 text-sm text-muted-foreground ring-1 border border-card-border hover:bg-card/60">
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
            className="bg-background"
          >
            <Background
              color="currentColor"
              className="text-muted-foreground/20"
              gap={24}
              size={1}
            />
            <MiniMap
              nodeColor={(node: any) => {
                switch (node.data.type) {
                  case 'asset':
                    return '#3b82f6';
                  case 'cve':
                    return '#ef4444';
                  case 'threat_actor':
                    return '#eab308';
                  case 'attack_technique':
                    return '#8b5cf6';
                  case 'crown_jewel':
                    return '#22c55e';
                  default:
                    return '#64748b';
                }
              }}
              maskColor="rgba(var(--background-rgb), 0.7)"
              className="bg-card/50 border border-card-border rounded-xl backdrop-blur-md"
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2 rounded-xl bg-card/80 p-4 border border-card-border backdrop-blur-md shadow-lg">
          <h4 className="text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
            Node Types
          </h4>
          {[
            { label: 'Asset', color: 'bg-primary-500' },
            { label: 'CVE', color: 'bg-threat-500' },
            { label: 'Threat Actor', color: 'bg-warning-500' },
            { label: 'Technique', color: 'bg-accent-500' },
            { label: 'Crown Jewel', color: 'bg-success-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
