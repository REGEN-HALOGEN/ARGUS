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
  ArrowDownUp,
  ArrowRightLeft,
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
import { useTheme } from 'next-themes';

// ─── Theme-Aware Color Palettes ──────────────────────────────────

function getNodeColors(isDark: boolean) {
  return isDark
    ? {
        asset: { bg: '#1e3a5f', border: '#2563eb', text: '#93c5fd', icon: '#60a5fa', accent: '#3b82f6' },
        cve: { bg: '#4c1d1d', border: '#dc2626', text: '#fca5a5', icon: '#f87171', accent: '#ef4444' },
        crown_jewel: { bg: '#064e3b', border: '#059669', text: '#6ee7b7', icon: '#34d399', accent: '#10b981' },
        threat_actor: { bg: '#451a03', border: '#d97706', text: '#fcd34d', icon: '#fbbf24', accent: '#f59e0b' },
        attack_technique: { bg: '#2e1065', border: '#7c3aed', text: '#c4b5fd', icon: '#a78bfa', accent: '#8b5cf6' },
      }
    : {
        asset: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a5f', icon: '#2563eb', accent: '#3b82f6' },
        cve: { bg: '#fef2f2', border: '#ef4444', text: '#7f1d1d', icon: '#dc2626', accent: '#ef4444' },
        crown_jewel: { bg: '#ecfdf5', border: '#10b981', text: '#064e3b', icon: '#059669', accent: '#10b981' },
        threat_actor: { bg: '#fffbeb', border: '#f59e0b', text: '#451a03', icon: '#d97706', accent: '#f59e0b' },
        attack_technique: { bg: '#f5f3ff', border: '#8b5cf6', text: '#2e1065', icon: '#7c3aed', accent: '#8b5cf6' },
      };
}

function getCanvasColors(isDark: boolean) {
  return isDark
    ? { bg: '#080d19', gridColor: '#1e293b', labelBg: '#0f172a', minimapMask: 'rgba(0,0,0,0.6)' }
    : { bg: '#f8fafc', gridColor: '#cbd5e1', labelBg: '#ffffff', minimapMask: 'rgba(0,0,0,0.08)' };
}

const EDGE_COLORS = {
  HAS_VULNERABILITY: { stroke: '#ef4444', critical: '#dc2626', high: '#f59e0b', medium: '#6b7280' },
  CAN_ACCESS: { stroke: '#3b82f6' },
  CONNECTED_TO: { stroke: '#3b82f6' },
  HOSTS: { stroke: '#10b981' },
  EXPLOITS: { stroke: '#ef4444' },
  USES_TECHNIQUE: { stroke: '#8b5cf6' },
} as const;

// ─── Dagre Layout ────────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

type LayoutDir = 'LR' | 'TB';

function getLayoutedElements(nodes: any[], edges: any[], direction: LayoutDir) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 55, ranksep: 160, marginx: 40, marginy: 40 });

  const isHorizontal = direction === 'LR';

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
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - (pos.height || NODE_HEIGHT) / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ─── Node Components ─────────────────────────────────────────────

const AssetNode = memo(({ data }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  let { label } = data;
  const { properties, colors, sourcePosition, targetPosition } = data;
  const c = colors?.asset;
  const vulnCount = data.vulnCount || 0;
  const topCvss = data.topCvss || 0;
  const isInternetFacing = properties?.internetFacing === true;

  if (properties?.type === 'server' && properties?.role) {
    let index = '';
    const match = properties.hostname?.match(/-(\d+)$/);
    if (match) {
       index = parseInt(match[1], 10).toString();
    }
    label = index ? `${properties.role} ${index}` : properties.role;
  } else if (properties?.type === 'database' && properties?.purpose) {
    label = `${properties.purpose} DB`;
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="graph-node-asset w-[220px] rounded-xl overflow-hidden"
           style={{ background: c?.bg, border: `1px solid ${c?.border}40` }}>
        <Handle type="target" position={targetPosition ?? Position.Left}
                style={{ background: c?.accent, border: 'none', width: 6, height: 6 }} />
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: c?.accent }} />
        <div className="p-3 pl-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                 style={{ background: `${c?.accent}20`, border: `1px solid ${c?.accent}30` }}>
              <Server className="h-4 w-4" style={{ color: c?.icon }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: c?.text }}>{label}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {properties?.os && (
                  <span className="text-[9px] opacity-60" style={{ color: c?.text }}>
                    {properties.os}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {isInternetFacing && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `${c?.accent}20`, color: c?.icon }}>
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
        <Handle type="source" position={sourcePosition ?? Position.Right}
                style={{ background: c?.accent, border: 'none', width: 6, height: 6 }} />
      </div>

      {isHovered && (
        <div className="absolute z-50 bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[280px] rounded-xl p-3 border border-card-border shadow-2xl backdrop-blur-xl bg-card/95 text-foreground text-xs space-y-2">
          <div className="font-bold border-b border-card-border pb-1 mb-1.5 flex items-center justify-between">
            <span className="truncate">{label}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-black"
                  style={{ background: properties?.criticality === 'critical' ? '#dc262620' : '#4b556320',
                           color: properties?.criticality === 'critical' ? '#fca5a5' : '#9ca3af' }}>
              {properties?.criticality || 'medium'}
            </span>
          </div>
          <div className="space-y-1 opacity-90 text-[11px]">
            <p><strong className="opacity-75">Hostname:</strong> <span className="font-mono text-primary-300">{properties?.hostname || 'N/A'}</span></p>
            <p><strong className="opacity-75">OS:</strong> {properties?.os} {properties?.osVersion}</p>
            <p><strong className="opacity-75">Internet-Facing:</strong> {properties?.internetFacing ? 'Yes (WAN)' : 'No'}</p>
            {properties?.type === 'database' && (
              <>
                <p><strong className="opacity-75">DB Type:</strong> <span className="font-semibold text-emerald-400">{properties?.dbType}</span></p>
                <p><strong className="opacity-75">Purpose:</strong> {properties?.purpose}</p>
              </>
            )}
          </div>
          {data.cves && data.cves.length > 0 && (
            <div className="border-t border-card-border pt-1.5 mt-1.5">
              <p className="font-bold text-[11px] mb-1 text-red-400">Affecting Vulnerabilities ({data.cves.length}):</p>
              <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1">
                {data.cves.map((cve: any) => (
                  <div key={cve.cveId} className="p-1.5 rounded bg-red-950/20 border border-red-900/30">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="font-mono text-red-300">{cve.cveId}</span>
                      <span className="px-1.5 py-0.2 rounded bg-red-600 text-white font-mono text-[9px]">{cve.cvss?.toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] opacity-75 line-clamp-2 mt-0.5 text-muted-foreground">{cve.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
AssetNode.displayName = 'AssetNode';

const CVENode = memo(({ data }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const { label, properties, colors, sourcePosition, targetPosition } = data;
  const c = colors?.cve;
  const severity = properties?.severity ?? 'medium';
  const cvss = typeof properties?.cvss === 'object' && properties?.cvss?.toNumber
    ? properties.cvss.toNumber() : Number(properties?.cvss ?? 0);
  const exploited = properties?.exploitedInWild === true;
  const isCritical = severity === 'critical' || cvss >= 9;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`w-[200px] rounded-xl overflow-hidden ${isCritical ? 'graph-node-cve-critical' : ''}`}
           style={{ background: c?.bg, border: `1px solid ${c?.border}40` }}>
        <Handle type="target" position={targetPosition ?? Position.Left}
                style={{ background: c?.accent, border: 'none', width: 6, height: 6 }} />
        <div className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                 style={{ background: `${c?.accent}20`, border: `1px solid ${c?.accent}30` }}>
              <Bug className="h-3.5 w-3.5" style={{ color: c?.icon }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold font-mono truncate" style={{ color: c?.text }}>{label}</p>
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
        <Handle type="source" position={sourcePosition ?? Position.Right}
                style={{ background: c?.accent, border: 'none', width: 6, height: 6 }} />
      </div>

      {isHovered && (
        <div className="absolute z-50 bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[280px] rounded-xl p-3 border border-card-border shadow-2xl backdrop-blur-xl bg-card/95 text-foreground text-xs space-y-2">
          <div className="font-bold border-b border-card-border pb-1 mb-1.5 flex items-center justify-between">
            <span className="font-mono text-red-300">{label}</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
              CVSS {cvss.toFixed(1)}
            </span>
          </div>
          <div className="space-y-1 text-[11px]">
            <p className="opacity-95 leading-relaxed text-muted-foreground">{properties?.description || 'No description available.'}</p>
            <p className="pt-1"><strong className="opacity-75">Exploited in Wild:</strong> {exploited ? '🔥 Yes' : 'No'}</p>
          </div>
          <div className="border-t border-card-border pt-2 flex justify-end">
            <a
              href={`https://nvd.nist.gov/vuln/detail/${label}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-[10px] px-2 py-1 transition-colors"
            >
              View NVD Page →
            </a>
          </div>
        </div>
      )}
    </div>
  );
});
CVENode.displayName = 'CVENode';

const CrownJewelNode = memo(({ data }: any) => {
  const { label, properties, colors, sourcePosition, targetPosition } = data;
  const c = colors?.crown_jewel;

  return (
    <div className="graph-node-crown-jewel w-[220px] rounded-xl overflow-hidden relative"
         style={{ background: c?.bg, border: `1.5px solid ${c?.border}80` }}>
      <Handle type="target" position={targetPosition ?? Position.Left}
              style={{ background: c?.accent, border: 'none', width: 7, height: 7 }} />
      {/* Rotating ring accent */}
      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full border border-dashed opacity-40"
           style={{ borderColor: c?.accent, animation: 'crown-ring-spin 8s linear infinite' }} />
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
               style={{ background: `${c?.accent}25`, border: `1px solid ${c?.accent}40` }}>
            <Crown className="h-5 w-5" style={{ color: c?.icon }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate" style={{ color: c?.text }}>{label}</p>
            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 block"
                  style={{ color: `${c?.icon}aa` }}>
              ★ Crown Jewel
            </span>
          </div>
        </div>
        {properties?.businessImpact && (
          <div className="mt-2">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{ background: `${c?.accent}20`, color: c?.icon }}>
              {properties.businessImpact} impact
            </span>
          </div>
        )}
      </div>
      <Handle type="source" position={sourcePosition ?? Position.Right}
              style={{ background: c?.accent, border: 'none', width: 7, height: 7 }} />
    </div>
  );
});
CrownJewelNode.displayName = 'CrownJewelNode';

const ThreatActorNode = memo(({ data }: any) => {
  const { label, properties, colors, sourcePosition, targetPosition } = data;
  const c = colors?.threat_actor;

  return (
    <div className="graph-node-threat-actor w-[210px] rounded-xl overflow-hidden"
         style={{ background: c?.bg, border: `1px solid ${c?.border}40` }}>
      <Handle type="target" position={targetPosition ?? Position.Left}
              style={{ background: c?.accent, border: 'none', width: 6, height: 6 }} />
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
               style={{ background: `${c?.accent}20`, border: `1px solid ${c?.accent}30` }}>
            <Users className="h-4 w-4" style={{ color: c?.icon }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate" style={{ color: c?.text }}>{label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {properties?.country && (
                <span className="text-[9px] opacity-70" style={{ color: c?.text }}>
                  {properties.country}
                </span>
              )}
              {properties?.sophistication && (
                <span className="text-[9px] font-bold uppercase px-1 py-0 rounded"
                      style={{ background: `${c?.accent}20`, color: c?.icon }}>
                  {properties.sophistication}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <Handle type="source" position={sourcePosition ?? Position.Right}
              style={{ background: c?.accent, border: 'none', width: 6, height: 6 }} />
    </div>
  );
});
ThreatActorNode.displayName = 'ThreatActorNode';

const TechniqueNode = memo(({ data }: any) => {
  const { label, properties, colors, sourcePosition, targetPosition } = data;
  const c = colors?.attack_technique;

  return (
    <div className="w-[180px] rounded-lg overflow-hidden"
         style={{ background: c?.bg, border: `1px solid ${c?.border}30` }}>
      <Handle type="target" position={targetPosition ?? Position.Left}
              style={{ background: c?.accent, border: 'none', width: 5, height: 5 }} />
      <div className="p-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: c?.icon }} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold truncate" style={{ color: c?.text }}>{label}</p>
            {properties?.mitreId && (
              <span className="text-[8px] font-mono font-bold opacity-60" style={{ color: c?.text }}>
                {properties.mitreId}
              </span>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={sourcePosition ?? Position.Right}
              style={{ background: c?.accent, border: 'none', width: 5, height: 5 }} />
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

function buildEdgeStyle(edgeType: string, properties: any, labelBgFill: string) {
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
        labelBgStyle: { fill: labelBgFill, fillOpacity: 0.9 },
      };
    }
    case 'CAN_ACCESS':
    case 'CONNECTED_TO':
      return {
        style: { stroke: EDGE_COLORS.CAN_ACCESS.stroke, strokeWidth: 1.5, strokeDasharray: '6 3', opacity: 0.5 },
        animated: false,
        label: edgeType.replace('_', ' '),
        labelStyle: { fill: '#60a5fa', fontSize: 8, fontWeight: 600, opacity: 0.7 },
        labelBgStyle: { fill: labelBgFill, fillOpacity: 0.85 },
      };
    case 'HOSTS':
      return {
        style: { stroke: EDGE_COLORS.HOSTS.stroke, strokeWidth: 2.5, opacity: 0.8 },
        animated: true,
        label: 'HOSTS',
        labelStyle: { fill: '#34d399', fontSize: 9, fontWeight: 700 },
        labelBgStyle: { fill: labelBgFill, fillOpacity: 0.9 },
      };
    case 'EXPLOITS':
      return {
        style: { stroke: EDGE_COLORS.EXPLOITS.stroke, strokeWidth: 2, opacity: 0.7 },
        animated: true,
        label: 'EXPLOITS',
        labelStyle: { fill: '#f87171', fontSize: 9, fontWeight: 700 },
        labelBgStyle: { fill: labelBgFill, fillOpacity: 0.9 },
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
        labelBgStyle: { fill: labelBgFill, fillOpacity: 0.85 },
      };
  }
}

// ─── CVE Deduplication ───────────────────────────────────────────

function deduplicateGraph(rawNodes: any[], rawEdges: any[]) {
  // Group CVEs by their source asset
  const vulnEdges = rawEdges.filter((e: any) => e.type === 'HAS_VULNERABILITY');
  const otherEdges = rawEdges.filter((e: any) => e.type !== 'HAS_VULNERABILITY');

  // For each asset, find all connected CVEs
  const assetCveMap = new Map<string, { cveNodeId: string; edge: any; cvss: number; severity: string; cveId: string; description: string }[]>();
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
      cveId: cveNode.properties?.cveId ?? cveNode.id,
      description: cveNode.properties?.description ?? '',
    });
  }

  // Keep only the top CVE per asset, collect IDs of the rest for removal
  const keptCveIds = new Set<string>();
  const keptVulnEdges: any[] = [];
  const assetMeta = new Map<string, { vulnCount: number; topCvss: number; cves: any[] }>();

  for (const [assetId, cves] of assetCveMap) {
    // Sort by CVSS descending
    cves.sort((a, b) => b.cvss - a.cvss);
    // Keep top CVE
    const top = cves[0];
    if (top) {
      keptCveIds.add(top.cveNodeId);
      keptVulnEdges.push(top.edge);
    }
    assetMeta.set(assetId, { vulnCount: cves.length, topCvss: top?.cvss ?? 0, cves });
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
        return { ...n, vulnCount: meta.vulnCount, topCvss: meta.topCvss, cves: meta.cves };
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

  const [layoutDir, setLayoutDir] = useState<LayoutDir>('LR');

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const nodeColors = useMemo(() => getNodeColors(isDark), [isDark]);
  const canvasColors = useMemo(() => getCanvasColors(isDark), [isDark]);

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
      data: {
        type: n.type,
        label: n.label,
        properties: n.properties,
        vulnCount: n.vulnCount,
        topCvss: n.topCvss,
        cves: n.cves,
        colors: nodeColors,
      },
      position: { x: 0, y: 0 },
    }));

    // Filter edges to only include those between visible nodes
    const flowEdges = dedupedEdges
      .filter((e: any) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e: any) => {
        const edgeStyle = buildEdgeStyle(e.type, e.properties, canvasColors.labelBg);
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

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges, layoutDir);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [rawData, visibleTypes, setNodes, setEdges, layoutDir, nodeColors, canvasColors]);

  const filterItems = [
    { id: 'asset', label: 'Assets', icon: Server, color: nodeColors.asset.accent },
    { id: 'crown_jewel', label: 'Crown Jewels', icon: Crown, color: nodeColors.crown_jewel.accent },
    { id: 'cve', label: 'Vulnerabilities', icon: Bug, color: nodeColors.cve.accent },
    { id: 'threat_actor', label: 'Threat Actors', icon: Users, color: nodeColors.threat_actor.accent },
    { id: 'attack_technique', label: 'Techniques', icon: Zap, color: nodeColors.attack_technique.accent },
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
          {/* Layout toggle */}
          <button
            onClick={() => setLayoutDir((d) => (d === 'LR' ? 'TB' : 'LR'))}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all bg-card/50 text-muted-foreground border border-card-border hover:bg-card/80 hover:text-foreground"
            title={layoutDir === 'LR' ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
          >
            {layoutDir === 'LR' ? <ArrowDownUp className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
            {layoutDir === 'LR' ? 'Vertical' : 'Horizontal'}
          </button>

          {/* Filters */}
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
            style={{ background: canvasColors.bg }}
          >
            <Background
              color={canvasColors.gridColor}
              gap={28}
              size={1}
            />
            <Controls
              showInteractive={false}
              position="top-right"
            />
            <MiniMap
              nodeColor={(node: any) => {
                const colors: Record<string, string> = {
                  asset: nodeColors.asset.accent,
                  cve: nodeColors.cve.accent,
                  crown_jewel: nodeColors.crown_jewel.accent,
                  threat_actor: nodeColors.threat_actor.accent,
                  attack_technique: nodeColors.attack_technique.accent,
                };
                return colors[node.type] || '#64748b';
              }}
              maskColor={canvasColors.minimapMask}
              pannable
              zoomable
              style={{ width: 160, height: 100 }}
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-1.5 rounded-xl p-3 border border-card-border shadow-lg"
             style={{ background: isDark ? 'rgba(8, 13, 25, 0.85)' : 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)' }}>
          <h4 className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider mb-1">
            Legend
          </h4>
          {[
            { label: 'Asset', color: nodeColors.asset.accent, icon: Server },
            { label: 'CVE (Top Risk)', color: nodeColors.cve.accent, icon: Bug },
            { label: 'Crown Jewel', color: nodeColors.crown_jewel.accent, icon: Crown },
            { label: 'Threat Actor', color: nodeColors.threat_actor.accent, icon: Users },
            { label: 'Technique', color: nodeColors.attack_technique.accent, icon: Zap },
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
