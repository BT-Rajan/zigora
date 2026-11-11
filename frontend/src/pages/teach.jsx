// teach pages, loaded only when one of them is opened (split from App.jsx; the shell and shared helpers stay there)
import {useState,useEffect,useRef,useContext} from 'react'
import {Md} from '../content.jsx'
import {Plus,Sparkles,X,Search,ChevronLeft,ChevronRight,Upload,Pencil,Trash2,Clock,Play,RotateCcw,Archive,ArchiveRestore,FileText,BookOpen,Flag} from 'lucide-react'
import {t as tl,L,srv,getLang} from '../i18n.js'
import {Bar,Bar2,COL,COUNT_LABEL,Ctx,FLAG_KIND,ImgSlot,LET,OfferChip,OptBody,Opts,PAGE,PLAN_NAME,Paged,Pager,QChip,QImg,QuestionThread,Sheet,Skeleton,Spark,StateChip,Tabs,Topic,TrendsView,UserDetail,api,day,dueText,fetchFile,firstName,has,hoursLeft,maxOf,offerDates,pl,useConfirm,useLocalPage,usePaged,when} from '../App.jsx'
export const ATTN_GO={drafts:'drafts',empty_courses:'empty_courses',unowned:'unowned',unenrolled:'unenrolled',semester_numbers:'semester_numbers',never_opened:'never_opened'}
export const RS_PAGE=PAGE
export function ResultSet({kind:kind0,user,back,toast,open}){
  const [kind,date]=kind0.split(':')  // the rows behind a dashboard card: search, sort, 5 per page, and a tap on a row opens its details
  const [q,setQ]=useState(''),[order,setOrder]=useState('name'),[page,setPage]=useState(0),[d,setD]=useState(null),[view,setView]=useState(null),[progs,setProgs]=useState([])
  useEffect(()=>{setPage(0)},[q,order])
  useEffect(()=>{if(view)return;let live=true;const t=setTimeout(()=>api(`/overview/list?kind=${kind}${date?'&date='+date:''}&q=${encodeURIComponent(q)}&order=${order}&limit=${RS_PAGE}&offset=${page*RS_PAGE}`).then(r=>{if(!live)return;if(!r.items.length&&r.total&&page>0)setPage(Math.max(0,Math.ceil(r.total/RS_PAGE)-1));else setD(r)}).catch(e=>toast(e.message)),q?250:0);return()=>{live=false;clearTimeout(t)}},[kind,date,q,order,page,view])
  useEffect(()=>{if(view?.target.type==='user')api('/tree').then(t=>setProgs(t.map(p=>({id:p.id,name:p.name,term:p.term})))).catch(()=>{})},[view])
  const shut=()=>setView(null)
  if(view){const t=view.target
    if(t.type==='user')return <UserDetail id={t.id} me={user} progs={progs} back={shut} toast={toast}/>
    if(t.type==='topic')return <Topic id={t.id} back={shut} toast={toast} role={user.role}/>
    if(t.type==='course'&&kind==='courses'){const [p='',sm='']=(view.sub||'').split(' · ');return <StudentReport c={{course_id:t.id,course:view.title,program:p,semester:sm}} back={shut} toast={toast}/>}
    open(t.type==='program'?[t.id]:[t.program_id,t.semester_id,t.id].filter(x=>x!=null));return null}
  const total=d?.total??0,pages=Math.max(1,Math.ceil(total/RS_PAGE)),title=d?srv(d.title)+(date?' · '+shortDay(date):''):tl('Loading')
  return <><Bar title={title} sub={d?tl(q?(total===1?'{n} match':'{n} matches'):'{n} in total',{n:total}):''} back={back}/><div className="main">
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search {title}",{title:title.toLowerCase()})} placeholder={tl("Search")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="qopt"><select aria-label={tl("Sort by")} value={order} onChange={e=>setOrder(e.target.value)}><option value="name">{tl("Sort: A to Z")}</option><option value="name_desc">{tl("Sort: Z to A")}</option><option value="detail">{tl("Sort: by details")}</option><option value="newest">{tl("Sort: newest first")}</option>{d?.can_recent&&<option value="recent">{tl("Sort: last active")}</option>}</select></div>
    {!d&&<><div className="sk"/><div className="sk"/><div className="sk"/></>}
    {d&&d.items.length>0&&<div className="uhead" aria-hidden="true"><span>{tl("Name")}</span><span>{tl("Details")}</span><span/></div>}
    {d?.items.map(x=><button key={x.id} className="utr" onClick={()=>setView(x)} aria-label={tl("Open {title}",{title:x.title})}>
      <span className="nm"><span className="dot" style={{background:COL[x.id%5]}}>{(x.title||'?')[0]}</span><span className="tx"><b>{x.title}</b><small className="sub">{x.sub}</small></span></span>
      <span className="pg">{x.detail||'—'}</span><span className="sn"><ChevronRight size={16}/></span></button>)}
    {d&&!d.items.length&&<p className="known">{q?tl("Nothing matches that search."):tl("Nothing here. All clear.")}</p>}
    {d&&total>RS_PAGE&&<nav className="pager" aria-label={tl("Pages")}><button className="btn ghost" disabled={page===0} onClick={()=>setPage(page-1)}><ChevronLeft size={18}/><span>{tl("Previous")}</span></button><small>{tl("Page {v} of",{v:page+1})}{" "}{pages}</small><button className="btn ghost" disabled={page+1>=pages} onClick={()=>setPage(page+1)}><span>{tl("Next")}</span><ChevronRight size={18}/></button></nav>}
  </div></>}
// ---- graphs: hand-drawn SVG and HTML, colors from the validated chart palette (--v1..--v6 in styles.css), a tooltip on hover or focus,
// ---- and a click (or Enter) on any bar opens what is behind it. Values are always written out too, so no reading depends on color alone.
export const compact=n=>new Intl.NumberFormat(getLang(),{notation:'compact',maximumFractionDigits:1}).format(n||0)
export const shortDay=d=>new Date(d+'T00:00:00').toLocaleDateString(getLang(),{day:'numeric',month:'short'})
export function Tip({tip}){return tip&&<div className="vtip" role="status" style={{left:tip.x+'%'}}>{tip.lines.map((l,i)=><div key={i}>{l}</div>)}</div>}
export function Columns({days,series,onPick,label}){  // time across, one column per day; series stack (each [{id,name,color}], values in d.v[id])
  const [tip,setTip]=useState(null),n=days.length,max=Math.max(1,...days.map(d=>series.reduce((a,x)=>a+(d.v[x.id]||0),0))),W=n*10,H=100
  const show=(d,i)=>setTip({x:(i+.5)/n*100,lines:[shortDay(d.date),...series.map(x=>(series.length>1?x.name+': ':'')+(x.fmt||compact)(d.v[x.id]||0))]})
  return <div className="vchart" onMouseLeave={()=>setTip(null)}><Tip tip={tip}/>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="vcols" role="group" aria-label={label}>
      <line x1="0" x2={W} y1={H-.5} y2={H-.5} className="vaxis"/>
      {days.map((d,i)=>{let y=H;return <g key={d.date} className="vcol" tabIndex={0} role="button" aria-label={shortDay(d.date)+': '+series.map(x=>(series.length>1?x.name+' ':'')+(d.v[x.id]||0)).join(', ')}
        onMouseEnter={()=>show(d,i)} onFocus={()=>show(d,i)} onBlur={()=>setTip(null)} onClick={()=>onPick(d)} onKeyDown={e=>(e.key==='Enter'||e.key===' ')&&(e.preventDefault(),onPick(d))}>
        <rect x={i*10} y="0" width="10" height={H} className="vhit"/>
        {series.map(x=>{const h=(d.v[x.id]||0)/max*(H-6);if(!h)return null;y-=h;return <rect key={x.id} x={i*10+1.5} y={y} width="7" height={Math.max(h,.8)} rx="1.2" className={series.length>1?'vseg':''} style={{fill:x.color}}/>})}</g>})}
    </svg>
    <div className="vx"><span>{shortDay(days[0].date)}</span><span>{tl("max {v}",{v:compact(max)})}</span><span>{shortDay(days[n-1].date)}</span></div></div>}
export function HBars({rows,onPick,label}){  // one row per thing, its name and value written out, the bar in its color; a click opens it
  const max=Math.max(1,...rows.map(r=>r.max??r.value))
  return <div className="vbars" role="list" aria-label={label}>{rows.map(r=><button key={r.key} role="listitem" className="vbar" onClick={()=>onPick(r)} title={r.tip||''}>
    <span className="vlab"><b>{r.label}</b>{r.sub&&<small>{r.sub}</small>}</span><span className="vtrack"><i style={{width:Math.max(1.5,100*r.value/max)+'%',background:r.color}}/></span><span className="vval">{r.valueLabel??r.value}</span></button>)}</div>}
export const PLAN_COL={lite:'var(--v1)',pro:'var(--v2)',own:'var(--v3)',college:'var(--v4)',family:'var(--v5)',off:'var(--v6)'}
export const PROV_COL=['var(--v1)','var(--v2)','var(--v3)','var(--v4)','var(--v5)']
export function AdminCharts({goUsers,goSettings,setList,setRep}){
  const [c,setC]=useState(null),[days,setDays]=useState('30')
  useEffect(()=>{api('/admin/charts?days='+days).then(setC).catch(()=>setC(false))},[days])
  if(c===false)return null
  if(!c)return <><div className="sk"/><div className="sk"/></>
  const act=c.activity.map(d=>({date:d.date,v:{s:d.students}})),totalDays=act.filter(d=>d.v.s).length,peak=Math.max(0,...c.activity.map(d=>d.students))
  const prov=c.ai.providers.map((p,i)=>({id:p.id,name:p.name,color:PROV_COL[i%PROV_COL.length],total:c.ai.days.reduce((a,d)=>a+(d.tokens[p.id]||0),0)}))
  const people=c.plans.reduce((a,p)=>a+p.people,0)
  return <><div className="vhead"><h3 className="sec">{tl("At a glance")}</h3><Opts label={tl("Period")} value={days} set={setDays} items={[['7',tl("Last 7 days")],['30',tl("Last 30 days")],['90',tl("Last 90 days")]]}/></div>
    <div className="vgrid">
    <section className="vcard"><h4>{tl("Students studying each day")}</h4><p className="known">{tl("Up to {peak} a day; someone studied on {n} of {d} days. Click a day to see who.",{peak,n:totalDays,d:act.length})}</p>
      <Columns days={act} series={[{id:'s',name:tl("Students"),color:'var(--v1)',fmt:v=>tl("{n} students",{n:v})}]} label={tl("Students studying each day")} onPick={d=>setList('active_day:'+d.date)}/></section>
    <section className="vcard"><h4>{tl("Course completion")}</h4><p className="known">{c.courses.length?tl("Average share of topics learned, lowest first. Click a course for its students."):tl("No course has students and topics yet.")}</p>
      <HBars label={tl("Course completion")} rows={c.courses.map(x=>({key:x.course_id,label:x.course,sub:[x.program,x.semester].filter(Boolean).join(' · '),value:x.completion,max:100,valueLabel:x.completion+'%',color:'var(--v1)',
        tip:tl("{n} students",{n:x.students})+(x.quiz!=null?' · '+tl("quiz average {p}%",{p:x.quiz}):''),x}))} onPick={r=>setRep({course_id:r.x.course_id,course:r.x.course,program:r.x.program,semester:r.x.semester})}/></section>
    <section className="vcard"><h4>{tl("AI use per day")}</h4><p className="known">{prov.length?tl("Tokens on the college's keys, by provider. Click for costs."):tl("No AI use on the college's keys in this period.")}</p>
      {prov.length>0&&<><Columns days={c.ai.days.map(d=>({date:d.date,v:d.tokens}))} series={prov.map(p=>({...p,fmt:v=>tl("{v} tokens",{v:compact(v)})}))} label={tl("AI use per day")} onPick={()=>goSettings('costs')}/>
        <div className="vlegend">{prov.map(p=><button key={p.id} onClick={()=>goSettings('costs')}><i style={{background:p.color}}/>{p.name}<b>{compact(p.total)}</b></button>)}</div></>}</section>
    <section className="vcard"><h4>{tl("People by AI plan")}</h4><p className="known">{tl("{n} people with a plan. Click a plan to see them.",{n:people})}</p>
      <HBars label={tl("People by AI plan")} rows={c.plans.map(p=>({key:p.plan,label:tl(PLAN_NAME[p.plan]||p.plan),value:p.people,valueLabel:p.people.toLocaleString(),color:PLAN_COL[p.plan]||'var(--v6)'}))} onPick={r=>goUsers(r.key)}/></section>
    </div></>}
// the admin's dashboard: only what needs doing, grouped by kind and most urgent first, each with the one action that deals with it
export const DASH_CAT=[['ai','AI and costs'],['people','People and plans'],['content','Content'],['system','System']]
export const DASH_DO={settings:'Open Settings',test_ai:'Test the key',users:'Show them',list:'Show them',flags:'Review them',questions:'Answer them',approve:'Review them'}
export function AdminDashboard({toast,goUsers,goSettings,setList,setFp,setQp}){
  const [d,setD]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{api('/admin/dashboard').then(setD).catch(e=>toast(e.message))},[toast])
  const run=async x=>{if(x.action==='settings')return goSettings(x.target.tab);if(x.action==='users')return goUsers(x.target.plan);if(x.action==='approve')return goUsers('awaiting');if(x.action==='list')return setList(x.target.kind);if(x.action==='flags')return setFp(true);if(x.action==='questions')return setQp(true)
    setBusy(true);try{toast(srv((await api('/admin/ai/test',{method:'POST'})).message))}catch(e){toast(e.message)}setBusy(false)}
  if(!d)return <><div className="sk"/><div className="sk"/></>
  const vars=v=>({...v,...(v.date?{date:day(v.date)}:{})}),rank={now:0,soon:1,later:2},first=c=>Math.min(...d.items.filter(x=>x.category===c).map(x=>rank[x.level]))
  if(!d.items.length)return <div className="qbox" role="status" style={{marginTop:0}}><b>{tl("All clear. Nothing needs you right now.")}</b>{d.next&&<p className="known" style={{margin:'4px 0 0'}}>{tl("Next on the calendar: {title}, {date}",{title:d.next.title,date:day(d.next.date)})}</p>}</div>
  return DASH_CAT.filter(([c])=>d.items.some(x=>x.category===c)).sort((a,b)=>first(a[0])-first(b[0])).map(([c,label])=><div key={c}><h3 className="sec">{tl(label)}</h3>
    {d.items.filter(x=>x.category===c).map(x=><div key={x.key} className={'card dash '+x.level}><span className="dot" aria-hidden="true"/><div style={{flex:1}}><b>{tl(x.text,vars(x.vars))}</b>
      {x.level==='now'&&<small className="known">{tl("Needs you now")}</small>}</div><button className="btn ghost" disabled={busy&&x.action==='test_ai'} onClick={()=>run(x)}>{tl(DASH_DO[x.action])}</button></div>)}</div>)}
export function StaffHome({user,toast,open,goUsers,goSettings}){
  const [o,setO]=useState(null),[list,setList]=useState(null),[rep,setRep]=useState(null),[flags,setFlags]=useState(0),[fp,setFp]=useState(false),[qp,setQp]=useState(false),[reports,setReports]=useState(false)
  useEffect(()=>{if(!list&&!rep&&!fp&&!qp){api('/overview').then(setO).catch(e=>toast(e.message));if(user.role!=='admin')api('/flags?limit=1').then(r=>setFlags(r.total)).catch(()=>{})}},[toast,list,rep,fp,qp,user.role])
  if(fp)return <FlagsPage toast={toast} back={()=>setFp(false)}/>
  if(qp)return <TeacherQuestions toast={toast} back={()=>setQp(false)}/>
  if(rep)return <StudentReport c={rep} back={()=>setRep(null)} toast={toast}/>
  if(list)return <ResultSet kind={list} user={user} back={()=>setList(null)} toast={toast} open={open}/>
  const admin=user.role==='admin',hour=new Date().getHours(),hi=hour<12?'Good morning, {name}':hour<17?'Good afternoon, {name}':'Good evening, {name}'
  const stats=o?(admin?[[o.people.students,'Active students','students'],[o.people.active_week,'Studied this week','active_week'],[o.people.faculty,'Faculty','faculty'],[o.courses,'Courses','courses']]:[[o.courses,'Your courses','courses'],[o.topics,'Topics','topics'],[o.drafts,'Drafts','drafts']]):[]
  if(admin)return <><Bar title={tl(hi,{name:firstName(user.name)})} sub={tl("What needs doing across the college")}/><div className="main">
    <AdminDashboard toast={toast} goUsers={goUsers} goSettings={goSettings} setList={setList} setFp={setFp} setQp={setQp}/>
    <AdminCharts goUsers={goUsers} goSettings={goSettings} setList={setList} setRep={setRep}/>
    <h3 className="sec">{tl("Reports")}</h3>
    <div className="two"><button className="btn ghost" aria-expanded={reports} onClick={()=>setReports(!reports)}>{reports?tl("Hide course reports"):tl("Course reports")}</button><button className="btn ghost" onClick={()=>setList('students')}>{tl("Students")}</button></div>
    {reports&&<CourseReports toast={toast} onOpen={setRep}/>}
  </div></>
  return <><Bar title={tl(hi,{name:firstName(user.name)})} sub={admin?tl("Across the whole college"):tl("Your courses")}/><div className="main">
    {!o&&<><div className="sk"/><div className="sk"/><div className="sk"/></>}
    {o&&<div className="stats">{stats.map(([n,l0,k])=>{const l=tl(l0);return <button className="stat" key={l0} style={{textAlign:'start',width:'100%'}} onClick={()=>setList(k)} aria-label={tl("{v} {l}. Show the list",{v:(n??0).toLocaleString(),l:l})}><b>{(n??0).toLocaleString()}</b>{l}</button>})}</div>}
    {flags>0&&<button className="card flagcard" style={{textAlign:'start',width:'100%'}} onClick={()=>setFp(true)}><span className="dot" style={{background:'var(--coral)'}}><Flag size={18}/></span><div style={{flex:1}}><b>{tl(flags===1?'1 student report to check':'{n} student reports to check',{n:flags})}</b><span>{tl("Flagged AI answers and problems with topic notes")}</span></div><ChevronRight size={18}/></button>}
    {o&&<><h3 className="sec">{tl("Needs attention")}</h3>
      {o.attention.length?<Paged rows={o.attention} render={x=><button key={x.kind} className="card" style={{textAlign:'start'}} onClick={()=>x.kind==='questions'?setQp(true):x.kind==='more_ai'&&goUsers?goUsers('asked'):setList(ATTN_GO[x.kind]||'drafts')}><div style={{flex:1}}><b>{srv(x.text)}</b></div><ChevronRight size={18}/></button>}/>
        :<p className="known">{tl("Nothing needs your attention right now.")}</p>}</>}
    {o&&!o.courses&&!admin&&<p className="known">{tl("No course is assigned to you yet. An admin makes you the owner of a course.")}</p>}
    {o?.courses>0&&<><h3 className="sec">{admin?tl("Courses"):tl("Your courses")}</h3><CourseReports toast={toast} onOpen={setRep}/></>}
  </div></>}
export function FlagsPage({toast,back}){
  const confirm=useConfirm(),[t,setT]=useState(null)
  const {items,total,page,setPage,ready,reload}=usePaged(o=>`/flags?limit=${PAGE}&offset=${o}`,[],toast)
  const act=async(f,action)=>{if(action==='rewrite'&&!await confirm({title:tl("Have it written again?"),body:tl("The saved answer is dropped, and the next student who asks gets a new one (that uses AI tokens)."),ok:tl("Write it again")}))return
    try{await api(`/flags/${f.id}/resolve`,{method:'POST',body:{action}});toast(action==='rewrite'?tl("It will be written again"):action==='fixed'?tl("Marked as fixed"):tl("Left as it is"));reload()}catch(e){toast(e.message)}}
  if(t)return <Topic id={t} back={()=>setT(null)} toast={toast} role="faculty"/>
  return <><Bar title={tl("Student reports")} sub={ready?pl(total,'report'):''} back={back}/><div className="main">
    <p className="known" style={{marginTop:0}}>{tl("Students flagged these AI answers as looking wrong, or reported a problem with a topic's notes. Who flagged them is never shown.")}</p>
    {!ready?<Skeleton/>:!items.length?<p className="known">{tl("Nothing is flagged right now.")}</p>:items.map(f=><div key={f.id} className="qbox flagrow">
      <small className="steplab">{tl(FLAG_KIND[f.kind]||f.kind)}{f.topic?' · '+f.topic+(f.course?' · '+f.course:''):''}</small>
      <div className="flagex"><Md>{f.excerpt||''}</Md></div>
      <p className="known" style={{margin:'6px 0'}}>{tl(f.count===1?'Flagged by 1 student':'Flagged by {n} students',{n:f.count})}{f.reasons.length>0&&':'}</p>
      {f.reasons.length>0&&<ul className="flagwhy">{f.reasons.map((r,i)=><li key={i}>“{r}”</li>)}</ul>}
      <div className="tools">{(f.source==='topic'||f.source==='notes')&&f.topic_id&&<button onClick={()=>setT(f.topic_id)}>{tl("Open the topic")}</button>}
        {f.source==='notes'?<button onClick={()=>act(f,'fixed')}>{tl("I've fixed the notes")}</button>:<button onClick={()=>act(f,'rewrite')}>{tl("Write it again")}</button>}<button onClick={()=>act(f,'keep')}>{tl("It's fine")}</button></div></div>)}
    <Pager page={page} total={total} onPage={setPage}/></div></>}
// a teacher's inbox: questions waiting for their answer first (oldest first), or every question on their courses
// the doubt management centre (S42): counts, a filtered and sorted list (the server pages it), and a report; a doubt opens in the same thread page (S41)
export const DQ_COUNTS=[['pending','Pending'],['follow_up','Follow-up'],['answered','Answered'],['resolved','Resolved']]
export const hrs=h=>h==null?'':h<48?tl("{n} h",{n:Math.round(h)}):tl("{n} days",{n:Math.round(h/24)})
export function TeacherQuestions({toast,back}){
  const {role}=useContext(Ctx),admin=role==='admin'
  const [open,setOpen]=useState(null),[tab,setTab]=useState('list'),[sum,setSum]=useState(null),[n,setN]=useState(0)
  const [f,setF]=useState({label:'',course_id:0,unit_id:0,q:'',since:'',until:'',sort:'priority',overdue:false,unassigned:false,teacher_id:0}),set=(k,v)=>setF(x=>({...x,[k]:v}))
  useEffect(()=>{api('/questions/summary').then(setSum).catch(e=>toast(e.message))},[n])
  const qs=new URLSearchParams(Object.entries(f).filter(([,v])=>v&&v!==0).map(([k,v])=>[k,String(v)])).toString()
  const {items,total,page,setPage,ready,reload}=usePaged(o=>`/questions?${qs}&limit=${PAGE}&offset=${o}`,[qs],toast)
  if(open)return <QuestionThread id={open} back={()=>{setOpen(null);reload();setN(x=>x+1)}} toast={toast}/>
  const units=sum?.courses.find(c=>c.id===f.course_id)?.units||[]
  const chip=(k,l,v,extra={})=>v==null?null:<button key={k} className={'stat'+((f.label===k&&!extra.flag)||(extra.flag&&f[extra.flag])?' on':'')} onClick={()=>setF(x=>extra.flag?{...x,[extra.flag]:!x[extra.flag],label:''}:{...x,label:x.label===k?'':k,overdue:false,unassigned:false})}><b>{v}</b><small className="known">{tl(l)}</small></button>
  return <><Bar title={tl("Student questions")} sub={ready&&tab==='list'?pl(total,'question'):''} back={back}/><div className="main">
    <Tabs label={tl("View")} items={[['list',tl("Doubts")],['report',tl("Report")]]} value={tab} onChange={setTab}/>
    {tab==='report'?<DoubtReport toast={toast}/>:<>
    {sum&&<div className="stats dqstats">{DQ_COUNTS.map(([k,l])=>chip(k,l,sum[k]))}{chip('overdue','Overdue',sum.overdue,{flag:'overdue'})}{admin&&chip('unassigned','No teacher',sum.unassigned,{flag:'unassigned'})}</div>}
    {sum&&sum.overdue==null&&<p className="known" style={{marginTop:0}}>{tl("No response target is set, so nothing is marked overdue.")}{admin?' '+tl("Set one in Settings."):''}</p>}
    {sum&&sum.overdue!=null&&<p className="known" style={{marginTop:0}}>{[sum.targets.first_hours&&tl("Overdue: no first answer within {a} h",{a:sum.targets.first_hours}),sum.targets.followup_hours&&tl("no reply to a follow-up within {b} h",{b:sum.targets.followup_hours})].filter(Boolean).join('; ')}{' '}{tl("(plain hours: nights and weekends count).")}</p>}
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search doubts")} placeholder={tl("Search by student, question or topic")} value={f.q} onChange={e=>set('q',e.target.value)}/></div>
    <div className="qopt"><select aria-label={tl("Course")} value={f.course_id} onChange={e=>setF(x=>({...x,course_id:+e.target.value,unit_id:0}))}><option value={0}>{tl("All courses")}</option>{(sum?.courses||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      {f.course_id>0&&<select aria-label={tl("Unit")} value={f.unit_id} onChange={e=>set('unit_id',+e.target.value)}><option value={0}>{tl("All units")}</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>}
      {admin&&sum?.teachers?.length>0&&<select aria-label={tl("Teacher")} value={f.teacher_id} onChange={e=>set('teacher_id',+e.target.value)}><option value={0}>{tl("All teachers")}</option>{sum.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}
      <select aria-label={tl("Sort by")} value={f.sort} onChange={e=>set('sort',e.target.value)}>{[['priority',tl("Oldest unanswered first")],['followups',tl("Follow-ups first")],['submitted',tl("Newest submitted")],['updated',tl("Latest activity")]].map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
    <div className="qopt"><label className="known">{tl("From")}{" "}<input type="date" value={f.since} onChange={e=>set('since',e.target.value)}/></label><label className="known">{tl("To")}{" "}<input type="date" value={f.until} onChange={e=>set('until',e.target.value)}/></label></div>
    {!ready?<Skeleton/>:!items.length?<p className="known">{tl("No doubts match.")}</p>:items.map(x=><DoubtRow key={x.id} x={x} onOpen={()=>setOpen(x.id)}/>)}
    <Pager page={page} total={total} onPage={setPage}/></>}</div></>}
export const DoubtRow=({x,onOpen})=><button className="card ward" onClick={onOpen}><span className="wtop"><b>{x.topic||x.course}</b><span><QChip s={x.status} label={x.label}/>{x.overdue&&<>{" "}<span className="chip" style={{color:'var(--bad)'}}>{tl("Overdue")}</span></>}</span></span>
  <span className="known">{[x.student,x.course,x.unit].filter(Boolean).join(' · ')}</span><span style={{display:'block',marginTop:4,overflowWrap:'anywhere'}}>{x.preview}</span>
  <small className="known" style={{display:'block',marginTop:4}}>{[tl("Asked {when}",{when:when(x.at)}),tl("last activity {when}",{when:when(x.updated)}),x.waiting_hours!=null&&tl("waiting {t}",{t:hrs(x.waiting_hours)}),x.teacher?tl("Teacher: {name}",{name:x.teacher}):tl("No teacher assigned"),x.reopens>0&&tl("reopened {n}×",{n:x.reopens})].filter(Boolean).join(' · ')}</small></button>
export function DoubtReport({toast}){
  const [d,setD]=useState(null),[days,setDays]=useState(90)
  useEffect(()=>{setD(null);api('/questions/report?days='+days).then(setD).catch(e=>toast(e.message))},[days])
  const table=(rows,extra)=>rows.map(r=><div key={r.id} className="row"><div>{r.name}<small>{[extra&&extra(r),(r.doubts===1?tl("1 doubt"):tl("{n} doubts",{n:r.doubts})),r.pending&&tl("{n} pending",{n:r.pending}),r.follow_up&&tl("{n} follow-ups",{n:r.follow_up}),r.reopened&&tl("{n} reopened",{n:r.reopened})].filter(Boolean).join(' · ')}</small></div></div>)
  return <><div className="qopt"><select aria-label={tl("Period")} value={days} onChange={e=>setDays(+e.target.value)}>{[30,90,365].map(n=><option key={n} value={n}>{tl("Last {n} days",{n})}</option>)}</select></div>
    {!d?<Skeleton/>:!d.total?<p className="known">{tl("No doubts in this period.")}</p>:<>
    <div className="stats"><div className="stat"><b>{d.total}</b><small className="known">{tl("Doubts")}</small></div><div className="stat"><b>{d.pending}</b><small className="known">{tl("Pending")}</small></div>
      <div className="stat"><b>{d.follow_up}</b><small className="known">{tl("Follow-up")}</small></div><div className="stat"><b>{d.reopened}</b><small className="known">{tl("Reopened")}</small></div></div>
    <p className="known">{tl("Counts of doubts asked in this period, by where they came from. No AI is involved.")}</p>
    <h3 className="sec">{tl("Topics with the most doubts")}</h3>{table(d.by_topic,r=>[r.course,r.unit].filter(Boolean).join(' › '))}
    <h3 className="sec">{tl("By course")}</h3>{table(d.by_course)}
    {d.by_unit.length>0&&<><h3 className="sec">{tl("By unit")}</h3>{table(d.by_unit)}</>}
    {d.asks_again.length>0&&<><h3 className="sec">{tl("Students who often ask again")}</h3><p className="known" style={{marginTop:0}}>{tl("Wrote again after an answer at least twice in this period.")}</p>
      {d.asks_again.map(x=><div key={x.id} className="row"><div>{x.name}<small>{tl("{n} follow-ups",{n:x.follow_ups})}</small></div></div>)}</>}</>}</>}
// ---- where students struggle: per topic, what students did when stuck over the last weeks, most first; the questions they asked are a tap away
export function StrugglesPage({toast,back}){
  const [days,setDays]=useState(30),[course,setCourse]=useState(0),[d,setD]=useState(null),[t,setT]=useState(null),{role}=useContext(Ctx),[help,setHelp]=useState(null),[busy,setBusy]=useState(false)
  const sendHelp=async()=>{setBusy(true);try{const r=await api(`/topics/${help.topic_id}/offer-help`,{method:'POST',body:{text:help.text,days}});toast(tl(r.sent===1?"Sent to 1 student":"Sent to {n} students",{n:r.sent}));setHelp(null)}catch(e){toast(srv(e.message))}setBusy(false)}
  useEffect(()=>{setD(null);api(`/reports/struggles?days=${days}&course_id=${course}`).then(setD).catch(e=>toast(e.message))},[days,course])
  if(t)return <Topic id={t} back={()=>setT(null)} toast={toast} role={role}/>
  const bits=x=>[[x.questions,'1 question to you','{n} questions to you'],[x.doubts,'1 Not clear? tap','{n} Not clear? taps'],[x.not_quite,'1 Not quite after a quick check','{n} Not quite after a quick check'],[x.simpler,'1 asked for it more simply','{n} asked for it more simply'],[x.flags,'1 flagged answer','{n} flagged answers']].filter(([n])=>n).map(([n,one,many])=>n===1?tl(one):tl(many,{n}))
  return <><Bar title={tl("Where students struggle")} sub={d?tl("Last {n} days",{n:d.days}):''} back={back}/><div className="main">
    <p className="known" style={{marginTop:0}}>{tl("Topics where students got stuck most: questions to you, Not clear? on a phrase, Not quite after a quick check, asking for it more simply, and flagged answers. Counts only, never names.")}</p>
    <div className="filters"><select aria-label={tl("Course")} value={course} onChange={e=>setCourse(Number(e.target.value))}><option value={0}>{tl("All my courses")}</option>{(d?.courses||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select aria-label={tl("Period")} value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(n=><option key={n} value={n}>{tl("Last {n} days",{n})}</option>)}</select></div>
    {!d?<Skeleton/>:!d.items.length?<p className="known">{tl("No signs of trouble in this period.")}</p>:d.items.map((x,i)=><button key={x.topic_id} className="card ward" onClick={()=>setT(x.topic_id)}>
      <span className="wtop"><b>{i+1}. {x.topic}</b><span className="chip" style={{margin:0}}>{tl(x.students===1?"1 student":"{n} students",{n:x.students})}</span></span>
      <span className="known">{x.course}</span><span style={{display:'block'}}>{bits(x).join(' · ')}</span>
      {x.asked.length>0&&<ul className="flagwhy">{x.asked.map((a,j)=><li key={j}>“{a}”</li>)}</ul>}
      <span className="link" role="button" tabIndex={0} style={{alignSelf:'flex-start'}} onClick={e=>{e.stopPropagation();setHelp({topic_id:x.topic_id,topic:x.topic,text:''})}} onKeyDown={e=>{if(e.key==='Enter'){e.stopPropagation();setHelp({topic_id:x.topic_id,topic:x.topic,text:''})}}}>{tl("Offer help")}</span></button>)}</div>
    {help&&<Sheet close={()=>setHelp(null)}><h3>{tl("Offer help with {topic}",{topic:help.topic})}</h3><p className="known">{tl("Goes to every student who was stuck on this topic in this period. You won't see who they are; each can answer you in their own thread.")}</p>
      <label htmlFor="hlp">{tl("Message")}</label><textarea id="hlp" rows={4} maxLength={1000} value={help.text} onChange={e=>setHelp({...help,text:e.target.value})} placeholder={tl("Shall we go over this together? Ask me anything about it.")}/>
      <button className="btn" disabled={busy||help.text.trim().length<3} onClick={sendHelp}>{tl("Send")}</button><button className="btn ghost" onClick={()=>setHelp(null)}>{tl("Cancel")}</button></Sheet>}</>}
export const offerAccess=c=>c.access==='open'?tl("Open to anyone"):c.applications?tl("By invitation, or ask to join"):tl("By invitation only")
export function OfferForm({c,close,done,toast}){
  const [f,setF]=useState({name:c?.name||'',about:c?.about||'',starts_on:c?.starts_on||'',ends_on:c?.ends_on||'',access:c?.access||'enroll',applications:c?c.applications:true}),[busy,setBusy]=useState(false)
  const set=(k,v)=>setF({...f,[k]:v})
  const save=async()=>{setBusy(true);try{done(await api(c?`/offered/${c.id}`:'/offered',{method:c?'PUT':'POST',body:{...f,starts_on:f.starts_on||null,ends_on:f.ends_on||null}}))}catch(e){toast(srv(e.message))}setBusy(false)}
  return <Sheet close={close}><h3>{c?tl("Course details"):tl("Offer a course")}</h3>
    <label htmlFor="ofn">{tl("Course name")}</label><input id="ofn" value={f.name} maxLength={150} onChange={e=>set('name',e.target.value)} placeholder={tl("Python for engineers")}/>
    <label htmlFor="ofa">{tl("What it is about (optional)")}</label><textarea id="ofa" rows={3} maxLength={4000} value={f.about} onChange={e=>set('about',e.target.value)}/>
    <div className="two"><div><label htmlFor="ofs">{tl("Starts (optional)")}</label><input id="ofs" type="date" value={f.starts_on} onChange={e=>set('starts_on',e.target.value)}/></div>
      <div><label htmlFor="ofe">{tl("Ends (optional)")}</label><input id="ofe" type="date" value={f.ends_on} onChange={e=>set('ends_on',e.target.value)}/></div></div>
    <label>{tl("Who may join")}</label>
    <div className="seg" style={{gridTemplateColumns:'1fr 1fr'}}>{[['enroll',tl("Students I accept")],['open',tl("Anyone, at once")]].map(([k,l])=><button key={k} className={f.access===k?'on':''} aria-pressed={f.access===k} onClick={()=>set('access',k)}>{l}</button>)}</div>
    {f.access==='enroll'&&<label className="chk"><input type="checkbox" checked={f.applications} onChange={e=>set('applications',e.target.checked)}/>{" "}{tl("Students may ask to join (you decide within 48 hours)")}</label>}
    <p className="known">{f.access==='open'?tl("Any student can find it under Join a course and join with one tap."):tl("You invite students (they have 48 hours to accept); only students on the list see the course.")}</p>
    <button className="btn" disabled={busy||f.name.trim().length<2} onClick={save}>{c?tl("Save"):tl("Offer the course")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export function OfferedPage({toast,openCourse}){
  const [d,setD]=useState(null),[form,setForm]=useState(false),[open,setOpen]=useState(null)
  const load=()=>api('/offered').then(setD).catch(e=>toast(e.message));useEffect(()=>{if(!open)load()},[open])
  if(open)return <OfferDetail id={open} back={()=>setOpen(null)} toast={toast} openCourse={openCourse}/>
  return <><Bar title={tl("Offered courses")} sub={d?pl(d.items.length,'course'):''}/><div className="main">
    <p className="known" style={{marginTop:0}}>{tl("Courses you run yourself. Only the students on a course's list see it: you invite them, accept those who ask, or open it to anyone.")}</p>
    <button className="btn" onClick={()=>setForm(true)}><Plus size={16}/>{" "}{tl("Offer a course")}</button>
    {!d?<Skeleton/>:!d.items.length?<p className="known">{tl("No offered courses yet.")}</p>:d.items.map(c=><button key={c.id} className="card ward" onClick={()=>setOpen(c.id)}>
      <span className="wtop"><b>{c.name}</b><OfferChip c={c}/></span><span className="known">{offerDates(c)} · {offerAccess(c)}</span>
      <span>{[tl("{n} enrolled",{n:c.counts.active||0}),c.counts.invited&&tl("{n} invited",{n:c.counts.invited}),c.counts.applied&&tl("{n} asking to join",{n:c.counts.applied})].filter(Boolean).join(' · ')}</span></button>)}</div>
    {form&&<OfferForm toast={toast} close={()=>setForm(false)} done={c=>{setForm(false);setOpen(c.id)}}/>}</>}
export const ROSTER_ACTS={applied:[['approve','Accept'],['decline','Decline']],active:[['suspend','Suspend'],['complete','Mark completed'],['release','Release']],suspended:[['retain','Restore'],['release','Release']],
  completed:[['release','Release']],invited:[['revoke','Take back the invitation']]}
export const ROSTER_GROUPS=[['applied','Asking to join'],['invited','Invited'],['active','Enrolled'],['suspended','Suspended'],['completed','Completed'],['released','Released'],['declined','Declined'],['expired','Lapsed after 48 hours'],['cancelled','Cancelled']]
export function OfferDetail({id,back,toast,openCourse}){
  const confirm=useConfirm(),[d,setD]=useState(null),[tab,setTab]=useState('students'),[who,setWho]=useState(''),[ed,setEd]=useState(false),[rep,setRep]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>api(`/offered/${id}/roster`).then(setD).catch(e=>toast(e.message))
  useEffect(()=>{load();const v=()=>{if(document.visibilityState==='visible')load()},h=setInterval(v,30000);document.addEventListener('visibilitychange',v);return()=>{clearInterval(h);document.removeEventListener('visibilitychange',v)}},[id])  // answers to invitations show up without reopening
  const invite=async()=>{setBusy(true);try{const r=await api(`/offered/${id}/invite`,{method:'POST',body:{who:who.split(/[\s,;]+/).filter(Boolean)}})
    toast([r.invited?tl(r.invited===1?"1 invitation sent":"{n} invitations sent",{n:r.invited}):'',r.not_found.length?tl("Not found: {list}",{list:r.not_found.join(', ')}):'',r.already.length?tl("Already on the list: {list}",{list:r.already.join(', ')}):''].filter(Boolean).join(' · ')||tl("Nothing to send"));setWho('');load()}catch(e){toast(srv(e.message))}setBusy(false)}
  const act=async(e,a)=>{if(a==='release'&&!await confirm({title:tl("Release {name}?",{name:e.name}),body:tl("They no longer see the course. Their work so far is kept."),ok:tl("Release"),danger:true}))return
    try{await api(`/enrolments/${e.id}`,{method:'POST',body:{action:a}});load()}catch(x){toast(srv(x.message))}}
  const cancel=async()=>{if(!await confirm({title:tl("Cancel this course?"),body:tl("Its students lose it, invitations and requests are cancelled, and its classes still to come are cancelled. Everyone is told. This can't be undone."),ok:tl("Cancel the course"),danger:true}))return
    try{await api(`/offered/${id}/cancel`,{method:'POST'});load()}catch(e){toast(srv(e.message))}}
  const pause=async on=>{if(on&&!await confirm({title:tl("Pause this course?"),body:tl("Students keep their place but can't open it, and nobody can join, until you resume it. They are told both times."),ok:tl("Pause")}))return
    try{await api(`/offered/${id}/pause`,{method:'POST',body:{paused:on}});toast(on?tl("Paused. Students are told."):tl("Resumed. Students are told."));load()}catch(e){toast(srv(e.message))}}
  const archive=async on=>{try{await api(`/courses/${id}/archive`,{method:'PUT',body:{archived:on}});toast(on?tl("Archived"):tl("Restored"));load()}catch(e){toast(srv(e.message))}}
  const repeat=async()=>{setBusy(true);try{const r=await api(`/offered/${id}/repeat`,{method:'POST',body:{...rep,starts_on:rep.starts_on||null,ends_on:rep.ends_on||null}});toast(rep.students==='same'?tl("New run made. {n} students invited.",{n:r.invited}):tl("New run made."));setRep(null)}catch(e){toast(srv(e.message))}setBusy(false)}
  if(!d)return <><Bar title={tl("Course")} back={back}/><div className="main"><Skeleton/></div></>
  const c=d.course,live=c.state!=='cancelled'&&c.state!=='archived'
  return <><Bar title={c.name} sub={offerDates(c)+' · '+offerAccess(c)} back={back}/><div className="main">
    <div className="tools" style={{justifyContent:'space-between',alignItems:'center',marginBottom:8}}><OfferChip c={c}/><button className="btn ghost" style={{width:'auto',margin:0}} onClick={()=>openCourse(c.id)}><BookOpen size={16}/>{" "}{tl("Open the course content")}</button></div>
    <Tabs label={tl("Course sections")} scroll items={[['students',tl("Students")],['message',tl("Write to students")],['course',tl("Course")]]} value={tab} onChange={setTab}/>
    {tab==='students'&&<>{live&&<div className="qbox"><label htmlFor="inv">{tl("Invite students")}</label><textarea id="inv" rows={2} value={who} onChange={e=>setWho(e.target.value)} placeholder={tl("Emails or usernames, one per line")}/>
        <p className="known" style={{margin:'4px 0 8px'}}>{tl("Each gets an email and has 48 hours to accept.")}</p><button className="btn" disabled={busy||!who.trim()} onClick={invite}>{tl("Send invitations")}</button></div>}
      {ROSTER_GROUPS.map(([g,l])=>{const rows=d.items.filter(x=>x.status===g);return rows.length?<div key={g}><h3 className="sec">{tl(l)} ({rows.length})</h3>{rows.map(e=><div key={e.id} className="row roster">
        <div style={{flex:1,minWidth:0}}><b>{e.name}</b><small className="known" style={{display:'block'}}>{e.who}{e.expires_at?' · '+hoursLeft(e.expires_at):''}</small></div>
        <div className="tools" style={{flexWrap:'wrap',justifyContent:'flex-end'}}>{live&&(ROSTER_ACTS[g]||[]).map(([a,al])=><button key={a} className="tool" onClick={()=>act(e,a)}>{tl(al)}</button>)}</div></div>)}</div>:null})}
      {!d.items.length&&<p className="known">{tl("Nobody on the list yet.")}</p>}</>}
    {tab==='message'&&<WriteStudents cid={c.id} toast={toast}/>}
    {tab==='course'&&<>{c.about&&<div className="prose flat" style={{marginBottom:10}}><Md>{c.about}</Md></div>}
      {live&&<button className="btn ghost" onClick={()=>setEd(true)}><Pencil size={16}/>{" "}{tl("Change the details, dates or who may join")}</button>}
      {live&&<button className="btn ghost" onClick={()=>pause(c.state!=='paused')}>{c.state==='paused'?<><Play size={16}/>{" "}{tl("Resume the course")}</>:<><Clock size={16}/>{" "}{tl("Pause the course")}</>}</button>}
      <button className="btn ghost" onClick={()=>setRep({name:c.name,starts_on:'',ends_on:'',students:'same'})}><RotateCcw size={16}/>{" "}{tl("Repeat this course")}</button>
      {c.state!=='cancelled'&&<button className="btn ghost" onClick={()=>archive(c.state!=='archived')}>{c.state==='archived'?<><ArchiveRestore size={16}/>{" "}{tl("Restore from the archive")}</>:<><Archive size={16}/>{" "}{tl("Archive")}</>}</button>}
      {live&&<button className="btn ghost danger" onClick={cancel}>{tl("Cancel the course")}</button>}
      <p className="known">{tl("Classes and announcements, questions and where students struggle are on their own pages, as for any course.")}</p></>}</div>
    {ed&&<OfferForm c={c} toast={toast} close={()=>setEd(false)} done={()=>{setEd(false);load()}}/>}
    {rep&&<Sheet close={()=>setRep(null)}><h3>{tl("Repeat this course")}</h3><p className="known">{tl("A new run with the same units, topics and quizzes. Change anything there afterwards.")}</p>
      <label htmlFor="rpn">{tl("Course name")}</label><input id="rpn" value={rep.name} onChange={e=>setRep({...rep,name:e.target.value})}/>
      <div className="two"><div><label htmlFor="rps">{tl("Starts (optional)")}</label><input id="rps" type="date" value={rep.starts_on} onChange={e=>setRep({...rep,starts_on:e.target.value})}/></div>
        <div><label htmlFor="rpe">{tl("Ends (optional)")}</label><input id="rpe" type="date" value={rep.ends_on} onChange={e=>setRep({...rep,ends_on:e.target.value})}/></div></div>
      <label>{tl("Students")}</label><div className="seg" style={{gridTemplateColumns:'1fr 1fr'}}>{[['same',tl("Invite the same students")],['none',tl("Start with nobody")]].map(([k,l])=><button key={k} className={rep.students===k?'on':''} aria-pressed={rep.students===k} onClick={()=>setRep({...rep,students:k})}>{l}</button>)}</div>
      <button className="btn" disabled={busy} onClick={repeat}>{tl("Make the new run")}</button><button className="btn ghost" onClick={()=>setRep(null)}>{tl("Cancel")}</button></Sheet>}</>}
// writing to a course's students: all of them, or the ones ticked; each gets their own thread to answer in (My questions)
export function WriteStudents({cid,toast}){
  const [ppl,setPpl]=useState(null),[sel,setSel]=useState([]),[f,setF]=useState({subject:'',text:''}),[busy,setBusy]=useState(false),[file,setFile]=useState(null)
  const pick=e=>{const x=e.target.files?.[0];e.target.value='';if(!x)return;if(x.size>15*1024*1024){toast(tl("Keep the file under 15 MB"));return}
    const rd=new FileReader();rd.onload=()=>setFile({name:x.name,data:rd.result});rd.onerror=()=>toast(tl("That file could not be read"));rd.readAsDataURL(x)}
  useEffect(()=>{api(`/courses/${cid}/students`).then(r=>setPpl(r.items)).catch(()=>setPpl([]))},[cid])
  const send=async()=>{setBusy(true);try{const r=await api(`/courses/${cid}/message`,{method:'POST',body:{...f,student_ids:sel,file}});toast(tl(r.sent===1?"Sent to 1 student":"Sent to {n} students",{n:r.sent}));setF({subject:'',text:''});setSel([]);setFile(null)}catch(e){toast(srv(e.message))}setBusy(false)}
  return <div className="qbox"><label htmlFor="wss">{tl("Subject")}</label><input id="wss" value={f.subject} maxLength={200} onChange={e=>setF({...f,subject:e.target.value})}/>
    <label htmlFor="wst">{tl("Message")}</label><textarea id="wst" rows={4} maxLength={1000} value={f.text} onChange={e=>setF({...f,text:e.target.value})}/>
    {file?<div className="msgfile" style={{marginTop:8}}><FileText size={18}/><span>{file.name}</span><button className="ic sm" aria-label={tl("Remove the file")} onClick={()=>setFile(null)}><X size={16}/></button></div>
      :<label className="btn ghost photopick"><Upload size={16}/> {tl("Attach material")}<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,image/png,image/jpeg" onChange={pick} hidden/></label>}
    <small className="known" style={{display:'block'}}>{tl("PDF, Word, PowerPoint, Excel, text, ZIP or a picture, up to 15 MB.")}</small>
    <p className="known">{sel.length?tl("To the {n} ticked below.",{n:sel.length}):tl("To every student on the course, or tick some below.")}{" "}{tl("Each student gets it in My questions and can answer you there.")}</p>
    {ppl&&ppl.length>0&&<div className="pickppl">{ppl.map(p=><label key={p.id} className="chk"><input type="checkbox" checked={sel.includes(p.id)} onChange={()=>setSel(s=>s.includes(p.id)?s.filter(x=>x!==p.id):[...s,p.id])}/>{" "}{p.name}</label>)}</div>}
    {ppl&&!ppl.length&&<p className="known">{tl("No students on this course yet.")}</p>}
    <button className="btn" disabled={busy||!ppl?.length||f.subject.trim().length<3||f.text.trim().length<3} onClick={send}>{tl("Send")}</button></div>}
export const ATT_LABEL=n=>n?tl(n===1?"1 attempt":"{n} attempts",{n}):tl("Unlimited attempts")
// start time, instructions and which attempt counts: the same three fields when assigning and when changing an assignment (S33)
export const WindowFields=({opens,setOpens,ins,setIns,counts,setCounts,id})=><>
  <label htmlFor={id+'o'}>{tl("Opens (optional)")}</label><input id={id+'o'} type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)}/>
  <small className="known">{tl("Leave empty to open at once. Students see it as upcoming until then and can't start before.")}</small>
  <label htmlFor={id+'c'}>{tl("Which attempt counts")}</label><select id={id+'c'} value={counts} onChange={e=>setCounts(e.target.value)}>{Object.keys(COUNT_LABEL).map(k=><option key={k} value={k}>{COUNT_LABEL[k]}</option>)}</select>
  <label htmlFor={id+'i'}>{tl("Instructions (optional)")}</label><textarea id={id+'i'} rows={3} maxLength={2000} value={ins} onChange={e=>setIns(e.target.value)} placeholder={tl("What students should know before they start")}/></>
export function AssignPage({toast}){
  const [d,setD]=useState(null),[view,setView]=useState(null),[make,setMake]=useState(false)
  const load=()=>api('/assignments').then(setD).catch(e=>toast(e.message));useEffect(()=>{if(!view&&!make)load()},[view,make])
  if(view)return <AssignDetail id={view} back={()=>setView(null)} toast={toast}/>
  if(make)return <AssignForm toast={toast} close={()=>setMake(false)}/>
  return <><Bar title={tl("Assigned tests")} sub={d?pl(d.items.length,'assignment'):''}/><div className="main">
    <button className="btn" onClick={()=>setMake(true)}><Plus size={16}/>{" "}{tl("Assign a test")}</button>
    {!d&&<Skeleton rows={2}/>}{d&&!d.items.length&&<p className="known">{tl("Nothing assigned yet. Give a quiz, a test or an MCQ set to one student or a group, with a due date and time.")}</p>}
    {d?.items.map(x=><button key={x.id} className="card ward" onClick={()=>setView(x.id)}><span className="wtop"><b>{x.title}</b><span className="chip">{tl("due {when}",{when:dueText(x.due)})}</span></span>
      <small className="known">{tl("{done} of {n} done",{done:x.done,n:x.students})}{x.late?' · '+tl("{n} late",{n:x.late}):''}{x.missed?' · '+tl("{n} missed",{n:x.missed}):''} · {ATT_LABEL(x.attempts)}</small></button>)}</div></>}
export function AssignDetail({id,back,toast}){
  const confirm=useConfirm(),[d,setD]=useState(null),[due,setDue]=useState(''),[att,setAtt]=useState('1'),[busy,setBusy]=useState(false),[opens,setOpens]=useState(''),[ins,setIns]=useState(''),[counts,setCounts]=useState('best')
  const load=()=>api('/assignments/'+id).then(r=>{setD(r);setDue(r.due);setAtt(String(r.attempts));setOpens(r.opens||'');setIns(r.instructions||'');setCounts(r.counts||'best')}).catch(e=>{toast(e.message);back()});useEffect(()=>{load()},[id])
  const save=async()=>{setBusy(true);try{await api('/assignments/'+id,{method:'PATCH',body:{due,attempts:+att,opens,instructions:ins,counts}});toast(tl("Changes saved"));load()}catch(e){toast(e.message)}setBusy(false)}
  const del=async()=>{if(!await confirm({title:tl("Delete this assignment?"),body:tl("Students no longer see it. Their attempts and scores stay."),ok:tl("Delete"),danger:true}))return;try{await api('/assignments/'+id,{method:'DELETE'});back()}catch(e){toast(e.message)}}
  return <><Bar title={d?.title||tl("Loading")} sub={d?[d.opens&&tl("opens {when}",{when:dueText(d.opens)}),tl("due {when}",{when:dueText(d.due)}),ATT_LABEL(d.attempts),COUNT_LABEL[d.counts||'best']].filter(Boolean).join(' · '):''} back={back}/><div className="main">
    {!d&&<Skeleton rows={3}/>}{d?.rows.map(r=><div key={r.id} className="row"><div>{r.name}<small>{r.attempts?tl("{used} of {n} attempts used",{used:r.used,n:d.attempts}):tl("{used} attempts",{used:r.used})}</small></div><StateChip x={r}/></div>)}
    {d&&<><h3 className="sec">{tl("Change")}</h3><label htmlFor="adue">{tl("Due")}</label><input id="adue" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/>
      <label htmlFor="aatt">{tl("Attempts")}</label><select id="aatt" value={att} onChange={e=>setAtt(e.target.value)}>{[1,2,3,0].map(n=><option key={n} value={n}>{ATT_LABEL(n)}</option>)}</select>
      <WindowFields id="ad" opens={opens} setOpens={setOpens} ins={ins} setIns={setIns} counts={counts} setCounts={setCounts}/>
      <button className="btn" disabled={busy} onClick={save}>{tl("Save changes")}</button><button className="btn ghost" style={{color:'var(--bad)'}} onClick={del}>{tl("Delete this assignment")}</button></>}</div></>}
export function AssignForm({toast,close}){
  const tomorrow=()=>{const t=new Date();t.setDate(t.getDate()+1);return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}T17:00`}  // tomorrow 5 pm, on this device's calendar
  const [cs,setCs]=useState(null),[cid,setCid]=useState(''),[o,setO]=useState(null),[kind,setKind]=useState('quiz'),[quiz,setQuiz]=useState(''),[tops,setTops]=useState([]),[size,setSize]=useState('10')
  const [who,setWho]=useState([]),[due,setDue]=useState(tomorrow),[att,setAtt]=useState('1'),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[opens,setOpens]=useState(''),[ins,setIns]=useState(''),[counts,setCounts]=useState('best')
  useEffect(()=>{api('/assign/options').then(r=>{setCs(r.courses);if(r.courses.length===1)setCid(String(r.courses[0].id))}).catch(e=>toast(e.message))},[])
  useEffect(()=>{setO(null);setQuiz('');setTops([]);setWho([]);if(cid)api('/assign/options?course_id='+cid).then(r=>{setO(r);if(!r.quizzes.length&&r.topics.length)setKind('mcq')}).catch(e=>toast(e.message))},[cid])
  const groups=o?[...new Set(o.students.map(x=>x.group))]:[],flip=(L,set,v)=>set(L.includes(v)?L.filter(x=>x!==v):[...L,v]),inGroup=g=>o.students.filter(x=>x.group===g).map(x=>x.id)
  const ok=o&&who.length&&due&&(kind==='quiz'?quiz:tops.length)
  const send=async()=>{setBusy(true);try{const r=await api('/assignments',{method:'POST',body:{course_id:+cid,kind,quiz_id:kind==='quiz'?+quiz:null,topic_ids:tops,size:+size,students:who,due,attempts:+att,title,opens:opens||null,instructions:ins,counts}})
    toast(tl("Assigned to {n} students",{n:r.students}));close()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet page close={close}><h3>{tl("Assign a test")}</h3>
    {!cs?<Skeleton rows={2}/>:!cs.length?<p className="known">{tl("No course to assign from yet.")}</p>:<div>{/* a div, not a fragment: a page sheet flattens fragments */}
    <label htmlFor="acs">{tl("Course")}</label><select id="acs" value={cid} onChange={e=>setCid(e.target.value)}><option value="">{tl("Choose a course")}</option>{cs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    {cid&&!o&&<Skeleton rows={2}/>}
    {o&&<div>
      <label id="akind">{tl("What")}</label><div className="seg" role="group" aria-labelledby="akind" style={{gridTemplateColumns:'1fr 1fr',marginTop:0}}>
        <button className={kind==='quiz'?'on':''} aria-pressed={kind==='quiz'} disabled={!o.quizzes.length} onClick={()=>setKind('quiz')}>{tl("A quiz or test")}</button>
        <button className={kind==='mcq'?'on':''} aria-pressed={kind==='mcq'} disabled={!o.topics.length} onClick={()=>setKind('mcq')}>{tl("An MCQ set")}</button></div>
      {kind==='quiz'?<><label htmlFor="aq">{tl("Quiz or test")}</label><select id="aq" value={quiz} onChange={e=>setQuiz(e.target.value)}><option value="">{tl("Choose one")}</option>{o.quizzes.map(q=><option key={q.id} value={q.id}>{q.title} · {tl("{n} questions",{n:q.questions})}</option>)}</select>
        {!o.quizzes.length&&<p className="known">{tl("This course has no published quiz or test yet.")}</p>}</>
      :<><label>{tl("Topics")}</label>{o.topics.map(t=><label key={t.id} className="chk"><input type="checkbox" checked={tops.includes(t.id)} onChange={()=>flip(tops,setTops,t.id)}/>{" "}{t.title} <small className="known">({tl("{n} MCQs",{n:t.mcqs})})</small></label>)}
        <label htmlFor="asz">{tl("Questions in the set")}</label><select id="asz" value={size} onChange={e=>setSize(e.target.value)}>{[5,10,15,20].map(n=><option key={n} value={n}>{n}</option>)}</select></>}
      <label>{tl("Students")}</label>
      {!o.students.length?<p className="known">{tl("No student takes this course yet.")}</p>:<>
        <label className="chk"><b><input type="checkbox" checked={who.length===o.students.length} onChange={()=>setWho(who.length===o.students.length?[]:o.students.map(x=>x.id))}/>{" "}{tl("Everyone ({n})",{n:o.students.length})}</b></label>
        {groups.length>1&&groups.map(g=>{const ids=inGroup(g),all=ids.every(i=>who.includes(i));return <label key={g} className="chk"><input type="checkbox" checked={all} onChange={()=>setWho(all?who.filter(i=>!ids.includes(i)):[...new Set([...who,...ids])])}/>{" "}{tl("All in {group}",{group:g||tl("No program")})} ({ids.length})</label>})}
        <details><summary className="known">{tl("Choose students one by one ({n} chosen)",{n:who.length})}</summary>{o.students.map(x=><label key={x.id} className="chk"><input type="checkbox" checked={who.includes(x.id)} onChange={()=>flip(who,setWho,x.id)}/>{" "}{x.name} <small className="known">{x.group}</small></label>)}</details></>}
      <label htmlFor="adue2">{tl("Due")}</label><input id="adue2" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/>
      <label htmlFor="aatt2">{tl("Attempts")}</label><select id="aatt2" value={att} onChange={e=>setAtt(e.target.value)}>{[1,2,3,0].map(n=><option key={n} value={n}>{ATT_LABEL(n)}</option>)}</select>
      <WindowFields id="af" opens={opens} setOpens={setOpens} ins={ins} setIns={setIns} counts={counts} setCounts={setCounts}/>
      <label htmlFor="atitle">{tl("Name (optional)")}</label><input id="atitle" value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} placeholder={kind==='quiz'?(o.quizzes.find(q=>String(q.id)===quiz)?.title||''):tl("MCQ set")}/>
      <button className="btn" disabled={busy||!ok} onClick={send}>{who.length?tl("Assign to {n} students",{n:who.length}):tl("Assign")}</button></div>}</div>}
    <button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export const Away=({a})=>!a?null:a.back_on?<span className="pill okp sm">{tl("Back since {when}",{when:day(a.back_on)})}</span>:a.state==='long'||a.state==='extended'?<span className="pill sm">{tl("Away {n} days",{n:a.days_away})}</span>:null  // S39, for teachers: a label, never what they did
export function StudentTrends({cid,sid,back,toast}){  // a course's teacher looking at one of its students (S38)
  const [d,setD]=useState(null);useEffect(()=>{api(`/reports/courses/${cid}/students/${sid}/trends`).then(setD).catch(e=>{toast(e.message);back()})},[sid])
  return <><Bar title={d?.student||tl("Performance")} sub={tl("Performance in this course")} back={back}/><div className="main">{!d?<Skeleton rows={3}/>:<TrendsView d={d}/>}</div></>}
export function ClassTrends({cid}){
  const [d,setD]=useState(null);useEffect(()=>{api(`/reports/courses/${cid}/trends`).then(setD).catch(()=>{})},[cid])
  if(!d||!d.tests.length)return null
  return <><h3 className="sec">{tl("Tests over time")}</h3>
    {d.tests.map(t=><div key={t.id} className="row"><div>{t.title}<small>{[tl("{n} students · first try {a}% · best {b}% on average",{n:t.students,a:t.first,b:t.best}),t.retook>0&&tl("{n} took it again: {a}% → {b}%",{n:t.retook,a:t.retake_first,b:t.retake_latest})].filter(Boolean).join(' · ')}</small><Bar2 v={t.first}/></div></div>)}
    {d.months.length>1&&<div className="row"><div><small>{tl("Average test score by month: {list}",{list:d.months.map(m=>m.month+' '+m.average+'%').join(', ')})}</small></div><Spark xs={d.months.map(m=>m.average)}/></div>}</>}
// the bank, for admins and the faculty who own a course: write, upload, ask the AI for drafts, publish and retire
export const MCQ_ST=L({draft:'Draft',review:'Needs review',published:'Published',retired:'Retired'}),MCQ_SRC=L({admin:'Admin',teacher:'Teacher',ai:'AI'}),MCQ_DIFF=L({easy:'Easy',medium:'Medium',hard:'Hard'})
export function McqBank({toast}){
  const confirm=useConfirm()
  const [courses,setCourses]=useState(null),[cid,setCid]=useState(''),[tid,setTid]=useState(''),[st,setSt]=useState(''),[q,setQ]=useState(''),[edit,setEdit]=useState(null),[n,setN]=useState(0),[busy,setBusy]=useState(false),[csv,setCsv]=useState(null)
  useEffect(()=>{api('/tree').then(tr=>{const seen=new Set(),out=[];for(const p of tr)for(const sm of p.semesters)for(const c of sm.courses)if(c.editable&&!seen.has(c.id)){seen.add(c.id);out.push({id:c.id,name:c.name,place:p.name+' › '+sm.name,topics:c.units.flatMap(u=>u.topics.map(t=>({id:t.id,title:t.title,unit:u.name,unit_id:u.id})))})}
    setCourses(out)}).catch(e=>toast(e.message))},[])
  const list=usePaged(o=>`/mcq/items?limit=${PAGE}&offset=${o}`+(cid?'&course_id='+cid:'')+(tid?'&topic_id='+tid:'')+(st?'&status='+st:'')+(q?'&q='+encodeURIComponent(q):''),[cid,tid,st,q,n],toast)
  const [waiting,setWaiting]=useState(0),scope=(cid?'&course_id='+cid:'')+(tid?'&topic_id='+tid:'')
  useEffect(()=>{api('/mcq/items?status=review&limit=1'+scope).then(r=>setWaiting(r.total)).catch(()=>{})},[cid,tid,n])  // AI questions from students' sets collect here
  const reviewAll=async action=>{const pub=action==='publish',co=courses.find(x=>String(x.id)===String(cid)),tp=co?.topics.find(x=>String(x.id)===String(tid))
    const where=tp?co.name+' › '+tp.title:co?co.name:tl("all your courses")  // what the count covers, so nobody publishes more than they meant to
    if(!await confirm({title:waiting===1?tl(pub?"Publish the 1 waiting question in {where}?":"Dismiss the 1 waiting question in {where}?",{where}):tl(pub?"Publish all {n} waiting questions in {where}?":"Dismiss all {n} waiting questions in {where}?",{n:waiting,where}),
      body:pub?tl("Students get them in new sets from now on. Check a few first: the AI writes them from the topic's notes."):tl("They are removed. Any that a student already had in a set are retired instead, so the student's result keeps it."),ok:pub?tl("Publish all"):tl("Dismiss all"),danger:!pub}))return
    try{const r=await api('/mcq/items/review',{method:'POST',body:{action,course_id:Number(cid)||0,topic_id:Number(tid)||0}});toast(pub?tl("{n} published",{n:r.published}):tl("{n} dismissed",{n:r.retired+r.deleted}));setN(n+1)}catch(e){toast(e.message)}}
  if(!courses)return <><Bar title={tl("MCQ bank")}/><div className="main"><Skeleton/></div></>
  const c=courses.find(x=>String(x.id)===String(cid)),topics=c?c.topics:[]
  const status=async(x,s)=>{try{await api(`/mcq/items/${x.id}/status`,{method:'POST',body:{status:s}});toast(tl(MCQ_ST[s]));setN(n+1)}catch(e){toast(e.message)}}
  const del=async x=>{if(!await confirm({title:tl("Delete this question?"),body:tl("This can't be undone."),ok:tl("Delete"),danger:true}))return;try{await api(`/mcq/items/${x.id}`,{method:'DELETE'});setN(n+1)}catch(e){toast(e.message)}}
  const ai=async()=>{setBusy(true);try{const r=await api('/mcq/generate',{method:'POST',body:{topic_id:Number(tid),count:5}});toast(tl("{n} AI questions are waiting for your review",{n:r.added}));setSt('review');setN(n+1)}catch(e){toast(e.message)}setBusy(false)}
  return <><Bar title={tl("MCQ bank")} sub={tl("Practice questions for your courses")}/><div className="main">
    {!courses.length?<p className="known">{tl("You don't own a course yet, so there is nothing to add questions to.")}</p>:<>
    <div className="two"><select aria-label={tl("Course")} value={cid} onChange={e=>{setCid(e.target.value);setTid('')}}><option value="">{tl("All my courses")}</option>{courses.map(x=><option key={x.id} value={x.id}>{x.name} · {x.place}</option>)}</select>
      <select aria-label={tl("Topic")} value={tid} onChange={e=>setTid(e.target.value)} disabled={!c}><option value="">{tl("All topics")}</option>{topics.map(t=><option key={t.id} value={t.id}>{t.title} · {t.unit}</option>)}</select></div>
    <div className="two"><Opts label={tl("Status")} value={st} set={setSt} items={[['',tl("Every status")],...Object.entries(MCQ_ST)]}/><input type="search" aria-label={tl("Search questions")} placeholder={tl("Search questions")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="two"><button className="btn" disabled={!tid} onClick={()=>setEdit({topic_id:Number(tid)})}>{tl("New question")}</button>
      <button className="btn ghost" disabled={!tid} onClick={()=>setCsv(true)}><Upload size={16}/>{" "}{tl("Upload a CSV")}</button>
      <button className="btn ghost" disabled={!tid||busy} onClick={ai}><Sparkles size={16}/>{" "}{busy?tl("Writing questions…"):tl("AI drafts")}</button></div>
    {!tid&&<p className="known">{tl("Choose a course and a topic to add questions to it.")}</p>}
    {waiting>0&&<div className="qbox" role="status"><b>{tl("{n} questions are waiting for review",{n:waiting})}</b><p className="known" style={{margin:'4px 0 8px'}}>{tl("Mostly AI questions from students' sets. Students get them only once they are published.")}</p>
      <div className="two">{st!=='review'&&<button className="btn ghost" style={{marginTop:0}} onClick={()=>setSt('review')}>{tl("Show them")}</button>}<button className="btn" style={{marginTop:0}} onClick={()=>reviewAll('publish')}>{tl("Publish all")}</button><button className="btn ghost" style={{marginTop:0}} onClick={()=>reviewAll('dismiss')}>{tl("Dismiss all")}</button></div></div>}
    {list.items.map(x=><div className="qbox" key={x.id}><b>{x.topic}</b>{" "}<span className={'pill sm'+(x.status==='published'?' okp':x.status==='retired'?' off':'')}>{tl(MCQ_ST[x.status])}</span>
      <small className="known">{" "}{tl(MCQ_SRC[x.source])}{x.author?' · '+x.author:''} · {tl(MCQ_DIFF[x.difficulty])} · v{x.version}{x.uses?' · '+tl(x.uses===1?"in 1 set":"in {n} sets",{n:x.uses}):''}</small>
      <div className="prose"><Md>{x.text}</Md></div><QImg src={x.image} alt=""/>
      <div className="bopts">{x.options.map((o,k)=><div key={k} className={'opt'+(k===x.correct?' ok':'')}><b className="olet">{LET[k]}</b><OptBody text={o} img={x.option_images[k]} k={k}/></div>)}</div>
      {x.explanation&&<div className="known"><Md>{x.explanation}</Md></div>}
      <div className="chips wrap"><button className="tool" onClick={()=>setEdit(x)}><Pencil size={14}/>{" "}{tl("Edit")}</button>
        {x.status!=='published'&&<button className="tool" onClick={()=>status(x,'published')}>{tl("Publish")}</button>}
        {x.status==='published'&&<button className="tool" onClick={()=>status(x,'retired')}>{tl("Retire")}</button>}
        {x.status!=='draft'&&x.status!=='published'&&<button className="tool" onClick={()=>status(x,'draft')}>{tl("Back to draft")}</button>}
        {!x.uses&&<button className="tool" onClick={()=>del(x)}><Trash2 size={14}/>{" "}{tl("Delete")}</button>}</div></div>)}
    {list.total===0&&<p className="known">{tl("No questions here yet.")}</p>}<Pager page={list.page} total={list.total} onPage={list.setPage}/></>}
    {edit&&<McqItemSheet x={edit} topics={c?c.topics:courses.flatMap(y=>y.topics)} close={()=>setEdit(null)} done={()=>{setEdit(null);setN(n+1)}} toast={toast}/>}
    {csv&&c&&<McqCsvSheet course={c} tid={Number(tid)} close={()=>setCsv(null)} done={()=>{setCsv(null);setSt('draft');setN(n+1)}} toast={toast}/>}
  </div></>}
export function McqItemSheet({x,topics,close,done,toast}){  // a new question (x has only topic_id) or an edit; text, answers and explanation take Markdown, maths ($...$) and images
  const [v,setV]=useState({text:x.text||'',options:x.options||['','','',''],option_images:x.option_images?.length?x.option_images:(x.options||['','','','']).map(()=>''),correct:x.correct??0,
    explanation:x.explanation||'',image:x.image||'',explanation_image:x.explanation_image||'',difficulty:x.difficulty||'medium',keywords:x.keywords||'',topic_id:x.topic_id,status:'draft'}),[busy,setBusy]=useState(false)
  const set=(k,val)=>setV(p=>({...p,[k]:val})),opt=(i,k,val)=>setV(p=>({...p,[k]:p[k].map((o,n)=>n===i?val:o)}))
  const add=()=>setV(p=>({...p,options:[...p.options,''],option_images:[...p.option_images,'']})),drop=i=>setV(p=>({...p,options:p.options.filter((_,n)=>n!==i),option_images:p.option_images.filter((_,n)=>n!==i),correct:p.correct===i?0:p.correct>i?p.correct-1:p.correct}))
  const save=async status=>{setBusy(true);try{const body={...v,status};if(x.id)await api('/mcq/items/'+x.id,{method:'PUT',body});else await api('/mcq/items',{method:'POST',body});toast(tl("Saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet close={close}><h3>{x.id?tl("Edit question"):tl("New question")}</h3>
    {x.id&&x.uses>0&&<p className="known">{tl("Sets already started keep the version they were given.")}</p>}
    <label htmlFor="mqt">{tl("Topic")}</label><select id="mqt" value={v.topic_id} onChange={e=>set('topic_id',Number(e.target.value))}>{topics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
    <label htmlFor="mqq">{tl("Question")}</label><textarea id="mqq" rows={3} value={v.text} maxLength={4000} onChange={e=>set('text',e.target.value)} placeholder={tl("Markdown and maths like $x^2$ work here")}/>
    {v.text&&<div className="prose known"><Md>{v.text}</Md></div>}<ImgSlot url={v.image} label={tl("the question")} onSet={u=>set('image',u)} toast={toast}/>
    <fieldset className="opts"><legend>{tl("Answers · pick the correct one")}</legend>{v.options.map((o,i)=><div key={i} className="optedit">
      <input type="radio" name="mqc" checked={v.correct===i} onChange={()=>set('correct',i)} aria-label={tl("Answer {k} is correct",{k:LET[i]})}/><b className="olet">{LET[i]}</b>
      <input value={o} maxLength={1000} onChange={e=>opt(i,'options',e.target.value)} aria-label={tl("Answer {k}",{k:LET[i]})}/>
      <ImgSlot small url={v.option_images[i]} label={tl("answer {k}",{k:LET[i]})} onSet={u=>opt(i,'option_images',u)} toast={toast}/>
      {v.options.length>2&&<button className="ic sm" aria-label={tl("Remove answer {k}",{k:LET[i]})} onClick={()=>drop(i)}><X size={16}/></button>}</div>)}
      {v.options.length<6&&<button className="tool" onClick={add}>{tl("Add an answer")}</button>}</fieldset>
    <label htmlFor="mqe">{tl("Explanation")}</label><textarea id="mqe" rows={3} value={v.explanation} maxLength={4000} onChange={e=>set('explanation',e.target.value)}/>
    <ImgSlot url={v.explanation_image} label={tl("the explanation")} onSet={u=>set('explanation_image',u)} toast={toast}/>
    <div className="two"><div><label>{tl("Difficulty")}</label><Opts label={tl("Difficulty")} value={v.difficulty} set={d=>set('difficulty',d)} items={Object.entries(MCQ_DIFF)}/></div>
      <div><label htmlFor="mqk">{tl("Keywords")}</label><input id="mqk" value={v.keywords} maxLength={300} onChange={e=>set('keywords',e.target.value)} placeholder={tl("comma, separated")}/></div></div>
    {x.id?<button className="btn" disabled={busy} onClick={()=>save(x.status)}>{tl("Save")}</button>:<div className="two"><button className="btn" disabled={busy} onClick={()=>save('published')}>{tl("Publish")}</button><button className="btn ghost" disabled={busy} onClick={()=>save('draft')}>{tl("Save as draft")}</button></div>}
    <button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export function McqCsvSheet({course,tid,close,done,toast}){  // the quiz CSV format; rows go to their own topic column, rows without one to the chosen topic, and a topic the
  // file names but the course doesn't have is the teacher's choice, or left out: nothing lands under a topic nobody picked. Saved as drafts to review
  const [p,setP]=useState(null),[busy,setBusy]=useState(false),[to,setTo]=useState({})  // to: a row's topic id, '' while undecided, '0' to leave it out
  const read=async e=>{const f=e.target.files[0];if(!f)return;setBusy(true)
    try{const r=await api('/quizzes/parse-csv',{method:'POST',body:{csv:await f.text(),course_id:course.id}});setP(r);setTo(Object.fromEntries(r.questions.map(q=>[q.row,String(q.topic_id||(q.topic_name?'':tid))])))}catch(x){toast(x.message)}setBusy(false)}
  const qs=p?p.questions:[],odd=qs.filter(q=>!q.topic_id&&q.topic_name),keep=qs.filter(q=>to[q.row]&&to[q.row]!=='0'),undecided=odd.filter(q=>!to[q.row]).length
  const per=Object.entries(keep.reduce((a,q)=>({...a,[to[q.row]]:(a[to[q.row]]||0)+1}),{})).map(([id,n])=>[course.topics.find(t=>String(t.id)===id)?.title||'',n])
  const save=async()=>{setBusy(true);try{const r=await api('/mcq/items/bulk',{method:'POST',body:{status:'draft',items:keep.map(q=>({topic_id:Number(to[q.row]),text:q.text,options:q.options,correct:q.correct,explanation:q.explanation,
    image:q.image,option_images:q.option_images,keywords:q.area||''}))}});toast(tl("{added} added as drafts, {skipped} already in the bank",r));done()}catch(x){toast(x.message)}setBusy(false)}
  return <Sheet close={close}><h3>{tl("Upload questions")}</h3><p className="known">{tl("The same CSV as for quizzes: question, a, b, c, d, correct, and optionally explanation, topic, area. Rows without a topic go to the topic you chose. They arrive as drafts.")}</p>
    <input type="file" accept=".csv,text/csv" onChange={read} disabled={busy}/>
    {p&&<><p className="known">{tl("{n} questions ready.",{n:p.count})}{p.error_count?' '+tl("{n} rows have problems and are left out.",{n:p.error_count}):''}{p.images_needed.length?' '+tl("Image files named in the file aren't uploaded here; add them by editing the questions."):''}</p>
      {p.errors.slice(0,5).map(e=><p key={e.row} className="known warn">{tl("Row {row}: {error}",{row:e.row,error:srv(e.error)})}</p>)}
      {per.length>0&&<><b>{tl("Where they go")}</b><ul className="known" style={{marginTop:4}}>{per.map(([t,n])=><li key={t}>{t}: {pl(n,'question')}</li>)}</ul></>}
      {odd.length>0&&<><p className="known warn">{tl(odd.length===1?"1 row names a topic this course doesn't have. Choose a topic for it, or leave it out.":"{n} rows name a topic this course doesn't have. Choose a topic for each, or leave it out.",{n:odd.length})}</p>
        {odd.map(q=><div key={q.row}><label htmlFor={'mt'+q.row}>{tl("Row {row}: “{topic}”",{row:q.row,topic:q.topic_name})}{' · '}{(q.text||'').slice(0,60)}</label>
          <select id={'mt'+q.row} value={to[q.row]} onChange={e=>setTo({...to,[q.row]:e.target.value})}><option value="" disabled>{tl("Choose a topic")}</option><option value="0">{tl("Leave it out")}</option>
            {course.topics.map(t=><option key={t.id} value={t.id}>{t.title} · {t.unit}</option>)}</select></div>)}</>}
      <button className="btn" disabled={busy||!keep.length||undecided>0} onClick={save}>{tl("Add {n} as drafts",{n:keep.length})}</button>
      {undecided>0&&<p className="known">{tl("Choose a topic, or Leave it out, for each row above first.")}</p>}</>}
    <button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export function CourseReports({toast,onOpen}){
  const [f,setF]=useState({p:0,s:0}),[rows,setRows]=useState(null),[progs,setProgs]=useState([])
  useEffect(()=>{api('/tree').then(t=>setProgs(t.map(p=>({id:p.id,name:p.name,term:p.term,max:Math.max(0,...p.semesters.map(x=>x.number||0))||(p.term==='Year'?4:maxOf(p.term))})))).catch(()=>{})},[])
  const pr=progs.find(x=>x.id===f.p),lab=pr?pr.term:progs.length&&progs.every(x=>x.term==='Semester')?'Semester':progs.length&&progs.every(x=>x.term==='Year')?'Year':progs.length&&progs.every(x=>x.term==='Grade')?'Grade':'Term',top=pr?pr.max:Math.max(1,...progs.map(x=>x.max))
  const qs=`?program_id=${f.p}&semester=${f.s}`
  useEffect(()=>{setRows(null);api('/reports/courses'+qs).then(setRows).catch(e=>toast(e.message))},[f.p,f.s])
  const [q,setQ]=useState(''),[sort,setSort]=useState('name'),head=useRef()
  const few=!f.p&&!f.s&&progs.length<=1&&rows&&rows.length<=5  // a handful of courses needs no filters
  const by={name:(a,b)=>a.course.localeCompare(b.course),low:(a,b)=>a.avg_completion-b.avg_completion,high:(a,b)=>b.avg_completion-a.avg_completion,students:(a,b)=>b.students-a.students,quiz:(a,b)=>(a.avg_quiz_percent??101)-(b.avg_quiz_percent??101)}[sort]
  const shown=rows&&rows.filter(x=>has(q,x.course,x.program,x.semester)).sort(by),{items,total,page,setPage}=useLocalPage(shown,[q,sort,f.p,f.s],PAGE)
  return <><div ref={head} className="pgtop"/>{!few&&<div className="qopt"><select value={f.p} onChange={e=>{const p=+e.target.value,x=progs.find(y=>y.id===p);setF({p,s:x&&f.s>x.max?0:f.s})}}><option value={0}>{tl("All programs")}</option>{progs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <select aria-label={tl("Filter by {lab}",{lab:lab.toLowerCase()})} value={f.s} onChange={e=>setF({...f,s:+e.target.value})}><option value={0}>{lab==='Term'?tl("All terms"):tl("All {lab}s",{lab:lab.toLowerCase()})}</option>{Array.from({length:top},(_,i)=>i+1).map(n=><option key={n} value={n}>{lab} {n}</option>)}</select></div>}
    {!few&&<div className="filters fit"><div className="search"><Search size={18}/><input type="search" aria-label={tl("Search courses")} placeholder={tl("Search courses")} value={q} onChange={e=>setQ(e.target.value)}/></div>
      <Opts label={tl("Sort by")} value={sort} set={setSort} items={[['name',tl("Sort: name")],['low',tl("Sort: lowest completion first")],['high',tl("Sort: highest completion first")],['students',tl("Sort: most students")],['quiz',tl("Sort: lowest quiz average first")]]}/></div>}
    {!rows&&<Skeleton/>}{rows&&!total&&<p className="known">{tl("No courses match.")}</p>}
    {items.map(x=><button className="row rowbtn" key={x.course_id} onClick={()=>onOpen(x)}><div>{x.course}<small>{[x.program,x.semester,pl(x.students,'student'),pl(x.topics,'topic'),tl('{n}% completed',{n:x.avg_completion}),tl('{n}% opened',{n:x.avg_opened})].filter(Boolean).join(' · ')}{x.quizzes&&x.avg_quiz_percent!=null?tl(" · quiz avg {v}%",{v:x.avg_quiz_percent}):''}</small><Bar2 v={x.avg_completion}/></div><ChevronRight size={18}/></button>)}
    <Pager page={page} total={total} onPage={setPage} size={PAGE} anchor={head}/>
    {rows?.length>0&&<button className="btn ghost" onClick={()=>fetchFile('/reports/courses?format=csv&program_id='+f.p+'&semester='+f.s,'courses.csv',toast)}>{tl("Download courses CSV")}</button>}</>}
export function StudentReport({c,back,toast}){
  const [q,setQ]=useState(''),[show,setShow]=useState(''),[sort,setSort]=useState('name')
  const [d,setD]=useState(null),[w,setW]=useState(null),[perf,setPerf]=useState(null);useEffect(()=>{api(`/reports/courses/${c.course_id}/students`).then(setD).catch(e=>toast(e.message));api(`/reports/courses/${c.course_id}/weak-areas`).then(setW).catch(()=>{})},[])
  const keep={'':()=>true,active:x=>x.active,disabled:x=>!x.active,never:x=>!x.topics_read,behind:x=>x.completion<50,needs:x=>x.needs_study.length>0,away:x=>x.activity&&(x.activity.state==='extended'||x.activity.state==='long'),back:x=>!!x.activity?.back_on}[show],seen=x=>x.last_active||''
  const by={name:(a,b)=>(a.name||'').localeCompare(b.name||''),low:(a,b)=>a.completion-b.completion,high:(a,b)=>b.completion-a.completion,recent:(a,b)=>seen(b).localeCompare(seen(a)),quiet:(a,b)=>seen(a).localeCompare(seen(b))}[sort]
  const shown=d&&d.students.filter(x=>keep(x)&&has(q,x.name,x.email)).sort(by),{items,total,page,setPage}=useLocalPage(shown,[q,show,sort])
  if(perf)return <StudentTrends cid={c.course_id} sid={perf} back={()=>setPerf(null)} toast={toast}/>
  return <><Bar title={c.course} sub={c.program+' · '+c.semester} back={back}/><div className="main">
    {w&&w.areas.length>0&&<><h3 className="sec first">{tl("Topics the class finds hard")}</h3><p className="known" style={{margin:'0 0 8px'}}>{tl("From every test and MCQ set, weakest first. A student is counted only after 5 or more questions over 2 or more sittings.")}</p>{<Paged rows={w.areas} render={a=><div className="row" key={a.topic_id||'u'+a.unit_id}><div>{a.title}<small>{a.percent}{tl("% right overall · of {students} students: {needs_study} need attention, {getting_there} need revision, {not_assessed} not assessed yet",{needs_study:a.needs_study,getting_there:a.getting_there,not_assessed:a.not_assessed,students:a.students})}</small><Bar2 v={a.percent}/></div></div>}/>}<h3 className="sec">{tl("Students")}</h3></>}
    <ClassTrends cid={c.course_id}/>
    {d&&!d.students.length&&<p className="known">{tl("No students are enrolled for this course yet.")}</p>}
    {d?.students.length>5&&<><div className="search"><Search size={18}/><input type="search" aria-label={tl("Search students")} placeholder={tl("Search by name or email")} value={q} onChange={e=>setQ(e.target.value)}/></div>
      <div className="filters fit"><Opts label={tl("Show")} value={show} set={setShow} items={[['',tl("All students")],['active',tl("Active")],['disabled',tl("Disabled")],['never',tl("Never opened a topic")],['behind',tl("Under 50% completed")],['needs',tl("Need attention")],['away',tl("Away from learning")],['back',tl("Back after a break")]]}/>
        <Opts label={tl("Sort by")} value={sort} set={setSort} items={[['name',tl("Sort: name")],['low',tl("Sort: lowest completion first")],['high',tl("Sort: highest completion first")],['recent',tl("Sort: recently active first")],['quiet',tl("Sort: longest inactive first")]]}/></div>
      {!total&&<p className="known">{tl("Nothing matches.")}</p>}</>}
    {!d&&<Skeleton/>}{items.map(x=><div className="row" key={x.email}><div>{x.name}{!x.active&&<span className="pill off sm">{tl("Disabled")}</span>}{" "}<Away a={x.activity}/><small>{x.completion}{tl("% completed · {topics_completed}/{topics} done, {topics_read} opened{v} · last active",{topics_completed:x.topics_completed,topics:x.topics,topics_read:x.topics_read,v:c.quizzes?' · quizzes '+x.quizzes_taken+'/'+x.quizzes+(x.avg_quiz_percent!=null?', avg '+x.avg_quiz_percent+'%':''):''})}{" "}{day(x.last_active)}</small>{(x.strong.length>0||x.needs_study.length>0)&&<small>{x.strong.length>0&&tl("Strong: {strong}",{strong:x.strong.join(', ')})}{x.strong.length>0&&x.needs_study.length>0&&' · '}{x.needs_study.length>0&&tl("Needs attention: {needs_study}",{needs_study:x.needs_study.join(', ')})}</small>}<Bar2 v={x.completion}/></div>{x.user_id&&<button className="btn ghost sm" onClick={()=>setPerf(x.user_id)}>{tl("Performance")}</button>}</div>)}
    <Pager page={page} total={total} onPage={setPage}/>
    {d?.students.length>0&&<button className="btn ghost" onClick={()=>fetchFile(`/reports/courses/${c.course_id}/students?format=csv`,'students-'+c.course.replace(/\s+/g,'_')+'.csv',toast)}>{tl("Download students CSV")}</button>}</div></>}
export function Reports({role,toast}){
  const [st,setSt]=useState({}),[open,setOpen]=useState(null)
  useEffect(()=>{if(role==='faculty')return;api('/admin/stats').then(setSt).catch(()=>{})},[])
  if(open)return <StudentReport c={open} back={()=>setOpen(null)} toast={toast}/>
  if(role==='faculty')return <><Bar title={tl("Reports")} sub={tl("Your courses")}/><div className="main"><CourseReports toast={toast} onOpen={setOpen}/></div></>
  return <><Bar title={tl("Reports")}/><div className="main"><div className="stats">
    {[['students',tl("Students")],['topics',tl("Topics")],['cached',tl("Saved AI answers")],['tokens_saved',tl("Tokens saved")]].map(([k,l])=><div className="stat" key={k}><b>{(st[k]??0).toLocaleString()}</b>{l}</div>)}</div>
    <h3 className="sec">{tl("Courses")}</h3><CourseReports toast={toast} onOpen={setOpen}/>
    <h3 className="sec">{tl("Most read topics")}</h3>
    <ReportList kind="topics" toast={toast} search={tl("Search topics or courses")} empty="No reading activity yet."
      sorts={[['reads',tl("Sort: most reads")],['readers',tl("Sort: most students")],['least',tl("Sort: fewest reads")],['title',tl("Sort: title")]]}
      render={x=><div>{x.title}<small>{[x.course,pl(x.readers,'student'),pl(x.reads,'read')].join(' · ')}</small></div>}/>
    <h3 className="sec">{tl("Students")}</h3>
    <ReportList kind="students" toast={toast} search={tl("Search by name or email")} empty="No students yet."
      shows={[['',tl("All students")],['active',tl("Active")],['disabled',tl("Disabled")],['never',tl("Never opened a topic")],['quiet',tl("Not active in the last 7 days")]]}
      sorts={[['recent',tl("Sort: recently active first")],['quiet',tl("Sort: longest inactive first")],['most',tl("Sort: most topics read")],['least',tl("Sort: fewest topics read")],['name',tl("Sort: name")]]}
      render={x=><div>{x.name}<small>{x.topics_read}{" "}{tl("topics read, last active")}{" "}{day(x.last_active)}{!x.active&&tl(", disabled")}</small></div>}/>
    <h3 className="sec">{tl("Saved AI answers")}</h3>
    <ReportList kind="ai" toast={toast} search={tl("Search topics")} empty="Nothing saved yet."
      shows={[['',tl("Explanations and sample answers")],['explain',tl("Explanations")],['answer',tl("Sample answers")]]}
      sorts={[['saved',tl("Sort: most tokens saved")],['hits',tl("Sort: most reused")],['newest',tl("Sort: newest first")],['title',tl("Sort: title")]]}
      render={x=><div>{x.title}<small>{x.kind==='explain'?tl("Explanation"):tl("Sample answer")}{tl(", reused {hits} times, {saved} tokens saved",{hits:x.hits,saved:x.saved.toLocaleString()})}</small></div>}/></div></>}
// one of the admin Reports lists, a page at a time from the server: search, a filter and a sort above it, numbered pages below
export function ReportList({kind,toast,search,shows,sorts,render,empty}){
  const [q,setQ]=useState(''),[show,setShow]=useState(''),[sort,setSort]=useState(sorts[0][0]),top=useRef()
  const {items,total,page,setPage,ready}=usePaged(o=>`/admin/reports/${kind}?q=${encodeURIComponent(q)}&show=${show}&sort=${sort}&limit=${PAGE}&offset=${o}`,[q,show,sort],toast,PAGE)
  return <div ref={top} className="pgtop"><div className="filters fit"><div className="search"><Search size={18}/><input type="search" aria-label={search} placeholder={search} value={q} onChange={e=>setQ(e.target.value)}/></div>
      {shows&&<Opts label={tl("Show")} value={show} set={setShow} items={shows}/>}<Opts label={tl("Sort by")} value={sort} set={setSort} items={sorts}/></div>
    {!ready?<Skeleton/>:items.length?items.map(x=><div className="row" key={x.id}>{render(x)}</div>):<p className="known">{q||show?tl("Nothing matches."):tl(empty)}</p>}
    <Pager page={page} total={total} onPage={setPage} size={PAGE} anchor={top}/></div>}
