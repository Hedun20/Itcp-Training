// ============================================================================
// COURSE CONTENT
// ----------------------------------------------------------------------------
// Modular by design: add a new course by appending an object to TRAININGS.
// The home screen, course player, quiz engine and records all read from here,
// so nothing else in the app needs to change when you add a course.
//
// Shape of a course:
//   {
//     id, code, title, duration, summary, passMark,
//     modules: [ { title, body: [paragraph, ...] }, ... ],
//     quiz:    [ { q, options: [...], answer: <index> }, ... ],
//   }
// ============================================================================

export const LEGACY_TRAININGS = [
  {
    id: "dc-telecom-basics",
    code: "DCT-01",
    title: "Data Centre Telecommunications — Foundations",
    duration: "2–3 hrs",
    summary:
      "Layout, copper, fibre, containment and the path a signal takes from the provider to the server. The baseline every field engineer completes before practical install work.",
    passMark: 70,
    modules: [
      {
        title: "Data Centre Layout",
        body: [
          "A data centre is divided into functional zones so cabling stays organised and faults stay isolated. Signals enter at the Main Entrance Facility (MEF) and reach the Meet-Me Room (MMR), where carriers and tenants interconnect.",
          "From there the Main Distribution Area (MDA) holds the core switching. The Horizontal Distribution Area (HDA) feeds rows of racks, and the Equipment Distribution Area (EDA) is the rack itself where servers live. Understanding these zones tells you where a cable belongs and what standard governs it.",
        ],
      },
      {
        title: "Copper Infrastructure — Cat 6A",
        body: [
          "Category 6A is the copper workhorse in the data centre, supporting 10GBASE-T to 100 metres. It carries tighter tolerances on crosstalk than Cat 6, which is why alien crosstalk (interference between adjacent cables) matters and why bundle discipline is enforced.",
          "Terminate to the pin/pair map without untwisting more than 13 mm, maintain bend radius, and never exceed the 100 m channel. Poor termination is the single most common cause of a link failing certification.",
        ],
      },
      {
        title: "Fibre Optic Infrastructure",
        body: [
          "Fibre carries the high-bandwidth and long-distance links. OS2 single-mode is used for backbone and inter-building runs; OM4 and OM5 multimode serve shorter, high-speed links inside the hall.",
          "Connectors matter: LC duplex for equipment, and MPO/MTP for high-density trunks feeding switches. Endface cleanliness is critical — a single particle can fail a link or damage a transceiver.",
        ],
      },
      {
        title: "Cable Containment",
        body: [
          "Containment routes and protects cable: ladder rack and basket tray overhead, conduit and trunking where mechanical protection or separation is needed. Copper and fibre are segregated, and power is kept clear of data to limit interference.",
          "Fill ratios, bend radius at every transition, and clean separation between systems are what keep an install both compliant and maintainable.",
        ],
      },
      {
        title: "The End-to-End Signal Path",
        body: [
          "Follow a signal end to end: it enters at the MEF, is cross-connected in the MMR, switched in the MDA, distributed through the HDA, and terminates at the server in the EDA.",
          "Every patch, panel and length of horizontal cable in that chain is a potential point of loss or failure. Knowing the path is what lets you diagnose quickly when a link goes down.",
        ],
      },
      {
        title: "Why Containment Protects the Whole System",
        body: [
          "Containment is not just tidiness. It maintains bend radius, controls fill, segregates systems and protects cable from mechanical damage over the life of the facility.",
          "A well-designed containment system is what allows the telecoms infrastructure to be tested, certified, extended and maintained without disturbing live services.",
        ],
      },
    ],
    quiz: [
      {
        q: "Where do carriers and tenants interconnect in a data centre?",
        options: ["EDA", "Meet-Me Room (MMR)", "HDA", "Rack PDU"],
        answer: 1,
      },
      {
        q: "What is the maximum channel length for Cat 6A 10GBASE-T?",
        options: ["55 metres", "90 metres", "100 metres", "150 metres"],
        answer: 2,
      },
      {
        q: "Which fibre type is used for backbone and inter-building runs?",
        options: ["OM3 multimode", "OM4 multimode", "OS2 single-mode", "OM5 multimode"],
        answer: 2,
      },
      {
        q: "Which connector is typical for high-density switch trunks?",
        options: ["LC duplex", "MPO/MTP", "SC simplex", "RJ45"],
        answer: 1,
      },
      {
        q: "What is the maximum untwist allowed when terminating Cat 6A?",
        options: ["13 mm", "25 mm", "50 mm", "No limit"],
        answer: 0,
      },
      {
        q: "Why is endface cleanliness critical on fibre?",
        options: [
          "It changes the cable colour",
          "A particle can fail a link or damage a transceiver",
          "It affects copper crosstalk",
          "It is only cosmetic",
        ],
        answer: 1,
      },
      {
        q: "What is a key reason to segregate power from data cabling?",
        options: [
          "To save tray space",
          "To limit electromagnetic interference",
          "It is faster to install",
          "To match cable colours",
        ],
        answer: 1,
      },
      {
        q: "Which area holds the core switching?",
        options: ["EDA", "HDA", "MDA", "MEF"],
        answer: 2,
      },
      {
        q: "What most commonly causes a copper link to fail certification?",
        options: ["Cable colour", "Poor termination", "Rack height", "Label font"],
        answer: 1,
      },
      {
        q: "What does containment maintain across the life of a facility?",
        options: [
          "Bend radius, fill control, segregation and mechanical protection",
          "Only aesthetics",
          "Power redundancy",
          "Server uptime alone",
        ],
        answer: 0,
      },
    ],
  },

  {
    id: "testing-certification",
    code: "DCT-02",
    title: "Testing & Certification",
    duration: "2–3 hrs",
    summary:
      "Verification vs certification, Permanent Link vs Channel, Fluke copper certification, fibre tier 1 (OLTS) and tier 2 (OTDR), and what makes a handover report valid. The higher-stakes skill, so the pass mark is set higher.",
    passMark: 75,
    modules: [
      {
        title: "Why We Certify, Not Just Test",
        body: [
          "Testing confirms a link works. Certification proves it meets a standard to defined limits, with results a manufacturer will accept against a warranty. On a data centre project the client is buying certification, not a quick continuity check.",
          "Certified results are the evidence that the installation performs and the trigger for the extended system warranty. Get this wrong and the whole job is at risk.",
        ],
      },
      {
        title: "Permanent Link vs Channel",
        body: [
          "The Permanent Link is the fixed horizontal cabling — outlet to patch panel — excluding the patch cords. The Channel includes the patch cords at both ends: the full end-to-end connection the equipment sees.",
          "They have different test limits. Selecting the wrong one on the tester is the classic new-engineer error — it invalidates the result even when the cabling is fine.",
        ],
      },
      {
        title: "Copper Certification with a Fluke",
        body: [
          "A Fluke DSX certifies copper against parameters including wire map, NEXT, insertion loss, return loss and delay skew. A pass means every parameter is inside the limit for the selected standard.",
          "Common fail causes: a split pair or mis-wire on the map, excessive untwist raising NEXT, or a kinked/over-bent cable pushing return loss out. Read which parameter failed — it tells you where to look.",
        ],
      },
      {
        title: "Fibre Tier 1 — OLTS",
        body: [
          "Tier 1 uses an Optical Loss Test Set to measure end-to-end insertion loss against a loss budget. You must set a reference first, choose the correct method, and test at the correct wavelengths (1310/1550 nm single-mode, 850/1300 nm multimode).",
          "Endface cleaning before every mate is non-negotiable — most tier 1 failures trace back to a dirty or damaged connector rather than the fibre itself.",
        ],
      },
      {
        title: "Fibre Tier 2 — OTDR",
        body: [
          "An OTDR maps the loss and location of every event along the fibre — each connector, splice and bend — rather than just the total loss. It is how you locate a fault, not just detect one.",
          "Launch and tail cords are required so the near and far connectors are visible on the trace. Reading the trace correctly separates a bad splice from a bad connector from a tight bend.",
        ],
      },
      {
        title: "The Test Report & Handover",
        body: [
          "A valid certified report carries the standard tested to, the limit used, a pass with margin, the tester make/model, a current calibration date, and a label on each link that matches the record.",
          "An expired tester calibration invalidates every result taken with it. The report is a compliance document — treat it as the deliverable, not an afterthought.",
        ],
      },
    ],
    quiz: [
      {
        q: "What is the difference between verification and certification?",
        options: [
          "There is none",
          "Certification proves a link meets a standard to defined limits with warranty-grade results",
          "Verification is more rigorous",
          "Certification only applies to fibre",
        ],
        answer: 1,
      },
      {
        q: "The Permanent Link excludes which element?",
        options: ["The outlet", "The patch panel", "The patch cords", "The horizontal cable"],
        answer: 2,
      },
      {
        q: "The Channel includes what the Permanent Link does not?",
        options: ["The wall", "The patch cords at both ends", "The rack", "The label"],
        answer: 1,
      },
      {
        q: "Which is NOT a Fluke copper certification parameter?",
        options: ["Wire map", "NEXT", "Endface geometry", "Return loss"],
        answer: 2,
      },
      {
        q: "A split pair on the wire map most directly indicates what?",
        options: ["A fibre fault", "A mis-wire in the termination", "A calibration issue", "A bend radius fault only"],
        answer: 1,
      },
      {
        q: "What must you do before running an OLTS tier 1 test?",
        options: ["Nothing", "Set a reference", "Splice the fibre", "Charge the OTDR"],
        answer: 1,
      },
      {
        q: "At which wavelengths is single-mode fibre typically tested?",
        options: ["850 and 1300 nm", "1310 and 1550 nm", "500 and 650 nm", "100 and 90 nm"],
        answer: 1,
      },
      {
        q: "What is an OTDR primarily used for?",
        options: [
          "Measuring total link loss only",
          "Mapping the loss and location of every event along the fibre",
          "Certifying copper Cat 6A",
          "Cleaning endfaces",
        ],
        answer: 1,
      },
      {
        q: "Why are launch and tail cords used with an OTDR?",
        options: [
          "To extend the cable permanently",
          "So the near and far connectors are visible on the trace",
          "To clean the fibre",
          "They are not needed",
        ],
        answer: 1,
      },
      {
        q: "Which of these makes a certified test report invalid?",
        options: [
          "A pass with comfortable margin",
          "An expired/lapsed tester calibration",
          "A unique label on each link",
          "Recording the operator name",
        ],
        answer: 1,
      },
    ],
  },

  {
    id: "health-and-safety",
    code: "HSE-01",
    title: "Health & Safety on Site",
    duration: "2–3 hrs",
    summary:
      "Risk assessment and method statements, PPE, working at height, electrical safety, manual handling, and site conduct on data centre projects. The mandatory course before any engineer goes to site, aligned to Dutch Arbowet and Spanish PRL duties.",
    passMark: 80,
    modules: [
      {
        title: "Legal Duties — Arbowet & PRL",
        body: [
          "Every engineer works under a legal safety framework. In the Netherlands that is the Arbowet, which requires a Risico-Inventarisatie & -Evaluatie (RI&E) and places duties on both employer and worker. In Spain the equivalent is the Ley de Prevención de Riesgos Laborales (Law 31/1995).",
          "Both frameworks share the same logic: identify the hazard, assess the risk, and control it — eliminate first, then substitute, then engineering controls, then organisation, and PPE last. You are not just following rules; you have a personal legal duty to work safely and to stop if a task is unsafe.",
        ],
      },
      {
        title: "RAMS — Risk Assessment & Method Statement",
        body: [
          "Before work starts, the RAMS defines how the task will be done safely. The risk assessment lists each hazard, who is at risk, the likelihood and severity, and the controls. The method statement is the step-by-step safe sequence of work.",
          "You must read and sign the RAMS briefing before starting on site — signing means you understand the controls and will follow them. If the job changes, the RAMS must be reviewed before you continue. A RAMS that sits unread in a folder protects no one.",
        ],
      },
      {
        title: "PPE — Personal Protective Equipment",
        body: [
          "PPE is the last line of defence, not the first. On a data centre install expect safety boots, hi-vis, gloves, eye protection and hearing protection where noise demands it; hard hats in construction zones and where overhead work is in progress.",
          "PPE only works if it fits, is in good condition and is actually worn. Damaged PPE is replaced, not tolerated. Task-specific protection — cut-resistant gloves for cable pulling, safety glasses for fibre work — is chosen for the hazard in front of you.",
        ],
      },
      {
        title: "Working at Height",
        body: [
          "Falls are a leading cause of serious injury in construction. Work at height only with the right access equipment — podium steps, a properly erected and tagged mobile tower, or a MEWP — never a makeshift platform or the top of a ladder.",
          "Check the tag before using a tower or MEWP, keep three points of contact on ladders used only for short-duration light work, and never leave tools or materials where they can fall. Below-height controls — exclusion zones, toe boards — protect the people beneath you.",
        ],
      },
      {
        title: "Electrical Safety",
        body: [
          "A live data centre is an energised environment. Treat every circuit as live until proven dead and locked off. Isolation follows a lock-out/tag-out procedure: isolate, lock, prove dead with a tested instrument, and only then work.",
          "Cabling near power, EPMS and busbar work carries arc-flash and shock risk. Never assume a circuit is dead because a label says so — prove it. If you are not authorised and competent for the electrical task, you do not do it.",
        ],
      },
      {
        title: "Manual Handling & Site Conduct",
        body: [
          "Cable drums, containment sections and equipment are heavy and awkward. Assess the load, use mechanical aids where possible, keep the load close, bend at the knees and never twist under load. Team-lift what you cannot safely lift alone.",
          "On a live data centre floor, housekeeping is safety: keep routes clear, manage cable offcuts, and respect the client's site rules, permits and access control. An accident on a client's critical facility is a business risk as well as a personal one.",
        ],
      },
    ],
    quiz: [
      {
        q: "What is the Dutch legal safety framework engineers work under?",
        options: ["PRL Law 31/1995", "The Arbowet", "ANSI/TIA-606", "GDPR"],
        answer: 1,
      },
      {
        q: "What is the correct order of the hierarchy of control?",
        options: [
          "PPE first, then eliminate",
          "Eliminate, substitute, engineering, organisation, PPE",
          "PPE, engineering, eliminate",
          "There is no fixed order",
        ],
        answer: 1,
      },
      {
        q: "What does signing the RAMS briefing mean?",
        options: [
          "You have arrived on site",
          "You understand the controls and will follow them",
          "The job is finished",
          "You own the risk assessment",
        ],
        answer: 1,
      },
      {
        q: "Where does PPE sit in the hierarchy of control?",
        options: ["First line of defence", "Last line of defence", "It is not part of it", "Only for fibre work"],
        answer: 1,
      },
      {
        q: "Before using a mobile tower or MEWP, you must first:",
        options: ["Paint it", "Check its tag/inspection status", "Remove the guardrails", "Nothing"],
        answer: 1,
      },
      {
        q: "How should a circuit be treated until proven otherwise?",
        options: ["Dead", "Live", "Low voltage", "Irrelevant"],
        answer: 1,
      },
      {
        q: "What does lock-out/tag-out achieve?",
        options: [
          "Faster work",
          "Isolation that cannot be re-energised while you work",
          "Better cable management",
          "A tidy rack",
        ],
        answer: 1,
      },
      {
        q: "What is correct manual handling technique for a heavy load?",
        options: [
          "Bend at the back and twist",
          "Keep the load close, bend at the knees, don't twist",
          "Lift alone regardless of weight",
          "Lift quickly to reduce strain",
        ],
        answer: 1,
      },
      {
        q: "If a task changes from what the RAMS describes, you should:",
        options: [
          "Carry on as planned",
          "Stop and have the RAMS reviewed before continuing",
          "Ignore the RAMS",
          "Ask the client to sign",
        ],
        answer: 1,
      },
      {
        q: "Why is housekeeping a safety issue on a live data centre floor?",
        options: [
          "It looks professional only",
          "Clear routes and managed offcuts prevent trips, falls and incidents on a critical facility",
          "It speeds up cable pulling",
          "It is not a safety issue",
        ],
        answer: 1,
      },
    ],
  },

  {
    id: "access-control-infrastructure",
    code: "ACS-01",
    title: "Access Control Infrastructure",
    duration: "2–3 hrs",
    summary:
      "The physical security layer: readers, controllers, locks, the request-to-exit and door position chain, cabling and power, and integration with the wider security system. What a telecoms engineer needs to install and terminate access control correctly.",
    passMark: 75,
    modules: [
      {
        title: "What Access Control Does",
        body: [
          "Access control governs who can pass through a door, when, and leaves an auditable record of every event. On a data centre it is a core security system — controlling entry to the building, the data halls, cages and critical rooms.",
          "The system decides, at each door, whether to release the lock based on a valid credential and a schedule. Your job as an installer is to build the physical chain — reader, controller, lock, and monitoring — that makes that decision reliable and tamper-evident.",
        ],
      },
      {
        title: "Readers & Credentials",
        body: [
          "The reader is the point where a credential is presented — a card, fob, PIN, or increasingly a mobile or biometric credential. Common technologies include proximity and smart cards; secure sites favour encrypted smart-card standards over legacy proximity, which is easily cloned.",
          "Readers are typically wired back to a door controller (often over RS-485 or a secure equivalent such as OSDP, which supports encryption and supervision). Mounting height, weather rating for external doors, and cable segregation from high-voltage all matter for a clean install.",
        ],
      },
      {
        title: "Controllers & the Door Chain",
        body: [
          "The door controller is the decision-maker. It reads the credential, checks it against permissions and a schedule, and drives the lock. A single controller usually serves several doors, sited in a secure riser or IDF, not at the door itself.",
          "The controller connects up to the head-end platform (for example LenelS2 or Genetec) over the network. Losing that link should fail to a defined, safe state — controllers hold a local database so doors keep working during a network outage.",
        ],
      },
      {
        title: "Locks, REX & Door Position",
        body: [
          "The locking device holds the door. Magnetic locks (maglocks) hold by electromagnet and release when power is removed; electric strikes and mortice locks work differently. Fail-safe (unlocks on power loss) vs fail-secure (stays locked) is a life-safety decision driven by egress and fire strategy, never chosen at random.",
          "Two monitoring inputs complete the chain: the Request-to-Exit (REX) device signals a legitimate exit so the door isn't logged as forced, and the Door Position Switch (DPS) tells the controller whether the door is open or closed. Miswire either and you get false forced-door or held-open alarms.",
        ],
      },
      {
        title: "Cabling, Power & Containment",
        body: [
          "Access control uses a mix of cables: data/comms to the reader (e.g. OSDP over shielded twisted pair), lock power, REX and DPS. Volt drop on lock power over a long run is a real failure cause — size the conductor and locate the power supply accordingly.",
          "Power comes from a dedicated, monitored PSU, usually battery-backed so doors hold their security state during a mains failure. Segregate access-control cabling from high-voltage, respect containment fill and bend radius, and label every core — troubleshooting a door with unlabelled cores is a job no one thanks you for.",
        ],
      },
      {
        title: "Integration, Testing & Handover",
        body: [
          "Access control rarely stands alone: it integrates with intruder detection, CCTV and the building's fire alarm — on a fire signal, fail-safe doors on escape routes must release. Interlocks and mantraps add sequencing between paired doors.",
          "Commissioning tests every door: valid card grants, invalid card denies, REX releases cleanly, DPS reports correctly, forced-door and held-open alarms raise, and fire-release operates. The handover records each door's configuration and test result — the same evidence-based discipline as a telecoms certification.",
        ],
      },
    ],
    quiz: [
      {
        q: "What is the primary purpose of an access control system?",
        options: [
          "To power the data hall",
          "To govern who passes through a door and record every event",
          "To cool the servers",
          "To certify copper links",
        ],
        answer: 1,
      },
      {
        q: "Why do secure sites favour encrypted smart cards over legacy proximity cards?",
        options: [
          "They are cheaper",
          "Legacy proximity credentials are easily cloned",
          "They need no reader",
          "They are larger",
        ],
        answer: 1,
      },
      {
        q: "Which protocol supports encryption and supervision between reader and controller?",
        options: ["Wiegand only", "OSDP", "HTTP", "RJ45"],
        answer: 1,
      },
      {
        q: "Where is a door controller typically located?",
        options: [
          "On the outside of the door",
          "In a secure riser or IDF serving several doors",
          "Inside the lock",
          "At the reader",
        ],
        answer: 1,
      },
      {
        q: "What happens to a controller's doors during a network outage?",
        options: [
          "All doors unlock permanently",
          "They keep working from the controller's local database",
          "The reader powers off",
          "Nothing works",
        ],
        answer: 1,
      },
      {
        q: "What does a fail-safe lock do on power loss?",
        options: ["Stays locked", "Unlocks", "Sounds an alarm only", "Nothing"],
        answer: 1,
      },
      {
        q: "What does the Request-to-Exit (REX) device do?",
        options: [
          "Locks the door permanently",
          "Signals a legitimate exit so the door isn't logged as forced",
          "Powers the reader",
          "Reads the credential",
        ],
        answer: 1,
      },
      {
        q: "What does the Door Position Switch (DPS) report?",
        options: [
          "The credential number",
          "Whether the door is open or closed",
          "The lock power voltage",
          "The reader firmware",
        ],
        answer: 1,
      },
      {
        q: "Why is volt drop a concern on lock power runs?",
        options: [
          "It changes the card format",
          "Insufficient voltage at the lock over a long run causes failures",
          "It affects the CCTV",
          "It is not a concern",
        ],
        answer: 1,
      },
      {
        q: "On a fire alarm signal, what must fail-safe doors on escape routes do?",
        options: ["Lock down", "Release to allow egress", "Sound only", "Ignore the signal"],
        answer: 1,
      },
    ],
  },
  // ---- ADD FUTURE TRAININGS BELOW (labelling, commissioning, etc.) ----
] as const;

