'use client';

import { Spinner } from '@/components/ui/spinner';
import {
  Background,
  ConnectionLineType,
  Controls,
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
import {
  Bug,
  Crown,
  Filter,
  Flame,
  Globe,
  Server,
  Users,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { apiFetch } from '@/lib/api';
import dagre from 'dagre';

// ─── Colors (hardcoded for light/dark consistency) ───────────────

const NODE_COLORS = {
  asset: { bg: '#1e3a5f', border: '#2563eb', text: '#93c5fd', icon: '#60a5fa', accent: '#3b82f6' },
  cve: { bg: '#4c1d1d', border: '#dc2626', text: '#fca5a5', icon: '#f87171', accent: '#ef4444' },
  crown_jewel: { bg: '#064e3b', border: '#059669', text: '#6ee7b7', icon: '#34d399', accent: '#10b981' },
  threat_actor: { bg: '#451a03', border: '#d97706', text: '#fcd34d', icon: '#fbbf24', accent: '#f59e0b' },
  attack_technique: { bg: '#2e1065', border: '#7c3aed', text: '#c4b5fd', icon: '#a78bfa', accent: '#8b5cf6' },
} as const;

const EDGE_COLORS = {
  HAS_VULNERABILITY: { stroke: '#ef4444', critical: '#dc2626', high: '#f59e0b', medium: '#6b7280' },
  CAN_ACCESS: { stroke: '#3b82f6' },
  CONNECTED_TO: { stroke: '#3b82f6' },
  HOSTS: { stroke: '#10b981' },
  EXPLOITS: { stroke: '#ef4444' },
  USES_TECHNIQUE: { stroke: '#8b5cf6' },
} as const;

// ─── Dagre Layout (fresh instance per call) ──────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

function getLayoutedElements(nodes: any[], edges: any[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 55, ranksep: 160, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    const h = node.data?.type === 'cve' ? 60 : node.data?.type === 'attack_technique' ? 50 : NODE_HEIGHT;
    g.setNode(node.id, { width: NODE_WIDTH, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - (pos.height || NODE_HEIGHT) / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ─── Node Components ─────────────────────────────────────────────

const AssetNode = memo(({ data }: any) => {
  const { label, properties } = data;
  const vulnCount = data.vulnCount || 0;
  const topCvss = data.topCvss || 0;
  const isInternetFacing = properties?.internetFacing === true;

  return (
    <div className="graph-node-asset w-[220px] rounded-xl overflow-hidden"
         style={{ background: NODE_COLORS.asset.bg, border: `1px solid ${NODE_COLORS.asset.border}40` }}>
      <Handle type="target" position={Position.Left}
              style={{ background: NODE_COLORS.asset.accent, border: 'none', width: 6, height: 6 }} />
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: NODE_COLORS.asset.accent }} />
      <div className="p-3 pl-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
               style={{ background: `${NODE_COLORS.asset.accent}20`, border: `1px solid ${NODE_COLORS.asset.accent}30` }}>
            <Server className="h-4 w-4" style={{ color: NODE_COLORS.asset.icon }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate" style={{ color: NODE_COLORS.asset.text }}>{label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {properties?.os && (
                <span className="text-[9px] opacity-60" style={{ color: NODE_COLORS.asset.text }}>
                  {properties.os}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          {isInternetFacing && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: `${NODE_COLORS.asset.accent}20`, color: NODE_COLORS.asset.icon }}>
              <Globe className="h-2.5 w-2.5" /> WAN
            </span>
          )}
          {vulnCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: topCvss >= 9 ? '#dc262620' : topCvss >= 7 ? '#f59e0b20' : '#6b728020',
                           color: topCvss >= 9 ? '#fca5a5' : topCvss >= 7 ? '#fcd34d' : '#9ca3af' }}>
              <Bug className="h-2.5 w-2.5" />
              {vulnCount} CVE{vulnCount > 1 ? 's' : ''}
            </span>
          )}
          {properties?.criticality === 'critical' && (
            <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: '#dc262620', color: '#fca5a5' }}>
              CRITICAL
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right}
              style={{ background: NODE_COLORS.asset.accent, border: 'none', width: 6, height: 6 }} />
    </div>
  );
});
AssetNode.displayName = 'AssetNode';

const CVENode = memo(({ data }: any) => {
  const { label, properties } = data;
  const severity = properties?.severity ?? 'medium';
  const cvss = typeof properties?.cvss === 'object' && properties?.cvss?.toNumber
    ? properties.cvss.toNumber() : Number(properties?.cvss ?? 0);
  const exploited = properties?.exploitedInWild === true;
  const isCritical = severity === 'critical' || cvss >= 9;

  return (
    <div className={`w-[200px] rounded-xl overflow-hidden ${isCritical ? 'graph-node-cve-critical' : ''}`}
         style={{ background: NODE_COLORS.cve.bg, border: `1px solid ${NODE_COLORS.cve.border}40` }}>
      <Handle type="target" position={Position.Left}
              style={{ background: NODE_COLORS.cve.accent, border: 'none', width: 6, height: 6 }} />
      <div className="p-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
               style={{ background: `${NODE_COLORS.cve.accent}20`, border: `1px solid ${NODE_COLORS.cve.accent}30` }}>
            <Bug className="h-3.5 w-3.5" style={{ color: NODE_COLORS.cve.icon }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold font-mono truncate" style={{ color: NODE_COLORS.cve.text }}>{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[10px] font-black px-2 py-0.5 rounded-md"
                style={{ background: cvss >= 9 ? '#dc2626' : cvss >= 7 ? '#d97706' : cvss >= 4 ? '#2563eb' : '#4b5563',
                         color: '#fff' }}>
            {cvss.toFixed(1)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: severity === 'critical' ? '#fca5a5' : severity === 'high' ? '#fcd34d' : '#9ca3af' }}>
            {severity}
          </span>
          {exploited && (
            <span className="inline-flex items-center gap-0.5" title="Exploited in the wild">
              <Flame className="h-3 w-3" style={{ color: '#f87171' }} />
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right}
              style={{ background: NODE_COLORS.cve.accent, border: 'none', width: 6, height: 6 }} />
    </div>
  );
});
CVENode.displayName = 'CVENode';

const CrownJewelNode = memo(({ data }: any) => {
  const { label, properties } = data;

  return (
    <div className="graph-node-crown-jewel w-[220px] rounded-xl overflow-hidden relative"
         style={{ background: NODE_COLORS.crown_jewel.bg, border: `1.5px solid ${NODE_COLORS.crown_jewel.border}80` }}>
      <Handle type="target" position={Position.Left}
              style={{ background: NODE_COLORS.crown_jewel.accent, border: 'none', width: 7, height: 7 }} />
      {/* Rotating ring accent */}
      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full border border-dashed opacity-40"
           style={{ borderColor: NODE_COLORS.crown_jewel.accent, animation: 'crown-ring-spin 8s linear infinite' }} />
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
               style={{ background: `${NODE_COLORS.crown_jewel.accent}25`, border: `1px solid ${NODE_COLORS.crown_jewel.accent}40` }}>
            <Crown className="h-5 w-5" style={{ color: NODE_COLORS.crown_jewel.icon }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate" style={{ color: NODE_COLORS.crown_jewel.text }}>{label}</p>
            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 block"
                  style={{ color: `${NODE_COLORS.crown_jewel.icon}aa` }}>
              ★ Crown Jewel
            </span>
          </div>
        </div>
        {properties?.businessImpact && (
          <div className="mt-2">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{ background: `${NODE_COLORS.crown_jewel.accent}20`, color: NODE_COLORS.crown_jewel.icon }}>
              {properties.businessImpact} impact
            </span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right}
              style={{ background: NODE_COLORS.crown_jewel.accent, border: 'none', width: 7, height: 7 }} />
    </div>
  );
});
CrownJewelNode.displayName = 'CrownJewelNode';

const ThreatActorNode = memo(({ data }: any) => {
  const { label, properties } = data;

  return (
    <div className="graph-node-threat-actor w-[210px] rounded-xl overflow-hidden"
         style={{ background: NODE_COLORS.threat_actor.bg, border: `1px solid ${NODE_COLORS.threat_actor.border}40` }}>
      <Handle type="target" position={Position.Left}
              style={{ background: NODE_COLORS.threat_actor.accent, border: 'none', width: 6, height: 6 }} />
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
               style={{ background: `${NODE_COLORS.threat_actor.accent}20`, border: `1px solid ${NODE_COLORS.threat_actor.accent}30` }}>
            <Users className="h-4 w-4" style={{ color: NODE_COLORS.threat_actor.icon }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate" style={{ color: NODE_COLORS.threat_actor.text }}>{label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {properties?.country && (
                <span className="text-[9px] opacity-70" style={{ color: NODE_COLORS.threat_actor.text }}>
                  {properties.country}
                </span>
              )}
              {properties?.sophistication && (
                <span className="text-[9px] font-bold uppercase px-1 py-0 rounded"
                      style={{ background: `${NODE_COLORS.threat_actor.accent}20`, color: NODE_COLORS.threat_actor.icon }}>
                  {properties.sophistication}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right}
              style={{ background: NODE_COLORS.threat_actor.accent, border: 'none', width: 6, height: 6 }} />
    </div>
  );
});
ThreatActorNode.displayName = 'ThreatActorNode';

const TechniqueNode = memo(({ data }: any) => {
  const { label, properties } = data;

  return (
    <div className="w-[180px] rounded-lg overflow-hidden"
         style={{ background: NODE_COLORS.attack_technique.bg, border: `1px solid ${NODE_COLORS.attack_technique.border}30` }}>
      <Handle type="target" position={Position.Left}
              style={{ background: NODE_COLORS.attack_technique.accent, border: 'none', width: 5, height: 5 }} />
      <div className="p-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: NODE_COLORS.attack_technique.icon }} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold truncate" style={{ color: NODE_COLORS.attack_technique.text }}>{label}</p>
            {properties?.mitreId && (
              <span className="text-[8px] font-mono font-bold opacity-60" style={{ color: NODE_COLORS.attack_technique.text }}>
                {properties.mitreId}
              </span>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right}
              style={{ background: NODE_COLORS.attack_technique.accent, border: 'none', width: 5, height: 5 }} />
    </div>
  );
});
TechniqueNode.displayName = 'TechniqueNode';

const nodeTypes = {
  asset: AssetNode,
  cve: CVENode,
  crown_jewel: CrownJewelNode,
  threat_actor: ThreatActorNode,
  attack_technique: TechniqueNode,
};

// ─── Edge Styling Helper ─────────────────────────────────────────

function buildEdgeStyle(edgeType: string, properties: any) {
  const riskScore = properties?.riskScore;
  const riskRating = properties?.riskRating;

  switch (edgeType) {
    case 'HAS_VULNERABILITY': {
      const color = riskRating === 'critical' ? EDGE_COLORS.HAS_VULNERABILITY.critical
        : riskRating === 'high' ? EDGE_COLORS.HAS_VULNERABILITY.high
        : EDGE_COLORS.HAS_VULNERABILITY.medium;
      return {
        style: { stroke: color, strokeWidth: 2, opacity: 0.8 },
        animated: riskRating === 'critical',
        label: riskScore ? `Risk: ${typeof riskScore === 'object' && riskScore?.toNumber ? riskScore.toNumber() : riskScore}` : undefined,
        labelStyle: { fill: color, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px' },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
      };
    }
    case 'CAN_ACCESS':
    case 'CONNECTED_TO':
      return {
        style: { stroke: EDGE_COLORS.CAN_ACCESS.stroke, strokeWidth: 1.5, strokeDasharray: '6 3', opacity: 0.5 },
        animated: false,
        label: edgeType.replace('_', ' '),
        labelStyle: { fill: '#60a5fa', fontSize: 8, fontWeight: 600, opacity: 0.7 },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
      };
    case 'HOSTS':
      return {
        style: { stroke: EDGE_COLORS.HOSTS.stroke, strokeWidth: 2.5, opacity: 0.8 },
        animated: true,
        label: 'HOSTS',
        labelStyle: { fill: '#34d399', fontSize: 9, fontWeight: 700 },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
      };
    case 'EXPLOITS':
      return {
        style: { stroke: EDGE_COLORS.EXPLOITS.stroke, strokeWidth: 2, opacity: 0.7 },
        animated: true,
        label: 'EXPLOITS',
        labelStyle: { fill: '#f87171', fontSize: 9, fontWeight: 700 },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
      };
    case 'USES_TECHNIQUE':
      return {
        style: { stroke: EDGE_COLORS.USES_TECHNIQUE.stroke, strokeWidth: 1, strokeDasharray: '3 4', opacity: 0.4 },
        animated: false,
        label: undefined,
        labelStyle: {},
        labelBgStyle: {},
      };
    default:
      return {
        style: { stroke: '#475569', strokeWidth: 1.5, opacity: 0.4 },
        animated: false,
        label: edgeType,
        labelStyle: { fill: '#94a3b8', fontSize: 8, fontWeight: 600 },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
      };
  }
}

// ─── CVE Deduplication ───────────────────────────────────────────

function deduplicateGraph(rawNodes: any[], rawEdges: any[]) {
  // Group CVEs by their source asset
  const vulnEdges = rawEdges.filter((e: any) => e.type === 'HAS_VULNERABILITY');
  const otherEdges = rawEdges.filter((e: any) => e.type !== 'HAS_VULNERABILITY');

  // For each asset, find all connected CVEs
  const assetCveMap = new Map<string, { cveNodeId: string; edge: any; cvss: number; severity: string }[]>();
  for (const edge of vulnEdges) {
    const assetId = edge.source;
    const cveNode = rawNodes.find((n: any) => n.id === edge.target);
    if (!cveNode) continue;
    const cvss = typeof cveNode.properties?.cvss === 'object' && cveNode.properties?.cvss?.toNumber
      ? cveNode.properties.cvss.toNumber() : Number(cveNode.properties?.cvss ?? 0);
    if (!assetCveMap.has(assetId)) assetCveMap.set(assetId, []);
    assetCveMap.get(assetId)!.push({
      cveNodeId: cveNode.id,
      edge,
      cvss,
      severity: cveNode.properties?.severity ?? 'medium',
    });
  }

  // Keep only the top CVE per asset, collect IDs of the rest for removal
  const keptCveIds = new Set<string>();
  const keptVulnEdges: any[] = [];
  const assetMeta = new Map<string, { vulnCount: number; topCvss: number }>();

  for (const [assetId, cves] of assetCveMap) {
    // Sort by CVSS descending
    cves.sort((a, b) => b.cvss - a.cvss);
    // Keep top CVE
    const top = cves[0];
    if (top) {
      keptCveIds.add(top.cveNodeId);
      keptVulnEdges.push(top.edge);
    }
    assetMeta.set(assetId, { vulnCount: cves.length, topCvss: top?.cvss ?? 0 });
  }

  // Also keep CVE nodes referenced by non-HAS_VULNERABILITY edges (e.g. EXPLOITS)
  for (const edge of otherEdges) {
    const targetNode = rawNodes.find((n: any) => n.id === edge.target);
    if (targetNode?.type === 'cve') keptCveIds.add(targetNode.id);
    const sourceNode = rawNodes.find((n: any) => n.id === edge.source);
    if (sourceNode?.type === 'cve') keptCveIds.add(sourceNode.id);
  }

  // Filter nodes: keep all non-CVE nodes + only kept CVEs
  const filteredNodes = rawNodes
    .filter((n: any) => n.type !== 'cve' || keptCveIds.has(n.id))
    .map((n: any) => {
      if (n.type === 'asset' && assetMeta.has(n.id)) {
        const meta = assetMeta.get(n.id)!;
        return { ...n, vulnCount: meta.vulnCount, topCvss: meta.topCvss };
      }
      return n;
    });

  const filteredEdges = [...keptVulnEdges, ...otherEdges];
  return { nodes: filteredNodes, edges: filteredEdges };
}

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

  const toggleFilter = useCallback((type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

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

  // Stats for header bar
  const stats = useMemo(() => {
    if (!rawData) return null;
    const counts: Record<string, number> = {};
    for (const n of rawData.nodes) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return { total: rawData.nodes.length, edges: rawData.edges.length, counts };
  }, [rawData]);

  useEffect(() => {
    if (!rawData) return;

    // Deduplicate CVEs first
    const { nodes: dedupedNodes, edges: dedupedEdges } = deduplicateGraph(rawData.nodes, rawData.edges);

    // Filter nodes based on selected types
    const filteredNodes = dedupedNodes.filter((n: any) => visibleTypes.has(n.type));
    const visibleNodeIds = new Set(filteredNodes.map((n: any) => n.id));

    const flowNodes = filteredNodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      data: { type: n.type, label: n.label, properties: n.properties, vulnCount: n.vulnCount, topCvss: n.topCvss },
      position: { x: 0, y: 0 },
    }));

    // Filter edges to only include those between visible nodes
    const flowEdges = dedupedEdges
      .filter((e: any) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e: any) => {
        const edgeStyle = buildEdgeStyle(e.type, e.properties);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          ...edgeStyle,
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 6,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeStyle.style.stroke,
            width: 14,
            height: 14,
          },
        };
      });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [rawData, visibleTypes, setNodes, setEdges]);

  const filterItems = [
    { id: 'asset', label: 'Assets', icon: Server, color: NODE_COLORS.asset.accent },
    { id: 'crown_jewel', label: 'Crown Jewels', icon: Crown, color: NODE_COLORS.crown_jewel.accent },
    { id: 'cve', label: 'Vulnerabilities', icon: Bug, color: NODE_COLORS.cve.accent },
    { id: 'threat_actor', label: 'Threat Actors', icon: Users, color: NODE_COLORS.threat_actor.accent },
    { id: 'attack_technique', label: 'Techniques', icon: Zap, color: NODE_COLORS.attack_technique.accent },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-100px)] flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Graph Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Interactive attack graph visualization
            {stats && (
              <span className="ml-2 opacity-60">
                · {stats.total} nodes · {stats.edges} edges
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
              filtersOpen || visibleTypes.size < 5
                ? 'bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/40'
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
            <div className="absolute top-full right-0 mt-2 w-52 rounded-xl bg-card/95 border border-card-border shadow-2xl backdrop-blur-xl z-50 p-3">
              <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
                Node Visibility
              </h4>
              <div className="space-y-0.5">
                {filterItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-card/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleTypes.has(item.id)}
                      onChange={() => toggleFilter(item.id)}
                      className="h-3.5 w-3.5 accent-primary-500 rounded"
                    />
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm text-muted-foreground/80">{item.label}</span>
                    {stats?.counts[item.id] !== undefined && (
                      <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">
                        {stats.counts[item.id]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative rounded-2xl glass-card overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Spinner size="md" />
            <p className="text-sm text-muted-foreground/60">Loading attack graph…</p>
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
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.05}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
            style={{ background: '#080d19' }}
          >
            <Background
              color="#1e293b"
              gap={28}
              size={1}
            />
            <Controls
              showInteractive={false}
              position="bottom-right"
            />
            <MiniMap
              nodeColor={(node: any) => {
                const colors: Record<string, string> = {
                  asset: NODE_COLORS.asset.accent,
                  cve: NODE_COLORS.cve.accent,
                  crown_jewel: NODE_COLORS.crown_jewel.accent,
                  threat_actor: NODE_COLORS.threat_actor.accent,
                  attack_technique: NODE_COLORS.attack_technique.accent,
                };
                return colors[node.type] || '#64748b';
              }}
              style={{ background: 'rgba(8, 13, 25, 0.7)' }}
              className="border border-card-border rounded-xl"
              maskColor="rgba(255, 255, 255, 0.04)"
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-1.5 rounded-xl p-3 border border-card-border shadow-lg"
             style={{ background: 'rgba(8, 13, 25, 0.85)', backdropFilter: 'blur(12px)' }}>
          <h4 className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider mb-1">
            Legend
          </h4>
          {[
            { label: 'Asset', color: NODE_COLORS.asset.accent, icon: Server },
            { label: 'CVE (Top Risk)', color: NODE_COLORS.cve.accent, icon: Bug },
            { label: 'Crown Jewel', color: NODE_COLORS.crown_jewel.accent, icon: Crown },
            { label: 'Threat Actor', color: NODE_COLORS.threat_actor.accent, icon: Users },
            { label: 'Technique', color: NODE_COLORS.attack_technique.accent, icon: Zap },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <span className="text-[10px] font-medium text-muted-foreground/70">{item.label}</span>
            </div>
          ))}
          <div className="border-t border-card-border my-1" />
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-4 rounded" style={{ background: '#ef4444' }} />
            <span className="text-[10px] text-muted-foreground/60">Vulnerability</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-4 rounded" style={{ background: '#3b82f6', borderTop: '1px dashed #3b82f6' }} />
            <span className="text-[10px] text-muted-foreground/60">Access Path</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-4 rounded" style={{ background: '#10b981' }} />
            <span className="text-[10px] text-muted-foreground/60">Hosts</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
