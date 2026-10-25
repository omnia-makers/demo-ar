// Pose of the printed floor from the QR in its centre (webxr-test.html), as plain functions so that
// tools can test them outside the browser. Units: metres, in the WebXR reference space (Y up).
//
// Floor frame: origin at the centre of the print, x towards its right edge, z towards its bottom edge,
// y up out of it (same as the demo: the fox stands at the centre). The QR is laid as a diamond: its
// top-left corner points to the left edge of the print, top-right to the top, bottom-right to the right
// and bottom-left to the bottom. QR_DIAGONAL: TL to BR (and TR to BL) in print widths, measured with
// jsQR on public/targets/floor.png (tools/generate-floor.py --qr, 4 tiles).
(function (root) {
  const QR_DIAGONAL = 0.3772;

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };

  // Point where the ray through image point (px, py) meets the plane y = floorY, or null.
  // Image: width x height px, rows from the top. flipY: the camera texture's first row is the top of the
  // view (WebGL puts row 0 at the bottom; which one Chrome uses is not documented, so both are tried).
  // proj, view: XRView.projectionMatrix and XRView.transform.matrix (column-major).
  function floorPoint(px, py, width, height, proj, view, floorY, flipY) {
    const x = 2 * px / width - 1;
    const y = flipY ? 2 * py / height - 1 : 1 - 2 * py / height;
    // View-space direction for NDC (x, y) of a perspective projection without skew.
    const d = [(x + proj[8]) / proj[0], (y + proj[9]) / proj[5], -1];
    const w = [
      view[0] * d[0] + view[4] * d[1] + view[8] * d[2],
      view[1] * d[0] + view[5] * d[1] + view[9] * d[2],
      view[2] * d[0] + view[6] * d[1] + view[10] * d[2],
    ];
    const t = (floorY - view[13]) / w[1];
    if (!(t > 0 && t < 8)) return null;
    return [view[12] + t * w[0], floorY, view[14] + t * w[2]];
  }

  // Floor pose from the four QR corners found by jsQR, for one flipY hypothesis:
  // { center, xAxis (unit, horizontal), width (of the print, m), score (0 = perfect square), flipY } or null.
  function estimateWith(location, width, height, proj, view, floorY, flipY) {
    const p = {};
    for (const k of ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner']) {
      p[k] = floorPoint(location[k].x, location[k].y, width, height, proj, view, floorY, flipY);
      if (!p[k]) return null;
    }
    const d1 = sub(p.bottomRightCorner, p.topLeftCorner); // floor +x
    let d2 = sub(p.bottomLeftCorner, p.topRightCorner); // floor +z
    // Seen through a flipped image jsQR decodes the mirrored code and swaps TR and BL: up = z x x must be +y.
    if (d2[2] * d1[0] - d2[0] * d1[2] < 0) d2 = [-d2[0], -d2[1], -d2[2]];
    const l1 = len(d1);
    const l2 = len(d2);
    const cos = (d1[0] * d2[0] + d1[2] * d2[2]) / (l1 * l2);
    const n1 = norm(d1);
    const n2 = norm(d2);
    // Both diagonals give the x direction: d1 directly, d2 turned -90 degrees about y.
    const xAxis = norm([n1[0] + n2[2], 0, n1[2] - n2[0]]);
    const corners = Object.values(p);
    const center = [0, 1, 2].map((i) => corners.reduce((s, c) => s + c[i], 0) / 4);
    return { center, xAxis, width: (l1 + l2) / 2 / QR_DIAGONAL, score: Math.abs(Math.log(l1 / l2)) + Math.abs(cos), flipY };
  }

  // Both hypotheses, best first (null entries removed).
  function estimate(location, width, height, proj, view, floorY) {
    return [false, true]
      .map((flipY) => estimateWith(location, width, height, proj, view, floorY, flipY))
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);
  }

  const api = { QR_DIAGONAL, floorPoint, estimate };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QrFloor = api;
})(this);
