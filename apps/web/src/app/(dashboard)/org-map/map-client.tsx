'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useTheme } from 'next-themes';
import { Spinner } from '@/components/ui/spinner';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
// @ts-ignore
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';

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

function getSize(node: any): number {
  const t = getType(node);
  if (t === 'crown_jewel') return 8;
  if (t === 'threat_actor') return 7;
  if (t === 'asset') return 6;
  return 4;
}

// ─── 3D Scene Components ─────────────────────────────────────────

function Edge({ link, linkRef, isDark }: { link: any; linkRef: any; isDark: boolean }) {
  const color = LINK_COLORS[link.type] || (isDark ? '#334155' : '#94a3b8');
  
  const points = useMemo(() => {
    // Initial dummy points
    return [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
  }, []);

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  return (
    <line ref={(el) => { if (el) linkRef.current[link.id] = el; }}>
      <primitive object={lineGeometry} attach="geometry" />
      <lineBasicMaterial color={color} opacity={0.4} transparent />
    </line>
  );
}

const textureCache: Record<string, THREE.CanvasTexture> = {};

function getEmojiTexture(emoji: string): THREE.CanvasTexture {
  if (textureCache[emoji]) return textureCache[emoji];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '84px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
    ctx.fillText(emoji, 64, 64);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  textureCache[emoji] = texture;
  return texture;
}

const EMOJI_MAP: Record<string, string> = {
  asset: '🖥️',
  cve: '🐛',
  crown_jewel: '👑',
  threat_actor: '👥',
  attack_technique: '⚡',
};

function Node({ node, nodeRef, isDark, hovered, setHovered }: { node: any; nodeRef: any; isDark: boolean; hovered: any; setHovered: any }) {
  const type = getType(node);
  const color = TYPE_COLORS[type] || '#64748b';
  const size = getSize(node);
  const isHovered = hovered?.id === node.id;
  const panelBg = isDark ? 'rgba(6,11,24,0.9)' : 'rgba(255,255,255,0.95)';
  const panelBorder = isDark ? 'rgba(51,65,85,0.8)' : 'rgba(203,213,225,1)';
  const txt = isDark ? '#f1f5f9' : '#0f172a';
  const txtDim = isDark ? '#94a3b8' : '#64748b';

  const emoji = EMOJI_MAP[type] || '❓';
  const texture = getEmojiTexture(emoji);

  return (
    <group
      ref={(el) => { if (el) nodeRef.current[node.id] = el as any; }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(node); }}
      onPointerOut={() => setHovered(null)}
    >
      {/* Outer Glow Ring / Semi-transparent Sphere */}
      <mesh>
        <sphereGeometry args={[size * 1.3, 16, 16]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={isHovered ? 0.35 : 0.12} 
          wireframe={isHovered}
          depthWrite={false}
        />
      </mesh>

      {/* Inner Emissive Core for Neon Depth */}
      <mesh>
        <sphereGeometry args={[size * 0.4, 8, 8]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={isHovered ? 0.75 : 0.35} 
          depthWrite={false}
        />
      </mesh>

      {/* Floating Emoji Sprite */}
      <sprite scale={[size * 2.2, size * 2.2, 1]}>
        <spriteMaterial 
          map={texture} 
          transparent 
          opacity={isHovered ? 1.0 : 0.85}
          depthWrite={false}
        />
      </sprite>
      
      {/* HTML Overlay using Drei (Native DOM layer) */}
      {isHovered && (
        <Html distanceFactor={250} position={[0, size + 2, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: '8px', 
            padding: '8px 14px', fontFamily: 'Inter, system-ui, sans-serif', backdropFilter: 'blur(8px)',
            pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: txt }}>{getName(node) || 'Unknown'}</div>
            <div style={{ fontSize: '11px', color: txtDim, marginTop: '2px' }}>
              {TYPE_LABELS[getType(node)] || getType(node)}
              {node.properties?.severity ? ` · ${node.properties.severity}` : ''}
              {node.properties?.criticality ? ` · ${node.properties.criticality}` : ''}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function GraphScene({ nodes, links, nodeDistance, isDark }: { nodes: any[]; links: any[]; nodeDistance: number; isDark: boolean }) {
  const simulationRef = useRef<any>(null);
  const nodeRefs = useRef<Record<string, THREE.Object3D>>({});
  const linkRefs = useRef<Record<string, THREE.Line>>({});
  const [hovered, setHovered] = useState<any>(null);

  // Initialize D3 physics simulation
  useEffect(() => {
    // Give nodes initial random positions to prevent zero-distance errors
    nodes.forEach(n => {
      if (n.x == null) n.x = (Math.random() - 0.5) * 100;
      if (n.y == null) n.y = (Math.random() - 0.5) * 100;
      if (n.z == null) n.z = (Math.random() - 0.5) * 100;
    });

    const simulation = forceSimulation(nodes)
      .force('link', forceLink(links).id((d: any) => d.id).distance(nodeDistance))
      .force('charge', forceManyBody().strength(-3 * nodeDistance))
      .force('center', forceCenter(0, 0, 0));
    
    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [nodes, links]); // Run once when graphData changes

  // Update forces when `nodeDistance` state changes
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.force('link').distance(nodeDistance);
      simulationRef.current.force('charge').strength(-3 * nodeDistance);
      simulationRef.current.alpha(0.5).restart();
    }
  }, [nodeDistance]);

  // Sync D3 positions to Three.js meshes on every frame
  useFrame(() => {
    if (!simulationRef.current) return;

    nodes.forEach(node => {
      const mesh = nodeRefs.current[node.id];
      if (mesh && node.x != null && node.y != null && node.z != null) {
        mesh.position.set(node.x, node.y, node.z);
      }
    });

    links.forEach(link => {
      const line = linkRefs.current[link.id];
      if (line && link.source.x != null && link.target.x != null) {
        const positionAttr = line.geometry.attributes.position;
        if (positionAttr && positionAttr.array) {
          const positions = positionAttr.array as Float32Array;
          positions[0] = link.source.x;
          positions[1] = link.source.y;
          positions[2] = link.source.z;
          positions[3] = link.target.x;
          positions[4] = link.target.y;
          positions[5] = link.target.z;
          positionAttr.needsUpdate = true;
        }
      }
    });
  });

  return (
    <group>
      {/* Lights */}
      <ambientLight intensity={isDark ? 0.4 : 0.8} />
      <pointLight position={[100, 100, 100]} intensity={isDark ? 0.8 : 0.5} />
      
      {/* Links */}
      {links.map((link, i) => (
        <Edge key={`link-${i}`} link={link} linkRef={linkRefs} isDark={isDark} />
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <Node key={`node-${node.id || i}`} node={node} nodeRef={nodeRefs} isDark={isDark} hovered={hovered} setHovered={setHovered} />
      ))}
    </group>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function MapClient() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [nodeDistance, setNodeDistance] = useState(120);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // ─── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ nodes: any[]; edges: any[] }>('/graph');
        if (res?.nodes && res?.edges) {
          // Clone arrays because d3-force mutates the objects
          const nodes = res.nodes.map((n: any) => ({ ...n }));
          const links = res.edges.map((e: any) => ({
            ...e,
            source: e.source,
            target: e.target,
            id: e.id,
          }));
          setGraphData({ nodes, links });
        }
      } catch (err) {
        console.error('[OrgMap] Load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Theme ─────────────────────────────────────────────────────
  const bg = isDark ? '#060b18' : '#f8fafc';
  const panelBg = isDark ? 'rgba(6,11,24,0.88)' : 'rgba(255,255,255,0.95)';
  const panelBorder = isDark ? 'rgba(51,65,85,0.5)' : 'rgba(203,213,225,0.8)';
  const txt = isDark ? '#f1f5f9' : '#0f172a';
  const txtDim = isDark ? '#94a3b8' : '#64748b';

  // ─── Loading / Empty ───────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        <Spinner size="lg" />
      </div>
    );
  }

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
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: bg }}>
      
      {/* R3F Canvas */}
      <Canvas camera={{ position: [0, 0, 400], fov: 60 }}>
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        <GraphScene nodes={graphData.nodes} links={graphData.links} nodeDistance={nodeDistance} isDark={isDark} />
      </Canvas>

      {/* ── Top-left UI ─────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: txtDim, backdropFilter: 'blur(12px)' }}>
          <span style={{ color: txt, fontWeight: 700 }}>{graphData.nodes.length}</span> nodes ·{' '}
          <span style={{ color: txt, fontWeight: 700 }}>{graphData.links.length}</span> connections
        </div>
        <div style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 12,
          color: txt, backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', gap: 6,
          width: 170
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Node Distance</span>
            <span style={{ color: txtDim }}>{nodeDistance}px</span>
          </div>
          <input
            type="range"
            min="50"
            max="400"
            value={nodeDistance}
            onChange={(e) => setNodeDistance(Number(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
              accentColor: '#3b82f6',
            }}
          />
        </div>
      </div>

      {/* ── Top-right UI ────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, right: 16, background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: 16, backdropFilter: 'blur(12px)', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: txtDim, marginBottom: 10 }}>Entity Types</div>
        {Object.entries(TYPE_COLORS).map(([key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: '14px', width: '20px', display: 'inline-flex', justifyContent: 'center' }}>
              {EMOJI_MAP[key] || '❓'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: txt }}>{TYPE_LABELS[key] || key}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom-left UI ──────────────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 8, padding: '8px 14px', fontSize: 11, color: txtDim, backdropFilter: 'blur(12px)', zIndex: 10, display: 'flex', gap: 16, pointerEvents: 'none' }}>
        <span>🖱 Drag → Rotate</span>
        <span>⌥ Drag → Pan</span>
        <span>Scroll → Zoom</span>
      </div>
    </div>
  );
}
