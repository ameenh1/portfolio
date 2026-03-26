import { useEffect, useState } from 'react'
import { FiGithub, FiLinkedin, FiMail } from 'react-icons/fi'
import { activeZoneStore } from '../utils/activeZoneStore'

/* ═══════════════════════════════════════
   DATA
   ═══════════════════════════════════════ */
const skills = [
  { cat: 'Languages', items: ['Python', 'Java', 'JavaScript', 'TypeScript', 'C', 'HTML/CSS'] },
  { cat: 'Frameworks', items: ['React', 'TensorFlow', 'Keras', 'Flask', 'LangChain', 'FastAPI'] },
  { cat: 'Tools & Cloud', items: ['Docker', 'Git', 'GCP', 'Cloud Run', 'OpenCV', 'Supabase'] },
]

const experience = [
  { emoji: '🏢', title: 'Zarnite', role: 'Full Stack Developer Intern', period: 'Dec 2025 to Present', desc: 'Built the web platform with React, TypeScript, and Tailwind. Integrated Stripe billing, containerized with Docker, and set up CI/CD on GCP Cloud Run.', tags: ['React', 'TypeScript', 'Docker', 'GCP'] },
  { emoji: '🏗️', title: 'Archimedes @ VT', role: 'Software Engineering Team Member', period: 'Sept 2024 to Nov 2025', desc: 'Built a seizure prediction web app using LSTM on EEG data. Presented research at CAPWIC and VTURCS.', tags: ['Python', 'TensorFlow', 'JavaScript'] },
  { emoji: '🎓', title: 'Archimedes @ VT', role: 'Design Team Advisor', period: 'April 2025 to Present', desc: 'Overseeing 2 teams for the Microsoft Imagine Cup. Grew applications 52% YoY through outreach and weekly skill workshops.', tags: ['Leadership', 'Mentoring'] },
]

const projects = [
  { emoji: '🏆', title: 'A Closer Look', desc: 'Hackviolet Best Overall. Mobile health app with personalized risk assessments. Cut API latency 96% with async caching. RAG pipeline with GPT-4o-mini for ingredient matching across 10+ conditions.', tags: ['React', 'TypeScript', 'FastAPI', 'GPT-4o-mini'] },
  { emoji: '🧠', title: 'Full-Stack RAG Application', desc: 'RAG system for literary QA with source attribution. Dual vector store (Chroma and Supabase pgvector). Groq inference (llama-3.3-70b) with structured prompt templates.', tags: ['Python', 'LangChain', 'Groq', 'Supabase'] },
  { emoji: '🌍', title: '3D Interactive Visualization', desc: 'OpenCV/MediaPipe hand tracking controlling PyVista 3D visualizations in real time. Sub-50ms gesture recognition with 21-point landmarks.', tags: ['Python', 'OpenCV', 'MediaPipe', 'PyVista'] },
  { emoji: '👁️', title: 'Real-Time Face Detection', desc: 'TensorFlow detection pipeline with checkpointing and early stopping. Flask REST API for live results. Custom augmented dataset for varied conditions.', tags: ['Python', 'TensorFlow', 'Flask', 'OpenCV'] },
]

const hackathons = [
  { name: 'HackViolet', year: '2026', project: 'A Closer Look', award: '🏆 Best Overall' },
  { name: 'VTURCS', year: '2025', project: 'Infinitum', award: '📄 Research Presented' },
  { name: 'CAPWIC', year: '2025', project: 'Infinitum', award: '📄 Research Presented' },
]

/* ═══════════════════════════════════════
   ZONE CONTENT COMPONENTS
   ═══════════════════════════════════════ */
function Tag({ label }: { label: string }) {
  return <span className="tag">{label}</span>
}

function BaseCampContent() {
  return (
    <>
      <h3>Welcome, Traveler</h3>
      <div className="zone-subtitle">Base Camp</div>
      <p>
        I'm <strong style={{ color: '#fff' }}>Ameen Harandi</strong>, a CS student at Virginia Tech
        (3.75 GPA), full-stack developer and AI enthusiast. Scroll up the mountain to discover my work.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {['React', 'TypeScript', 'Python', 'AI', 'Full-Stack', 'GCP'].map(t => <Tag key={t} label={t} />)}
      </div>
    </>
  )
}

function SkillsContent() {
  return (
    <>
      <h3>The Workshop</h3>
      <div className="zone-subtitle">Skills &amp; Technologies</div>
      {skills.map(g => (
        <div key={g.cat} style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#c4915e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            {g.cat}
          </div>
          <div className="skill-grid">
            {g.items.map(s => <div key={s} className="skill-item"><span>{s}</span></div>)}
          </div>
        </div>
      ))}
    </>
  )
}

function ExperienceContent() {
  return (
    <>
      <h3>The Trail Log</h3>
      <div className="zone-subtitle">Work Experience</div>
      {experience.map(e => (
        <div key={e.title + e.role} style={{ marginBottom: '10px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '1.1rem' }}>{e.emoji}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{e.title}</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#c4915e', marginBottom: '4px' }}>{e.role} · {e.period}</div>
          <p style={{ fontSize: '0.7rem', lineHeight: 1.5, color: 'rgba(212,200,187,0.6)', margin: '0 0 6px 0' }}>{e.desc}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {e.tags.map(t => <Tag key={t} label={t} />)}
          </div>
        </div>
      ))}
    </>
  )
}

function ProjectsContent() {
  return (
    <>
      <h3>The Launchpad</h3>
      <div className="zone-subtitle">Projects</div>
      {projects.map(p => (
        <div key={p.title} style={{ marginBottom: '10px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{p.title}</span>
          </div>
          <p style={{ fontSize: '0.7rem', lineHeight: 1.5, color: 'rgba(212,200,187,0.6)', margin: '0 0 6px 0' }}>{p.desc}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {p.tags.map(t => <Tag key={t} label={t} />)}
          </div>
        </div>
      ))}
    </>
  )
}

function AwardsContent() {
  return (
    <>
      <h3>Trophy Ridge</h3>
      <div className="zone-subtitle">Hackathons &amp; Awards</div>
      {hackathons.map(h => (
        <div key={h.name} className="award-card">
          <div className="award-info">
            <div className="award-name">{h.name} <span style={{ fontSize: '0.6rem', color: '#b8a899' }}>{h.year}</span></div>
            <div className="award-project">{h.project}</div>
          </div>
          <div className="award-badge">{h.award}</div>
        </div>
      ))}
    </>
  )
}

function SummitContent() {
  return (
    <>
      <h3>The Summit</h3>
      <div className="zone-subtitle">You made it to the top!</div>
      <p>Let's connect! Always open to collaborations, internships, and interesting ideas.</p>
      <a href="https://github.com/ameenh1" target="_blank" rel="noopener noreferrer" className="social-link">
        <FiGithub /> GitHub
      </a>
      <a href="https://www.linkedin.com/in/ameen-harandi-329325240/" target="_blank" rel="noopener noreferrer" className="social-link">
        <FiLinkedin /> LinkedIn
      </a>
      <a href="mailto:ameenh7181@gmail.com" className="social-link">
        <FiMail /> ameenh7181@gmail.com
      </a>
    </>
  )
}

const contentMap: Record<string, React.ReactNode> = {
  base: <BaseCampContent />,
  skills: <SkillsContent />,
  experience: <ExperienceContent />,
  projects: <ProjectsContent />,
  awards: <AwardsContent />,
  summit: <SummitContent />,
}

/* ═══════════════════════════════════════
   ZONE CARD — fixed DOM overlay, outside Canvas
   ═══════════════════════════════════════ */
export default function ZoneCard() {
  const [activeZone, setActiveZone] = useState<string | null>(activeZoneStore.get())

  useEffect(() => {
    return activeZoneStore.subscribe(setActiveZone)
  }, [])

  const visible = activeZone !== null
  const content = activeZone ? contentMap[activeZone] : null

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        width: '360px',
        maxWidth: '40vw',
        zIndex: 100,
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
        transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div className="zone-panel">
        {content}
      </div>
    </div>
  )
}
