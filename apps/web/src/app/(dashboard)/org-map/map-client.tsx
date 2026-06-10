'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d';
import { useTheme } from 'next-themes';
import { Spinner } from '@/components/ui/spinner';

export default function MapClient() {
  const [data, setData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const { theme } = useTheme();

  useEffect(() => {
    async function loadData() {
      try {
        const res = await apiFetch<any>('/graph');
        if (res && res.data && res.data.nodes && res.data.edges) {
          // react-force-graph-3d expects links instead of edges
          const formattedLinks = res.data.edges.map((e: any) => ({
            ...e,
            source: e.source,
            target: e.target,
            name: e.type,
          }));
          setData({ nodes: res.data.nodes, links: formattedLinks });
        }
      } catch (err) {
        console.error('Failed to load map data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getNodeColor = (node: any) => {
    const labels = node.labels || [];
    if (labels.includes('Asset')) return '#3b82f6'; // Blue
    if (labels.includes('CVE')) return '#ef4444'; // Red
    if (labels.includes('User')) return '#22c55e'; // Green
    if (labels.includes('CrownJewel')) return '#eab308'; // Yellow
    if (labels.includes('ThreatActor')) return '#a855f7'; // Purple
    return '#94a3b8'; // Slate
  };

  const getLinkColor = (link: any) => {
    if (link.type === 'HAS_VULNERABILITY') return '#ef4444';
    if (link.type === 'TARGETS') return '#a855f7';
    if (link.type === 'RUNS_ON') return '#eab308';
    return '#475569';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-background relative" style={{ cursor: 'grab' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel={(node: any) => `${node.labels?.[0] || 'Node'}: ${node.properties?.name || node.properties?.id || node.properties?.cveId || node.id}`}
        nodeColor={getNodeColor}
        nodeRelSize={6}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkColor={getLinkColor}
        backgroundColor={theme === 'dark' ? '#09090b' : '#ffffff'}
        onNodeClick={(node) => {
          if (!fgRef.current) return;
          // Aim at node from outside it
          const distance = 100;
          const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
          fgRef.current.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
            node, // lookAt ({ x, y, z })
            2000  // ms transition duration
          );
        }}
      />
      {/* Legend */}
      <div className="absolute top-4 right-4 glass-card p-4 rounded-xl text-xs space-y-3 border border-card-border pointer-events-none shadow-lg">
        <h3 className="font-semibold text-foreground mb-1">Entity Types</h3>
        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]"></div><span className="text-muted-foreground font-medium">Asset (Server/Device)</span></div>
        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#ef4444] shadow-[0_0_8px_#ef4444]"></div><span className="text-muted-foreground font-medium">Vulnerability (CVE)</span></div>
        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]"></div><span className="text-muted-foreground font-medium">User / Identity</span></div>
        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#eab308] shadow-[0_0_8px_#eab308]"></div><span className="text-muted-foreground font-medium">Crown Jewel</span></div>
        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7]"></div><span className="text-muted-foreground font-medium">Threat Actor</span></div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-background/50 backdrop-blur-sm p-3 rounded-lg text-xs text-muted-foreground/80 border border-card-border pointer-events-none">
        <p>• Left Click + Drag to Rotate</p>
        <p>• Right Click + Drag to Pan</p>
        <p>• Scroll to Zoom</p>
        <p>• Click a Node to Focus</p>
      </div>
    </div>
  );
}
