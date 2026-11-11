// admin pages, loaded only when one of them is opened (split from App.jsx; the shell and shared helpers stay there)
import {useState,useEffect,useRef} from 'react'
import {ROOT} from '../base.js'
import {Plus,Search,Upload,Copy,Check,Pencil,Trash2,Archive,ArchiveRestore} from 'lucide-react'
import {t as tl,srv} from '../i18n.js'
import {ArchPill,ArchiveSheet,Bar,COL,CourseSheet,FLAG_KIND,Logo,Opts,PAGE,PLAN_NAME,Paged,Pager,ProgramSheet,SemesterSheet,Sheet,Skeleton,Tabs,UserDetail,UserSheet,api,download,fetchFile,handoff,matches,money,pl,roleName,semsOf,spanOf,termOf,useConfirm,useFaculty,usePaged,when} from '../App.jsx'
export const TEMPLATE=`program,semester,course,unit,topic,content,question_pattern,sample_content,guideline
B.E. Mechanical Engineering,Semester 3,Thermodynamics,Unit 1: Basic concepts,First law of thermodynamics,"Energy can change form but is never created or destroyed.","2 marks: define. 13 marks: derive and solve a numerical.","Q: State the first law for a closed system.","Introduction, labelled diagram, steps, units, conclusion"
,,,,Zeroth law of thermodynamics,"If A and B are each in equilibrium with C, they are in equilibrium with each other.","2 marks: state the law.","Q: State the zeroth law.","Definition, one example, significance"
`

export function PromptEditor({toast}){
  const confirm=useConfirm()
  const [items,setItems]=useState(null),[draft,setDraft]=useState({}),[busy,setBusy]=useState('')
  const load=()=>api('/admin/prompts').then(r=>{setItems(r.items);setDraft({})}).catch(e=>toast(e.message));useEffect(()=>{load()},[])
  if(!items)return <div className="sk"/>
  const save=async x=>{const text=draft[x.kind];if(x.saved_answers>0&&!await confirm({title:tl("Save this prompt?"),body:tl("Saving discards the {n} written with the old prompt, so students get fresh ones.",{n:pl(x.saved_answers,'saved answer')}),ok:tl("Save prompt")}))return
    setBusy(x.kind);try{const r=await api('/admin/prompts/'+x.kind,{method:'PUT',body:{text}});toast(tl("Prompt saved{v}",{v:r.cleared?` · ${pl(r.cleared,'saved answer')} cleared`:''}));load()}catch(e){toast(e.message)}setBusy('')}
  const reset=async x=>{if(!await confirm({title:tl("Go back to the built-in prompt?"),body:x.saved_answers?tl("This also discards {n}.",{n:pl(x.saved_answers,'saved answer')}):null,ok:tl("Reset to built-in")}))return
    setBusy(x.kind);try{await api('/admin/prompts/'+x.kind,{method:'DELETE'});toast(tl("Back to the built-in prompt"));load()}catch(e){toast(e.message)}setBusy('')}
  return <><p className="known">{tl("These are the instructions the AI gets before it answers. Change the tone, depth, language or format to suit your students. Saving a prompt discards the saved answers it wrote, so the new wording applies from the next question (that costs tokens again).")}</p>
    <div className="qbox"><b>{tl("Built-in safety rules")}</b><p className="known" style={{margin:'4px 0 0'}}>{tl("Every AI request starts with the app's safety rules, ahead of the prompts below. They keep answers to studies and safe for young people, treat notes and uploads as material rather than instructions, and answer a student in crisis with care. They are part of the app's code: they cannot be changed or turned off here, and a prompt below cannot override them.")}</p>
      <GuardText/></div>
    {items.map(x=>{const v=draft[x.kind]??x.text,dirty=v.trim()!==x.text.trim()
      return <div key={x.kind} className="qbox"><b>{x.label}{x.custom&&<span className="chip" style={{marginLeft:8}}>{tl("Edited")}</span>}</b><p className="known" style={{margin:'4px 0 8px'}}>{x.help}</p>
        <textarea aria-label={tl("{label} prompt",{label:x.label})} rows={9} value={v} maxLength={4000} onChange={e=>setDraft({...draft,[x.kind]:e.target.value})}/>
        <small className="known">{v.length}{" "}{tl("/ 4000 characters")}</small>
        <div className="two"><button className="btn" disabled={!dirty||busy===x.kind||v.trim().length<20} onClick={()=>save(x)}>{tl("Save prompt")}</button><button className="btn ghost" disabled={busy===x.kind||(!x.custom&&!dirty)} onClick={()=>x.custom?reset(x):setDraft({...draft,[x.kind]:x.default})}>{x.custom?tl("Reset to built-in"):tl("Undo changes")}</button></div></div>})}</>}

export function SelfReg({cfg,run}){
  const [dom,setDom]=useState(null);const on=!!cfg.self_registration,shown=dom??cfg.allowed_domains??''
  return <><p className="known">{on?tl("On. The sign-in page shows “Create an account”. People confirm their email with a code, then you place them in a program and semester or year from Users (they show as Self-registered)."):tl("Off. Only admins can create accounts.")} {!cfg.mail_on&&tl("Without email set up (the Email tab), people can sign up only with Google, once Sign in with Google is set up below.")} {cfg.self_registered_users>0&&tl("{self_registered_users} people have registered themselves so far.",{self_registered_users:cfg.self_registered_users})}</p>
    <label className="chk"><input type="checkbox" checked={on} onChange={e=>run(()=>api('/admin/settings',{method:'PUT',body:{self_registration:e.target.checked}}),e.target.checked?'Self-registration is on':'Self-registration is off')}/>{" "}{tl("Allow people to register themselves")}</label>
    <label htmlFor="dom">{tl("Only these email domains (optional)")}</label><input id="dom" value={shown} onChange={e=>setDom(e.target.value)} placeholder={tl("college.edu, mail.college.edu")}/>
    <button className="btn ghost" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{allowed_domains:shown}}).then(()=>setDom(null)),'Domains saved')}>{tl("Save domains")}</button>
    <h3 className="sec">{tl("Free daily AI for self-registered people (Lite)")}</h3>
    <p className="known">{tl("They use your AI key within this allowance each day. Beyond it they can add their own key, or ask you for more: make them Pro until a date from Users. Saved answers never count.")}</p>
    <LiteLimits cfg={cfg} run={run}/>
    <h3 className="sec">{tl("Time away from learning")}</h3>
    <p className="known">{tl("Counted from learning (topics opened or learned, tests, MCQ sets), never from just opening the app. After the first number of days a student gets a welcome back and a lighter week; teachers see who is away.")}</p>
    <BreakDays cfg={cfg} run={run}/>
    <h3 className="sec">{tl("Response targets for student doubts")}</h3>
    <p className="known">{tl("Optional. When set, a doubt is marked overdue in the teachers' list after this many hours without an answer. Plain hours: nights, weekends and holidays count. 0 means no target.")}</p>
    <DoubtHours cfg={cfg} run={run}/></>}
export function DoubtHours({cfg,run}){  // S42: hours to a first answer and to a reply after a follow-up; 0: no target
  const [v,setV]=useState(null),cur=v||{a:String(cfg.doubt_hours?.[0]??0),b:String(cfg.doubt_hours?.[1]??0)}
  return <><div className="two"><div><label htmlFor="dh1">{tl("First answer within (hours)")}</label><input id="dh1" type="number" min="0" max="720" value={cur.a} onChange={e=>setV({...cur,a:e.target.value})}/></div>
    <div><label htmlFor="dh2">{tl("Reply to a follow-up within (hours)")}</label><input id="dh2" type="number" min="0" max="720" value={cur.b} onChange={e=>setV({...cur,b:e.target.value})}/></div></div>
    <button className="btn ghost" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{doubt_hours:[+cur.a||0,+cur.b||0]}}).then(()=>setV(null)),'Saved')}>{tl("Save")}</button></>}
export function BreakDays({cfg,run}){  // S39: when time away counts as an extended break, and when as a long one
  const [v,setV]=useState(null),cur=v||{a:String(cfg.break_days?.[0]??7),b:String(cfg.break_days?.[1]??30)}
  return <><div className="two"><div><label htmlFor="bd1">{tl("Extended break after (days)")}</label><input id="bd1" type="number" min="1" max="364" value={cur.a} onChange={e=>setV({...cur,a:e.target.value})}/></div>
    <div><label htmlFor="bd2">{tl("Long break after (days)")}</label><input id="bd2" type="number" min="2" max="365" value={cur.b} onChange={e=>setV({...cur,b:e.target.value})}/></div></div>
    <button className="btn ghost" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{break_days:[+cur.a||0,+cur.b||0]}}).then(()=>setV(null)),'Saved')}>{tl("Save")}</button></>}
export function GoogleSetting({cfg,run}){  // Sign in with Google: the web client ID from the Google Cloud project; the button shows on the sign-in page once it is set
  const [v,setV]=useState(null),shown=v??cfg.google_client_id??''
  return <><h3 className="sec">{tl("Sign in with Google")}</h3>
    <p className="known">{cfg.google_client_id?tl("On. The sign-in page shows Google's button. An account with the same email is linked the first time; with self-registration on, a new Google email can sign up without a code."):tl("Off. Paste the Web client ID from the Google Cloud project to turn it on.")}{cfg.google_from_env?' '+tl("It is set in the server's .env file."):''}</p>
    <label htmlFor="gcid">{tl("Google Web client ID")}</label><input id="gcid" value={shown} onChange={e=>setV(e.target.value)} placeholder="123456789-abc123.apps.googleusercontent.com" autoComplete="off" spellCheck={false}/>
    <button className="btn ghost" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{google_client_id:shown.trim()}}).then(()=>setV(null)),shown.trim()?'Google sign-in is on':'Google sign-in is off')}>{tl("Save")}</button></>}
export function LiteLimits({cfg,run}){
  const [v,setV]=useState(null),cur=v||{searches:String(cfg.lite?.searches??10),minutes:String(cfg.lite?.minutes??20)}
  return <><div className="two"><div><label htmlFor="ls">{tl("AI searches a day")}</label><input id="ls" type="number" min="0" max="1000" value={cur.searches} onChange={e=>setV({...cur,searches:e.target.value})}/></div>
    <div><label htmlFor="lm">{tl("Minutes of learning with AI a day")}</label><input id="lm" type="number" min="0" max="1000" value={cur.minutes} onChange={e=>setV({...cur,minutes:e.target.value})}/></div></div>
    <button className="btn ghost" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{lite_searches:+cur.searches||0,lite_minutes:+cur.minutes||0}}).then(()=>setV(null)),'Allowance saved')}>{tl("Save allowance")}</button></>}
export const USER_LISTS={faculty:"Teachers",student:"Students",guardian:"Parents and school teachers"}
// the safety rules every AI request starts with, read-only, for admins who want to see exactly what they say
export function GuardText(){
  const [t,setT]=useState(null)
  return t?<pre className="guardtx">{t}</pre>:<button className="link" style={{marginTop:6}} onClick={()=>api('/admin/guardrails').then(r=>setT(r.text)).catch(()=>{})}>{tl("Read the safety rules")}</button>}
export const useRun=(toast,load)=>async(fn,m)=>{try{await fn();toast(m);load&&load()}catch(e){toast(e.message)}}
export const USER_TEMPLATE=`name,email,password,role,program,semester
Asha Kumar,asha@example.com,,student,B.E. Mechanical Engineering,3
Ravi S,ravi@example.com,Welcome#2026,student,B.E. Mechanical Engineering,1
`

export const BULK_TEXT={disable:['Disable these accounts?','They can no longer sign in. Their progress and quiz results are kept, and you can enable them again.','Disable'],
  enable:['Enable these accounts?','They can sign in again.','Enable'],reset_passwords:['Reset these passwords?','Each person gets a new one-time password and must choose their own at next sign-in. Anyone signed in is signed out. You download the list once; it is not shown again.','Reset passwords']}
export function BulkSheet({act,ids,progs,toast,close,done}){
  const [p,setP]=useState(''),[s,setS]=useState(''),[busy,setBusy]=useState(false)
  if(act.kind==='result'){const r=act.r,cell=v=>'"'+String(v).replace(/"/g,'""')+'"'
    return <Sheet close={close}><h3>{pl(r.changed,'account')}{" "}{tl("updated")}</h3>
      {r.courses_needing_owner>0&&<p className="known">{pl(r.courses_needing_owner,'course')}{" "}{tl("now {v} no active owner. Assign new owners under Programs.",{v:r.courses_needing_owner===1?'has':'have'})}</p>}
      {r.skipped_count>0&&<div className="qbox"><b>{r.skipped_count}{" "}{tl("skipped")}</b>{r.skipped.slice(0,10).map(x=><p className="known" style={{margin:'4px 0'}} key={x.id}>{x.name}: {srv(x.reason)}</p>)}{r.skipped_count>10&&<p className="known">{tl("…and {v} more.",{v:r.skipped_count-10})}</p>}</div>}
      {r.credentials&&<button className="btn" onClick={()=>download('new-passwords.csv','name,email,password\n'+r.credentials.map(c=>[c.name,c.email,c.password].map(cell).join(',')).join('\n')+'\n')}>{tl("Download the new passwords")}</button>}
      <button className="btn ghost" onClick={close}>{tl("Close")}</button></Sheet>}
  const run=async()=>{setBusy(true);try{done(await api('/admin/users/bulk',{method:'POST',body:{ids,action:act.kind,...(act.kind==='set_placement'?{program_id:+p,semester:s?+s:null}:{})}}))}catch(e){toast(e.message);setBusy(false)}}
  if(act.kind==='set_placement')return <Sheet close={close}><h3>{tl("Move")}{" "}{pl(ids.length,'user')}</h3><p className="known">{tl("Sets the program and semester, year or grade of the selected students. Faculty and admins in the selection are skipped.")}</p>
    <label htmlFor="bp">{tl("Program")}</label><select id="bp" value={p} onChange={e=>{const id=e.target.value;setP(id);if(+s>semsOf(progs,id).length)setS('')}}><option value="">{tl("Choose a program")}</option>{progs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <label htmlFor="bs">{termOf(progs,p)}</label><select id="bs" value={s} onChange={e=>setS(e.target.value)}><option value="">{tl("Not set")}</option>{semsOf(progs,p).map(n=><option key={n} value={n}>{termOf(progs,p)} {n}</option>)}</select>
    <button className="btn" disabled={busy||!p} onClick={run}>{busy?tl("Working…"):tl("Move")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>
  const [t,d,l]=BULK_TEXT[act.kind]
  return <Sheet close={close}><h3>{t.replace('these',ids.length===1?'this':'these')}</h3><p className="known">{pl(ids.length,'account')}{" "}{tl("selected.")}{" "}{d}</p>
    <button className={'btn'+(act.kind==='disable'?' danger':'')} disabled={busy} onClick={run}>{busy?tl("Working…"):l}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export function Users({toast,me,role=''}){  // role: the Teachers (faculty), Students or Parents list; empty for everyone
  const [q,setQ]=useState(''),[prog,setProg]=useState(''),[sem,setSem]=useState(''),[order,setOrder]=useState('role'),[progs,setProgs]=useState([]),[plan,setPlan]=useState(()=>{const p=handoff.usersPlan;handoff.usersPlan='';return p})
  const [view,setView]=useState(null),[ed,setEd]=useState(null),[bulk,setBulk]=useState(null),fileRef=useRef(),[selMode,setSelMode]=useState(false),[sel,setSel]=useState([]),[act,setAct]=useState(null),[proCsv,setProCsv]=useState(false)
  const {items,total,page,setPage,reload:load}=usePaged(offset=>`/admin/users?q=${encodeURIComponent(q)}&order=${order}&limit=${PAGE}&offset=${offset}`+(role?'&role='+role:'')+(prog?'&program_id='+prog:'')+(sem?'&semester='+sem:'')+(plan?'&plan='+plan:''),[q,prog,sem,order,plan],toast)
  useEffect(()=>{api('/tree').then(t=>setProgs(t.map(p=>({id:p.id,name:p.name,term:p.term})))).catch(()=>{})},[])
  const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const text=await f.text();setBulk({stage:'preview',text,res:await api('/admin/users/import',{method:'POST',body:{csv:text,dry_run:true}})})}catch(err){toast(err.message)}}
  const commit=async()=>{try{setBulk({...bulk,stage:'done',res:await api('/admin/users/import',{method:'POST',body:{csv:bulk.text,dry_run:false}})});load()}catch(e){toast(e.message)}}
  const cell=v=>'"'+String(v).replace(/"/g,'""')+'"',r=bulk?.res,filtered=q||prog||sem||plan,lab=prog?termOf(progs,prog):progs.every(x=>x.term==='Semester')?'Semester':progs.length&&progs.every(x=>x.term==='Grade')?'Grade':'Term'
  if(view)return <UserDetail id={view} me={me} progs={progs} toast={toast} back={()=>{setView(null);load()}}/>
  return <><Bar title={tl(USER_LISTS[role]||"All users")} sub={filtered?matches(total):pl(total,'account')}/><div className="main">
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search users")} placeholder={tl("Search name, email, ID, program, semester, year or grade")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="filters">
      <select aria-label={tl("Filter by program")} value={prog} onChange={e=>{const id=e.target.value;setProg(id);if(+sem>semsOf(progs,id).length)setSem('')}}><option value="">{tl("All programs")}</option>{progs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label={tl("Filter by semester, year or grade")} value={sem} onChange={e=>setSem(e.target.value)}><option value="">{lab==='Term'?tl("All terms"):tl("All {lab}s",{lab:lab.toLowerCase()})}</option>{semsOf(progs,prog).map(n=><option key={n} value={n}>{lab} {n}</option>)}</select>
      <select aria-label={tl("Sort by")} value={order} onChange={e=>setOrder(e.target.value)}><option value="role">{tl("Sort: role, then name")}</option><option value="name">{tl("Sort: name")}</option><option value="program">{tl("Sort: program")}</option><option value="semester">{tl("Sort:")}{" "}{lab.toLowerCase()}</option><option value="newest">{tl("Sort: newest first")}</option></select>
      <select aria-label={tl("Filter by AI plan")} value={plan} onChange={e=>setPlan(e.target.value)}><option value="">{tl("All plans")}</option><option value="awaiting">{tl("Teachers waiting for approval")}</option><option value="lite">{tl("Lite")}</option><option value="pro">{tl("Pro")}</option><option value="pro_ending">{tl("Pro ending within 7 days")}</option><option value="own">{tl("Own key")}</option><option value="college">{tl("College")}</option><option value="family">{tl("Family key")}</option><option value="off">{tl("No AI")}</option><option value="asked">{tl("Asked for more AI")}</option></select></div>
    <div className="two"><button className="btn" onClick={()=>setEd({})}>{tl("New user")}</button><button className="btn ghost" onClick={()=>setBulk({stage:'pick'})}>{tl("Bulk upload")}</button>
    <button className="btn ghost" onClick={()=>setProCsv(true)}>{tl("Give Pro from a CSV")}</button>
    <button className="btn ghost" aria-pressed={selMode} onClick={()=>{setSelMode(!selMode);setSel([])}}>{selMode?tl("Done selecting"):tl("Select several users")}</button></div>
    {selMode&&items.length>0&&<div className="selbar"><button className="tool" onClick={()=>setSel(items.map(u=>u.id))}>{tl("Select all {length} shown",{length:items.length})}</button>{sel.length>0&&<button className="tool" onClick={()=>setSel([])}>{tl("Clear")}</button>}</div>}
    <div style={{height:14}}/>
    {items.length>0&&<div className="uhead" aria-hidden="true"><span>{tl("Name")}</span><span>{tl("Program")}</span><span>{lab==='Semester'?tl("Sem"):lab}</span></div>}
    {items.map(u=><button key={u.id} className={'utr'+(selMode?' sel':'')+(sel.includes(u.id)?' on':'')} onClick={()=>selMode?setSel(sel.includes(u.id)?sel.filter(i=>i!==u.id):[...sel,u.id]):setView(u.id)} aria-label={tl(selMode?(sel.includes(u.id)?'Deselect {name}':'Select {name}'):'Open {name}',{name:u.name})} aria-pressed={selMode?sel.includes(u.id):undefined}>
      <span className="nm">{selMode&&<span className="tick" aria-hidden="true">{sel.includes(u.id)&&<Check size={14}/>}</span>}<span className="dot" style={{background:COL[u.id%5]}}>{(u.name||'?')[0]}</span><span className="tx"><b>{u.name}</b>{(u.role!=='student'||!u.active||u.self_registered)&&<span className="tags">{u.role!=='student'&&<span className="pill">{roleName(u)}</span>}{u.approval==='pending'&&<span className="pill">{tl("Waiting for approval")}</span>}{u.self_registered&&<span className="pill">{tl("Self-registered")} · {tl(PLAN_NAME[u.plan]||'Lite')}</span>}{u.asked&&<span className="pill">{tl("Asked for more AI")}</span>}{!u.active&&<span className="pill off">{tl("Disabled")}</span>}</span>}</span></span>
      <span className="pg">{u.program||'—'}</span><span className="sn">{u.semester||'—'}</span></button>)}
    {!items.length&&<p className="known">{filtered?tl("No one matches that search."):tl("No users yet.")}</p>}
    <Pager page={page} total={total} onPage={setPage}/>
    <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={pick}/></div>
    {selMode&&sel.length>0&&<div className="actbar" role="toolbar" aria-label={tl("Actions for selected users")}><b>{sel.length}{" "}{tl("selected")}</b>
      <button className="tool" onClick={()=>setAct({kind:'set_placement'})}>{tl("Move…")}</button><button className="tool" onClick={()=>setAct({kind:'disable'})}>{tl("Disable")}</button><button className="tool" onClick={()=>setAct({kind:'enable'})}>{tl("Enable")}</button><button className="tool" onClick={()=>setAct({kind:'reset_passwords'})}>{tl("Reset passwords")}</button></div>}
    {act&&<BulkSheet act={act} ids={sel} progs={progs} toast={toast} close={()=>setAct(null)} done={r=>{setAct({kind:'result',r});setSel([]);load()}}/>}
    {proCsv&&<ProImport toast={toast} close={()=>setProCsv(false)} done={load}/>}
    {ed&&<UserSheet u={ed} me={me} progs={progs} toast={toast} close={()=>setEd(null)} done={()=>{setEd(null);load()}}/>}
    {bulk&&<Sheet page close={()=>setBulk(null)}>
      {bulk.stage==='pick'&&<><h3>{tl("Bulk upload users")}</h3><p className="known">{tl("One row per person with the columns name, email, password, role, program and semester (the year number for annual programs such as M.B.B.S). Leave the password blank to generate one. Role is student or admin and defaults to student. Program must match a name on the Programs tab, and semester is a number from 1 to 8. Emails that already exist are updated, and blank program or semester cells leave the current value alone.")}</p>
        <button className="btn ghost" onClick={()=>download('users-template.csv',USER_TEMPLATE)}>{tl("Download template")}</button><button className="btn" onClick={()=>fileRef.current.click()}>{tl("Choose CSV file")}</button></>}
      {bulk.stage==='preview'&&<><h3>{tl("Ready to upload")}</h3><p className="known">{r.valid_rows}{" "}{tl("of {rows} rows are valid: {created} new, {updated} updated.",{rows:r.rows,created:r.created,updated:r.updated})}{r.generated>0&&tl(" {generated} passwords will be generated.",{generated:r.generated})}</p>
        {r.error_count>0&&<div className="prose" style={{maxHeight:'28vh',overflow:'auto',fontSize:14}}><b>{r.error_count}{" "}{tl("rows will be skipped")}</b>{r.errors.map(e=><div key={e.row}>{tl("Row {row}:",{row:e.row})}{" "}{e.error}</div>)}</div>}
        <button className="btn" disabled={!r.valid_rows} onClick={commit}>{tl("Upload {valid_rows} rows",{valid_rows:r.valid_rows})}</button><button className="btn ghost" onClick={()=>setBulk(null)}>{tl("Cancel")}</button></>}
      {bulk.stage==='done'&&<><h3>{tl("Upload complete")}</h3><p className="known">{r.created}{" "}{tl("users created, {updated} updated.",{updated:r.updated})}{r.credentials.length>0&&tl(" Download the generated passwords now. They are not shown again.")}</p>
        {r.credentials.length>0&&<button className="btn" onClick={()=>download('new-user-passwords.csv','name,email,password\n'+r.credentials.map(c=>[c.name,c.email,c.password].map(cell).join(',')).join('\n')+'\n')}>{tl("Download passwords")}</button>}
        <button className="btn ghost" onClick={()=>setBulk(null)}>{tl("Close")}</button></>}
    </Sheet>}</>}

// Pro for many people at once: a CSV with each person's email or username and their last day of Pro ("end" stops it). Checked first, saved only on confirm.
export const PRO_TEMPLATE='email_or_username,pro_until\nasha@example.com,2026-12-31\nkavin,31-03-2027\nbala@example.com,end\n'
export function ProImport({toast,close,done}){
  const [st,setSt]=useState({stage:'pick'}),[busy,setBusy]=useState(false),file=useRef(),r=st.res
  const send=async(text,dry)=>{setBusy(true);try{const res=await api('/admin/users/pro-import',{method:'POST',body:{csv:text,dry_run:dry}});setSt({stage:dry?'preview':'done',text,res});if(!dry)done()}catch(e){toast(e.message)}setBusy(false)}
  const pick=async e=>{const f=e.target.files[0];e.target.value='';if(f)send(await f.text(),true)}
  const errs=r&&r.error_count>0&&<div className="prose" style={{maxHeight:'28vh',overflow:'auto',fontSize:14}}><b>{tl("{n} rows will be skipped",{n:r.error_count})}</b>{r.errors.map(e=><div key={e.row}>{tl("Row {row}:",{row:e.row})}{" "}{e.who?e.who+' · ':''}{tl(e.error)}</div>)}</div>
  return <Sheet page close={close}><input ref={file} type="file" accept=".csv,.txt,text/csv" hidden onChange={pick}/>
    {st.stage==='pick'&&<><h3>{tl("Give Pro from a CSV")}</h3>
      <p className="known">{tl("One row per person: their email or username, and the last day of Pro, written as 2026-12-31 or 31-12-2026. Each person can have a different day. Write end to stop someone's Pro. Only people who registered themselves and school students have a plan. You see what will change before anything is saved.")}</p>
      <button className="btn ghost" onClick={()=>download('pro-template.csv',PRO_TEMPLATE)}>{tl("Download template")}</button><button className="btn" disabled={busy} onClick={()=>file.current.click()}>{tl("Choose CSV file")}</button></>}
    {st.stage==='preview'&&<><h3>{tl("Check before saving")}</h3><p className="known">{tl("{pro} will be Pro and {ended} will stop being Pro.",{pro:r.pro,ended:r.ended})}</p>
      {r.rows.map(x=><div key={x.row} className="row"><div>{x.name}<small>{x.who}{x.was?' · '+tl("Pro now until {date}",{date:x.was}):''}</small></div><span className="chip">{x.until?tl("Pro until {date}",{date:x.until}):tl("Ends Pro")}</span></div>)}
      {errs}
      <button className="btn" disabled={busy||!r.rows.length} onClick={()=>send(st.text,false)}>{tl("Save for {n} people",{n:r.rows.length})}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></>}
    {st.stage==='done'&&<><h3>{tl("Saved")}</h3><p className="known">{tl("{pro} are Pro now and {ended} stopped being Pro. People with an email address are told by email.",{pro:r.pro,ended:r.ended})}</p>
      <button className="btn" onClick={close}>{tl("Close")}</button></>}
  </Sheet>}

// every course for admins: search, a program filter, sorting and pages; add, edit or delete here, or open a course for its units and topics
export function AdminCourses({toast,onOpen}){
  const confirm=useConfirm(),[q,setQ]=useState(''),[prog,setProg]=useState(''),[order,setOrder]=useState('name'),[status,setStatus]=useState('active'),[tree,setTree]=useState([]),[ed,setEd]=useState(null)
  useEffect(()=>{api('/tree').then(setTree).catch(()=>{})},[])
  const {items,total,page,setPage,reload}=usePaged(offset=>`/admin/courses?q=${encodeURIComponent(q)}&order=${order}&status=${status}&limit=${PAGE}&offset=${offset}`+(prog?'&program_id='+prog:''),[q,prog,order,status],toast)
  const sems=tree.flatMap(p=>p.semesters.map(x=>({id:x.id,label:p.name+' › '+x.name}))),done=()=>{setEd(null);reload()}
  const del=async c=>{if(!await confirm({title:tl("Delete “{name}”?",{name:c.name}),body:tl("This permanently deletes its {n}, {n2} and quizzes, with students' progress in them. To hide it instead, archive it from the course page.",{n:pl(c.units,'unit'),n2:pl(c.topics,'topic')}),ok:tl("Delete course"),danger:true}))return
    try{await api('/courses/'+c.id,{method:'DELETE'});toast(tl("Course deleted"));reload()}catch(e){toast(e.message)}}
  return <><Bar title={tl("Courses")} sub={q||prog?matches(total):pl(total,'course')}/><div className="main">
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search courses")} placeholder={tl("Search course, program, semester or owner")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="filters"><select aria-label={tl("Filter by program")} value={prog} onChange={e=>setProg(e.target.value)}><option value="">{tl("All programs")}</option>{tree.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label={tl("Sort by")} value={order} onChange={e=>setOrder(e.target.value)}><option value="name">{tl("Sort: name A to Z")}</option><option value="name_desc">{tl("Sort: name Z to A")}</option><option value="program">{tl("Sort: program, then term")}</option><option value="topics">{tl("Sort: most topics")}</option><option value="newest">{tl("Sort: newest first")}</option></select>
      <select aria-label={tl("Show")} value={status} onChange={e=>setStatus(e.target.value)}><option value="active">{tl("Active courses")}</option><option value="archived">{tl("Archived courses")}</option><option value="all">{tl("All courses")}</option></select></div>
    <button className="btn" onClick={()=>setEd({})}>{tl("New course")}</button>
    <div style={{height:14}}/>
    {items.length>0&&<div className="uhead c" aria-hidden="true"><span>{tl("Course")}</span><span>{tl("Program › term")}</span><span>{tl("Topics")}</span><span/></div>}
    {items.map(c=><div key={c.id} className="utr c"><button className="nm" onClick={()=>onOpen([c.program_id,c.semester_id,c.id].filter(x=>x!=null))} aria-label={tl("Open {name}",{name:c.name})}><span className="dot" style={{background:COL[c.id%5]}}>{(c.name||'?')[0]}</span><span className="tx"><b>{c.name}{c.archived&&<span className="pill off sm">{tl("Archived")}</span>}</b><small className="sub">{srv(c.owner_problem)||tl("Owner: {owner}",{owner:c.owner})}</small></span></button>
      <span className="pg">{[c.program,c.semester].filter(Boolean).join(' › ')||'—'}</span><span className="sn">{c.topics}</span>
      <span className="rowacts"><button className="ic sm" aria-label={tl("Edit {name}",{name:c.name})} title={tl("Edit")} onClick={()=>setEd(c)}><Pencil size={17}/></button><button className="ic sm" aria-label={tl("Delete {name}",{name:c.name})} title={tl("Delete")} onClick={()=>del(c)}><Trash2 size={17}/></button></span></div>)}
    {!items.length&&<p className="known">{q||prog?tl("No course matches that search."):status==='archived'?tl("No archived courses."):tl("No courses yet. Add one, or bulk upload a CSV under Programs.")}</p>}
    <Pager page={page} total={total} onPage={setPage}/></div>
    {ed&&(ed.id?<CourseSheet c={{id:ed.id,name:ed.name,owner_id:ed.owner_id,owner:ed.owner}} pid={ed.program_id} sid={ed.semester_id} sems={sems} term={ed.term} toast={toast} close={()=>setEd(null)} done={done}/>
      :<NewCourseSheet tree={tree} toast={toast} close={()=>setEd(null)} done={done}/>)}</>}
export function NewCourseSheet({tree,toast,close,done}){  // a course is made inside a program's semester or year: pick both, then name it and, optionally, its owner
  const faculty=useFaculty(true),[f,setF]=useState({pid:tree.length===1?String(tree[0].id):'',sid:'',name:'',owner:''}),[busy,setBusy]=useState(false)
  const p=tree.find(x=>String(x.id)===f.pid),sems=p?.semesters||[],term=p?.term||'Semester'
  const save=async()=>{setBusy(true);try{await api(`/programs/${f.pid}/semesters/${f.sid}/courses`,{method:'POST',body:{name:f.name,...(f.owner?{faculty_owner_id:+f.owner}:{})}});toast(tl("Course added"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet page close={close}><h3>{tl("New course")}</h3>
    <label htmlFor="ncp">{tl("Program")}</label><select id="ncp" value={f.pid} onChange={e=>setF({...f,pid:e.target.value,sid:''})}><option value="">{tree.length?tl("Choose a program"):tl("Add a program first")}</option>{tree.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <label htmlFor="ncs">{term}</label><select id="ncs" value={f.sid} disabled={!p} onChange={e=>setF({...f,sid:e.target.value})}><option value="">{tl("Choose a")}{" "}{term.toLowerCase()}</option>{sems.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    {p&&!sems.length&&<p className="known">{p.name}{" "}{tl("has no {term} yet. Add one under Programs first.",{term:term.toLowerCase()})}</p>}
    <label htmlFor="ncn">{tl("Name")}</label><input id="ncn" value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder={tl("Thermodynamics")}/>
    <label htmlFor="nco">{tl("Owner (faculty)")}</label><select id="nco" value={f.owner} onChange={e=>setF({...f,owner:e.target.value})}><option value="">{tl("Not assigned")}</option>{faculty.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select>
    <button className="btn" disabled={busy||!f.sid||!f.name.trim()} onClick={save}>{tl("Add course")}</button></Sheet>}
export function Programs({toast,onOpen}){
  const [q,setQ]=useState(''),[order,setOrder]=useState('name'),[status,setStatus]=useState('active')
  const [view,setView]=useState(null),[ed,setEd]=useState(null),[bulk,setBulk]=useState(null),fileRef=useRef()
  const {items,total,page,setPage,reload:load}=usePaged(offset=>`/admin/programs?q=${encodeURIComponent(q)}&order=${order}&status=${status}&limit=${PAGE}&offset=${offset}`,[q,order,status],toast)
  const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const text=await f.text();setBulk({stage:'preview',text,res:await api('/admin/import',{method:'POST',body:{csv:text,dry_run:true}})})}catch(err){toast(err.message)}}
  const commit=async()=>{try{setBulk({...bulk,stage:'done',res:await api('/admin/import',{method:'POST',body:{csv:bulk.text,dry_run:false}})});load()}catch(e){toast(e.message)}}
  const r=bulk?.res,made=r&&Object.entries(r.created).filter(([,v])=>v).map(([k,v])=>v+' '+k).join(', ')||'nothing new'
  if(view)return <ProgramDetail id={view} onOpen={onOpen} toast={toast} back={()=>{setView(null);load()}}/>
  return <><Bar title={tl("Programs")} sub={q?matches(total):pl(total,'program')}/><div className="main">
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search programs")} placeholder={tl("Search program, semester, year or course")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="filters"><select aria-label={tl("Sort by")} value={order} onChange={e=>setOrder(e.target.value)}><option value="name">{tl("Sort: name")}</option><option value="students">{tl("Sort: most students")}</option><option value="newest">{tl("Sort: newest first")}</option></select><select aria-label={tl("Show")} value={status} onChange={e=>setStatus(e.target.value)}><option value="active">{tl("Active programs")}</option><option value="archived">{tl("Archived programs")}</option><option value="all">{tl("All programs")}</option></select></div>
    <div className="two"><button className="btn" onClick={()=>setEd({})}>{tl("New program")}</button><button className="btn ghost" onClick={()=>setBulk({stage:'pick'})}>{tl("Bulk upload")}</button></div>
    <div style={{height:14}}/>
    {items.length>0&&<div className="uhead p" aria-hidden="true"><span>{tl("Program")}</span><span>{tl("Courses")}</span><span>{tl("Students")}</span></div>}
    {items.map(x=><button key={x.id} className="utr p" onClick={()=>setView(x.id)} aria-label={tl("Open {name}",{name:x.name})}>
      <span className="nm"><span className="dot" style={{background:COL[x.id%5]}}>{(x.name||'?')[0]}</span><span className="tx"><b>{x.name}{x.archived&&<span className="pill off sm">{tl("Archived")}</span>}</b><small className="sub">{pl(x.semesters,x.term.toLowerCase())}{tl(", {topics} topics",{topics:x.topics})}</small></span></span>
      <span className="sn">{x.courses}</span><span className="sn">{x.students}</span></button>)}
    {!items.length&&<p className="known">{q?tl("No program matches that search."):status==='archived'?tl("No archived programs."):tl("No programs yet. Add one or bulk upload a CSV.")}</p>}
    <Pager page={page} total={total} onPage={setPage}/>
    <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={pick}/></div>
    {ed&&<ProgramSheet p={ed} toast={toast} close={()=>setEd(null)} done={()=>{setEd(null);load()}}/>}
    {bulk&&<Sheet page close={()=>setBulk(null)}>
      {bulk.stage==='pick'&&<><h3>{tl("Bulk upload content")}</h3><p className="known">{tl("One row per topic, with the columns program, semester, course, unit and topic, plus optional content, question_pattern, sample_content and guideline. Blank program, semester, course or unit cells repeat the row above. Existing names are reused and existing topics are updated. Programs that don't exist yet are created.")}{" "}{tl("Leave topic blank to add only the units, for a syllabus outline.")}</p>
        <button className="btn ghost" onClick={()=>download('template.csv',TEMPLATE)}>{tl("Download template")}</button><button className="btn" onClick={()=>fileRef.current.click()}>{tl("Choose CSV file")}</button></>}
      {bulk.stage==='preview'&&<><h3>{tl("Ready to upload")}</h3><p className="known">{r.valid_rows}{" "}{tl("of {rows} rows are valid. New: {made}. Topics updated: {updated_topics}.",{rows:r.rows,made:made,updated_topics:r.updated_topics})}</p>
        {r.error_count>0&&<div className="prose" style={{maxHeight:'28vh',overflow:'auto',fontSize:14}}><b>{r.error_count}{" "}{tl("rows will be skipped")}</b>{r.errors.map(e=><div key={e.row}>{tl("Row {row}:",{row:e.row})}{" "}{e.error}</div>)}</div>}
        <button className="btn" disabled={!r.valid_rows} onClick={commit}>{tl("Upload {valid_rows} rows",{valid_rows:r.valid_rows})}</button><button className="btn ghost" onClick={()=>setBulk(null)}>{tl("Cancel")}</button></>}
      {bulk.stage==='done'&&<><h3>{tl("Upload complete")}</h3><p className="known">{tl("Created {made}. {updated_topics} topics updated.",{made:made,updated_topics:r.updated_topics})}{r.error_count>0&&tl(" {error_count} rows were skipped.",{error_count:r.error_count})}</p>
        <button className="btn ghost" onClick={()=>setBulk(null)}>{tl("Close")}</button></>}
    </Sheet>}</>}

export function RolloverSheet({p,close,done,toast}){
  const [fin,setFin]=useState('keep'),[r,setR]=useState(null),[busy,setBusy]=useState(false)
  const url=`/admin/programs/${p.id}/rollover`
  useEffect(()=>{setR(null);api(url,{method:'POST',body:{dry_run:true,finishing:fin}}).then(setR).catch(e=>{toast(e.message);close()})},[fin]) 
  const go=async()=>{setBusy(true);try{const x=await api(url,{method:'POST',body:{dry_run:false,finishing:fin}});toast(`${x.moved} students moved up`+(fin==='deactivate'&&x.finishing?`, ${x.finishing} accounts switched off`:''));done()}catch(e){toast(e.message);setBusy(false)}}
  return <Sheet page close={close}><h3>{tl("Start a new term")}</h3><p className="known">{tl("Moves every active student of {name} up one {v}. Do this once, when the new term begins.",{name:p.name,v:p.term?.toLowerCase()||'semester'})}</p>
    {!r?<div className="sk"/>:<div className="qbox" style={{marginTop:0}}>
      <div className="row"><div>{pl(r.moved,'student')}<small>{r.moved===1?'moves':'move'}{" "}{tl("up one")}{" "}{r.term.toLowerCase()}</small></div></div>
      <div className="row"><div>{pl(r.finishing,'student')}<small>{r.finishing===1?'is':'are'}{" "}{tl("in the last {term} ({term2} {last_semester})",{term:r.term.toLowerCase(),term2:r.term,last_semester:r.last_semester})}{r.finishing_names.length?': '+r.finishing_names.join(', ')+(r.finishing>r.finishing_names.length?'…':''):''}</small></div></div>
      {r.unplaced>0&&<div className="row"><div>{pl(r.unplaced,'student')}<small>{r.unplaced===1?'has':'have'}{" "}{tl("no {term} set and are left alone:",{term:r.term.toLowerCase()})}{" "}{r.unplaced_names.join(', ')}</small></div></div>}</div>}
    <label htmlFor="fin">{tl("Students finishing the program")}</label><select id="fin" value={fin} onChange={e=>setFin(e.target.value)}><option value="keep">{tl("Leave them as they are")}</option><option value="deactivate">{tl("Switch their accounts off")}</option></select>
    <button className="btn" disabled={busy||!r||(!r.moved&&!(fin==='deactivate'&&r.finishing))} onClick={go}>{busy?tl("Working…"):tl("Apply")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export function ProgramDetail({id,back,onOpen,toast}){
  const [p,setP]=useState(null),[ed,setEd]=useState(false),[ask,setAsk]=useState(false),[busy,setBusy]=useState(false),[addSem,setAddSem]=useState(false),[term,setTerm]=useState(false),[arch,setArch]=useState(null)
  const load=()=>api('/admin/programs/'+id).then(setP).catch(e=>{toast(e.message);back()})
  useEffect(()=>{load()},[id])
  if(!p)return <><Bar title={tl("Loading")} back={back}/><div className="main"><div className="sk"/><div className="sk"/></div></>
  const del=async()=>{setBusy(true);try{await api('/programs/'+p.id,{method:'DELETE'});toast(tl("Program deleted"));back()}catch(e){toast(e.message);setBusy(false)}}
  const row=(v,l,k)=><div className="row" key={k}><div>{v}<small>{l}</small></div></div>
  return <><Bar title={p.name} sub={pl(p.semesters,p.term.toLowerCase())+(p.pattern==='year'?' · annual':p.pattern==='grade'?' · school':'')+(p.archived?' · archived':'')} back={back}/><div className="main">
    {p.archived&&<p className="known" style={{marginTop:0}}>{tl("This program is archived. Students see its courses as unavailable right now. Restore it to bring everything back.")}</p>}
    <button className="btn ghost lead" onClick={()=>setArch({kind:'programs',id:p.id,name:p.name,on:!p.archived})}>{p.archived?tl("Restore program"):tl("Archive program")}</button>
    <div className="stats">{[['semesters',p.term+'s'],['courses',tl("Courses")],['topics',tl("Topics")],['students',tl("Students")]].map(([k,l])=><div className="stat" key={k}><b>{p[k]}</b>{l}</div>)}</div>
    <h3 className="sec">{p.term}s</h3>
    {p.semester_list.length?<Paged rows={p.semester_list} render={(x,i)=><div key={x.id} className="card"><button className="hit" onClick={()=>onOpen([p.id,x.id])}><span className="dot" style={{background:COL[i%5]}}>{x.number||'?'}</span><div><b>{x.name}<ArchPill x={x}/></b><span>{tl("{v}{courses} courses, {topics} topics",{v:x.number?'':'No '+p.term.toLowerCase()+' number set · ',courses:x.courses,topics:x.topics})}</span></div></button>{!p.archived&&<button className="ic sm" aria-label={(x.archived_self?'Restore ':'Archive ')+x.name} onClick={()=>setArch({kind:'semesters',id:x.id,name:x.name,on:!x.archived_self})}>{x.archived_self?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button>}</div>}/>:<p className="known">{tl("No {term}s yet.",{term:p.term.toLowerCase()})}</p>}
    <button className="btn ghost" onClick={()=>setAddSem(true)}>{tl("Add")}{" "}{p.term.toLowerCase()}</button>
    <h3 className="sec">{tl("Students")}</h3>
    {p.student_list.length?<Paged rows={p.student_list} render={u=>row(u.name,(u.semester?tl('{term} {n}',{term:p.term,n:u.semester}):tl("{term} not set",{term:p.term}))+(u.active?'':tl(', disabled')),u.id)}/>:<p className="known">{tl("No students are enrolled yet. Set a program on a user's page.")}</p>}
    {p.students>p.student_list.length&&<p className="known">{tl("Showing {length} of {students}. Use Users to see everyone.",{length:p.student_list.length,students:p.students})}</p>}
    {p.students>0&&<button className="btn ghost" onClick={()=>setTerm(true)}>{tl("Start a new term (move students up)")}</button>}
    <div className="two"><button className="btn ghost" onClick={()=>setEd(true)}>{tl("Edit")}</button><button className="btn danger" onClick={()=>setAsk(true)}>{tl("Delete")}</button></div>
    <button className="btn ghost" onClick={()=>onOpen([p.id])}>{tl("Open {term}s and courses",{term:p.term.toLowerCase()})}</button></div>
    {term&&<RolloverSheet p={p} toast={toast} close={()=>setTerm(false)} done={()=>{setTerm(false);load()}}/>}
    {ed&&<ProgramSheet p={p} toast={toast} close={()=>setEd(false)} done={()=>{setEd(false);load()}}/>}
    {arch&&<ArchiveSheet a={arch} toast={toast} close={()=>setArch(null)} done={()=>{setArch(null);load()}}/>}
    {addSem&&<SemesterSheet sem={{}} pid={p.id} term={p.term} toast={toast} close={()=>setAddSem(false)} done={()=>{setAddSem(false);load()}}/>}
    {ask&&<Sheet close={()=>setAsk(false)}><h3>{tl("Delete “{name}”?",{name:p.name})}</h3><p className="known">{tl("This permanently deletes {n}, {courses} courses, {units} units and {topics} topics, including their saved AI answers.",{n:pl(p.semesters,p.term.toLowerCase()),courses:p.courses,units:p.units,topics:p.topics})}{p.students>0&&tl(" The {students} enrolled students keep their accounts but lose their program.",{students:p.students})}</p>
      <button className="btn danger" disabled={busy} onClick={del}>{tl("Delete program")}</button><button className="btn ghost" onClick={()=>setAsk(false)}>{tl("Cancel")}</button></Sheet>}</>}

export function Branding({toast,onSaved}){
  const [name,setName]=useState(''),[logo,setLogo]=useState(null),[busy,setBusy]=useState(false),file=useRef(null)
  useEffect(()=>{api('/config').then(c=>{setName(c.name);setLogo(c.logo)}).catch(()=>{})},[])
  const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;setBusy(true)
    try{const r=await fetch(ROOT+'/api/uploads',{method:'POST',headers:{Authorization:'Bearer '+localStorage.t,'Content-Type':f.type},body:f}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(tl(j.detail||'Upload failed'));setLogo(j.url)}catch(x){toast(x.message)}setBusy(false)}
  const save=async body=>{setBusy(true);try{await api('/admin/branding',{method:'PUT',body});toast(tl("Saved"));onSaved()}catch(e){toast(e.message)}setBusy(false)}
  return <><h3 className="sec first">{tl("Institution name and logo")}</h3><p className="known">{tl("Shown on the sign-in page and in the menu. Use a square PNG, JPG or WebP under 3 MB.")}</p>
    <div className="lpreview"><Logo src={logo} size={48}/><b>{name||tl("Name")}</b></div>
    <label htmlFor="inst">{tl("Name")}</label><input id="inst" value={name} maxLength={60} onChange={e=>setName(e.target.value)}/>
    <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick}/>
    <div className="two"><button className="btn ghost" disabled={busy} onClick={()=>file.current.click()}><Upload size={16}/> {logo?tl("Replace logo"):tl("Upload logo")}</button>
      <button className="btn ghost" disabled={busy||!logo} onClick={()=>{setLogo(null);save({remove_logo:true,name})}}>{tl("Remove logo")}</button></div>
    <button className="btn" disabled={busy} onClick={()=>save({name,logo_url:logo||undefined})}>{tl("Save name and logo")}</button></>}
export function AiConfig({toast,onBrand}){
  const confirm=useConfirm()
  const [cfg,setCfg]=useState({}),[key,setKey]=useState(''),[model,setModel]=useState(''),[st,setSt]=useState({}),[tab,setTab]=useState(()=>{const t=handoff.settingsTab||'ai';handoff.settingsTab='';return t}),[vkey,setVkey]=useState(''),[vmodel,setVmodel]=useState(''),[lim,setLim]=useState({}),[prov,setProv]=useState('')
  const load=()=>{api('/admin/settings').then(c=>{setCfg(c);setProv(p=>p||c.provider);setVmodel(c.vision_model);setLim(Object.fromEntries(Object.entries(c.budget||{}).map(([p,b])=>[p,String(b.limit||'')])))});api('/admin/stats').then(setSt)};useEffect(load,[])
  const run=useRun(toast,load),provs=cfg.providers||[],pv=provs.find(x=>x.id===prov),active=prov===cfg.provider
  useEffect(()=>{setModel(pv?.model_saved||'');setKey('')},[prov,pv?.model_saved])
  return <><Bar title={tl("Settings")} sub={cfg.key_set?tl("AI is on · {name} key {key_hint}",{name:cfg.provider_name,key_hint:cfg.key_hint}):tl("AI is off · no key yet")}/><div className="main cfg"><Tabs label={tl("Settings sections")} scroll items={[['ai','AI'],['prompts',tl("AI prompts")],['school',tl("Institution")],['access',tl("Sign-in")],['mail',tl("Email")],['pay',tl("Payments")],['costs',tl("AI costs")]]} value={tab} onChange={setTab}/>
    {tab==='school'&&<Branding toast={toast} onSaved={onBrand}/>}{tab==='ai'&&<>
    <label htmlFor="aip">{tl("AI provider")}</label><select id="aip" value={prov} onChange={e=>setProv(e.target.value)}>{provs.map(x=><option key={x.id} value={x.id}>{x.name}{x.id===cfg.provider?' · '+tl("in use"):x.key_set?' · '+tl("key saved"):''}</option>)}</select>
    <p className="known" style={{marginTop:4}}>{tl("The college answers with one provider at a time. Keys saved for the others are kept, so you can switch back. Saved answers keep working after a switch.")}{pv?' '+tl("Create a key at {site}.",{site:pv.console}):''}</p>
    {pv&&<><label htmlFor="aik">{tl("{name} API key",{name:pv.name})}</label><input id="aik" type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder={pv.key_set?tl("Leave blank to keep the current key")+' ('+pv.key_hint+')':tl("Paste the key")}/>
    <label htmlFor="aim">{tl("Model")}</label><input id="aim" value={model} onChange={e=>setModel(e.target.value)} placeholder={pv.model}/>
    <button className="btn" disabled={!pv.key_set&&!key.trim()} onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{ai_provider:prov,keys:{[prov]:key},models:{[prov]:model}}}).then(()=>setKey('')),active?'AI settings saved':'AI provider changed')}>{active?tl("Save"):tl("Save and use {name}",{name:pv.name})}</button>
    {active&&cfg.key_set&&<button className="btn ghost" onClick={async()=>{try{toast(srv((await api('/admin/ai/test',{method:'POST'})).message))}catch(e){toast(e.message)}}}>{tl("Test the key")}</button>}
    {pv.key_set&&<button className="btn ghost" onClick={async()=>{if(!active||await confirm({title:tl("Turn AI off for everyone?"),body:tl("Students will see “AI unavailable” until you save a key again."),ok:tl("Turn AI off"),danger:true}))run(()=>api('/admin/settings',{method:'PUT',body:{remove_keys:[prov]}}),active?'AI is off':'Key removed')}}>{active?tl("Remove the key (turn AI off)"):tl("Remove this key")}</button>}</>}
    <h3 className="sec">{tl("Photos of diagrams (Claude)")}</h3>
    <p className="known" style={{marginTop:0}}>{tl("Students can photograph a question, text or diagram and ask about it. The text in a photo is read on this server and only that text goes to the AI provider above. To let the AI look at diagrams, add a Claude API key: then, when a student says their question is about a diagram, the photo goes to Claude. Without a key, diagrams are read for their labels only.")}{" "}{cfg.ocr?'':tl("Reading text from photos needs Tesseract on this server (see Production first run in the README).")}</p>
    <label>{tl("Claude API key")}</label><input type="password" value={vkey} onChange={e=>setVkey(e.target.value)} placeholder={cfg.vision_set?tl("Leave blank to keep the current key")+' ('+cfg.vision_hint+')':'sk-ant-…'}/>
    <label>{tl("Vision model")}</label><input value={vmodel} onChange={e=>setVmodel(e.target.value)} placeholder="claude-opus-5-5"/>
    <button className="btn" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{vision_key:vkey,vision_model:vmodel}}).then(()=>setVkey('')),'Claude settings saved')}>{tl("Save")}</button>
    {cfg.vision_set&&<><button className="btn ghost" onClick={async()=>{try{toast((await api('/admin/vision/test',{method:'POST'})).message)}catch(e){toast(e.message)}}}>{tl("Test the key")}</button>
      <button className="btn ghost" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{remove_vision_key:true}}),'Claude key removed')}>{tl("Remove the Claude key")}</button></>}
    <h3 className="sec">{tl("Monthly AI allowance")}</h3>
    <p className="known" style={{marginTop:0}}>{tl("A limit on the tokens the college's keys can use each month. When one is used up, new AI answers stop until the 1st; saved answers keep working, and people using their own key are not affected. You are warned on Home at 80%. Leave it at 0 for no limit.")}</p>
    {provs.filter(x=>x.key_set||x.budget.limit||x.budget.used).map(({id:p,name})=>{const b=cfg.budget?.[p]||{used:0,limit:0};return <div key={p}><label>{tl("{name} tokens a month",{name})}</label>
      <input inputMode="numeric" value={lim[p]} onChange={e=>setLim({...lim,[p]:e.target.value.replace(/\D/g,'')})} placeholder="0"/>
      <small className="known">{tl("Used this month: {used}",{used:b.used.toLocaleString()})}{b.limit?' · '+tl("{p}% of the allowance",{p:Math.round(100*b.used/b.limit)}):''}</small>
      {b.limit>0&&<div className="meter"><i style={{width:Math.min(100,Math.round(100*b.used/b.limit))+'%'}}/></div>}</div>})}
    <button className="btn" onClick={()=>run(()=>api('/admin/settings',{method:'PUT',body:{budgets:Object.fromEntries(Object.entries(lim).map(([p,v])=>[p,+v||0]))}}),'Allowance saved')}>{tl("Save allowance")}</button>
    <p className="known" style={{marginTop:20}}>{tl("One key serves every student added by staff (people who register themselves use their own key). Until a key is saved, students see “AI unavailable. Try again later.” Each topic is explained once and the answer is shared with every student. {v} answers are saved so far, which has saved about {v2} tokens.",{v:(st.cached??0).toLocaleString(),v2:(st.tokens_saved??0).toLocaleString()})}</p>
    </>}{tab==='prompts'&&<PromptEditor toast={toast}/>}
    {tab==='access'&&<><h3 className="sec first">{tl("Self-registration")}</h3><SelfReg cfg={cfg} run={run}/><GoogleSetting cfg={cfg} run={run}/>
    <h3 className="sec">{tl("Password reset email")}</h3><p className="known">{cfg.mail_on?tl("On. People can reset their own password from the sign-in page."):tl("Off. The sign-in page tells people to ask an admin. Set up a sender under Email to turn it on.")}</p>
    {!cfg.mail_on&&<button className="btn ghost" onClick={()=>setTab('mail')}>{tl("Set up email")}</button>}</>}
    {tab==='mail'&&<MailSettings toast={toast} onSaved={load}/>}{tab==='pay'&&<PaySettings toast={toast}/>}{tab==='costs'&&<AiCosts toast={toast}/>}</div></>}
// Settings > AI costs: what the college's keys cost, from the tokens the providers billed, at the prices the admin enters (per million tokens).
// By plan with the spread per person, by kind of request, and the people who used the most. Own keys cost the college nothing and are shown apart.
export const KIND_NAME={...FLAG_KIND,mcq:'MCQ sets',vision:'Photos of diagrams (Claude)',translate:'Translations',doubt:'Doubts',review:'Review',other:'Other'}
export function AiCosts({toast}){
  const [days,setDays]=useState('30'),[r,setR]=useState(null),[rate,setRate]=useState({}),[cur0,setCur0]=useState(''),[names,setNames]=useState([]),[busy,setBusy]=useState(false)
  const load=()=>api('/admin/costs?days='+days).then(x=>{setR(x);setRate(Object.fromEntries(Object.entries(x.rates.prices).map(([p,v])=>[p,v?String(v):''])));setCur0(x.rates.currency)}).catch(e=>toast(e.message))
  useEffect(()=>{api('/admin/budget').then(b=>setNames(Object.entries(b.names||{}))).catch(()=>{})},[])
  useEffect(()=>{load()},[days])
  const save=async()=>{setBusy(true);try{await api('/admin/costs/rates',{method:'PUT',body:{prices:Object.fromEntries(Object.entries(rate).map(([p,v])=>[p,+v||0])),currency:cur0}});toast(tl("Prices saved"));await load()}catch(e){toast(srv(e.message))}setBusy(false)}
  if(!r)return <Skeleton rows={4}/>
  const cur=r.rates.currency,money=v=>cur+(v<1&&v>0?v.toFixed(2):Math.round(v).toLocaleString()),num=v=>(v||0).toLocaleString(),t=r.total
  return <><h3 className="sec first">{tl("Prices")}</h3>
    <p className="known" style={{marginTop:0}}>{tl("What your providers charge for a million tokens, from their price pages or your bill. Tokens are counted as the providers bill them; questions sent with a person's own key cost the college nothing and are shown apart.")}</p>
    {names.map(([p,name])=><div key={p}><label htmlFor={'cp'+p}>{tl("{name}, per million tokens",{name})}</label><input id={'cp'+p} inputMode="decimal" value={rate[p]||''} onChange={e=>setRate({...rate,[p]:e.target.value.replace(/[^\d.]/g,'')})} placeholder="0"/></div>)}
    <label htmlFor="ccur">{tl("Currency sign")}</label><input id="ccur" value={cur0} maxLength={4} onChange={e=>setCur0(e.target.value)} placeholder="₹"/>
    <button className="btn" disabled={busy} onClick={save}>{tl("Save prices")}</button>
    <h3 className="sec">{tl("Usage")}</h3>
    <div className="filters fit"><Opts label={tl("Period")} value={days} set={setDays} items={[['7',tl("Last 7 days")],['30',tl("Last 30 days")],['90',tl("Last 90 days")]]}/></div>
    <div className="qbox" style={{marginTop:0}} role="status">{r.priced?<><b>{money(t.cost)}</b>{" "}{tl("in the last {n} days",{n:r.days})}{r.days!==30&&<> · {tl("about {v} a month",{v:money(t.per_30_days)})}</>}</>:<b>{tl("Enter the prices above to see costs.")}</b>}
      <p className="known" style={{margin:'4px 0 0'}}>{tl("{n} requests · {k} tokens",{n:num(t.requests),k:num(t.tokens)})}{t.own_tokens?' · '+tl("own keys {o} tokens",{o:num(t.own_tokens)}):''}</p></div>
    {r.providers.length>0&&<><h3 className="sec">{tl("By provider")}</h3>
    {r.providers.map(p=><div key={p.provider} className="row"><div><b>{p.name}</b><small>{tl("{k} tokens",{k:num(p.tokens)})}{p.own_tokens?' · '+tl("own keys {o} tokens",{o:num(p.own_tokens)}):''}</small></div>{r.priced&&<span className="chip">{money(p.cost)}</span>}</div>)}</>}
    <h3 className="sec">{tl("By plan")}</h3>
    <p className="known" style={{marginTop:0}}>{tl("Cost a month for each person who used AI: the average, the middle person, the top 10% and the highest. Use it to set prices that cover heavy users.")}</p>
    {!r.plans.length?<p className="known">{tl("No AI use in this period.")}</p>:r.plans.map(p=><div key={p.plan} className="row"><div><b>{tl(PLAN_NAME[p.plan]||(p.plan==='staff'?'Staff':'Deleted accounts'))}</b>
      <small>{tl("{a} of {n} people used AI · {q} requests · {k} tokens",{a:num(p.active),n:num(p.people),q:num(p.requests),k:num(p.tokens)})}</small>
      {r.priced&&p.active>0&&<small>{tl("A month per person: average {avg} · middle {median} · top 10% {p90} · highest {max}",{avg:money(p.per_active_30_days.avg),median:money(p.per_active_30_days.median),p90:money(p.per_active_30_days.p90),max:money(p.per_active_30_days.max)})}</small>}</div>
      {r.priced&&<span className="chip">{money(p.cost)}</span>}</div>)}
    <h3 className="sec">{tl("By kind")}</h3>
    {r.kinds.map(k=><div key={k.kind} className="row"><div>{tl(KIND_NAME[k.kind]||k.kind)}<small>{tl("{q} requests · {k} tokens",{q:num(k.requests),k:num(k.tokens)})}{k.own_tokens?' · '+tl("own keys {o} tokens",{o:num(k.own_tokens)}):''}</small></div>{r.priced&&<span className="chip">{money(k.cost)}</span>}</div>)}
    <h3 className="sec">{tl("Who used the most")}</h3>
    {r.top.map(u=><div key={u.id} className="row"><div><b>{u.name}</b><small>{u.email}{u.email?' · ':''}{tl(PLAN_NAME[u.plan]||(u.plan==='staff'?'Staff':'Deleted accounts'))} · {tl("{q} requests · {k} tokens",{q:num(u.requests),k:num(Object.values(u.tokens).reduce((a,b)=>a+b,0))})}</small></div>{r.priced&&<span className="chip">{money(u.cost)}</span>}</div>)}
    {r.top.length>0&&<button className="btn ghost" onClick={()=>fetchFile(`/admin/costs?days=${days}&format=csv`,`ai-costs-${days}-days.csv`,toast)}>{tl("Download everyone as CSV")}</button>}</>}
// Settings > Email: the Gmail account that sends password resets, registration codes and daily summaries (its App Password is stored sealed
// and never shown again), the site address used in links, how sending is going, and a log of what was sent (who and when, never the text)
// Settings > Payments: Razorpay keys (the secrets are stored sealed and never shown again), the currency, the Pro offers students can buy,
// the webhook address to paste into Razorpay, and the payments received
export function PaySettings({toast}){
  const confirm=useConfirm(),[c,setC]=useState(null),[f,setF]=useState({key_id:'',key_secret:'',webhook_secret:'',currency:'INR'}),[offers,setOffers]=useState([]),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false)
  const take=r=>{setC(r);setF({key_id:r.key_id||'',key_secret:'',webhook_secret:'',currency:r.currency});setOffers(r.offers.map(o=>({days:String(o.days),price:String(o.price)})))}
  useEffect(()=>{api('/admin/payments/settings').then(take).catch(e=>toast(e.message))},[])
  const {items,total,page,setPage,ready}=usePaged(o=>`/admin/payments?limit=${PAGE}&offset=${o}`,[],toast)
  const save=async()=>{setBusy(true);try{take(await api('/admin/payments/settings',{method:'PUT',body:{...f,offers:offers.filter(o=>o.days||o.price).map(o=>({days:Number(o.days),price:Number(o.price)}))}}));toast(tl("Saved"))}catch(e){toast(srv(e.message))}setBusy(false)}
  const test=async()=>{setBusy(true);try{toast(srv((await api('/admin/payments/test',{method:'POST'})).message))}catch(e){toast(srv(e.message))}setBusy(false)}
  const off=async()=>{if(!await confirm({title:tl("Remove the Razorpay keys?"),body:tl("Students can no longer buy Pro online. Pro they already bought stays until its last day."),ok:tl("Remove"),danger:true}))return
    try{take(await api('/admin/payments/settings',{method:'PUT',body:{remove:true}}))}catch(e){toast(srv(e.message))}}
  const set=(i,k,v)=>setOffers(l=>l.map((o,j)=>j===i?{...o,[k]:v}:o))
  if(!c)return <Skeleton/>
  return <><h3 className="sec first">{tl("Buying Pro online")}</h3>
    <p className="known">{c.on?tl("On. Students who signed up themselves can buy Pro from their profile."):tl("Off. Add your Razorpay keys to let students who signed up themselves buy Pro.")}{c.month.count>0&&' '+tl("This month: {n} payments, {amount}.",{n:c.month.count,amount:money(c.month.amount,c.currency)})}</p>
    {!c.site_set&&<p className="known" role="alert">{tl("Set the site address under Email first, so Razorpay can send students back here after paying.")}</p>}
    <label htmlFor="pkid">{tl("Razorpay key ID")}</label><input id="pkid" value={f.key_id} onChange={e=>setF({...f,key_id:e.target.value})} placeholder="rzp_live_…" autoComplete="off" spellCheck={false}/>
    <label htmlFor="pksec">{tl("Key secret")}</label><input id="pksec" type="password" value={f.key_secret} onChange={e=>setF({...f,key_secret:e.target.value})} placeholder={c.secret_set?tl("Saved. Enter a new one to replace it."):''} autoComplete="new-password"/>
    <label htmlFor="pwh">{tl("Webhook secret")}</label><input id="pwh" type="password" value={f.webhook_secret} onChange={e=>setF({...f,webhook_secret:e.target.value})} placeholder={c.webhook_set?tl("Saved. Enter a new one to replace it."):''} autoComplete="new-password"/>
    <p className="known">{tl("In Razorpay, under Webhooks, add this address for the event payment_link.paid, with the same secret:")}</p>
    <div className="tools"><code style={{overflowWrap:'anywhere'}}>{c.webhook_url}</code><button className="tool" aria-label={tl("Copy")} onClick={()=>{navigator.clipboard?.writeText(c.webhook_url);setCopied(true);setTimeout(()=>setCopied(false),1500)}}>{copied?<Check size={16}/>:<Copy size={16}/>}</button></div>
    <label htmlFor="pcur">{tl("Currency")}</label><input id="pcur" value={f.currency} maxLength={3} onChange={e=>setF({...f,currency:e.target.value.toUpperCase()})} style={{maxWidth:120}}/>
    <h3 className="sec">{tl("Pro offers")}</h3>
    {offers.map((o,i)=><div key={i} className="offrow"><div><label htmlFor={'od'+i}>{tl("Days")}</label><input id={'od'+i} type="number" min={1} max={3660} value={o.days} onChange={e=>set(i,'days',e.target.value)}/></div>
      <div><label htmlFor={'op'+i}>{tl("Price ({cur})",{cur:f.currency})}</label><input id={'op'+i} type="number" min={0} step="any" value={o.price} onChange={e=>set(i,'price',e.target.value)}/></div>
      <button className="tool" aria-label={tl("Remove this offer")} onClick={()=>setOffers(l=>l.filter((_,j)=>j!==i))}><Trash2 size={16}/></button></div>)}
    {offers.length<6&&<button className="btn ghost" onClick={()=>setOffers(l=>[...l,{days:'',price:''}])}><Plus size={16}/>{" "}{tl("Add an offer")}</button>}
    <button className="btn" disabled={busy} onClick={save}>{tl("Save")}</button>
    <div className="two"><button className="btn ghost" disabled={busy} onClick={test}>{tl("Test the keys")}</button>{c.secret_set&&<button className="btn ghost" onClick={off}>{tl("Remove the keys")}</button>}</div>
    <h3 className="sec">{tl("Payments received")}</h3>
    {!ready?<Skeleton rows={2}/>:!items.length?<p className="known">{tl("No payments yet.")}</p>:items.map(x=><div key={x.id} className="row"><div style={{flex:1}}><b>{x.name||tl("Deleted account")}</b><small className="known" style={{display:'block'}}>{[x.who,when(x.paid_at),x.payment_id].filter(Boolean).join(' · ')}</small></div>
      <span style={{textAlign:'end'}}><b>{money(x.amount,x.currency)}</b><small className="known" style={{display:'block'}}>{spanOf(x.days)}</small></span></div>)}
    <Pager page={page} total={total} onPage={setPage}/></>}
export function MailSettings({toast,onSaved}){
  const [m,setM]=useState(null),[gmail,setGmail]=useState(''),[pw,setPw]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false)
  const confirm=useConfirm()
  const take=r=>{setM(r);setGmail(r.gmail||'');setUrl(r.app_url_saved||'')}
  const load=()=>api('/admin/mail').then(take).catch(e=>toast(e.message));useEffect(()=>{load()},[])
  const log=usePaged(o=>`/admin/mail/log?limit=${PAGE}&offset=${o}`+(failed?'&failed=true':''),[failed],toast)
  const save=async body=>{setBusy(true);try{take(await api('/admin/mail',{method:'PUT',body}));setPw('');toast(tl("Email settings saved"));onSaved&&onSaved()}catch(e){toast(srv(e.message))}setBusy(false)}
  const test=async()=>{setBusy(true);try{const r=await api('/admin/mail/test',{method:'POST'});toast(srv(r.message))}catch(e){toast(e.message)}setBusy(false);load();log.reload()}
  if(!m)return <Skeleton rows={3}/>
  const h=m.health||{}
  return <>
    <div className="qbox" style={{marginTop:0}} role="status"><b>{m.on?tl("Email is on"):tl("Email is off")}</b>
      <p className="known" style={{margin:'4px 0 0'}}>{m.on?(m.via==='gmail'?tl("Sent from {sender} through Gmail.",{sender:m.sender}):tl("Sent from {sender} through the mail server in .env.",{sender:m.sender}))
        :!m.via?tl("Add a Gmail account below. Until then, password resets, registration codes and daily summaries are off."):tl("Add the site's address below: links in emails need it.")}</p></div>
    <h3 className="sec">{tl("Gmail sender")}</h3>
    <p className="known">{tl("Use a Gmail account for the college, such as zigora.college@gmail.com. Turn on 2-Step Verification for it, then make an App Password: Google Account > Security > 2-Step Verification > App passwords. Paste the 16 letters here; spaces don't matter.")}</p>
    <label>{tl("Gmail address")}</label><input type="email" value={gmail} onChange={e=>setGmail(e.target.value)} placeholder="zigora.college@gmail.com" autoComplete="off"/>
    <label>{tl("App Password")}</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder={m.gmail_saved?tl("Saved. Leave blank to keep it"):tl("16 letters, like abcd efgh ijkl mnop")} autoComplete="new-password"/>
    <label>{tl("Site address for links in emails")}</label><input value={url} onChange={e=>setUrl(e.target.value)} placeholder={m.env_app_url||"https://learn.yourcollege.edu"}/>
    <p className="known" style={{marginTop:4}}>{m.env_app_url&&!url?tl("Using {url} from .env.",{url:m.env_app_url}):tl("The address students open, such as https://learn.yourcollege.edu.")}</p>
    <div className="two"><button className="btn" disabled={busy} onClick={()=>save({gmail,app_url:url,...(pw.trim()?{app_password:pw}:{})})}>{tl("Save")}</button>
      <button className="btn ghost" disabled={busy||!m.on} onClick={test}>{tl("Send a test email to me")}</button></div>
    {m.gmail_saved&&<button className="tool" onClick={async()=>{if(await confirm({title:tl("Remove the Gmail sender?"),body:m.env_server?tl("Email goes back to the mail server set in .env."):tl("Password resets, registration codes and daily summaries stop until a sender is added again."),ok:tl("Remove"),danger:true}))save({remove_gmail:true})}}>{tl("Remove the Gmail sender")}</button>}
    {(h.ok_at||h.fail_at)&&<><h3 className="sec">{tl("How sending is going")}</h3><div className="qbox" style={{marginTop:0}}>
      <p className="known" style={{margin:0}}>{tl("Last sent")}: {h.ok_at?when(h.ok_at):tl('never')}</p>
      {h.fails_in_a_row>0&&<><p style={{margin:'6px 0 0',color:'var(--bad, #b3261e)'}}><b>{tl("{n} failed in a row",{n:h.fails_in_a_row})}</b> · {when(h.fail_at)}</p><p className="known" style={{margin:'4px 0 0'}}>{h.fail_message}</p></>}</div></>}
    <h3 className="sec">{tl("Emails sent")}</h3>
    <label className="chk"><input type="checkbox" checked={failed} onChange={e=>setFailed(e.target.checked)}/>{" "}{tl("Only the ones that failed")}</label>
    {!log.ready?<Skeleton rows={2}/>:!log.items.length?<p className="known">{failed?tl("None failed."):tl("Nothing sent yet.")}</p>
      :log.items.map(x=><div key={x.id} className="row"><div>{tl(x.label)} · {x.to}<small>{when(x.at)}{x.ok?'':' · '+x.error}</small></div><span className="chip" style={x.ok?{}:{color:'var(--bad, #b3261e)'}}>{x.ok?tl("Sent"):tl("Failed")}</span></div>)}
    <Pager page={log.page} total={log.total} onPage={log.setPage}/>
    <p className="known">{tl("Only who and when is kept, for 90 days. Never the text: emails carry reset links and codes.")}</p></>}

// an activity-log row in words: whole phrases (with the item and its number filled in), so each language can order them its own way
export const describe=(m,p)=>{const s=p.replace(/^\/api\//,'').split('/'),id=s.find(x=>/^\d+$/.test(x)),n=s.filter(x=>!/^\d+$/.test(x)),last=n[n.length-1],noun=n[0]==='admin'?n[1]:n[0],what=tl((noun||'').replace(/s$/,''))
  if(p==='/api/uploads')return tl('Uploaded an image');if(p==='/api/me/password')return tl('Changed own password');if(p==='/api/me/lang')return tl('Changed own language')
  if(p==='/api/admin/import')return tl('Imported content from CSV');if(p==='/api/admin/users/import')return tl('Imported users from CSV')
  if(last==='reset-password')return tl('Reset the password of user #{id}',{id});if(last==='courses')return tl('Assigned courses to user #{id}',{id});if(last==='links')return tl('Changed where course #{id} is shared',{id})
  if(last==='publish')return tl('Changed publish state of {what} #{id}',{what,id});if(n[0]==='admin'&&n[1]==='settings')return tl('Changed settings')
  const verb={POST:'Created',PUT:'Changed',PATCH:'Edited',DELETE:'Deleted'}[m]
  return verb?tl(verb+(id?' {what} #{id}':' {what}'),{what,id}):m+' '+what+(id?' #'+id:'')}
export function Activity({toast}){
  const [q,setQ]=useState(''),[action,setAction]=useState(''),[result,setResult]=useState(''),[days,setDays]=useState(''),[sort,setSort]=useState('newest')
  const qs=`q=${encodeURIComponent(q)}&action=${action}&result=${result}&days=${days||0}&sort=${sort}`,filtered=q||action||result||days
  const {items,total,page,setPage,ready}=usePaged(o=>`/admin/audit?${qs}&limit=${PAGE}&offset=${o}`,[q,action,result,days,sort],toast)
  return <><Bar title={tl("Activity log")} sub={filtered&&ready?matches(total):tl("Who changed what")}/><div className="main"><div className="search"><Search size={18}/><input type="search" aria-label={tl("Search the activity log")} placeholder={tl("Search by person or action")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="filters fit">
      <Opts label={tl("Action")} value={action} set={setAction} items={[['',tl("All actions")],['created',tl("Created")],['changed',tl("Changed or edited")],['deleted',tl("Deleted")]]}/>
      <Opts label={tl("Result")} value={result} set={setResult} items={[['',tl("Any result")],['ok',tl("Succeeded")],['failed',tl("Failed or not allowed")]]}/>
      <Opts label={tl("When")} value={days} set={setDays} items={[['',tl("Any time")],['1',tl("Last 24 hours")],['7',tl("Last 7 days")],['30',tl("Last 30 days")]]}/>
      <Opts label={tl("Sort by")} value={sort} set={setSort} items={[['newest',tl("Sort: newest first")],['oldest',tl("Sort: oldest first")]]}/></div>
    {!ready?<Skeleton/>:items.length?items.map(x=><div className="row" key={x.id}><div>{describe(x.method,x.path)}{x.status>=400&&<span className="pill off sm">{x.status===403?tl("Not allowed"):tl("Failed")}</span>}<small>{x.user} · {when(x.at)}</small></div></div>):<p className="known">{filtered?tl("Nothing matches."):tl("No activity yet.")}</p>}
    <Pager page={page} total={total} onPage={setPage}/>
    {total>0&&<button className="btn ghost" onClick={()=>fetchFile('/admin/audit?format=csv&'+qs,'activity-log.csv',toast)}>{tl("Download as CSV")}</button>}</div></>}
