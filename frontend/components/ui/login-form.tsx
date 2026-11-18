"use client";

import { ArrowRight, Lock, User } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import "./login-form.css";

// Vertex shader source code
const vertexSmokeySource = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

// Fragment shader source code for the smokey background effect
const fragmentSmokeySource = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord / iResolution;
    vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    float time = iTime * 0.5;

    // Normalize mouse input (0.0 - 1.0) and remap to -1.0 ~ 1.0
    vec2 mouse = iMouse / iResolution;
    vec2 rippleCenter = 2.0 * mouse - 1.0;

    vec2 distortion = centeredUV;
    // Apply distortion for a wavy, smokey effect
    for (float i = 1.0; i < 8.0; i++) {
        distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
        distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
    }

    // Create a glowing wave pattern
    float wave = abs(sin(distortion.x + distortion.y + time));
    float glow = smoothstep(0.9, 0.2, wave);

    fragColor = vec4(u_color * glow, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

type BlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface SmokeyBackgroundProps {
  backdropBlurAmount?: string;
  color?: string;
  className?: string;
}

const blurClassMap: Record<BlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

/**
 * Interactive WebGL shader background from the reference login-form component.
 */
export function SmokeyBackground({
  backdropBlurAmount = "sm",
  color = "#1E40AF",
  className = "",
}: SmokeyBackgroundProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    return [r, g, b];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const compileShader = (
      type: number,
      source: string,
    ): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSmokeySource);
    const fragmentShader = compileShader(
      gl.FRAGMENT_SHADER,
      fragmentSmokeySource,
    );
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const iMouseLocation = gl.getUniformLocation(program, "iMouse");
    const uColorLocation = gl.getUniformLocation(program, "u_color");

    const startTime = Date.now();
    const [r, g, b] = hexToRgb(color);
    gl.uniform3f(uColorLocation, r, g, b);

    let frameId = 0;
    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);

      const currentTime = (Date.now() - startTime) / 1000;

      gl.uniform2f(iResolutionLocation, width, height);
      gl.uniform1f(iTimeLocation, currentTime);
      gl.uniform2f(
        iMouseLocation,
        isHovering ? mousePosition.x : width / 2,
        isHovering ? height - mousePosition.y : height / 2,
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = requestAnimationFrame(render);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    render();

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isHovering, mousePosition, color]);

  const finalBlurClass =
    blurClassMap[backdropBlurAmount as BlurSize] || blurClassMap.sm;

  return (
    <div
      className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className={`absolute inset-0 ${finalBlurClass}`} />
    </div>
  );
}

export interface LoginFormProps {
  onSubmit?: (email: string, password: string) => Promise<void> | void;
  error?: string;
  submitting?: boolean;
  className?: string;
}

/**
 * Glassmorphism-style login form with floating labels and Brigid sign-in integration.
 */
export function LoginForm({
  onSubmit,
  error = "",
  submitting = false,
  className = "",
}: LoginFormProps): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const activeError = error || localError;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError("Enter both email and password.");
      return;
    }
    setLocalError("");
    if (onSubmit) {
      void onSubmit(trimmedEmail, password);
    }
  }

  return (
    <div
      className={`login-glass-card w-full max-w-sm p-6 sm:p-8 space-y-6 rounded-2xl text-[#F1F7FF] ${className}`}
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#F1F7FF]">Welcome Back</h1>
        <p className="mt-2 text-sm text-[#F1F7FF]/75">Sign in to continue</p>
      </div>

      <form className="space-y-7" onSubmit={handleSubmit} noValidate>
        <div className="relative z-0">
          <input
            type="email"
            id="floating_email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            className="block py-2.5 px-0 w-full min-h-[44px] text-sm text-[#F1F7FF] bg-transparent border-0 border-b-2 border-white/35 appearance-none focus:border-[#d3e7f1] focus-visible:outline-2 focus-visible:outline-[#d3e7f1] focus-visible:outline-offset-4 disabled:opacity-60 peer"
            placeholder=" "
            required
          />
          <label
            htmlFor="floating_email"
            className="pointer-events-none absolute text-sm text-[#F1F7FF]/75 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#d3e7f1] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            <User
              className="inline-block mr-2 -mt-1"
              size={16}
              aria-hidden="true"
            />
            Email Address
          </label>
        </div>

        <div>
          <div className="relative z-0">
            <input
              type="password"
              id="floating_password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              aria-invalid={activeError ? true : undefined}
              aria-describedby={activeError ? "login-error-text" : undefined}
              className="block py-2.5 px-0 w-full min-h-[44px] text-sm text-[#F1F7FF] bg-transparent border-0 border-b-2 border-white/35 appearance-none focus:border-[#d3e7f1] focus-visible:outline-2 focus-visible:outline-[#d3e7f1] focus-visible:outline-offset-4 disabled:opacity-60 peer"
              placeholder=" "
              required
            />
            <label
              htmlFor="floating_password"
              className="pointer-events-none absolute text-sm text-[#F1F7FF]/75 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-[#d3e7f1] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
            >
              <Lock
                className="inline-block mr-2 -mt-1"
                size={16}
                aria-hidden="true"
              />
              Password
            </label>
          </div>

          {activeError && (
            <p
              id="login-error-text"
              role="alert"
              className="mt-2 text-xs text-red-400"
            >
              {activeError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="login-glass-btn group w-full min-h-[44px] flex items-center justify-center py-3 px-4 rounded-lg text-[#F1F7FF] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign In"}
          <ArrowRight
            className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform"
            aria-hidden="true"
          />
        </button>
      </form>
    </div>
  );
}
