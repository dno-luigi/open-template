import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, ContactShadows, usePagePointer, useScene } from "@wron/kit/3d/objects";
import { getCurrentDoc, subscribeCurrentDoc, docLines, isEmptyDoc } from "../components/templateStore";
import { paperState } from "../components/home/paperState";
import { STARTERS } from "../data/starters";

const W = 2.1;
const H = 2.8;
const SX = 28;
const SY = 36;
const TW = 768;
const TH = 1024;
const C1 = H / 6; // upper crease
const C2 = -H / 6; // lower crease
const FONT = '"Hanken Grotesk", system-ui, sans-serif';
const FAM = {
  serif: '"Times New Roman", Times, "Liberation Serif", serif',
  sans: 'Helvetica, Arial, "Liberation Sans", sans-serif',
};
const SPEC = { body: { s: 11, b: false }, bold: { s: 11, b: true }, heading: { s: 11, b: true }, name: { s: 22, b: true } };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

const imgCache = new Map();
function getImg(src, onLoad) {
  let im = imgCache.get(src);
  if (!im) {
    im = new Image();
    im.onload = onLoad;
    im.src = src;
    imgCache.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

let sampleDoc = null;

// Draws the page as a real US Letter sheet: same margins, type sizes and line spacing as the editor preview.
// With nothing typed yet it shows the business letter template, filling line by line as the visitor scrolls.
function drawPaper(ctx, doc, step, mode, onLoad) {
  ctx.clearRect(0, 0, TW, TH);
  roundRect(ctx, 0, 0, TW, TH, 22);
  ctx.fillStyle = "#FBFAF7";
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (mode === "shared") {
    ctx.fillStyle = "#FF7A45";
    ctx.fillRect(0, 0, 12, TH);
  }

  const sample = isEmptyDoc(doc);
  if (sample && !sampleDoc) sampleDoc = STARTERS[0].build();
  const d = sample ? sampleDoc : doc;
  const k = TW / 612;
  const m = (Number(d.margin) || 1) * 72 * k;
  const maxW = TW - m * 2;
  const limit = TH - Math.max(m, 80);
  const fam = FAM[d.font === "sans" ? "sans" : "serif"];
  const all = docLines(d);
  const n = sample ? Math.ceil(all.length * (0.35 + 0.65 * (step / 8))) : all.length;
  const hair = Math.max(1, k * 0.75);

  let y = m;
  ctx.textBaseline = "alphabetic";
  for (const l of all.slice(0, n)) {
    if (y > limit) break;
    if (l.kind === "blank") { y += 11 * 1.3 * k; continue; }
    if (l.kind === "rule") {
      y += 3 * k;
      ctx.fillStyle = "#141026";
      ctx.fillRect(m, y, maxW, hair);
      y += 6 * k;
      continue;
    }
    if (l.kind === "image") {
      const im = getImg(l.src, onLoad);
      let dw = (maxW * l.pct) / 100;
      let dh = (dw * l.h) / l.w;
      const room = limit - y + 30;
      if (dh > room) { dw *= room / dh; dh = room; }
      if (im && dh > 20) ctx.drawImage(im, m, y, dw, dh);
      y += dh + 8 * k;
      continue;
    }
    const v = SPEC[l.variant] || SPEC.body;
    const size = v.s * k;
    ctx.font = `${v.b ? 700 : 400} ${size}px ${fam}`;
    ctx.fillStyle = l.kind === "field" && !l.filled ? "#5B3DF5" : "#141026";
    if (l.variant === "heading") y += 6 * k;
    const align = l.align || "left";
    ctx.textAlign = align;
    const x = align === "center" ? m + maxW / 2 : align === "right" ? m + maxW : m;
    for (const line of wrap(ctx, l.text, maxW)) {
      if (y > limit) break;
      y += size * 1.3;
      ctx.fillText(line, x, y - size * 0.28);
    }
    if (l.variant === "heading") {
      ctx.fillStyle = "#141026";
      ctx.fillRect(m, y + 1.5 * k, maxW, hair);
      y += 4 * k;
    }
  }

  ctx.textAlign = "left";
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = mode === "shared" ? "#C2410C" : "#615B73";
  ctx.fillText(mode === "shared" ? "Shared with community" : "On this device only", m, TH - 30);
  ctx.restore();
}

export default function Paper() {
  const { small, reduce } = useScene();
  const pointer = usePagePointer();
  const group = useRef(null);
  const st = useRef({ dirty: true, rules: -1, mode: "", fold: -1, p: null });

  const parts = useMemo(() => {
    const geo = new THREE.PlaneGeometry(W, H, SX, SY);
    const base = Float32Array.from(geo.attributes.position.array);
    const canvas = document.createElement("canvas");
    canvas.width = TW;
    canvas.height = TH;
    const ctx = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const a = document.createElement("canvas");
    a.width = 240;
    a.height = 320;
    const actx = a.getContext("2d");
    actx.fillStyle = "#000";
    actx.fillRect(0, 0, a.width, a.height);
    actx.fillStyle = "#fff";
    roundRect(actx, 0, 0, a.width, a.height, 7);
    actx.fill();
    const alpha = new THREE.CanvasTexture(a);
    return { geo, base, ctx, tex, alpha };
  }, []);

  useEffect(() => {
    const mark = () => { st.current.dirty = true; };
    const u1 = subscribeCurrentDoc(mark);
    const u2 = paperState.sub(mark);
    return () => {
      u1();
      u2();
      parts.geo.dispose();
      parts.tex.dispose();
      parts.alpha.dispose();
    };
  }, [parts]);

  const deform = (p) => {
    const { geo, base } = parts;
    const arr = geo.attributes.position.array;
    const a = 0.02 + (1 - p) * 0.3;
    const b = 0.02 + (1 - p) * 0.12;
    const curl = 0.04 + (1 - p) * 0.1;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      let ny = y;
      let nz = 0;
      if (y > C1) {
        const dy = y - C1;
        ny = C1 + dy * Math.cos(a);
        nz = dy * Math.sin(a);
      } else if (y < C2) {
        const dy = C2 - y;
        ny = C2 - dy * Math.cos(b);
        nz = -dy * Math.sin(b);
      }
      const d = x / W + 0.5 + (y / H + 0.5) - 1.62;
      if (d > 0) nz += d * d * curl * 3;
      arr[i + 1] = ny;
      arr[i + 2] = nz;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };

  useFrame((state, dt) => {
    const s = st.current;
    const target = reduce ? 1 : Math.min(1, Math.max(0, window.scrollY / 520));
    s.p = s.p == null || reduce ? target : THREE.MathUtils.damp(s.p, target, 6, dt);
    const p = s.p;

    const mode = paperState.get().mode;
    const rules = reduce ? 8 : Math.round(p * 8);
    if (s.dirty || rules !== s.rules || mode !== s.mode) {
      drawPaper(parts.ctx, getCurrentDoc(), rules, mode, () => { s.dirty = true; });
      parts.tex.needsUpdate = true;
      s.dirty = false;
      s.rules = rules;
      s.mode = mode;
    }
    if (Math.abs(p - s.fold) > 0.0005) {
      deform(reduce ? 1 : p);
      s.fold = p;
    }

    const g = group.current;
    if (!g) return;
    const pt = (pointer && (pointer.current || pointer)) || { x: 0, y: 0 };
    const maxT = ((small ? 1 : 2.5) * Math.PI) / 180;
    const tx = reduce ? 0 : -(pt.y || 0) * maxT;
    const ty = reduce ? 0 : (pt.x || 0) * maxT;
    const rx = THREE.MathUtils.lerp(-0.12, -0.04, p) + tx;
    const ry = THREE.MathUtils.lerp(0.1, 0, p) + ty;
    const rz = THREE.MathUtils.lerp(-0.08, -0.02, p);
    const px = mode === "shared" ? 0.25 : 0;
    if (reduce) {
      g.rotation.set(-0.04, 0, -0.02);
      g.position.x = px;
      return;
    }
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, rx, 5, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ry, 5, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, rz, 5, dt);
    g.position.x = THREE.MathUtils.damp(g.position.x, px, 4, dt);
  });

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[-2, 3, 5]} intensity={1.8} />
      <pointLight position={[3, -1, 2.5]} color="#7B61FF" intensity={0.3} />
      <group ref={group} position={[0, 0.12, 0]}>
        <mesh geometry={parts.geo}>
          <meshStandardMaterial
            map={parts.tex}
            alphaMap={parts.alpha}
            alphaTest={0.5}
            roughness={0.95}
            metalness={0}
            emissive="#FFFFFF"
            emissiveMap={parts.tex}
            emissiveIntensity={0.35}
            envMapIntensity={0.15}
            side={THREE.FrontSide}
          />
        </mesh>
        <mesh geometry={parts.geo} position={[0, 0, -0.008]}>
          <meshStandardMaterial
            color="#EFECE6"
            alphaMap={parts.alpha}
            alphaTest={0.5}
            roughness={0.9}
            metalness={0}
            side={THREE.BackSide}
          />
        </mesh>
      </group>
      <ContactShadows position={[0, -1.7, 0]} scale={6} blur={2.6} far={3} opacity={0.32} color="#4B3BB0" />
    </>
  );
}
