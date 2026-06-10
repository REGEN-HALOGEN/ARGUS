'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { useTheme } from 'next-themes';
import { Spinner } from '@/components/ui/spinner';
import * as THREE from 'three';

// ─── Types ───────────────────────────────────────────────────────

interface NodeMeta {
  color: string;
  emissive: string;
  label: string;
  shape: 'box' | 'tetrahedron' | 'octahedron' | 'cone' | 'torus' | 'sphere';
}

// ─── Node visual config ──────────────────────────────────────────

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
  return (
    p.name || p.hostname || p.cveId || p.ipAddress || p.title || p.mitreId || node.label || ''
  );
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

// ─── Geometry builders (cached per type) ─────────────────────────

const geometryCache = new Map<string, THREE.BufferGeometry>();

function getGeometry(shape: NodeMeta['shape'], size: number): THREE.BufferGeometry {
  const key = `${shape}-${size}`;
  if (geometryCache.has(key)) return geometryCache.get(key)!;

  let geo: THREE.BufferGeometry;
  switch (shape) {
    case 'box':
      geo = new THREE.BoxGeometry(size * 1.6, size * 1.6, size * 1.6);
      break;
    case 'tetrahedron':
      geo = new THREE.TetrahedronGeometry(size * 1.3);
      break;
    case 'octahedron':
      geo = new THREE.OctahedronGeometry(size * 1.3);
      break;
    case 'cone':
      geo = new THREE.ConeGeometry(size, size * 2.2, 6);
      break;
    case 'torus':
      geo = new THREE.TorusGeometry(size * 0.9, size * 0.35, 12, 24);
      break;
    default:
      geo = new THREE.SphereGeometry(size, 20, 20);
  }
  geometryCache.set(key, geo);
  return geo;
}

// ─── Component ───────────────────────────────────────────────────

export default function MapClient() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<any>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // ─── Resize observer ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
      }
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Fetch graph data ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ nodes: any[]; edges: any[] }>('/graph');
        if (res?.nodes && res?.edges) {
          const links = res.edges.map((e: any) => ({
            source: e.source,
            target: e.target,
            type: e.type,
            id: e.id,
          }));
          setGraphData({ nodes: res.nodes, links });
        }
      } catch (err) {
        console.error('[OrgMap] Failed to load graph:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── D3 force tuning ──────────────────────────────────────────
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = expanded ? -500 : -150;
    const dist = expanded ? 180 : 60;
    fg.d3Force('charge')?.strength(charge);
    fg.d3Force('link')?.distance(dist);
    fg.d3ReheatSimulation();
  }, [expanded, graphData]);

  // ─── 3D node builder ──────────────────────────────────────────
  const nodeThreeObject = useCallback(
    (node: any) => {
      const meta = getNodeMeta(node);
      const size = getNodeSize(node);
      const group = new THREE.Group();

      // Primary mesh — uses MeshPhongMaterial which works well with default lights
      const geo = getGeometry(meta.shape, size);
      const mat = new THREE.MeshPhongMaterial({
        color: meta.color,
        emissive: meta.emissive,
        emissiveIntensity: 0.45,
        shininess: 80,
        transparent: true,
        opacity: 0.92,
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      // Outer glow shell
      const glowGeo = new THREE.SphereGeometry(size * 2, 12, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: meta.color,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(glowGeo, glowMat));

      // Floating text label
      const label = getNodeLabel(node);
      if (label) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = 512;
        canvas.height = 64;
        ctx.clearRect(0, 0, 512, 64);

        // Background pill
        const text = label.length > 28 ? label.slice(0, 26) + '…' : label;
        ctx.font = '600 26px Inter, system-ui, -apple-system, sans-serif';
        const textWidth = ctx.measureText(text).width;
        const pillW = Math.min(textWidth + 32, 500);
        const pillX = (512 - pillW) / 2;

        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.roundRect(pillX, 8, pillW, 48, 12);
        ctx.fill();

        // Border
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 34);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
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
    const dist = 100;
    const ratio = 1 + dist / Math.hypot(node.x, node.y, node.z || 0);
    fg.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: (node.z || 0) * ratio },
      { x: node.x, y: node.y, z: node.z || 0 },
      1200,
    );
  }, []);

  // ─── Theme colors ─────────────────────────────────────────────
  const bgColor = isDark ? '#060b18' : '#f1f5f9';
  const panelBg = isDark ? 'rgba(6, 11, 24, 0.85)' : 'rgba(255, 255, 255, 0.92)';
  const panelBorder = isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(203, 213, 225, 0.7)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  // ─── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: bgColor }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────
  if (graphData.nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: bgColor }}>
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(203,213,225,0.4)', border: `1px solid ${panelBorder}` }}
        >
          <svg className="h-8 w-8" style={{ color: textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 015 0" />
          </svg>
        </div>
        <h3 className="text-base font-semibold" style={{ color: textPrimary }}>No graph data</h3>
        <p className="text-sm max-w-xs text-center" style={{ color: textMuted }}>
          Your organisation has no assets or connections yet. Run the ingestion pipeline to populate.
        </p>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────
  return (
    <div ref={containerRef} className="absolute inset-0" style={{ background: bgColor }}>
      {containerSize && (
        <ForceGraph3D
          ref={fgRef}
          width={containerSize.w}
          height={containerSize.h}
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
      )}

      {/* ─── Top-left controls ───────────────────────────────────── */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        {/* Stats badge */}
        <div
          className="rounded-lg px-3 py-2 text-xs font-medium backdrop-blur-md"
          style={{ background: panelBg, border: `1px solid ${panelBorder}`, color: textMuted }}
        >
          <span style={{ color: textPrimary, fontWeight: 700 }}>{graphData.nodes.length}</span> nodes ·{' '}
          <span style={{ color: textPrimary, fontWeight: 700 }}>{graphData.links.length}</span> connections
        </div>

        {/* Expand / Compress */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="rounded-lg px-3 py-2 text-xs font-semibold backdrop-blur-md transition-all duration-200 cursor-pointer"
          style={{
            background: expanded
              ? isDark ? 'rgba(37, 99, 235, 0.25)' : 'rgba(37, 99, 235, 0.15)'
              : panelBg,
            border: `1px solid ${expanded ? (isDark ? 'rgba(96,165,250,0.5)' : 'rgba(37,99,235,0.4)') : panelBorder}`,
            color: expanded ? (isDark ? '#93c5fd' : '#2563eb') : textPrimary,
          }}
        >
          {expanded ? '⟵ Compress Nodes' : '⟶ Expand Nodes'}
        </button>
      </div>

      {/* ─── Legend (top-right) ───────────────────────────────────── */}
      <div
        className="absolute top-4 right-4 rounded-xl p-4 backdrop-blur-md z-10"
        style={{ background: panelBg, border: `1px solid ${panelBorder}` }}
      >
        <h3
          className="text-[10px] font-bold uppercase tracking-widest mb-3"
          style={{ color: textMuted }}
        >
          Entity Types
        </h3>
        <div className="space-y-2.5">
          {Object.entries(NODE_CONFIG).map(([, cfg]) => (
            <div key={cfg.label} className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  background: cfg.color,
                  boxShadow: `0 0 6px ${cfg.color}50`,
                }}
              />
              <span className="text-xs font-medium" style={{ color: textPrimary }}>{cfg.label}</span>
              <span className="text-[10px] ml-auto" style={{ color: textMuted }}>
                {cfg.shape === 'box' ? '■' : cfg.shape === 'tetrahedron' ? '▲' : cfg.shape === 'octahedron' ? '◆' : cfg.shape === 'cone' ? '▼' : cfg.shape === 'torus' ? '○' : '●'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Hover tooltip ────────────────────────────────────────── */}
      {hovered && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl px-5 py-3 backdrop-blur-md z-20 transition-opacity"
          style={{ background: panelBg, border: `1px solid ${panelBorder}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ background: getNodeMeta(hovered).color, boxShadow: `0 0 8px ${getNodeMeta(hovered).color}60` }}
            />
            <div>
              <div className="text-sm font-semibold" style={{ color: textPrimary }}>
                {getNodeLabel(hovered) || 'Unknown'}
              </div>
              <div className="text-[11px]" style={{ color: textMuted }}>
                {getNodeMeta(hovered).label}
                {hovered.properties?.criticality && ` · ${hovered.properties.criticality}`}
                {hovered.properties?.severity && ` · ${hovered.properties.severity}`}
                {hovered.properties?.cvss != null && ` · CVSS ${hovered.properties.cvss}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Controls hint (bottom-left) ──────────────────────────── */}
      <div
        className="absolute bottom-4 left-4 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed backdrop-blur-md z-10"
        style={{ background: panelBg, border: `1px solid ${panelBorder}`, color: textMuted }}
      >
        <div className="flex items-center gap-4">
          <span>🖱 Drag → Rotate</span>
          <span>⌥ Drag → Pan</span>
          <span>Scroll → Zoom</span>
          <span>Click → Focus</span>
        </div>
      </div>
    </div>
  );
}
