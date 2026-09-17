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
    // Framing
    "Macro close-up with shallow depth of field",
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
export const FRAMING_COUNT = 6;
