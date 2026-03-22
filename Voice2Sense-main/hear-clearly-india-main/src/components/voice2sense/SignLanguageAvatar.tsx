import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

interface AvatarProps {
  text: string;
}

const AvatarModel = ({ text }: AvatarProps) => {
  const meshRef = useRef<THREE.Group>(null!);
  const leftArmRef = useRef<THREE.Mesh>(null!);
  const rightArmRef = useRef<THREE.Mesh>(null!);
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    if (text && text !== "Awaiting speech…") {
      setIsSigning(true);
      const t = setTimeout(() => setIsSigning(false), 2000);
      return () => clearTimeout(t);
    }
  }, [text]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (isSigning) {
      // Procedural "Signing" motion
      leftArmRef.current.rotation.z = Math.sin(time * 10) * 0.5 + 0.5;
      leftArmRef.current.rotation.x = Math.cos(time * 8) * 0.3;
      rightArmRef.current.rotation.z = -(Math.sin(time * 12) * 0.5 + 0.5);
      rightArmRef.current.rotation.x = Math.cos(time * 7) * 0.3;
      
      // Slight head bob
      meshRef.current.children[0].rotation.y = Math.sin(time * 5) * 0.1;
    } else {
      // Idle motion
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, 0.2, 0.1);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -0.2, 0.1);
      meshRef.current.children[0].rotation.y = THREE.MathUtils.lerp(meshRef.current.children[0].rotation.y, 0, 0.1);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.7, 0]}>
        <capsuleGeometry args={[0.2, 1, 4, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[0.35, 1.2, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[-0.35, 1.2, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>
      {/* Bottom Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <circleGeometry args={[1.2, 48]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.4} />
      </mesh>
    </group>
  );
};

export const SignLanguageAvatar = ({ text }: AvatarProps) => {
  const display = text.trim() || "Awaiting speech…";

  return (
    <div className="w-full min-h-[400px] h-[420px] bg-slate-900/40 rounded-xl overflow-hidden border border-border/50 relative">
      <div className="absolute top-4 left-4 z-10">
        <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded border border-primary/20">
          Sign avatar (follows captions)
        </span>
      </div>

      <Canvas
        className="!h-[340px] w-full"
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        shadows
      >
        <color attach="background" args={["#0f172a"]} />
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 1.4, 4.2]} fov={48} />
          <ambientLight intensity={0.65} />
          <directionalLight position={[4, 8, 4]} intensity={1.1} castShadow />
          <directionalLight position={[-4, 4, -2]} intensity={0.35} />
          <spotLight position={[0, 6, 2]} angle={0.35} penumbra={0.6} intensity={0.8} />
          <AvatarModel text={display} />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2}
          />
        </Suspense>
      </Canvas>

      <div className="absolute bottom-3 left-0 right-0 text-center px-4 pointer-events-none">
        <p className="text-xs text-muted-foreground line-clamp-3 italic" title={display}>
          &ldquo;{display}&rdquo;
        </p>
      </div>
    </div>
  );
};
