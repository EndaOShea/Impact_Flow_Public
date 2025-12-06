import React, { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  code: string;
}

declare global {
  interface Window {
    mermaid: any;
  }
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!window.mermaid || !code) return;

      try {
        // Generate a unique ID for each render to avoid conflicts
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Use the mermaid API to render the SVG
        const { svg } = await window.mermaid.render(id, code);
        setSvgContent(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError("Failed to render diagram. Syntax might be invalid.");
        // Mermaid tends to leave error elements in the DOM, clean them up slightly if needed
        // but typically it handles its own error UI overlay.
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
        {error}
        <pre className="mt-2 text-xs text-slate-500 overflow-x-auto">{code}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full overflow-x-auto p-4 bg-white rounded-lg border border-slate-200 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};