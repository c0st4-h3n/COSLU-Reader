// Família 3D/CAD — three.js (glb/gltf/stl/obj/ply). §13: o modelo é
// parseado SÓ dos bytes do arquivo; não resolvemos URIs externas nem
// fazemos fetch (glb self-contained é o caso ideal; .gltf com refs
// externas falha por design). three é chunk lazy (entry intocado).
// Robusto contra corrida (cancel-token + dispose) como o EpubViewer.
// Falha de parse → throw → fallback chain (texto → hex).

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ViewerProps } from "../../types";

type State = { t: "load" } | { t: "ready" } | { t: "err" };

async function loadObject(
  ext: string,
  bytes: Uint8Array,
): Promise<THREE.Object3D> {
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const branded = new THREE.MeshStandardMaterial({
    color: 0xb8311e,
    metalness: 0.1,
    roughness: 0.55,
    flatShading: false,
  });

  if (ext === "stl") {
    const g = new STLLoader().parse(ab);
    g.computeVertexNormals();
    return new THREE.Mesh(g, branded);
  }
  if (ext === "ply") {
    const g = new PLYLoader().parse(ab);
    g.computeVertexNormals();
    return new THREE.Mesh(g, branded);
  }
  if (ext === "obj") {
    return new OBJLoader().parse(new TextDecoder().decode(bytes));
  }
  // glb / gltf
  return await new Promise<THREE.Object3D>((resolve, reject) => {
    new GLTFLoader().parse(
      ab,
      "",
      (gltf) => resolve(gltf.scene),
      (e) => reject(e),
    );
  });
}

export default function ThreeViewer({ source }: ViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const ext = source.name.split(".").pop()?.toLowerCase() ?? "";
      const bytes = await source.loadBytes();
      if (cancelled || !hostRef.current) return;
      const host = hostRef.current;
      const obj = await loadObject(ext, bytes);
      if (cancelled) return;

      const w = host.clientWidth || 800;
      const h = host.clientHeight || 600;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe5dec9); // papel-2

      // centra e enquadra
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const radius = Math.max(size.x, size.y, size.z) || 1;

      const camera = new THREE.PerspectiveCamera(50, w / h, radius / 100, radius * 100);
      camera.position.set(radius * 1.6, radius * 1.2, radius * 1.8);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir = new THREE.DirectionalLight(0xffffff, 1.1);
      dir.position.set(1, 1.5, 1);
      scene.add(dir);
      const grid = new THREE.GridHelper(radius * 4, 20, 0x8c8478, 0xd9d1bf);
      grid.position.y = -radius;
      scene.add(grid);
      scene.add(obj);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(w, h);
      host.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 0, 0);

      const tick = () => {
        if (cancelled) return;
        controls!.update();
        renderer!.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
      setS({ t: "ready" });

      ro = new ResizeObserver(() => {
        const nw = host.clientWidth,
          nh = host.clientHeight;
        if (!nw || !nh || !renderer) return;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      });
      ro.observe(host);
    })().catch(() => !cancelled && setS({ t: "err" }));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      controls?.dispose();
      renderer?.dispose();
      const el = renderer?.domElement;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, [source]);

  if (s.t === "err") throw new Error("modelo 3D inválido");

  return (
    <div className="view-3d">
      <div className="archive-bar">
        <span className="crumb">
          {source.name} · 3D · arraste p/ girar · scroll p/ zoom
        </span>
      </div>
      <div className="three-stage">
        <div ref={hostRef} className="three-host" />
        {s.t !== "ready" && (
          <div className="status three-loading">Carregando modelo 3D…</div>
        )}
      </div>
    </div>
  );
}
