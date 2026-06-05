import React, { useMemo } from 'react';
import './FloatingNodes.css';

export default function FloatingNodes({ count = 20 }) {
  // Generate random properties for nodes once on mount
  const nodes = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = Math.random() * 8 + 4; // 4px to 12px
      const left = Math.random() * 100; // 0% to 100%
      const duration = Math.random() * 10 + 10; // 10s to 20s
      const delay = Math.random() * -20; // negative delay to start immediately at different heights

      return {
        id: i,
        style: {
          width: `${size}px`,
          height: `${size}px`,
          left: `${left}%`,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
        }
      };
    });
  }, [count]);

  return (
    <div className="floating-nodes-container">
      {nodes.map(node => (
        <div key={node.id} className="node" style={node.style} />
      ))}
    </div>
  );
}
