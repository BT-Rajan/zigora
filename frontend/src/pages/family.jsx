// family pages, loaded only when one of them is opened (split from App.jsx; the shell and shared helpers stay there)
import {useState,useEffect,useContext} from 'react'
import {CalendarDays,GraduationCap,X,ChevronRight,Megaphone} from 'lucide-react'
import {t as tl,srv,getLang} from '../i18n.js'
import {Bar,Bar2,Ctx,KID,Place,Sheet,Skeleton,api,classWhen,day,firstName,useConfirm,when,ymd} from '../App.jsx'
// one child or student at a glance, as their parent or teacher sees it on Home: streak, this week's study days, topics learned this week, last studied
export function WardCard({c,open}){
  const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toLocaleDateString(getLang(),{weekday:'narrow'})})
  return <button className="card ward" onClick={open} aria-label={tl("See {name}'s progress",{name:c.name})}>
    <span className="wtop"><b>{c.name}</b><span className="chip">{tl("{n}-day streak",{n:c.streak})}</span></span>
    {c.place&&<small className="known">{c.place}</small>}
    <span className="wweek" aria-label={tl("Studied on {n} of the last 7 days",{n:c.active_days_week})}>{c.week.map((on,i)=><span key={i} className={on?'on':''} aria-hidden="true">{days[i]}</span>)}</span>
    <small className="known">{tl("Topics learned this week: {n}",{n:c.completed_this_week})} · {c.last_studied?tl("last studied {when}",{when:day(c.last_studied)}):tl("not started yet")}</small></button>}
// a school teacher's Home: what needs them, most urgent first, each a tap from the page that deals with it
export function TeacherAttention({onGo}){
  const [d,setD]=useState(null)
  useEffect(()=>{Promise.allSettled([api('/offered'),api('/questions?status=waiting&limit=1'),api('/announcements?limit=30'),api('/reports/struggles?days=7')]).then(([o,q,a,st])=>{
    const today=ymd(new Date()),offers=o.value?.items||[]
    setD({applied:offers.reduce((n,c)=>n+(c.counts.applied||0),0),invited:offers.reduce((n,c)=>n+(c.counts.invited||0),0),questions:q.value?.total||0,
          today:(a.value?.upcoming||[]).filter(x=>x.starts_at&&ymd(new Date(x.starts_at))===today),stuck:(st.value?.items||[]).length,running:offers.filter(c=>c.state==='running').length})})},[])
  if(!d)return <Skeleton rows={1}/>
  const items=[d.applied&&[tl(d.applied===1?"1 student asks to join your courses":"{n} students ask to join your courses",{n:d.applied}),tl("Decide within 48 hours"),'offered'],
    d.questions&&[tl(d.questions===1?"1 question waits for your answer":"{n} questions wait for your answer",{n:d.questions}),'','questions'],
    ...d.today.map(x=>[tl("Class today: {title}",{title:x.title}),classWhen(x),'classes']),
    d.stuck&&[tl(d.stuck===1?"Students got stuck on 1 topic this week":"Students got stuck on {n} topics this week",{n:d.stuck}),tl("Offer help"),'struggles']].filter(Boolean)
  return <><h3 className="sec first">{tl("Needs your attention")}</h3>
    {items.length?items.map(([t,sub,go],i)=><button key={i} className="card" style={{textAlign:'start',width:'100%'}} onClick={()=>onGo(go)}><div style={{flex:1}}><b>{t}</b>{sub&&<span className="known" style={{display:'block'}}>{sub}</span>}</div><ChevronRight size={18}/></button>)
      :<p className="known">{tl("Nothing needs you right now.")}{d.invited?' '+tl(d.invited===1?"1 invitation is waiting for a student's answer.":"{n} invitations are waiting for students' answers.",{n:d.invited}):''}</p>}
    <div className="two" style={{marginBottom:24}}><button className="btn ghost" onClick={()=>onGo('offered')}><GraduationCap size={16}/>{" "}{tl("Offered courses")}{d.running?` (${d.running})`:''}</button><button className="btn ghost" onClick={()=>onGo('classes')}><Megaphone size={16}/>{" "}{tl("Classes")}</button></div></>}
export function GuardianHome({user,toast,onKey,onCalendar,onGo}){  // a parent's children, or a teacher's students: add them, invite them (teachers), see their progress, and the AI key that covers them
  const confirm=useConfirm()
  const [d,setD]=useState(null),[k,setK]=useState(null),[opts,setOpts]=useState({school:[],college:[]}),[add,setAdd]=useState(null),[inv,setInv]=useState(''),[sent,setSent]=useState(''),[see,setSee]=useState(null),[b,setB]=useState(false)
  const [dash,setDash]=useState(null)
  const load=()=>{api('/guardian/students').then(setD).catch(e=>toast(e.message));api('/guardian/dashboard').then(setDash).catch(()=>{})}
  useEffect(()=>{load();api('/me/ai-key').then(setK).catch(()=>{});api('/guardian/options').then(setOpts).catch(()=>{})},[])
  if(see)return <StudentProgress id={see} back={()=>{setSee(null);load()}} toast={toast}/>  // a name, grade or removal may have changed
  const parent=user.relation==='parent',level=user.level||'school',num=v=>v===''?null:+v,setRow=(i,o)=>setAdd(add.map((x,j)=>j===i?{...x,...o}:x))
  const ok=add&&add.every(x=>x.name.trim()&&x.username.trim()&&x.password&&(!x.program_id||x.semester))
  const save=async()=>{setB(true);try{setD(await api('/guardian/students',{method:'POST',body:{students:add.map(x=>({...x,program_id:num(x.program_id),semester:num(x.semester)}))}}));setAdd(null);load();toast(parent?tl("Added. They can sign in now."):tl("Students added. They can sign in now."))}catch(e){toast(e.message)}setB(false)}
  const invite=async()=>{setB(true);try{setSent(srv((await api('/guardian/invite',{method:'POST',body:{login:inv}})).message));setInv('');load()}catch(e){toast(e.message)}setB(false)}
  const drop=async x=>{if(!await confirm({title:tl("Stop following {name}?",{name:x.name}),body:tl("Their account and progress stay. You no longer see their progress, and your AI key no longer covers them."),ok:tl("Stop following"),danger:true}))return
    try{await api('/guardian/students/'+x.id,{method:'DELETE'});load()}catch(e){toast(e.message)}}
  return <><Bar title={tl("Hello, {name}",{name:firstName(user.name)})}/><div className="main">
    {user.relation==='teacher'&&onGo&&<TeacherAttention onGo={onGo}/>}
    {dash?.items.length>0&&<><h3 className="sec first">{tl("Needs you")}</h3>
      {dash.items.map((x,i)=><div key={x.key+i} className={'card dash '+x.level}><span className="dot" aria-hidden="true"/><div style={{flex:1}}><b>{tl(x.text,{...x.vars,...(x.vars.date?{date:day(x.vars.date)}:{})})}</b></div>
        <button className="btn ghost" onClick={()=>x.action==='key'?onKey():setSee(x.student_id)}>{x.action==='key'?tl("Add an AI key"):tl("See progress")}</button></div>)}</>}
    {dash&&!dash.items.length&&dash.students.length>0&&<div className="qbox" role="status" style={{marginTop:0}}><b>{parent?tl("All good. Nothing needs you right now."):tl("All good. No student needs you right now.")}</b></div>}
    <h3 className={'sec'+(dash?.items.length?'':' first')}>{parent?tl("Your children"):tl("Your students")}</h3>
    {!d&&<Skeleton rows={2}/>}
    {dash?.students.map(c=><WardCard key={c.id} c={c} open={()=>setSee(c.id)}/>)}
    {d&&!d.students.length&&<p className="known">{parent?tl("No children are linked to your account yet."):tl("No students yet. Add your class, or invite students who already have an account.")}</p>}
    {d?.students.filter(x=>x.status!=='active'||!dash).map(x=><div className="card" key={x.id}><button className="hit" disabled={x.status!=='active'} onClick={()=>setSee(x.id)} aria-label={x.status==='active'?tl("See {name}'s progress",{name:x.name}):x.name}>
      <div style={{flex:1}}><b>{x.name}{x.status==='invited'&&<span className="pill sm">{tl("Invited")}</span>}</b><span>{x.username?tl("Signs in as {username}",{username:x.username})+' · ':''}{x.place||tl("Waiting for an admin to place them")}</span></div>{x.status==='active'&&<ChevronRight size={18}/>}</button>
      {!parent&&<button className="ic sm" aria-label={tl("Stop following {name}?",{name:x.name})} onClick={()=>drop(x)}><X size={16}/></button>}</div>)}
    {d?.students.some(x=>x.status==='active')&&<button className="btn ghost" onClick={onCalendar}><CalendarDays size={16}/>{" "}{parent?tl("Your children's calendar"):tl("Your students' calendar")}</button>}
    {parent&&d?.students.length>0&&<p className="known">{tl("Each child signs in with their own username and password on the sign-in page.")}</p>}
    <button className="btn ghost" onClick={()=>setAdd([{...KID}])}>{parent?tl("Add a child"):tl("Add students")}</button>
    {!parent&&<><h3 className="sec">{tl("Invite a student")}</h3><p className="known" style={{marginTop:0}}>{tl("For a student who already has an account. They see your invitation and choose whether to accept.")}</p>
      <label htmlFor="ginv">{tl("Their email or username")}</label><input id="ginv" autoCapitalize="none" value={inv} onChange={e=>setInv(e.target.value)} onKeyDown={e=>e.key==='Enter'&&inv.trim()&&invite()}/>
      <button className="btn" disabled={b||!inv.trim()} onClick={invite}>{tl("Send invitation")}</button>{sent&&<p className="known" role="status">{sent}</p>}</>}
    {k&&level==='school'&&<><h3 className="sec">{tl("AI help")}</h3><div className="qbox" style={{marginTop:0}}>
      <b>{k.key_set?tl("On, with your key {hint}",{hint:k.key_hint}):tl("Off")}</b>
      <p className="known" style={{margin:'6px 0 0'}}>{k.key_set?(parent?tl("Your children's AI help runs on your AI key."):tl("Your students' AI help runs on your AI key, unless a parent has added theirs.")):(parent?tl("School students use AI only with a parent's or teacher's key. Add your AI key to turn it on for your children."):tl("School students use AI only with a parent's or teacher's key. Add your AI key to turn it on for your students."))}</p>
      <button className="btn ghost" onClick={onKey}>{k.key_set?tl("Change the key"):tl("Add an AI key")}</button></div></>}
    {add&&<Sheet close={()=>setAdd(null)}><h3>{parent?tl("Add a child"):tl("Add students")}</h3><p className="known" style={{marginTop:0}}>{tl("Each one signs in with the username and password you give them. They don't need an email.")}</p>
      {add.map((x,i)=><div className="qbox" key={i}><b>{(parent?tl("Child {n}",{n:i+1}):tl("Student {n}",{n:i+1}))}</b>
        <label htmlFor={'an'+i}>{tl("Name")}</label><input id={'an'+i} value={x.name} onChange={e=>setRow(i,{name:e.target.value})}/>
        <label htmlFor={'au'+i}>{tl("Username")}</label><input id={'au'+i} autoCapitalize="none" autoComplete="off" value={x.username} onChange={e=>setRow(i,{username:e.target.value.toLowerCase().replace(/\s/g,'')})}/>
        <label htmlFor={'aw'+i}>{tl("Password")}</label><input id={'aw'+i} type="password" autoComplete="new-password" value={x.password} onChange={e=>setRow(i,{password:e.target.value})}/>
        <Place id={'a'+i} opts={opts} level={level} v={x} set={o=>setRow(i,o)}/>
        {add.length>1&&<button className="tool" onClick={()=>setAdd(add.filter((_,j)=>j!==i))}>{tl("Remove")}</button>}</div>)}
      {!parent&&<button className="btn ghost" onClick={()=>setAdd([...add,{...KID,program_id:add[add.length-1].program_id,semester:add[add.length-1].semester}])}>{tl("Add another student")}</button>}
      <button className="btn" disabled={b||!ok} onClick={save}>{tl("Save")}</button><button className="btn ghost" onClick={()=>setAdd(null)}>{tl("Cancel")}</button></Sheet>}</div></>}
export function StudentProgress({id,back,toast}){  // what a parent or teacher sees: per course, topics learned and opened, tests, last studied. Never their notes
  const confirm=useConfirm()
  const [d,setD]=useState(null),[pw,setPw]=useState(''),[b,setB]=useState(false),[ed,setEd]=useState(null),[opts,setOpts]=useState({school:[],college:[]}),{level}=useContext(Ctx)
  const load=()=>api(`/guardian/students/${id}/progress`).then(setD).catch(e=>{toast(e.message);back()});useEffect(()=>{load()},[id])
  const edit=()=>{api('/guardian/options').then(setOpts).catch(()=>{});setEd({name:d.name,program_id:d.program_id??'',semester:d.semester??''})}
  const saveEd=async()=>{setB(true);try{await api(`/guardian/students/${id}`,{method:'PATCH',body:{name:ed.name,program_id:ed.program_id===''?null:+ed.program_id,semester:ed.semester===''?null:+ed.semester}});setEd(null);toast(tl("Changes saved"));load()}catch(e){toast(e.message)}setB(false)}
  const drop=async()=>{if(!await confirm({title:tl("Remove {name}?",{name:d.name}),body:d.can_reset?tl("Their progress stays. If no other parent or teacher looks after them, their account is switched off, since they have no email of their own. An admin can switch it back on."):tl("Their account and progress stay. You no longer see their progress, and your AI key no longer covers them."),ok:tl("Remove"),danger:true}))return
    try{await api('/guardian/students/'+id,{method:'DELETE'});toast(tl("Removed"));back()}catch(e){toast(e.message)}}
  const setPass=async()=>{setB(true);try{await api(`/guardian/students/${id}/password`,{method:'PUT',body:{password:pw}});setPw('');toast(tl("Password changed. Tell them the new one."))}catch(e){toast(e.message)}setB(false)}
  return <><Bar title={d?d.name:tl("Loading")} sub={d?.place} back={back}/><div className="main">
    {!d&&<Skeleton rows={2}/>}{d&&!d.courses.length&&<p className="known">{tl("No courses yet. They appear once an admin places them in a program.")}</p>}
    {d?.courses.map(c=><div className="row" key={c.course}><div style={{flex:1}}>{c.course}<small>{tl("{done} of {n} topics learned · {opened} opened",{done:c.completed,n:c.topics,opened:c.opened})}{c.tests?' · '+tl("tests {taken} of {n}",{taken:c.tests_taken,n:c.tests})+(c.test_average!=null?', '+tl("average {p}%",{p:c.test_average}):''):''}{' · '+(c.last_active?tl("last studied {when}",{when:day(c.last_active)}):tl("not started yet"))}</small><Bar2 v={c.topics?100*c.completed/c.topics:0}/></div></div>)}
    {d?.activity&&<WardActivity a={d.activity}/>}{d?.scores&&<WardScores sc={d.scores} mcq={d.mcq}/>}
    {d&&<p className="known">{tl("You see progress only, never their own notes or highlights.")}</p>}
    {d?.can_reset&&<><h3 className="sec">{tl("Forgot their password?")}</h3><p className="known" style={{marginTop:0}}>{tl("They sign in with a username, so there is no email to reset it from. Set a new one here and tell them.")}</p>
      <label htmlFor="spw">{tl("New password")}</label><input id="spw" type="password" autoComplete="new-password" value={pw} onChange={e=>setPw(e.target.value)}/>
      <button className="btn ghost" disabled={b||pw.length<8} onClick={setPass}>{tl("Set a new password")}</button></>}
    {d?.can_reset&&!ed&&<button className="btn ghost" onClick={edit}>{tl("Change their name or grade")}</button>}
    {ed&&<div className="qbox"><label htmlFor="sen">{tl("Name")}</label><input id="sen" value={ed.name} onChange={e=>setEd({...ed,name:e.target.value})}/>
      <Place id="se" opts={opts} level={level||'school'} v={ed} set={o=>setEd({...ed,...o})}/>
      <div className="two"><button className="btn" disabled={b||!ed.name.trim()||(ed.program_id!==''&&ed.semester==='')} onClick={saveEd}>{tl("Save")}</button><button className="btn ghost" onClick={()=>setEd(null)}>{tl("Cancel")}</button></div></div>}
    {d&&<button className="btn ghost" style={{color:'var(--bad)'}} onClick={drop}>{tl("Remove {name} from my list",{name:d.name})}</button>}</div></>}
// a student's study days over the last four weeks, their streak and the routine they set, as their parent or teacher sees it
export function WardActivity({a}){
  const dt0=d=>new Date(d+'T00:00:00'),num=d=>dt0(d).toLocaleDateString(getLang(),{day:'numeric'}),full=d=>dt0(d).toLocaleDateString(getLang(),{weekday:'long',day:'numeric',month:'long'}),mon=new Date(2024,0,1)  // 1 Jan 2024 was a Monday
  const plan=a.routine?[...a.routine.days].map((c,i)=>c==='1'?new Date(mon.getTime()+i*864e5).toLocaleDateString(getLang(),{weekday:'short'}):null).filter(Boolean).join(', '):''
  return <><h3 className="sec">{tl("Study activity")}</h3>
    <p className="known" style={{marginTop:0}}>{tl("{streak}-day streak · studied on {week} of the last 7 days and {days} of the last 28 · {done} topics learned this week",{streak:a.streak,week:a.active_days_week,days:a.active_days_28,done:a.completed_this_week})}</p>
    {[0,1,2,3].map(w=><div key={w} className="week" aria-label={tl("Week {n}",{n:w+1})}>{a.days.slice(w*7,w*7+7).map(x=><span key={x.date} className={(x.active?'on':'')+(x===a.days[27]?' today':'')} title={full(x.date)} aria-label={full(x.date)+(x.active?' · '+tl("Studied"):'')}>{num(x.date)}</span>)}</div>)}
    <p className="known">{a.routine?tl("Their routine: {days}, {minutes} minutes{at}",{days:plan,minutes:a.routine.minutes,at:a.routine.at?' '+tl("at {time}",{time:a.routine.at}):''}):tl("They have not set a study routine yet.")}</p></>}
// their quiz and test scores per course, the topics they are strong in and the ones to study again, and their MCQ practice
export function WardScores({sc,mcq}){
  const list=(L,title)=>L.length>0&&<><b style={{display:'block',marginTop:10}}>{title}</b>{L.map(x=><div key={x.course+x.title} className="row"><div>{x.title}<small>{x.course}</small></div><span className="chip">{x.percent}%</span></div>)}</>
  return <><h3 className="sec">{tl("Scores")}</h3>
    {!sc.quizzes_taken?<p className="known" style={{marginTop:0}}>{tl("No quizzes or tests taken yet.")}</p>:<>
      {sc.courses.map(c=><div key={c.course} className="row"><div>{c.course}<small>{tl("Correct answers in quizzes and tests")}</small></div><span className="chip">{c.percent}%</span></div>)}
      {list(sc.needs_study,tl("Needs more study"))}{list(sc.getting_there,tl("Getting there"))}{list(sc.strong,tl("Strong"))}</>}
    {mcq&&<><h3 className="sec">{tl("MCQ practice")}</h3><p className="known" style={{marginTop:0}}>{mcq.sets?tl("{sets} sets done, {average}% correct on average. Last practised {when}.",{sets:mcq.sets,average:mcq.average,when:when(mcq.last_at)}):tl("No MCQ practice yet.")}</p>
      {mcq.revisit.length>0&&<p className="known">{tl("Topics to revisit: {topics}",{topics:mcq.revisit.join(', ')})}</p>}</>}</>}
