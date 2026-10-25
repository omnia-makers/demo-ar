// QR search for webxr-test.html, off the main thread so the AR view does not stall.
// In: { id, pixels (RGBA, row 0 = bottom as gl.readPixels gives it), width, height }.
// Out: { id, code: { data, location } | null, pixels }, location in px with rows from the top of the flipped
// image. pixels goes back to the page to be reused. There is always a reply, even on error: the page does
// not scan again while a reading is pending.
// The camera texture may already be upside down (not documented); jsQR then sees a mirrored code and does
// not always read it, so the unflipped buffer is tried too and its corners are mapped to the flipped image.
importScripts('vendor/jsqr/jsQR.js');

let flipped = null;

onmessage = ({ data: { id, pixels, width, height } }) => {
  let code = null;
  try {
    if (!flipped || flipped.length !== pixels.length) flipped = new Uint8ClampedArray(pixels.length);
    const row = width * 4;
    for (let y = 0; y < height; y++) flipped.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    code = jsQR(flipped, width, height, { inversionAttempts: 'dontInvert' });
    if (!code) {
      code = jsQR(new Uint8ClampedArray(pixels.buffer), width, height, { inversionAttempts: 'dontInvert' });
      if (code) {
        for (const p of Object.values(code.location)) p.y = height - p.y;
      }
    }
  } catch (err) {
    console.warn('qr-worker', err);
    code = null;
  }
  postMessage({ id, code: code && { data: code.data, location: code.location }, pixels }, [pixels.buffer]);
};
