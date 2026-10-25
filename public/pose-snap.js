// Pose smoothing with a jump, on the MindAR target of index.html (MindAR's own filter is turned off, see
// a-scene). Small differences between the detected pose and the shown one are tracking noise: the shown pose
// eases towards the detected one (time constant `smooth`, s), so the fox does not shake when still.
// A difference over `snap` (target widths) or `snapDeg` (degrees) means the phone moved: the shown
// pose jumps to the detected one, so the fox does not slide behind the floor.
// MindAR assigns a new matrix object on every detection, so a matrix other than ours is a new reading.
AFRAME.registerComponent('pose-snap', {
  schema: {
    smooth: { default: 0.5 },
    snap: { default: 0.01 },
    snapDeg: { default: 6 },
  },
  init() {
    this.out = new THREE.Matrix4();
    this.raw = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    this.cur = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    this.ready = false;
    this.onLost = () => { this.ready = false; };
    this.el.addEventListener('targetLost', this.onLost);
  },
  remove() {
    this.el.removeEventListener('targetLost', this.onLost);
  },
  tick(t, dt) {
    const obj = this.el.object3D;
    if (!obj.visible) {
      this.ready = false;
      return;
    }
    const { raw, cur, data } = this;
    if (obj.matrix !== this.out) obj.matrix.decompose(raw.p, raw.q, raw.s);
    // raw.s.x: target width in camera units (MindAR scales the target to its width).
    const far = cur.p.distanceTo(raw.p) > data.snap * raw.s.x
      || THREE.MathUtils.radToDeg(cur.q.angleTo(raw.q)) > data.snapDeg;
    if (!this.ready || far) {
      if (this.ready) this.snaps = (this.snaps || 0) + 1;
      cur.p.copy(raw.p);
      cur.q.copy(raw.q);
      this.ready = true;
    } else {
      const k = 1 - Math.exp(-Math.min(dt, 100) / 1000 / Math.max(data.smooth, 1e-3));
      cur.p.lerp(raw.p, k);
      cur.q.slerp(raw.q, k);
    }
    this.out.compose(cur.p, cur.q, raw.s);
    obj.matrix = this.out;
    obj.matrixWorldNeedsUpdate = true;
  },
});
