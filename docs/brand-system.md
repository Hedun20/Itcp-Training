# ITCP Training brand system

The local implementation is derived from the supplied ITCP/Todor brand contract. ITCP Training is the product name and ITCP Europe is the public identity.

## Theme tokens

| Token | Dark | Light |
| --- | --- | --- |
| Background | `#050507` | `#fff8fc` |
| Background raised | `#080a0f` | `#f6f0f7` |
| Panel | `rgba(16,18,27,.74)` | `rgba(255,255,255,.74)` |
| Panel raised | `rgba(24,26,36,.82)` | `rgba(255,255,255,.88)` |
| Text | `#f7f8fb` | `#19121b` |
| Muted text | `#9ea4b3` | `#6d6170` |
| Primary | `#ff1493` | `#ff1493` |
| Primary raised | `#ff4eb7` | `#ff4eb7` |
| Violet | `#8b5cf6` | `#8b5cf6` |
| Information | `#22d3ee` | `#0891b2` |
| Success | `#6ee7a8` | `#14845a` |

The radius scale is 16, 24, and 34 pixels, with 14-pixel controls and fully rounded pills. Elevation uses layered translucent borders, inset highlights, blur, and restrained magenta/violet glow rather than generic opaque drop shadows.

The type stack is Inter followed by native UI sans-serif fonts. Text remains readable if Inter is unavailable.

## Interaction rules

- The primary button uses the controlled liquid gradient `#f7078c -> #ff4eb7 -> #b719ee` and has clear default, hover, focus, active, loading, and disabled states.
- Secondary actions are filled glass controls, not low-contrast outlines. Ghost actions are reserved for low priority.
- Keyboard focus uses a visible three-pixel green ring with a four-pixel offset.
- Active navigation is represented by both shape and glow, not color alone.
- Real progress and result values remain visually calm. Motion belongs to state changes, hierarchy, and slow ambient backgrounds.
- Pointer effects are enhancement only. The UI remains complete with a keyboard, touch, or reduced-motion preference.
- Destructive actions require confirmation in an application modal rather than a blocking browser alert.

## Theme behavior

The document root carries `data-theme="dark"` or `data-theme="light"`. The persisted preference key is exactly `itcp-branding-theme`. Both themes provide semantic colors rather than relying on global inversion.

`prefers-reduced-motion: reduce` disables CSS animations, smooth scrolling, and JavaScript-driven pointer or tilt work. Content and controls never depend on an animation completing.

## Logo treatment

The supplied transparent PNG contains a magenta globe with a black `ITCP EUROPE` wordmark. The full lockup is appropriate on a light surface. Dark shells use a cropped globe treatment or place the full lockup on an intentionally light badge so the wordmark keeps sufficient contrast. No alternate logo was supplied.
