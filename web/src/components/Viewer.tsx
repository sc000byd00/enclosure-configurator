"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Bounds, OrbitControls, useBounds } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import { absolute, type Part } from "@/lib/api";
import { explodeOffset } from "@/lib/board";

const MATERIALS: Record<string, THREE.MeshStandardMaterialParameters> = {
  base: { color: "#2b2f36", roughness: 0.6 },
  lid: { color: "#d7d9dc", roughness: 0.5 },
  board: { color: "#1f6b3a", roughness: 0.5 },
  components: { color: "#3a3a3a", roughness: 0.4, metalness: 0.3 },
  "light-pipe": { color: "#bff5d6", roughness: 0.2, emissive: "#3cdc82", emissiveIntensity: 0.6,
    transparent: true, opacity: 0.85 },
};

function materialFor(part: Part) {
  if (part.name === "components-metal") return { color: "#b9bcc0", roughness: 0.3, metalness: 0.9 };
  if (part.name === "components-led") return { color: "#e6fff0", emissive: "#3cdc82", emissiveIntensity: 1 };
  return MATERIALS[part.role] ?? MATERIALS.components;
}

function Mesh({ part, lift }: { part: Part; lift: number }) {
  const geometry = useLoader(STLLoader, absolute(part.url));
  const mat = useMemo(() => materialFor(part), [part]);
  return (
    <mesh geometry={geometry} position={[0, 0, lift]} castShadow receiveShadow>
      <meshStandardMaterial {...mat} flatShading={false} />
    </mesh>
  );
}

function Refit({ token }: { token: number }) {
  const bounds = useBounds();
  useEffect(() => {
    if (token > 0) bounds.refresh().clip().fit();
  }, [token, bounds]);
  return null;
}

export type ViewerProps = {
  parts: Part[];
  height: number;
  explode: number;
  hidden: Set<string>;
  fitToken: number; // change it to fit the camera to what is shown
};

export default function Viewer({ parts, height, explode, hidden, fitToken }: ViewerProps) {
  const shown = parts.filter((p) => !hidden.has(p.role));
  const key = parts.map((p) => p.url).join("|");
  return (
    <Canvas camera={{ position: [-90, 110, 140], fov: 35, near: 1, far: 5000 }} shadows dpr={[1, 2]}>
      <color attach="background" args={["#eef0f3"]} />
      <hemisphereLight args={["#ffffff", "#9aa0a8", 1.1]} />
      <directionalLight position={[-120, 200, 160]} intensity={1.6} castShadow />
      <directionalLight position={[150, 80, -100]} intensity={0.5} />
      <Suspense fallback={null}>
        <Bounds key={key} fit clip margin={1.25}>
          <Refit token={fitToken} />
          {/* model is z-up, three.js is y-up */}
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {shown.map((p) => (
              <Mesh key={p.url} part={p} lift={explodeOffset(p.role, p.name, height, explode)} />
            ))}
          </group>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}
