# SMILE-FA Data Dictionary

Version 0.1 (draft for calibration). All thresholds marked **(prov.)** are engineering starting points and **must be replaced** with values from the SMILE normative study.

## 0. Conventions

| Item | Convention |
|---|---|
| Side | **Patient's anatomical side**. `L` = patient's left (appears on image right in an un-mirrored frame). Never screen side. |
| Coordinate frame | **Head frame (HF)**: origin = midpoint of pupil centres; +X toward patient's left; +Y up (superior); +Z toward camera (anterior). Built per frame from the fitted midsagittal plane (see §0.2). |
| Units | mm (scaled from iris diameter), degrees, ratio (0–1), %, ms, probability (0–1), blendshape coefficient (0–1). |
| Normalisation | `IOD` = inter-pupillary distance in HF. `mm_per_unit = 11.7 / mean(iris_diam_L, iris_diam_R)` (human horizontal visible iris diameter ≈ 11.7 mm; same principle as Emotrics). |
| Symmetry ratio | `SR(a,b) = min(a,b) / max(a,b)`, 1 = perfect symmetry. Undefined (null) if `max < movement floor`. |
| Signed difference | `SD = value_L − value_R`. Sign tells which side is lower/weaker. |
| Excursion | `EXC_side = ‖p_side(peak) − p_side(rest)‖` in HF mm. Rest = median over P1 valid frames; peak = 95th percentile of the task-hold window valid frames. |
| Repetition | Task metric = median over repetitions. |
| Frame validity | Frame is valid if all hard quality gates (Q-series) pass. |
| Missing | `null` + `reason` code: `not_performed`, `low_quality`, `below_floor`, `not_detected`. |

### 0.1 MediaPipe Face Landmarker landmark indices used
> Indices below are the ones commonly used for the 478-point mesh. **Verify each with the debug index overlay (task T-03) before trusting any metric.** Label by patient side.

| Anatomical point | Patient RIGHT | Patient LEFT | Midline |
|---|---|---|---|
| Oral commissure (cheilion) | 61 | 291 | — |
| Upper lip outer / inner midpoint | — | — | 0 / 13 |
| Lower lip outer / inner midpoint | — | — | 17 / 14 |
| Inner lip contour (dental show polygon) | 78, 191, 80, 81, 82, 95, 88, 178, 87 | 308, 415, 310, 311, 312, 324, 318, 402, 317 | 13, 14 |
| Upper lip peak (crista philtri) | 37 | 267 | — |
| Eye outer canthus (exocanthion) | 33 | 263 | — |
| Eye inner canthus (endocanthion) | 133 | 362 | — |
| Upper eyelid mid | 159 | 386 | — |
| Lower eyelid mid | 145 | 374 | — |
| Iris centre | 468 | 473 | — |
| Iris ring (diameter) | 469, 470, 471, 472 | 474, 475, 476, 477 | — |
| Brow mid (upper edge) | 105 | 334 | — |
| Brow inner / outer | 107 / 70 | 336 / 300 | — |
| Nasal ala | 129 | 358 | — |
| Cheek (malar) | 116 | 345 | — |
| Tragion-area face contour | 234 | 454 | — |
| Midline: forehead top, glabella, nasion, pronasale, subnasale, menton | — | — | 10, 9, 168, 1, 2, 152 |

### 0.2 Head-frame construction (per frame)
1. Convert normalised landmarks to isotropic pixels: `X = x·W, Y = y·H, Z = z·W`.
2. Fit the **midsagittal plane** using *stable, rarely paretic* bilateral pairs only: tragion (234/454), malar (116/345), ala (129/358), inner canthi (133/362), and midline points 9, 168, 1, 2, 152. Minimise distance between each point and the mirror of its partner (closed-form: plane normal = principal direction of pair vectors; offset = mean of pair midpoints).
3. Exclude mouth and brow landmarks from the fit (they are the pathology).
4. Build HF axes from plane normal (X), the projected nasion→menton direction (−Y), and cross product (Z).
5. Head pose (yaw/pitch/roll) from MediaPipe `facialTransformationMatrixes`.

---

## A. Session & participant metadata

| ID | Field | Type | Description |
|---|---|---|---|
| M01 | session_id | UUID | Generated per test |
| M02 | participant_code | string | Pseudonymous code; no names in research export |
| M03 | timestamp_start / end | ISO 8601 | Device local time + UTC offset |
| M04 | app_version / thresholds_version / model_versions | string | e.g. `fa-0.1.0`, `thr-prov-0.1`, `mp-face_landmarker-float16-1`, `faceapi-1.7.x` |
| M05 | device_class | enum | desktop / tablet |
| M06 | user_agent, camera_label | string | For reproducibility |
| M07 | video_resolution, measured_fps | int | Capture settings |
| M08 | language | enum | en, zh, ms, ta |
| M09 | mode | enum | self_screen / assisted (clinician/volunteer) |
| M10 | symptom_onset_reported | enum | none / sudden_now / earlier / unknown — if `sudden_now`, show 995 banner immediately |
| M11 | confounders (self-report) | multi | glasses, facial hair, dentures/braces, known previous facial palsy, previous stroke, recent Botox/filler, facial surgery |
| M12 | consent_version, consent_research | string, bool | PDPA |
| M13 | baseline_session_id | UUID/null | For change-from-baseline scoring |

---

## Q. Measurement quality (per frame → session summaries)

| ID | Metric | Definition / formula | Unit | Gate (prov.) | Why |
|---|---|---|---|---|---|
| Q01 | face_detected | Landmarker returned a face | bool | hard | No face = no data |
| Q02 | face_count | Number of faces | int | hard =1 | Avoid scoring bystander |
| Q03 | head_yaw | From transformation matrix | ° | hard ≤15, warn >8 | Yaw foreshortens one hemiface → false asymmetry |
| Q04 | head_pitch | " | ° | hard ≤15, warn >10 | Alters vertical distances |
| Q05 | head_roll | " | ° | hard ≤20, warn >8 | Corrected by HF, but large roll degrades mesh |
| Q06 | face_width_px | Distance 234↔454 | px | hard ≥160 | Resolution for mm accuracy |
| Q07 | iod_px | Pupil distance | px | warn <60 | Iris scale precision |
| Q08 | luminance_mean | Mean Y (Rec.601) in face oval ROI | 0–255 | hard 60–220 | Under/over exposure |
| Q09 | lighting_side_ratio | min/max mean luminance of L vs R hemiface ROI | ratio | hard ≥0.70, warn <0.85 | **Side lighting creates shadow-based false asymmetry** |
| Q10 | sharpness | Variance of Laplacian in face ROI (downscaled 256 px) | a.u. | warn < calibrated | Motion blur |
| Q11 | landmark_jitter_rest | RMS frame-to-frame displacement of stable landmarks in P1 (HF mm) | mm | warn >0.8 | Camera/processing noise floor |
| Q12 | fps_effective | Frames processed per second | fps | hard ≥12, warn <20 | Temporal metrics need ≥20 |
| Q13 | occlusion_flag | Hand/mask detected: low presence score or mouth landmarks outside face oval | bool | hard | Invalid mouth metrics |
| Q14 | valid_frame_pct_phase | Valid frames / total per phase | % | phase invalid <60% | Phase-level reliability |
| Q15 | compliance_phase | Task reached compliance threshold (Protocol §2) | bool | — | Distinguish non-performance from weakness |
| Q16 | repetition_consistency | CV of key excursion across repetitions | % | warn >35% | Unreliable effort |
| Q17 | measurement_quality_score | 100 × weighted mean of normalised Q03–Q12, Q14, Q16 | 0–100 | report; <60 → "Unable to assess" | Single quality summary |

---

## R. Resting symmetry (Phase P1) — Sunnybrook resting / NIHSS "flattened fold"

| ID | Metric | Definition / formula | Unit | Flag (prov.) | Clinical basis |
|---|---|---|---|---|---|
| R01 | commissure_height_L / _R | HF Y of 291 / 61 (below pupil line) | mm | — | Mouth droop at rest |
| R02 | commissure_height_diff | `|R01_L − R01_R|`; signed version R02s | mm | border 2.0, sig 3.5 | Sunnybrook "mouth: corner dropped"; Emotrics commissure height deviation |
| R03 | commissure_midline_dist_diff | `|X_291| − |X_61|` | mm | border 2.5, sig 4.0 | Mouth pulled to strong side |
| R04 | oral_tilt_angle | Angle between commissure line (61→291) and HF X-axis | ° | border 3, sig 5 | Crooked mouth line |
| R05 | lip_midline_deviation | HF X of upper (0) and lower (17) lip midpoints | mm | border 2.0, sig 3.5 | Philtrum/mouth deviation toward strong side |
| R06 | palpebral_fissure_height_L / _R | ‖159−145‖, ‖386−374‖ in HF | mm | — | Eye opening (Emotrics PFH) |
| R07 | palpebral_fissure_ratio | SR(R06_L, R06_R) | ratio | border <0.85, sig <0.75 | Sunnybrook resting eye: narrow/wide (peripheral palsy → wider fissure) |
| R08 | brow_height_L / _R | Perpendicular HF Y distance 334↔473, 105↔468 | mm | — | Emotrics brow height |
| R09 | brow_height_diff | `|R08_L − R08_R|` | mm | border 2.0, sig 3.5 | Brow ptosis (peripheral pattern) |
| R10 | nasolabial_depth_proxy_L / _R | **Experimental**: gradient-energy (Sobel magnitude along fold-normal) in ROI bounded by ala–commissure–malar landmarks | a.u. | — | NIHSS 1 "flattened nasolabial fold" |
| R11 | nasolabial_symmetry | SR(R10_L, R10_R) | ratio | border <0.75 (exp.) | Lighting-sensitive; valid only if Q09 ≥0.85 |
| R12 | cheek_height_diff | `|Y_345 − Y_116|` | mm | border 2.5 | Sagging malar tissue |
| R13 | global_symmetry_index_rest | Mean over 40 bilateral pairs of ‖p_i − Mirror(p_j)‖ / IOD × 100 | % IOD | border 3.0, sig 5.0 | Global resting asymmetry (Procrustes-style) |
| R14 | lower_face_symmetry_index_rest | R13 restricted to perioral pairs | % IOD | border 3.5, sig 6.0 | Lower-face focus |
| R15 | blendshape_rest_asym | Mean `|bs_L − bs_R|` for mouthSmile, mouthFrown, mouthStretch, eyeBlink at rest | 0–1 | border 0.10 | Model-derived tone asymmetry |
| R16 | spontaneous_blink_rate_L / _R | Blinks/min during P1+P9 (eyeBlink >0.5 events) | /min | — | Reduced blink on paretic side (peripheral) |
| R17 | blink_completeness_ratio | SR of mean min PFH during spontaneous blinks | ratio | border <0.8 | Incomplete blink |
| R18 | resting_symmetry_score | Sunnybrook-style 0–4 (eye 0–1, cheek 0–2, mouth 0–1) auto-assigned from R07, R11/R12, R02/R04 | points | — | Direct Sunnybrook analogue (×5 in composite) |

---

## B. Brow raise (Phase P2) — forehead sparing discriminator

| ID | Metric | Definition / formula | Unit | Flag (prov.) | Clinical basis |
|---|---|---|---|---|---|
| B01 | brow_excursion_L / _R | Peak − rest of R08 per side | mm | movement floor 1.5 | Frontalis function |
| B02 | brow_excursion_ratio | SR(B01_L, B01_R) | ratio | border <0.80, sig <0.60 | House–Brackmann / Sunnybrook brow lift |
| B03 | brow_excursion_diff | B01_L − B01_R | mm | — | Sign identifies weaker side |
| B04 | forehead_bs_ratio | SR(browOuterUp_L, browOuterUp_R) peak | ratio | border <0.75 | Model-based cross-check |
| B05 | brow_inner_up_peak | browInnerUp peak (midline) | 0–1 | — | Effort / compliance |
| B06 | brow_time_to_peak_L / _R | Time from phase start to 90% of own peak | ms | — | Movement speed |
| B07 | brow_latency_diff | `|B06_L − B06_R|` | ms | border >150 | Slowed paretic side |
| B08 | brow_eye_synkinesis_L / _R | Drop in PFH (R06) during brow raise vs rest | % | warn >20% | Sunnybrook synkinesis (chronic palsy) |
| B09 | brow_movement_score | Sunnybrook 1–5 from B02: ≥0.90→5, 0.75–0.90→4, 0.50–0.75→3, 0.25–0.50→2, <0.25→1 | 1–5 | — | Sunnybrook voluntary movement |

---

## E. Eye closure (Phases P3 gentle, P4 tight)

| ID | Metric | Definition / formula | Unit | Flag (prov.) | Clinical basis |
|---|---|---|---|---|---|
| E01 | closure_residual_gap_L / _R | Min PFH during hold | mm | sig >1.0 (lagophthalmos proxy) | Incomplete closure (peripheral) |
| E02 | closure_completeness_L / _R | `1 − E01 / R06` | % | border <90%, sig <80% | eFACE gentle / full closure |
| E03 | closure_completeness_ratio | SR(E02_L, E02_R) | ratio | border <0.90 | Sunnybrook gentle eye closure |
| E04 | eyeblink_bs_ratio | SR(eyeBlink_L, eyeBlink_R) peak | ratio | border <0.85 | Model cross-check |
| E05 | tight_squeeze_ratio | SR(eyeSquint_L, eyeSquint_R) peak in P4 | ratio | border <0.80 | NIHSS "close eyes tightly"; orbicularis strength |
| E06 | brow_descent_tight_L / _R | Rest brow height − P4 brow height | mm | — | Orbicularis/corrugator pull |
| E07 | closure_onset_latency_diff | Difference in time to 50% closure | ms | border >100 | Lid lag on weak side |
| E08 | reopen_velocity_ratio | SR of peak PFH velocity on reopening | ratio | — | Exploratory |
| E09 | eye_mouth_synkinesis_L / _R | Commissure displacement during P3/P4 (HF mm) | mm | warn >2 | Oral synkinesis (chronic peripheral) |
| E10 | eye_movement_score | Sunnybrook 1–5 from E03 (bands as B09) | 1–5 | — | Sunnybrook |

---

## S. Smile showing teeth (Phase P5) — FAST core

| ID | Metric | Definition / formula | Unit | Flag (prov.) | Clinical basis |
|---|---|---|---|---|---|
| S01 | commissure_excursion_L / _R | ‖291(peak) − 291(rest)‖, ‖61(peak) − 61(rest)‖ in HF | mm | movement floor 3 | Emotrics commissure excursion; FAST "one side doesn't move" |
| S02 | commissure_excursion_ratio | SR(S01_L, S01_R) | ratio | border <0.80, sig <0.60 | **Primary FAST metric** |
| S03 | commissure_excursion_diff | S01_L − S01_R | mm | — | Weaker side sign |
| S04 | commissure_vertical_excursion_L / _R | ΔY component of S01 | mm | — | Elevation (zygomaticus major) |
| S05 | commissure_lateral_excursion_L / _R | Δ|X| component of S01 | mm | — | Lateral pull (risorius) |
| S06 | excursion_vector_angle_L / _R | atan2(ΔY, Δ|X|) | ° | diff border >15 | Direction of smile pull |
| S07 | smile_angle | Angle of 61→291 line vs HF X at peak (mockup "smile angle") | ° | border 4, sig 7 | Crooked smile |
| S08 | commissure_height_diff_peak | Like R02 at peak | mm | border 3, sig 5 | Emotrics commissure height deviation |
| S09 | lip_elevation_L / _R | ΔY of upper lip peak 267 / 37 | mm | — | Levator labii superioris |
| S10 | lip_elevation_ratio | SR(S09_L, S09_R) | ratio | border <0.75 | Mockup "lip elevation difference" |
| S11 | dental_show_area_L / _R | Pixels classified as teeth (high V, low S in HSV; adaptive to rest mouth colour) inside inner-lip polygon, split by midsagittal plane, scaled to mm² | mm² | — | Emotrics dental show |
| S12 | dental_show_ratio | SR(S11_L, S11_R) | ratio | border <0.70 | Visible teeth fewer on weak side |
| S13 | mouth_midline_shift_peak | HF X of mouth centre (mean of 0,17,61,291) peak − rest | mm | border 2.5, sig 4 | Mouth pulled toward strong side |
| S14 | smile_bs_ratio | SR(mouthSmile_L, mouthSmile_R) peak | ratio | border <0.80, sig <0.60 | Model cross-check of S02 |
| S15 | cheek_raise_ratio | SR(cheekSquint_L, cheekSquint_R) | ratio | border <0.75 | AU6 symmetry |
| S16 | smile_time_to_peak_L / _R | Time to 90% of own peak excursion | ms | — | Speed |
| S17 | smile_latency_diff | `|S16_L − S16_R|` | ms | border >120 | Delayed paretic side |
| S18 | smile_peak_velocity_ratio | SR of peak commissure speed | ratio | border <0.70 | Dynamic weakness |
| S19 | smile_sustain_decay_L / _R | (Peak − mean of last 1 s of hold) / peak | % | border diff >15% | Fatigue of weak side |
| S20 | global_symmetry_index_smile | R13 at peak | % IOD | border 5, sig 8 | Global dynamic asymmetry |
| S21 | dynamic_asymmetry_gain | S20 − R13 | % IOD | border 2.5, sig 4 | Asymmetry that *appears with movement* (typical of weakness, unlike fixed natural asymmetry) |
| S22 | smile_movement_score | Sunnybrook 1–5 from S02 (bands as B09) | 1–5 | — | Sunnybrook open-mouth smile |

---

## P. Lip pucker (P6) and Snarl (P7)

| ID | Metric | Definition / formula | Unit | Flag (prov.) | Clinical basis |
|---|---|---|---|---|---|
| P01 | pucker_medial_excursion_L / _R | Decrease in |X| of commissure vs rest | mm | floor 2 | Orbicularis oris |
| P02 | pucker_excursion_ratio | SR(P01_L, P01_R) | ratio | border <0.75, sig <0.55 | Sunnybrook lip pucker |
| P03 | pucker_midline_shift | HF X of lip centre at peak | mm | border 2.5 | Pucker deviates to strong side |
| P04 | pucker_score | Sunnybrook 1–5 from P02 | 1–5 | — | Sunnybrook |
| N01 | snarl_lip_elevation_L / _R | ΔY of 37/267 | mm | floor 1.5 | Levator labii / nasalis |
| N02 | snarl_ratio | SR(N01_L, N01_R) | ratio | border <0.75 | Sunnybrook snarl |
| N03 | nose_sneer_bs_ratio | SR(noseSneer_L, noseSneer_R) | ratio | border <0.75 | Model cross-check |
| N04 | snarl_score | Sunnybrook 1–5 from N02 | 1–5 | — | Sunnybrook |

---

## V. Voluntary vs emotional smile (P8, optional)

| ID | Metric | Definition | Unit | Basis |
|---|---|---|---|---|
| V01 | natural_smile_excursion_ratio | S02 computed in P8 | ratio | Emotional pathway |
| V02 | voluntary_emotional_dissociation | V01 − S02 | ratio | Positive = emotional smile more symmetric than voluntary (reported in some cortical strokes); exploratory |
| V03 | duchenne_index | mean(cheekSquint) × mean(mouthSmile) at peak | 0–1 | AU6+AU12 genuine smile marker |

---

## C. Composite scores & indicators

| ID | Metric | Definition | Range | Notes |
|---|---|---|---|---|
| C01 | upper_face_asymmetry_index (UFAI) | `100 × (1 − mean(B02, E03, E05))` | 0–100 | Forehead + eye |
| C02 | lower_face_asymmetry_index (LFAI) | `100 × (1 − weighted mean(S02 ×0.35, S14 ×0.15, S12 ×0.10, P02 ×0.15, N02 ×0.05, R02_norm ×0.10, R04_norm ×0.10))`; `_norm` = 1 − min(value/sig,1) | 0–100 | Weights prov.; re-fit by logistic regression on clinical data |
| C03 | SMILE_FAI | `0.7 × LFAI + 0.3 × UFAI` | 0–100 | Headline index |
| C04 | lower_upper_ratio | LFAI / max(UFAI, 5) | ratio | >2.0 suggests forehead sparing |
| C05 | pattern | Rules: `none` if LFAI & UFAI < border; `central` if LFAI ≥ border and C04 >2 and B02 ≥0.75; `peripheral` if LFAI ≥ border and UFAI ≥ border and weak side same in upper & lower; `bilateral_or_indeterminate` otherwise | enum | Mirrors clinical UMN vs LMN reasoning |
| C06 | affected_side | Side with lower excursion in the majority of flagged ratios (sign of S03, B03, P01 diff); `none` if pattern=none; `unclear` if conflicting | enum L/R/none/unclear | Patient's side |
| C07 | sunnybrook_analogue | `voluntary(B09+E10+S22+N04+P04)×4 − R18×5` (synkinesis omitted in acute screen) | 0–100 approx. | Analogue only, not validated SFGS |
| C08 | nihss4_cv_estimate | 0: pattern none; 1: LFAI border–sig or R-flags only; 2: S02 <0.30 and P02 <0.40 with UFAI < border; 3: S02 <0.30 and B02 <0.30 (one or both sides), or no movement bilaterally with compliance evidence | 0–3 | Label "CV-estimated analogue of NIHSS Item 4" |
| C09 | cpss_face_cv | `abnormal` if C08 ≥1 else `normal` | enum | CPSS analogue |
| C10 | baseline_change_z | For each key metric: (current − baseline mean)/baseline SD (min SD floor from Q11); report max |z| among S02, B02, R02, C03 | z | Personal-baseline mode; sig if |z| >3 |
| C11 | indicator | green / amber / red / unable, per Clinical doc §3; red if C03 ≥ sig or C08 ≥2 or C10 sig; amber if border; unable if Q17 <60 or P1 or P5 invalid | enum | User-facing traffic light |
| C12 | flags[] | List of metric IDs exceeding border/sig with values | array | Transparency for clinicians |

---

## X. Expression / emotion stream

Sampling: every 200 ms (5 Hz) on a 224–320 px face crop; stored with `t_ms` and `phase`.

| ID | Metric | Definition | Unit | Source | Notes |
|---|---|---|---|---|---|
| X01–X07 | p_neutral, p_happy, p_sad, p_angry, p_fearful, p_disgusted, p_surprised | Softmax output of FaceExpressionNet | 0–1 | face-api (vladmandic) | Expression category, not felt emotion |
| X08 | dominant_expression | argmax X01–X07 | enum | derived | |
| X09 | valence_proxy | `p_happy − (p_sad + p_angry + p_fearful + p_disgusted)` clipped −1..1 | −1..1 | derived | Crude; label "proxy" |
| X10 | arousal_proxy | `p_surprised + p_fearful + p_angry + 0.5·p_happy − p_neutral` scaled 0..1 | 0–1 | derived | Crude; label "proxy" |
| X11 | expression_entropy | Shannon entropy of X01–X07 | bits | derived | Uncertainty / mixed expression |
| X12 | phase_mean_[expr] | Mean of each probability per phase | 0–1 | derived | e.g. p_happy in P5 |
| X13 | phase_dominant_pct | % of samples with each dominant label per phase | % | derived | Stacked bar |
| X14 | rest_affect_profile | X12 for P1 | vector | derived | Baseline affect (anxiety / flat) |
| X15 | expression_transitions | Count of dominant-label changes per minute (with 600 ms hysteresis) | /min | derived | Lability |
| X16 | smile_task_expression_match | p_happy mean in P5 hold | 0–1 | derived | Compliance evidence; low value with low S02 is expected in palsy — do not interpret as mood |
| X17 | AU proxies (per frame) | AU1 browInnerUp; AU2 browOuterUp L/R; AU4 browDown L/R; AU6 cheekSquint L/R; AU9 noseSneer L/R; AU12 mouthSmile L/R; AU15 mouthFrown L/R; AU18/22 mouthPucker/Funnel; AU26 jawOpen; AU43/45 eyeBlink L/R | 0–1 | MediaPipe blendshapes | Side-resolved; interpretable |
| X18 | emotion_quality | Face crop size, detector score | — | face-api | Hide stream if poor |

---

## T. Raw time series (stored per valid frame, research export)

| Field | Type | Description |
|---|---|---|
| t_ms | int | ms since P0 end |
| phase, repetition | enum, int | Protocol phase |
| valid | bool | Q gates |
| pose_yaw/pitch/roll | float | ° |
| hf_landmarks_subset | float[] | HF mm coords of the ~60 metric landmarks (not full mesh by default) |
| blendshapes | float[52] | Raw coefficients |
| per-frame metrics | float | R02s, R04, R06_L/R, R08_L/R, commissure positions, PFH, GSI |
| emotion sample | float[7] | When sampled |

**Privacy:** no video/images stored by default. Optional research setting may save one rest and one peak-smile still with explicit consent.

---

## J. Session JSON (top-level schema)
```json
{
  "meta": { "session_id": "", "participant_code": "", "app_version": "", "thresholds_version": "", "...": "M01–M13" },
  "quality": { "Q17": 0, "phases": { "P1": { "valid_pct": 0, "compliance": true } } },
  "metrics": { "R02": { "value": 0, "unit": "mm", "L": null, "R": null, "flag": "none|border|sig", "reason": null } },
  "composites": { "C03": 0, "C05": "central", "C06": "L", "C08": 1, "C11": "amber", "C12": [] },
  "emotion": { "summary": { "X12": {}, "X13": {} }, "series": [ { "t_ms": 0, "phase": "P1", "p": [0,0,0,0,0,0,0] } ] },
  "timeseries": [ ]
}
```
