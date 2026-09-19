import React, { useMemo } from 'react';
import './FloatingNodes.css';

export default function FloatingNodes({ count = 20 }) {
  // Generate random properties for nodes once on mount
  const nodes = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const pseudo = (factor) => Math.abs(Math.sin(i * factor + 1));
      const size = (pseudo(12.9898) * 8) + 4; // 4px to 12px
      const left = pseudo(78.233) * 100; // 0% to 100%
      const duration = (pseudo(45.164) * 10) + 10; // 10s to 20s
      const delay = pseudo(93.284) * -20; // negative delay

      return {
        id: i,
        style: {
          width: `${size.toFixed(1)}px`,
          height: `${size.toFixed(1)}px`,
          left: `${left.toFixed(2)}%`,
          animationDuration: `${duration.toFixed(1)}s`,
          animationDelay: `${delay.toFixed(1)}s`,
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
