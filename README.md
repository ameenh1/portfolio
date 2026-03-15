# 🏔️ Ameen Harandi — 3D Mountain Portfolio

An immersive 3D portfolio experience built with React, Three.js, and TypeScript. Navigate up a procedurally generated mountain to discover skills, projects, hackathon awards, and contact information.

> **[Live Demo →](https://ameenh1.github.io/portfolio)** *(deploy link pending)*

---

## ✨ Features

- **3D Mountain Climbing Experience** — Scroll-driven journey up a procedurally generated mountain with multi-octave FBM noise for realistic terrain
- **Stylized Toy Hiker** — Animated character with walking limbs, beanie hat, backpack, and hiking pole
- **3rd-Person Camera** — Camera follows the hiker from behind/above, inspired by [Bruno Simon's portfolio](https://bruno-simon.com/)
- **5 Discovery Zones** — Base Camp, Workshop (Skills), Launchpad (Projects), Trophy Ridge (Awards), and the Summit (Contact)
- **Atmospheric Environment** — Exponential fog, ACES filmic tone mapping, stars, fireflies, animated campfire
- **Trail Props** — Visible walkable trail, campfire at base camp, signposts along the path, glowing zone markers
- **Animated UI Panels** — Glassmorphism overlay panels that fade in/out based on scroll position
- **Progress Indicator** — Top progress bar and scroll-to-explore hint
- **Mobile Responsive** — Works on both desktop and mobile with scroll/touch input

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 19, TypeScript 5.9 |
| **3D Engine** | Three.js (r183), @react-three/fiber 9, @react-three/drei 10 |
| **Styling** | Tailwind CSS 4, Vanilla CSS |
| **Animation** | Framer Motion, Three.js useFrame |
| **Build** | Vite 8 |
| **Linting** | ESLint 9, typescript-eslint |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/ameenh1/portfolio.git
cd portfolio

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint for code quality

---

## 📁 Project Structure

```
src/
├── App.tsx                 # Root shell with loading screen
├── index.css               # Global styles, zone panels, loading UI
├── main.tsx                # Entry point
└── components/
    ├── Experience.tsx       # R3F Canvas, fog, ScrollControls
    ├── Scene.tsx            # Camera rig, zone overlays, trail, HUD
    ├── Mountain.tsx         # Procedural terrain, hiker, campfire, props
    └── LoadingScreen.tsx    # Animated loading screen with progress bar
```

### Key Components

- **`Experience.tsx`** — Sets up the Three.js canvas with exponential fog, ACES tone mapping, and 6-page scroll controls
- **`Scene.tsx`** — Orchestrates the 3D-person camera following a trail spline, zone content overlays, and all interactive elements
- **`Mountain.tsx`** — Procedural cone geometry with multi-octave FBM noise displacement, altitude-based coloring, trees, rocks, fireflies, and the animated hiker character
- **`LoadingScreen.tsx`** — Handles initial loading state with animated progress bar

### Data Flow

1. **Scroll Input** → `ScrollControls` updates offset value (0-1)
2. **Offset Value** drives:
   - Camera position/lookat (`CameraRig`)
   - Hiker position on trail (`HikerOnTrail`)
   - Zone panel visibility (`ZoneOverlays`)
   - Progress bar width (`ProgressBar`)
   - Scroll hint opacity (`ScrollHint`)

3. **Terrain Generation**:
   - `generateTrailCurve()` creates spline path up mountain
   - `getTerrainHeight()` samples noise functions for elevation
   - Geometry vertices displaced using height function
   - Colors calculated per vertex based on altitude/slope/noise

---

## 🏕️ Content Zones

| Zone | Scroll % | Description |
|------|----------|-------------|
| **Base Camp** | 0–16% | Welcome message, intro, and tech tags |
| **Workshop** | 16–36% | Skills grid (Frontend, Backend, AI & DevOps) |
| **Launchpad** | 36–56% | Project cards (Zarnite, Epilepsy Detection, etc.) |
| **Trophy Ridge** | 56–76% | Hackathon awards and achievements |
| **Summit** | 82–100% | Contact links (GitHub, LinkedIn, Email) |

---

## 🔧 Development Guidelines

### Code Conventions
- **TypeScript**: Strict typing with interfaces for props
- **React**: Functional components with hooks (`useState`, `useEffect`, `useRef`)
- **File Organization**: Feature-based grouping in `components/`
- **Naming**: PascalCase for components, camelCase for variables/functions
- **Constants**: UPPER_CASE for exported constants
- **Comments**: Section headers with `════` delimiters

### Performance Considerations
- Use `useMemo` for expensive calculations
- Create geometries once with `useMemo` for reuse
- Minimize work in `useFrame` callbacks
- Group similar props when possible for efficiency

### Adding New Features
1. **New Zones**:
   - Add data to zones array in `Scene.tsx`
   - Implement content component function
   - Add visibility handling in `ZoneOverlays`
   - Position zone marker appropriately

2. **New Props**:
   - Create component function in `Mountain.tsx`
   - Add to appropriate prop placement section
   - Consider performance impact (instance count)

3. **UI Enhancements**:
   - Add styles to `index.css` following established patterns
   - Use CSS custom properties for theme consistency
   - Ensure responsive behavior

---

## 📬 Contact

- **GitHub**: [ameenh1](https://github.com/ameenh1)
- **LinkedIn**: [Ameen Harandi](https://www.linkedin.com/in/ameen-harandi-329325240/)
- **Email**: ameenh7181@gmail.com

---

## 📄 License

This project is for personal portfolio use. Feel free to draw inspiration, but please don't copy it directly.

---

## 🙏 Acknowledgments

- Inspired by [Bruno Simon's portfolio](https://bruno-simon.com/)
- Built with [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) and [@react-three/drei](https://github.com/pmndrs/drei)
- Utilizes procedural generation techniques for terrain creation
