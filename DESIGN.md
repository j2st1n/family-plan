---
version: alpha
name: Family Plan Apple iOS Design System
description: Authentic Apple iOS Human Interface Guidelines (HIG) design system for family self-discipline and habit formation.
colors:
  primary: "#0071E3"
  primary-hover: "#0062C4"
  text-primary: "#1D1D1F"
  text-secondary: "#6E6E73"
  canvas: "#F5F5F7"
  card: "#FFFFFF"
  card-subtle: "#F5F5F7"
  separator: "#C6C6C8"
  danger: "#D70015"
  danger-text: "#FFFFFF"
  success: "#1C7332"
  switch-track-on: "#34C759"
  switch-off: "#E9E9EB"
  star: "#A65600"
  star-bg: "#FFF7EB"
  protect: "#007A75"
  protect-bg: "#E5F9F8"
  capsule-bg: "#E5E5EA"
  white: "#FFFFFF"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', sans-serif"
    fontSize: 1.85rem
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif"
    fontSize: 1.05rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif"
    fontSize: 0.95rem
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif"
    fontSize: 0.78rem
    fontWeight: 500
    lineHeight: 1.4
  micro-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif"
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: 8px
  md: 14px
  lg: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: 10px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.card-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 8px
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.sm}"
    padding: 8px
  button-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: 8px
  card-grouped:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 16px
  text-helper:
    textColor: "{colors.text-secondary}"
  card-canvas:
    backgroundColor: "{colors.canvas}"
  segmented-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  stepper-button:
    backgroundColor: "{colors.capsule-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    size: 32px
  switch-active:
    backgroundColor: "{colors.switch-track-on}"
    rounded: "{rounded.pill}"
  switch-inactive:
    backgroundColor: "{colors.switch-off}"
    rounded: "{rounded.pill}"
  time-capsule:
    backgroundColor: "{colors.capsule-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 6px
  star-badge:
    backgroundColor: "{colors.star-bg}"
    textColor: "{colors.star}"
    rounded: "{rounded.pill}"
    padding: 4px
  protect-badge:
    backgroundColor: "{colors.protect-bg}"
    textColor: "{colors.protect}"
    rounded: "{rounded.pill}"
    padding: 4px
  table-separator:
    backgroundColor: "{colors.separator}"
    height: 0.5px
---

## Overview

The Family Plan design system establishes an authentic Apple iOS Human Interface Guidelines (HIG) visual and interaction standard for family self-discipline, routine tracking, and positive reinforcement.

Rooted in clarity, rhythm, and warmth, the interface eliminates clinical enterprise ERP metaphors, cold financial risk-control terminology, and disconnected desktop dialog patterns. The user experience centers on mutual trust, emotional resonance, and frictionless touch interactions across Parent Web (desktop & mobile browser) and Child PWA (iPad & tablet).

### Guiding Principles

1. **Clarity & Rhythm (HIG Inset Grouped Hierarchy):** Surfaces are organized into Inset Grouped TableViews with a neutral canvas (`#F5F5F7`), pure white cards (`#FFFFFF`), borderless direct text inputs, and 0.5px left-inset hairline dividers (`#C6C6C8`).
2. **Modal Symmetry & Ergonomic Discipline:** Modals and bottom sheets follow Apple's canonical three-part navigation bar: Left Cancel/Close, Centered Semibold Title, and Right Primary Action. Redundant full-width submit buttons at the bottom of modal sheets are strictly eliminated, liberating visual breathing room and virtual keyboard headroom.
3. **Native iOS Control Lexicon:** Browser-native dropdowns (`<select>`) and arbitrary raw inputs are replaced with native iOS controls: Segmented Controls for choices ≤ 5, Steppers (`−` / `+`) for bounded increments, Apple-standard green sliding Switches (51x31px), and subtle Time Capsules (`rgba(118, 118, 128, 0.12)`).
4. **Warm UX Copywriting Baseline:** Ruthlessly purges banking risk control ("风控", "流水", "纠偏", "达标阈值"), warehouse inventory ("库存", "上架", "下架"), and bureaucratic pronouns ("您", "审核"). Replaces them with loving, encouraging, family-centric language ("规则设置", "变动记录", "手动调减", "每日达标标准", "提供数量", "添加心愿", "需家长点赞确认").

## Colors

- **Primary (`#0071E3`):** Apple System Blue. The principal interaction tint for active items, navigation buttons, and focus accents.
- **Primary Hover (`#0077ED`):** Subtle hover/press elevation tint for interactive blue elements.
- **Text Primary (`#1D1D1F`):** Deep charcoal black. Used for high-contrast headlines, card labels, and primary data values.
- **Text Secondary (`#86868B`):** Neutral iOS system gray. Used for secondary labels, section footers, and hints.
- **Canvas (`#F5F5F7`):** Apple standard grouped background gray. Provides a soft, glare-free backdrop for white grouped cards.
- **Card (`#FFFFFF`):** Pure white container for Inset Grouped cards, modal sheet bodies, and segmented control active states.
- **Card Subtle (`#F5F5F7`):** Elevated neutral container for secondary badges and inactive controls.
- **Separator (`#C6C6C8`):** 0.5px hairline divider between grouped card rows with a 16px left inset.
- **Success (`#34C759`):** Apple System Green. Dedicated exclusively to active switch tracks and completion achievements.
- **Danger (`#FF3B30`):** Apple System Red. Reserved for destructive actions (e.g. Delete Child, Remove Task) and critical error banners.
- **Star Gold (`#FF9500`):** Apple System Amber Gold for reward stars and star balance badges.
- **Star Background (`#FFF7EB`):** Warm amber tint for star badge chips and active celebration highlights.
- **Protect Cyan (`#00C7BE`):** Apple System Teal for streak freeze protection cards and freeze status indicators.
- **Protect Background (`#E5F9F8`):** Soft teal tint for freeze card chips and holding quota badges.
- **Capsule Background (`rgba(118, 118, 128, 0.12)`): Apple standard dynamic fill for time/date pickers, steppers, and muted pills.

## Typography

Typographic scale follows Apple iOS San Francisco font hierarchy with optimized Chinese fallback:

- **Large Title (`1.85rem` / `30px`, Bold 750, `-0.025em`):** Top-level page headers (e.g., "今日看板", "我的设置").
- **Headline (`1.05rem` / `17px`, Semibold 600, `-0.015em`):** Modal navigation bar titles and card group section headers.
- **Body (`0.95rem` ~ `1.0rem` / `15-16px`, Regular 400, Line-height 1.5):** Row titles, direct input fields, and explanatory notes.
- **Caption (`0.78rem` / `12.5px`, Medium 500, Line-height 1.4):** Auxiliary timestamps, duration tags, and section footer helper text.
- **Micro-Label (`0.75rem` / `12px`, Bold 600, Uppercase, `+0.02em`):** Inset Grouped uppercase headers (e.g., "时间安排 (可选)", "已设置的休假").
- **Tabular Numerals (`font-variant-numeric: tabular-nums`):** Mandatory on all monetary/star values, timer countdowns, and 6-digit pair codes to prevent layout jitter.

## Layout

- **Viewport Gutters:** Strict 16px horizontal margins (`padding: 0 16px`) on mobile viewports (< 768px). Maximum desktop container width 720px for centered, thumb-friendly ergonomic focus.
- **Row Heights:** Minimum 44pt (44px) touch target height for all interactive table rows, stepper buttons, and segmented items. Recommended row height 48px to 52px for primary form rows.
- **Modal Drawer Geometry:**
  - Bottom sheet on mobile: docked to bottom, full width, rounded top corners (`border-radius: 20px 20px 0 0`).
  - Centered modal on tablet/desktop (≥ 768px): centered with backdrop blur (`backdrop-filter: blur(20px)`), `max-width: 600px`, `border-radius: 20px`.
  - Handle Bar: 36x5px, centered, `background: #D2D2D7`, `border-radius: 2.5px`, margin `10px auto 2px auto`. Hidden on desktop viewports.
- **Anti-Wrap Rules (`white-space: nowrap`):** Single-character orphan line breaks and fragmented number badges are forbidden. Weekday 7-day pill grids, star quantities, and currency tags must enforce `white-space: nowrap` and `flex-shrink: 0`.

## Elevation & Depth

- **Surface Neutrality:** Avoid saturated gradient backgrounds or heavy multi-layered box shadows.
- **Grouped Shadow:** Subtle Apple card shadow `0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)` on grouped cards.
- **Modal Backdrop:** `rgba(0, 0, 0, 0.35)` with hardware-accelerated `backdrop-filter: blur(20px) saturate(180%)`.
- **Alert Dialog:** Translucent milky glass background (`rgba(255, 255, 255, 0.88)` on iOS/Child PWA or pure `#FFFFFF` with glass border), 16-20px corner radius, centered typographic alignment.

## Shapes

- **Radius Scale:**
  - `sm` (`8px`): Steppers, time capsule inputs, segmented items, small tag badges.
  - `md` (`14px`): Inset Grouped TableView cards, routine task cards, wish cards.
  - `lg` (`16-20px`): Modal sheets, floating action containers, alert dialogs.
  - `pill` (`999px`): Switches, counter chips, action pills, segmented control outer tracks.
- **Dividers:** 0.5px solid lines (`#C6C6C8` or `rgba(60, 60, 67, 0.15)`). Always inset 16px from the left edge inside Inset Grouped cards to align with text margins; never span full width across outer card borders.
- **Dashed Borders Forbidden:** Dashed borders (`1.5px dashed`) are explicitly eliminated from the design system. Replaced with soft tinted fills (`var(--accent-light)`) and hairline solid borders.

## Components

### 1. Canonical Modal Navigation Bar (`.ios-sheet-header`)
- **Structure:** 3-part layout (Left: Cancel/Close text button, Center: Bold title 17px/600, Right: Action text button 17px/650).
- **Behavior:** Title is centered (`position: absolute; left: 0; right: 0; text-align: center; pointer-events: none`). Left and right buttons have `z-index: 1` with minimum 44x44pt touch area.
- **Discipline:** No redundant primary button at the bottom of the modal. Actions commit directly from the top-right button.

### 2. Inset Grouped TableView (`.ios-grouped-card`)
- **Structure:** Pure white card with 14px border radius. Row items stacked vertically.
- **Inputs:** Direct borderless inputs with transparent background, matching parent font and text color.
- **Dividers:** 0.5px hairline divider with 16px left margin between rows. No divider below the final row.
- **Micro-labels & Footers:** Uppercase group labels (`0.78rem`, bold 600) placed 16px from the left above the card. Explanatory footers (`0.75rem`, muted) placed 16px from the left below the card.

### 3. iOS Segmented Control (`.ios-segmented-control`)
- **Container:** `background: rgba(118, 118, 128, 0.12)`, `border-radius: 9px`, `padding: 2px`.
- **Items:** Flex equal width (`flex: 1`), `padding: 6px 12px`, `font-size: 0.85rem`, `white-space: nowrap`.
- **Active State:** `#FFFFFF` pill background, `box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)`, `font-weight: 600`, `color: #000000`.

### 4. iOS Stepper (`.ios-stepper-btn`)
- **Geometry:** 32x32px circular button with subtle gray fill `rgba(118, 118, 128, 0.12)`.
- **Action:** `−` and `+` symbols in 16px bold font. Touch active scale transition.
- **Display:** Centered tabular number between buttons with minimum 44px display width.

### 5. iOS Switch (`.ios-switch`)
- **Track:** 51px width, 31px height, rounded 31px pill. Inactive: `#E9E9EB`; Active: `#34C759`.
- **Thumb:** 27px circular white `#FFFFFF` knob with `box-shadow: 0 3px 8px rgba(0,0,0,0.15)`.
- **Animation:** Smooth 0.25s cubic-bezier horizontal translation (`transform: translateX(20px)`).

### 6. Time & Date Capsule (`.ios-time-input`)
- **Geometry:** Pill/squircle container with `border: none`, `background: rgba(118, 118, 128, 0.12)`, `border-radius: 8px`, `padding: 6px 10px`.
- **Typography:** `font-weight: 600`, `font-variant-numeric: tabular-nums`.

## Do's and Don'ts

### Do's
- **Do** place primary action buttons in the top-right corner of modal navigation bars and cancel/close buttons in the top-left.
- **Do** use Inset Grouped cards with borderless direct inputs and 0.5px indented separators for all multi-row forms.
- **Do** replace native browser `<select>` dropdowns with iOS Segmented Controls (for ≤ 5 options) or Inset Grouped checkmark rows.
- **Do** use warm, respectful, parent-child bonding language ("规则设置", "变动记录", "手动调减", "提供数量", "需家长点赞确认").
- **Do** enforce `font-variant-numeric: tabular-nums` and `white-space: nowrap` on numbers, badges, and weekday selectors.

### Don'ts
- **Don't** render dual primary buttons (e.g. top-right "添加" combined with bottom full-width "确认添加").
- **Don't** use browser-native `<select>` with default black double-arrows or native checkboxes with raw browser styling.
- **Don't** use dashed borders (`1.5px dashed`), multi-color rainbow gradients, or cartoonish raw emojis in functional buttons.
- **Don't** use cold financial, banking, or ERP jargon ("风控", "流水", "纠偏", "库存", "上架", "下架", "达标阈值", "免死金牌").
- **Don't** allow single characters to wrap awkwardly onto new lines (orphan words).
