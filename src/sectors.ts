import { BLOOM_LAYER } from "./config/renderConfig";
import * as THREE from "three";
import type { GUI } from "dat.gui";

const GREEN = 0x00ff41;
const SEG   = 128;
const DEG   = Math.PI / 180; // degrees → radians

// ─────────────────────────────── geometry helpers ─────────────────────────

function fillMat(opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: GREEN, transparent: true, opacity,
    side: THREE.DoubleSide, depthWrite: false,
  });
}

function lineMat(opacity = 0.9): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity });
}

function arcGeo(r: number, start: number, end: number, segs = 64): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = start + (end - start) * (i / segs);
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function circleLoopGeo(r: number, segs = SEG): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function circleLineGeo(r: number, segs = SEG): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function radialGeo(rIn: number, rOut: number, angle: number): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(Math.cos(angle) * rIn,  Math.sin(angle) * rIn,  0),
    new THREE.Vector3(Math.cos(angle) * rOut, Math.sin(angle) * rOut, 0),
  ]);
}

function addLine(geo: THREE.BufferGeometry, grp: THREE.Group, bloom: boolean, opacity = 0.9, ro = 2) {
  const line = new THREE.Line(geo, lineMat(opacity));
  line.renderOrder = ro;
  if (bloom) line.layers.enable(BLOOM_LAYER);
  grp.add(line);
}

function addLoop(geo: THREE.BufferGeometry, grp: THREE.Group, bloom: boolean, opacity = 0.9, ro = 2) {
  const line = new THREE.LineLoop(geo, lineMat(opacity));
  line.renderOrder = ro;
  if (bloom) line.layers.enable(BLOOM_LAYER);
  grp.add(line);
}

function makeLabel(text: string, worldWidth: number, ro: number): THREE.Sprite {
  const cw = 512, ch = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, cw, ch);
  ctx.font = "bold 48px monospace";
  ctx.fillStyle = "#00ff41";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), cw / 2, ch / 2);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true, depthWrite: false, sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(worldWidth, worldWidth / 4, 1);
  sprite.renderOrder = ro;
  return sprite;
}

function disposeGroup(grp: THREE.Group) {
  grp.traverse((obj) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = obj as any;
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mats.forEach((m: any) => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

// ─────────────────────────────── ZoneMap ──────────────────────────────────

export class ZoneMap {
  private group   = new THREE.Group();
  private gui:     GUI;
  private folder:  GUI; // reference kept so we can remove it on dispose

  controls = {
    visible: true,          // ← add this at the top
    // ── Radii ───────────────────────────────────────────────────────────
    mistRadius:           46,   // The Mist outer / Ring inner
    ringOuterRadius:     164,   // The Ring outer / Outside inner
    outsideRadius:       215,   // Outside outer (dashed boundary)

    // ── The Ring (degrees) ───────────────────────────────────────────────
    ringStartDeg:         20,
    ringLengthDeg:       300,

     // ── The Brink (degrees) ───────────────────────────────────────────────
     brinkStartDeg:         20,
     brinkLengthDeg:       300,

    // ── Authority (degrees / radii) ──────────────────────────────────────
    authorityOuterRadius: 109,
    authorityStartDeg:    36,
    authorityLengthDeg:   60,

    // ── The Forge (degrees / radii) ──────────────────────────────────────
    forgeInnerRadius:     121,
    forgeStartDeg:       56,
    forgeLengthDeg:       62,
  };

  constructor(gui: GUI) {
    this.gui = gui;
    this.folder = this.buildGui();
  }

  // ── GUI ────────────────────────────────────────────────────────────────

  private buildGui(): GUI {
    
    const folder  = this.gui.addFolder("Zones");
    folder.add(this.controls, "visible")
    .name("Show Zones")
    .onChange((val: boolean) => { this.group.visible = val; });
    const rebuild = this.debounce(() => this.rebuild(), 150);

    // Radii ───────────────────────────────────────────────────────────────
    const radii = folder.addFolder("Radii");
    radii.add(this.controls, "mistRadius",           10, 100, 1).name("Mist Radius"    ).onChange(rebuild).listen();
    radii.add(this.controls, "ringOuterRadius",      60, 250, 1).name("Ring Outer R"   ).onChange(rebuild).listen();
    radii.add(this.controls, "outsideRadius",       150, 400, 1).name("Outside Outer R").onChange(rebuild).listen();
    radii.open();

    // The Ring ────────────────────────────────────────────────────────────
    const ring = folder.addFolder("The Ring");
    ring.add(this.controls, "ringStartDeg",   0, 360, 1).name("Start °" ).onChange(rebuild).listen();
    ring.add(this.controls, "ringLengthDeg", 10, 360, 1).name("Length °").onChange(rebuild).listen();
    ring.open();

    // The Brink────────────────────────────────────────────────────────────
    const brink = folder.addFolder("The Brink");
    brink.add(this.controls, "brinkStartDeg",   0, 360, 1).name("Start °" ).onChange(rebuild).listen();
    brink.add(this.controls, "brinkLengthDeg", 10, 360, 1).name("Length °").onChange(rebuild).listen();
    brink.open();

    // Authority ───────────────────────────────────────────────────────────
    const auth = folder.addFolder("Authority");
    auth.add(this.controls, "authorityOuterRadius", 20, 200, 1).name("Outer Radius").onChange(rebuild).listen();
    auth.add(this.controls, "authorityStartDeg",     0, 360, 1).name("Start °"     ).onChange(rebuild).listen();
    auth.add(this.controls, "authorityLengthDeg",    5, 180, 1).name("Length °"    ).onChange(rebuild).listen();
    auth.open();

    // The Forge ───────────────────────────────────────────────────────────
    const forge = folder.addFolder("The Forge");
    forge.add(this.controls, "forgeInnerRadius", 10, 200, 1).name("Inner Radius").onChange(rebuild).listen();
    forge.add(this.controls, "forgeStartDeg",     0, 360, 1).name("Start °"     ).onChange(rebuild).listen();
    forge.add(this.controls, "forgeLengthDeg",    5, 180, 1).name("Length °"    ).onChange(rebuild).listen();
    forge.open();

    folder.open();
    return folder;
  }

  private debounce(fn: () => void, delay: number) {
    let timer: ReturnType<typeof setTimeout>;
    return () => { clearTimeout(timer); timer = setTimeout(fn, delay); };
  }

  // ── Build / Rebuild ────────────────────────────────────────────────────

  /** Initial mount — call once after construction */
  toThreeObject(parent: THREE.Object3D) {
    this.buildAll();
    parent.add(this.group);
  }

  /** Called by debounced GUI onChange — clears geometry and redraws */
  private rebuild() {
    disposeGroup(this.group);
    this.group.clear();
    this.buildAll();
    this.group.visible = this.controls.visible;
  }

  private buildAll() {
    this.buildOutside(); 
    this.buildTheRing();  
    this.buildTheBrink();   
    this.buildTheForge(); 
    this.buildAuthority();
    this.buildTheMist(); 
  }

  // ── Zone builders ──────────────────────────────────────────────────────

  private buildTheMist() {
    const R1 = this.controls.mistRadius;
    const ro = 5;

    const fill = new THREE.Mesh(new THREE.CircleGeometry(R1, SEG), fillMat(0.10));
    fill.renderOrder = ro;
    this.group.add(fill);

    addLoop(circleLoopGeo(R1), this.group, true, 1.0, ro);

    const label = makeLabel("The Mist", 48, ro);
    label.position.set(0, 0, 1);
    this.group.add(label);
  }

  private buildTheRing() {
    const {
      mistRadius: R1, ringOuterRadius: R2,
      ringStartDeg, ringLengthDeg,
      forgeStartDeg, forgeLengthDeg,
    } = this.controls;
    const ro = 2;

    const RING_START  = ringStartDeg  * DEG;
    const RING_LENGTH = ringLengthDeg * DEG;
    const RING_END    = RING_START + RING_LENGTH;

    const fill = new THREE.Mesh(
      new THREE.RingGeometry(R1, R2, SEG, 1, RING_START, RING_LENGTH),
      fillMat(0.04)
    );
    fill.renderOrder = ro;
    this.group.add(fill);

    addLine(arcGeo(R1, RING_START, RING_END), this.group, false, 0.30, ro); // inner: dim (Mist border covers it)
    addLine(arcGeo(R2, RING_START, RING_END), this.group, true,  1.00, ro); // outer: bright + bloom
    addLine(radialGeo(R1, R2, RING_START),    this.group, true,  1.00, ro);
    addLine(radialGeo(R1, R2, RING_END),      this.group, true,  1.00, ro);

    // Label in the open stretch between Forge end and Ring end
    const FORGE_END  = (forgeStartDeg + forgeLengthDeg) * DEG;
    const labelAngle = (FORGE_END + RING_END) / 2;
    const label      = makeLabel("The Ring", 50, ro);
    label.position.set(Math.cos(labelAngle) * (R1 + R2) / 2, Math.sin(labelAngle) * (R1 + R2) / 2, 1);
    this.group.add(label);
  }

  private buildTheBrink() {
    const {
      ringOuterRadius: R1,
      outsideRadius,
      ringStartDeg, ringLengthDeg,
      brinkStartDeg, brinkLengthDeg,
    } = this.controls;
    const ro = 2;

    const R2 =  outsideRadius- 20;

    const BRINK_START  = brinkStartDeg  * DEG;
    const BRINK_LENGTH = brinkLengthDeg * DEG;
    const BRINK_END    = BRINK_START + BRINK_LENGTH;

    const fill = new THREE.Mesh(
      new THREE.RingGeometry(R1, R2, SEG, 1, BRINK_START, BRINK_LENGTH),
      fillMat(0.04)
    );
    fill.renderOrder = ro;
    this.group.add(fill);

    addLine(arcGeo(R1, BRINK_START, BRINK_END), this.group, false, 0.30, ro); // inner: dim (Ring border covers it)
    addLine(arcGeo(R2, BRINK_START, BRINK_END), this.group, true,  1.00, ro); // outer: bright + bloom
    addLine(radialGeo(R1, R2, BRINK_START),    this.group, true,  1.00, ro);
    addLine(radialGeo(R1, R2, BRINK_END),      this.group, true,  1.00, ro);

    // Label in the open stretch between Forge end and Ring end
    const RING_END  = (ringStartDeg + ringLengthDeg) * DEG;
    const labelAngle = (RING_END + BRINK_END) / 2;
    const label      = makeLabel("The Brink", 50, ro);
    label.position.set(Math.cos(labelAngle) * (R1 + R2) / 2, Math.sin(labelAngle) * (R1 + R2) / 2, 1);
    this.group.add(label);
  }

  private buildAuthority() {
    const {
      mistRadius: R1,
      authorityOuterRadius, authorityStartDeg, authorityLengthDeg,
    } = this.controls;
    const ro = 4;

    const AUTH_R_IN  = R1;
    const AUTH_R_OUT = authorityOuterRadius;
    const AUTH_START = authorityStartDeg  * DEG;
    const AUTH_LEN   = authorityLengthDeg * DEG;
    const AUTH_END   = AUTH_START + AUTH_LEN;

    const fill = new THREE.Mesh(
      new THREE.RingGeometry(AUTH_R_IN, AUTH_R_OUT, SEG, 1, AUTH_START, AUTH_LEN),
      fillMat(0.22)
    );
    fill.renderOrder = ro;
    this.group.add(fill);

    addLine(arcGeo(AUTH_R_IN,  AUTH_START, AUTH_END),     this.group, false, 0.5,  ro); // inner: Mist border covers it
    addLine(arcGeo(AUTH_R_OUT, AUTH_START, AUTH_END),     this.group, true,  1.0,  ro);
    addLine(radialGeo(AUTH_R_IN, AUTH_R_OUT, AUTH_START), this.group, true,  1.0,  ro);
    addLine(radialGeo(AUTH_R_IN, AUTH_R_OUT, AUTH_END),   this.group, true,  1.0,  ro);

    const midAngle = AUTH_START + AUTH_LEN / 2;
    const label    = makeLabel("Authority", 36, ro);
    label.position.set(
      Math.cos(midAngle) * (AUTH_R_IN + AUTH_R_OUT) / 2,
      Math.sin(midAngle) * (AUTH_R_IN + AUTH_R_OUT) / 2,
      1
    );
    this.group.add(label);
  }

  private buildTheForge() {
    const {
      ringOuterRadius: R2,
      forgeInnerRadius, forgeStartDeg, forgeLengthDeg,
    } = this.controls;
    const ro = 3;

    const FORGE_R_IN  = forgeInnerRadius;
    const FORGE_R_OUT = R2;
    const FORGE_START = forgeStartDeg  * DEG;
    const FORGE_LEN   = forgeLengthDeg * DEG;
    const FORGE_END   = FORGE_START + FORGE_LEN;

    const fill = new THREE.Mesh(
      new THREE.RingGeometry(FORGE_R_IN, FORGE_R_OUT, SEG, 1, FORGE_START, FORGE_LEN),
      fillMat(0.14)
    );
    fill.renderOrder = ro;
    this.group.add(fill);

    addLine(arcGeo(FORGE_R_IN,  FORGE_START, FORGE_END),     this.group, true, 0.7, ro);
    addLine(arcGeo(FORGE_R_OUT, FORGE_START, FORGE_END),     this.group, true, 1.0, ro);
    addLine(radialGeo(FORGE_R_IN, FORGE_R_OUT, FORGE_START), this.group, true, 1.0, ro);
    addLine(radialGeo(FORGE_R_IN, FORGE_R_OUT, FORGE_END),   this.group, true, 1.0, ro);

    const midAngle = FORGE_START + FORGE_LEN / 2;
    const label    = makeLabel("The Forge", 44, ro);
    label.position.set(
      Math.cos(midAngle) * (FORGE_R_IN + FORGE_R_OUT) / 2,
      Math.sin(midAngle) * (FORGE_R_IN + FORGE_R_OUT) / 2,
      1
    );
    this.group.add(label);
  }

  private buildOutside() {
    const {
      ringOuterRadius: R2, outsideRadius: R3,
      ringStartDeg, ringLengthDeg,
    } = this.controls;
    const ro = 1;

    const fill = new THREE.Mesh(new THREE.RingGeometry(R2, R3, SEG), fillMat(0.02));
    fill.renderOrder = ro;
    this.group.add(fill);

    const dashed = new THREE.Line(
      circleLineGeo(R3),
      new THREE.LineDashedMaterial({
        color: GREEN, transparent: true, opacity: 0.35,
        dashSize: 10, gapSize: 7,
      })
    );
    dashed.computeLineDistances(); // required for dashes
    dashed.renderOrder = ro;
    this.group.add(dashed);

    // Label 90° past the Ring's end — stays in the unoccupied Outside arc
    const RING_END   = (ringStartDeg + ringLengthDeg) * DEG;
    const labelAngle = RING_END + Math.PI * 0.5;
    const label      = makeLabel("Outside", 60, ro);
    label.position.set(
      Math.cos(labelAngle) * (R2 + R3) / 2,
      Math.sin(labelAngle) * (R2 + R3) / 2,
      1
    );
    this.group.add(label);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  removeObject() {
    disposeGroup(this.group);
    this.group.removeFromParent();
    // Remove the GUI folder so it doesn't accumulate if generateSectors() is called again
    try { this.gui.removeFolder(this.folder); } catch (_) { /* already removed */ }
  }
}
