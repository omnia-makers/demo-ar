// QR search for webxr-test.html, off the main thread so the AR view does not stall.
// In: { id, pixels (RGBA, row 0 = bottom as gl.readPixels gives it), width, height }.
// Out: { id, code: { data, location } | null }, location in px with rows from the top of the flipped image.
// The camera texture may already be upside down (not documented); jsQR then sees a mirrored code and does
// not always read it, so the unflipped buffer is tried too and its corners are mapped to the flipped image.
importScripts('vendor/jsqr/jsQR.js');

onmessage = ({ data: { id, pixels, width, height } }) => {
  const flipped = new Uint8ClampedArray(width * height * 4);
  const row = width * 4;
  for (let y = 0; y < height; y++) flipped.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  let code = jsQR(flipped, width, height, { inversionAttempts: 'dontInvert' });
  if (!code) {
    code = jsQR(new Uint8ClampedArray(pixels.buffer), width, height, { inversionAttempts: 'dontInvert' });
    if (code) {
      for (const p of Object.values(code.location)) p.y = height - p.y;
    }
  }
  postMessage({ id, code: code && { data: code.data, location: code.location } });
};
