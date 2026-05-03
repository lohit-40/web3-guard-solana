"use client";

import { useEffect, useRef } from "react";

class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export default function CustomCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    let points: Point[] = [];
    const maxPoints = 25; // Length of the tail
    let mouse = new Point(-1000, -1000);
    let requestRef: number;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    resize();
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Always pull towards the mouse smoothly
      points.push(new Point(mouse.x, mouse.y));
      if (points.length > maxPoints) {
        points.shift();
      }
      
      if (points.length > 2) {
        ctx.beginPath();
        // Start the line at the oldest point (tail)
        ctx.moveTo(points[0].x, points[0].y);
        
        // Draw elegant Bezier curves between all points
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.strokeStyle = '#FF4522'; 
        ctx.lineWidth = 1.5; // Thin, sleek, untold.site style
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      
      requestRef = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(requestRef);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-[9999]" 
    />
  );
}
