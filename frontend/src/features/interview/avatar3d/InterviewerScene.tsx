import { ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

import type { AvatarState } from '../InterviewerAvatar';
import { RobotCharacter } from './RobotCharacter';

interface InterviewerSceneProps {
  state: AvatarState;
  audioLevel: number;
}

export const InterviewerScene = ({ state, audioLevel }: InterviewerSceneProps) => (
  <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
    <PerspectiveCamera makeDefault position={[0, 0.05, 5]} fov={26} />

    <ambientLight intensity={0.5} />
    <directionalLight position={[2, 3, 3]} intensity={1} />
    <pointLight position={[-2.5, 0.5, 1.5]} intensity={8} color="#2dd4bf" />
    <pointLight position={[2, -1, -1.5]} intensity={4} color="#0f766e" />
    <pointLight position={[0, 1.5, 2]} intensity={2.5} color="#ffffff" />

    <RobotCharacter state={state} audioLevel={audioLevel} />
    <ContactShadows position={[0, -1.65, 0]} opacity={0.55} scale={6} blur={2.4} far={2} />
  </Canvas>
);
