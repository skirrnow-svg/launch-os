/**
 * Option dataset for the AI Video Prompt Builder (see
 * Instructions/videogenpromptgen.txt). Kept as data so the UI, the compilation
 * logic, and any future server-side validation share one source of truth.
 *
 * Note on camera: `cameraFramingAndMovement` holds FRAMING options first, then
 * MOVEMENT options. The component splits them (1 framing + up to 2 movements) —
 * see FRAMING_COUNT below. Keep framings grouped ahead of movements if editing.
 */
export const PROMPT_BUILDER_OPTIONS = {
  heroSubjects: [
    // Motorcycle & Mobility
    "Adventure touring motorcycle boots",
    "Dual-sport adventure motorcycle",
    "Carbon-fiber full-face helmet",
    "Armored mesh riding jacket",
    "Aerodynamic electric performance car",
    "Titanium sport exhaust system",
    // Tech & Consumer Electronics
    "Flagship glass-and-titanium smartphone",
    "Ultra-thin matte aluminum laptop",
    "High-fidelity wireless over-ear headphones",
    "OLED curved ultrawide workstation monitor",
    "Mechanical keyboard with custom keycaps",
    "Aerospace-grade camera drone",
    // Footwear, Apparel & Luxury
    "Waterproof technical trail-running shoes",
    "Hand-welted Italian leather oxford shoes",
    "Breathable technical storm rainshell",
    "High-compression seamless athletic wear",
    "Luxury automatic chronograph wristwatch",
    "Bespoke tailored wool blazer",
    // Food, Beverage & Home
    "Stainless steel gooseneck pour-over kettle",
    "Artisanal cold-brew bottle with condensation",
    "Commercial espresso group head pulling a shot",
    "Damascus steel chef knife slicing produce",
    "Sleek countertop glass blender swirling smoothie",
    // Digital & SaaS
    "Cloud infrastructure monitoring dashboard",
    "Fintech mobile contactless payment screen",
    "3D real-time CAD model viewport",
    "AI automation workspace and analytics panel",
    "Dark-mode financial trading interface",
  ],

  actorsAndWardrobe: [
    // Personas
    "Experienced adventure motorcycle rider",
    "Focused urban commuter",
    "High-performance track athlete",
    "Senior software engineer",
    "Artisanal specialty barista",
    "Editorial luxury fashion model",
    "Industrial studio craftsman",
    // Posture & Hand Context
    "Firm two-handed grip with steady posture",
    "Precise fingertip handling and dexterity",
    "Upright relaxed forward-facing seated posture",
    // Wardrobe
    "Weathered technical Cordura textile gear",
    "Minimalist monochrome streetwear",
    "Tailored charcoal business suit",
    "Compression athletic training apparel",
    "Raw selvedge denim with leather apron",
    "Smart-casual modern home-office attire",
  ],

  actionsAndMechanics: [
    // Mounting & Vehicles
    "Mounting smoothly with bent knee in low arc, rear suspension visibly compressing under body weight, side stand retracting",
    "Stepping firmly onto motorcycle footpeg with authentic weight transfer and sole traction",
    "Twisting motorcycle throttle with subtle rear chassis squat and chain tension",
    // Footwear & Movement
    "Heavy boot tread impacting wet gravel, displacing fine loose aggregate naturally",
    "Athletic running stride with natural forefoot impact and dynamic sole flex",
    "Sharp pivot turn on slick concrete with realistic grip and zero foot slip",
    // Electronics & Hardware
    "Tapping responsive glass display with realistic micro-vibration and fluid UI feedback",
    "Typing on mechanical keycaps with crisp downward actuation and clean bounce",
    "Unfolding a foldable display with smooth, calibrated continuous hinge resistance",
    "Snapping device magnetically into aluminum charging stand with a solid click",
    // Liquids & Culinary
    "Pouring boiling water in a steady laminar stream with rising hot steam plumes",
    "Cold condensation beads rolling smoothly down chilled frosted glass",
    "Pulling espresso with thick golden crema swirling into a warm ceramic cup",
    // Digital Workflow
    "Navigating interactive data charts with precise cursor clicks and smooth viewport pans",
    "Expanding application panels with instant 60fps frame transitions and zero latency",
  ],

  cameraFramingAndMovement: [
    // Framing (keep grouped ahead of movement — see FRAMING_COUNT).
    "Macro close-up with shallow depth of field",
    "Extreme tight detail shot",
    "Low-angle three-quarter tracking shot",
    "Eye-level medium commercial hero shot",
    "Clean top-down 90-degree overhead flat-lay",
    "Wide cinematic environmental establishing shot",
    "Dynamic over-the-shoulder user perspective",
    // Movement
    "Slow controlled push-in dolly",
    "High-speed lateral tracking pan",
    "Smooth 45-degree orbital arc rotation",
    "Locked-off static broadcast tripod shot",
    "Sweeping vertical crane jib descent",
  ],

  environments: [
    "Wet coastal tarmac road at golden hour",
    "Misty high-altitude alpine switchback road",
    "Rain-slicked neon metropolitan street at dusk",
    "Sun-drenched desert canyon off-road trail",
    "Minimalist raw concrete architectural gallery",
    "Warm Scandinavian oak-wood modern living space",
    "High-tech server room with glowing rack LEDs",
    "Sunlit boutique cafe with exposed brickwork",
    "Corporate executive office with skyline glass walls",
  ],

  lightingAndAtmosphere: [
    "Warm golden-hour sunlight with dramatic lens flares",
    "High-contrast commercial studio edge rim lighting",
    "Moody cinematic anamorphic blue-hour tones",
    "Soft diffused overcast daylight with low shadows",
    "Vibrant dual-tone neon edge illumination",
    "Low-key directional spotlight with deep shadows",
    "Volumetric morning mist and sun shafts",
  ],

  materialsAndFinishes: [
    "Matte rugged technical rubber and molded armor",
    "Ballistic waterproof Cordura fabric weave",
    "Brushed aerospace anodized aluminum",
    "Glossy twill carbon-fiber composite",
    "Micro water droplets, condensation, and rain splashes",
    "High-luminance crisp OLED screen glass",
    "Full-grain vegetable-tanned oiled leather",
    "Frosted tempered glass and polished chrome trim",
  ],
} as const;

/** How many leading entries of `cameraFramingAndMovement` are FRAMING options. */
export const FRAMING_COUNT = 7;

/* ------------------------------------------------------------------ *
 * Cascading domain taxonomy
 * ------------------------------------------------------------------ *
 * Selecting a subject category filters + populates every downstream field
 * (actors, environments, lighting, actions, materials, hero suggestions) so the
 * whole form stays coherent for that domain. Camera framing/movement remain
 * global (they are scale-scoped, not domain-scoped — see FRAMING_SCOPE).
 */
export type SubjectCategory =
  | "saas_digital"       // SaaS, Apps, Platforms, AI Tools
  | "b2b_service"        // Agency, Consulting, Logistics, Finance
  | "physical_product"   // Footwear, Wearables, Hardware, Consumer Tech
  | "mobility_vehicle"   // Motorcycles, Cars, EV, Mobility Gear
  | "food_beverage";     // Drinks, Culinary, Packaged Goods

export interface CategoryPreset {
  label: string;
  defaultStyle: string;
  heroPlaceholder: string;
  sampleSubjects: string[];
  actors: string[];
  environments: string[];
  lighting: string[];
  actions: string[];
  materials: string[];
}

export const CATEGORY_TAXONOMY: Record<SubjectCategory, CategoryPreset> = {
  saas_digital: {
    label: "Software & Digital Platforms",
    defaultStyle: "App / screen demo",
    heroPlaceholder: "e.g., AI Analytics Dashboard, FinTech Payment App, SaaS Launch",
    sampleSubjects: [
      "AI marketing automation dashboard",
      "Real-time pipeline analytics portal",
      "Mobile contactless payment app",
      "Multi-tenant cloud architecture console",
    ],
    actors: [
      "Senior software engineer typing with focused posture",
      "Product manager presenting dashboard on laptop",
      "Modern remote worker interacting with tablet",
      "Focused UX designer navigating interface",
    ],
    environments: [
      "High-tech dark-mode workstation with dual monitors",
      "Minimalist sunlit glass startup office",
      "Clean architectural co-working lounge",
      "Sleek server room with subtle rack LED glows",
    ],
    lighting: [
      "Subtle cool blue screen bounce illumination",
      "Soft diffused Scandinavian ambient daylight",
      "Moody low-key cinematic desk lamp lighting",
      "Vibrant cyber-neon edge rim accents",
    ],
    actions: [
      "Fingers smoothly gliding across trackpad, expanding dynamic data charts with 60fps fluid transitions",
      "Clicking launch button with instantaneous live graph rendering and positive status notification",
      "Seamless viewport camera pan across interactive 3D metrics dashboard with zero latency",
      "Swiping through mobile app screens with responsive micro-haptic UI animations",
    ],
    materials: [
      "High-luminance crisp OLED screen glass",
      "Matte anti-glare display surface",
      "Brushed anodized dark aluminum laptop chassis",
      "Frosted translucent UI glass panels and neon indicator glows",
    ],
  },

  b2b_service: {
    label: "B2B & Professional Services",
    defaultStyle: "Product hero",
    heroPlaceholder: "e.g., Marketing Agency Pipeline, Supply Chain Audit, Legal Firm",
    sampleSubjects: [
      "Lead generation & automated outbound campaign",
      "Enterprise logistics fulfillment network",
      "Strategic GTM launch advisory",
      "Corporate governance & compliance audit",
    ],
    actors: [
      "Executive growth consultant reviewing quarterly metrics",
      "Account strategist analyzing qualified lead profiles",
      "Commercial solution architect structuring proposals",
      "B2B sales director closing pipeline contracts",
    ],
    environments: [
      "High-floor executive boardroom with skyline glass walls",
      "Contemporary architectural agency studio",
      "Sun-drenched enterprise meeting suite",
      "Modern collaborative open-plan agency workspace",
    ],
    lighting: [
      "Polished high-key corporate commercial daylight",
      "Warm golden morning sunlight through floor-to-ceiling windows",
      "Clean architectural balanced studio illumination",
    ],
    actions: [
      "Reviewing verified lead cards updating in real-time with green approval status indicators",
      "Reviewing enterprise pipeline charts showing surging inbound customer acquisition",
      "Annotating digital strategy roadmaps with confident, deliberate stylus strokes",
    ],
    materials: [
      "Polished architectural glass and steel framing",
      "Matte executive leather portfolios and premium stationery",
      "High-resolution tablet displays and tactile aluminum styluses",
    ],
  },

  physical_product: {
    label: "Physical Products & Hardware",
    defaultStyle: "Product hero",
    heroPlaceholder: "e.g., Chronograph Watch, Wireless Headphones, Ergonomic Chair",
    sampleSubjects: [
      "Luxury automatic chronograph wristwatch",
      "High-fidelity wireless over-ear headphones",
      "Waterproof technical trail-running shoes",
      "Minimalist aerospace-grade camera drone",
    ],
    actors: [
      "Just the product — no people",
      "Artisanal craftsman holding product with steady grip",
      "Focused industrial designer evaluating tolerances",
    ],
    environments: [
      "Minimalist raw concrete architectural gallery",
      "Warm Scandinavian oak-wood living space",
      "Matte black commercial tabletop studio",
    ],
    lighting: [
      "High-contrast commercial studio edge rim lighting",
      "Soft overhead diffused lightbox illumination",
      "Directional spotlight creating sculpted shadow falls",
    ],
    actions: [
      "Slow 45-degree orbital camera rotation highlighting seamless seam tolerances",
      "Smooth push-in dolly shot revealing brushed metallic grain and bevel cuts",
      "Dropping onto a textured stone pedestal with subtle resting bounce and contact shadow",
    ],
    materials: [
      "Brushed aerospace anodized aluminum",
      "Hand-finished vegetable-tanned leather",
      "Frosted tempered glass with polished bevels",
      "Precision-machined stainless steel dials",
    ],
  },

  mobility_vehicle: {
    label: "Mobility, Vehicles & Gear",
    defaultStyle: "Rider & vehicle",
    heroPlaceholder: "e.g., Adventure Touring Boots, Dual-Sport Motorcycle, Electric Supercar",
    sampleSubjects: [
      "Adventure touring motorcycle boots",
      "Dual-sport adventure motorcycle",
      "Aerodynamic electric performance vehicle",
      "Carbon-fiber full-face helmet",
    ],
    actors: [
      "Experienced adventure motorcycle rider",
      "Focused urban commuter in technical rainshell",
      "High-performance track driver",
    ],
    environments: [
      "Wet coastal tarmac road at golden hour",
      "Misty high-altitude alpine switchback road",
      "Sun-drenched desert canyon off-road trail",
      "Rain-slicked neon metropolitan street at dusk",
    ],
    lighting: [
      "Warm golden-hour sunlight with dramatic lens flares",
      "Moody cinematic anamorphic blue-hour tones",
      "High-contrast commercial studio edge rim lighting",
    ],
    actions: [
      "Rider steps firmly onto motorcycle footpeg with authentic weight transfer as suspension settles",
      "Heavy boot tread impacting wet gravel, displacing fine loose aggregate naturally",
      "Vehicle carving through wet asphalt corner with authentic tire grip and spray",
    ],
    materials: [
      "Matte rugged technical rubber and molded armor",
      "Glossy twill carbon-fiber composite",
      "Ballistic waterproof Cordura fabric weave",
      "Micro water droplets, condensation, and rain splashes",
    ],
  },

  food_beverage: {
    label: "Food, Drink & Culinary",
    defaultStyle: "Food & drink",
    heroPlaceholder: "e.g., Cold Brew Coffee, Artisanal Burger, Espresso Machine",
    sampleSubjects: [
      "Artisanal cold-brew bottle with condensation",
      "Commercial espresso group head pulling a shot",
      "Stainless steel gooseneck pour-over kettle",
      "Hand-tossed sourdough pizza in brick oven",
    ],
    actors: [
      "Just the product — no people",
      "Artisanal specialty barista",
      "Professional culinary chef",
    ],
    environments: [
      "Sunlit boutique cafe with exposed brickwork",
      "Warm commercial rustic kitchen counter",
      "Dark moody cocktail bar with warm backlights",
    ],
    lighting: [
      "Warm morning backlight creating golden translucent glow",
      "Soft natural window daylight with deep rich shadows",
      "Low-key dramatic amber rim illumination",
    ],
    actions: [
      "Pouring liquid in a steady laminar stream with rising hot steam plumes",
      "Cold condensation beads rolling slowly down chilled frosted glass",
      "Espresso pulling with thick golden crema swirling into a warm ceramic cup",
    ],
    materials: [
      "Chilled frosted glass with running condensation drops",
      "Polished mirror chrome and warm brass fixtures",
      "Warm ceramic glaze and coarse reclaimed wood surfaces",
    ],
  },
};

/* ------------------------------------------------------------------ *
 * Scale / optical constraint model
 * ------------------------------------------------------------------ *
 * Prevents the "scale hallucination" failure where a tight macro framing is
 * paired with a full-body action (mounting a bike, a running stride) or an
 * incompatible lens, causing the engine to morph feet into vehicle parts and
 * zoom wildly. Framings and actions carry a scale scope; lenses are matched to
 * that scope. This is the single source of truth shared by the UI (filtering /
 * auto-switching) and the compiler (final sanitisation).
 */
export type ScaleScope = "macro" | "full";
export type ActionScope = ScaleScope | "any";

/** Each FRAMING's scale tier. Movements are scope-agnostic (absent here). */
export const FRAMING_SCOPE: Record<string, ScaleScope> = {
  "Macro close-up with shallow depth of field": "macro",
  "Extreme tight detail shot": "macro",
  "Clean top-down 90-degree overhead flat-lay": "macro",
  "Low-angle three-quarter tracking shot": "full",
  "Eye-level medium commercial hero shot": "full",
  "Wide cinematic environmental establishing shot": "full",
  "Dynamic over-the-shoulder user perspective": "full",
};

/** Convenience tiers (derived from FRAMING_SCOPE). */
export const MACRO_TIER = Object.keys(FRAMING_SCOPE).filter((f) => FRAMING_SCOPE[f] === "macro");
export const FULL_TIER = Object.keys(FRAMING_SCOPE).filter((f) => FRAMING_SCOPE[f] === "full");

/**
 * Each ACTION's scale tier. "full" = needs body/vehicle in frame (invalid at
 * macro scale); "macro" = an isolated fine-detail gesture; "any" = reads at
 * either scale.
 */
export const ACTION_SCOPE: Record<string, ActionScope> = {
  "Mounting smoothly with bent knee in low arc, rear suspension visibly compressing under body weight, side stand retracting": "full",
  "Stepping firmly onto motorcycle footpeg with authentic weight transfer and sole traction": "full",
  "Twisting motorcycle throttle with subtle rear chassis squat and chain tension": "full",
  "Heavy boot tread impacting wet gravel, displacing fine loose aggregate naturally": "any",
  "Athletic running stride with natural forefoot impact and dynamic sole flex": "full",
  "Sharp pivot turn on slick concrete with realistic grip and zero foot slip": "full",
  "Tapping responsive glass display with realistic micro-vibration and fluid UI feedback": "macro",
  "Typing on mechanical keycaps with crisp downward actuation and clean bounce": "macro",
  "Unfolding a foldable display with smooth, calibrated continuous hinge resistance": "macro",
  "Snapping device magnetically into aluminum charging stand with a solid click": "macro",
  "Pouring boiling water in a steady laminar stream with rising hot steam plumes": "any",
  "Cold condensation beads rolling smoothly down chilled frosted glass": "macro",
  "Pulling espresso with thick golden crema swirling into a warm ceramic cup": "any",
  "Navigating interactive data charts with precise cursor clicks and smooth viewport pans": "any",
  "Expanding application panels with instant 60fps frame transitions and zero latency": "any",
};

// Lens profiles matched to scope (plain strings mirroring promptCompiler's
// LENS_PROFILES — kept here to avoid a circular import).
export const MACRO_LENS = "90mm Macro Cine Prime";
export const FULL_LENSES = ["Anamorphic 35mm Prime", "Cooke S4/i 50mm Prime"];
export const MACRO_LENSES = [MACRO_LENS];
/** Fallback framing when a macro/full conflict has to be resolved. */
export const DEFAULT_FULL_FRAMING = "Low-angle three-quarter tracking shot";

/** Scope of a framing string, or null if it isn't a known framing. */
export function framingScope(framing?: string | null): ScaleScope | null {
  if (!framing) return null;
  return FRAMING_SCOPE[framing] ?? null;
}

/** Scope of an action string; unknown / free-text actions read as "any". */
export function actionScope(action?: string | null): ActionScope {
  if (!action) return "any";
  return ACTION_SCOPE[action] ?? "any";
}

/** Lenses compatible with a framing scope (all three when scope is unknown). */
export function compatibleLenses(scope: ScaleScope | null): string[] {
  if (scope === "macro") return [...MACRO_LENSES];
  if (scope === "full") return [...FULL_LENSES];
  return [...MACRO_LENSES, ...FULL_LENSES];
}

/**
 * Whether an action may be offered under the given framing scope. Macro framing
 * hides full-body actions; every other scope allows all (full-body prioritised
 * but micro still permitted).
 */
export function actionAllowedInScope(action: string, scope: ScaleScope | null): boolean {
  if (scope !== "macro") return true;
  return actionScope(action) !== "full";
}

/**
 * Resolve scale/optical conflicts to a coherent set. Used by the compiler as
 * the final safety net (and mirrors what the UI does live):
 *   • a full-body action under a macro framing → the macro framing is swapped
 *     for DEFAULT_FULL_FRAMING;
 *   • the effective lens is coerced to the framing scope (macro ⇒ macro prime;
 *     full ⇒ never the macro prime — e.g. no Anamorphic 35mm on a macro shot).
 */
export function resolveScaleConflicts(input: { framings: string[]; action?: string | null; lens: string }): {
  framings: string[];
  lens: string;
  changed: boolean;
} {
  let framings = [...input.framings];
  let lens = input.lens;
  let changed = false;

  // 1) Full-body action cannot live under a macro framing.
  if (actionScope(input.action) === "full" && framings.some((f) => framingScope(f) === "macro")) {
    framings = framings.filter((f) => framingScope(f) !== "macro");
    if (!framings.some((f) => framingScope(f) === "full")) framings = [DEFAULT_FULL_FRAMING, ...framings];
    changed = true;
  }

  // 2) Effective scope (full wins over macro if both somehow present).
  const scope: ScaleScope | null = framings.some((f) => framingScope(f) === "full")
    ? "full"
    : framings.some((f) => framingScope(f) === "macro")
      ? "macro"
      : null;

  // 3) Coerce the lens to the scope.
  if (scope === "macro" && !MACRO_LENSES.includes(lens)) { lens = MACRO_LENS; changed = true; }
  if (scope === "full" && MACRO_LENSES.includes(lens)) { lens = FULL_LENSES[0]; changed = true; }

  return { framings, lens, changed };
}
