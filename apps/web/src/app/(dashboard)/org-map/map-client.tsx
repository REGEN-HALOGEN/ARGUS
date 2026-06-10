'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { useTheme } from 'next-themes';
import { Spinner } from '@/components/ui/spinner';

// ─── Config ──────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  asset:            '#4f8ff7',
  cve:              '#f06060',
  crown_jewel:      '#f5b731',
  threat_actor:     '#c084fc',
  attack_technique: '#22d3ee',
};

const TYPE_LABELS: Record<string, string> = {
  asset:            'Asset',
  cve:              'CVE',
  crown_jewel:      'Crown Jewel',
  threat_actor:     'Threat Actor',
  attack_technique: 'Technique',
};

const LINK_COLORS: Record<string, string> = {
  HAS_VULNERABILITY: '#ef4444',
  TARGETS:           '#a855f7',
  EXPLOITS:          '#f87171',
  USES_TECHNIQUE:    '#22d3ee',
  CONNECTED_TO:      '#3b82f6',
  CAN_ACCESS:        '#3b82f6',
  HOSTS:             '#10b981',
};

function getType(node: any): string {
  return node.type || (node.labels?.[0]?.toLowerCase().replace(/\s+/g, '_')) || 'unknown';
}

function getName(node: any): string {
  const p = node.properties || {};
  return p.name || p.hostname || p.cveId || p.ipAddress || p.title || p.mitreId || node.label || '';
}

// ─── Component ───────────────────────────────────────────────────

export default function MapClient() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // ─── Resize Observer ───────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const contentRect = entries[0]?.contentRect;
      if (!contentRect) return;
      const { width, height } = contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ nodes: any[]; edges: any[] }>('/graph');
        if (res?.nodes && res?.edges) {
          setGraphData({
            nodes: res.nodes,
            links: res.edges.map((e: any) => ({
              source: e.source,
              target: e.target,
              type: e.type,
              id: e.id,
            })),
          });
        }
      } catch (err) {
        console.error('[OrgMap] Load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── D3 forces ─────────────────────────────────────────────────
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(expanded ? -500 : -120);
    fg.d3Force('link')?.distance(expanded ? 200 : 60);
    fg.d3ReheatSimulation();
  }, [expanded, graphData]);

  // ─── Click-to-focus ────────────────────────────────────────────
  const onNodeClick = useCallback((node: any) => {
    const fg = fgRef.current;
    if (!fg || node.x == null) return;
    const d = 100;
    const r = 1 + d / Math.hypot(node.x, node.y, node.z || 0);
    fg.cameraPosition(
      { x: node.x * r, y: node.y * r, z: (node.z || 0) * r },
      { x: node.x, y: node.y, z: node.z || 0 },
      1200,
    );
  }, []);

  // ─── Theme ─────────────────────────────────────────────────────
  const bg = isDark ? '#060b18' : '#f8fafc';
  const panelBg = isDark ? 'rgba(6,11,24,0.88)' : 'rgba(255,255,255,0.95)';
  const panelBorder = isDark ? 'rgba(51,65,85,0.5)' : 'rgba(203,213,225,0.8)';
  const txt = isDark ? '#f1f5f9' : '#0f172a';
  const txtDim = isDark ? '#94a3b8' : '#64748b';

  // ─── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────────────
  if (!graphData.nodes.length) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: bg }}>
        <p style={{ color: txt, fontWeight: 600, fontSize: 16 }}>No graph data available</p>
        <p style={{ color: txtDim, fontSize: 13 }}>Run the ingestion pipeline to populate the graph.</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {containerSize.w > 0 && containerSize.h > 0 && (
        <ForceGraph3D
          width={containerSize.w}
          height={containerSize.h}
          ref={fgRef}
        graphData={graphData}
        backgroundColor={bg}
        // ─── Use built-in node rendering (proven to work) ──────
        nodeColor={(node: any) => TYPE_COLORS[getType(node)] || '#64748b'}
        nodeVal={(node: any) => {
          const t = getType(node);
          if (t === 'crown_jewel') return 12;
          if (t === 'threat_actor') return 10;
          if (t === 'asset') return 8;
          return 5;
        }}
        nodeLabel={(node: any) => {
          const name = getName(node);
          const type = TYPE_LABELS[getType(node)] || getType(node);
          return `<div style="background:${panelBg};border:1px solid ${panelBorder};border-radius:8px;padding:8px 14px;font-family:Inter,system-ui,sans-serif;backdrop-filter:blur(8px);">
            <div style="font-size:13px;font-weight:600;color:${txt}">${name || 'Unknown'}</div>
            <div style="font-size:11px;color:${txtDim};margin-top:2px">${type}${node.properties?.severity ? ' · ' + node.properties.severity : ''}${node.properties?.criticality ? ' · ' + node.properties.criticality : ''}</div>
          </div>`;
        }}
        nodeOpacity={0.95}
        nodeResolution={16}
        // ─── Links ─────────────────────────────────────────────
        linkColor={(link: any) => LINK_COLORS[link.type] || (isDark ? '#334155' : '#94a3b8')}
        linkWidth={1.2}
        linkOpacity={0.5}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(link: any) => LINK_COLORS[link.type] || '#64748b'}
        // ─── Interactions ──────────────────────────────────────
        onNodeClick={onNodeClick}
        enableNodeDrag
        cooldownTicks={200}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
      />
      )}

      {/* ── Top-left: stats + expand ────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txtDim, backdropFilter: 'blur(12px)' }}>
          <span style={{ color: txt, fontWeight: 700 }}>{graphData.nodes.length}</span> nodes ·{' '}
          <span style={{ color: txt, fontWeight: 700 }}>{graphData.links.length}</span> connections
        </div>
        <button
          onClick={() => setExpanded(p => !p)}
          style={{
            background: expanded ? (isDark ? 'rgba(37,99,235,0.3)' : 'rgba(37,99,235,0.12)') : panelBg,
            border: `1px solid ${expanded ? (isDark ? 'rgba(96,165,250,0.5)' : 'rgba(37,99,235,0.4)') : panelBorder}`,
            borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600,
            color: expanded ? (isDark ? '#93c5fd' : '#2563eb') : txt,
            cursor: 'pointer', backdropFilter: 'blur(12px)',
            transition: 'all 0.2s',
          }}
        >
          {expanded ? '⟵ Compress Nodes' : '⟶ Expand Nodes'}
        </button>
      </div>

      {/* ── Top-right: legend ───────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, right: 16, background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: 16, backdropFilter: 'blur(12px)', zIndex: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: txtDim, marginBottom: 10 }}>Entity Types</div>
        {Object.entries(TYPE_COLORS).map(([key, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}60` }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: txt }}>{TYPE_LABELS[key] || key}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom-left: controls ───────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 11, color: txtDim, backdropFilter: 'blur(12px)', zIndex: 10, display: 'flex', gap: 16 }}>
        <span>🖱 Drag → Rotate</span>
        <span>⌥ Drag → Pan</span>
        <span>Scroll → Zoom</span>
        <span>Click → Focus</span>
      </div>
    </div>
  );
}
