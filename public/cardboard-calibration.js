// Cardboard eye placement (and the switch to fullscreen landscape), shared by calibrate.html and the headset
// mode in index.html so that what looks right while calibrating looks the same in the demo.
//
// Each eye's image must be centred on its lens, or the eyes cannot fuse the two images (double vision).
// Google's Cardboard profile (I/O 2015): lenses 63.9 mm apart, lens centre 35 mm above the bottom edge of the
// screen. CSS pixels per mm vary between phones, so the values are calibrated in CSS px and stored per device.
window.CardboardCalibration = (() => {
  const KEY = 'cardboard-calibration';
  // Rough guess, only used for the height default and the mm shown while calibrating: Android lays out at
  // about 160 CSS px per inch, but it varies between phones.
  const PX_PER_MM = 160 / 25.4;
  const LENS_HEIGHT_MM = 35;
  // Separation that fused correctly on the demo phone and viewer (calibrated 2026-10-24). The 63.9 mm of
  // the lenses converted with PX_PER_MM gave about 400 px, too wide on that phone: it has more CSS px per mm.
  const DEFAULT_SEP_PX = 303;
  // Zoom that looked best in the same viewer: the full view at 1 did not fit inside the lens.
  const DEFAULT_ZOOM = 0.55;

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  };
  const save = (values) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch (e) {
      // Private mode or blocked storage: the values just last for this page.
    }
  };
  const clear = () => {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      // Nothing stored.
    }
  };

  // Stored values, or defaults, clamped to the current screen (W x H CSS px, landscape).
  const resolve = (W, H, stored = load()) => {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    return {
      sep: clamp(stored.sep ?? Math.min(DEFAULT_SEP_PX, W / 2), W * 0.25, W * 0.75),
      y: clamp(stored.y ?? Math.min(LENS_HEIGHT_MM * PX_PER_MM, H / 2), H * 0.15, H * 0.85),
      zoom: clamp(stored.zoom ?? DEFAULT_ZOOM, 0.5, 1.5),
    };
  };

  // Centre of each eye's image and the half of the screen it is drawn into.
  const eyes = (W, H, c) => [
    { cx: W / 2 - c.sep / 2, cy: H - c.y, clipX: 0, clipW: W / 2 },
    { cx: W / 2 + c.sep / 2, cy: H - c.y, clipX: W / 2, clipW: W / 2 },
  ];

  // Fullscreen + landscape lock. Both need a user gesture and may be refused (e.g. desktop or iPhone):
  // it never fails, the split view works without them and the phone can be rotated by hand.
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      await screen.orientation.lock('landscape');
    } catch (e) {
      // Not supported.
    }
  };

  return { load, save, clear, resolve, eyes, enterFullscreen, PX_PER_MM };
})();
