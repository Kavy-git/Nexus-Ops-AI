// pages/Deploy.jsx — with 3-state validation + cost preview modal
import { useState, useEffect, useCallback } from 'react'
import { CATALOG, STATUS_COLOR } from '../shared/store'
import { SectionHeader, LogStream, Page } from '../components/UI'
import { validateTicket, previewCost } from '../utils/api'

const C = { teal:'#00c8e8', green:'#00e676', amber:'#ffab40', red:'#ff5252', purple:'#b388ff' }

// ── Live validation hook (debounced) ──────────────────────────────────────
function useValidation(text) {
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async (t) => {
    if (!t || t.trim().length < 6) { setResult(null); return }
    setChecking(true)
    try { setResult(await validateTicket(t)) }
    catch { setResult(null) }
    finally { setChecking(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => check(text), 500)
    return () => clearTimeout(t)
  }, [text, check])

  return { result, checking }
}

// ── 3-state validation pill ───────────────────────────────────────────────
function ValidationBadge({ result, checking }) {
  if (checking) return (
    <div style={{ display:'flex', alignItems:'center', gap:6,
      fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
      <div style={{ width:10, height:10, border:`1.5px solid ${C.teal}`,
        borderTopColor:'transparent', borderRadius:'50%',
        animation:'spin 1s linear infinite' }}/>
      Analysing request...
    </div>
  )
  if (!result) return null

  const cfg = {
    VALID:      { color:C.green,  bg:'rgba(0,230,118,0.06)',  border:'rgba(0,230,118,0.25)',  icon:'✓' },
    INVALID:    { color:C.red,    bg:'rgba(255,82,82,0.06)',   border:'rgba(255,82,82,0.3)',   icon:'✗' },
    INCOMPLETE: { color:C.amber,  bg:'rgba(255,171,64,0.06)', border:'rgba(255,171,64,0.3)', icon:'⚠' },
  }[result.status] || { color:'var(--text-muted)', bg:'transparent', border:'var(--border)', icon:'?' }

  return (
    <div style={{
      padding:'10px 14px', borderRadius:9,
      background:cfg.bg, border:`1px solid ${cfg.border}`,
      fontSize:11, lineHeight:1.65
    }}>
      <div style={{ display:'flex', alignItems:'center',
        justifyContent:'space-between', marginBottom: result.error ? 4 : 0 }}>
        <span style={{ color:cfg.color, fontWeight:700, fontSize:12 }}>
          {cfg.icon} {result.status}
          {result.status === 'VALID' && result.confidence > 0 &&
            <span style={{ fontSize:10, fontWeight:400, marginLeft:8,
              color:'var(--text-secondary)' }}>
              {Math.round(result.confidence * 100)}% confidence
            </span>
          }
        </span>
      </div>
      {result.error && (
        <div style={{ color:'var(--text-secondary)', marginBottom: result.suggestion ? 4 : 0 }}>
          {result.error}
        </div>
      )}
      {result.suggestion && (
        <div style={{ color:cfg.color === C.green ? C.teal : cfg.color,
          fontSize:10, opacity:0.9 }}>
          💡 {result.suggestion}
        </div>
      )}
      {result.extracted && Object.keys(result.extracted).length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
          {Object.entries(result.extracted).map(([k,v]) => (
            <span key={k} style={{
              fontSize:9, padding:'2px 7px', borderRadius:4,
              background:'rgba(0,200,232,0.1)', color:C.teal,
              fontFamily:'var(--font-mono)', border:'1px solid rgba(0,200,232,0.2)'
            }}>{k}: {v}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cost Preview Modal ────────────────────────────────────────────────────
function CostPreviewModal({ open, data, onConfirm, onCancel, loading }) {
  if (!open) return null
  const cost = data?.cost_estimate
  const preview = data?.task_preview

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(2,8,16,0.88)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:300, backdropFilter:'blur(4px)' }}>
      <div className="panel anim-scaleIn" style={{
        width:520, padding:28,
        border:'1px solid rgba(255,171,64,0.35)',
        boxShadow:'0 0 40px rgba(255,171,64,0.1)'
      }}>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:800,
          fontSize:17, color:'var(--text-primary)', marginBottom:4 }}>
          💰 Cost Preview
        </div>
        <p style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:20 }}>
          Review estimated costs before executing this ticket.
        </p>

        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:10,
            color:C.teal, padding:'24px 0' }}>
            <div style={{ width:16, height:16, border:`2px solid ${C.teal}`,
              borderTopColor:'transparent', borderRadius:'50%',
              animation:'spin 1s linear infinite' }}/>
            Generating cost estimate...
          </div>
        ) : cost ? (
          <>
            {preview && (
              <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:9,
                background:'rgba(0,200,232,0.05)', border:'1px solid rgba(0,200,232,0.2)' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:11,
                  color:'var(--text-secondary)', lineHeight:1.9 }}>
                  <span style={{color:'var(--text-muted)'}}>service  </span>
                  <span style={{color:C.teal}}>{preview.service_name}</span>
                  <span style={{color:'var(--text-muted)',marginLeft:16}}>env  </span>
                  <span style={{color:C.teal}}>{preview.environment}</span>
                  <span style={{color:'var(--text-muted)',marginLeft:16}}>steps  </span>
                  <span style={{color:C.teal}}>{preview.steps}</span>
                </div>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {cost.breakdown.map((r,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center',
                  justifyContent:'space-between', padding:'8px 12px', borderRadius:8,
                  background:'var(--bg-card)', border:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize:12, color:'var(--text-primary)',
                      marginBottom:2 }}>{r.resource}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)',
                      fontFamily:'var(--font-mono)' }}>{r.note}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700,
                      fontSize:15, color: r.monthly > 0 ? C.amber : 'var(--text-muted)' }}>
                      ${r.monthly.toFixed(2)}/mo
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', padding:'12px 14px', borderRadius:9,
              background:'rgba(255,171,64,0.08)',
              border:'1px solid rgba(255,171,64,0.3)',
              marginBottom:20 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11,
                color:'var(--text-secondary)' }}>ESTIMATED TOTAL</span>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:800,
                  fontSize:22, color:C.amber }}>${cost.total_monthly}/month</div>
                <div style={{ fontSize:10, color:'var(--text-muted)',
                  fontFamily:'var(--font-mono)' }}>${cost.total_hourly}/hr</div>
              </div>
            </div>

            <p style={{ fontSize:10, color:'var(--text-muted)',
              marginBottom:16, lineHeight:1.5 }}>{cost.note}</p>
          </>
        ) : null}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{
            flex:1, padding:'11px', borderRadius:9, cursor:'pointer',
            background:'var(--bg-card)', border:'1px solid var(--border)',
            color:'var(--text-secondary)',
            fontFamily:'var(--font-display)', fontWeight:700, fontSize:13
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex:2, padding:'11px', borderRadius:9, cursor:'pointer',
            background:'linear-gradient(135deg,#005a70,#00c8e8)',
            border:'none', color:'white',
            fontFamily:'var(--font-display)', fontWeight:700, fontSize:13,
            opacity: loading ? 0.5 : 1
          }}>
            ⚡ Execute Now
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Catalog card ──────────────────────────────────────────────────────────
function CatalogCard({ svc, deployed, onDeploy, deploying }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="panel-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding:16,
        borderColor: deployed ? `${svc.color}50` : hovered ? svc.color : 'var(--border)',
        cursor: deploying ? 'not-allowed' : 'pointer',
        transition:'all 0.2s',
        boxShadow: hovered && !deploying ? `0 0 20px ${svc.color}18` : 'none' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
        <div style={{ width:42, height:42, borderRadius:11, flexShrink:0,
          background:`${svc.color}15`, border:`1px solid ${svc.color}35`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
          {svc.icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:700,
            fontSize:13, color:'var(--text-primary)', marginBottom:3 }}>{svc.name}</div>
          <div style={{ fontSize:10, fontFamily:'var(--font-mono)',
            color:svc.color, textTransform:'uppercase' }}>{svc.env}</div>
        </div>
        {deployed && (
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:C.green,
              boxShadow:`0 0 6px ${C.green}` }}/>
            <span style={{ fontSize:9, color:C.green, fontFamily:'var(--font-mono)' }}>LIVE</span>
          </div>
        )}
      </div>
      <p style={{ fontSize:11, color:'var(--text-secondary)',
        lineHeight:1.5, marginBottom:14 }}>{svc.desc}</p>
      <button onClick={() => !deploying && onDeploy(svc.ticket)} disabled={deploying}
        style={{ width:'100%', padding:'9px', borderRadius:8, border:'none',
          cursor: deploying ? 'not-allowed' : 'pointer',
          background: deploying ? 'var(--bg-deep)'
            : `linear-gradient(135deg, ${svc.color}30, ${svc.color}15)`,
          color: deploying ? 'var(--text-muted)' : svc.color,
          fontFamily:'var(--font-display)', fontWeight:700, fontSize:12,
          border:`1px solid ${deploying ? 'var(--border)' : svc.color+'40'}`,
          transition:'all 0.2s', letterSpacing:'0.05em' }}>
        {deploying ? '⏳ DEPLOYING...' : deployed ? '↺ REDEPLOY' : '⚡ DEPLOY'}
      </button>
    </div>
  )
}

// ── Execution panel ───────────────────────────────────────────────────────
function ExecutionPanel({ task, logs, deployError }) {
  if (deployError) return (
    <div style={{ padding:16, borderRadius:10,
      background:'rgba(255,82,82,0.06)', border:'1px solid rgba(255,82,82,0.35)' }}>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:700,
        fontSize:13, color:C.red, marginBottom:6 }}>✗ Request Blocked</div>
      <p style={{ fontSize:12, color:'var(--text-secondary)',
        marginBottom: deployError.suggestion ? 8 : 0 }}>{deployError.reason}</p>
      {deployError.suggestion && (
        <p style={{ fontSize:11, color:C.amber }}>💡 {deployError.suggestion}</p>
      )}
    </div>
  )

  if (!task) return (
    <div style={{ flex:1, display:'flex', alignItems:'center',
      justifyContent:'center', flexDirection:'column', gap:12, opacity:0.4 }}>
      <div style={{ fontSize:40 }}>🎯</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:12,
        color:'var(--text-muted)', textAlign:'center' }}>
        Deploy a service to see live execution here
      </div>
    </div>
  )

  const steps = task.steps || []
  const parallelActive = steps.filter(s => s.status === 'running').length > 1
  const plannerUsed = task.plan?._planner
  const isRollingBack = task.status === 'rolling_back'
  const wasRolledBack = task.rollback_performed

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14,
      height:'100%', minHeight:0 }}>

      <div className="panel-card" style={{ padding:'12px 16px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center',
          justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11,
            color:C.teal }}>{task.task_id}</span>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {plannerUsed === 'rule-based' && (
              <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4,
                background:'rgba(255,171,64,0.1)', color:C.amber,
                fontFamily:'var(--font-mono)' }}>rule-based</span>
            )}
            {wasRolledBack && (
              <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4,
                background:'rgba(255,82,82,0.1)', color:C.red,
                fontFamily:'var(--font-mono)' }}>rolled back</span>
            )}
            <div className={`dot dot-${task.status}`}/>
            <span style={{ fontSize:10, color: STATUS_COLOR(task.status),
              fontFamily:'var(--font-mono)', textTransform:'uppercase' }}>
              {isRollingBack ? 'ROLLING BACK' : task.status}
            </span>
          </div>
        </div>
        <p style={{ fontSize:11, color:'var(--text-secondary)', lineHeight:1.5 }}>
          {task.ticket}
        </p>
        {task.cost_preview && (
          <div style={{ marginTop:8, padding:'5px 10px', borderRadius:6,
            background:'rgba(255,171,64,0.06)', border:'1px solid rgba(255,171,64,0.2)',
            fontFamily:'var(--font-mono)', fontSize:10, color:C.amber }}>
            💰 Est. cost: ~${task.cost_preview.total_monthly}/month
          </div>
        )}
      </div>

      {/* Rollback banner */}
      {isRollingBack && (
        <div className="anim-alert" style={{ padding:'10px 14px', borderRadius:9,
          border:`1px solid ${C.red}40`,
          fontFamily:'var(--font-mono)', fontSize:11, color:C.red }}>
          🔴 Rolling back resources — cleaning up orphan infrastructure...
        </div>
      )}
      {wasRolledBack && (
        <div style={{ padding:'10px 14px', borderRadius:9,
          background:'rgba(255,82,82,0.04)', border:`1px solid ${C.red}30`,
          fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)' }}>
          🧹 Rollback complete — {task.rollback_resources?.length || 0} resource(s) deleted. Environment is clean.
        </div>
      )}

      {/* Steps */}
      <div style={{ flexShrink:0 }}>
        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-muted)',
          letterSpacing:'0.08em', marginBottom:8 }}>
          AGENT EXECUTION
          {parallelActive && (
            <span style={{ marginLeft:8, color:C.teal,
              animation:'blink 1s step-start infinite' }}>⚡ PARALLEL</span>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {steps.length === 0 ? (
            <div style={{ color:'var(--text-muted)', fontFamily:'var(--font-mono)',
              fontSize:11, padding:14, textAlign:'center',
              background:'var(--bg-card)', borderRadius:8, border:'1px solid var(--border)' }}>
              Generating plan...
            </div>
          ) : steps.map((s,i) => {
            const col = STATUS_COLOR(s.status)
            const toolName = s.tool === 'create_storage' ? '🗄 Storage Agent'
              : s.tool === 'allocate_compute' ? '⚙️ Compute Agent' : '🚀 Deploy Agent'
            return (
              <div key={s.step_id} className="panel-card anim-fadeUp"
                style={{ padding:'11px 13px', borderColor:col,
                  animationDelay:`${i*0.07}s`,
                  boxShadow: s.status==='running' ? `0 0 10px ${col}20` : 'none',
                  background: s.status==='retrying' ? 'rgba(255,171,64,0.03)' : 'var(--bg-card)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background:col,
                      animation: s.status==='running' ? 'blink 0.7s ease infinite' : 'none',
                      boxShadow: s.status==='running' ? `0 0 6px ${col}` : 'none' }}/>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11,
                      color:'var(--text-primary)' }}>{toolName}</span>
                    {s.depends_on?.length > 0 && (
                      <span style={{ fontSize:9, color:'var(--text-muted)',
                        fontFamily:'var(--font-mono)' }}>after [{s.depends_on.join(',')}]</span>
                    )}
                    {s.retries > 0 && (
                      <span style={{ fontSize:9, color:C.amber,
                        fontFamily:'var(--font-mono)' }}>↺{s.retries}</span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {s.status === 'running' && (
                      <div style={{ width:11, height:11, border:`2px solid ${col}`,
                        borderTopColor:'transparent', borderRadius:'50%' }}
                        className="anim-spin"/>
                    )}
                    <span style={{ fontSize:10, color:col,
                      fontFamily:'var(--font-mono)', textTransform:'uppercase' }}>
                      {s.status}
                    </span>
                  </div>
                </div>
                {s.status === 'retrying' && (
                  <div className="anim-alert" style={{ marginTop:7, padding:'5px 9px',
                    borderRadius:5, border:`1px solid ${C.amber}35`,
                    fontSize:10, fontFamily:'var(--font-mono)', color:C.amber }}>
                    🔄 Self-healing — retrying with corrected parameters...
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-muted)',
          letterSpacing:'0.08em', marginBottom:7, flexShrink:0 }}>AGENT LOG</div>
        <LogStream logs={logs} height="100%"/>
      </div>
    </div>
  )
}

// ── Deploy Page ───────────────────────────────────────────────────────────
export default function Deploy({ tasks, activeTask, activeLogs, deploying, onDeploy, deployError }) {
  const [customTicket, setCustomTicket] = useState('')
  const [priority, setPriority] = useState(3)
  const { result: valResult, checking: valChecking } = useValidation(customTicket)

  // Cost preview state
  const [costModal, setCostModal] = useState({ open:false, data:null, loading:false, ticket:'', priority:3 })

  async function handleCostPreview(ticketText) {
    setCostModal({ open:true, data:null, loading:true, ticket:ticketText, priority })
    const data = await previewCost(ticketText)
    setCostModal(m => ({ ...m, data, loading:false }))
  }

  function handleConfirmDeploy() {
    const ticket = costModal.ticket
    const p = costModal.priority
    setCostModal({ open:false, data:null, loading:false, ticket:'', priority:3 })
    onDeploy(ticket, p)
  }

  const deployedIds = new Set(
    tasks.filter(t => t.status === 'completed')
      .map(t => CATALOG.find(c => (t.ticket||'').toLowerCase().includes(c.id))?.id)
      .filter(Boolean)
  )

  const canPreview = customTicket.trim().length >= 6 &&
    !deploying && valResult?.status === 'VALID'

  return (
    <Page>
      <CostPreviewModal
        open={costModal.open}
        data={costModal.data}
        loading={costModal.loading}
        onConfirm={handleConfirmDeploy}
        onCancel={() => setCostModal({ open:false, data:null, loading:false, ticket:'' })}
      />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 440px', gap:24,
        minHeight:'calc(100vh - 120px)' }}>

        {/* Left */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <SectionHeader title="SERVICE CATALOG" color={C.teal}
            right={<span style={{ fontSize:11, color:'var(--text-secondary)' }}>
              One-click deploy with pre-validated tickets
            </span>}/>
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
            {CATALOG.map(svc => (
              <CatalogCard key={svc.id} svc={svc}
                deployed={deployedIds.has(svc.id)}
                deploying={deploying}
                onDeploy={onDeploy}/>
            ))}
          </div>

          {/* Custom ticket */}
          <div>
            <SectionHeader title="CUSTOM TICKET" color={C.teal}
              right={<span style={{ fontSize:11, color:'var(--text-secondary)' }}>
                Validated before execution — contradictions blocked
              </span>}/>
            <div className="panel" style={{ padding:20, display:'flex',
              flexDirection:'column', gap:12 }}>
              <textarea value={customTicket}
                onChange={e => setCustomTicket(e.target.value)}
                disabled={deploying} rows={5}
                placeholder={"e.g. Set up a production environment for payments-api\nwith S3 bucket in us-east-1, t2.medium EC2 instance,\ndeploy payments-api:latest on port 8080"}
                style={{ width:'100%', background:'var(--bg-card)',
                  border:`1px solid ${
                    !customTicket ? 'var(--border)'
                    : valResult?.status === 'INVALID'    ? C.red
                    : valResult?.status === 'INCOMPLETE' ? C.amber
                    : valResult?.status === 'VALID'      ? C.teal
                    : 'var(--border)'}`,
                  borderRadius:9, padding:'12px 14px',
                  color:'var(--text-primary)', resize:'none', outline:'none',
                  fontFamily:'Inter,sans-serif', fontSize:13, lineHeight:1.65,
                  transition:'border-color 0.2s', boxSizing:'border-box' }}/>

              {/* 3-state validation badge */}
              <ValidationBadge result={valResult} checking={valChecking}/>

              <div style={{ display:'flex', gap:8 }}>
                {/* Cost preview button */}
                <button onClick={() => handleCostPreview(customTicket.trim())}
                  disabled={!canPreview}
                  style={{ flex:'0 0 auto', padding:'12px 16px', borderRadius:9,
                    border:`1px solid ${canPreview ? C.amber+'60' : 'var(--border)'}`,
                    cursor: canPreview ? 'pointer' : 'not-allowed',
                    background: canPreview ? 'rgba(255,171,64,0.08)' : 'var(--bg-card)',
                    color: canPreview ? C.amber : 'var(--text-muted)',
                    fontFamily:'var(--font-display)', fontWeight:700, fontSize:12,
                    transition:'all 0.2s', whiteSpace:'nowrap' }}>
                  💰 Cost Preview
                </button>

                {/* Priority selector */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>Priority</span>
                  {[['Critical','1',C.red],['High','2',C.amber],['Normal','3',C.teal],['Low','4',C.muted]].map(([label,val,color]) => (
                    <button key={val} onClick={() => setPriority(Number(val))} style={{
                      flex:1, padding:'6px 4px', borderRadius:7, border:`1px solid ${priority===Number(val) ? color : 'var(--border)'}`,
                      background: priority===Number(val) ? `${color}18` : 'transparent',
                      color: priority===Number(val) ? color : 'var(--text-muted)',
                      fontSize:10, fontWeight:700, cursor:'pointer', transition:'all 0.15s'
                    }}>{label}</button>
                  ))}
                </div>

                {/* Execute button */}
                <button onClick={() => { if(canPreview) onDeploy(customTicket.trim(), priority) }}
                  disabled={!canPreview}
                  style={{ flex:1, padding:'12px', borderRadius:9, border:'none',
                    cursor: canPreview ? 'pointer' : 'not-allowed',
                    background: canPreview
                      ? 'linear-gradient(135deg,#005a70,#00c8e8)' : 'var(--bg-card)',
                    color: canPreview ? 'white' : 'var(--text-muted)',
                    fontFamily:'var(--font-display)', fontWeight:700, fontSize:14,
                    letterSpacing:'0.06em', transition:'all 0.2s',
                    boxShadow: canPreview ? '0 0 20px rgba(0,200,232,0.25)' : 'none' }}>
                  {deploying ? '⏳ DEPLOYING...' : '⚡ EXECUTE TICKET'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
          <SectionHeader title="LIVE EXECUTION" color={C.teal}
            right={activeTask && (
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div className={`dot dot-${activeTask.status}`}/>
                <span style={{ fontSize:10, color: STATUS_COLOR(activeTask.status),
                  fontFamily:'var(--font-mono)', textTransform:'uppercase' }}>
                  {activeTask.status}
                </span>
              </div>
            )}/>
          <div className="panel" style={{ flex:1, padding:18, minHeight:0,
            display:'flex', flexDirection:'column' }}>
            <ExecutionPanel task={activeTask} logs={activeLogs} deployError={deployError}/>
          </div>
        </div>
      </div>
    </Page>
  )
}
