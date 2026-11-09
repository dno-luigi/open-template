import { Scene } from "@wron/kit/3d";
import { PAPER_POSTER } from "../../data/site";

export default function HeroSceneInner() {
  return (
    <Scene
      load={() => import("../../three/Paper.jsx")}
      poster={PAPER_POSTER}
      className="absolute inset-0"
      lighting="soft"
      accent="#5B3DF5"
      camera={{ position: [0, 0, 6.4], fov: 33 }}
      mobile="lite"
    />
  );
}
