'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { useTheme } from 'next-themes';
import { Spinner } from '@/components/ui/spinner';
import * as THREE from 'three';

// ─── Node visual config ──────────────────────────────────────────

interface NodeMeta {
  color: string;
  emissive: string;
  label: string;
  shape: 'box' | 'tetrahedron' | 'octahedron' | 'cone' | 'torus' | 'sphere';
}

const NODE_CONFIG: Record<string, NodeMeta> = {
  asset:            { color: '#4f8ff7', emissive: '#2563eb', label: 'Asset',       shape: 'box' },
  cve:              { color: '#f06060', emissive: '#dc2626', label: 'CVE',          shape: 'tetrahedron' },
  crown_jewel:      { color: '#f5b731', emissive: '#d97706', label: 'Crown Jewel', shape: 'octahedron' },
  threat_actor:     { color: '#c084fc', emissive: '#9333ea', label: 'Threat Actor', shape: 'cone' },
  attack_technique: { color: '#22d3ee', emissive: '#0891b2', label: 'Technique',   shape: 'torus' },
};

const LINK_COLORS: Record<string, string> = {
  HAS_VULNERABILITY: 'rgba(240,96,96,0.6)',
  TARGETS:           'rgba(192,132,252,0.6)',
  EXPLOITS:          'rgba(248,113,113,0.6)',
  USES_TECHNIQUE:    'rgba(34,211,238,0.5)',
  CONNECTED_TO:      'rgba(79,143,247,0.4)',
  CAN_ACCESS:        'rgba(79,143,247,0.4)',
  HOSTS:             'rgba(16,185,129,0.5)',
};

const FALLBACK_META: NodeMeta = {
  color: '#64748b', emissive: '#475569', label: 'Unknown', shape: 'sphere',
};

function getNodeType(node: any): string {
  return node.type || (node.labels?.[0]?.toLowerCase().replace(/\s+/g, '_')) || 'unknown';
}

function getNodeMeta(node: any): NodeMeta {
  return NODE_CONFIG[getNodeType(node)] || FALLBACK_META;
}

function getNodeLabel(node: any): string {
  const p = node.properties || {};
  return p.name || p.hostname || p.cveId || p.ipAddress || p.title || p.mitreId || node.label || '';
}

function getNodeSize(node: any): number {
  const t = getNodeType(node);
  switch (t) {
    case 'crown_jewel':  return 7;
    case 'threat_actor': return 6;
    case 'asset':        return 5;
    default:             return 4;
  }
}

// ─── Geometry factory (cached) ───────────────────────────────────

const geoCache = new Map<string, THREE.BufferGeometry>();

function makeGeometry(shape: NodeMeta['shape'], size: number): THREE.BufferGeometry {
  const key = `${shape}_${size}`;
  if (geoCache.has(key)) return geoCache.get(key)!;
  let g: THREE.BufferGeometry;
  switch (shape) {
    case 'box':         g = new THREE.BoxGeometry(size * 1.6, size * 1.6, size * 1.6); break;
    case 'tetrahedron': g = new THREE.TetrahedronGeometry(size * 1.3); break;
    case 'octahedron':  g = new THREE.OctahedronGeometry(size * 1.3); break;
    case 'cone':        g = new THREE.ConeGeometry(size, size * 2.2, 6); break;
    case 'torus':       g = new THREE.TorusGeometry(size * 0.9, size * 0.35, 12, 24); break;
    default:            g = new THREE.SphereGeometry(size, 20, 20);
  }
  geoCache.set(key, g);
  return g;
}

// ─── Component ───────────────────────────────────────────────────

export default function MapClient() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<any>(null);

  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // ─── Fetch graph data ──────────────────────────────────────────
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
        console.error('[OrgMap] Failed to load graph:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── D3 forces ─────────────────────────────────────────────────
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(expanded ? -500 : -150);
    fg.d3Force('link')?.distance(expanded ? 180 : 60);
    fg.d3ReheatSimulation();
  }, [expanded, graphData]);

  // ─── 3D node builder ──────────────────────────────────────────
  const nodeThreeObject = useCallback(
    (node: any) => {
      const meta = getNodeMeta(node);
      const size = getNodeSize(node);
      const group = new THREE.Group();

      // Main mesh
      const mat = new THREE.MeshLambertMaterial({
        color: meta.color,
        emissive: meta.emissive,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.92,
      });
      group.add(new THREE.Mesh(makeGeometry(meta.shape, size), mat));

      // Glow
      const glowMat = new THREE.MeshBasicMaterial({
        color: meta.color,
        transparent: true,
        opacity: 0.07,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(size * 2, 10, 10), glowMat));

      // Label
      const label = getNodeLabel(node);
      if (label) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 512, 64);

        const text = label.length > 28 ? label.slice(0, 26) + '…' : label;
        ctx.font = '600 26px Inter, system-ui, sans-serif';
        const tw = ctx.measureText(text).width;
        const pw = Math.min(tw + 32, 500);
        const px = (512 - pw) / 2;

        ctx.fillStyle = isDark ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.roundRect(px, 8, pw, 48, 12);
        ctx.fill();
        ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 34);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
        );
        sprite.scale.set(28, 3.5, 1);
        sprite.position.set(0, size * 2.2 + 4, 0);
        group.add(sprite);
      }

      return group;
    },
    [isDark],
  );

  // ─── Click to focus ────────────────────────────────────────────
  const handleNodeClick = useCallback((node: any) => {
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

  // ─── Theme colours ─────────────────────────────────────────────
  const bgColor = isDark ? '#060b18' : '#f1f5f9';
  const panelBg = isDark ? 'rgba(6,11,24,0.88)' : 'rgba(255,255,255,0.92)';
  const panelBorder = isDark ? 'rgba(51,65,85,0.5)' : 'rgba(203,213,225,0.7)';
  const txtMain = isDark ? '#f1f5f9' : '#0f172a';
  const txtMuted = isDark ? '#94a3b8' : '#64748b';

  // ─── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgColor }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Empty ─────────────────────────────────────────────────────
  if (graphData.nodes.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: bgColor }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${panelBorder}`, background: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(203,213,225,0.4)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={txtMuted} strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 015 0"/></svg>
        </div>
        <p style={{ color: txtMain, fontWeight: 600, fontSize: 16 }}>No graph data</p>
        <p style={{ color: txtMuted, fontSize: 13, maxWidth: 280, textAlign: 'center' }}>Run the ingestion pipeline to populate your organisation graph.</p>
      </div>
    );
  }

  // ─── Main ──────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={(link: any) => LINK_COLORS[link.type] || 'rgba(100,116,139,0.3)'}
        linkWidth={1.2}
        linkOpacity={0.6}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.8}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(link: any) => LINK_COLORS[link.type] || 'rgba(100,116,139,0.5)'}
        backgroundColor={bgColor}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => setHovered(node || null)}
        enableNodeDrag
        cooldownTicks={200}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
      />

      {/* ── Top-left: stats + expand ────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txtMuted, backdropFilter: 'blur(12px)' }}>
          <span style={{ color: txtMain, fontWeight: 700 }}>{graphData.nodes.length}</span> nodes ·{' '}
          <span style={{ color: txtMain, fontWeight: 700 }}>{graphData.links.length}</span> connections
        </div>
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{
            background: expanded ? (isDark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.15)') : panelBg,
            border: `1px solid ${expanded ? (isDark ? 'rgba(96,165,250,0.5)' : 'rgba(37,99,235,0.4)') : panelBorder}`,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: expanded ? (isDark ? '#93c5fd' : '#2563eb') : txtMain,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
          }}
        >
          {expanded ? '⟵ Compress Nodes' : '⟶ Expand Nodes'}
        </button>
      </div>

      {/* ── Top-right: legend ───────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, right: 16, background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: 16, backdropFilter: 'blur(12px)', zIndex: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.5, color: txtMuted, marginBottom: 10 }}>Entity Types</div>
        {Object.entries(NODE_CONFIG).map(([, cfg]) => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.color, boxShadow: `0 0 6px ${cfg.color}50` }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: txtMain }}>{cfg.label}</span>
            <span style={{ fontSize: 10, marginLeft: 'auto', color: txtMuted }}>
              {cfg.shape === 'box' ? '■' : cfg.shape === 'tetrahedron' ? '▲' : cfg.shape === 'octahedron' ? '◆' : cfg.shape === 'cone' ? '▼' : '○'}
            </span>
          </div>
        ))}
      </div>

      {/* ── Hover tooltip ───────────────────────────────────────── */}
      {hovered && (
        <div style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '10px 20px', backdropFilter: 'blur(12px)', zIndex: 20, whiteSpace: 'nowrap' as const }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: getNodeMeta(hovered).color, boxShadow: `0 0 8px ${getNodeMeta(hovered).color}60` }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: txtMain }}>{getNodeLabel(hovered) || 'Unknown'}</div>
              <div style={{ fontSize: 11, color: txtMuted }}>
                {getNodeMeta(hovered).label}
                {hovered.properties?.criticality ? ` · ${hovered.properties.criticality}` : ''}
                {hovered.properties?.severity ? ` · ${hovered.properties.severity}` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom-left: controls ───────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 11, color: txtMuted, backdropFilter: 'blur(12px)', zIndex: 10, display: 'flex', gap: 16 }}>
        <span>🖱 Drag → Rotate</span>
        <span>⌥ Drag → Pan</span>
        <span>Scroll → Zoom</span>
        <span>Click → Focus</span>
      </div>
    </div>
  );
}
