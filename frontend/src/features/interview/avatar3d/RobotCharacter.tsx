import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

import type { AvatarState } from '../InterviewerAvatar';

const STATE_COLOR: Record<AvatarState, string> = {
  idle: '#5b6470',
  listening: '#2dd4bf',
  thinking: '#fbbf24',
  speaking: '#2dd4bf',
};

const MOUTH_SLAT_X = [-0.16, -0.08, 0, 0.08, 0.16];

interface RobotCharacterProps {
  state: AvatarState;
  audioLevel: number;
}

export const RobotCharacter = ({ state, audioLevel }: RobotCharacterProps) => {
  const headGroup = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthSlats = useRef<(THREE.Mesh | null)[]>([]);
  const antennaLightRef = useRef<THREE.Mesh>(null);
  const chestLightRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const neckRingRef = useRef<THREE.Mesh>(null);

  const blink = useRef({ next: 2 + Math.random() * 3, progress: 0, blinking: false });
  const tmpColor = useRef(new THREE.Color());

  useFrame((threeState, rawDelta) => {
    const t = threeState.clock.elapsedTime;
    const delta = Math.min(rawDelta, 0.05);
    const color = tmpColor.current.set(STATE_COLOR[state]);
    const lerpAmt = Math.min(1, delta * 4);

    // Idle breathing on the torso
    if (torsoRef.current) {
      const breathe = 1 + Math.sin(t * 0.9) * 0.012;
      torsoRef.current.scale.set(1, breathe, 1);
    }

    // Head posture: gentle idle sway, plus a state-driven lean
    if (headGroup.current) {
      let targetX = Math.sin(t * 0.35) * 0.04;
      let targetY = Math.sin(t * 0.5) * 0.06;
      let targetZ = 0;

      if (state === 'thinking') {
        targetZ = 0.12;
        targetY += 0.05;
      } else if (state === 'listening') {
        targetX += 0.06;
      }

      const headLerp = Math.min(1, delta * 2.5);
      headGroup.current.rotation.x += (targetX - headGroup.current.rotation.x) * headLerp;
      headGroup.current.rotation.y += (targetY - headGroup.current.rotation.y) * headLerp;
      headGroup.current.rotation.z += (targetZ - headGroup.current.rotation.z) * headLerp;
    }

    // Blink cycle
    const b = blink.current;
    b.next -= delta;
    if (!b.blinking && b.next <= 0) {
      b.blinking = true;
      b.progress = 0;
    }
    let eyeScaleY = 1;
    if (b.blinking) {
      b.progress += delta * 10;
      eyeScaleY = Math.abs(Math.cos(Math.min(Math.PI, b.progress)));
      if (b.progress >= Math.PI) {
        b.blinking = false;
        b.next = 2.5 + Math.random() * 3.5;
      }
    }
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY;

    // Eye / ring / chest light color transitions toward the current state color
    for (const ref of [leftEyeRef, rightEyeRef]) {
      const mat = ref.current?.material as THREE.MeshStandardMaterial | undefined;
      mat?.emissive.lerp(color, lerpAmt);
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.color.lerp(color, lerpAmt);
      mat.emissive.lerp(color, lerpAmt);
      const pulse = state === 'listening' ? 1 + Math.sin(t * 6) * 0.08 : 1;
      ringRef.current.scale.setScalar(pulse);
    }
    if (neckRingRef.current) {
      const mat = neckRingRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.lerp(color, lerpAmt);
    }
    if (chestLightRef.current) {
      const mat = chestLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.lerp(color, lerpAmt);
      const pulse = 1 + Math.sin(t * (state === 'thinking' ? 4 : 1.4)) * 0.15;
      chestLightRef.current.scale.setScalar(pulse);
    }
    if (antennaLightRef.current) {
      const mat = antennaLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.lerp(color, lerpAmt);
      const flicker = state !== 'idle' ? Math.sin(t * 5) * 0.5 + 0.5 : 0.6;
      mat.emissiveIntensity = 0.6 + flicker * 1.2;
    }

    // Mouth: driven by real audio level when speaking (falls back to a believable
    // synthetic cadence if no signal is available, e.g. browser speech synthesis).
    let mouthOpen = 0;
    if (state === 'speaking') {
      const synthetic = (Math.sin(t * 14) * 0.5 + 0.5) * 0.6 + (Math.sin(t * 31) * 0.5 + 0.5) * 0.4;
      mouthOpen = audioLevel > 0.02 ? Math.min(1, audioLevel * 1.6) : synthetic;
    } else if (state === 'thinking') {
      mouthOpen = 0.15 + Math.sin(t * 3) * 0.05;
    }
    mouthSlats.current.forEach((slat, i) => {
      if (!slat) return;
      const variance = state === 'speaking' ? Math.sin(t * 18 + i * 0.6) * 0.3 + 0.7 : 1;
      slat.scale.y = Math.max(0.12, mouthOpen * variance);
    });
  });

  return (
    <group position={[0, -0.3, 0]}>
      {/* Torso / shoulders — suggests a seated posture in frame, like a webcam headshot */}
      <RoundedBox
        ref={torsoRef}
        args={[1.7, 1.1, 0.9]}
        radius={0.18}
        smoothness={4}
        position={[0, -1.05, -0.05]}
      >
        <meshStandardMaterial color="#15181d" metalness={0.4} roughness={0.5} />
      </RoundedBox>
      <mesh ref={chestLightRef} position={[0, -0.85, 0.42]}>
        <circleGeometry args={[0.06, 32]} />
        <meshStandardMaterial
          color="#0a0c0f"
          emissive="#5b6470"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>

      {/* Neck */}
      <group position={[0, -0.42, 0]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.22, 0.26, 0.22, 24]} />
          <meshStandardMaterial color="#1b1e24" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh ref={neckRingRef} position={[0, -0.02, 0]}>
          <torusGeometry args={[0.24, 0.022, 12, 32]} />
          <meshStandardMaterial
            color="#5b6470"
            emissive="#5b6470"
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Head */}
      <group ref={headGroup} position={[0, 0.15, 0]}>
        <RoundedBox args={[1.05, 1.1, 0.95]} radius={0.22} smoothness={4} castShadow>
          <meshStandardMaterial color="#1d2129" metalness={0.55} roughness={0.32} />
        </RoundedBox>

        {/* Face plate */}
        <RoundedBox
          args={[0.82, 0.62, 0.05]}
          radius={0.1}
          smoothness={4}
          position={[0, 0.02, 0.49]}
        >
          <meshStandardMaterial color="#070809" metalness={0.2} roughness={0.6} />
        </RoundedBox>

        {/* Eyes (visor style) */}
        <mesh ref={leftEyeRef} position={[-0.21, 0.08, 0.52]}>
          <capsuleGeometry args={[0.05, 0.1, 4, 12]} />
          <meshStandardMaterial
            color="#0a0c0f"
            emissive="#5b6470"
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.21, 0.08, 0.52]}>
          <capsuleGeometry args={[0.05, 0.1, 4, 12]} />
          <meshStandardMaterial
            color="#0a0c0f"
            emissive="#5b6470"
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>

        {/* Mouth grille */}
        {MOUTH_SLAT_X.map((x, i) => (
          <mesh
            key={x}
            ref={(el) => {
              mouthSlats.current[i] = el;
            }}
            position={[x, -0.18, 0.52]}
          >
            <boxGeometry args={[0.035, 0.12, 0.02]} />
            <meshStandardMaterial
              color="#0a0c0f"
              emissive="#2dd4bf"
              emissiveIntensity={1}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Audio-sensor "ears" */}
        <mesh position={[-0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 24]} />
          <meshStandardMaterial color="#1b1e24" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 24]} />
          <meshStandardMaterial color="#1b1e24" metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Antenna */}
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
          <meshStandardMaterial color="#3a3f47" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh ref={antennaLightRef} position={[0, 0.79, 0]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial
            color="#0a0c0f"
            emissive="#5b6470"
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>

        {/* Attentiveness ring — pulses while listening */}
        <mesh ref={ringRef} rotation={[Math.PI / 2.1, 0, 0]}>
          <torusGeometry args={[0.78, 0.012, 8, 64]} />
          <meshStandardMaterial
            color="#5b6470"
            emissive="#5b6470"
            emissiveIntensity={0.4}
            transparent
            opacity={0.5}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
};
