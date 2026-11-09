// "@wron/kit/3d/objects": the finished 3D objects, for a scene's own file
// (src/three/*.jsx). Everything here runs inside a <Scene>, so it only ever loads
// with the scene's code, never with the page.
import { Children, isValidElement, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Center, ContactShadows, Float, MeshDistortMaterial, MeshTransmissionMaterial, PointMaterial, Points, RoundedBox, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { usePagePointer, useScene, useSceneScroll } from "./three-context.jsx";

// ── Motion helpers shared by the objects ────────────────────────────────────
/** Spins, follows the cursor and floats its children. */
function Motion({ children, float = 1, spin = 0.15, follow = 0.3, position, rotation, scale }) {
  const g = useRef(null);
  const { reduce } = useScene();
  const p = usePagePointer();
  useFrame((_, dt) => {
    const o = g.current;
    if (!o || reduce) return;
    const d = Math.min(dt, 0.05);
    if (spin) o.rotation.y += spin * d;
    if (follow) {
      o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, -p.y * follow * 0.6, 0.06);
      o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, -p.x * follow * 0.25, 0.06);
    }
  });
  const inner = <group ref={g}>{children}</group>;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {float && !reduce ? <Float speed={1.4 * float} rotationIntensity={0.4 * float} floatIntensity={0.8 * float}>{inner}</Float> : inner}
    </group>
  );
}

// ── Shape ───────────────────────────────────────────────────────────────────
function geometryFor(shape) {
  switch (shape) {
    case "sphere": return <sphereGeometry args={[1.1, 96, 96]} />;
    case "gem": return <icosahedronGeometry args={[1.2, 0]} />;
    case "icosahedron": return <icosahedronGeometry args={[1.15, 1]} />;
    case "torus": return <torusGeometry args={[1, 0.4, 96, 192]} />;
    case "ring": return <torusGeometry args={[1.2, 0.08, 48, 256]} />;
    case "capsule": return <capsuleGeometry args={[0.6, 1.2, 24, 64]} />;
    case "cone": return <coneGeometry args={[1, 1.8, 96]} />;
    case "cylinder": return <cylinderGeometry args={[0.9, 0.9, 1.6, 96]} />;
    case "octahedron": return <octahedronGeometry args={[1.2, 0]} />;
    case "dodecahedron": return <dodecahedronGeometry args={[1.1, 0]} />;
    case "knot":
    case "torusKnot":
    default: return <torusKnotGeometry args={[0.9, 0.3, 360, 48]} />;
  }
}

function MaterialFor({ material, color, small, ...props }) {
  switch (material) {
    case "glass":
      return (
        <MeshTransmissionMaterial
          color={color} thickness={0.6} roughness={0.04} ior={1.45} chromaticAberration={0.05} anisotropy={0.2}
          distortion={0.15} distortionScale={0.4} temporalDistortion={0.08} backside samples={small ? 3 : 6} resolution={small ? 256 : 512} {...props}
        />
      );
    case "chrome": return <meshPhysicalMaterial color={color} metalness={1} roughness={0.08} envMapIntensity={1.4} {...props} />;
    case "iridescent": return <meshPhysicalMaterial color={color} metalness={0.3} roughness={0.15} clearcoat={1} iridescence={1} iridescenceIOR={1.3} iridescenceThicknessRange={[100, 800]} {...props} />;
    case "liquid": return <MeshDistortMaterial color={color} distort={0.35} speed={1.6} roughness={0.15} metalness={0.2} {...props} />;
    case "clay": return <meshPhysicalMaterial color={color} roughness={0.72} sheen={0.4} sheenRoughness={0.8} {...props} />;
    case "wireframe": return <meshBasicMaterial color={color} wireframe {...props} />;
    case "matte":
    default: return <meshStandardMaterial color={color} roughness={0.85} metalness={0} {...props} />;
  }
}

/**
 * A finished 3D object: <Shape shape="torusKnot" material="glass" color="#dfe9ff" />
 * shape    torusKnot | sphere | gem | icosahedron | torus | ring | capsule | cone | cylinder | octahedron | dodecahedron | roundedBox
 * material glass | chrome | iridescent | liquid | clay | matte | wireframe
 * float, spin, follow  0 turns each off; 1 is the default strength (spin in radians/second)
 * Extra props go to the material (e.g. roughness, distort, thickness).
 */
export function Shape({ shape = "torusKnot", material = "glass", color = "#ffffff", position, rotation, scale = 1, float = 1, spin = 0.15, follow = 0.3, castShadow, ...materialProps }) {
  const { small } = useScene();
  return (
    <Motion float={float} spin={spin} follow={follow} position={position} rotation={rotation} scale={scale}>
      {shape === "roundedBox" ? (
        <RoundedBox args={[1.6, 1.6, 1.6]} radius={0.18} smoothness={6} castShadow={castShadow}>
          <MaterialFor material={material} color={color} small={small} {...materialProps} />
        </RoundedBox>
      ) : (
        <mesh castShadow={castShadow}>
          {geometryFor(shape)}
          <MaterialFor material={material} color={color} small={small} {...materialProps} />
        </mesh>
      )}
    </Motion>
  );
}

// ── Model ───────────────────────────────────────────────────────────────────
/**
 * A .glb model (e.g. one Wron generated from a product photo), centred and sized
 * to `size` scene units at its largest dimension. <Model src={url} size={2.6} spin={0.2} />
 */
export function Model({ src, size = 2.4, position, rotation, scale = 1, float = 0.6, spin = 0.12, follow = 0.25, shadow = true, envIntensity }) {
  const { scene } = useGLTF(src);
  const { object, fit } = useMemo(() => {
    const object = scene.clone(true);
    object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        if (envIntensity != null && o.material) o.material.envMapIntensity = envIntensity;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    const dim = box.getSize(new THREE.Vector3());
    return { object, fit: size / Math.max(dim.x, dim.y, dim.z, 1e-6) };
  }, [scene, size, envIntensity]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Motion float={float} spin={spin} follow={follow}>
        <Center>
          <primitive object={object} scale={fit} />
        </Center>
      </Motion>
      {shadow ? <ContactShadows position={[0, -size * 0.52, 0]} opacity={0.35} scale={size * 3} blur={2.6} far={size * 1.5} /> : null}
    </group>
  );
}

// ── Particles ───────────────────────────────────────────────────────────────
function particlePositions(count, spread, shape) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (shape === "box") {
      x = (Math.random() - 0.5) * spread; y = (Math.random() - 0.5) * spread; z = (Math.random() - 0.5) * spread;
    } else if (shape === "disc") {
      const r = Math.sqrt(Math.random()) * spread * 0.5, a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * r; y = (Math.random() - 0.5) * spread * 0.06; z = Math.sin(a) * r;
    } else if (shape === "galaxy") {
      const arm = i % 3, r = Math.pow(Math.random(), 1.6) * spread * 0.5, a = r * 1.8 + (arm * Math.PI * 2) / 3;
      const j = (Math.random() - 0.5) * 0.35 * r;
      x = Math.cos(a) * r + j; y = (Math.random() - 0.5) * 0.25 * (spread * 0.5 - r * 0.6); z = Math.sin(a) * r + j;
    } else {
      // A shell of a sphere, thicker towards the inside.
      const u = Math.random(), v = Math.random(), th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1), r = spread * 0.5 * Math.cbrt(0.35 + 0.65 * Math.random());
      x = r * Math.sin(ph) * Math.cos(th); y = r * Math.sin(ph) * Math.sin(th); z = r * Math.cos(ph);
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

/** A field of points: <Particles count={2000} color="#D9FF43" shape="galaxy" />. shape: sphere | box | disc | galaxy */
export function Particles({ count = 1500, color = "#ffffff", size = 0.025, spread = 7, shape = "sphere", spin = 0.04, follow = 0.25, opacity = 0.9, position }) {
  const { small, reduce } = useScene();
  const n = small ? Math.round(count * 0.5) : count;
  const positions = useMemo(() => particlePositions(n, spread, shape), [n, spread, shape]);
  const g = useRef(null);
  const p = usePagePointer();
  useFrame((_, dt) => {
    if (!g.current || reduce) return;
    g.current.rotation.y += spin * Math.min(dt, 0.05);
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, -p.y * follow * 0.4, 0.04);
  });
  return (
    <group ref={g} position={position}>
      <Points positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial transparent color={color} size={size} sizeAttenuation depthWrite={false} opacity={opacity} />
      </Points>
    </group>
  );
}

// ── Waves: a dot-matrix surface in motion ───────────────────────────────────
const WAVE_VERTEX = `
uniform float uTime; uniform float uAmp; uniform float uFreq; uniform float uSize;
varying float vH;
void main() {
  vec3 p = position;
  float h = sin(p.x * uFreq + uTime) * cos(p.y * uFreq * 0.8 + uTime * 0.7) + 0.5 * sin((p.x + p.y) * uFreq * 1.7 - uTime * 1.3);
  p.z += h * uAmp;
  vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (8.0 / -mv.z);
}`;
const WAVE_FRAGMENT = `
uniform vec3 uColor; uniform float uOpacity;
varying float vH;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(uColor, uOpacity * (0.45 + 0.55 * smoothstep(-1.2, 1.2, vH)));
}`;

/** A rolling surface of dots, seen at an angle: <Waves color="#D9FF43" />. */
export function Waves({ color = "#ffffff", density = 120, width = 14, depth = 10, amplitude = 0.45, frequency = 0.55, speed = 0.6, size = 2.2, opacity = 0.85, position = [0, -1.2, 0], rotation = [-Math.PI / 2.6, 0, 0] }) {
  const { small, reduce } = useScene();
  const d = small ? Math.round(density * 0.6) : density;
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, depth, d, Math.round((d * depth) / width));
    return geo;
  }, [width, depth, d]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAmp: { value: amplitude }, uFreq: { value: frequency }, uSize: { value: size },
    uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity },
  }), [amplitude, frequency, size, color, opacity]);
  useFrame((_, dt) => { if (!reduce) uniforms.uTime.value += Math.min(dt, 0.05) * speed; });
  return (
    <points geometry={geometry} position={position} rotation={rotation} frustumCulled={false}>
      <shaderMaterial vertexShader={WAVE_VERTEX} fragmentShader={WAVE_FRAGMENT} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  );
}

// ── Globe ───────────────────────────────────────────────────────────────────
function latLng(lat, lng, r) {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lng + 180) * Math.PI) / 180;
  return [-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)];
}

/** A dotted globe with optional pins: <Globe color="#fff" markers={[{ lat: 41.5, lng: -87.9 }]} />. */
export function Globe({ color = "#ffffff", markerColor, dots = 2400, radius = 1.6, markers = [], spin = 0.12, position, rotation = [0.35, 0, 0] }) {
  const { small, reduce } = useScene();
  const n = small ? Math.round(dots * 0.6) : dots;
  const positions = useMemo(() => {
    const out = new Float32Array(n * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      out[i * 3] = Math.cos(th) * r * radius; out[i * 3 + 1] = y * radius; out[i * 3 + 2] = Math.sin(th) * r * radius;
    }
    return out;
  }, [n, radius]);
  const g = useRef(null);
  useFrame((_, dt) => { if (g.current && !reduce) g.current.rotation.y += spin * Math.min(dt, 0.05); });
  return (
    <group position={position} rotation={rotation}>
      <group ref={g}>
        <Points positions={positions} stride={3}>
          <PointMaterial transparent color={color} size={0.022} sizeAttenuation depthWrite={false} opacity={0.75} />
        </Points>
        {markers.map((m, i) => (
          <mesh key={i} position={latLng(m.lat, m.lng, radius * 1.01)}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshBasicMaterial color={markerColor || color} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── GradientBackground: its own light-weight canvas ─────────────────────────
const GRADIENT_FRAGMENT = `
uniform float uTime; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 c4; uniform float uGrain; uniform vec2 uRes;
varying vec2 vUv;
vec3 hash3(vec2 p){ vec3 q = vec3(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)), dot(p,vec2(419.2,371.9))); return fract(sin(q)*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  float a=hash3(i).x, b=hash3(i+vec2(1,0)).x, c=hash3(i+vec2(0,1)).x, d=hash3(i+vec2(1,1)).x;
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
void main() {
  vec2 uv = vUv; vec2 p = uv * vec2(uRes.x / max(uRes.y, 1.0), 1.0) * 1.6;
  float t = uTime;
  vec2 q = vec2(noise(p + t * 0.10), noise(p + vec2(5.2, 1.3) - t * 0.08));
  vec2 r = vec2(noise(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.05), noise(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.06));
  float f = noise(p + 2.5 * r);
  vec3 col = mix(c1, c2, smoothstep(0.1, 0.9, f));
  col = mix(col, c3, smoothstep(0.35, 0.95, r.x));
  col = mix(col, c4, smoothstep(0.55, 1.0, q.y) * 0.8);
  col += (hash3(uv * uRes + t).x - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;
const QUAD_VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function GradientQuad({ colors, speed, grain }) {
  const { size } = useThree();
  const { reduce } = useScene();
  const uniforms = useMemo(() => {
    const cs = [...colors, ...colors, ...colors].slice(0, 4).map((c) => new THREE.Color(c));
    return { uTime: { value: 0 }, c1: { value: cs[0] }, c2: { value: cs[1] }, c3: { value: cs[2] }, c4: { value: cs[3] }, uGrain: { value: grain }, uRes: { value: new THREE.Vector2(1, 1) } };
  }, [colors, grain]);
  useFrame((_, dt) => {
    uniforms.uRes.value.set(size.width, size.height);
    if (!reduce) uniforms.uTime.value += Math.min(dt, 0.05) * speed;
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={QUAD_VERTEX} fragmentShader={GRADIENT_FRAGMENT} uniforms={uniforms} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

/** A living mesh gradient, full-bleed behind content: <GradientBackground colors={["#0b1020","#154BFF","#E9E1D2","#11110F"]} className="absolute inset-0" /> */
/** The inside of <GradientBackground>. */
export function Gradient({ colors = ["#0b1020", "#3a2cff", "#ff6a3d", "#f4efe6"], speed = 0.35, grain = 0.06 }) {
  return <GradientQuad colors={colors} speed={speed} grain={grain} />;
}

/** Children arranged along the scroll: each child is visible for its share of the Scene's scroll progress. */
export function ScrollChapters({ children }) {
  const progress = useSceneScroll();
  const items = Children.toArray(children).filter(isValidElement);
  const refs = useRef([]);
  useFrame(() => {
    const i = Math.min(items.length - 1, Math.floor(progress.current * items.length));
    refs.current.forEach((g, k) => { if (g) g.visible = k === i; });
  });
  return items.map((child, k) => <group key={k} ref={(g) => { refs.current[k] = g; }}>{child}</group>);
}

export { Float, ContactShadows };
export { useScene, useSceneScroll, usePagePointer } from "./three-context.jsx";
export { useFrame, useThree } from "@react-three/fiber";
