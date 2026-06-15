"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_080827_a9e5ad52-b6ee-4e79-b393-d936f179cfd7.mp4";

export function VideoBoomerangBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoBgRef = useRef<HTMLDivElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [framesReady, setFramesReady] = useState(false);
  const framesRef = useRef<HTMLCanvasElement[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let capturing = true;
    let lastTime = -1;
    let raf = 0;
    const MAX_WIDTH = 960;
    const frames: HTMLCanvasElement[] = [];

    const queueNext = () => {
      if (!capturing) return;
      if ("requestVideoFrameCallback" in video) {
        (video as HTMLVideoElement & {
          requestVideoFrameCallback: (callback: () => void) => number;
        }).requestVideoFrameCallback(() => {
          captureFrame();
          queueNext();
        });
      } else {
        raf = requestAnimationFrame(() => {
          captureFrame();
          queueNext();
        });
      }
    };

    const captureFrame = () => {
      if (!capturing || video.readyState < 2 || video.currentTime === lastTime) return;
      if (!video.videoWidth || !video.videoHeight) return;
      lastTime = video.currentTime;
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, width, height);
        frames.push(canvas);
      } catch {
        capturing = false;
      }
    };

    const onLoaded = () => {
      void video.play().catch(() => {});
      queueNext();
    };

    const onEnded = () => {
      capturing = false;
      if (frames.length > 1) {
        framesRef.current = frames;
        setFramesReady(true);
      }
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("ended", onEnded);
    if (video.readyState >= 1) onLoaded();

    return () => {
      capturing = false;
      if (raf) cancelAnimationFrame(raf);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    if (!framesReady) return;
    const canvas = displayCanvasRef.current;
    const frames = framesRef.current;
    const first = frames[0];
    if (!canvas || !first) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = first.width;
    canvas.height = first.height;

    let index = 0;
    let direction = 1;
    let last = performance.now();
    const interval = 1000 / 30;
    let raf = 0;

    const render = (now: number) => {
      if (now - last >= interval) {
        last = now;
        ctx.drawImage(frames[index], 0, 0);
        index += direction;
        if (index >= frames.length - 1) {
          index = frames.length - 1;
          direction = -1;
        }
        if (index <= 0) {
          index = 0;
          direction = 1;
        }
      }
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [framesReady]);

  useEffect(() => {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf = 0;
    const strength = 20;

    const onMouseMove = (event: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = ((event.clientX - cx) / cx) * strength;
      targetY = ((event.clientY - cy) / cy) * strength;
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      const el = videoBgRef.current;
      if (el) gsap.set(el, { x: currentX, y: currentY });
      raf = requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", onMouseMove);
    raf = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={videoBgRef} className="fixed left-0 top-0 z-0 h-full w-full origin-center scale-[1.08]">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        className="h-full w-full object-cover"
        style={{ display: framesReady ? "none" : "block" }}
      />
      <canvas
        ref={displayCanvasRef}
        className="h-full w-full object-cover"
        style={{ display: framesReady ? "block" : "none" }}
      />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/45 to-transparent" />
    </div>
  );
}
