---
name: DevVault AI
colors:
  surface: '#161616'
  surface-dim: '#10131b'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#181c23'
  surface-container: '#1c2027'
  surface-container-high: '#262a32'
  surface-container-highest: '#31353d'
  on-surface: '#e0e2ed'
  on-surface-variant: '#c0c6d6'
  inverse-surface: '#e0e2ed'
  inverse-on-surface: '#2d3038'
  outline: '#8b91a0'
  outline-variant: '#414754'
  surface-tint: '#aac7ff'
  primary: '#aac7ff'
  on-primary: '#003064'
  primary-container: '#3e90ff'
  on-primary-container: '#002957'
  inverse-primary: '#005db8'
  secondary: '#e9b3ff'
  on-secondary: '#510074'
  secondary-container: '#7d01b1'
  on-secondary-container: '#e5a9ff'
  tertiary: '#ffb691'
  on-tertiary: '#552000'
  tertiary-container: '#eb6a12'
  on-tertiary-container: '#4a1b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00468d'
  secondary-fixed: '#f6d9ff'
  secondary-fixed-dim: '#e9b3ff'
  on-secondary-fixed: '#310048'
  on-secondary-fixed-variant: '#7200a3'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#793100'
  background: '#10131b'
  on-background: '#e0e2ed'
  surface-variant: '#31353d'
  bg-primary: '#0A0A0A'
  bg-secondary: '#111111'
  card: '#1C1C1E'
  elevated: '#252525'
  border: rgba(255, 255, 255, 0.08)
  divider: rgba(255, 255, 255, 0.05)
  success: '#30D158'
  warning: '#FFD60A'
  danger: '#FF453A'
  orange: '#FF9F0A'
  text-primary: '#FFFFFF'
  text-secondary: '#A1A1AA'
  text-muted: '#71717A'
  text-disabled: '#52525B'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 25.6px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar-width: 280px
  main-padding: 40px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

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