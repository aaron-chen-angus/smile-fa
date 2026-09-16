/**
 * SMILE-FA — ui/overlay.js  (T-17, R4.4 / D2)
 *
 * Draws the face mesh, guide oval and patient L/R labels on the overlay canvas.
 * The canvas element is CSS-mirrored (scaleX(-1)) to match the mirrored video
 * preview, so we draw in un-mirrored landmark coordinates and the CSS transform
 * flips it for display. Patient-side text labels are drawn counter-flipped so
 * they read correctly to the user.
 *
 * @module ui/overlay
 */

/** A small connective subset for a light mesh (not all 478, for clarity). */
const MESH_POINTS_STEP = 1; // draw every landmark as a dot

export class Overlay {
  /**
   * @param {HTMLCanvasElement} canvas the CSS-mirrored overlay canvas
   * @param {object} landmarksCfg
   */
  constructor(canvas, landmarksCfg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = landmarksCfg;
  }

  /** Match backing store to the video intrinsic size. */
  sync(video) {
    const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
    if (this.canvas.width !== vw || this.canvas.height !== vh) {
      this.canvas.width = vw;
      this.canvas.height = vh;
    }
  }

  /**
   * Draw the mesh + oval + side labels.
   * @param {Array<{x:number,y:number}>|null} landmarks normalised
   */
  draw(landmarks) {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Guide oval (centred).
    ctx.save();
    ctx.strokeStyle = 'rgba(41,182,246,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.23, h * 0.41, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (landmarks && landmarks.length) {
      // Mesh dots.
      ctx.fillStyle = 'rgba(52,211,153,0.7)';
      for (let i = 0; i < landmarks.length; i += MESH_POINTS_STEP) {
        const p = landmarks[i];
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      this._drawSideLabels(landmarks, w, h);
    }
  }

  /**
   * Draw "L"/"R" (patient side) near each commissure. Because the canvas is
   * CSS-mirrored, we counter-flip the text so it is readable, and the labels
   * appear on the correct anatomical side to the user.
   */
  _drawSideLabels(landmarks, w, h) {
    const { ctx } = this;
    const P = this.cfg.points;
    const drawLabel = (idx, text) => {
      const p = landmarks[idx];
      const x = p.x * w, y = p.y * h;
      ctx.save();
      // Counter-flip: translate to point, scale x by -1 so text isn't mirrored.
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.fillStyle = '#E6F0FA';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, 0, -14);
      ctx.restore();
    };
    // Patient LEFT commissure = 291; RIGHT = 61.
    drawLabel(P.oral_commissure.L, 'L');
    drawLabel(P.oral_commissure.R, 'R');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
