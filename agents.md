# Agent Skills Documentation

This document outlines the available agent skills installed in this project and how to utilize them effectively.

## Available Skills

### 1. Vercel React Best Practices
**Location**: `.agents/skills/vercel-react-best-practices/`
**Purpose**: Provides React and Next.js performance optimization guidelines from Vercel Engineering.
**When to Use**: 
- Writing, reviewing, or refactoring React/Next.js code
- Optimizing component performance
- Improving data fetching patterns
- Reducing bundle size
- Enhancing user experience through performance improvements

**Key Guidelines**:
- Use `useMemo` and `useCallback` for expensive computations
- Implement proper code splitting and lazy loading
- Optimize images and media assets
- Leverage server-side rendering and static generation appropriately
- Minimize JavaScript bundle size
- Use efficient state management patterns

### 2. Web Design Guidelines
**Location**: `.agents/skills/web-design-guidelines/`
**Purpose**: Reviews UI code for Web Interface Guidelines compliance.
**When to Use**:
- Checking accessibility compliance (WCAG)
- Auditing design consistency
- Reviewing UX patterns
- Validating responsive design implementations
- Ensuring cross-browser compatibility

**Key Focus Areas**:
- Color contrast and readability
- Keyboard navigation support
- Screen reader compatibility
- Touch target sizing
- Form validation and error handling
- Loading states and feedback mechanisms

### 3. Three.js Fundamentals
**Location**: `.agents/skills/threejs-fundamentals/`
**Purpose**: Provides guidance on Three.js scene setup, cameras, renderer, Object3D hierarchy, and coordinate systems.
**When to Use**:
- Setting up 3D scenes
- Creating and configuring cameras
- Managing renderers and performance
- Working with Object3D hierarchies
- Implementing transformations and animations
- Adding lighting and materials

**Key Concepts**:
- Scene graph and object hierarchy
- Camera types (Perspective, Orthographic)
- Renderer configuration and optimization
- Geometry creation and manipulation
- Material types and shading
- Lighting techniques (ambient, directional, point, spot)
- Animation systems and loops
- Raycasting for object interaction

## How to Use These Skills

When working on specific tasks, you can invoke the relevant skill to get specialized guidance:

1. **For React performance issues**: Use the Vercel React Best Practices skill
2. **For UI/UX and accessibility concerns**: Use the Web Design Guidelines skill
3. **For 3D graphics and Three.js implementation**: Use the Three.js Fundamentals skill

The skills provide domain-specific instructions, workflows, and best practices that can be applied directly to your development work.

## Skill Installation

Additional skills can be installed using the `find-skills` skill when needed. To discover and install new skills:

1. Ask for help finding a skill for a specific task
2. Use the skill discovery mechanism to find relevant skills
3. Install the skill to make its guidance available

## Best Practices for Skill Usage

1. **Consult Early**: Review relevant skills before starting implementation
2. **Apply Consistently**: Use skill guidelines throughout development
3. **Combine Skills**: Multiple skills may be relevant for complex tasks
4. **Stay Updated**: Skills may be updated with new best practices
5. **Document Usage**: Note when skill guidance was applied in code comments or documentation

---

*Last Updated: March 14, 2026*