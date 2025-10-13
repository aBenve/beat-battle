'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  show: boolean;
}

export default function AudioVisualizer({ show }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const frequencyDataRef = useRef<Float32Array>();

  useEffect(() => {
    if (!show || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Enhanced visualizer settings
    const barCount = 128; // More bars for detailed frequency representation
    const barWidth = canvas.width / barCount;

    // Initialize frequency data with different ranges simulating audio spectrum
    frequencyDataRef.current = new Float32Array(barCount);
    const smoothing = new Float32Array(barCount); // For smooth transitions

    let phase = 0;
    let beatPhase = 0;
    let bassPhase = 0;

    // Simulate realistic audio frequency behavior
    const updateFrequencies = () => {
      if (!frequencyDataRef.current) return;

      phase += 0.08;
      beatPhase += 0.15;
      bassPhase += 0.05;

      for (let i = 0; i < barCount; i++) {
        const normalizedPosition = i / barCount;

        // Bass frequencies (0-20% of spectrum) - stronger, slower
        const bassIntensity = normalizedPosition < 0.2
          ? (1 - normalizedPosition * 5) * (Math.sin(bassPhase + i * 0.05) * 0.5 + 0.5)
          : 0;

        // Mid frequencies (20-60% of spectrum) - moderate
        const midIntensity = normalizedPosition >= 0.2 && normalizedPosition < 0.6
          ? Math.sin(phase + i * 0.08) * 0.4 + 0.4
          : 0;

        // High frequencies (60-100% of spectrum) - faster, more chaotic
        const highIntensity = normalizedPosition >= 0.6
          ? (Math.sin(phase * 1.5 + i * 0.15) * 0.3 + 0.3) * (1 - normalizedPosition)
          : 0;

        // Beat/kick drum simulation (affects all frequencies but especially bass)
        const beatImpact = Math.max(0, Math.sin(beatPhase) * 0.3) * (1 - normalizedPosition);

        // Random variations for realistic feel
        const randomVariation = (Math.random() - 0.5) * 0.1;

        // Combine all frequency components
        let targetValue = (bassIntensity + midIntensity + highIntensity + beatImpact + randomVariation);
        targetValue = Math.max(0.05, Math.min(1, targetValue)); // Clamp between 0.05 and 1

        // Smooth the transitions
        smoothing[i] = smoothing[i] || targetValue;
        smoothing[i] += (targetValue - smoothing[i]) * 0.25; // Smooth factor
        frequencyDataRef.current[i] = smoothing[i];
      }
    };

    // Animate bars
    const animate = () => {
      if (!ctx || !canvas || !frequencyDataRef.current) return;

      // Clear with slight fade for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      updateFrequencies();

      for (let i = 0; i < barCount; i++) {
        const value = frequencyDataRef.current[i];
        const height = value * canvas.height * 0.85;
        const x = i * barWidth;
        const y = canvas.height - height;

        // Create gradient based on frequency range
        const gradient = ctx.createLinearGradient(x, canvas.height, x, y);

        // Color shifts based on frequency range
        const normalizedPosition = i / barCount;
        let hue;

        if (normalizedPosition < 0.2) {
          // Bass: Red to Orange (0-60 hue)
          hue = normalizedPosition * 300;
        } else if (normalizedPosition < 0.6) {
          // Mids: Yellow to Cyan (60-180 hue)
          hue = 60 + (normalizedPosition - 0.2) * 300;
        } else {
          // Highs: Cyan to Purple (180-280 hue)
          hue = 180 + (normalizedPosition - 0.6) * 250;
        }

        // Intensity affects saturation and lightness
        const saturation = 70 + value * 30;
        const lightness = 40 + value * 30;

        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness - 10}%, 0.8)`);
        gradient.addColorStop(0.5, `hsla(${hue}, ${saturation}%, ${lightness}%, 1)`);
        gradient.addColorStop(1, `hsla(${hue + 20}, ${saturation + 10}%, ${lightness + 20}%, 1)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 1, height);

        // Enhanced glow for higher intensity
        ctx.shadowBlur = 10 + value * 15;
        ctx.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${value * 0.8})`;

        // Add reflection effect at the bottom
        if (value > 0.3) {
          const reflectionGradient = ctx.createLinearGradient(x, canvas.height, x, canvas.height - 30);
          reflectionGradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, ${value * 0.3})`);
          reflectionGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
          ctx.fillStyle = reflectionGradient;
          ctx.fillRect(x, canvas.height - 30, barWidth - 1, 30);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-70"
        style={{ mixBlendMode: 'screen' }}
      />
    </div>
  );
}
