import { Scene } from "@wron/kit/3d";

export default function HeroSceneInner() {
  return (
    <Scene
      load={() => import("../../three/Paper.jsx")}
      className="absolute inset-0"
      lighting="soft"
      accent="#0F6B4F"
      camera={{ position: [0, 0, 6.4], fov: 33 }}
      mobile="lite"
    />
  );
}
