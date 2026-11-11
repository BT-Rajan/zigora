// plan pages, loaded only when one of them is opened (split from App.jsx; the shell and shared helpers stay there)
import {useState,useEffect,useContext} from 'react'
import {Md} from '../content.jsx'
import {ROOT} from '../base.js'
import {Plus,ChevronLeft,ChevronRight,Copy,Trash2,Play} from 'lucide-react'
import {t as tl,srv,getLang} from '../i18n.js'
import {Bar,CalItem,Ctx,Sheet,Skeleton,WD,api,classWhen,joinClass,ofYmd,plusDays,useConfirm,wd,when,ymd} from '../App.jsx'
// The calendar: events people add (exams, holidays, tests, due work, reminders) beside what Zigora knows (learn-by dates, study sessions, days
// studied, results). A parent or teacher picks one of their students; a private link puts it all in a phone's calendar.
export const EV_KINDS=[['exam',"Exam"],['test',"Test"],['assignment',"Assignment"],['holiday',"Holiday"],['event',"Event"],['reminder',"Reminder"]]
export const gridStart=m=>plusDays(m,-((m.getDay()+6)%7))  // the Monday on or before the 1st
export const covers=(x,day)=>x.date===day||(x.end&&x.date<=day&&day<=x.end)
export function CalendarPage({toast}){
  const confirm=useConfirm(),role=useContext(Ctx).role
  const [month,setMonth]=useState(()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),1)}),[d,setD]=useState(null),[day,setDay]=useState(null)
  const [student,setStudent]=useState(0),[form,setForm]=useState(null),[opts,setOpts]=useState(null),[link,setLink]=useState(null),[tick,setTick]=useState(0)
  useEffect(()=>{const s0=gridStart(month);setD(null)
    api(`/calendar?start=${ymd(s0)}&end=${ymd(plusDays(s0,41))}${student?`&student=${student}`:''}`).then(setD).catch(e=>toast(e.message))},[month,student,tick,toast])
  useEffect(()=>{api('/calendar/options').then(setOpts).catch(()=>{});api('/calendar/link').then(setLink).catch(()=>{})},[])
  const today=d?.today||ymd(new Date()),shown=d?.items||[]
  const cells=Array.from({length:42},(_,i)=>plusDays(gridStart(month),i)),onDay=k=>shown.filter(x=>covers(x,k))
  const upcoming=shown.filter(x=>(x.end||x.date)>=today&&!['studied','result'].includes(x.kind)&&x.state!=='done').slice(0,8)
  const open=x=>{const e=x?.event;setForm(e?{id:e.id,title:x.title,kind:x.kind,day:x.date,end_day:x.end||'',at:x.at||'',notes:e.notes,scope:e.scope,program_id:e.program_id||'',semester:e.semester||'',course_id:e.course_id||'',user_id:e.user_id||''}
    :{title:'',kind:role==='student'?'reminder':'exam',day:day||today,end_day:'',at:'',notes:'',scope:opts?.scopes?.[0]||'user',program_id:'',semester:'',course_id:'',user_id:student||''})}
  const save=async()=>{const f=form,num=v=>v===''||v==null?null:+v,body={...f,end_day:f.end_day||null,at:f.at||null,program_id:num(f.program_id),semester:num(f.semester),course_id:num(f.course_id),user_id:num(f.user_id)}
    try{await api(f.id?`/calendar/events/${f.id}`:'/calendar/events',{method:f.id?'PUT':'POST',body});setForm(null);setTick(t=>t+1);toast(f.id?tl("Event saved"):tl("Event added"))}catch(e){toast(e.message)}}
  const del=async()=>{if(!await confirm({title:tl("Delete this event?"),body:tl("It goes from everyone's calendar it was on."),ok:tl("Delete"),danger:true}))return
    try{await api(`/calendar/events/${form.id}`,{method:'DELETE'});setForm(null);setTick(t=>t+1);toast(tl("Event deleted"))}catch(e){toast(e.message)}}
  const makeLink=async()=>{if(link?.on&&!await confirm({title:tl("Make a new link?"),body:tl("The old link stops working: calendars that use it need the new one."),ok:tl("Make a new link")}))return
    try{const r=await api('/calendar/link',{method:'POST'});setLink({...r,url:location.origin+ROOT+r.path})}catch(e){toast(e.message)}}
  const stopLink=async()=>{try{setLink(await api('/calendar/link/off',{method:'POST'}));toast(tl("Calendar link turned off"))}catch(e){toast(e.message)}}
  const copy=async()=>{try{await navigator.clipboard.writeText(link.url);toast(tl("Link copied"))}catch{toast(tl("Copy the link from the box"))}}
  const set=k=>e=>setForm({...form,[k]:e.target.value}),title=month.toLocaleDateString(getLang(),{month:'long',year:'numeric'})
  const wk=Array.from({length:7},(_,i)=>plusDays(new Date(2024,0,1),i).toLocaleDateString(getLang(),{weekday:'narrow'}))  // 1 Jan 2024 was a Monday
  const f=form,sc=f?.scope,progs=opts?.programs||[],p=progs.find(x=>String(x.id)===String(f?.program_id))
  return <><Bar title={tl("Calendar")} sub={d?.student?tl("{name}'s calendar",{name:d.student.name}):null}/><div className="main">
    {role==='guardian'&&d?.students?.length>0&&<><label htmlFor="cst">{tl("Whose calendar")}</label><select id="cst" value={student} onChange={e=>{setStudent(+e.target.value);setDay(null)}}>
      <option value={0}>{tl("My own events")}</option>{d.students.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
    <div className="calhead"><button className="ic" aria-label={tl("Previous month")} onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()-1,1));setDay(null)}}><ChevronLeft/></button>
      <b aria-live="polite">{title}</b><button className="ic" aria-label={tl("Next month")} onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()+1,1));setDay(null)}}><ChevronRight/></button>
      <button className="tool" onClick={()=>{const n=new Date();setMonth(new Date(n.getFullYear(),n.getMonth(),1));setDay(today)}}>{tl("Today")}</button>
      {opts&&<button className="tool" onClick={()=>open(null)}><Plus size={16}/>{" "}{tl("Add event")}</button>}</div>
    <div className="calgrid" role="grid" aria-label={title}>{wk.map((w,i)=><div key={'w'+i} className="calwd" aria-hidden="true">{w}</div>)}
      {cells.map(c=>{const k=ymd(c),xs=onDay(k),out=c.getMonth()!==month.getMonth(),studied=xs.some(x=>x.kind==='studied'),marks=xs.filter(x=>x.kind!=='studied')
        return <button key={k} role="gridcell" aria-selected={day===k} className={'calday'+(out?' out':'')+(k===today?' today':'')+(day===k?' on':'')} onClick={()=>setDay(day===k?null:k)}
          aria-label={`${c.toLocaleDateString(getLang(),{day:'numeric',month:'long'})}${marks.length?', '+tl(marks.length===1?"{n} item":"{n} items",{n:marks.length}):''}${studied?', '+tl("studied"):''}`}>
          <span className="caln">{c.getDate()}{studied&&<i className="calstudied" aria-hidden="true"/>}</span>
          <span className="caldots" aria-hidden="true">{marks.slice(0,4).map(x=><i key={x.id} className={'k-'+x.kind+(x.state==='missed'?' missed':'')}/>)}</span></button>})}</div>
    {!d?<Skeleton rows={2}/>:day?<><h3 className="sec">{ofYmd(day).toLocaleDateString(getLang(),{weekday:'long',day:'numeric',month:'long'})}</h3>
      {onDay(day).length?onDay(day).map(x=><CalItem key={x.id} x={x} onEdit={open}/>):<p className="known">{tl("Nothing on this day.")}</p>}</>
    :<><h3 className="sec">{tl("Coming up")}</h3>{upcoming.length?upcoming.map(x=><CalItem key={x.id} x={x} onEdit={open}/>):<p className="known">{tl("Nothing coming up this month.")}</p>}</>}
    <h3 className="sec">{tl("On your phone's calendar")}</h3>
    <p className="known">{tl("A private link your phone's calendar (Google, Apple or Outlook) can subscribe to. It keeps itself up to date. Anyone with the link can see these dates, so keep it to yourself.")}</p>
    {link?.url?<><input readOnly value={link.url} onFocus={e=>e.target.select()} aria-label={tl("Calendar link")}/><button className="btn" onClick={copy}><Copy size={16}/>{" "}{tl("Copy link")}</button>
      <p className="known">{tl("In Google Calendar: Other calendars, +, From URL. On an iPhone: Settings, Calendar, Accounts, Add Account, Other, Add Subscribed Calendar.")}</p></>
    :link?.on?<p className="known">{tl("Your link is on. To see it again, make a new one (the old one then stops).")}</p>:null}
    <button className={link?.on?'btn ghost':'btn'} onClick={makeLink}>{link?.on?tl("Make a new link"):tl("Get my calendar link")}</button>
    {link?.on&&<button className="btn ghost" onClick={stopLink}>{tl("Turn the link off")}</button>}
    {f&&<Sheet close={()=>setForm(null)}><h3>{f.id?tl("Edit event"):tl("Add an event")}</h3>
      <label htmlFor="et">{tl("Title")}</label><input id="et" maxLength={200} value={f.title} onChange={set('title')}/>
      <label htmlFor="ek">{tl("Kind")}</label><select id="ek" value={f.kind} onChange={set('kind')}>{EV_KINDS.map(([k,l])=><option key={k} value={k}>{tl(l)}</option>)}</select>
      <label htmlFor="ed">{tl("Date")}</label><input id="ed" type="date" value={f.day} onChange={set('day')}/>
      <label htmlFor="ee">{tl("Ends on (optional)")}</label><input id="ee" type="date" min={f.day} value={f.end_day} onChange={set('end_day')}/>
      {!f.end_day&&<><label htmlFor="ea">{tl("Time (optional)")}</label><input id="ea" type="time" value={f.at} onChange={set('at')}/></>}
      {opts?.scopes?.length>1&&<><label htmlFor="es">{tl("Who it is for")}</label><select id="es" value={sc} onChange={set('scope')}>{opts.scopes.map(k=><option key={k} value={k}>{tl({all:"Everyone",program:"A program",semester:"A program's semester or year",course:"A course",user:"Just me"}[k])}</option>)}</select></>}
      {(sc==='program'||sc==='semester')&&<><label htmlFor="ep">{tl("Program")}</label><select id="ep" value={f.program_id} onChange={set('program_id')}><option value="">{tl("Choose")}</option>{progs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
      {sc==='semester'&&<><label htmlFor="en">{p?tl(p.term):tl("Semester")}</label><input id="en" type="number" min={1} max={20} value={f.semester} onChange={set('semester')}/></>}
      {sc==='course'&&<><label htmlFor="ec">{tl("Course")}</label><select id="ec" value={f.course_id} onChange={set('course_id')}><option value="">{tl("Choose")}</option>{(opts?.courses||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
      {sc==='user'&&opts?.students?.length>0&&<><label htmlFor="eu">{tl("For")}</label><select id="eu" value={f.user_id} onChange={set('user_id')}><option value="">{tl("Me")}</option>{opts.students.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></>}
      <label htmlFor="eo">{tl("Notes (optional)")}</label><textarea id="eo" rows={3} maxLength={1000} value={f.notes} onChange={set('notes')}/>
      <button className="btn" disabled={!f.title.trim()||!f.day} onClick={save}>{f.id?tl("Save"):tl("Add event")}</button>
      {f.id&&<button className="btn ghost danger" onClick={del}><Trash2 size={16}/>{" "}{tl("Delete event")}</button>}
      <button className="btn ghost" onClick={()=>setForm(null)}>{tl("Cancel")}</button></Sheet>}
  </div></>}
export const ANN_STATE={live:['Starting now','var(--ok)'],upcoming:['Coming up','var(--acct)'],ended:['Ended','var(--mut)'],cancelled:['Cancelled','var(--bad)']}
export function AnnCard({x,onCancel,onMoved,toast}){
  const [l,c]=ANN_STATE[x.status]||[],[who,setWho]=useState(false),[mv,setMv]=useState(false)
  return <div className={'qbox ann'+(x.kind==='class'?' cls':'')}><div className="wtop" style={{display:'flex',justifyContent:'space-between',gap:8}}><small className="steplab">{x.kind==='class'?tl("Class"):tl("Announcement")}{' · '}{x.course}</small>{l&&<span className="chip" style={{color:c,margin:0}}>{tl(l)}</span>}</div>
    <b style={{display:'block',margin:'4px 0'}}>{x.title}</b>{x.kind==='class'&&<p className="known" style={{margin:'0 0 6px'}}>{classWhen(x)}{x.week&&<>{' · '}{tl("Weekly, session {n} of {of}",{n:x.week.n,of:x.week.of})}</>}</p>}
    {x.body&&<div className="prose flat"><Md>{x.body}</Md></div>}<small className="known">{x.by}{x.by?' · ':''}{when(x.at)}</small>
    <div className="tools" style={{marginTop:8}}>{x.link&&x.status!=='ended'&&<a className={'btn'+(x.status==='live'?'':' ghost')} href={x.link} target="_blank" rel="noreferrer" style={{width:'auto'}} onClick={()=>joinClass(x.id)}><Play size={16}/>{" "}{tl("Join the class")}</a>}
      {x.can_edit&&x.status!=='cancelled'&&x.status!=='ended'&&<button className="btn ghost" style={{width:'auto'}} onClick={()=>onCancel(x)}>{x.kind==='class'?tl("Cancel the class"):tl("Withdraw")}</button>}
      {x.can_edit&&x.kind==='class'&&x.status==='upcoming'&&onMoved&&<button className="btn ghost" style={{width:'auto'}} onClick={()=>setMv(true)}>{tl("Change the time")}</button>}</div>
    {mv&&<MoveClass x={x} toast={toast} close={()=>setMv(false)} done={()=>{setMv(false);onMoved()}}/>}
    {x.joins&&x.status!=='upcoming'&&<div style={{marginTop:6}}><button className="link" onClick={()=>setWho(!who)}>{tl("Tapped Join: {n} of {of}",{n:x.joins.length,of:x.class_size})}</button>
      {who&&<p className="known" style={{margin:'4px 0 0'}}>{x.joins.length?x.joins.map(j=>j.name).join(', '):tl("Nobody yet.")}{" "}{tl("Zigora counts who tapped Join; it can't see who stayed in the call.")}</p>}</div>}</div>}
export function ClassesPage({toast}){
  const confirm=useConfirm(),[d,setD]=useState(null),[form,setForm]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>api('/announcements').then(setD).catch(e=>toast(e.message));useEffect(()=>{load()},[])
  const blank=()=>({kind:'class',course_id:d?.courses[0]?.id||'',title:'',body:'',day:ymd(new Date()),at:'18:00',minutes:60,link:'',repeat:false,weeks:8})
  const save=async()=>{setBusy(true);try{await api('/announcements',{method:'POST',body:{...form,course_id:Number(form.course_id),minutes:Number(form.minutes),weeks:form.kind==='class'&&form.repeat?Number(form.weeks):1}});toast(form.kind==='class'?tl("Class scheduled. Students and parents are told."):tl("Posted. Students and parents are told."));setForm(null);load()}catch(e){toast(srv(e.message))}setBusy(false)}
  const [series,setSeries]=useState(null)
  const stop=async(x,all)=>{setSeries(null);try{await api(`/announcements/${x.id}/cancel${all?'?all=true':''}`,{method:'POST'});load()}catch(e){toast(srv(e.message))}}
  const cancel=async x=>{if(x.week&&x.week.more>0)return setSeries(x)  // a weekly class: this session, or this and the rest
    if(!await confirm({title:x.kind==='class'?tl("Cancel this class?"):tl("Withdraw this announcement?"),body:x.kind==='class'?tl("It comes out of everyone's calendar, and students and parents are told."):'',ok:x.kind==='class'?tl("Cancel the class"):tl("Withdraw"),danger:true}))return
    stop(x,false)}
  const f=form,set=(k,v)=>setForm({...f,[k]:v})
  return <><Bar title={tl("Classes and announcements")} sub={d?tl(d.upcoming.length===1?"1 class coming up":"{n} classes coming up",{n:d.upcoming.length}):''}/><div className="main">
    {d?.can_post&&!f&&<button className="btn" onClick={()=>setForm(blank())}><Plus size={16}/>{" "}{tl("Schedule a class or post an announcement")}</button>}
    {f&&<div className="qbox"><div className="seg" style={{gridTemplateColumns:'1fr 1fr'}}>{[['class',tl("A class")],['note',tl("An announcement")]].map(([k,l])=><button key={k} className={f.kind===k?'on':''} aria-pressed={f.kind===k} onClick={()=>set('kind',k)}>{l}</button>)}</div>
      <label htmlFor="anc">{tl("Course")}</label><select id="anc" value={f.course_id} onChange={e=>set('course_id',e.target.value)}>{d.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label htmlFor="ant">{tl("Title")}</label><input id="ant" value={f.title} maxLength={200} onChange={e=>set('title',e.target.value)} placeholder={f.kind==='class'?tl("Revision: water technology"):tl("Unit test on Friday")}/>
      {f.kind==='class'&&<><div className="two"><div><label htmlFor="and">{tl("Date")}</label><input id="and" type="date" value={f.day} onChange={e=>set('day',e.target.value)}/></div>
        <div><label htmlFor="ana">{tl("Time")}</label><input id="ana" type="time" value={f.at} onChange={e=>set('at',e.target.value)}/></div></div>
        <label htmlFor="anm">{tl("Length (minutes)")}</label><input id="anm" type="number" min={10} max={600} value={f.minutes} onChange={e=>set('minutes',e.target.value)} style={{maxWidth:140}}/>
        <label className="chk"><input type="checkbox" checked={f.repeat} onChange={e=>set('repeat',e.target.checked)}/>{" "}{tl("Repeat every week")}</label>
        {f.repeat&&<><label htmlFor="anw">{tl("How many weeks")}</label><input id="anw" type="number" min={2} max={26} value={f.weeks} onChange={e=>set('weeks',e.target.value)} style={{maxWidth:140}}/>
          <p className="known">{tl("Every session goes into the calendar. Students are told once, for the whole series.")}</p></>}
        <label htmlFor="anl">{tl("Video link")}</label><input id="anl" value={f.link} onChange={e=>set('link',e.target.value)} placeholder="https://meet.google.com/…" spellCheck={false}/>
        <p className="known">{tl("Make a Google Meet (or Zoom) link, then paste it here. Students join from Zigora when the class starts.")}{" "}<a href="https://meet.google.com/new" target="_blank" rel="noreferrer">{tl("Make a Google Meet link")}</a></p></>}
      <label htmlFor="anb">{f.kind==='class'?tl("What to bring or prepare (optional)"):tl("Message")}</label><textarea id="anb" rows={4} maxLength={4000} value={f.body} onChange={e=>set('body',e.target.value)}/>
      <button className="btn" disabled={busy||f.title.trim().length<3||(f.kind==='class'&&!f.link.trim())} onClick={save}>{f.kind==='class'?tl("Schedule the class"):tl("Post")}</button><button className="btn ghost" onClick={()=>setForm(null)}>{tl("Cancel")}</button></div>}
    {series&&<Sheet close={()=>setSeries(null)}><h3>{tl("Cancel the weekly class?")}</h3><p className="known">{tl("It comes out of everyone's calendar, and students and parents are told.")}</p>
      <button className="btn danger" onClick={()=>stop(series,false)}>{tl("Only this session")}</button><button className="btn danger" onClick={()=>stop(series,true)}>{tl("This and every later session ({n})",{n:series.week.more+1})}</button>
      <button className="btn ghost" onClick={()=>setSeries(null)}>{tl("Keep it")}</button></Sheet>}
    {!d?<Skeleton/>:<>{d.upcoming.length>0&&<><h3 className="sec">{tl("Coming up")}</h3>{d.upcoming.map(x=><AnnCard key={x.id} x={x} onCancel={cancel} onMoved={load} toast={toast}/>)}</>}
      <h3 className="sec">{tl("Recent")}</h3>{d.items.filter(x=>!d.upcoming.some(y=>y.id===x.id)).length?d.items.filter(x=>!d.upcoming.some(y=>y.id===x.id)).map(x=><AnnCard key={x.id} x={x} onCancel={cancel} onMoved={load} toast={toast}/>):<p className="known">{tl("Nothing posted yet.")}</p>}</>}</div></>}
// ---- moving a class: a new date, time, length or link; students and parents are told
export function MoveClass({x,close,done,toast}){
  const s0=new Date(x.starts_at),[f,setF]=useState({day:ymd(s0),at:s0.toTimeString().slice(0,5),minutes:x.minutes||60,link:x.link||''}),[busy,setBusy]=useState(false)
  const save=async()=>{setBusy(true);try{await api(`/announcements/${x.id}`,{method:'PUT',body:{...f,minutes:Number(f.minutes)}});toast(tl("Moved. Students and parents are told."));done()}catch(e){toast(srv(e.message))}setBusy(false)}
  return <Sheet close={close}><h3>{tl("Change the class time")}</h3><p className="known">{x.title}</p>
    <div className="two"><div><label htmlFor="mvd">{tl("Date")}</label><input id="mvd" type="date" value={f.day} onChange={e=>setF({...f,day:e.target.value})}/></div><div><label htmlFor="mva">{tl("Time")}</label><input id="mva" type="time" value={f.at} onChange={e=>setF({...f,at:e.target.value})}/></div></div>
    <label htmlFor="mvm">{tl("Length (minutes)")}</label><input id="mvm" type="number" min={10} max={600} value={f.minutes} onChange={e=>setF({...f,minutes:e.target.value})} style={{maxWidth:140}}/>
    <label htmlFor="mvl">{tl("Video link")}</label><input id="mvl" value={f.link} onChange={e=>setF({...f,link:e.target.value})}/>
    <button className="btn" disabled={busy} onClick={save}>{tl("Move the class")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export function RoutinePage({toast,done}){
  const confirm=useConfirm()
  const [v,setV]=useState(null),[f,setF]=useState({days:'1111110',minutes:30,at:''}),[busy,setBusy]=useState(false)
  useEffect(()=>{api('/me/session').then(x=>{setV(x);if(x.routine)setF({days:x.routine.days,minutes:x.routine.minutes,at:x.routine.at||''})}).catch(e=>toast(e.message))},[])
  const flip=k=>setF({...f,days:f.days.slice(0,k)+(f.days[k]==='1'?'0':'1')+f.days.slice(k+1)})
  const save=async()=>{setBusy(true);try{setV(await api('/me/routine',{method:'PUT',body:{...f,at:f.at||null}}));toast(tl("Routine saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  const stop=async()=>{if(!await confirm({title:tl("Stop your routine?"),body:tl("Your progress stays. Home goes back to showing what to do next."),ok:tl("Stop the routine")}))return;try{await api('/me/routine/stop',{method:'POST'});toast(tl("Routine stopped"));done()}catch(e){toast(e.message)}}
  const per={15:1,30:1,45:2,60:3}[f.minutes]
  return <><Bar title={tl("My routine")} sub={tl("Study at your own pace, a little every day")}/><div className="main">
    <p className="known" style={{marginTop:0}}>{tl("Pick the days you study and how long. Each study day you get one session: {v} and any reviews that are due. Miss a day and nothing piles up: the next session is the same size.",{v:per===1?tl('one new topic'):tl('{n} new topics',{n:per})})}</p>
    <label>{tl("Study days")}</label><div className="chips wrap" role="group" aria-label={tl("Study days")}>{WD.map((d,k)=><button key={d} className={'sbtn'+(f.days[k]==='1'?' on':'')} aria-pressed={f.days[k]==='1'} onClick={()=>flip(k)}><span className="lbl">{wd(d)}</span></button>)}</div>
    <label htmlFor="mins">{tl("Minutes a session")}</label><select id="mins" value={f.minutes} onChange={e=>setF({...f,minutes:+e.target.value})}>{[15,30,45,60].map(m=><option key={m} value={m}>{m}{" "}{tl("minutes")}</option>)}</select>
    <label htmlFor="at">{tl("Usual time (optional)")}</label><input id="at" type="time" value={f.at} onChange={e=>setF({...f,at:e.target.value})}/>
    {v?.plan&&<p className="known">{v.plan.left?tl("With your current routine you would finish the {left} topics left by {v}.",{left:v.plan.left,v:new Date(v.plan.finish+'T00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}):tl("Nothing is left to study right now.")}{v.plan.late>0?tl(" {late} topics would miss their deadline. {v}",{late:v.plan.late,v:v.plan.advice||''}):''}</p>}
    <button className="btn" disabled={busy||!f.days.includes('1')} onClick={save}>{tl("Save routine")}</button>
    {v?.routine&&<button className="btn ghost" onClick={stop}>{tl("Stop the routine")}</button>}</div></>}
