/**
 * Connectify Wallpaper Crop: the upload prompt between rescaling and cropping (theme-wallpaper-fit.js).
 * The rescaled image fills a frame shaped like the screen; a Size slider (or the wheel / a trackpad pinch) resizes
 * it from 100% (the whole image's `cover` fit) to MAX_ZOOM, and dragging places it. Use Wallpaper resolves
 * to the crop, Cancel / Escape / a click outside to null. Exposes window.ConnectifyWallpaperCrop.
 */
(function () {
  'use strict';

  if (window.ConnectifyWallpaperCrop) return;

  const FRAME_MAX_WIDTH = 560;
  const ID = 'cx-wallpaper-crop';

  function markup(maxZoom) {
    return `
      <div class="cx-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="cx-crop-title">
        <div class="cx-crop-title" id="cx-crop-title">Adjust Wallpaper</div>
        <div class="cx-crop-frame"><canvas class="cx-crop-canvas" aria-label="Wallpaper preview: drag to move it"></canvas></div>
        <label class="cx-crop-size">Size
          <input type="range" class="cx-crop-zoom" min="100" max="${Math.round(maxZoom * 100)}" step="1" value="100">
          <span class="cx-crop-zoom-value">100%</span>
        </label>
        <div class="cx-crop-actions">
          <button type="button" class="cx-btn cx-btn-secondary cx-crop-reset">Reset</button>
          <span class="cx-crop-spacer"></span>
          <button type="button" class="cx-btn cx-btn-secondary cx-crop-cancel">Cancel</button>
          <button type="button" class="cx-btn cx-btn-primary cx-crop-apply">Use Wallpaper</button>
        </div>
      </div>`;
  }

  /** Opens the prompt for a rescaled image ({ source, width, height, target }); resolves to its crop, or null. */
  function prompt({ source, width, height, target }) {
    const fit = window.ConnectifyWallpaperFit;
    const maxZoom = fit?.MAX_ZOOM || 3;
    document.getElementById(ID)?.remove();
    const overlay = document.createElement('div');
    overlay.id = ID;
    overlay.innerHTML = markup(maxZoom);
    document.body.appendChild(overlay);

    const frame = overlay.querySelector('.cx-crop-frame');
    const canvas = overlay.querySelector('.cx-crop-canvas');
    const slider = overlay.querySelector('.cx-crop-zoom');
    const sizeText = overlay.querySelector('.cx-crop-zoom-value');
    const ctx = canvas.getContext('2d');
    const view = { zoom: 1, cx: 0.5, cy: 0.5 };
    frame.style.aspectRatio = `${target.width} / ${target.height}`;
    frame.style.maxWidth = `min(${FRAME_MAX_WIDTH}px, calc((80vh - 140px) * ${target.width / target.height}))`;

    const rect = () => fit.cropRect(width, height, target.width, target.height, view.zoom, view.cx, view.cy);

    // The crop's centre, kept inside the image, so the slider and dragging never run past its edges
    function settle() {
      const r = rect();
      view.cx = (r.sx + r.sw / 2) / width;
      view.cy = (r.sy + r.sh / 2) / height;
      return r;
    }

    function draw() {
      const r = settle();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(frame.clientWidth * dpr)), h = Math.max(1, Math.round(frame.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
      slider.value = String(Math.round(view.zoom * 100));
      sizeText.textContent = `${Math.round(view.zoom * 100)}%`;
    }

    function setZoom(zoom) {
      view.zoom = Math.min(maxZoom, Math.max(1, zoom));
      draw();
    }

    // Dragging moves the image under the frame: a frame-width drag moves the crop by its own width
    let drag = null;
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      e.preventDefault();
      const r = rect();
      view.cx = drag.cx - ((e.clientX - drag.x) / frame.clientWidth) * (r.sw / width);
      view.cy = drag.cy - ((e.clientY - drag.y) / frame.clientHeight) * (r.sh / height);
      draw();
    });
    const endDrag = () => { drag = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      setZoom(view.zoom * Math.exp(-e.deltaY / (e.ctrlKey ? 100 : 500))); // ctrlKey: a trackpad pinch
    }, { passive: false });
    slider.addEventListener('input', () => setZoom(Number(slider.value) / 100));

    return new Promise(resolve => {
      const close = result => {
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', draw);
        overlay.remove();
        resolve(result);
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
        else if (e.key === 'Enter' && e.target === slider) { e.preventDefault(); close(settle()); }
      };
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', draw);
      // A click outside the dialog cancels; no click leaves the prompt, so the sidebar's outside-click never closes Settings
      let downOnBackdrop = false;
      overlay.addEventListener('pointerdown', e => { downOnBackdrop = e.target === overlay; });
      overlay.addEventListener('click', e => {
        e.stopPropagation();
        if (e.target === overlay && downOnBackdrop) close(null);
      });
      overlay.querySelector('.cx-crop-cancel').onclick = () => close(null);
      overlay.querySelector('.cx-crop-apply').onclick = () => close(settle());
      overlay.querySelector('.cx-crop-reset').onclick = () => { Object.assign(view, { zoom: 1, cx: 0.5, cy: 0.5 }); draw(); };
      requestAnimationFrame(() => { draw(); overlay.querySelector('.cx-crop-apply').focus(); });
    });
  }

  window.ConnectifyWallpaperCrop = { prompt };
})();
