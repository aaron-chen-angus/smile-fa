# =============================================================================
# SMILE Facial Asymmetry — Analytics Dashboard
# Smart Monitoring for Individualized Living and Engagement
# Republic Polytechnic, School of Sports & Health
#
# Reads the SMILE-FA results Google Sheet (public CSV export) and provides an
# educational, aesthetically consistent analytics dashboard.
#
# Deploy on shinyapps.io  OR  compile with shinylive for GitHub Pages.
# The sheet must be shared "Anyone with the link — Viewer".
#
# RESEARCH USE ONLY. Thresholds provisional. Not a diagnostic device.
# =============================================================================

library(shiny)
library(bslib)
library(dplyr)
library(tidyr)
library(ggplot2)
library(plotly)
library(DT)
library(lubridate)
library(scales)

# ---- Config -----------------------------------------------------------------
SHEET_ID  <- "1vKsR84I_hgEIY4fAL7YSY7LCcc9QwVaAj_y4M7XeD7M"
SHEET_TAB <- "Results"
CSV_URL   <- sprintf(
  "https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&sheet=%s",
  SHEET_ID, SHEET_TAB)

# Cover image (base64) — bundled alongside app.R
COVER_B64 <- if (file.exists("cover_b64.txt"))
  paste(readLines("cover_b64.txt", warn = FALSE), collapse = "") else ""
COVER_SRC <- if (nchar(COVER_B64) > 0) paste0("data:image/jpeg;base64,", COVER_B64) else ""

# ---- Palette (consistent with the SMILE poster) -----------------------------
COL <- list(
  bg     = "#07111F", panel = "#0C1B2E", panel2 = "#0F2338",
  line   = "#16324D", cyan  = "#29B6F6", cyan2 = "#4FC3F7",
  ink    = "#E6F1FB", mut   = "#8CA9C4",
  green  = "#34D399", amber = "#FBBF24", red = "#EF4444", grey = "#5B7086"
)
FLAG_COL <- c(none = COL$green, border = COL$amber, sig = COL$red,
              `NA` = COL$grey, `<NA>` = COL$grey)
IND_COL  <- c(green = COL$green, amber = COL$amber, red = COL$red,
              unable = COL$grey)

# ---- Metric metadata: clinical basis for the educational layer --------------
# Drawn from the SMILE-FA data dictionary (README §3).
METRIC_META <- tibble::tribble(
  ~id,   ~name,                          ~phase,  ~unit,   ~border, ~sig,  ~basis,
  "C03", "SMILE-FAI (headline index)",   "Composite","0-100", 25,    45,   "0.7*LFAI + 0.3*UFAI. Higher = more facial-movement asymmetry.",
  "C01", "Upper-face asymmetry (UFAI)",  "Composite","0-100", 20,    40,   "Forehead + eye. Spared in central (stroke) pattern.",
  "C02", "Lower-face asymmetry (LFAI)",  "Composite","0-100", 25,    45,   "Weighted from smile/pucker/rest. Drives the FAST face sign.",
  "R02", "Commissure height diff (rest)","Rest",  "mm",    2.0,   3.5,  "Sunnybrook 'corner dropped'; Emotrics commissure height deviation.",
  "R04", "Oral tilt angle (rest)",       "Rest",  "deg",   3.0,   5.0,  "Crooked mouth line at rest.",
  "R07", "Palpebral fissure ratio",      "Rest",  "ratio", 0.85,  0.75, "Eye-opening symmetry; wider fissure suggests peripheral palsy.",
  "R09", "Brow height diff (rest)",      "Rest",  "mm",    2.0,   3.5,  "Brow ptosis; peripheral pattern marker.",
  "B02", "Brow excursion ratio",         "Brow",  "ratio", 0.80,  0.60, "House-Brackmann / Sunnybrook brow lift. THE forehead-sparing discriminator.",
  "E03", "Eye closure completeness ratio","Eyes", "ratio", 0.90,  0.80, "Sunnybrook gentle eye closure.",
  "E05", "Tight squeeze ratio",          "Eyes",  "ratio", 0.80,  0.70, "NIHSS 'close eyes tightly'; orbicularis strength.",
  "S02", "Commissure excursion ratio",   "Smile", "ratio", 0.80,  0.60, "PRIMARY FAST metric — 'one side does not move'.",
  "S07", "Smile angle",                  "Smile", "deg",   4.0,   7.0,  "Crooked smile at peak.",
  "S13", "Mouth midline shift (smile)",  "Smile", "mm",    2.5,   4.0,  "Mouth pulled toward the strong side.",
  "S14", "Smile blendshape ratio",       "Smile", "ratio", 0.80,  0.60, "Model cross-check of S02.",
  "P02", "Pucker excursion ratio",       "Pucker","ratio", 0.75,  0.55, "Sunnybrook lip pucker; orbicularis oris.",
  "N02", "Snarl ratio",                  "Snarl", "ratio", 0.75,  0.65, "Sunnybrook snarl; levator labii."
)
metric_choices <- setNames(METRIC_META$id, paste0(METRIC_META$id, " — ", METRIC_META$name))

# ---- Data loading -----------------------------------------------------------
read_sheet_csv <- function() {
  out <- tryCatch(
    utils::read.csv(CSV_URL, stringsAsFactors = FALSE, check.names = TRUE,
                    na.strings = c("", "NA", "null", "NaN")),
    error = function(e) NULL)
  if (is.null(out) || nrow(out) == 0) return(NULL)
  out
}

# Demo data so the dashboard renders before any real submissions exist
make_demo <- function(n = 120) {
  set.seed(42)
  patt <- sample(c("none","central","peripheral","bilateral_or_indeterminate"),
                 n, TRUE, c(.55,.22,.15,.08))
  ind  <- ifelse(patt == "none",
                 sample(c("green","amber"), n, TRUE, c(.8,.2)),
                 sample(c("amber","red","unable"), n, TRUE, c(.45,.45,.1)))
  base_fai <- ifelse(patt=="none", rnorm(n,12,7),
              ifelse(patt=="central", rnorm(n,38,12),
              ifelse(patt=="peripheral", rnorm(n,44,12), rnorm(n,30,14))))
  d <- data.frame(
    submitted_at   = format(Sys.time() - runif(n,0,90)*86400),
    M03_timestamp  = format(Sys.time() - runif(n,0,90)*86400),
    participant_name = sprintf("P%03d", sample(1:60, n, TRUE)),
    gender         = sample(c("Male","Female","Prefer not to say"), n, TRUE, c(.48,.48,.04)),
    year_of_birth  = sample(1945:2005, n, TRUE),
    mode           = sample(c("self_screen","assisted"), n, TRUE),
    language       = sample(c("en","zh","ms","ta"), n, TRUE),
    M10_symptom_onset = sample(c("none","earlier","unknown","sudden_now"), n, TRUE, c(.7,.15,.1,.05)),
    thresholds_version = "thr-prov-0.1",
    C01_UFAI       = pmax(0, base_fai*runif(n,.2,.6) + rnorm(n,0,5)),
    C02_LFAI       = pmax(0, base_fai + rnorm(n,0,6)),
    C03_SMILE_FAI  = pmax(0, base_fai + rnorm(n,0,4)),
    C05_pattern    = patt,
    C06_affected_side = ifelse(patt=="none","none", sample(c("L","R","unclear"), n, TRUE, c(.45,.45,.1))),
    C08_nihss4_cv  = ifelse(patt=="none",0, sample(1:3, n, TRUE, c(.5,.35,.15))),
    C09_cpss_face_cv = ifelse(patt=="none","normal","abnormal"),
    C11_indicator  = ind,
    Q17_quality    = pmin(100, pmax(30, rnorm(n,82,12))),
    stringsAsFactors = FALSE
  )
  d$C04_lower_upper_ratio <- d$C02_LFAI / pmax(d$C01_UFAI,5)
  for (m in c("R02","R04","R07","R09","B02","E03","E05","S02","S07","S13","S14","P02","N02")) {
    ratio_like <- METRIC_META$unit[METRIC_META$id==m] == "ratio"
    if (ratio_like) {
      v <- pmin(1, pmax(0.3, 1 - base_fai/120 + rnorm(n,0,.08)))
      L <- v*runif(n,.9,1); R <- v*runif(n,.9,1)
    } else {
      v <- pmax(0, base_fai/12 + rnorm(n,0,1)); L <- v; R <- v*runif(n,.5,1)
    }
    bd <- METRIC_META$border[METRIC_META$id==m]; sg <- METRIC_META$sig[METRIC_META$id==m]
    flag <- if (ratio_like) ifelse(v<sg,"sig",ifelse(v<bd,"border","none")) else
                            ifelse(v>sg,"sig",ifelse(v>bd,"border","none"))
    d[[paste0(m,"_value")]] <- round(v,3); d[[paste0(m,"_L")]] <- round(L,3)
    d[[paste0(m,"_R")]] <- round(R,3); d[[paste0(m,"_flag")]] <- flag
  }
  d
}

prep <- function(d) {
  if (is.null(d)) return(NULL)
  # coerce timestamp
  ts <- suppressWarnings(lubridate::ymd_hms(d$submitted_at, quiet = TRUE))
  if (all(is.na(ts))) ts <- suppressWarnings(lubridate::ymd_hms(d$M03_timestamp, quiet = TRUE))
  if (all(is.na(ts))) ts <- suppressWarnings(as.POSIXct(d$submitted_at))
  d$.ts <- ts
  d$.date <- as.Date(d$.ts)
  yr <- suppressWarnings(as.integer(d$year_of_birth))
  d$.age <- as.integer(format(Sys.Date(), "%Y")) - yr
  d$.ageband <- cut(d$.age, breaks = c(-Inf,29,44,59,74,Inf),
                    labels = c("<30","30-44","45-59","60-74","75+"))
  numcols <- grep("(_value|_L|_R|UFAI|LFAI|SMILE_FAI|_ratio|quality|nihss4)", names(d))
  for (i in numcols) d[[i]] <- suppressWarnings(as.numeric(d[[i]]))
  d
}

# ---- Aesthetic (CSS) --------------------------------------------------------
CSS <- paste0(
"<style>",
":root{--bg:__BG__;--panel:__PANEL__;--panel2:__PANEL2__;--line:__LINE__;--cyan:__CYAN__;--ink:__INK__;--mut:__MUT__;--amber:__AMBER__;}",
"body,.bslib-page-navbar{background:var(--bg);color:var(--ink);font-family:'Inter','Segoe UI',system-ui,sans-serif;}",
".navbar{background:linear-gradient(90deg,#061020,#0b2036)!important;border-bottom:1px solid var(--line);box-shadow:0 2px 20px rgba(41,182,246,.15);}",
".navbar-brand{font-weight:800;letter-spacing:.14em;color:var(--cyan)!important;}",
".nav-link{color:var(--mut)!important;font-weight:600;letter-spacing:.03em;}",
".nav-link.active{color:var(--cyan)!important;border-bottom:2px solid var(--cyan);}",
".card,.bslib-value-box{background:var(--panel)!important;border:1px solid var(--line)!important;border-radius:14px!important;box-shadow:0 0 0 1px rgba(41,182,246,.04),0 8px 30px rgba(0,0,0,.35);}",
".card-header{background:transparent!important;border-bottom:1px solid var(--line)!important;color:var(--cyan);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.78rem;}",
".kpi .value{font-size:2rem;font-weight:800;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(41,182,246,.35);}",
".kpi .lab{color:var(--mut);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;}",
".hero{border-radius:16px;overflow:hidden;border:1px solid var(--line);position:relative;box-shadow:0 0 40px rgba(41,182,246,.12);}",
".hero img{width:100%;display:block;}",
".hero .cap{position:absolute;left:0;right:0;bottom:0;padding:14px 18px;background:linear-gradient(0deg,rgba(6,16,32,.92),transparent);}",
".badge-flag{padding:2px 9px;border-radius:20px;font-size:.72rem;font-weight:700;}",
".edu{background:var(--panel2);border-left:3px solid var(--cyan);border-radius:8px;padding:12px 14px;color:var(--mut);font-size:.9rem;line-height:1.5;}",
".edu b{color:var(--ink);}",
".disc{color:var(--amber);font-size:.8rem;border:1px solid rgba(251,191,36,.4);border-radius:8px;padding:8px 12px;background:rgba(251,191,36,.06);}",
".selectize-input,.form-control,.selectize-dropdown{background:var(--panel2)!important;color:var(--ink)!important;border:1px solid var(--line)!important;}",
".irs-bar,.irs-single{background:var(--cyan)!important;border-color:var(--cyan)!important;}",
"table.dataTable{color:var(--ink);} .dataTables_wrapper{color:var(--mut);}",
"a{color:var(--cyan);}",
"</style>")
CSS <- gsub("__BG__",COL$bg,CSS,fixed=TRUE)
CSS <- gsub("__PANEL2__",COL$panel2,CSS,fixed=TRUE)
CSS <- gsub("__PANEL__",COL$panel,CSS,fixed=TRUE)
CSS <- gsub("__LINE__",COL$line,CSS,fixed=TRUE)
CSS <- gsub("__CYAN__",COL$cyan,CSS,fixed=TRUE)
CSS <- gsub("__INK__",COL$ink,CSS,fixed=TRUE)
CSS <- gsub("__MUT__",COL$mut,CSS,fixed=TRUE)
CSS <- gsub("__AMBER__",COL$amber,CSS,fixed=TRUE)

gg_dark <- function() {
  theme_minimal(base_size = 13) +
    theme(plot.background = element_rect(fill = COL$panel, colour = NA),
          panel.background = element_rect(fill = COL$panel, colour = NA),
          panel.grid.major = element_line(colour = COL$line, linewidth = .3),
          panel.grid.minor = element_blank(),
          text = element_text(colour = COL$ink),
          axis.text = element_text(colour = COL$mut),
          legend.background = element_rect(fill = COL$panel, colour = NA),
          legend.key = element_rect(fill = COL$panel, colour = NA))
}
plotly_dark <- function(p) {
  ggplotly(p) |>
    layout(paper_bgcolor = COL$panel, plot_bgcolor = COL$panel,
           font = list(color = COL$ink),
           legend = list(bgcolor = COL$panel)) |>
    config(displayModeBar = FALSE)
}
flag_badge <- function(f) {
  col <- FLAG_COL[[ifelse(is.na(f)|!f %in% names(FLAG_COL),"NA",f)]]
  sprintf("<span class='badge-flag' style='background:%s22;color:%s;border:1px solid %s'>%s</span>",
          col, col, col, ifelse(is.na(f),"n/a",f))
}

DISCLAIMER <- "RESEARCH USE ONLY · Thresholds provisional · Not a diagnostic device · If symptoms are sudden, call 995"

# =============================================================================
# UI
# =============================================================================
ui <- page_navbar(
  title = "SMILE · FACIAL ASYMMETRY ANALYTICS",
  theme = bs_theme(version = 5, bg = COL$bg, fg = COL$ink, primary = COL$cyan,
                   base_font = font_google("Inter", local = FALSE)),
  header = tags$head(HTML(CSS)),
  fillable = FALSE,

  sidebar = sidebar(
    width = 260, title = "Filters",
    actionButton("refresh", "↻ Refresh data", class = "btn btn-primary btn-sm"),
    div(class = "disc", style="margin:6px 0;", "Live from Google Sheet"),
    uiOutput("f_date"),
    selectInput("f_gender", "Gender", c("All"), multiple = TRUE, selected = "All"),
    selectInput("f_age", "Age band", c("All"), multiple = TRUE, selected = "All"),
    selectInput("f_mode", "Mode", c("All"), multiple = TRUE, selected = "All"),
    selectInput("f_ind", "Indicator", c("All"), multiple = TRUE, selected = "All"),
    sliderInput("f_qual", "Min measurement quality (Q17)", 0, 100, 0, step = 5),
    div(class="disc", DISCLAIMER)
  ),

  # --- Overview ---
  nav_panel(
    "Overview", icon = icon("gauge-high"),
    div(class = "hero", if (nchar(COVER_SRC)>0) img(src = COVER_SRC) else NULL,
        div(class="cap", strong("SMILE Facial Asymmetry Screening"),
            span(" — cohort analytics from computer-vision FAST-face assessments"))),
    br(),
    layout_columns(
      col_widths = c(2,2,2,2,2,2), fill = FALSE,
      value_box("Total tests", textOutput("kpi_n"), theme = "dark",
                showcase = icon("clipboard-check")),
      value_box("Participants", textOutput("kpi_p"), theme = "dark",
                showcase = icon("users")),
      value_box("Red %", textOutput("kpi_red"), theme = "dark",
                showcase = icon("triangle-exclamation")),
      value_box("Amber %", textOutput("kpi_amber"), theme = "dark",
                showcase = icon("circle-half-stroke")),
      value_box("Green %", textOutput("kpi_green"), theme = "dark",
                showcase = icon("circle-check")),
      value_box("Median quality", textOutput("kpi_q"), theme = "dark",
                showcase = icon("wave-square"))
    ),
    layout_columns(
      col_widths = c(4,4,4),
      card(card_header("Indicator distribution"), plotlyOutput("p_ind", height = 260)),
      card(card_header("Asymmetry pattern"), plotlyOutput("p_pattern", height = 260)),
      card(card_header("Affected side (patient)"), plotlyOutput("p_side", height = 260))
    ),
    card(card_header("Tests over time"), plotlyOutput("p_time", height = 240)),
    div(class="edu",
        HTML("<b>How to read this:</b> Each test is one SMILE-FA session. The traffic-light
        <b>indicator</b> (green/amber/red) is the app's headline call, and <b>pattern</b>
        separates a <b>central</b> (stroke-type, lower-face) picture from a <b>peripheral</b>
        (whole-hemiface, Bell's-palsy-type) one. A rise in red/central results, or clustering in
        time or age band, is what this page is designed to surface — but remember these are
        screening signals on provisional thresholds, not diagnoses."))
  ),

  # --- Asymmetry Scores ---
  nav_panel(
    "Asymmetry", icon = icon("chart-column"),
    layout_columns(
      col_widths = c(7,5),
      card(card_header("SMILE-FAI distribution"),
           plotlyOutput("p_fai", height = 300),
           div(class="edu", HTML("<b>SMILE-FAI</b> = 0.7·lower-face + 0.3·upper-face asymmetry
             (0–100, higher = more asymmetric). Dashed lines mark the <b>provisional</b>
             borderline and significant bands."))),
      card(card_header("Central vs peripheral map"),
           plotlyOutput("p_map", height = 300),
           div(class="edu", HTML("Lower-face (x) vs upper-face (y) asymmetry. Points in the
             <b>shaded lower-right</b> have high lower-face but spared forehead — the
             <b>forehead-sparing</b> signature of a central (stroke) lesion. Points up the
             diagonal involve the whole hemiface (peripheral).")))
    ),
    layout_columns(
      col_widths = c(6,6),
      card(card_header("SMILE-FAI by age band"), plotlyOutput("p_fai_age", height = 280)),
      card(card_header("NIHSS-4 CV analogue (0–3)"), plotlyOutput("p_nihss", height = 280))
    ),
    div(class="disc", "NIHSS-4 shown is a CV-estimated analogue of Item 4, not a validated clinical score.")
  ),

  # --- Metric Explorer ---
  nav_panel(
    "Metric Explorer", icon = icon("magnifying-glass-chart"),
    layout_columns(
      col_widths = c(3,9),
      card(card_header("Choose metric"),
           selectInput("metric", NULL, choices = metric_choices, selected = "S02"),
           uiOutput("metric_info")),
      card(card_header("Left vs Right (line of identity)"),
           plotlyOutput("p_lr", height = 340),
           div(class="edu", HTML("Each point is one test's <b>patient-Left</b> vs <b>patient-Right</b>
             value. Points on the diagonal are symmetric; points that fall away from it are the
             asymmetric cases. Colour = the app's flag for that metric.")))
    ),
    layout_columns(
      col_widths = c(7,5),
      card(card_header("Value distribution"), plotlyOutput("p_metric_hist", height = 280)),
      card(card_header("Flag rate"), plotlyOutput("p_metric_flag", height = 280))
    )
  ),

  # --- Flags & Quality ---
  nav_panel(
    "Flags & Quality", icon = icon("table-cells"),
    card(card_header("Flag heatmap — tests × metrics"),
         plotlyOutput("p_heat", height = 420),
         div(class="edu", HTML("Green = within reference, amber = borderline, red = significant,
           grey = not measured. Vertical red streaks show <b>which metrics</b> most often flag;
           horizontal streaks show <b>which tests</b> are most abnormal."))),
    layout_columns(
      col_widths = c(6,6),
      card(card_header("Measurement quality (Q17)"), plotlyOutput("p_qual", height = 280)),
      card(card_header("Quality vs SMILE-FAI"), plotlyOutput("p_qvs", height = 280))
    ),
    div(class="edu", HTML("<b>Why quality matters:</b> uneven lighting, head turn or blur can
      mimic asymmetry. Low-Q17 tests should be interpreted cautiously — use the sidebar quality
      filter to exclude them and see whether a signal survives."))
  ),

  # --- Drilldown & Data ---
  nav_panel(
    "Data", icon = icon("database"),
    layout_columns(
      col_widths = c(4,8),
      card(card_header("Participant"),
           selectInput("who", NULL, choices = c("—")),
           plotlyOutput("p_who_trend", height = 220)),
      card(card_header("Latest test — L/R by metric"),
           plotlyOutput("p_who_lr", height = 300))
    ),
    card(card_header("Filtered records"),
         downloadButton("dl", "Download CSV", class="btn btn-primary btn-sm"),
         br(), br(), DTOutput("tbl"))
  ),

  # --- Learn (educational) ---
  nav_panel(
    "Learn", icon = icon("graduation-cap"),
    layout_columns(
      col_widths = c(6,6),
      card(card_header("What this test measures"),
        div(class="edu", HTML("
        <p><b>FAST</b> (Face, Arm, Speech, Time) is the public stroke check. The <b>face</b> item asks
        the person to <b>smile / show teeth</b> and looks for one side drooping. SMILE-FA makes that
        yes/no judgement <b>objective</b> using computer vision (MediaPipe 468/478-point face mesh),
        quantifying movement on each side and comparing them.</p>
        <p>The guided ~70-second protocol runs: <b>rest → brow raise → eye closure → smile (show
        teeth) → pucker → snarl</b>, mapped to the <b>NIHSS Item 4</b> and <b>Sunnybrook</b> clinical
        grading traditions.</p>"))),
      card(card_header("Central vs peripheral — the forehead rule"),
        div(class="edu", HTML("
        <p>The <b>upper</b> face has <b>bilateral</b> brain input; the <b>lower</b> face is mainly
        <b>one-sided</b>. So:</p>
        <ul><li><b>Stroke (central):</b> lower-face weakness with the <b>forehead spared</b> — the
        person can still raise both eyebrows.</li>
        <li><b>Bell's palsy (peripheral):</b> the <b>whole</b> side is weak, forehead included, often
        with incomplete eye closure.</li></ul>
        <p>That is why <b>brow raise (B02)</b> is the key discriminator, and why the dashboard maps
        lower- vs upper-face asymmetry.</p>")))
    ),
    card(card_header("Metric dictionary (with clinical basis)"),
         div(class="edu", "Every metric below maps to an established clinical observation.
             Thresholds are provisional engineering starting points."),
         br(), DTOutput("dict")),
    layout_columns(
      col_widths = c(6,6),
      card(card_header("Key references"),
        div(class="edu", HTML("
        <ul>
        <li>Kothari et al. (1999) — Cincinnati Prehospital Stroke Scale.</li>
        <li>Brott et al. (1989) — NIH Stroke Scale (Item 4, facial palsy).</li>
        <li>House &amp; Brackmann (1985) — facial nerve grading I–VI.</li>
        <li>Ross et al. (1996) — Sunnybrook Facial Grading System.</li>
        <li>Banks et al. (2015) — eFACE.</li>
        <li>Guarin et al. (2018), <i>JAMA Facial Plast Surg</i> — Emotrics automated landmarks.</li>
        <li>Kartynnik et al. (2019) — MediaPipe Face Mesh.</li>
        <li>Ekman &amp; Friesen (1978) — FACS action units.</li>
        <li>Casiez et al. (2012) — One Euro Filter.</li>
        <li>Barrett et al. (2019) — limits of reading emotion from faces.</li>
        </ul>"))),
      card(card_header("Interpreting responsibly"),
        div(class="disc", HTML("Healthy faces are naturally asymmetric, so a single value means
          little without a personal baseline. Emotion output (measured separately in the app) is
          <b>not</b> felt emotion and can be biased by facial weakness. This dashboard summarises
          screening signals for <b>research</b>, and never replaces clinical assessment. Sudden new
          facial droop, arm weakness or speech change → <b>call 995</b>.")))
    )
  ),

  nav_spacer(),
  nav_item(tags$span(style=sprintf("color:%s;font-size:.75rem;",COL$mut), "Republic Polytechnic · SSH"))
)

# =============================================================================
# SERVER
# =============================================================================
server <- function(input, output, session) {

  raw <- reactiveVal(prep(make_demo()))
  is_demo <- reactiveVal(TRUE)

  load_data <- function() {
    d <- read_sheet_csv()
    if (is.null(d)) { is_demo(TRUE); raw(prep(make_demo())) }
    else { is_demo(FALSE); raw(prep(d)) }
  }
  observeEvent(input$refresh, load_data(), ignoreInit = TRUE)
  # attempt a live pull once at startup (falls back to demo on any failure)
  load_data()

  # populate filter choices
  observe({
    d <- raw(); req(d)
    updateSelectInput(session, "f_gender", choices = c("All", sort(unique(na.omit(d$gender)))), selected = "All")
    updateSelectInput(session, "f_age", choices = c("All", levels(d$.ageband)), selected = "All")
    updateSelectInput(session, "f_mode", choices = c("All", sort(unique(na.omit(d$mode)))), selected = "All")
    updateSelectInput(session, "f_ind", choices = c("All", sort(unique(na.omit(d$C11_indicator)))), selected = "All")
    updateSelectInput(session, "who", choices = sort(unique(na.omit(d$participant_name))))
  })
  output$f_date <- renderUI({
    d <- raw(); rng <- range(d$.date, na.rm = TRUE)
    dateRangeInput("f_date", "Date range", start = rng[1], end = rng[2])
  })

  filt <- reactive({
    d <- raw(); req(d)
    pick <- function(col, sel) if (is.null(sel) || "All" %in% sel) rep(TRUE, nrow(d)) else col %in% sel
    keep <- pick(d$gender, input$f_gender) & pick(as.character(d$.ageband), input$f_age) &
            pick(d$mode, input$f_mode) & pick(d$C11_indicator, input$f_ind) &
            (is.na(d$Q17_quality) | d$Q17_quality >= input$f_qual)
    if (!is.null(input$f_date)) keep <- keep & (is.na(d$.date) |
            (d$.date >= input$f_date[1] & d$.date <= input$f_date[2]))
    d[keep, , drop = FALSE]
  })

  # KPIs
  output$kpi_n <- renderText(nrow(filt()))
  output$kpi_p <- renderText(length(unique(na.omit(filt()$participant_name))))
  pct <- function(col, val) { d<-filt(); if(!nrow(d))return("—")
    sprintf("%.0f%%", 100*mean(d[[col]]==val, na.rm=TRUE)) }
  output$kpi_red   <- renderText(pct("C11_indicator","red"))
  output$kpi_amber <- renderText(pct("C11_indicator","amber"))
  output$kpi_green <- renderText(pct("C11_indicator","green"))
  output$kpi_q     <- renderText({ d<-filt(); if(!nrow(d))return("—")
    sprintf("%.0f", median(d$Q17_quality, na.rm=TRUE)) })

  bar_count <- function(d, col, cols) {
    t <- as.data.frame(table(factor(d[[col]])))
    names(t) <- c("k","n")
    p <- ggplot(t, aes(k, n, fill = k, text = paste0(k,": ",n))) +
      geom_col(width=.7) + scale_fill_manual(values = cols, guide="none") +
      labs(x=NULL,y=NULL) + gg_dark() + theme(axis.text.x=element_text(angle=20,hjust=1))
    plotly_dark(p) |> style(hoverinfo="text")
  }
  output$p_ind <- renderPlotly({ d<-filt(); req(nrow(d)); bar_count(d,"C11_indicator",IND_COL) })
  output$p_pattern <- renderPlotly({ d<-filt(); req(nrow(d))
    pc <- c(none=COL$green, central=COL$red, peripheral=COL$amber, bilateral_or_indeterminate=COL$grey)
    bar_count(d,"C05_pattern",pc) })
  output$p_side <- renderPlotly({ d<-filt(); req(nrow(d))
    sc <- c(L=COL$cyan, R=COL$amber, none=COL$green, unclear=COL$grey)
    bar_count(d,"C06_affected_side",sc) })

  output$p_time <- renderPlotly({
    d<-filt(); req(nrow(d))
    ts <- d |> filter(!is.na(.date)) |> count(.date)
    p <- ggplot(ts, aes(.date, n)) +
      geom_area(fill=paste0(COL$cyan,"33")) +
      geom_line(colour=COL$cyan, linewidth=.8) +
      geom_point(colour=COL$cyan, size=1.4) +
      labs(x=NULL,y="tests") + gg_dark()
    plotly_dark(p)
  })

  # Asymmetry tab
  output$p_fai <- renderPlotly({
    d<-filt(); req(nrow(d))
    p <- ggplot(d, aes(C03_SMILE_FAI)) +
      geom_histogram(bins=30, fill=paste0(COL$cyan,"cc"), colour=COL$panel) +
      geom_vline(xintercept=25, linetype="dashed", colour=COL$amber) +
      geom_vline(xintercept=45, linetype="dashed", colour=COL$red) +
      labs(x="SMILE-FAI (0–100)", y="tests") + gg_dark()
    plotly_dark(p)
  })
  output$p_map <- renderPlotly({
    d<-filt(); req(nrow(d))
    p <- ggplot(d, aes(C02_LFAI, C01_UFAI, colour=C05_pattern,
                       text=paste0("LFAI ",round(C02_LFAI,1),"<br>UFAI ",round(C01_UFAI,1),
                                   "<br>",C05_pattern))) +
      annotate("rect", xmin=25, xmax=Inf, ymin=-Inf, ymax=20, fill=COL$red, alpha=.08) +
      geom_abline(slope=1, intercept=0, colour=COL$line) +
      geom_point(size=2, alpha=.8) +
      scale_colour_manual(values=c(none=COL$green, central=COL$red, peripheral=COL$amber,
                                   bilateral_or_indeterminate=COL$grey), name=NULL) +
      labs(x="Lower-face asymmetry (LFAI)", y="Upper-face asymmetry (UFAI)") + gg_dark()
    plotly_dark(p) |> style(hoverinfo="text")
  })
  output$p_fai_age <- renderPlotly({
    d<-filt(); req(nrow(d))
    p <- ggplot(d, aes(.ageband, C03_SMILE_FAI, fill=.ageband)) +
      geom_violin(colour=NA, alpha=.5) +
      geom_boxplot(width=.18, outlier.size=.6, colour=COL$ink, fill=COL$panel2) +
      scale_fill_manual(values=rep(COL$cyan,6), guide="none") +
      labs(x=NULL,y="SMILE-FAI") + gg_dark()
    plotly_dark(p)
  })
  output$p_nihss <- renderPlotly({
    d<-filt(); req(nrow(d))
    t <- as.data.frame(table(factor(d$C08_nihss4_cv, levels=0:3)))
    names(t)<-c("k","n")
    p <- ggplot(t, aes(k,n,fill=k,text=paste0("Level ",k,": ",n))) + geom_col(width=.7) +
      scale_fill_manual(values=c(`0`=COL$green,`1`=COL$amber,`2`="#F97316",`3`=COL$red),guide="none") +
      labs(x="CV-estimated NIHSS-4 analogue", y="tests") + gg_dark()
    plotly_dark(p) |> style(hoverinfo="text")
  })

  # Metric Explorer
  m_meta <- reactive(METRIC_META[METRIC_META$id==input$metric,])
  output$metric_info <- renderUI({
    mm<-m_meta(); req(nrow(mm))
    div(class="edu",
        HTML(sprintf("<b>%s</b> (%s)<br><span style='color:%s'>Phase:</span> %s ·
             <span style='color:%s'>Unit:</span> %s<br>
             <span style='color:%s'>Borderline:</span> %s · <span style='color:%s'>Significant:</span> %s
             <br><br>%s", mm$name, mm$id, COL$mut, mm$phase, COL$mut, mm$unit,
             COL$amber, mm$border, COL$red, mm$sig, mm$basis)))
  })
  mcol <- function(suf) paste0(input$metric, suf)
  output$p_lr <- renderPlotly({
    d<-filt(); mm<-m_meta(); req(nrow(d), nrow(mm))
    L<-mcol("_L"); R<-mcol("_R"); F<-mcol("_flag")
    req(L %in% names(d), R %in% names(d))
    dd <- d[!is.na(d[[L]]) & !is.na(d[[R]]),]
    req(nrow(dd))
    dd$flag <- if (F %in% names(dd)) dd[[F]] else NA
    lim <- range(c(dd[[L]],dd[[R]]), na.rm=TRUE)
    p <- ggplot(dd, aes(.data[[L]], .data[[R]], colour=flag,
                        text=paste0("L ",round(.data[[L]],3),"<br>R ",round(.data[[R]],3),"<br>",flag))) +
      geom_abline(slope=1,intercept=0,colour=COL$line) +
      geom_point(size=2,alpha=.85) +
      scale_colour_manual(values=FLAG_COL, na.value=COL$grey, name=NULL) +
      coord_equal(xlim=lim,ylim=lim) +
      labs(x=paste0(input$metric," — Left"), y=paste0(input$metric," — Right")) + gg_dark()
    plotly_dark(p) |> style(hoverinfo="text")
  })
  output$p_metric_hist <- renderPlotly({
    d<-filt(); mm<-m_meta(); req(nrow(d),nrow(mm))
    V<-mcol("_value"); req(V %in% names(d))
    p <- ggplot(d, aes(.data[[V]])) +
      geom_histogram(bins=28, fill=paste0(COL$cyan,"cc"), colour=COL$panel) +
      geom_vline(xintercept=mm$border, linetype="dashed", colour=COL$amber) +
      geom_vline(xintercept=mm$sig, linetype="dashed", colour=COL$red) +
      labs(x=paste0(input$metric," value (",mm$unit,")"), y="tests") + gg_dark()
    plotly_dark(p)
  })
  output$p_metric_flag <- renderPlotly({
    d<-filt(); req(nrow(d)); F<-mcol("_flag"); req(F %in% names(d))
    t<-as.data.frame(table(factor(d[[F]], levels=c("none","border","sig")))); names(t)<-c("k","n")
    p<-ggplot(t, aes(k,n,fill=k,text=paste0(k,": ",n))) + geom_col(width=.6) +
      scale_fill_manual(values=FLAG_COL, guide="none") + labs(x=NULL,y="tests") + gg_dark()
    plotly_dark(p) |> style(hoverinfo="text")
  })

  # Flags & Quality
  output$p_heat <- renderPlotly({
    d<-filt(); req(nrow(d))
    ids <- METRIC_META$id[METRIC_META$id %in% sub("_flag","",grep("_flag$",names(d),value=TRUE))]
    req(length(ids)>0)
    dd <- d
    dd$row <- seq_len(nrow(dd))
    long <- lapply(ids, function(m){
      f <- dd[[paste0(m,"_flag")]]
      data.frame(row=dd$row, metric=m, flag=ifelse(is.na(f),"NA",f))
    }) |> bind_rows()
    sev <- c(none=1,border=2,sig=3,`NA`=0)
    long$sev <- sev[long$flag]
    p <- ggplot(long, aes(metric, row, fill=flag,
                          text=paste0("Test #",row,"<br>",metric,": ",flag))) +
      geom_tile(colour=COL$panel) +
      scale_fill_manual(values=FLAG_COL, name=NULL) +
      labs(x=NULL,y="test") + gg_dark() +
      theme(axis.text.x=element_text(angle=45,hjust=1), axis.text.y=element_blank())
    plotly_dark(p) |> style(hoverinfo="text")
  })
  output$p_qual <- renderPlotly({
    d<-filt(); req(nrow(d))
    p<-ggplot(d, aes(Q17_quality)) +
      geom_histogram(bins=25, fill=paste0(COL$green,"cc"), colour=COL$panel) +
      geom_vline(xintercept=60, linetype="dashed", colour=COL$red) +
      labs(x="Q17 measurement quality", y="tests") + gg_dark()
    plotly_dark(p)
  })
  output$p_qvs <- renderPlotly({
    d<-filt(); req(nrow(d))
    p<-ggplot(d, aes(Q17_quality, C03_SMILE_FAI, colour=C11_indicator,
                     text=paste0("Q17 ",round(Q17_quality),"<br>FAI ",round(C03_SMILE_FAI,1)))) +
      geom_point(size=2,alpha=.8) +
      scale_colour_manual(values=IND_COL, name=NULL) +
      labs(x="Measurement quality", y="SMILE-FAI") + gg_dark()
    plotly_dark(p) |> style(hoverinfo="text")
  })

  # Data tab
  output$p_who_trend <- renderPlotly({
    d<-filt(); req(nrow(d), input$who %in% d$participant_name)
    w <- d[d$participant_name==input$who,] |> arrange(.ts)
    p<-ggplot(w, aes(.ts, C03_SMILE_FAI)) +
      geom_line(colour=COL$cyan) + geom_point(colour=COL$cyan, aes(text=round(C03_SMILE_FAI,1))) +
      labs(x=NULL,y="SMILE-FAI") + gg_dark()
    plotly_dark(p)
  })
  output$p_who_lr <- renderPlotly({
    d<-filt(); req(nrow(d), input$who %in% d$participant_name)
    w <- d[d$participant_name==input$who,] |> arrange(desc(.ts)) |> head(1)
    ids <- METRIC_META$id[METRIC_META$unit=="ratio" &
             paste0(METRIC_META$id,"_L") %in% names(w)]
    rows <- lapply(ids, function(m) data.frame(metric=m,
              side=c("L","R"), val=c(w[[paste0(m,"_L")]], w[[paste0(m,"_R")]]))) |> bind_rows()
    rows <- rows[!is.na(rows$val),]; req(nrow(rows))
    p<-ggplot(rows, aes(metric, val, fill=side,
                        text=paste0(metric," ",side,": ",round(val,3)))) +
      geom_col(position="dodge", width=.7) +
      scale_fill_manual(values=c(L=COL$cyan, R=COL$amber), name=NULL) +
      labs(x=NULL,y="ratio (1 = symmetric)") + gg_dark() +
      theme(axis.text.x=element_text(angle=30,hjust=1))
    plotly_dark(p) |> style(hoverinfo="text")
  })
  output$tbl <- renderDT({
    d<-filt(); req(nrow(d))
    show <- d |> select(any_of(c("participant_name","gender","year_of_birth",".age","mode",
      "C11_indicator","C05_pattern","C06_affected_side","C03_SMILE_FAI","C08_nihss4_cv",
      "Q17_quality","submitted_at")))
    datatable(show, rownames=FALSE, options=list(pageLength=12, scrollX=TRUE,
      dom="tip"), class="compact stripe") |>
      formatRound(intersect(c("C03_SMILE_FAI","Q17_quality"), names(show)), 1)
  })
  output$dl <- downloadHandler(
    filename = function() paste0("smile_fa_filtered_", Sys.Date(), ".csv"),
    content = function(f) write.csv(filt() |> select(-starts_with(".")), f, row.names=FALSE))

  # Learn dictionary
  output$dict <- renderDT({
    dd <- METRIC_META |> transmute(ID=id, Metric=name, Phase=phase, Unit=unit,
                                   `Borderline (prov.)`=border, `Significant (prov.)`=sig,
                                   `Clinical basis`=basis)
    datatable(dd, rownames=FALSE, options=list(pageLength=16, dom="t", scrollX=TRUE),
              class="compact stripe")
  })
}

shinyApp(ui, server)
