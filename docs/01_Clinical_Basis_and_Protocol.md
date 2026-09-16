# SMILE Facial Asymmetry Screen — Clinical Basis & Test Protocol

SMILE = Smart Monitoring for Individualized Living and Engagement. Module: **FA** (Facial Asymmetry). Companion to the SMILE Speech Signal Lab.

> Positioning: a **screening aid** that quantifies facial movement asymmetry. It does not diagnose stroke. Any person with *sudden* face, arm or speech symptoms must be told to call **995** regardless of the app result. In Singapore, software that claims to detect or triage a disease may fall under HSA regulation as Software as a Medical Device; keep research builds labelled "Research use only" until validated.

---

## 1. What clinicians actually do

### 1.1 Pre-hospital / public (FAST, BE-FAST)
- **F**ace: "Smile / show me your teeth." Look for one side of the face drooping or not moving.
- **A**rm, **S**peech, **T**ime. BE-FAST adds **B**alance and **E**yes.
- Binary judgement: normal vs abnormal. No quantification.

### 1.2 Cincinnati Prehospital Stroke Scale (Kothari et al., 1999)
- Facial droop item: patient **shows teeth or smiles**.
- Normal = both sides move equally. Abnormal = one side does not move as well as the other.

### 1.3 NIHSS Item 4 — Facial Palsy (Brott et al., 1989; NINDS training)
Examiner asks (or pantomimes) the patient to **show teeth or smile, raise eyebrows, and close eyes tightly**. Observe symmetry at rest *and* during movement.

| Score | Label | Criteria |
|---|---|---|
| 0 | Normal | Symmetrical movements |
| 1 | Minor paralysis | Flattened nasolabial fold, asymmetry on smiling |
| 2 | Partial paralysis | Total or near-total paralysis of the **lower** face |
| 3 | Complete paralysis | Absence of facial movement in upper and lower face (one or both sides) |

Other scales use the same observation: RACE (facial palsy 0–2), LAMS (facial droop 0–1), ROSIER (asymmetric facial weakness).

### 1.4 So — is "smile first" correct?
Yes, **smile/show teeth is the core FAST manoeuvre**, but best practice is a short sequence:

1. **Observe at rest** (neutral face): commissure droop, flattened nasolabial fold, widened palpebral fissure.
2. **Smile showing teeth**: the most sensitive single task for lower-face weakness.
3. **Raise eyebrows** (wrinkle forehead): the key **discriminator** (see 1.5).
4. **Close eyes tightly**: orbicularis oculi strength; eyelash burial.
5. Optional: **pucker lips / say "oo"**, **snarl / wrinkle nose**, **puff cheeks**.

### 1.5 Central vs peripheral pattern — why the forehead matters
- The upper face (frontalis, upper orbicularis oculi) receives **bilateral** cortical input; the lower face receives mainly **contralateral** input.
- **Stroke (upper motor neuron, central)** → weakness of the **lower face** on the side opposite the brain lesion, with **forehead sparing** (eyebrow raise near normal; eye closure usually preserved or mildly weak).
- **Bell's palsy / peripheral (lower motor neuron)** → whole hemiface weak, **including forehead**, often incomplete eye closure.
- Emotional smile can be relatively preserved in some cortical strokes (voluntary–emotional dissociation), so the test must prompt a **voluntary** "show teeth" as well as a natural smile.

The app therefore reports a **pattern** (Central/lower-face-dominant, Peripheral/whole-hemiface, Bilateral/indeterminate, None) — this is exactly the clinical reasoning, made objective.

### 1.6 Quantitative facial grading literature the metrics are built on
| Source | What it contributes |
|---|---|
| House & Brackmann (1985) | Global grade I–VI; brow and mouth excursion concept |
| Sunnybrook Facial Grading System (Ross et al., 1996) | Resting symmetry (eye, cheek/nasolabial fold, mouth) + voluntary movement across **5 expressions** (brow lift, gentle eye closure, open-mouth smile, snarl, lip pucker) scored 1–5 + synkinesis; composite score |
| eFACE (Banks et al., 2015) | 0–100 continuous static, dynamic, synkinesis sub-scores |
| Emotrics (Guarin et al., 2018, JAMA Facial Plastic Surgery) | Automated landmark metrics: brow height, palpebral fissure height, marginal reflex distances, commissure excursion, commissure height deviation, smile angle, dental show; mm scaling from iris diameter |
| MediaPipe Face Mesh / Face Landmarker (Kartynnik et al., 2019; Google) | 468 3D landmarks (+10 iris = 478) and 52 blendshape coefficients in real time in the browser |
| FACS (Ekman & Friesen, 1978) | Action Unit vocabulary (AU1/2 brow raise, AU6 cheek raise, AU12 lip corner pull, AU43 eye closure) |
| One Euro Filter (Casiez et al., 2012) | Low-latency landmark smoothing |

Design rule: **every SMILE metric maps to a Sunnybrook/eFACE/NIHSS observation**, so clinicians recognise it.

---

## 2. SMILE-FA test protocol (≈70 s, fully guided, voice + animation)

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

Rules:
- A phase that fails compliance is **repeated once** automatically; if it fails again it is marked `not_performed` (never silently scored as weakness — a non-compliant person is not the same as a paralysed side, but an absent movement on one side while the other moves *is* asymmetry).
- Use the **median of repetitions** for scoring.
- The instruction animation is a neutral avatar; the camera preview is mirrored for the user, but all computation uses **un-mirrored frames** and reports **patient's anatomical Left/Right**.

---

## 3. Output logic (objective indicators, not a diagnosis)

| Indicator | Meaning | App message |
|---|---|---|
| 🟢 Within reference | All asymmetry metrics within reference band | "No significant facial asymmetry measured. If you have sudden symptoms, call 995." |
| 🟠 Borderline | 1+ metrics in borderline band, or asymmetry pattern weak | "Mild asymmetry measured. Compare with your baseline / seek medical advice. If sudden, call 995." |
| 🔴 Significant asymmetry | Lower-face (or whole-face) asymmetry above threshold | "Significant one-sided facial weakness pattern measured (patient's LEFT/RIGHT). If this is new or sudden, call 995 now." |
| ⚪ Unable to assess | Quality or compliance failed | "Could not measure reliably. Please repeat. If you have symptoms, call 995." |

Also report: pattern (Central / Peripheral / Bilateral / None), affected side, CV-estimated NIHSS-4 analogue (0–3), CPSS facial-droop analogue, SMILE-FAI (0–100), measurement quality (0–100).

**Do not** display a "98.7% confidence" style number: landmark detection confidence is not diagnostic confidence. Show measurement quality instead.

**Personal baseline is key.** Healthy faces are naturally asymmetric. For community/repeat users, store a baseline and report change (z-score vs own baseline) — this is far more sensitive than population thresholds.

---

## 4. Emotion / expression sensing — basis and caveats

- Open-source browser options: **face-api.js** (maintained fork `@vladmandic/face-api`, FaceExpressionNet: neutral, happy, sad, angry, fearful, disgusted, surprised) and **Human** (`@vladmandic/human`, emotion module). No proprietary SDK needed.
- Complementary, more interpretable signal: **MediaPipe blendshapes → FACS-style AU proxies** (AU12 smile, AU6 cheek raise, AU4 brow lowerer…). Duchenne smile = AU6 + AU12.
- Caveats that must appear in the clinician view:
  1. Classifiers output **expression categories**, not felt emotion (Barrett et al., 2019, Psychological Science in the Public Interest).
  2. **Facial palsy biases classifiers** — an asymmetric smile may score lower "happy" and higher "neutral/sad/disgusted". Emotion output must never feed the asymmetry score.
  3. During prompted tasks, "happy" in P5 and "surprised" in P2 are expected (they double as compliance evidence).
- Useful research outputs: expression timeline per phase, rest-phase affect (possible anxiety/flat affect), smile-task "happy" peak (engagement), natural vs voluntary smile difference.

---

## 5. Validation pathway (for publication)
1. **Technical**: landmark index overlay verification; side-convention test (subject winks left eye → must report LEFT); synthetic asymmetry test (image warps of known mm).
2. **Normative study**: healthy adults across age bands and ethnic groups relevant to Singapore; test–retest (ICC 2,1), lighting/pose robustness; derive reference bands (e.g., 95th percentile).
3. **Concurrent validity**: vs manual Emotrics measurement (Bland–Altman) and clinician Sunnybrook / eFACE.
4. **Clinical accuracy**: acute stroke unit cohort + mimics (Bell's palsy, old stroke, dental/Botox, natural asymmetry); reference = two blinded clinicians' NIHSS item 4 + final diagnosis. Report sensitivity, specificity, ROC AUC, weighted kappa. Prioritise sensitivity for the red threshold.
5. Ethics/IRB, PDPA consent, on-device processing, no video retention by default.
