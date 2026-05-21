---
name: Eternal Path Design System
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1c1c'
  surface-container: '#1f2020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e4e2e1'
  on-surface-variant: '#c4c7c7'
  inverse-surface: '#e4e2e1'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c8c6c5'
  primary: '#c8c6c5'
  on-primary: '#313030'
  primary-container: '#1a1a1a'
  on-primary-container: '#848282'
  inverse-primary: '#5f5e5e'
  secondary: '#e9c349'
  on-secondary: '#3c2f00'
  secondary-container: '#af8d11'
  on-secondary-container: '#342800'
  tertiary: '#ffb4ac'
  on-tertiary: '#690007'
  tertiary-container: '#3e0002'
  on-tertiary-container: '#e84a43'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb4ac'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#92030f'
  background: '#131313'
  on-background: '#e4e2e1'
  surface-variant: '#353535'
typography:
  headline-lg:
    fontFamily: Literata
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Literata
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Literata
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  stats-num:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  inventory_slot: 48px
  gutter: 8px
  panel_padding: 12px
  sidebar_width: 280px
---

## Brand & Style
The design system is engineered for a dark fantasy MMORPG environment, evoking the weight of ancient stone, the coldness of iron, and the prestige of gold. The visual direction is **Tactile and Skeuomorphic**, drawing inspiration from late-90s and early-2000s isometric RPGs. It prioritizes immersion through physical metaphors—buttons should feel like pressed metal, and panels should feel like carved slate.

The target audience seeks a "hardcore" aesthetic: high-contrast information displays, intricate border work, and a dense UI that maximizes functional screen real estate for 2D browser-based gameplay. The emotional response is one of grit, antiquity, and high-stakes adventure.

## Colors
The palette is rooted in a "Deep Slate" foundation to ensure maximum legibility for vibrant spell effects and item icons. 

- **Primary & Neutral:** Used for the base of all windows, sidebars, and background containers.
- **Accents:** Gold (#d4af37) is reserved for currency, active selection states, and "Legendary" grade headers. Crimson (#b22222) is used exclusively for health and high-alert combat warnings.
- **System Colors:** Exp-blue provides a stark contrast to the dark environment for progress tracking.
- **Rarity Tiering:** Items and loot must strictly follow the Common (Gray), Rare (Blue), and Epic (Purple) color mapping to facilitate instant inventory recognition.

## Typography
This design system employs a dual-font strategy to balance theme with utility. 

**Literata** is used for all narrative elements, quest headers, and location names. Its serif terminals provide the "Old World" feel necessary for a fantasy setting. 

**Inter** is utilized for all functional data: item stats, damage numbers, and inventory labels. It is chosen for its exceptional legibility at small sizes (11px-13px) within compact browser panels. Stat numbers should use the `stats-num` style with a slight shadow to pop against dark backgrounds.

## Layout & Spacing
The layout follows a **Fixed Grid** model optimized for browser heights. The inventory is the core of the layout, utilizing a rigid 48px square cell grid with 4px spacing. 

- **Main HUD:** Bottom-centered or split-corner status orbs/bars.
- **Sidebars:** Compact, fixed-width (280px) panels that slide from the right for Quest Logs, Social, and Character Stats.
- **Inventory:** A 5-column or 10-column fixed grid depending on the screen width.

The spacing rhythm is tight (based on a 4px module) to convey the density and richness typical of classic RPG interfaces.

## Elevation & Depth
Depth in the design system is achieved through **Stone Beveling** and **Inner Glows** rather than modern drop shadows. 

1.  **Level 0 (Floor):** Darkest charcoal (#1a1a1a) with a subtle grain texture.
2.  **Level 1 (Panels):** Raised slate (#2d2d2d) with a 1px "Chiseled" top border highlight and a 1px "Pit" bottom border.
3.  **Level 2 (Active Elements):** Recessed slots for inventory and equipment, using inner shadows to simulate a hole in the stone panel.
4.  **Overlays:** Modal windows use a 60% black backdrop blur to isolate the gameplay, with a heavy 2px gold bevel for "Epic" grade notifications.

## Shapes
The shape language is primarily **Sharp and Structural**. Standard buttons and containers use a subtle 4px (Soft) radius to prevent the UI from looking too "web-standard."

- **Inventory Cells:** Strict 0px (Sharp) to allow for seamless grid tiling.
- **Action Buttons:** 4px radius with a metallic "stamped" appearance.
- **Status Bars:** Rounded ends (Pill-shaped) only for the interior liquid/glass fill, while the containing stone frame remains sharp.

## Components

### Status Bars (HP/MP)
Health and Mana bars must feature a "liquid" fill effect with a top-down specular highlight to simulate glass. Use a slow-pulse animation on the health bar when below 20%.

### Inventory Slots
48x48px squares with a 1px inset border. Hover states should trigger a gold outer glow (#d4af37). Rarity is indicated by a colored 2px inner-border glow (e.g., Purple for Epic).

### Buttons
Primary actions use a "Gold-Leaf" style with a beveled texture. Secondary actions (Close, Cancel) use a "Forged Iron" look—darker gray with white text.

### Tooltips
High-density data blocks with a semi-transparent black background. Title of the item uses `headline-sm`, while stats use `stats-num` with color coding (Green for bonuses, Red for penalties).

### Input Fields
Deeply recessed "Stone-cut" fields. Text color is light gray to maintain the dark atmosphere, turning Gold on focus.