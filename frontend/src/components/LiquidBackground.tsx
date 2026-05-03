"use client";

import { useEffect, useRef } from "react";

export default function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const blobs = useRef([
    { x: 0.3, y: 0.3, vx: 0.0003, vy: 0.0002, radius: 250, color: "rgba(220, 210, 190, 0.15)" },
    { x: 0.7, y: 0.6, vx: -0.0002, vy: 0.0003, radius: 350, color: "rgba(200, 195, 180, 0.12)" },
    { x: 0.5, y: 0.8, vx: 0.0001, vy: -0.0002, radius: 200, color: "rgba(240, 230, 215, 0.1)" },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      mouse.current.targetX = e.clientX;
      mouse.current.targetY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouse);

    let animId: number;
    const draw = () => {
      if (!ctx || !canvas) return;
      
      // Smooth mouse lerp
      mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.03;
      mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.03;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw ambient floating blobs
      blobs.current.forEach(blob => {
        blob.x += blob.vx;
        blob.y += blob.vy;
        
        // Gentle bounce
        if (blob.x < 0 || blob.x > 1) blob.vx *= -1;
        if (blob.y < 0 || blob.y > 1) blob.vy *= -1;

        const bx = blob.x * canvas.width;
        const by = blob.y * canvas.height;
        
        const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, blob.radius);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, "transparent");
        
        ctx.beginPath();
        ctx.arc(bx, by, blob.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Mouse-following warm spotlight
      const mg = ctx.createRadialGradient(
        mouse.current.x, mouse.current.y, 0,
        mouse.current.x, mouse.current.y, 400
      );
      mg.addColorStop(0, "rgba(245, 235, 220, 0.08)");
      mg.addColorStop(0.5, "rgba(240, 230, 210, 0.03)");
      mg.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(mouse.current.x, mouse.current.y, 400, 0, Math.PI * 2);
      ctx.fillStyle = mg;
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };
    
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
}
