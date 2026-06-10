'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d';
import { useTheme } from 'next-themes';
import { Spinner } from '@/components/ui/spinner';
import * as THREE from 'three';

// ─── Node color map ──────────────────────────────────────────────

const NODE_COLORS: Record<string, { color: string; emissive: string; label: string }> = {
  asset:            { color: '#3b82f6', emissive: '#1d4ed8', label: 'Asset' },
  cve:              { color: '#ef4444', emissive: '#b91c1c', label: 'CVE' },
  crown_jewel:      { color: '#f59e0b', emissive: '#b45309', label: 'Crown Jewel' },
  threat_actor:     { color: '#a855f7', emissive: '#7e22ce', label: 'Threat Actor' },
  attack_technique: { color: '#06b6d4', emissive: '#0e7490', label: 'Technique' },
};

const LINK_COLORS: Record<string, string> = {
  HAS_VULNERABILITY: '#ef4444',
  TARGETS:           '#a855f7',
  EXPLOITS:          '#f87171',
  USES_TECHNIQUE:    '#06b6d4',
  CONNECTED_TO:      '#3b82f6',
  CAN_ACCESS:        '#3b82f6',
  HOSTS:             '#10b981',
};

const DEFAULT_COLOR = '#64748b';

function getNodeMeta(node: any) {
  const type = node.type || (node.labels?.[0]?.toLowerCase().replace(/\s+/g, '_')) || 'unknown';
  return NODE_COLORS[type] || { color: DEFAULT_COLOR, emissive: '#334155', label: type };
}

function getNodeLabel(node: any): string {
  const p = node.properties || {};
  return p.name || p.cveId || p.id || p.mitreId || node.label || node.id || 'Unknown';
}

function getNodeSize(node: any): number {
  const type = node.type || '';
  if (type === 'crown_jewel') return 8;
  if (type === 'asset') return 6;
  if (type === 'threat_actor') return 7;
  return 5;
}

// ─── Component ───────────────────────────────────────────────────

export default function MapClient() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Resize observer for the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load graph data
  useEffect(() => {
    async function loadData() {
      try {
        // apiFetch already unwraps json.data, so `res` IS { nodes, edges }
        const res = await apiFetch<{ nodes: any[]; edges: any[] }>('/graph');
        if (res && Array.isArray(res.nodes) && Array.isArray(res.edges)) {
          const links = res.edges.map((e: any) => ({
            source: e.source,
            target: e.target,
            type: e.type,
            id: e.id,
          }));
          setGraphData({ nodes: res.nodes, links });
        }
      } catch (err) {
        console.error('[OrgMap] Failed to load graph data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Custom 3D node objects using Three.js spheres with glow
  const nodeThreeObject = useCallback((node: any) => {
    const meta = getNodeMeta(node);
    const size = getNodeSize(node);

    const group = new THREE.Group();

    // Core sphere
    const geometry = new THREE.SphereGeometry(size, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color: meta.color,
      emissive: meta.emissive,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.4,
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Glow halo
    const glowGeometry = new THREE.SphereGeometry(size * 1.6, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: meta.color,
      transparent: true,
      opacity: 0.12,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);

    // Text label sprite
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 48;
    ctx.font = 'bold 20px Inter, system-ui, sans-serif';
    ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = getNodeLabel(node);
    ctx.fillText(label.length > 22 ? label.slice(0, 20) + '…' : label, 128, 24);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85 });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(24, 4.5, 1);
    sprite.position.set(0, size + 6, 0);
    group.add(sprite);

    return group;
  }, [isDark]);

  const handleNodeClick = useCallback((node: any) => {
    const fg = fgRef.current;
    if (!fg || !node.x) return;
    const distance = 120;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    fg.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      { x: node.x, y: node.y, z: node.z },
      1500,
    );
  }, []);

  const bgColor = isDark ? '#050a15' : '#f0f4f8';

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-center gap-3 py-20">
        <div className="h-14 w-14 rounded-2xl bg-card-border/10 ring-1 ring-card-border flex items-center justify-center">
          <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
        </div>
        <h3 className="text-sm font-semibold text-foreground">No graph data</h3>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Your organisation has no assets or connections yet. Seed data or run the ingestion pipeline to populate the graph.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ cursor: 'grab' }}>
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={(link: any) => LINK_COLORS[link.type] || '#475569'}
        linkWidth={1.5}
        linkOpacity={0.5}
        linkDirectionalParticles={3}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={(link: any) => LINK_COLORS[link.type] || '#475569'}
        backgroundColor={bgColor}
        onNodeClick={handleNodeClick}
        enableNodeDrag={true}
        cooldownTicks={120}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {/* Legend */}
      <div className="absolute top-4 right-4 rounded-xl p-4 text-xs space-y-2.5 border border-card-border/60 pointer-events-none shadow-2xl backdrop-blur-xl"
           style={{ background: isDark ? 'rgba(5, 10, 21, 0.85)' : 'rgba(255, 255, 255, 0.9)' }}>
        <h3 className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-2">Entity Types</h3>
        {Object.entries(NODE_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: val.color, boxShadow: `0 0 8px ${val.color}60` }} />
            <span className="text-muted-foreground font-medium">{val.label}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 rounded-lg p-3 text-xs text-muted-foreground/70 border border-card-border/40 pointer-events-none backdrop-blur-sm"
           style={{ background: isDark ? 'rgba(5, 10, 21, 0.7)' : 'rgba(255, 255, 255, 0.8)' }}>
        <p>• Left Click + Drag → Rotate</p>
        <p>• Right Click + Drag → Pan</p>
        <p>• Scroll → Zoom</p>
        <p>• Click Node → Focus</p>
      </div>

      {/* Node count */}
      <div className="absolute top-4 left-4 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground/80 border border-card-border/40 pointer-events-none backdrop-blur-sm"
           style={{ background: isDark ? 'rgba(5, 10, 21, 0.7)' : 'rgba(255, 255, 255, 0.8)' }}>
        {graphData.nodes.length} nodes · {graphData.links.length} connections
      </div>
    </div>
  );
}
