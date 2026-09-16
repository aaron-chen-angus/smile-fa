/**
 * SMILE-FA — tests/landmarksFixture.js
 *
 * JS mirror of config/landmarks.json for use in the DOM-free test suite
 * (avoids JSON import assertions). Keep in sync with config/landmarks.json.
 *
 * @module tests/landmarksFixture
 */

export default {
  convention: { iris_diameter_mm: 11.7 },
  points: {
    oral_commissure: { R: 61, L: 291 },
    upper_lip_peak: { R: 37, L: 267 },
    eye_outer_canthus: { R: 33, L: 263 },
    eye_inner_canthus: { R: 133, L: 362 },
    upper_eyelid_mid: { R: 159, L: 386 },
    lower_eyelid_mid: { R: 145, L: 374 },
    iris_centre: { R: 468, L: 473 },
    brow_mid: { R: 105, L: 334 },
    brow_inner: { R: 107, L: 336 },
    brow_outer: { R: 70, L: 300 },
    nasal_ala: { R: 129, L: 358 },
    cheek_malar: { R: 116, L: 345 },
    tragion_contour: { R: 234, L: 454 },
  },
  iris_ring: { R: [469, 470, 471, 472], L: [474, 475, 476, 477] },
  midline: {
    forehead_top: 10, glabella: 9, nasion: 168, pronasale: 1, subnasale: 2, menton: 152,
    upper_lip_outer_mid: 0, upper_lip_inner_mid: 13, lower_lip_outer_mid: 17, lower_lip_inner_mid: 14,
  },
  headframe_fit: {
    bilateral_pairs: [
      { R: 234, L: 454, name: 'tragion' },
      { R: 116, L: 345, name: 'malar' },
      { R: 129, L: 358, name: 'ala' },
      { R: 133, L: 362, name: 'inner_canthus' },
    ],
    midline_points: [9, 168, 1, 2, 152],
  },
  blendshapes: { side_map: { patient_L: 'left', patient_R: 'right' } },
};
