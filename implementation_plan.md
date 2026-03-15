# 🏔️ Visual Overhaul — Make the 3D Portfolio Look Professional

## Problem Statement

The current 3D mountain portfolio uses primitive geometries (boxes, cones, spheres) for everything — trees, character, rocks, campfire. The terrain is a heightmap which is correct, but every prop on it looks like a placeholder. The user wants it to look as polished as **Bruno Simon's portfolio** (https://bruno-simon.com/), which uses custom Blender models with a cohesive low-poly art style.

### Current State

| Component | Current Implementation | Problem |
|---|---|---|
| **Terrain** | PlaneGeometry heightmap (150×150 segments) with vertex colors | ✅ Decent — keep this |
| **Trees** | Stacked cones + cylinders | ❌ Looks like a 2005 tutorial |
| **Character** | Stacked boxes with limb animation | ❌ Minecraft-grade placeholder |
| **Campfire** | Cone flames + sphere stones | ❌ Not convincing |
| **Rocks** | DodecahedronGeometry | 🟡 Passable but generic |
| **Bushes** | IcosahedronGeometry spheres | ❌ Blobs |
| **Flowers** | Tiny sphere dots | ❌ Invisible |
| **Post-processing** | Only ACES tone mapping + fog | ❌ No bloom, vignette, or color grading |
| **Water** | None | ❌ Missing |
| **Skybox** | Stars only, dark background | ❌ No gradient sky, no clouds |

### Key Files

- [Mountain.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Mountain.tsx) — Terrain, props, hiker, trail generation (483 lines)
- [Scene.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Scene.tsx) — Camera, overlays, lighting, composition (550 lines)
- [Experience.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Experience.tsx) — Canvas wrapper (34 lines)
- [index.css](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/index.css) — UI styling (263 lines)
- [package.json](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/package.json) — Dependencies

---

## User Review Required

> [!IMPORTANT]
> **3D Models are REQUIRED to look good.** The procedural primitives (boxes, cones) will never look professional. The user needs to download model packs OR the implementing agent must find direct CDN URLs to GLB files.

> [!WARNING]
> **Model Download Options (one of these MUST happen):**
> 1. **User downloads manually** from [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) or [Quaternius](https://quaternius.com/packs/ultimatenature.html) and places GLB files in `public/models/`
> 2. **Agent finds direct CDN/GitHub links** to CC0 GLB files (e.g., from `market.pmnd.rs` CDN, PMNDRS assets, or public GitHub repos)
> 3. **Install `@pmndrs/assets`** — provides some models via `import('@pmndrs/assets/models/...')`
> 4. **Use Sketchfab API** — Some models have direct download URLs via the Sketchfab Data API

---

## Proposed Changes

### Phase 1: Post-Processing Pipeline (Biggest visual impact, no models needed)

This alone will transform the scene from "flat dev project" to "cinematic portfolio".

#### [MODIFY] [Experience.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Experience.tsx)

**Install:** `npm install @react-three/postprocessing postprocessing`

Add `EffectComposer` with these effects:

```tsx
import { EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'

// Inside Canvas, after ScrollControls:
<EffectComposer>
  <Bloom 
    luminanceThreshold={0.9} 
    luminanceSmoothing={0.4}
    intensity={0.8}
    mipmapBlur
  />
  <Vignette 
    offset={0.3} 
    darkness={0.7} 
    blendFunction={BlendFunction.NORMAL}
  />
  <ChromaticAberration 
    offset={[0.0005, 0.0005]}
    blendFunction={BlendFunction.NORMAL}
  />
  <ToneMapping mode={ToneMappingMode.AGX} />
</EffectComposer>
```

Also update:
- Background to gradient sky color: `#1a1520` (dark purple-blue instead of gray)
- Fog color to match: `#1a1520`
- Increase `toneMappingExposure` to `1.1`

---

### Phase 2: Gradient Sky + Clouds + Water

#### [MODIFY] [Scene.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Scene.tsx) — Environment component

Replace the current `Environment` function with:

1. **Gradient Sky Dome** — Large sphere with a shader material that blends from deep navy at the top (`#0a0e1a`) → warm orange horizon (`#ff8844`) → purple-pink midband (`#cc6688`). This creates a permanent sunset/dusk atmosphere.

2. **Animated Clouds** — Use `@react-three/drei`'s `Cloud` component or procedural soft plane meshes with billboard behavior scattered above the horizon.

3. **Water plane** — A flat plane at y=0 (or slightly below the lowest terrain point) with:
   - `MeshStandardMaterial` with high metalness (0.9), low roughness (0.1)
   - Color: dark teal `#1a3a4a`
   - Subtle `EnvMap` reflection from the sky dome
   - OR use drei's `<MeshReflectorMaterial>` for real reflections

4. **Keep existing lights** but increase warm tones further.

---

### Phase 3: 3D Models (THE critical visual upgrade)

> [!CAUTION]
> Without this phase, the portfolio will always look like a code demo, not a portfolio.

#### [NEW] Model Loading Infrastructure

Create `public/models/` directory and add these models. **Strategy for obtaining models (in priority order):**

**Option A — `@pmndrs/assets` (easiest, npm install)**
```bash
npm install @pmndrs/assets
```
Then in code:
```tsx
import { Suzi } from '@pmndrs/assets/models/suzi.glb'
// Limited selection but zero-friction
```

**Option B — Direct GitHub CDN URLs (no download needed)**
Search GitHub repos for CC0 GLB files:
```
https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/...
https://raw.githubusercontent.com/pmndrs/market-assets/main/...
```

**Option C — market.pmnd.rs CDN (best quality)**
Browse https://market.pmnd.rs, find models, and use their CDN URLs directly in `useGLTF()`:
```tsx
const { scene } = useGLTF('https://market-assets.fra1.cdn.digitaloceanspaces.com/market-assets/models/tree-spruce/model.glb')
```

**Option D — User downloads from these CC0 sources:**
| Source | Type | URL |
|---|---|---|
| Kenney Nature Kit | Trees, rocks, plants, paths | https://kenney.nl/assets/nature-kit |
| Kenney Animated Characters | Animated low-poly people | https://kenney.nl/assets/animated-characters |
| Quaternius Ultimate Nature | Trees, bushes, flowers, rocks | https://quaternius.com/packs/ultimatenature.html |
| Quaternius Animated Characters | Walking/idle animated characters | https://quaternius.com/packs/ultimateanimatedcharacters.html |
| Quaternius Medieval | Bridges, fences, houses, props | https://quaternius.com/packs/ultimatemedievalpack.html |
| KayKit Adventurers | Stylized RPG characters | https://kaylousberg.itch.io/kaykit-adventurers |

#### [MODIFY] [Mountain.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Mountain.tsx) — Replace procedural props with GLB models

Replace every procedural component with `useGLTF`:

```tsx
import { useGLTF } from '@react-three/drei'

function Tree({ position, scale, variant }: TreeProps) {
  const { scene } = useGLTF('/models/tree-pine.glb')
  return <primitive object={scene.clone()} position={position} scale={scale} />
}
```

**Models needed (minimum viable set):**
1. 🌲 **Pine tree** (2-3 variants)
2. 🌳 **Deciduous tree** (2 variants)
3. 🪨 **Rock** (3 variants: small, medium, large)
4. 🌿 **Bush** (2 variants)
5. 🧑 **Character** with walk animation (replaces box-man)
6. 🏕️ **Campfire** with stone ring
7. 🪧 **Signpost** with readable text
8. 🌸 **Flowers/plants** (2 variants)

**Nice to have:**
- 🏠 Small cabin/shelter at base camp
- 🌉 Wooden bridge
- ⛺ Tent
- 🦌 Animated deer or birds

#### Animated Character (Hiker)

If using a GLTF model with embedded animations:
```tsx
import { useGLTF, useAnimations } from '@react-three/drei'

function Hiker() {
  const { scene, animations } = useGLTF('/models/character.glb')
  const { actions } = useAnimations(animations, scene)
  
  useEffect(() => {
    actions['Walk']?.play()
  }, [actions])
  
  return <primitive object={scene} scale={0.5} />
}
```

---

### Phase 4: Enhanced Terrain & Trail

#### [MODIFY] [Mountain.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Mountain.tsx) — Terrain improvements

1. **Texture the terrain** instead of vertex colors:
   - Use a grass texture for low altitudes
   - Rock texture for high altitudes  
   - Blend between them using a custom shader or `MeshStandardMaterial` with a `map`
   - Free textures from: https://ambientcg.com/ or https://polyhaven.com/textures

2. **Better trail geometry**:
   - Current `TubeGeometry` for the trail path is good
   - Add **stone steps** along the trail (small box meshes placed at intervals)
   - Add **trail edges** with small rocks or wooden logs

3. **Increase terrain resolution** from 150 to 200 segments for smoother slopes

4. **Add terrain detail noise** — more fine-grained variation at close range

---

### Phase 5: Atmospheric Polish

#### [MODIFY] [Scene.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Scene.tsx)

1. **Volumetric fog layers** — Add 2-3 semi-transparent planes at different heights with scrolling cloud/fog textures to create depth layers

2. **Particle upgrades**:
   - Current fireflies are just `Points` — make them larger, warmer, with additive blending
   - Add **dust motes** that float in the warm light near the character
   - Add **embers** rising from the campfire (small upward-moving particles)

3. **Dynamic lighting** — Campfire light should flicker (vary `intensity` and `color` slightly per frame)

4. **Sound (optional)** — Use `@react-three/drei`'s `PositionalAudio` for ambient wind, campfire crackling

---

### Phase 6: Camera & Animation Polish

#### [MODIFY] [Scene.tsx](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/components/Scene.tsx) — CameraRig

1. **Cinematic camera path** — Instead of always behind the character:
   - At base camp: wider establishing shot
   - Mid-mountain: tighter follow cam
   - Summit: dramatic pull-back with the mountain visible below

2. **Camera smoothing** — Current lerp factor is `0.04`, which is okay but could use:
   - `THREE.MathUtils.damp` for framerate-independent smoothing
   - Slight camera shake/sway for life

3. **Parallax layers** — Distant background elements (mountains silhouettes) that move slower than foreground, creating depth

---

### Phase 7: UI Polish

#### [MODIFY] [index.css](file:///c:/Users/AH01/Coding%20Projects/ASTi/Portfolio/src/index.css)

1. **Glass morphism panels** — The zone panels are already glass-like but need:
   - Slightly more blur (`blur(24px)`)
   - Subtle border glow matching the zone's crystal color
   - Animated entry (scale + fade, not just fade)

2. **Typography** — Add Google Fonts import for `Outfit` and `Inter` (currently referenced but may not be loaded)

3. **Progress bar** — Make it glow with a subtle trail effect

4. **Loading screen** — More dramatic with a mountain silhouette SVG and smooth progress animation

---

## Implementation Priority Order

| Priority | Phase | Impact | Effort | Dependencies |
|---|---|---|---|---|
| **1** | Post-processing (Bloom, Vignette) | 🔥🔥🔥 HUGE | Low | `npm install` only |
| **2** | Gradient sky + water plane | 🔥🔥🔥 HUGE | Medium | None |
| **3** | 3D Models | 🔥🔥🔥🔥 THE GAME CHANGER | High | Models needed |
| **4** | Atmospheric particles/fog layers | 🔥🔥 Big | Medium | None |
| **5** | Camera improvements | 🔥 Good | Low | None |
| **6** | Terrain texturing | 🔥🔥 Big | High | Textures needed |
| **7** | UI polish | 🔥 Good | Low | None |

---

## Verification Plan

### Automated Tests
```bash
npx tsc --noEmit           # TypeScript compiles clean
npm run build              # Production build succeeds
```

### Visual Verification
1. Open `http://localhost:5173` in browser
2. Check no console errors (especially no `ReferenceError` or R3F hook errors)
3. Scroll through all 5 zones and verify:
   - Models render correctly
   - Overlays appear/disappear at correct scroll positions
   - Character walks on the terrain surface
   - Post-processing effects are visible (bloom on emissive materials, vignette at edges)
4. Check performance — should maintain 60fps on desktop

### Before/After Screenshots
Take screenshots at scroll positions: 0%, 25%, 50%, 75%, 100% before and after each phase.

---

## Dependencies to Install

```bash
npm install @react-three/postprocessing postprocessing
# If using @pmndrs/assets:
npm install @pmndrs/assets
```

## Quick Wins (Can be done RIGHT NOW without models)

1. ✅ Add post-processing (Bloom + Vignette) — instant visual upgrade
2. ✅ Add gradient sky dome — replaces the dark void
3. ✅ Add water plane at base — adds depth and reflections
4. ✅ Increase firefly size and warm glow
5. ✅ Add subtle camera sway
