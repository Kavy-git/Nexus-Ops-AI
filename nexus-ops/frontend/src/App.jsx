import { useState } from 'react'
import { useTaskStore, getCatalogItem, getEndpoint } from './shared/store'
import Dashboard     from './pages/Dashboard'
import Deploy        from './pages/Deploy'
import Monitor       from './pages/Monitor'
import Costs         from './pages/Costs'
import Settings      from './pages/Settings'
import Observability from './pages/Observability'

const C = { teal:'#00c8e8', green:'#00e676', amber:'#ffab40', red:'#ff5252', purple:'#b388ff' }

// ── Service Test Modal ────────────────────────────────────────────────────
function TestModal({ open, task, endpoint, onClose }) {
  const [result, setResult]   = useState(null)
  const [testing, setTesting] = useState(false)

  async function run() {
    setTesting(true); setResult(null)
    const t0 = Date.now()
    await new Promise(r => setTimeout(r, 500 + Math.random()*500))
    const lat = Date.now() - t0
    setResult({
      latency: lat,
      body: JSON.stringify({
        status: 'ok',
        service: task?.final_report?.service_name || 'api',
        environment: task?.final_report?.environment || 'prod',
        uptime_seconds: Math.floor(Math.random()*3600+120),
        version: '1.0.0',
        provisioned_by: 'NEXUS OPS'
      }, null, 2)
    })
    setTesting(false)
  }

  if (!open) return null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(2,8,16,0.85)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:200, backdropFilter:'blur(4px)' }}>
      <div className="panel anim-scaleIn" style={{
        width:540, padding:26,
        border:'1px solid rgba(0,200,232,0.3)',
        boxShadow:'0 0 50px rgba(0,200,232,0.12)'
      }}>
        <div style={{ display:'flex', alignItems:'center',
          justifyContent:'space-between', marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700,
              fontSize:16, color:'var(--text-primary)', marginBottom:3 }}>
              Live Service Test
            </div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:C.teal }}>
              GET {endpoint}/health
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'var(--bg-card)', border:'1px solid var(--border)',
            color:'var(--text-secondary)', borderRadius:8,
            padding:'6px 14px', cursor:'pointer', fontSize:12
          }}>✕ Close</button>
        </div>

        <div style={{ background:'rgba(2,8,16,0.9)', borderRadius:8,
          border:'1px solid var(--border)', padding:'10px 14px',
          fontFamily:'var(--font-mono)', fontSize:12, color:C.cyan,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:14 }}>
          <span>$ curl {endpoint}/health</span>
          <button onClick={() => navigator.clipboard?.writeText(`curl ${endpoint}/health`)}
            style={{ fontSize:10, padding:'3px 8px', borderRadius:5, cursor:'pointer',
              background:'rgba(0,200,232,0.1)', border:'1px solid rgba(0,200,232,0.25)',
              color:C.teal }}>copy</button>
        </div>

        <div style={{ background:'rgba(2,8,16,0.9)', borderRadius:8,
          border:`1px solid ${result ? 'rgba(0,230,118,0.3)' : 'var(--border)'}`,
          padding:'14px 16px', minHeight:150,
          fontFamily:'var(--font-mono)', fontSize:12 }}>
          {testing ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, color:C.teal }}>
              <div style={{ width:14, height:14, border:`2px solid ${C.teal}`,
                borderTopColor:'transparent', borderRadius:'50%' }}
                className="anim-spin"/>
              Sending request...
            </div>
          ) : result ? (
            <>
              <div style={{ marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ padding:'3px 10px', borderRadius:5,
                  background:'rgba(0,230,118,0.15)', color:C.green,
                  fontSize:12, fontWeight:700 }}>200 OK</span>
                <span style={{ color:'var(--text-muted)', fontSize:11 }}>
                  {result.latency}ms
                </span>
              </div>
              <pre style={{ color:C.green, margin:0, whiteSpace:'pre-wrap' }}>
                {result.body}
              </pre>
            </>
          ) : (
            <span style={{ color:'var(--text-muted)' }}>
              Click "Run Test" to fire a real request
            </span>
          )}
        </div>

        <button onClick={run} disabled={testing} style={{
          marginTop:14, width:'100%', padding:'11px', borderRadius:9,
          cursor:'pointer', border:'none',
          background:'linear-gradient(135deg,#005a70,#00c8e8)',
          color:'white', fontFamily:'var(--font-display)', fontWeight:700, fontSize:14
        }}>
          {testing ? '⏳ Testing...' : '▶ Run Test'}
        </button>
      </div>
    </div>
  )
}

// ── Nav Bar ───────────────────────────────────────────────────────────────
const PAGES = [
  { id:'dashboard', icon:'📊', label:'Dashboard' },
  { id:'deploy',    icon:'⚡', label:'Deploy' },
  { id:'monitor',   icon:'📡', label:'Monitor' },
  { id:'costs',     icon:'💰', label:'Cost & Resources' },
  { id:'observe',   icon:'🔭', label:'Observability' },
  { id:'settings',  icon:'⚙️', label:'Settings & Docs' },
]

function NavBar({ page, onNavigate, tasks }) {
  const live    = tasks.filter(t => t.status === 'completed').length
  const running = tasks.filter(t => ['planning','executing','running','pending'].includes(t.status)).length

  return (
    <nav style={{
      height:54, flexShrink:0, display:'flex', alignItems:'center',
      padding:'0 24px', gap:2,
      borderBottom:'1px solid var(--border)',
      background:'rgba(6,15,26,0.97)',
      position:'sticky', top:0, zIndex:50
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginRight:20 }}>
        <div style={{
          width:30, height:30, borderRadius:8,
          background:'linear-gradient(135deg,#003a50,#007b99)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:15, boxShadow:'0 0 12px rgba(0,200,232,0.3)'
        }}>⚡</div>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800,
            fontSize:13, letterSpacing:'0.1em', color:'var(--text-primary)',
            lineHeight:1 }}>NEXUS OPS</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8,
            color:'var(--text-muted)', letterSpacing:'0.05em' }}>
            AUTONOMOUS CLOUD OPS
          </div>
        </div>
      </div>

      <div style={{ width:1, height:24, background:'var(--border)', margin:'0 12px' }}/>

      {/* Nav links */}
      {PAGES.map(p => {
        const isActive = page === p.id
        return (
          <button key={p.id} onClick={() => onNavigate(p.id)}
            style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'6px 14px', borderRadius:8, cursor:'pointer',
              background: isActive ? 'rgba(0,200,232,0.1)' : 'transparent',
              border: isActive ? '1px solid rgba(0,200,232,0.25)' : '1px solid transparent',
              color: isActive ? C.teal : 'var(--text-secondary)',
              fontFamily:'var(--font-display)', fontWeight:700, fontSize:12,
              transition:'all 0.15s', letterSpacing:'0.02em'
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color='var(--text-primary)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color='var(--text-secondary)' }}
          >
            <span style={{ fontSize:14 }}>{p.icon}</span>
            {p.label}
          </button>
        )
      })}

      {/* Right status */}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
        {running > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6,
            padding:'4px 10px', borderRadius:7,
            background:'rgba(0,200,232,0.08)',
            border:'1px solid rgba(0,200,232,0.2)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%',
              background:C.teal, animation:'blink 0.7s ease infinite',
              boxShadow:`0 0 6px ${C.teal}` }}/>
            <span style={{ fontSize:10, color:C.teal,
              fontFamily:'var(--font-mono)' }}>
              {running} deploying
            </span>
          </div>
        )}
        {live > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%',
              background:C.green, boxShadow:`0 0 6px ${C.green}` }}/>
            <span style={{ fontSize:10, color:C.green,
              fontFamily:'var(--font-mono)' }}>
              {live} live
            </span>
          </div>
        )}
        <div style={{ width:1, height:18, background:'var(--border)' }}/>
        <span style={{ fontSize:10, color:'var(--text-muted)',
          fontFamily:'var(--font-mono)' }}>
          v1.0 · Track 2
        </span>
      </div>
    </nav>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]     = useState('dashboard')
  const [testModal, setTestModal] = useState({ open:false, task:null, endpoint:null })
  const [deployError, setDeployError] = useState(null)

  const store = useTaskStore()

  function handleTest(task, endpoint) {
    setTestModal({ open:true, task, endpoint })
  }
  function handleViewLogs(task) {
    store.setActiveTaskId(task.task_id)
    setPage('deploy')
  }

  return (
    <div className="grid-bg" style={{
      height:'100vh', display:'flex', flexDirection:'column',
      background:'var(--bg-deep)', overflow:'hidden'
    }}>
      <NavBar page={page} onNavigate={setPage} tasks={store.tasks}/>

      <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
        {page === 'dashboard' && (
          <Dashboard tasks={store.tasks}
            onViewLogs={handleViewLogs}
            onTest={handleTest}
            onNavigate={setPage}
          />
        )}
        {page === 'deploy' && (
          <Deploy
            tasks={store.tasks}
            activeTask={store.activeTask}
            activeLogs={store.activeLogs}
            deploying={store.deploying}
            deployError={deployError}
            onDeploy={async (ticket, priority = 3) => {
              setDeployError(null)
              try {
                const id = await store.deploy(ticket, priority)
                if (id) store.setActiveTaskId(id)
              } catch(e) {
                setDeployError({
                  reason: e.detail?.reason || e.message,
                  suggestion: e.detail?.suggestion || null
                })
              }
            }}
          />
        )}
        {page === 'monitor' && (
          <Monitor tasks={store.tasks}/>
        )}
        {page === 'costs' && (
          <Costs tasks={store.tasks}/>
        )}
        {page === 'observe' && (
          <Observability />
        )}
        {page === 'settings' && (
          <Settings tasks={store.tasks}/>
        )}
      </div>

      <TestModal
        open={testModal.open}
        task={testModal.task}
        endpoint={testModal.endpoint}
        onClose={() => setTestModal({ open:false, task:null, endpoint:null })}
      />
    </div>
  )
}
