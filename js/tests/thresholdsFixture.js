/**
 * SMILE-FA — tests/thresholdsFixture.js
 *
 * JS mirror of config/thresholds.json for the DOM-free test suite.
 * Keep in sync with config/thresholds.json (thr-prov-0.1).
 *
 * @module tests/thresholdsFixture
 */

export default {
  thresholds_version: 'thr-prov-0.1',
  provisional: true,
  movement_floor_mm: { brow: 1.5, smile_commissure: 3.0, pucker: 2.0, snarl: 1.5 },
  quality_gates: {
    Q02_face_count: 1,
    Q03_head_yaw_deg: { hard: 15, warn: 8 },
    Q04_head_pitch_deg: { hard: 15, warn: 10 },
    Q05_head_roll_deg: { hard: 20, warn: 8 },
    Q06_face_width_px: { hard_min: 160 },
    Q07_iod_px: { warn_min: 60 },
    Q08_luminance_mean: { hard_min: 60, hard_max: 220 },
    Q09_lighting_side_ratio: { hard_min: 0.70, warn_min: 0.85 },
    Q10_sharpness: { warn_min: 30 },
    Q11_jitter_rest_mm: { warn_max: 0.8 },
    Q12_fps: { hard_min: 12, warn_min: 20 },
    Q14_valid_frame_pct: { phase_invalid_below: 60 },
    Q16_repetition_cv_pct: { warn_above: 35 },
    Q17_unable_below: 60,
    gate_hold_ms: 1500,
  },
  q17_weights: {
    Q03: 0.12, Q04: 0.12, Q05: 0.10, Q06: 0.10, Q07: 0.08,
    Q08: 0.10, Q09: 0.14, Q10: 0.06, Q11: 0.06, Q12: 0.06,
    Q14: 0.04, Q16: 0.02,
  },
  metrics: {
    R02_commissure_height_diff_mm: { border: 2.0, sig: 3.5 },
    R04_oral_tilt_angle_deg: { border: 3, sig: 5 },
    R07_palpebral_fissure_ratio: { border_below: 0.85, sig_below: 0.75 },
    R09_brow_height_diff_mm: { border: 2.0, sig: 3.5 },
    B02_brow_excursion_ratio: { border_below: 0.80, sig_below: 0.60 },
    E03_closure_completeness_ratio: { border_below: 0.90 },
    E05_tight_squeeze_ratio: { border_below: 0.80 },
    S02_commissure_excursion_ratio: { border_below: 0.80, sig_below: 0.60 },
    S07_smile_angle_deg: { border: 4, sig: 7 },
    S14_smile_bs_ratio: { border_below: 0.80, sig_below: 0.60 },
    S12_dental_show_ratio: { border_below: 0.70 },
    P02_pucker_excursion_ratio: { border_below: 0.75, sig_below: 0.55 },
    N02_snarl_ratio: { border_below: 0.75 },
    R13_global_symmetry_index_rest_pct: { border: 3.0, sig: 5.0 },
    S20_global_symmetry_index_smile_pct: { border: 5, sig: 8 },
    S21_dynamic_asymmetry_gain_pct: { border: 2.5, sig: 4 },
  },
  sunnybrook_bands: { 5: 0.90, 4: 0.75, 3: 0.50, 2: 0.25 },
  composites: {
    LFAI_weights: { S02: 0.35, S14: 0.15, S12: 0.10, P02: 0.15, N02: 0.05, R02_norm: 0.10, R04_norm: 0.10 },
    SMILE_FAI: { LFAI: 0.7, UFAI: 0.3 },
    C04_forehead_sparing_ratio_above: 2.0,
    C05_pattern: { central_requires_B02_min: 0.75, central_requires_C04_above: 2.0 },
    C08_nihss4: { level2_S02_below: 0.30, level2_P02_below: 0.40, level3_S02_below: 0.30, level3_B02_below: 0.30 },
    C10_baseline_z_sig_abs: 3.0,
    C11_indicator: { red_if_C03_sig_at: 60, amber_if_C03_border_at: 35 },
  },
  composite_index_bands: { border: 35, sig: 60 },
};
