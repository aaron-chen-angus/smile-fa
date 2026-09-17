# SMILE — Facial Asymmetry Screen

## Smart Monitoring for Individualized Living and Engagement

### Republic Polytechnic, School of Sports & Health

---

## 1. Overview

SMILE-FA is a contactless, browser-based screening aid that objectively quantifies facial movement asymmetry. It runs a short guided protocol (rest, brow raise, eye closure, smile, pucker, snarl), tracks the face with MediaPipe Face Landmarker, and computes metrics aligned with FAST, CPSS, NIHSS Item 4 and the Sunnybrook/eFACE grading traditions. It also records a synchronised facial-expression (emotion) timeline that is shown alongside — but never mixed into — the asymmetry scores. All processing happens on the device in the browser.

It is a **screening aid, not a diagnostic device**. It does not diagnose stroke. Every result screen carries the reminder: if symptoms are sudden, call 995 now. The build is labelled **research use only**, and all thresholds are **provisional** engineering starting points that must be replaced with values from a normative study before any clinical interpretation.

SMILE-FA is the Facial Asymmetry module of the SMILE programme and a companion to the **SMILE Speech Signal Lab**, with which it shares a visual identity (dark navy, cyan accents).

- **Deployment URL:** https://aaron-chen-angus.github.io/smile-fa/

---

## 2. Clinical Basis

### 2.1 Stroke and facial weakness — why it matters

Facial droop is one of the three core public-facing stroke signs in **FAST** (Face, Arm, Speech, Time) and its extension **BE-FAST** (Balance, Eyes, Face, Arm, Speech, Time). In the pre-hospital and public setting the face item is a binary judgement — normal versus abnormal, "one side of the face droops or does not move" — with no quantification. SMILE-FA's purpose is to make that same observation objective and repeatable. Any person with *sudden* face, arm or speech symptoms must be told to call **995** regardless of the app result.

### 2.2 Clinical assessment methods

**FAST / BE-FAST (face item).** "Smile / show me your teeth." Look for one side of the face drooping or not moving. Binary: normal vs abnormal.

**Cincinnati Prehospital Stroke Scale (Kothari et al., 1999).** The facial-droop item asks the patient to **show teeth or smile**. Normal = both sides move equally; abnormal = one side does not move as well as the other.

**NIHSS Item 4 — Facial Palsy (Brott et al., 1989; NINDS training).** The examiner asks (or pantomimes) the patient to **show teeth or smile, raise eyebrows, and close eyes tightly**, observing symmetry at rest and during movement.

| Score | Label | Criteria |
|---|---|---|
| 0 | Normal | Symmetrical movements |
| 1 | Minor paralysis | Flattened nasolabial fold, asymmetry on smiling |
| 2 | Partial paralysis | Total or near-total paralysis of the **lower** face |
| 3 | Complete paralysis | Absence of facial movement in upper and lower face (one or both sides) |

Other scales use the same observation: RACE (facial palsy 0–2), LAMS (facial droop 0–1), ROSIER (asymmetric facial weakness).

**House–Brackmann scale (House & Brackmann, 1985).** A global facial-nerve grade I–VI, contributing the concept of brow and mouth excursion as gradeable movement.

**Sunnybrook Facial Grading System (Ross et al., 1996).** Scores three components:

- **Resting symmetry** — eye, cheek/nasolabial fold, and mouth.
- **Voluntary movement** across **5 standard expressions** — brow lift, gentle eye closure, open-mouth smile, snarl, and lip pucker — each scored 1–5.
- **Synkinesis.**

These combine into a composite score. SMILE-FA maps its movement metrics onto these same five expressions so clinicians recognise them.

**eFACE (Banks et al., 2015).** A 0–100 continuous instrument with static, dynamic and synkinesis sub-scores.

### 2.3 Central vs peripheral facial palsy — the forehead sparing rule

The upper face (frontalis, upper orbicularis oculi) receives **bilateral** cortical input, whereas the lower face receives mainly **contralateral** input. This asymmetry of innervation is the basis of the clinical discriminator:

- **Stroke (upper motor neuron, central)** → weakness of the **lower face** on the side opposite the brain lesion, with **forehead sparing** (eyebrow raise near normal; eye closure usually preserved or mildly weak).
- **Bell's palsy / peripheral (lower motor neuron)** → the **whole hemiface** is weak, **including the forehead**, often with incomplete eye closure.

Because the forehead is spared in central lesions but not peripheral ones, **brow raise is the key discriminator**. Emotional smile can also be relatively preserved in some cortical strokes (voluntary–emotional dissociation), so the protocol prompts a **voluntary** "show teeth" as well as a natural smile.

SMILE-FA turns this reasoning into an explicit output **pattern**: Central (lower-face dominant), Peripheral (whole hemiface), Bilateral/indeterminate, or None.

### 2.4 Quantitative facial analysis literature

| Source | What it contributes |
|---|---|
| Emotrics (Guarin et al., 2018, JAMA Facial Plastic Surgery) | Automated landmark metrics: brow height, palpebral fissure height, marginal reflex distances, commissure excursion, commissure height deviation, smile angle, dental show; and mm scaling from iris diameter. |
| MediaPipe Face Mesh / Face Landmarker (Kartynnik et al., 2019; Google) | 468 3D landmarks (+10 iris = 478) and 52 blendshape coefficients in real time in the browser. |
| FACS (Ekman & Friesen, 1978) | The Action Unit vocabulary (AU1/2 brow raise, AU6 cheek raise, AU12 lip corner pull, AU43 eye closure) used as AU proxies from blendshapes. |
| One Euro Filter (Casiez et al., 2012) | Low-latency landmark smoothing. |

Design rule: **every SMILE metric maps to a Sunnybrook/eFACE/NIHSS observation**, so clinicians recognise it.

### 2.5 Expression sensing — basis and caveats

Expression is sampled with **face-api.js** (the maintained fork `@vladmandic/face-api`, using FaceExpressionNet), which outputs 7 categories: neutral, happy, sad, angry, fearful, disgusted, surprised. A complementary, more interpretable signal comes from **MediaPipe blendshapes → FACS-style AU proxies** (AU12 smile, AU6 cheek raise, AU4 brow lowerer, etc.); a Duchenne smile = AU6 + AU12.

Emotion output is deliberately **kept separate from the asymmetry scores** and shown only as a synchronised, labelled timeline. The caveats that appear in the clinician view:

1. Classifiers output **expression categories, not felt emotion** (Barrett et al., 2019, *Psychological Science in the Public Interest*).
2. **Facial palsy biases classifiers** — an asymmetric smile may score lower "happy" and higher "neutral/sad/disgusted". Emotion output must never feed the asymmetry score.
3. During prompted tasks, "happy" in P5 and "surprised" in P2 are expected and double as compliance evidence.

### 2.6 Test protocol

The guided protocol runs ≈70 s with voice prompts and animation. P0 is setup/quality-gating; P1–P9 are the measured phases.

| Phase | ID | Instruction (spoken + on screen) | Duration | Clinical mapping | Auto-compliance check |
|---|---|---|---|---|---|
| Setup | P0 | Sit upright, face the camera, fill the oval, remove glasses if possible | until quality gate passes (max 30 s) | — | Quality gates Q01–Q12 pass for 1.5 s |
| Rest | P1 | "Relax your face and look at the dot" | 5 s | NIHSS rest, Sunnybrook resting symmetry | expression neutral, jawOpen < 0.15 |
| Brow raise ×2 | P2 | "Raise both eyebrows as high as you can… hold… relax" | 3 s hold + 2 s relax, ×2 | NIHSS / Sunnybrook brow lift; forehead sparing | mean browOuterUp > 0.35 |
| Gentle eye closure | P3 | "Close your eyes gently, like sleeping" | 3 s | Sunnybrook gentle closure | eyeBlink both > 0.5 (either side) |
| Tight eye closure | P4 | "Squeeze your eyes shut tightly" | 3 s | NIHSS close eyes tightly | eyeSquint/eyeBlink max |
| Smile showing teeth ×2 | P5 | "Give me a big smile showing your teeth… hold… relax" | 3 s hold + 2 s relax, ×2 | FAST, CPSS, NIHSS, Sunnybrook open-mouth smile | mean mouthSmile > 0.4 |
| Lip pucker | P6 | "Push your lips forward, say 'ooo'" | 3 s | Sunnybrook lip pucker | mouthPucker > 0.4 |
| Snarl (optional) | P7 | "Wrinkle your nose" | 3 s | Sunnybrook snarl | noseSneer > 0.3 |
| Natural smile (optional) | P8 | Short funny/pleasant stimulus image | 4 s | Emotional vs voluntary smile | happy prob > 0.5 |
| Rest | P9 | "Relax" | 3 s | Return to baseline; drift check | — |

**Compliance and repeat rule.** A phase that fails its compliance check is **repeated once** automatically; if it fails again it is marked `not_performed` and never silently scored as weakness — a non-compliant person is not the same as a paralysed side, but an absent movement on one side while the other moves *is* asymmetry. The **median of repetitions** is used for scoring. The preview is mirrored for the user, but all computation uses **un-mirrored frames** and reports the **patient's anatomical Left/Right**.

**Rest / peak extraction.** Rest is the per-landmark **median** over the P1 valid frames. The peak for a task is the frame at the **95th percentile** of that task's driver signal in the hold window; the two sides' excursions are taken at the **same frame window** (±3 frames median) to keep L/R comparable.

### 2.7 Output indicators

| Indicator | Meaning | App message |
|---|---|---|
| 🟢 Within reference | All asymmetry metrics within reference band | "No significant facial asymmetry measured. If you have sudden symptoms, call 995." |
| 🟠 Borderline | 1+ metrics in borderline band, or asymmetry pattern weak | "Mild asymmetry measured. Compare with your baseline / seek medical advice. If sudden, call 995." |
| 🔴 Significant asymmetry | Lower-face (or whole-face) asymmetry above threshold | "Significant one-sided facial weakness pattern measured (patient's LEFT/RIGHT). If this is new or sudden, call 995 now." |
| ⚪ Unable to assess | Quality or compliance failed | "Could not measure reliably. Please repeat. If you have symptoms, call 995." |

**Pattern classification (C05).** Rules: `none` if LFAI and UFAI are both below border; `central` if LFAI ≥ border, the lower/upper ratio C04 > 2, and brow excursion ratio B02 ≥ 0.75; `peripheral` if both LFAI and UFAI ≥ border and the weak side is the same in upper and lower face; `bilateral_or_indeterminate` otherwise.

**CV-estimated NIHSS-4 analogue (C08), 0–3.** Labelled "CV-estimated analogue of NIHSS Item 4", not a validated score:

| Level | Condition |
|---|---|
| 0 | pattern = none |
| 1 | LFAI border–sig, or resting flags only |
| 2 | S02 < 0.30 and P02 < 0.40 with UFAI < border |
| 3 | S02 < 0.30 and B02 < 0.30 (one or both sides), or no movement bilaterally with compliance evidence |

The CPSS facial-droop analogue (C09) is `abnormal` if C08 ≥ 1, else `normal`.

**Personal baseline rationale.** Healthy faces are naturally asymmetric. For community or repeat users, storing a personal baseline and reporting change as a z-score against the user's own baseline (C10) is far more sensitive than population thresholds. **Do not** display a "confidence %" style number — landmark detection confidence is not diagnostic confidence; show measurement quality (Q17) instead.

### 2.8 Validation pathway

1. **Technical.** Landmark index overlay verification; side-convention test (subject winks left eye → must report LEFT); synthetic asymmetry test (image warps of known mm).
2. **Normative study.** Healthy adults across age bands and ethnic groups relevant to Singapore; test–retest (ICC 2,1); lighting/pose robustness; derive reference bands (e.g. 95th percentile).
3. **Concurrent validity.** Against manual Emotrics measurement (Bland–Altman) and clinician Sunnybrook / eFACE.
4. **Clinical accuracy.** Acute stroke unit cohort plus mimics (Bell's palsy, old stroke, dental/Botox, natural asymmetry); reference = two blinded clinicians' NIHSS Item 4 plus final diagnosis. Report sensitivity, specificity, ROC AUC, weighted kappa; prioritise sensitivity for the red threshold.
5. **Ethics/PDPA.** IRB approval, PDPA consent, on-device processing, no video retention by default.

---

## 3. Data Dictionary

Reproduced from `docs/02_Data_Dictionary.md` (Version 0.1, draft for calibration). All thresholds marked **(prov.)** are engineering starting points and must be replaced with values from the SMILE normative study.

### 3.0 Conventions and coordinate system

| Item | Convention |
|---|---|
| Side | **Patient's anatomical side**. `L` = patient's left (appears on image right in an un-mirrored frame). Never screen side. |
| Coordinate frame | **Head frame (HF)**: origin = midpoint of pupil centres; +X toward patient's left; +Y up (superior); +Z toward camera (anterior). Built per frame from the fitted midsagittal plane. |
| Units | mm (scaled from iris diameter), degrees, ratio (0–1), %, ms, probability (0–1), blendshape coefficient (0–1). |
| Normalisation | `IOD` = inter-pupillary distance in HF. `mm_per_unit = 11.7 / mean(iris_diam_L, iris_diam_R)` (human horizontal visible iris diameter ≈ 11.7 mm; same principle as Emotrics). |
| Symmetry ratio | `SR(a,b) = min(a,b) / max(a,b)`, 1 = perfect symmetry. Undefined (null) if `max < movement floor`. |
| Signed difference | `SD = value_L − value_R`. Sign tells which side is lower/weaker. |
| Excursion | `EXC_side = ‖p_side(peak) − p_side(rest)‖` in HF mm. Rest = median over P1 valid frames; peak = 95th percentile of the task-hold window valid frames. |
| Repetition | Task metric = median over repetitions. |
| Frame validity | Frame is valid if all hard quality gates (Q-series) pass. |
| Missing | `null` + `reason` code: `not_performed`, `low_quality`, `below_floor`, `not_detected`. |

**MediaPipe Face Landmarker landmark indices used** (verify each with the debug index overlay before trusting any metric; label by patient side):

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

**Head-frame construction (per frame).**

1. Convert normalised landmarks to isotropic pixels: `X = x·W, Y = y·H, Z = z·W`.
2. Fit the **midsagittal plane** using stable, rarely paretic bilateral pairs only: tragion (234/454), malar (116/345), ala (129/358), inner canthi (133/362), and midline points 9, 168, 1, 2, 152. Minimise distance between each point and the mirror of its partner (closed form: plane normal = principal direction of pair vectors; offset = mean of pair midpoints).
3. Exclude mouth and brow landmarks from the fit (they are the pathology).
4. Build HF axes from plane normal (X), the projected nasion→menton direction (−Y), and cross product (Z).
5. Head pose (yaw/pitch/roll) from MediaPipe `facialTransformationMatrixes`.

### 3.1 Session and participant metadata (M-series)

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

### 3.2 Measurement quality (Q-series)

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

### 3.3 Resting symmetry — Phase P1 (R-series)

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

### 3.4 Brow raise — Phase P2 (B-series)

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

### 3.5 Eye closure — Phases P3/P4 (E-series)

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

### 3.6 Smile showing teeth — Phase P5 (S-series)

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

### 3.7 Lip pucker and snarl — Phases P6/P7 (P/N-series)

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

### 3.8 Voluntary vs emotional smile — Phase P8 (V-series)

| ID | Metric | Definition | Unit | Basis |
|---|---|---|---|---|
| V01 | natural_smile_excursion_ratio | S02 computed in P8 | ratio | Emotional pathway |
| V02 | voluntary_emotional_dissociation | V01 − S02 | ratio | Positive = emotional smile more symmetric than voluntary (reported in some cortical strokes); exploratory |
| V03 | duchenne_index | mean(cheekSquint) × mean(mouthSmile) at peak | 0–1 | AU6+AU12 genuine smile marker |

### 3.9 Composite scores and indicators (C-series)

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

### 3.10 Expression / emotion stream (X-series)

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

### 3.11 Raw time series (T-series)

Stored per valid frame for research export.

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

**Privacy:** no video/images stored by default. An optional research setting may save one rest and one peak-smile still with explicit consent.

### 3.12 Session JSON schema

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

---

## 4. Technical Documentation

### 4.1 Architecture

- **Static web app.** No server, no build step, no Node/npm, no bundler. Plain HTML5 + CSS + vanilla JavaScript ES modules.
- **Deployment.** GitHub Pages over HTTPS (HTTPS is required for camera access; `file://` will not work because ES module, WASM and model fetches fail there).
- All processing is 100% on-device; no video, images or landmarks leave the browser.

Folder structure (from `design.md`):

```
/index.html                 app shell (screens as <section>s)
/debug.html                 landmark index overlay, HF axes, raw metrics
/tests.html                 engine unit tests (synthetic data)
/css/app.css                design tokens, landscape grid, components
/config/thresholds.json     versioned border/sig bands, weights
/config/landmarks.json      patient-side named indices
/config/protocol.json       phases, durations, compliance rules
/i18n/en.json zh.json ms.json ta.json
/js/app.js                  screen router + state machine
/js/camera.js               getUserMedia / video-file source, frame loop
/js/vision/landmarker.js    MediaPipe FaceLandmarker wrapper (GPU delegate, CPU fallback)
/js/vision/emotion.js       face-api loader, 5 Hz sampler on offscreen canvas
/js/engine/filter.js        One Euro filter
/js/engine/headframe.js     midsagittal plane fit, HF transform, mm scale
/js/engine/quality.js       Q01–Q17
/js/engine/frameMetrics.js  per-frame primitives (positions, PFH, brow height, GSI)
/js/engine/phaseMetrics.js  rest/peak extraction, excursions, latencies (R,B,E,S,P,N,V)
/js/engine/composites.js    C01–C12
/js/engine/dental.js        teeth pixel classification (S11)
/js/engine/nasolabial.js    experimental R10
/js/engine/emotionMetrics.js X08–X16
/js/protocol/runner.js      phase timing, compliance, repetition, pause/resume
/js/ui/overlay.js           mesh + guide oval + side labels on canvas
/js/ui/liveCharts.js        Chart.js streaming emotion + L/R traces
/js/ui/results.js           public + clinician views, face diagram SVG
/js/ui/report.js            print layout
/js/data/store.js           IndexedDB sessions/baselines
/js/data/export.js          JSON/CSV
/js/voice.js                speechSynthesis prompts
/vendor/mediapipe/…  /vendor/face-api/…  /vendor/chartjs/…
/assets/pictograms/*.svg    task animations
```

### 4.2 Libraries and models

All third-party libraries are loaded as browser files only — vendored copies in `/vendor` are preferred, with a pinned CDN fallback.

| Library | Version | Purpose | CDN fallback URL |
|---|---|---|---|
| MediaPipe Tasks Vision | 0.10.22-rc.20250304 | FaceLandmarker: 478 landmarks + 52 blendshapes + 4×4 transformation matrix; GPU delegate with CPU fallback | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/` |
| @vladmandic/face-api | 1.7.14 | FaceExpressionNet + tiny_face_detector; 7-class expression output | `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.esm.js` |
| Chart.js | 4.5.0 | Live emotion chart, session time-series charts, per-phase stacked bar | `https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js` |
| Web Speech API | built-in | Spoken phase prompts (`speechSynthesis`); no library needed | — |

The Face Landmarker model (float16) is fetched from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` when not vendored.

### 4.3 Processing pipeline

Per `design.md`, each camera frame flows through:

1. **Camera frame** captured un-mirrored.
2. **FaceLandmarker.detectForVideo()** every frame → 478 landmarks, 52 blendshapes, 4×4 matrix.
3. **One Euro filter** smooths the landmarks.
4. **HeadFrame** build (plane fit, mm scale).
5. **Quality gates** (Q-series) decide frame validity.
6. **frameMetrics** compute per-frame primitives → pushed to a ring buffer `[t, phase, valid, metrics, bs]`.
7. **Overlay** drawn (mirrored for display only).
8. **Every 200 ms**, the face bounding box is cropped and passed to **face-api expressions** → emotion buffer.
9. The **ProtocolRunner** drives the phase clock, checks compliance from blendshapes, and pauses on gate failure.
10. At the end, **phaseMetrics(buffer) → composites → results + store**.

**Concurrency.** The landmarker runs on the main thread with the GPU delegate (MediaPipe manages its own WebGL context); face-api uses the tfjs WebGL backend; emotion inference is scheduled with `setTimeout` after the landmark callback to avoid frame collisions. If measured fps < 18, emotion drops to 2.5 Hz.

**fps fallback ladder.** Low fps → reduce resolution to 960×540, then 640×360. If the tab is hidden, the protocol pauses.

### 4.4 Head frame and mm scaling

**Midsagittal plane fit.** For the stable bilateral pairs (tragion 234/454, malar 116/345, ala 129/358, inner canthi 133/362) plus midline points (9, 168, 1, 2, 152), compute for each pair the difference vector `d = p_i − p_j`. The plane normal `n` is the normalised principal direction of these pair vectors (signed so +X points to patient left); the plane offset is the mean of the pair midpoints together with the midline points. The Y axis is the projection of (nasion − menton) onto the plane; Z = X × Y. The origin is the pupil midpoint projected onto the plane. All points are rotated into this head frame.

**mm scaling (Emotrics method).** iris diameter per eye = mean of distances 469↔471 and 470↔472 (right) and 474↔476, 475↔477 (left) in HF; `mm_per_unit = 11.7 / mean(both)` using the human horizontal visible iris diameter ≈ 11.7 mm. The scale is taken as the median over P1 and then fixed for the session to reduce noise.

**Why mouth/brow are excluded from the fit.** Those regions are the pathology being measured; including them would let a real droop bias the plane and hide the very asymmetry we are trying to detect. Only stable, rarely paretic landmarks anchor the frame.

### 4.5 Key algorithms

**One Euro filter (Casiez et al., 2012).** Low-latency adaptive smoothing: at low speed it smooths strongly (less jitter), at high speed it smooths lightly (less lag). Configurable minimum cutoff, beta (speed coefficient) and derivative cutoff.

**Rest / peak extraction.** Rest = per-landmark **median** over P1 valid frames. Peak for a task = frame at the **95th percentile** of the task's driver signal (e.g. mean commissure displacement for smile) within the hold window. Both sides' excursions are taken at the **same frame window** (±3 frames median) so L and R remain comparable.

**Movement floor.** If both sides' excursion is below the floor, the metric is null with reason `below_floor` and compliance is false.

**Latency.** Smooth the per-side driver (One Euro), measure time to 50% / 90% of the side's own peak from the phase-cue timestamp, with sub-frame resolution by linear interpolation.

**Dental show classification.** Build the inner-lip polygon mask → convert to HSV; teeth = `V > (rest-lip V + k·σ)` and `S < 0.35`; morphological open 3×3; split the mask at the plane-projected midline into L/R.

**Symmetry ratio and signed difference.** `SR(a,b) = min(a,b)/max(a,b)`, 1 = perfect symmetry, undefined (null) when `max < floor`. Signed difference `SD = value_L − value_R`, whose sign identifies the lower/weaker side.

### 4.6 Configuration files

- **`thresholds.json`** — every border/significant band and composite weight, plus a `thresholds_version` string. All values are **provisional** engineering starting points; thresholds are never hard-coded in logic and must be recalibrated from a normative study.
- **`landmarks.json`** — landmark indices named by **patient side**. This convention matters because it enforces decision **D2**: all sides are reported as the patient's anatomical side, and the wink self-test must pass before metrics are trusted.
- **`protocol.json`** — phase definitions (id, hold/relax durations, repetitions, optional flag, driver signal) and per-phase compliance rules.

### 4.7 Data storage and privacy

- **IndexedDB**, on-device by default. In the default configuration no session data is transmitted to any server.
- **No video or image retention by default.**
- **Export formats:** session JSON (schema §3.12), a metrics CSV (one row per metric), a time-series CSV, and a printable A4-landscape report via the browser print dialog.
- **PDPA.** Consent is captured before the camera starts; the participant's name is stored locally only; research exports use a pseudonymous participant code.
- **Research image capture** (one rest still + one peak-smile still) is available only as an explicit, separately consented option.
- **Optional off-device transmission (Google Sheets).** Disabled by default. When enabled by the deployer (see §4.11), a completed assessment is sent to a Google Sheet **only if** the participant additionally ticks the data-sharing consent box on the consent screen. Both conditions — the deployer's config flag and the participant's consent — must be true before anything leaves the device. The participant's name is excluded from the transmitted row unless `sendParticipantName` is explicitly set; de-identified fields (pseudonymous metrics, composites, quality, gender, year of birth) are sent otherwise. Enabling this is a departure from the on-device default and requires the consent wording to reflect it.

### 4.11 Optional Google Sheets integration

This integration is **off by default** and is intended for supervised research/pilot data collection. It uses a Google Apps Script Web App as the endpoint, so no API keys or credentials are stored in the client.

**Current destination sheet:** https://docs.google.com/spreadsheets/d/1vKsR84I_hgEIY4fAL7YSY7LCcc9QwVaAj_y4M7XeD7M/edit — results are appended to its `Results` tab via the Apps Script Web App configured in `config/integrations.json`.

Configuration lives in `config/integrations.json`:

```json
{
  "integrations_version": "int-0.1",
  "google_sheets": {
    "enabled": false,
    "webAppUrl": "",
    "sendParticipantName": false
  }
}
```

- `enabled` — master switch. When `false`, nothing is ever transmitted.
- `webAppUrl` — the Apps Script Web App `/exec` URL.
- `sendParticipantName` — when `false` (recommended), the participant name is omitted from the transmitted row; de-identified fields are still sent. Set `true` only where names in the sheet are separately consented.

**Consent gate.** Even when `enabled` is `true`, a row is sent only when the participant ticks *"I consent to my de-identified results being sent to a secure research spreadsheet"* on the consent screen. This checkbox gates transmission only; it does not block the test.

**Data flow.** After analysis, `js/data/sheets.js` flattens the session result into one flat row (keys matching the sheet header) and POSTs it (`Content-Type: text/plain`, `mode: no-cors`) to the Web App, which appends the row. Failures are logged and never block the result screen.

**Sheet header row (column titles).** These tally with the Data Dictionary (M/Q/C series and per-metric `value`/`L`/`R`/`flag`). The first row of the `Results` tab must be:

```
submitted_at, M03_timestamp, participant_name, gender, year_of_birth, mode,
language, M10_symptom_onset, M11_confounders, thresholds_version,
C01_UFAI, C02_LFAI, C03_SMILE_FAI, C04_lower_upper_ratio, C05_pattern,
C06_affected_side, C08_nihss4_cv, C09_cpss_face_cv, C10_baseline_z,
C11_indicator, C12_flags, Q17_quality,
R02_value, R02_L, R02_R, R02_flag, R03_value, R03_L, R03_R, R03_flag,
R04_value, R04_L, R04_R, R04_flag, R07_value, R07_L, R07_R, R07_flag,
R09_value, R09_L, R09_R, R09_flag, R12_value, R12_L, R12_R, R12_flag,
B01_value, B01_L, B01_R, B01_flag, B02_value, B02_L, B02_R, B02_flag,
B03_value, B03_L, B03_R, B03_flag, E01_value, E01_L, E01_R, E01_flag,
E02_value, E02_L, E02_R, E02_flag, E03_value, E03_L, E03_R, E03_flag,
E05_value, E05_L, E05_R, E05_flag, S01_value, S01_L, S01_R, S01_flag,
S02_value, S02_L, S02_R, S02_flag, S03_value, S03_L, S03_R, S03_flag,
S07_value, S07_L, S07_R, S07_flag, S08_value, S08_L, S08_R, S08_flag,
S13_value, S13_L, S13_R, S13_flag, S14_value, S14_L, S14_R, S14_flag,
P01_value, P01_L, P01_R, P01_flag, P02_value, P02_L, P02_R, P02_flag,
N01_value, N01_L, N01_R, N01_flag, N02_value, N02_L, N02_R, N02_flag
```

**Setup summary.** Create a Google Sheet with a tab named `Results`; add an Apps Script `doPost` Web App that appends rows and auto-writes the header on first run; deploy as a Web App with access set to *Anyone*; paste the `/exec` URL into `config/integrations.json` and set `enabled: true`.

### 4.12 R Shiny analytics dashboard

A companion **R Shiny dashboard** provides the live visualisation layer for the data captured by the app. It reads from the same Google Sheet that the app writes to (§4.11) and refreshes as new assessments arrive, so results appear in the dashboard shortly after each test completes.

- **Dashboard URL:** https://smile-rp.shinyapps.io/SMILE-FA/

**End-to-end data flow.**

```
Browser app (assessment)
   → js/data/sheets.js POST (on consent)
      → Apps Script Web App (doPost)
         → Google Sheet "Results" tab (one row per assessment)
            → R Shiny dashboard (reads the sheet, refreshes live)
```

**What it visualises.** The dashboard works from the flat per-assessment rows defined in the §4.11 header, so it can present any of the transmitted fields, including:

- **Composite scores** — SMILE-FAI (C03), UFAI (C01), LFAI (C02), lower/upper ratio (C04) across sessions.
- **Screening outputs** — indicator distribution (C11 green/amber/red/unable), pattern mix (C05 central/peripheral/bilateral/none), affected side (C06), and the CV-estimated NIHSS-4 analogue (C08) / CPSS analogue (C09).
- **Per-metric detail** — the R/B/E/S/P/N metric `value`, `L`, `R` and `flag` columns (e.g. smile excursion ratio S02, brow excursion ratio B02, resting commissure height difference R02), with flag (`none`/`border`/`sig`) highlighting.
- **Measurement quality** — Q17 across the cohort, useful for spotting low-quality captures.
- **Cohort descriptors** — gender and year of birth (de-identified), test timestamp (M03), mode, language, reported symptom onset (M10) and confounders (M11).

**Privacy.** The dashboard only shows what the app is configured to transmit (§4.11). With `sendParticipantName: false` (the default), no participant names reach the sheet or the dashboard; only de-identified fields are available. Access to the dashboard should be restricted in line with the study's ethics/PDPA approval.

**Scope note.** The dashboard consumes the same summary row per assessment that the sheet stores. Frame-level raw time series (T-series) and the full emotion stream are not part of the transmitted row by default, so the dashboard visualises session-level metrics and composites rather than per-frame traces unless those fields are added to the transmission and header.

### 4.8 Browser and device support

| Browser | Min version | Notes |
|---|---|---|
| Chrome / Edge (desktop) | Current | Primary target |
| iPad Safari | 16+ | `<video playsinline muted>` required |
| Android Chrome (tablet) | Current | Landscape tablets |

- **Orientation:** landscape only, minimum 1024×768; a "rotate to landscape" overlay appears in portrait.
- **Camera:** `getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })`.
- **HTTPS required** because the camera API (`getUserMedia`) only works on secure origins (HTTPS or `localhost`).

### 4.9 Verification and calibration tools

- **`debug.html`** — landmark index overlay, HF axes, per-frame metric values and fps, for visual verification of the indices in `landmarks.json`.
- **Side-convention self-test** — winking the left eye must register as patient **LEFT**; determines the MediaPipe blendshape L/R suffix mapping relative to the patient. Must pass before any engine metric is trusted.
- **`tests.html`** — browser-run engine unit tests using synthetic landmark sets with known asymmetries (e.g. rotated symmetric face → zero asymmetry; a known 3 mm droop → R02 = 3 ± 0.2).
- **Video-file input mode** — load a recorded video instead of the camera for offline analysis and validation.
- **Threshold calibration workflow** — run the normative study, then update the band values and bump `thresholds_version` in `thresholds.json`.

### 4.10 Locked design decisions

Reproduced from `.kiro/steering/decisions.md` (locked — do not change without owner approval).

| # | Decision | Rationale / where implemented |
|---|---|---|
| D1 | No diagnostic "confidence %" anywhere in the UI. Show measurement-quality score (Q17) only. | Landmark detection confidence is not diagnostic confidence. product.md; Clinical §3; R7; C11 |
| D2 | All sides reported as the patient's anatomical side. Preview mirrored; computation un-mirrored; wink self-test must pass before metrics are trusted. | Avoids left/right inversion errors. Data Dictionary §0; R4.4; R10.2; T-04 |
| D3 | Test is blocked (hard gate) until hemiface lighting is balanced (Q09 ≥ 0.70; warn < 0.85). | Side lighting creates shadow-based false asymmetry. Q09; R3.2–3.3; T-07 |
| D4 | All thresholds provisional, read from versioned thresholds.json; personal-baseline mode (C10) built in; calibrate from a normative study. | Thresholds are engineering starting points. Data Dictionary §C; R8; T-25 |
| D5 | Emotion/expression output never feeds asymmetry scores; shown as a synchronised timeline with caveat. | Classifiers are biased by facial weakness. Clinical §4; R6.4 |
| D6 | Folder deployment on GitHub Pages (HTTPS); no single-file base64 build. | WASM + models are too large to inline. tech.md; Design §1 |
| D7 | Landmark indices and MediaPipe blendshape L/R naming verified (T-03, T-04) before any engine task (T-05+) begins. | The engine is only as trustworthy as the index mapping. tasks.md Phase 1 |

---

## 5. Participant Data Collected

All participant data lives in the M-series metadata. The onboarding/consent screen additionally collects Full Name, Gender and Year of Birth before the test begins; the test-start timestamp (M03) is captured automatically.

| Field | Type | Where collected | Notes |
|---|---|---|---|
| Full Name | string | Consent screen (required) | **Stored locally only, never transmitted**; not shown on the public result screen |
| Gender | enum (male / female / prefer_not) | Consent screen (required) | |
| Year of Birth | int (1900–current year) | Consent screen (required) | **Year only — full date of birth is never stored** |
| M03 timestamp_start | ISO 8601 + UTC offset | Captured at test start | e.g. `2026-09-16T14:03:12+08:00` |
| M02 participant_code | string | Research export | Pseudonymous; no names in research export |
| M08 language | enum (en, zh, ms, ta) | Language selection | |
| M09 mode | enum (self_screen / assisted) | Welcome screen | |
| M10 symptom_onset_reported | enum (none / sudden_now / earlier / unknown) | Consent screen | `sudden_now` shows the 995 banner immediately |
| M11 confounders | multi-select | Consent screen | glasses, facial hair, dentures/braces, previous facial palsy, previous stroke, recent Botox/filler, facial surgery |
| M12 consent | version + bool | Consent screen | PDPA |
| M13 baseline_session_id | UUID / null | Derived | For change-from-baseline scoring |

Name, gender, year of birth and the M03 timestamp are displayed in the **clinician summary tab**, the **printed report header**, the **exported JSON** (under `meta`) and the **metrics CSV** (first four rows). They are never displayed on the public patient result screen.

---

## 6. Running Locally

The app needs a secure origin for the camera: HTTPS or `http://localhost`. Opening files directly with `file://` will not work.

```bash
# 1. Clone the repository
git clone https://github.com/aaron-chen-angus/smile-fa.git
cd smile-fa

# 2. Serve over a local static server (localhost is treated as secure)
python -m http.server 8080

# 3. Open in a browser
#    http://localhost:8080/
```

Any static server works (VS Code "Live Server", `npx serve`, etc.); the Python one-liner above is the minimum. **Open `debug.html` first** to verify the landmark indices before trusting any metric, then run the side-convention self-test.

---

## 7. Roadmap

Implementation tasks from `tasks.md`.

**Phase 1 — Foundation**

- [x] T-01 Folder structure, `index.html` shell, `app.css` tokens, landscape grid, portrait overlay
- [x] T-02 Vendor MediaPipe tasks-vision, face-api, Chart.js; loader with CDN fallback; HTTPS check
- [x] T-03 `debug.html`: camera, landmarker, draw all 478 indices; write `landmarks.json` with patient-side names
- [x] T-04 Side-convention self-test; determine MediaPipe blendshape L/R naming

**Phase 2 — Engine**

- [x] T-05 `filter.js` One Euro + tests
- [x] T-06 `headframe.js` plane fit, HF transform, iris mm scale + synthetic tests
- [x] T-07 `quality.js` Q01–Q17 incl. hemiface luminance ratio
- [x] T-08 `frameMetrics.js` primitives + GSI
- [x] T-09 `phaseMetrics.js` R, B, E, S, P, N, V with null/reason codes
- [x] T-10 `dental.js`, `nasolabial.js` (flag experimental)
- [x] T-11 `composites.js` C01–C12 from `thresholds.json`
- [x] T-12 `tests.html` runner covering T-05–T-11

**Phase 3 — Protocol & UI**

- [x] T-13 i18n files (en, zh, ms, ta) + `voice.js`
- [x] T-14 S0/S1 welcome, consent, symptoms, confounders, 995 banner
- [x] T-15 S2 setup with live gate checklist
- [x] T-16 `runner.js` phases, compliance, repeat, pause/resume; pictogram SVGs
- [x] T-17 `overlay.js` mirrored mesh + oval + L/R patient labels
- [x] T-18 `emotion.js` 5 Hz sampler + adaptive rate; `liveCharts.js` streaming chart

**Phase 4 — Results & data**

- [x] T-19 S4 public result
- [x] T-20 S5 clinician view: tables, face diagram, L/R time-series, emotion timeline + stacked bar, caveats
- [x] T-21 `store.js` IndexedDB, baseline, C10, S6 history
- [x] T-22 `export.js` JSON/CSV + print report
- [x] T-23 Video-file input mode for offline validation

**Phase 5 — Validation readiness**

- [ ] T-24 Tablet performance tuning (iPad Safari, Android Chrome); fps fallback ladder
- [ ] T-25 Pilot with healthy volunteers; test–retest; export to calibrate `thresholds.json`
- [ ] T-26 Lock `thresholds_version`, write methods section describing metrics with IDs

**Future direction.** A Flutter wrapper can reuse `/js/engine` via a WebView or a Dart port that preserves the same metric IDs. SMILE-FA is designed to combine with the SMILE Speech Signal Lab into a single **SMILE FAST** session (Face + Speech; Arm via a pose drift test using MediaPipe Pose).

---

## 8. Citation

If you use SMILE-FA in a research output, please cite it as:

```
SMILE — Facial Asymmetry Screen (SMILE-FA). Republic Polytechnic,
School of Sports & Health. Research-use screening tool; thresholds provisional.
https://aaron-chen-angus.github.io/smile-fa/
```

**Contact:** aaron_chen_angus@rp.edu.sg — Republic Polytechnic, School of Sports & Health.

The clinical scales and methods referenced above are the work of their original authors (Kothari et al. 1999; Brott et al. 1989; House & Brackmann 1985; Ross et al. 1996; Banks et al. 2015; Guarin et al. 2018; Kartynnik et al. 2019; Ekman & Friesen 1978; Casiez et al. 2012; Barrett et al. 2019) and should be cited directly where used.
