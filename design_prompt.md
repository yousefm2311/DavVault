[PROJECT: DevVault AI - Core Design System & Global Layout]

STRICT DESIGN LANGUAGE:
- Style: Premium Dark First Design (Elegant, Intelligent, Technical, Minimal)
- Principles: Large spacing, Clear hierarchy, Smooth spring animations (150ms-250ms), Keyboard-first experience.

COLOR TOKENS:
- Backgrounds: Primary #0A0A0A | Secondary #111111
- Surfaces: Surface #161616 | Card #1C1C1E | Elevated #252525
- Borders/Dividers: Border rgba(255,255,255,0.08) | Divider rgba(255,255,255,0.05)
- Text: Primary #FFFFFF | Secondary #A1A1AA | Muted #71717A | Disabled #52525B
- Accents: Blue #0A84FF | Success #30D158 | Warning #FFD60A | Danger #FF453A | Purple #BF5AF2 | Orange #FF9F0A

TYPOGRAPHY & RADII:
- Fonts: SF Pro Display (Inter fallback) | Monospace: JetBrains Mono (14px, Line-height: 1.6 for code)
- Radii: Cards 24px | Buttons/Inputs 16px | Search 20px | Modal 28px
- Shadows: Extremely soft, natural floating appearance. No heavy shadows.

APPLICATION LAYOUT STRUCTURE:
- Fixed Left Sidebar (Width: 280px)
- Top Header (Contextual Navigation & Breadcrumbs)
- Main Content Area (Scrollable, spacious padding: 40px)

SIDEBAR COMPONENTS:
- Top: DevVault AI Logo (Premium, intelligent icon)
- Navigation Items (Active state: subtle inner-glow, text #FFFFFF, Left accent indicator):
  Dashboard, Projects, Search, AI Chat, Snippets, Error Library, Reusable Systems, Developer DNA, Time Machine, Team Brain, Marketplace, Settings.
- Bottom Section: Profile Card, Storage Usage Visualizer, Premium Plan Badge, Collapse Button.


[PROJECT: DevVault AI - Dashboard & Command Palette]
*Inherit Core Design System Colors (#0A0A0A) and Radii (Cards: 24px)*

1. DASHBOARD HERO SECTION:
- Greeting: "Good Morning Ahmed 👋" (Hero 48px, Bold, #FFFFFF)
- Subtitle: "Your engineering memory is growing." (Secondary #A1A1AA)

2. CENTRAL COMMAND SEARCH BAR:
- Spotlight-style centered bar (Largest element). Radius: 20px. 
- Background: Glassmorphism effect overlaying content.
- Placeholder: "Search your engineering brain..."
- Right Side: Keyboard shortcut indicator badge [⌘ K] using Mono font.

3. STATISTICS CARDS (Grid Layout):
- Cards for: Projects, Files, Snippets, Errors Solved, Systems, AI Queries.
- Each Card Includes: Premium micro-icon, Big Number, Growth % text badge (Success #30D158), and a subtle mini sparkline graph (faded gradient fill).

4. RECENT ACTIVITY TIMELINE & AI SUGGESTIONS:
- Split Layout (60% Timeline / 40% AI Insights)
- Timeline shows activity stream with precise icons (Uploaded Project, Solved Error, etc.).
- AI Suggestions: Premium cards with titles like "You solved this issue before" or "Project health warning" accented with subtle Warning/Danger colors.

5. GLOBAL SEARCH OVERLAY (Command Palette - Raycast Style):
- Fullscreen blur background (`backdrop-filter: blur(20px)`).
- Instant filtering categories sidebar inside modal.
- Results items show: Icon + Title + Type badge + Project Tag + Date + Similarity Score percentage.


[PROJECT: DevVault AI - AI Chat & Monospace Code Workspace]
*Inherit Core Design System Colors (#0A0A0A) and Monospace Typography Rules*

LAYOUT: Three-Panel Split Window (20% Sources Panel | 40% AI Chat | 40% Code Preview)

1. LEFT: SOURCES PANEL
- Tree structure showing files, documentation, and error logs currently loaded into the AI context.

2. CENTER: AI CHAT INTERFACE
- User Messages: Right-aligned, dark elevated background (#1C1C1E), crisp text.
- Assistant Messages: Left-aligned, minimal border, no heavy card background.
- Elements: Clean Markdown parsing, logical step-by-step reasoning blocks, related source file chips at the bottom.
- Action Floating bar: Copy Code, Open File, Explain More, Save Snippet, Generate Similar.

3. RIGHT: CODE VIEWER & INSIGHTS (VSCode/Monaco Inspired)
- Editor: Dark theme matching #111111 perfectly. Line numbers, modern minimap on the right.
- Right AI Drawer: Collapsible panel showing: "Explain Code", "Dependencies", "Improvements", and "Security Analysis".



[PROJECT: DevVault AI - Knowledge & Interactive Graph Engine]
*Inherit Core Design System Colors (#0A0A0A) and Radii (Cards: 24px)*

1. KNOWLEDGE PAGE (Automated Docs):
- Clean, multi-column dashboard. Beautiful expandable cards for system architectures: Authentication, Database, APIs, Business Logic, Payments.
- Visual Code/Architecture blocks with quick toggles.

2. GRAPH VIEW (Interactive Mapping):
- Full canvas layout with a techy grid background dot pattern.
- Nodes represent: Controllers, Services, Models, Routes, Databases.
- Style: Neo-brutalist tech style. Node sizing is relative to file complexity.
- Connections: Animated vector lines with glowing gradient pulses showing active data dependency paths.
- Controls: Floating clean corner dock for Zoom, Pan, Mini Map, and Reset View. Clicking a node deep-links directly into the Code Viewer.




[PROJECT: DevVault AI - Libraries & System Blueprints]
*Inherit Core Design System Colors (#0A0A0A)*

1. SNIPPET LIBRARY (Grid Layout):
- Filtering chips at top (Authentication, MongoDB, JWT, Supabase, Payments).
- Snippet Card: Code preview box (max 5 lines, JetBrains Mono), Language badge (e.g., Dart, TypeScript), Tag row, Usage count, and quick-copy hover icon.

2. ERROR LIBRARY (Log Tracker):
- High-contrast, serious layout. Error Cards are color-coded via a subtle left border strip: Red (Critical), Yellow (Warning), Green (Resolved).
- Content: Large Error Title, Raw Error Message box, Root Cause analysis paragraph, AI-Generated Solution block, Project tag, and timestamp.

3. REUSABLE SYSTEMS PAGE:
- Premium enterprise-grade cards showcasing pre-built blueprint architectures.
- Includes: Functional dependency tree map, Complexity Score meter, Usage counters, and a primary Blue (#0A84FF) "Generate System" call-to-action button.


[PROJECT: DevVault AI - Developer Analytics & Timelines]
*Inherit Core Design System Colors (#0A0A0A) and Apple Health Design Style*

1. DEVELOPER DNA PAGE:
- Apple Health Dashboard aesthetic: Clean grids, high-contrast typography, zero clutter.
- Analytics Widgets: Developer Productivity Score, interactive Technology Breakdown radial chart, Most Used Languages, Skill Growth curve, Favorite Architecture pattern card, and Textual "Coding Style Analysis" (e.g., "Highly Modular, Strict Functional Preference").

2. TIME MACHINE PAGE:
- Cinematic historical vertical timeline with a smooth line connector running down the center.
- Top Sticky Bar: Year Selector & Month Selector.
- Content Nodes: Expandable snapshots of what you built, errors solved, and systems generated on that specific historical date. It should feel like browsing engineering memories.

3. TEAM BRAIN PAGE:
- Workspace dashboard showing active members with premium avatar stacks.
- Analytics tracking Company Memory Growth, shared component repositories, and an integrated "AI Company Chat" access point.


[PROJECT: DevVault AI - Utility States & Mobile Adaptation]
*Inherit Core Design System Colors (#0A0A0A)*

1. EMPTY STATES:
- Layout: Perfectly centered minimal composition. No generic clipart.
- Graphics: Premium, thin-line tech illustrations or geometric abstract patterns matching the dark aesthetic.
- Text: "No projects yet", "Upload your first project to start building your engineering memory." + Primary action button.

2. LOADING STATES (Skeleton Loader):
- No spinning wheels. Use skeleton blocks mimicking actual UI text lines and cards.
- Animation: Smooth, linear shimmer/pulse effect running left-to-right with a duration of 250ms.

3. MOBILE ADAPTATION (Responsive Rules):
- Sidebar collapses completely into a slide-out hamburger menu or transfers key items to a premium Bottom Tab Navigation Bar.
- Floating Action Button (FAB) for the Command Palette Search (⌘K replacement).
- All cards grid layout switches seamlessly to 1-column stack while retaining the 24px corner radius and spacious breathing padding.



