import {useState,useEffect,useCallback,useRef,createContext,useContext,Children,Fragment,isValidElement,cloneElement,memo,lazy,Suspense} from 'react'
import {createPortal} from 'react-dom'
import {Md,Body} from './content.jsx'
import {ROOT,at} from './base.js'
import {ExternalLink,ClipboardCheck,CalendarDays,Plus,Users as UsersIcon,GraduationCap,Sparkles,BarChart3,Info,LogOut,Menu,X,ArrowUp,ArrowDown,Search,ChevronLeft,ChevronRight,Sun,Moon,Upload,Copy,Check,Pencil,Trash2,Bookmark,Link2,Eye,EyeOff,History,TrendingUp,Clock,AlertTriangle,Play,Target,RotateCcw,ClipboardList,Archive,ArchiveRestore,Lock,FileText,Bell,BookOpen,Highlighter,Maximize2,Minimize2,Globe,Printer,Flag,Camera,ImagePlus,ListChecks,Shapes,MessageCircle,CreditCard,Megaphone} from 'lucide-react'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/800.css'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import '@fontsource/noto-sans-arabic/400.css'
import '@fontsource/noto-sans-arabic/600.css'
import '@fontsource/noto-sans-tamil/400.css'
import '@fontsource/noto-sans-tamil/600.css'
import './styles.css'
import './highlighter.js'
import {t as tl,L,LANGS,locale,applyLang,firstLang,loadLang,srv,getLang} from './i18n.js'
// pages in their own files, loaded when first opened (see src/pages/)
const Users=lazy(()=>import('./pages/admin.jsx').then(m=>({default:m.Users})))
const AdminCourses=lazy(()=>import('./pages/admin.jsx').then(m=>({default:m.AdminCourses})))
const Programs=lazy(()=>import('./pages/admin.jsx').then(m=>({default:m.Programs})))
const AiConfig=lazy(()=>import('./pages/admin.jsx').then(m=>({default:m.AiConfig})))
const Activity=lazy(()=>import('./pages/admin.jsx').then(m=>({default:m.Activity})))
const StaffHome=lazy(()=>import('./pages/teach.jsx').then(m=>({default:m.StaffHome})))
const TeacherQuestions=lazy(()=>import('./pages/teach.jsx').then(m=>({default:m.TeacherQuestions})))
const StrugglesPage=lazy(()=>import('./pages/teach.jsx').then(m=>({default:m.StrugglesPage})))
const OfferedPage=lazy(()=>import('./pages/teach.jsx').then(m=>({default:m.OfferedPage})))
const AssignPage=lazy(()=>import('./pages/teach.jsx').then(m=>({default:m.AssignPage})))
const McqBank=lazy(()=>import('./pages/teach.jsx').then(m=>({default:m.McqBank})))
const Reports=lazy(()=>import('./pages/teach.jsx').then(m=>({default:m.Reports})))
const SupportEditor=lazy(()=>import('./pages/edit.jsx').then(m=>({default:m.SupportEditor})))
const ResourceManager=lazy(()=>import('./pages/edit.jsx').then(m=>({default:m.ResourceManager})))
const QuizEditor=lazy(()=>import('./pages/edit.jsx').then(m=>({default:m.QuizEditor})))
const TopicEditor=lazy(()=>import('./pages/edit.jsx').then(m=>({default:m.TopicEditor})))
const GuardianHome=lazy(()=>import('./pages/family.jsx').then(m=>({default:m.GuardianHome})))
const StudyHome=lazy(()=>import('./pages/study.jsx').then(m=>({default:m.StudyHome})))
const McqHome=lazy(()=>import('./pages/mcq.jsx').then(m=>({default:m.McqHome})))
const CalendarPage=lazy(()=>import('./pages/plan.jsx').then(m=>({default:m.CalendarPage})))
const ClassesPage=lazy(()=>import('./pages/plan.jsx').then(m=>({default:m.ClassesPage})))
const RoutinePage=lazy(()=>import('./pages/plan.jsx').then(m=>({default:m.RoutinePage})))

// What a student has read stays readable offline: a topic, its AI steps, translation, highlights, diagram and class questions, the course list and
// their questions are kept in the browser (Cache Storage, cleared on sign-out) and shown from there when the network is gone. Nothing goes to the AI again.
const READ_CACHE='zg-read',KEEP=/^\/(me|config|tree|ai\/status|me\/questions|questions\/\d+|topics\/\d+(\/(ai\/\w+|translation|highlights|diagram|class-questions))?)$/
const offlineNote=on=>dispatchEvent(new CustomEvent('zg-offline',{detail:on}))
let waiting=0;const slowNote=on=>{waiting=Math.max(0,waiting+(on?1:-1));dispatchEvent(new CustomEvent('zg-slow',{detail:waiting>0}))}
const keep=(p,j)=>{try{caches.open(READ_CACHE).then(c=>c.put(new Request(ROOT+'/api'+p),new Response(JSON.stringify(j),{headers:{'Content-Type':'application/json'}}))).catch(()=>{})}catch{/* no Cache Storage (private mode): nothing kept */}}
const kept=async p=>{try{const r=await caches.match(new Request(ROOT+'/api'+p),{cacheName:READ_CACHE});return r?await r.json():null}catch{return null}}
const forgetKept=()=>{try{caches.delete(READ_CACHE);caches.delete('zg-frames')}catch{/* nothing kept */}}
export const api=async(p,o={})=>{const t=localStorage.t,read=!o.method&&KEEP.test(p.split('?')[0])
  const slow=setTimeout(()=>slowNote(true),12000)  // a request still waiting after 12 s: say the connection may be slow
  let r;try{r=await fetch(ROOT+'/api'+p,{...o,headers:{'Content-Type':'application/json',...(t&&{Authorization:'Bearer '+t})},body:o.body&&JSON.stringify(o.body)})}
  catch{clearTimeout(slow);slowNote(false);const j=read&&await kept(p);if(j){offlineNote(true);return j}
    const x=new Error(navigator.onLine===false?tl("You're offline. Topics you have opened before still work."):tl("Can't reach the server. Check your internet connection and try again."));x.offline=true;offlineNote('fail');throw x}
  clearTimeout(slow);slowNote(false)
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(typeof j.detail==='string'?srv(j.detail):tl('Something went wrong')),{status:r.status})  // status: to tell refusals apart in any language
  if(read){keep(p,j);offlineNote(false)}return j}  // the server's messages are looked up like any other text
export const COL=['#2563eb','#f59e0b','#15803d','#b91c1c','#64748b']
export const when=iso=>new Date(iso).toLocaleString(locale(),{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})  // shown in the viewer's own time zone
const Mark=({s})=>s==='completed'?<Check className="done" aria-label={tl("Learned")}/>:null  // only what the student marked as learned; nothing for the rest
const ownerLine=c=>c.mine?tl('Your course'):srv(c.owner_problem)||(c.owner?tl("Owner: {owner}",{owner:c.owner}):tl('Owner not assigned'))
export const useFaculty=on=>{const [l,setL]=useState([]);useEffect(()=>{if(on)api('/admin/users?role=faculty&limit=100').then(r=>setL(r.items.filter(u=>u.active))).catch(()=>{})},[on]);return l}

export const firstName=n=>{const w=(n||'').trim().split(/\s+/).filter(Boolean);if(!w.length)return '';if(!/^(dr|prof|mr|mrs|ms|miss)\.?$/i.test(w[0]))return w[0];const rest=w.slice(1).filter(x=>x.replace(/\./g,'').length>1);return rest.length?w[0]+' '+rest[0]:w[0]}  // a title stays with the surname it belongs to ("Dr. A. Kumar" → "Dr. Kumar"), skipping initials
export const roleName=u=>u.role==='admin'?tl("Admin"):u.role==='faculty'?tl("Faculty"):u.role==='guardian'?(u.relation==='teacher'?tl("School teacher"):tl("Parent")):tl("Student")  // a parent or teacher who signed up is a guardian
export const MAX_FILE_MB=20,tooBig=f=>f.size>MAX_FILE_MB*1024*1024  // the server's limit for one file of study material
export const PAGE=10  // the rule: any list longer than ten rows gets numbered pages
export const pl=(n,w)=>tl(n===1?'{n} '+w:'{n} '+(w==='quiz'?'quizzes':w+'s'),{n})  // "1 topic", "3 topics": each form is its own phrase to translate
export const matches=n=>tl(n===1?'{n} match':'{n} matches',{n})
export const Ctx=createContext({})
const THEMES=L([['light',Sun,tl("Light")],['dark',Moon,tl("Dark")]])
const readTheme=()=>{try{return localStorage.theme==='dark'?'dark':'light'}catch{return 'light'}}  // light unless the user picks dark
const applyTheme=t=>{const dark=t==='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#0f172a':'#f8fafc')}
// the Zigora mark: a Z in cream and coral on plum (the same drawing as public/favicon.svg)
const ZMark=({size=40})=><svg className="zmark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#2563eb"/><rect x="16" y="15" width="32" height="8" rx="2.5" fill="#ffffff"/><path d="M38.5 23H48L25.5 41H16Z" fill="#f59e0b"/><rect x="16" y="41" width="32" height="8" rx="2.5" fill="#ffffff"/></svg>
export const Logo=({src,size=40})=>src?<img className="logo" src={at(src)} alt="" width={size} height={size} style={{width:size,height:size}}/>:<ZMark size={size}/>
const Lockup=({logo,name,size=40})=><div className="lockup"><Logo src={logo} size={size}/><b>{name}</b></div>
// sign-in, reset and first-password pages: the form, with a brand panel beside it on wide screens
// the language switch: English, Arabic (the whole app turns right to left) or Tamil
const cap=w=>w?w[0].toUpperCase()+w.slice(1):''
const LangSwitch=({lang,pick})=><label className="langsw" title={tl("Language")}><Globe size={17} aria-hidden="true"/><select aria-label={tl("Language")} value={lang} onChange={e=>pick(e.target.value)}>{LANGS.map(([k,l])=><option key={k} value={k} lang={k}>{l}</option>)}</select></label>
const AuthFrame=({logo,name,children,lang,pick})=><div className="auth"><div className="authlang"><LangSwitch lang={lang} pick={pick}/></div><aside className="authart" aria-hidden="true"><Lockup logo={logo} name={name} size={44}/>
  <div><h2>{tl("Learn engineering, one topic at a time.")}</h2><p>{tl("Courses, notes, practice tests and progress for every program, semester and student, in one place.")}</p></div>
  <div className="bands"><i style={{background:'#dbeafe'}}/><i style={{background:'#93c5fd'}}/><i style={{background:'#ffffff'}}/><i style={{background:'#f59e0b'}}/></div></aside>{children}</div>

export default function App(){
  const [user,setUser]=useState(null),[ready,setReady]=useState(false),[pageSel,setPage]=useState(null),[msg,setMsg]=useState(''),[open,setOpen]=useState(false),[name,setName]=useState('Zigora'),[canReset,setCanReset]=useState(false),[canReg,setCanReg]=useState(false),[googleId,setGoogleId]=useState(null),[resetTok,setResetTok]=useState(()=>(/^#reset=([\w-]+)$/.exec(location.hash)||[])[1]||null),[start,setStart]=useState(null),[logo,setLogo]=useState(null),[theme,setTheme]=useState(readTheme),[ask,setAsk]=useState(null),[studyStart,setStudyStart]=useState(null),[findQ,setFindQ]=useState({q:'',n:0}),[lang,setLangS]=useState(()=>applyLang(firstLang())),picked=useRef(false)
  const confirm=useCallback(o=>new Promise(res=>setAsk({o,res})),[])  // in-app replacement for window.confirm: await confirm({title,body,ok,danger})
  const toast=useCallback(m=>{setMsg(m);setTimeout(()=>setMsg(''),2800)},[])
  const pickLang=useCallback(async l=>{picked.current=true;await loadLang(l).catch(()=>{});setLangS(applyLang(l));api('/me/lang',{method:'PUT',body:{lang:l}}).catch(()=>{/* signed out: kept on this device until sign-in */})},[])
  useEffect(()=>{if(user)keep('/me',user)},[user])  // so a signed-in student can open the app offline
  useEffect(()=>{if(!user)return  // signed in: a language picked just now goes to the account; otherwise the account's language is used
    if(picked.current&&user.lang!==lang)api('/me/lang',{method:'PUT',body:{lang}}).catch(()=>{})
    else if(!picked.current&&user.lang&&user.lang!==lang)loadLang(user.lang).catch(()=>{}).then(()=>setLangS(applyLang(user.lang)))},[user])
  useEffect(()=>{document.documentElement.dataset.role=user?.role||''},[user])  // admin pages lay out for a desktop (styles.css, [data-role=admin])
  useEffect(()=>{const m=/^#paid=(ok|no|check)$/.exec(location.hash);if(!user||!m)return  // back from Razorpay's page
    history.replaceState(null,'',location.pathname+location.search)
    api('/me/pro/check',{method:'POST'}).then(r=>{setPage('profile')
      toast(m[1]==='ok'||r.paid?tl("Payment received. You have Pro until {date}.",{date:new Date(new Date(r.pro_until)-1).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'})})
        :m[1]==='no'?tl("The payment was not completed."):tl("No word from Razorpay yet. If you paid, Pro starts within a few minutes."))}).catch(()=>{})},[user])
  useEffect(()=>{Promise.allSettled([loadLang(lang),api('/config').then(c=>{setName(c.name);setLogo(c.logo||null);setCanReset(!!c.email_reset);setCanReg(c.self_registration?(c.email_signup===false?'google':'email'):false);setGoogleId(c.google_client_id||null);document.title=c.name}),localStorage.t?api('/me').then(setUser).catch(e=>{if(!e.offline)localStorage.removeItem('t')}):null]).then(()=>setReady(true))},[])
  useEffect(()=>{applyTheme(theme)},[theme])
  const pickTheme=t=>{setTheme(t);try{localStorage.theme=t}catch{/* private mode: the choice lasts until the page closes */}}
  useEffect(()=>{const k=e=>e.key==='Escape'&&setOpen(false);addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[])
  useEffect(()=>{document.body.style.overflow=open?'hidden':''},[open])
  if(!ready)return null
  if(resetTok)return <AuthFrame logo={logo} name={name} lang={lang} pick={pickLang}><ResetPassword token={resetTok} toast={toast} msg={msg} canReset={canReset} appName={name} logo={logo} done={u=>{history.replaceState(null,'',location.pathname);setResetTok(null);setUser(u);toast(tl("Password changed. You are signed in."))}} leave={()=>{history.replaceState(null,'',location.pathname);setResetTok(null)}}/></AuthFrame>
  if(!user)return <AuthFrame logo={logo} name={name} lang={lang} pick={pickLang}><Login onIn={setUser} toast={toast} msg={msg} appName={name} logo={logo} canReset={canReset} canReg={canReg} googleId={googleId}/></AuthFrame>
  if(user.must_change)return <AuthFrame logo={logo} name={name} lang={lang} pick={pickLang}><ChangePassword forced appName={name} logo={logo} toast={toast} msg={msg} done={()=>setUser({...user,must_change:false})} out={()=>{localStorage.removeItem('t');setUser(null)}}/></AuthFrame>
  const student=user.role==='student',guardian=user.role==='guardian',page=pageSel||'home',admin=user.role==='admin',go=k=>{if(k==='build')setStudyStart(null);setPage(k);setOpen(false)},openIn=nav=>{setStart(nav);go('learn')},openStudy=t=>{setPage('build');setOpen(false);setStudyStart(t)},find=q=>{setFindQ(f=>({q,n:f.n+1}));go('search')},signOut=()=>{localStorage.removeItem('t');forgetKept();setOpen(false);setPage(null);setUser(null)}
  // the side menu (the logo goes Home; search, change password, theme and sign out are in the header)
  const cal=['calendar',CalendarDays,tl("Calendar")]
  const asg=['assign',ClipboardCheck,tl("Assigned tests")],teacher=guardian&&user.relation==='teacher'
  const links=student?[['learn',GraduationCap,tl("My courses")],['assigned',ClipboardCheck,tl("Assigned to me")],['mcq',ListChecks,tl("MCQ practice")],['revision',RotateCcw,tl("Revision")],cal,['join',Plus,tl("Join a course")],['saved',Bookmark,tl("Saved")],['classes',Megaphone,tl("Classes and announcements")],['questions',MessageCircle,tl("My questions")],['progress',TrendingUp,tl("My progress")],['learning',History,tl("My learning")],['build',Upload,tl("Build a course")],...(user.self_registered?[['aikey',Sparkles,tl("My AI key")]]:[])]  // a short menu: routine lives in My progress, About in the footer
    :guardian?[cal,...(teacher?[['offered',GraduationCap,tl("Offered courses")],['learn',BookOpen,tl("Course content")]]:[]),['classes',Megaphone,tl("Classes and announcements")],...(teacher?[['questions',MessageCircle,tl("Student questions")],['struggles',AlertTriangle,tl("Where students struggle")],asg]:[]),['aikey',Sparkles,tl("My AI key")],['about',Info,tl("About")]]  // a parent or teacher: their students on Home, and the AI key their school students use
    :admin?ADMIN_SECTIONS.map(([k,I,l,pages])=>[pages[0][0],I,tl(l),k])
    :[['learn',BookOpen,tl("Courses")],['offered',GraduationCap,tl("Offered courses")],['classes',Megaphone,tl("Classes")],cal,  // a teacher: their teaching first, then grouped under short headings
      ['-',tl("Students")],['questions',MessageCircle,tl("Student questions")],['struggles',AlertTriangle,tl("Where students struggle")],['reports',BarChart3,tl("Reports")],
      ['-',tl("Tests")],asg,['mcqbank',ListChecks,tl("MCQ bank")],['mcq',ClipboardList,tl("MCQ practice")],
      ['-',tl("Saved")],['bookmarks',Bookmark,tl("Bookmarks")],['highlights',Highlighter,tl("My highlights")],
      ['-',''],...(user.self_registered?[['aikey',Sparkles,tl("My AI key")]]:[]),['about',Info,tl("About")]]
  return <Ctx.Provider value={{menu:()=>setOpen(true),go,appName:name,confirm,role:user.role,aiOff:!!user.ai_off,level:user.level}}>  {/* aiOff: a school student with no parent's or teacher's key studies without AI */}
    <TopBar user={user} lang={lang} pickLang={pickLang} theme={theme} pickTheme={pickTheme} onMenu={()=>setOpen(true)} onHome={()=>go('home')} onAccount={()=>go('profile')} onOut={signOut} onNote={()=>go('home')} page={page}/>
    {page!=='search'&&!guardian&&<GlobalSearch key={findQ.n} onFind={find} onPhoto={user.ai_off?null:()=>go('photo')}/>}{page==='photo'&&<PhotoAsk toast={toast}/>}
    <OfflineBar/>{admin&&<SectionTabs page={page} go={go}/>}<div id="pageslot"/>
    <Suspense fallback={<div className="main"><Skeleton/></div>}>{/* a page in its own file shows this while it loads the first time */}
    {page==='home'&&student&&<Dashboard user={user} toast={toast} onOpen={openIn} onStudy={openStudy} onRoutine={()=>go('routine')} onCalendar={()=>go('calendar')} onGo={go}/>}
    {page==='routine'&&student&&<RoutinePage toast={toast} done={()=>go('home')}/>}
    {page==='home'&&guardian&&<GuardianHome user={user} toast={toast} onKey={()=>go('aikey')} onCalendar={()=>go('calendar')} onGo={go}/>}{page==='home'&&!student&&!guardian&&<StaffHome user={user} toast={toast} open={openIn} goUsers={p=>{handoff.usersPlan=p;go(p==='awaiting'?'parents':'students')}} goSettings={t=>{handoff.settingsTab=t;go('ai')}}/>}
    {page==='search'&&<SearchPage key={findQ.n} initial={findQ.q} user={user} toast={toast}/>}{page==='learn'&&<Learn key={String(start)} start={start} user={user} toast={toast} appName={name} onGo={go} onStudy={openStudy}/>}
    {page==='progress'&&user.role==='student'&&<Insights toast={toast} role={user.role} onRoutine={()=>go('routine')}/>}{page==='saved'&&student&&<Saved toast={toast} role={user.role}/>}{page==='learning'&&student&&<LearningPage toast={toast} role={user.role}/>}{page==='revision'&&student&&<RevisionPage toast={toast} role={user.role}/>}
    {page==='build'&&user.role==='student'&&<StudyHome key={JSON.stringify(studyStart)} start={studyStart} toast={toast}/>}
    {page==='bookmarks'&&!admin&&<Bookmarks toast={toast} role={user.role}/>}{page==='highlights'&&!admin&&<MyHighlights toast={toast} role={user.role}/>}
    {page==='users'&&admin&&<Users key="all" toast={toast} me={user}/>}{page==='teachers'&&admin&&<Users key="faculty" role="faculty" toast={toast} me={user}/>}{page==='students'&&admin&&<Users key="student" role="student" toast={toast} me={user}/>}{page==='parents'&&admin&&<Users key="guardian" role="guardian" toast={toast} me={user}/>}{page==='courses'&&admin&&<AdminCourses toast={toast} onOpen={openIn}/>}{page==='programs'&&admin&&<Programs toast={toast} onOpen={openIn}/>}
    {page==='ai'&&admin&&<AiConfig toast={toast} onBrand={()=>api('/config').then(c=>{setName(c.name);setLogo(c.logo||null);document.title=c.name})}/>}{page==='reports'&&(admin||user.role==='faculty')&&<Reports role={user.role} toast={toast}/>}{page==='activity'&&admin&&<Activity toast={toast}/>}{page==='aikey'&&user.self_registered&&<MyAiKey toast={toast}/>}{page==='password'&&<ChangePassword toast={toast} done={()=>go('profile')}/>}{page==='profile'&&<Profile toast={toast} onPassword={()=>go('password')} onKey={()=>go('aikey')}/>}{page==='about'&&<About user={user}/>}
    {page==='mcq'&&!guardian&&<McqHome toast={toast}/>}{page==='questions'&&student&&<MyQuestions toast={toast}/>}{page==='classes'&&<ClassesPage toast={toast}/>}{page==='struggles'&&(admin||user.role==='faculty'||teacher)&&<StrugglesPage toast={toast}/>}{page==='offered'&&(admin||user.role==='faculty'||teacher)&&<OfferedPage toast={toast} openCourse={cid=>openIn([-1,-1,cid])}/>}{page==='join'&&student&&<JoinPage toast={toast} openCourse={cid=>openIn([-1,-1,cid])} onStudy={()=>openStudy(null)}/>}{page==='questions'&&(admin||user.role==='faculty'||teacher)&&<TeacherQuestions toast={toast}/>}{page==='calendar'&&<CalendarPage toast={toast}/>}
    {page==='assign'&&(admin||user.role==='faculty'||teacher)&&<AssignPage toast={toast}/>}{page==='assigned'&&student&&<AssignedToMe toast={toast}/>}{page==='mcqbank'&&(admin||user.role==='faculty')&&<McqBank toast={toast}/>}
    </Suspense>
    <div className={'drawer'+(open?' open':'')}><div className="dscrim" onClick={()=>setOpen(false)}/>
      <nav className="panel" aria-label={tl("Main menu")}>
        <div className="dhead"><button className={'homebtn'+(page==='home'?' on':'')} aria-label={tl("{name}, home",{name:name})} aria-current={page==='home'?'page':undefined} onClick={()=>go('home')}><Logo src={logo} size={36}/><span><b>{name}</b><small>{user.name}, {roleName(user).toLowerCase()}</small></span></button><button className="ic" aria-label={tl("Close menu")} onClick={()=>setOpen(false)}><X/></button></div>
        <div className="panlang"><LangSwitch lang={lang} pick={pickLang}/></div>
        {links.map(([k,I,l,sec],n)=>{if(k==='-')return I?<div key={'g'+n} className="dgrp" role="presentation">{I}</div>:<hr key={'g'+n} className="dsep"/>  // a group's heading, or a plain line
          const on=sec?sectionOf(page)?.[0]===sec:page===k;return <button key={sec||k} className={'dlink'+(on?' on':'')} aria-current={on?'page':undefined} onClick={()=>{if(k==='learn')setStart(null);go(k)}}><I size={20}/>{tl(l)}</button>})}
      </nav></div>
    <footer className="foot"><span>{tl("© {v} {name}. All rights reserved.",{v:new Date().getFullYear(),name:name})}</span>{student&&<>{" · "}<button className="link footl" onClick={()=>go('about')}>{tl("About")}</button></>}</footer>
    <Toast msg={msg}/>
    {ask&&<Confirm o={ask.o} answer={ok=>{ask.res(ok);setAsk(null)}}/>}
  </Ctx.Provider>}

// a thin line under the header while pages are being shown from what this browser kept
function OfflineBar(){
  const [on,setOn]=useState(false),[slow,setSlow]=useState(false),[gone,setGone]=useState(()=>navigator.onLine===false)
  useEffect(()=>{const f=e=>{if(e.detail==='fail')setGone(true);else setOn(!!e.detail)},w=e=>setSlow(!!e.detail),b=()=>{setOn(false);setGone(false)},d=()=>setGone(true)
    addEventListener('zg-offline',f);addEventListener('zg-slow',w);addEventListener('online',b);addEventListener('offline',d)
    return()=>{removeEventListener('zg-offline',f);removeEventListener('zg-slow',w);removeEventListener('online',b);removeEventListener('offline',d)}},[])
  useEffect(()=>{if(!gone||navigator.onLine===false)return;const h=setTimeout(()=>setGone(false),8000);return()=>clearTimeout(h)},[gone])  // a failed request: the note fades unless the device says it is offline
  return on?<div className="offbar" role="status">{tl("Offline. Showing what you read before.")}</div>
    :gone?<div className="offbar" role="alert">{tl("No connection. Practice, quizzes and new AI answers need the internet; topics you have opened before still work.")}</div>
    :slow?<div className="offbar" role="status">{tl("Taking longer than usual. Your connection may be slow; please wait.")}</div>:null}
// Sign in with Google: Google's own button (its script loads only when an admin has set the client ID); it hands back an ID token the server checks
let gsiLoad=null
function GoogleButton({clientId,onCredential,text='signin_with'}){
  const box=useRef(null),cb=useRef(onCredential);cb.current=onCredential
  useEffect(()=>{let gone=false
    gsiLoad=gsiLoad||new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=ok;s.onerror=()=>{gsiLoad=null;no()};document.head.appendChild(s)})
    gsiLoad.then(()=>{if(gone||!box.current)return;const g=window.google.accounts.id
      g.initialize({client_id:clientId,callback:r=>cb.current(r.credential),ux_mode:'popup',use_fedcm_for_prompt:true})
      g.renderButton(box.current,{theme:'outline',size:'large',shape:'pill',text,width:Math.min(box.current.offsetWidth||320,400),locale:getLang()})}).catch(()=>{})
    return()=>{gone=true}},[clientId,text])
  return <div className="gbtn" ref={box}/>}
function Login({onIn,toast,msg,appName,logo,canReset,canReg,googleId}){  // two tabs when sign-up is open: Sign in (password or Google) and Create an account (Google or email)
  const [f,setF]=useState({email:'',password:''}),[b,setB]=useState(false),[mode,setMode]=useState('in'),[sent,setSent]=useState(''),[gsign,setGsign]=useState(null)
  const withGoogle=async credential=>{setB(true);try{const r=await api('/login/google',{method:'POST',body:{credential}})
    if(r.token){localStorage.t=r.token;onIn(r.user)}else if(r.new){setGsign(r);setMode('register')}}catch(e){toast(e.message)}setB(false)}  // an existing account just signs in, from either tab
  const go=async()=>{setB(true);try{const r=await api('/login',{method:'POST',body:f});localStorage.t=r.token;onIn(r.user)}catch(e){toast(e.message)}setB(false)}
  const forgot=async()=>{setB(true);try{setSent((await api('/forgot',{method:'POST',body:{email:f.email}})).message)}catch(e){toast(e.message)}setB(false)}
  if(mode==='register')return <Register onIn={onIn} toast={toast} msg={msg} appName={appName} logo={logo} google={gsign} back={()=>{setMode('up');setGsign(null)}} signIn={()=>{setMode('in');setGsign(null)}}/>
  if(mode==='forgot')return <div className="login"><Lockup logo={logo} name={appName}/><h1>{tl("Forgot your password?")}</h1>{sent?<p>{sent}</p>:<><p>{tl("Enter your account email and we will send a link to choose a new one.")}</p><p className="known">{tl("Sign in with a username? Ask your parent or teacher to set a new password for you.")}</p>
    <label>{tl("Email")}</label><input type="email" autoComplete="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} onKeyDown={e=>e.key==='Enter'&&forgot()}/>
    <button className="btn" disabled={b||!f.email} onClick={forgot}>{tl("Send reset link")}</button></>}
    <button className="btn ghost" onClick={()=>{setMode('in');setSent('')}}>{tl("Back to sign in")}</button><Toast msg={msg}/></div>
  const up=canReg&&mode==='up',byEmail=canReg==='email'  // without email on the server, sign-up is with Google only
  return <div className="login"><Lockup logo={logo} name={appName}/>
    {canReg&&<Tabs items={[['in',tl("Sign in")],['up',tl("Create an account")]]} value={up?'up':'in'} onChange={setMode} label={tl("Sign in or create an account")}/>}
    {up?<><h1>{tl("Create an account")}</h1><p>{!byEmail?tl("Sign up with your Google account."):googleId?tl("Sign up with your Google account, or with your email."):tl("Sign up with your email. We will send you a code to confirm it.")}</p>
      {googleId&&<GoogleButton clientId={googleId} onCredential={withGoogle} text="signup_with"/>}
      {byEmail&&<>{googleId&&<div className="orline"><span>{tl("or")}</span></div>}
      <button className={googleId?'btn ghost':'btn'} disabled={b} onClick={()=>{setGsign(null);setMode('register')}}>{tl("Sign up with email")}</button></>}
      <p className="known">{tl("Students, parents and teachers can sign up here. Already have an account? Use Sign in.")}</p></>
    :<><h1>{tl("Sign in")}</h1><p>{canReg?tl("Welcome back."):tl("Use the account your institution created for you.")}</p>
      <label>{tl("Email or username")}</label><input type="text" autoCapitalize="none" autoComplete="username" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
      <label>{tl("Password")}</label><input type="password" autoComplete="current-password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} onKeyDown={e=>e.key==='Enter'&&go()}/>
      <button className="btn" disabled={b} onClick={go}>{tl("Sign in")}</button>
      {googleId&&<><div className="orline"><span>{tl("or")}</span></div><GoogleButton clientId={googleId} onCredential={withGoogle}/></>}
      {canReset?<button className="btn ghost" onClick={()=>setMode('forgot')}>{tl("Forgot password?")}</button>:<p className="known">{tl("Forgot your password? Ask your admin to reset it.")} {tl("Sign in with a username? Ask your parent or teacher to set a new password for you.")}</p>}</>}
    <Toast msg={msg}/></div>}

export const KID={name:'',username:'',password:'',program_id:'',semester:''}
export function Place({opts,level,v,set,id}){  // a program of the chosen level and one of its open terms; "not listed" leaves it for an admin
  const ps=opts[level]||[],p=ps.find(x=>String(x.id)===String(v.program_id))
  return <><label htmlFor={id+'p'}>{level==='school'?tl("School board or program"):tl("Program")}</label>
    <select id={id+'p'} value={v.program_id} onChange={e=>set({program_id:e.target.value,semester:''})}><option value="">{tl("Not listed: my admin will place me")}</option>{ps.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    {p&&<><label htmlFor={id+'t'}>{tl(p.term)}</label><select id={id+'t'} value={v.semester} onChange={e=>set({semester:e.target.value})}><option value="">{tl("Choose")}</option>{p.terms.map(n=><option key={n} value={n}>{tl(p.term)} {n}</option>)}</select></>}</>}
function Register({onIn,toast,msg,appName,logo,back,signIn,google}){  // school or college, then who is signing up, then the details; a code by email confirms it (none after Google, which checked the email)
  const [level,setLevel]=useState(''),[who,setWho]=useState(''),[opts,setOpts]=useState({school:[],college:[]})
  const [f,setF]=useState({name:google?.name||'',institution:'',id_number:'',email:google?.email||'',phone:'',password:'',program_id:'',semester:''}),[kids,setKids]=useState([{...KID}])
  const [stage,setStage]=useState('level'),[code,setCode]=useState(''),[b,setB]=useState(false),[wait,setWait]=useState(0),[info,setInfo]=useState(''),[unsent,setUnsent]=useState(0),[st,setSt]=useState({domains:[]}),[waiting,setWaiting]=useState('')
  useEffect(()=>{api('/register/status').then(setSt).catch(()=>{});api('/register/options').then(setOpts).catch(()=>{})},[])
  useEffect(()=>{if(wait<=0)return;const t=setTimeout(()=>setWait(wait-1),1000);return()=>clearTimeout(t)},[wait])
  const set=k=>e=>setF({...f,[k]:e.target.value}),setKid=(i,o)=>setKids(kids.map((k,j)=>j===i?{...k,...o}:k))
  const placed=x=>!x.program_id||!!x.semester,num=v=>v===''?null:+v
  const ok=(google?['name','phone']:['name','email','phone','password']).every(k=>f[k].trim())&&(who==='parent'||f.institution.trim())&&(who!=='student'||level==='school'||f.id_number.trim())
    &&(who!=='student'||placed(f))&&(who!=='parent'||kids.every(k=>k.name.trim()&&k.username.trim()&&k.password&&placed(k)))
  const body=()=>({...f,lang:getLang(),level,who,program_id:who==='student'?num(f.program_id):null,semester:who==='student'?num(f.semester):null,
    children:who==='parent'?kids.map(k=>({...k,program_id:num(k.program_id),semester:num(k.semester)})):[]})
  const signedUp=r=>{if(r.pending){setWaiting(r.message);return}localStorage.t=r.token;onIn(r.user)}  // a teacher waits for an admin's approval
  const start=async()=>{setB(true);try{if(google){signedUp(await api('/register/google',{method:'POST',body:{...body(),ticket:google.ticket}}))}
    else{const r=await api('/register/start',{method:'POST',body:body()});sentOrNot(r);setStage('code')}}catch(e){toast(e.message)}setB(false)}
  const sentOrNot=r=>{if(r.sent===false){setUnsent(n=>n+1);setWait(0)}else{setUnsent(0);setInfo(tl("We sent a 6-digit code to {email}. It works for {minutes} minutes.",{email:f.email.trim().toLowerCase(),minutes:10}));setWait(30)}}  // never claim a code that didn't go out
  const verify=async()=>{setB(true);try{signedUp(await api('/register/verify',{method:'POST',body:{email:f.email,code,lang:getLang()}}))}catch(e){toast(e.message)}setB(false)}
  const resend=async()=>{setB(true);try{const r=await api('/register/resend',{method:'POST',body:{email:f.email,lang:getLang()}});sentOrNot(r);setCode('');if(r.sent!==false)toast(tl("A new code is on its way"))}catch(e){toast(e.message)}setB(false)}
  const head=<Lockup logo={logo} name={appName}/>,foot=<Toast msg={msg}/>
  if(waiting)return <div className="login">{head}<h1>{tl("Thank you for signing up")}</h1><p>{srv(waiting)}</p><p className="known">{tl("Your admin checks every teacher account. You can sign in once it is approved.")}</p><button className="btn ghost" onClick={back}>{tl("Back to sign in")}</button>{foot}</div>
  if(stage==='code'&&unsent)return <div className="login">{head}<h1>{tl("We couldn't send your verification code")}</h1><p>{tl("Please try again. If the problem continues, you can return to sign-in and try later.")}</p>
    {unsent>1&&<p className="known" role="status">{tl("It didn't go through this time either. Wait a moment and try again.")}</p>}
    <button className="btn" disabled={b} onClick={resend}>{b?tl("Sending…"):tl("Try sending the code again")}</button>
    <button className="btn ghost" onClick={signIn}>{tl("Back to sign in")}</button>{foot}</div>
  if(stage==='code')return <div className="login">{head}<h1>{tl("Enter the code")}</h1><p>{info}</p>
    <label htmlFor="otp">{tl("6-digit code")}</label><input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} onKeyDown={e=>e.key==='Enter'&&code.length===6&&verify()} style={{letterSpacing:'.4em',fontSize:22,textAlign:'center'}}/>
    <button className="btn" disabled={b||code.length!==6} onClick={verify}>{tl("Verify and create my account")}</button>
    <button className="btn ghost" disabled={wait>0} onClick={resend}>{wait>0?tl("Send a new code in {wait}s",{wait:wait}):tl("Send a new code")}</button>
    <button className="btn ghost" onClick={()=>{setStage('form');setCode('')}}>{tl("Change my details")}</button>
    <button className="btn ghost" onClick={signIn}>{tl("Back to sign in")}</button>{foot}</div>
  if(stage==='level')return <div className="login">{head}<h1>{tl("Create an account")}</h1><p>{tl("Who is studying?")}</p>
    <button className="btn choice" onClick={()=>{setLevel('school');setStage('who')}}><b>{tl("A school student")}</b><small>{tl("Grade 1 to Grade 12")}</small></button>
    <button className="btn choice" onClick={()=>{setLevel('college');setStage('who')}}><b>{tl("A college student")}</b><small>{tl("College or university")}</small></button>
    <button className="btn ghost" onClick={back}>{tl("Back")}</button>{foot}</div>
  if(stage==='who')return <div className="login">{head}<h1>{tl("Who is signing up?")}</h1><p>{level==='school'?tl("For a school student"):tl("For a college student")}</p>
    {[['student',tl("I'm the student"),tl("An account for me")],['parent',tl("A parent"),tl("Accounts for one or more of my children")],['teacher',tl("A teacher"),tl("I add or invite my students after signing up")]]
      .map(([k,l,d])=><button key={k} className="btn choice" onClick={()=>{setWho(k);setStage('form')}}><b>{l}</b><small>{d}</small></button>)}
    <button className="btn ghost" onClick={()=>setStage('level')}>{tl("Back")}</button>{foot}</div>
  const school=level==='school'
  return <div className="login">{head}<h1>{who==='parent'?tl("Your details"):who==='teacher'?tl("Teacher sign-up"):tl("Create an account")}</h1><p>{google?tl("Signing up with your Google account {email}.",{email:google.email}):tl("We will email you a code to confirm your address.")}{!google&&who!=='parent'&&st.domains.length>0&&tl(" Use your institution email ({domains}).",{domains:st.domains.map(d=>'@'+d).join(', ')})}</p>
    <label htmlFor="rn">{tl("Full name")}</label><input id="rn" autoComplete="name" value={f.name} onChange={set('name')}/>
    {who!=='parent'&&<><label htmlFor="ri">{school?tl("School"):tl("College")}</label><input id="ri" autoComplete="organization" value={f.institution} onChange={set('institution')}/></>}
    {who==='student'&&<><label htmlFor="rid">{school?tl("Roll number (optional)"):tl("ID number")}</label><input id="rid" value={f.id_number} onChange={set('id_number')} placeholder={tl("Roll or employee number")}/>
      <Place id="me" opts={opts} level={level} v={f} set={o=>setF({...f,...o})}/></>}
    {!google&&<><label htmlFor="re">{tl("Email")}</label><input id="re" type="email" autoComplete="email" value={f.email} onChange={set('email')}/></>}
    <label htmlFor="rp">{tl("Phone")}</label><input id="rp" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="+91 98765 43210"/>
    {!google&&<><label htmlFor="rw">{tl("Password")}</label><input id="rw" type="password" autoComplete="new-password" value={f.password} onChange={set('password')}/></>}
    <p className="known">{google?tl("You sign in with Google. You can set a password later with “Forgot password?”."):tl("At least 8 characters.")}{who==='student'&&!school?' '+tl("AI help starts on Lite: a free daily allowance. You can add your own AI key later for more."):''}</p>
    {who==='parent'&&<><h3 className="sec">{tl("Your children")}</h3><p className="known" style={{marginTop:0}}>{tl("Each child signs in with their own username and password. They don't need an email.")}</p>
      {kids.map((k,i)=><div className="qbox" key={i}><b>{tl("Child {n}",{n:i+1})}</b>
        <label htmlFor={'kn'+i}>{tl("Name")}</label><input id={'kn'+i} value={k.name} onChange={e=>setKid(i,{name:e.target.value})}/>
        <label htmlFor={'ku'+i}>{tl("Username")}</label><input id={'ku'+i} autoCapitalize="none" autoComplete="off" value={k.username} onChange={e=>setKid(i,{username:e.target.value.toLowerCase().replace(/\s/g,'')})} placeholder="kavin.r"/>
        <label htmlFor={'kw'+i}>{tl("Password")}</label><input id={'kw'+i} type="password" autoComplete="new-password" value={k.password} onChange={e=>setKid(i,{password:e.target.value})}/>
        <Place id={'k'+i} opts={opts} level={level} v={k} set={o=>setKid(i,o)}/>
        {kids.length>1&&<button className="tool" onClick={()=>setKids(kids.filter((_,j)=>j!==i))}>{tl("Remove this child")}</button>}</div>)}
      {kids.length<8&&<button className="btn ghost" onClick={()=>setKids([...kids,{...KID}])}>{tl("Add another child")}</button>}</>}
    <button className="btn" disabled={b||!ok} onClick={start}>{google?tl("Create my account"):tl("Send me a code")}</button><button className="btn ghost" onClick={()=>setStage('who')}>{tl("Back")}</button>{foot}</div>}
// Home: courses a teacher invited this student to, with the hours left to accept
function CourseInvites({onGo}){
  const [d,setD]=useState(null);useEffect(()=>{api('/offered/catalog').then(setD).catch(()=>{})},[])
  if(!d?.invited.length)return null
  return d.invited.map(c=><button key={c.id} className="card flagcard" style={{textAlign:'start',width:'100%'}} onClick={()=>onGo('join')}><span className="dot" style={{background:'var(--acc)'}}><GraduationCap size={18}/></span>
    <div style={{flex:1}}><b>{tl("{teacher} invited you to {course}",{teacher:c.teacher,course:c.name})}</b><span>{tl("Accept or decline")} · {hoursLeft(c.expires_at)}</span></div><ChevronRight size={18}/></button>)}
function Invitations(){  // a teacher asked to follow this student's progress; nothing is shared until they accept
  const [list,setList]=useState([]),load=()=>api('/me/invitations').then(r=>setList(r.invitations)).catch(()=>{});useEffect(()=>{load()},[])
  const answer=async(x,a)=>{try{await api(`/me/invitations/${x.id}/${a}`,{method:'POST'});load()}catch{/* the list reloads either way */load()}}
  return list.map(x=><div className="qbox" key={x.id} style={{marginTop:0,marginBottom:12}}><b>{tl("{name} wants to follow your progress",{name:x.name})}</b>
    <p className="known" style={{margin:'6px 0 0'}}>{x.institution?x.institution+' · ':''}{tl("They would see which topics you have learned and your test scores, never your notes. For school students, their AI key can also give you AI help.")}</p>
    <div className="two"><button className="btn" onClick={()=>answer(x,'accept')}>{tl("Accept")}</button><button className="btn ghost" onClick={()=>answer(x,'decline')}>{tl("Decline")}</button></div></div>)}

function MyAiKey({toast}){
  const confirm=useConfirm(),g=useContext(Ctx).role==='guardian'  // a parent's or teacher's key is for the school students linked to them
  const [d,setD]=useState(null),[key,setKey]=useState(''),[b,setB]=useState(false),[prov,setProv]=useState('deepseek')
  const load=()=>api('/me/ai-key').then(r=>{setD(r);setProv(r.provider||'deepseek')}).catch(e=>toast(e.message));useEffect(()=>{load()},[])
  const pv=d?.providers?.find(x=>x.id===prov)
  const save=async()=>{setB(true);try{await api('/me/ai-key',{method:'PUT',body:{key,provider:prov}});setKey('');toast(tl("Key saved. AI help is on."));load()}catch(e){toast(e.message)}setB(false)}
  const del=async()=>{if(!await confirm({title:tl("Remove your key?"),body:g?tl("AI help turns off for your school students, unless another parent or teacher linked to them has a key."):tl("You go back to Lite: the free daily allowance."),ok:tl("Remove key"),danger:true}))return;try{await api('/me/ai-key',{method:'DELETE'});toast(tl("Key removed"));load()}catch(e){toast(e.message)}}
  return <><Bar title={tl("My AI key")} sub={d?.key_set?tl("AI is on · {name} key {key_hint}",{name:d.provider_name,key_hint:d.key_hint}):g?tl("No key yet"):tl("No key yet: you are on Lite")}/><div className="main">
    <p className="known">{g?tl("Your AI key powers AI help for the school students linked to you. Usage is billed to your account with that provider. The key is stored encrypted and never shown to them."):tl("Optional. Without a key you are on Lite: a free daily allowance of AI on your college's key. With your own key from DeepSeek, ChatGPT, Claude, Qwen or Perplexity there is no daily limit, and usage is billed to your account with that provider. Choose the provider, paste its key and save. We check it with the provider first, then store it encrypted. It is never shown again in full.")}</p>
    <label htmlFor="kp">{tl("AI provider")}</label><select id="kp" value={prov} onChange={e=>setProv(e.target.value)}>{(d?.providers||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    {pv&&<p className="known" style={{marginTop:4}}>{tl("Create a key at {site}.",{site:pv.console})}</p>}
    <label htmlFor="k">{tl("{name} API key",{name:pv?.name||'AI'})}</label><input id="k" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder={d?.key_set?tl("Paste a new key to replace the current one"):tl("Paste the key")}/>
    <button className="btn" disabled={b||!key.trim()} onClick={save}>{b?tl("Checking the key…"):tl("Save key")}</button>
    {d?.key_set&&<button className="btn ghost" onClick={del}>{tl("Remove my key")}</button>}</div></>}
const KIND_TAG={exam:"Exam",test:"Test",assignment:"Assignment",holiday:"Holiday",event:"Event",reminder:"Reminder",deadline:"Learn by",session:"Study session",studied:"Studied",result:"Result",plan:"Plan",class:"Class"}
export const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export const ofYmd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
export const plusDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)
const calTitle=x=>x.event?x.title:tl(x.title)  // people's own words stay as they are; Zigora's own lines are translated
const calWhen=x=>[x.end?tl("{a} to {b}",{a:fmtDay(x.date),b:fmtDay(x.end)}):'',x.at||''].filter(Boolean).join(' · ')
const fmtDay=s=>ofYmd(s).toLocaleDateString(getLang(),{day:'numeric',month:'short'})
const STATE={done:"Done",missed:"Missed",overdue:"Overdue"}
export function CalItem({x,onEdit}){
  return <div className={'card calitem k-'+x.kind}><span className={'calbar k-'+x.kind} aria-hidden="true"/>
    <div className="hit" style={{cursor:'default'}}><div style={{flex:1}}><b>{calTitle(x)}{x.state&&STATE[x.state]&&<span className={'pill sm '+(x.state==='done'?'okp':'off')}>{tl(STATE[x.state])}</span>}</b>
      <span>{[tl(KIND_TAG[x.kind]||''),calWhen(x),x.sub?srv(x.sub):''].filter(Boolean).join(' · ')}</span>{x.event?.notes&&<span className="calnote">{x.event.notes}</span>}</div></div>
    {x.link?.join&&<a className="tool" href={x.link.join} target="_blank" rel="noreferrer" onClick={()=>x.link.class&&joinClass(x.link.class)}><Play size={16}/>{" "}{tl("Join")}</a>}
    {x.event?.can_edit&&<button className="tool" onClick={()=>onEdit(x)} aria-label={tl("Edit {title}",{title:x.title})}><Pencil size={16}/></button>}</div>}
function ComingUp({onAll}){  // Home: the next few things on the calendar
  const [xs,setXs]=useState(null)
  useEffect(()=>{const n=new Date();api(`/calendar?start=${ymd(n)}&end=${ymd(plusDays(n,14))}`).then(r=>setXs(r.items.filter(x=>!['studied','result'].includes(x.kind)&&x.state!=='done'&&x.kind!=='session'))).catch(()=>setXs([]))},[])
  if(!xs?.length)return null
  return <><h3 className="sec">{tl("Coming up")}</h3>{xs.slice(0,3).map(x=><CalItem key={x.id} x={x}/>)}<button className="btn ghost" onClick={onAll}>{tl("Open the calendar")}</button></>}

function ResetPassword({token,toast,msg,done,leave,canReset,appName,logo}){
  const [ok,setOk]=useState(null),[f,setF]=useState({password:'',again:''}),[b,setB]=useState(false)
  useEffect(()=>{api('/reset/check',{method:'POST',body:{token}}).then(r=>setOk(r.valid)).catch(()=>setOk(false))},[token])
  const go=async()=>{if(f.password.length<8)return toast(tl("Use at least 8 characters"));if(f.password!==f.again)return toast(tl("The passwords don't match"))
    setB(true);try{const r=await api('/reset',{method:'POST',body:{token,new_password:f.password}});localStorage.t=r.token;done(r.user)}catch(e){toast(e.message)}setB(false)}
  if(ok===null)return null
  if(!ok)return <div className="login"><Lockup logo={logo} name={appName}/><h1>{tl("This link has expired")}</h1><p>{tl("Reset links work once and only for a short time.")}{canReset?tl(" Ask for a new one from the sign-in page."):tl(" Ask your admin to reset your password.")}</p><button className="btn" onClick={leave}>{tl("Go to sign in")}</button></div>
  return <div className="login"><Lockup logo={logo} name={appName}/><h1>{tl("Choose a new password")}</h1><p>{tl("Use at least 8 characters.")}</p>
    <label>{tl("New password")}</label><input type="password" autoComplete="new-password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/>
    <label>{tl("Repeat new password")}</label><input type="password" autoComplete="new-password" value={f.again} onChange={e=>setF({...f,again:e.target.value})} onKeyDown={e=>e.key==='Enter'&&go()}/>
    <button className="btn" disabled={b} onClick={go}>{tl("Save and sign in")}</button><Toast msg={msg}/></div>}

function ChangePassword({forced,appName,logo,toast,msg,done,out}){
  const [f,setF]=useState({current:'',password:'',again:''}),[b,setB]=useState(false),set=k=>e=>setF({...f,[k]:e.target.value})
  const go=async()=>{if(f.password.length<8)return toast(tl("Use at least 8 characters"));if(f.password!==f.again)return toast(tl("The new passwords don't match"))
    setB(true);try{const d=await api('/me/password',{method:'POST',body:{current:f.current,new_password:f.password}});if(d.token)localStorage.t=d.token;toast(tl("Password changed"));done()}catch(e){toast(e.message)}setB(false)}
  const form=<><label>{forced?tl("Password your admin gave you"):tl("Current password")}</label><input type="password" autoComplete="current-password" value={f.current} onChange={set('current')}/>
    <label>{tl("New password (8+ characters)")}</label><input type="password" autoComplete="new-password" value={f.password} onChange={set('password')}/>
    <label>{tl("Repeat new password")}</label><input type="password" autoComplete="new-password" value={f.again} onChange={set('again')} onKeyDown={e=>e.key==='Enter'&&go()}/>
    <button className="btn" disabled={b} onClick={go}>{tl("Change password")}</button></>
  if(forced)return <div className="login"><Lockup logo={logo} name={appName}/><h1>{tl("Choose your own password")}</h1><p>{tl("Your admin set a temporary password. Pick a new one to continue.")}</p>{form}<button className="btn ghost" onClick={out}>{tl("Sign out")}</button><Toast msg={msg}/></div>
  return <><Bar title={tl("Change password")}/><div className="main">{form}</div></>}

export const Bar=({title,sub,back,right})=><div className="bar">{back&&<button className="ic" aria-label={tl("Back")} onClick={back}><ChevronLeft/></button>}
  <h1>{title}{sub&&<small>{sub}</small>}</h1>{right}</div>
// the header on every signed-in page: menu (phone), notifications, theme, the signed-in user (opens Change password) and sign out at the far right
const initials=n=>(n||'?').trim().split(/\s+/).filter(w=>!/^(dr|prof|mr|mrs|ms|miss)\.?$/i.test(w)).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?'
function TopBar({user,lang,pickLang,theme,pickTheme,onMenu,onHome,onAccount,onOut,onNote,page}){
  const {appName}=useContext(Ctx),i=THEMES.findIndex(t=>t[0]===theme),[,ThemeIcon,themeLabel]=THEMES[i<0?0:i],nextTheme=THEMES[(i+1)%THEMES.length]
  return <header className="top"><button className="ic menu" aria-label={tl("Open menu")} onClick={onMenu}><Menu/></button><button className="topname" onClick={onHome}>{appName}</button>
    <span className="topgap"/>
    <Notifications onOpen={onNote} page={page}/>
    <LangSwitch lang={lang} pick={pickLang}/>
    <button className="ic" aria-label={tl("Theme: {themeLabel}. Switch to {v}",{themeLabel:themeLabel,v:nextTheme[2]})} title={tl("Theme: {themeLabel}",{themeLabel:themeLabel})} onClick={()=>pickTheme(nextTheme[0])}><ThemeIcon size={19}/></button>
    <button className={'who'+(page==='profile'||page==='password'?' on':'')} onClick={onAccount} title={tl("My profile")}><span className="av" aria-hidden="true">{initials(user.name)}</span><span className="whotx"><b>{user.name}</b><small>{tl(cap(user.role))}</small></span></button>
    <button className="ic" aria-label={tl("Sign out")} title={tl("Sign out")} onClick={onOut}><LogOut size={19}/></button></header>}
// what needs doing: staff get the overview's attention list, students their overdue and due-soon topics and untried or failed tests
// what needs doing (worked out by the server): staff get the overview's attention list, students their deadlines and tests. The badge counts
// only the ones not seen yet; opening the list marks them seen. Where the server can send email, a daily summary can be switched on here.
function Notifications({onOpen,page}){
  const [d,setD]=useState(null),[open,setOpen]=useState(false),box=useRef(null)
  const load=useCallback(()=>api('/me/notifications').then(setD).catch(()=>setD({items:[]})),[])
  useEffect(()=>{load()},[load,page])
  useEffect(()=>{const t=setInterval(load,120000),f=()=>document.visibilityState==='visible'&&load();document.addEventListener('visibilitychange',f);return()=>{clearInterval(t);document.removeEventListener('visibilitychange',f)}},[load])  // fresh every 2 minutes, and on coming back to the tab
  useEffect(()=>{if(!open)return;const f=e=>{if(!box.current?.contains(e.target))setOpen(false)},k=e=>e.key==='Escape'&&setOpen(false);addEventListener('pointerdown',f);addEventListener('keydown',k);return()=>{removeEventListener('pointerdown',f);removeEventListener('keydown',k)}},[open])
  const items=d?.items||[],n=items.filter(x=>x.unread).length
  const toggle=async()=>{if(open){setOpen(false);load();return}  // closing: the bold ones are seen now
    setOpen(true);try{const r=await api('/me/notifications');setD(r);const keys=r.items.filter(x=>x.unread).map(x=>x.key)  // what is shown now is what gets marked seen
      if(keys.length)await api('/me/notifications/seen',{method:'POST',body:{keys}})}catch{/* the list stays as it was */}}
  const digest=async on=>{try{const r=await api('/me/notifications/settings',{method:'PUT',body:{digest:on}});setD(x=>({...x,digest:r.digest}))}catch(e){alert(e.message)}}
  const reminders=async on=>{try{const r=await api('/me/notifications/settings',{method:'PUT',body:{return_reminders:on}});setD(x=>({...x,return_reminders:r.return_reminders}))}catch(e){alert(e.message)}}
  return <div className="notes" ref={box}><button className="ic" aria-label={n?tl("Notifications, {n} new",{n:n}):tl("Notifications")} aria-expanded={open} onClick={toggle}><Bell size={19}/>{n>0&&<em className="badge">{n>9?'9+':n}</em>}</button>
    {open&&<div className="pop" role="dialog" aria-label={tl("Notifications")}><b className="poph">{tl("Notifications")}{n>0&&<small>{" "}{tl("· {n} new",{n:n})}</small>}</b>
      {d===null?<Skeleton/>:items.length?<Paged rows={items} render={x=><button key={x.key} className={'note'+(x.unread?' new':'')} onClick={()=>{setOpen(false);load();onOpen()}}><span>{srv(x.text)}</span>{x.sub&&<small>{srv(x.sub)}</small>}</button>}/>:<p className="known">{tl("You're all caught up.")}</p>}
      {d?.mail&&<label className="chk notemail"><input type="checkbox" checked={!!d.digest} onChange={e=>digest(e.target.checked)}/>{" "}{tl("Email me a daily summary of new ones")}</label>}
      {d&&d.return_reminders!==undefined&&<label className="chk notemail"><input type="checkbox" checked={!!d.return_reminders} onChange={e=>reminders(e.target.checked)}/>{" "}{tl("A gentle reminder if I haven't studied for a while")}</label>}</div>}</div>}
// the search box under the header on every page: Enter opens Search with the query
function GlobalSearch({onFind,onPhoto}){
  const [q,setQ]=useState('')
  return <form className="gsearch" role="search" onSubmit={e=>{e.preventDefault();if(q.trim().length>=2)onFind(q.trim())}}><div className="search"><Search size={18}/><input type="search" aria-label={tl("Search topics")} placeholder={tl("Search topics, or ask a question")} value={q} maxLength={200} onChange={e=>setQ(e.target.value)}/>
    {onPhoto&&<button type="button" className="ic sm camb" aria-label={tl("Ask from a photo")} title={tl("Ask from a photo")} onClick={onPhoto}><Camera size={18}/></button>}</div></form>}

const ARCHIVE_WHAT=L({programs:'every semester or year, course, unit, topic and quiz in it',semesters:'every course, unit, topic and quiz in it',courses:'its units, topics and quizzes',units:'its topics and quizzes',topics:'this topic'})
const ONE=L({programs:'program',semesters:'semester or year',courses:'course',units:'unit',topics:'topic'})
export function ArchiveSheet({a,close,done,toast}){  // archive or restore one item; archiving takes everything under it along, nothing is deleted
  const [busy,setBusy]=useState(false)
  const go=async()=>{setBusy(true);try{await api(`/${a.kind}/${a.id}/archive`,{method:'PUT',body:{archived:a.on}});toast(a.on?tl("Archived"):tl("Restored"));done()}catch(e){toast(e.message);setBusy(false)}}
  return <Sheet close={close}><h3>{a.on?tl("Archive"):tl("Restore")} “{a.name}”?</h3>
    <p className="known">{a.on?tl("This hides the {v} and {v2} from students, who see “unavailable right now” instead. Nothing is deleted and reading progress and quiz results are kept. You can restore it any time.",{v:ONE[a.kind],v2:ARCHIVE_WHAT[a.kind]})
      :tl("This brings back the {v} and everything that was archived along with it. Anything you archived on its own inside it stays archived until you restore that too.",{v:ONE[a.kind]})}</p>
    <button className={'btn'+(a.on?' danger':'')} disabled={busy} onClick={go}>{busy?tl("Working…"):a.on?tl("Archive"):tl("Restore")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export const ArchPill=({x})=>x.archived?<span className="pill off sm">{x.archived_self?tl("Archived"):tl("Archived with its parent")}</span>:null
// a term a student is in, with no courses yet: they're on their way, and two ways to start meanwhile
function NoCoursesYet({term,onGo,onStudy}){
  return <><p className="known">{tl("No courses have been added to {term} yet. Your institution's admin will make them available when they are ready.",{term})}</p>
    <p style={{margin:'4px 0 8px'}}><b>{tl("In the meantime, you can join a course offered by a teacher or build a course from your own notes.")}</b></p>
    {onGo&&<div className="card"><button className="hit" onClick={()=>onGo('join')}><span className="dot" style={{background:'var(--acc)'}}><Plus size={18}/></span><div><b>{tl("Join a course offered by a teacher")}</b><span>{tl("Open courses, courses you can ask to join, and invitations")}</span></div><ChevronRight size={18}/></button></div>}
    {onStudy&&<div className="card"><button className="hit" onClick={()=>onStudy(null)}><span className="dot" style={{background:'var(--acc)'}}><Upload size={18}/></span><div><b>{tl("Build a course from your own notes")}</b><span>{tl("Upload a PDF or Word file and study it with quick checks, quizzes and reviews")}</span></div><ChevronRight size={18}/></button></div>}</>}
function Learn({user,toast,appName,start,onGo,onStudy}){
  const confirm=useConfirm()
  const isAdmin=user.role==='admin',staff=user.role!=='student'
  const [mat,setMat]=useState(false),[rev,setRev]=useState(null)
  const [bulk,setBulk]=useState(null),[copy,setCopy]=useState(null),[tree,setTree]=useState([]),[nav,setNav]=useState(start||[]),[sheet,setSheet]=useState(null),[cp,setCp]=useState(null),[t,setT]=useState(null),[ed,setEd]=useState(null),[del,setDel]=useState(null),[sh,setSh]=useState(null),[qz,setQz]=useState(null),[qe,setQe]=useState(null),[arch,setArch]=useState(null),[showArch,setShowArch]=useState(false),[qr,setQr]=useState(null),[gb,setGb]=useState(null),[ci,setCi]=useState(null),[resM,setResM]=useState(null),[fin,setFin]=useState(null),[sp,setSp]=useState(null)
  const load=()=>api('/tree').then(setTree).catch(e=>toast(e.message));useEffect(()=>{load()},[t,ed,qz,qe,sheet,arch,qr])
  const landed=useRef(!!start?.length);useEffect(()=>{const real=tree.filter(x=>!x.offered);if(landed.current||user.role!=='student'||real.length!==1)return;landed.current=true;const p=real[0],c=p.semesters.find(x=>x.current)||(p.semesters.length===1?p.semesters[0]:null);setNav(c?[p.id,c.id]:[p.id])},[tree])
  const prog=tree.find(x=>x.id===nav[0]),sem=prog?.semesters.find(x=>x.id===nav[1]),co=sem?.courses.find(x=>x.id===nav[2]),unit=co?.units.find(x=>x.id===nav[3])
  const mayEdit=isAdmin||((user.role==='faculty'||user.relation==='teacher')&&!!co?.editable)  // a school teacher edits the courses they offer
  useEffect(()=>{setCp(null);if(co&&mayEdit&&!co.shared)api(`/courses/${co.id}/progress`).then(setCp).catch(()=>{})},[co?.id,mayEdit,t])
  const [cyc,setCyc]=useState(null);useEffect(()=>{setCyc(null);if(co&&!staff)api(`/courses/${co.id}/cycles`).then(setCyc).catch(()=>{})},[co?.id,staff,t,tree])  // their passes through the course (S37)
  if(mat&&co)return <MyMaterial cid={co.id} name={co.name} back={()=>{setMat(false);load()}} toast={toast}/>
  if(t)return <Topic id={t} back={()=>setT(null)} toast={toast} role={user.role}/>
  if(qz)return <QuizPlay id={qz} back={()=>setQz(null)} toast={toast} role={user.role}/>
  if(qe)return <QuizEditor {...qe} done={()=>setQe(null)} toast={toast}/>
  if(qr)return <QuizResults id={qr} back={()=>setQr(null)} toast={toast} role={user.role}/>
  if(rev)return <RevisionSheet uid={rev} toast={toast} back={()=>setRev(null)}/>
  if(gb)return <Gradebook cid={gb} back={()=>setGb(null)} toast={toast} role={user.role}/>
  if(fin)return <CourseFinishers cid={fin} back={()=>setFin(null)} toast={toast}/>
  if(resM)return <ResourceManager cid={resM} back={()=>setResM(null)} toast={toast}/>
  if(ci)return <ClassInsight cid={ci} back={()=>setCi(null)} toast={toast}/>
  if(sp)return <SupportPlans cid={sp} back={()=>setSp(null)} toast={toast}/>
  if(ed)return <TopicEditor role={user.role} toast={toast} edit={ed.id?ed:null} unitId={ed.unit_id} done={()=>setEd(null)} cancel={()=>setEd(null)}/>
  const last=cyc?.relearn?Object.fromEntries([...cyc.relearn.weak.map(x=>[x.id,tl("Weak last time")]),...cyc.relearn.strong.map(x=>[x.id,tl("Strong last time")])]):{}
  const tsub=x=>[x.published===false&&'Draft · students cannot see it',x.optional&&tl("Optional"),x.status!=='completed'&&last[x.id],x.learning_due_at&&(staff?'Due '+when(x.learning_due_at):tl("Your teacher's date")+': '+day(x.learning_due_at)),
    cp?.topics[x.id]&&`${cp.topics[x.id].completed}/${cp.students} completed`+(cp.topics[x.id].overdue?` · ${cp.topics[x.id].overdue} overdue`:'')].filter(Boolean).join(' · ')
  const row=(x,kind,one,sub,extra={})=>({id:x.id,n:x.name,sub,kind,archived:x.archived,archived_self:x.archived_self,locked:!staff&&kind==='courses'&&(x.archived||x.upcoming||x.paused),can:x.offered||prog?.offered&&kind!=='units'?false:kind==='programs'||kind==='semesters'?isAdmin:kind==='courses'?(isAdmin||x.mine)&&!x.shared:mayEdit&&!co?.shared,go:()=>setNav([...nav,x.id]),edit:()=>setEd({kind:one,id:x.id,name:x.name,...extra})})
  const drafts=t=>t.filter(x=>x.published===false).length
  const setPub=async(url,published,msg)=>{try{await api(url,{method:'PUT',body:{published}});toast(msg);load()}catch(e){toast(e.message)}}
  const move=async(items,i,d,url)=>{const ids=items.map(x=>x.id),j=i+d;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];try{await api(url,{method:'PUT',body:{ids}});load()}catch(e){toast(e.message)}}
  const list0=unit?unit.topics.map(x=>({id:x.id,n:x.title,s:x.status,b:x.bookmarked,kind:'topics',archived:x.archived,archived_self:x.archived_self,can:mayEdit&&!co.shared,sub:tsub(x),late:x.overdue,draft:x.published===false,go:()=>setT(x.id),edit:()=>setEd({id:x.id}),pub:()=>setPub(`/topics/${x.id}/publish`,x.published===false,x.published===false?'Published':'Moved to drafts')}))
    :co?co.units.map(x=>({...row(x,'units','unit',pl(x.topics.length,'topic')+(mayEdit&&drafts(x.topics)?' · '+tl('{n} draft',{n:drafts(x.topics)}):'')),edit:()=>setSheet({type:'unit',un:x,cid:co.id})}))
    :sem?sem.courses.map(x=>({...row(x,'courses','course',(x.upcoming&&!staff?tl("Starts on {date}",{date:day(x.starts_on)})+(x.ends_on?' · '+tl("to {date}",{date:day(x.ends_on)}):''):staff?pl(x.units.length,'unit'):pl(x.units.flatMap(n=>n.topics).length,'topic'))+(x.shared?tl(" · shared from {home}",{home:x.home}):x.shared_with?tl(" · shared with {shared_with} more",{shared_with:x.shared_with}):'')+(staff?' · '+ownerLine(x):'')),soon:x.paused&&!staff?tl("This course is paused for now. Your teacher will reopen it."):x.upcoming&&!staff?tl("This course starts on {date}",{date:day(x.starts_on)}):null,edit:()=>setSheet({type:'course',c:x,pid:prog.id,sid:x.semester_id}),share:()=>setSh({id:x.id,name:x.name,home:x.semester_id,sel:x.link_ids||[]}),unlink:x.shared?{id:x.id,keep:(x.link_ids||[]).filter(i=>i!==sem.id)}:null}))
    :prog?prog.semesters.map(x=>({...row(x,'semesters','semester',(isAdmin?(x.number?tl('{term} no. {n}',{term:prog.term,n:x.number}):tl('No {term} number set',{term:prog.term.toLowerCase()}))+' · ':'')+pl(x.courses.length,'course')),edit:()=>setSheet({type:'semester',sem:x,pid:prog.id})}))
    :tree.map(x=>({...row(x,'programs','program',x.offered?pl(x.semesters[0]?.courses.length||0,'course'):x.semesters.length+' '+x.term.toLowerCase()+(x.semesters.length===1?'':'s')),edit:()=>setSheet({type:'program',p:x}),...(x.offered?{go:()=>setNav([-1,-1])}:{})}))  // offered courses: straight to the list
  const offeredNode=tree.find(x=>x.offered)
  if(user.role==='student'&&sem&&!prog?.offered&&!co&&offeredNode)list0.unshift({id:'offered',n:tl("Offered courses"),sub:tl("Courses you joined: {list}",{list:offeredNode.semesters[0].courses.map(c=>c.name).join(', ')}),kind:'courses',go:()=>setNav([-1,-1])})  // a student lands in their semester; the courses they joined are a tap away
  const hidden=staff?list0.filter(x=>x.archived).length:0,list=staff&&!showArch?list0.filter(x=>!x.archived):list0,anyArch=staff&&tree.some(p=>p.archived||p.semesters.some(s=>s.archived||s.courses.some(c=>c.archived||c.units.some(n=>n.archived_self||n.topics.some(t=>t.archived_self)))))
  const cur=unit||co||sem||prog,crumbs=[prog,sem,co,unit].filter(Boolean).slice(0,-1).map(x=>x.name).join(' › ')
  const allSems=tree.flatMap(p=>p.semesters.map(s=>({id:s.id,label:p.name+' › '+s.name})))
  const myCourses=tree.flatMap(p=>p.semesters.flatMap(s=>s.courses.filter(c=>c.mine&&!c.shared&&(!c.archived||showArch)).map(c=>({p,s,c}))))
  const saveShare=async()=>{try{await api(`/courses/${sh.id}/links`,{method:'PUT',body:{semester_ids:sh.sel}});toast(tl("Sharing updated"));setSh(null);load()}catch(e){toast(e.message)}}
  const remove=async()=>{try{if(del.unlink)await api(`/courses/${del.unlink.id}/links`,{method:'PUT',body:{semester_ids:del.unlink.keep}});else await api(`/${del.kind}/${del.id}`,{method:'DELETE'});toast(tl("Deleted"));setDel(null);load()}catch(e){toast(e.message)}}
  return <><Bar title={cur?.name||appName} sub={nav.length?crumbs:tl("Hi {name}",{name:user.name})} back={nav.length>0&&(()=>setNav(nav.slice(0,-1)))}/>
   <div className="main">{unit&&!staff&&unit.topics.some(x=>x.status!=='not_started')&&<button className="btn ghost" style={{marginTop:0,marginBottom:12}} onClick={async()=>{if(!await confirm({title:tl("Start {name} over?",{name:unit.name}),body:tl("Only this unit's topics go back to not started. Your other units, your test attempts and your revision records stay, and you stay in the same pass through the course."),ok:tl("Start over")}))return
       try{const r=await api(`/units/${unit.id}/redo`,{method:'POST'});toast(r.topics===1?tl("1 topic is ready to study again"):tl("{n} topics are ready to study again",{n:r.topics}));load()}catch(e){toast(e.message)}}}><RotateCcw size={16}/>{" "}{tl("Start this unit over")}</button>}
     {unit&&mayEdit&&drafts(unit.topics)>0&&<button className="btn" style={{marginTop:0,marginBottom:12}} onClick={()=>setPub(`/units/${unit.id}/publish`,true,'All drafts published')}>{tl("Publish all {drafts} drafts",{drafts:drafts(unit.topics)})}</button>}{!nav.length&&!(user.role==='faculty'&&myCourses.length>0)&&<div className="hero"><h2>{tl("Choose a program")}</h2></div>}
     {staff&&(anyArch||showArch)&&<label className="chk" style={{marginBottom:12}}><input type="checkbox" checked={showArch} onChange={e=>setShowArch(e.target.checked)}/>{" "}{tl("Show archived")}{!showArch&&hidden>0?tl(" ({hidden} here)",{hidden:hidden}):''}</label>}
     {isAdmin&&!sem&&!prog?.offered&&<button className="btn ghost lead" onClick={()=>setSheet(prog?{type:'semester',sem:{},pid:prog.id}:{type:'program',p:{}})}>{prog?tl("Add {term} to {name}",{term:prog.term.toLowerCase(),name:prog.name}):tl("New program")}</button>}
     {isAdmin&&sem&&!co&&!prog?.offered&&<button className="btn ghost lead" onClick={()=>setSheet({type:'course',c:{},pid:prog.id,sid:sem.id})}>{tl("Add course to")}{" "}{sem.name}</button>}
     {co&&!unit&&!staff&&co.units.some(n=>n.topics.some(x=>x.status!=='not_started'))&&<button className="btn ghost" onClick={async()=>{if(!await confirm({title:tl("Start {name} over?",{name:co.name}),body:tl("This starts a new pass through the course: every topic goes back to not started and the tests count again. Nothing is deleted: your earlier pass, its finish date, your test attempts, revision and streak all stay, and you can compare the two."),ok:tl("Start over")}))return
       try{const r=await api(`/courses/${co.id}/redo`,{method:'POST'});toast(r.new?(r.topics===1?tl("Pass {n} started: 1 topic is ready to study again",{n:r.cycle}):tl("Pass {n} started: {topics} topics are ready to study again",{n:r.cycle,topics:r.topics})):tl("Nothing to start over yet"));load()}catch(e){toast(e.message)}}}><RotateCcw size={16}/>{" "}{tl("Start this course over")}</button>}
     {co&&!unit&&!staff&&cyc?.relearn&&(cyc.relearn.weak.length>0||cyc.relearn.strong.length>0)&&<div className="qbox"><b>{tl("Start with these")}</b>
       <p className="known" style={{marginTop:4}}>{tl("From your scores in your last pass. Weak: under 60% of at least 3 questions; strong: 80% or more.")}</p>
       {[...cyc.relearn.weak.map(x=>({...x,weak:true})),...cyc.relearn.strong].filter(x=>co.units.some(n=>n.topics.some(y=>y.id===x.id&&y.status!=='completed'))).map(x=><div key={x.id} className="row"><button className="hit" style={{flex:1,textAlign:'start'}} onClick={()=>setT(x.id)}><div>{x.title}<small>{(x.weak?tl("Weak last time"):tl("Strong last time"))+' · '+x.percent+'%'}</small></div></button>
         {!x.weak&&<button className="btn ghost sm" onClick={async()=>{try{await api(`/topics/${x.id}/complete`,{method:'PUT'});toast(tl("Marked as learned"));load()}catch(e){toast(e.message)}}}>{tl("Mark as learned")}</button>}</div>)}</div>}
     {co&&!unit&&!staff&&cyc?.cycles?.length>1&&<CyclePasses d={cyc}/>}
     {co&&!unit&&!staff&&(()=>{const ts=co.units.flatMap(n=>n.topics),k=ts.filter(x=>x.has_notes).length;return <div className="card"><button className="hit" onClick={()=>setMat(true)}><span className="dot" style={{background:COL[3]}}><FileText size={20}/></span>
       <div><b>{k?tl("Your notes in {k} of {length} topics",{k:k,length:ts.length}):tl("Bring your own notes")}</b><span>{k?tl("Add or update your material"):tl("Upload your PDF or Word notes. They are filed under this course's topics, for you only.")}</span></div></button></div>})()}
     {co&&!unit&&staff&&<div className="qbox" style={{marginTop:0}}><p className="known" style={{margin:0}}>{tl("Owner:")}{" "}<b>{co.mine?tl("You"):srv(co.owner_problem)||co.owner||tl("Not assigned")}</b>{sem.number?tl(" · {term} no. {number}",{term:prog.term,number:sem.number}):''}</p>
       {isAdmin&&!co.shared&&!co.offered&&<div className="two"><button className="btn ghost" onClick={()=>setSheet({type:'course',c:co,pid:prog.id,sid:co.semester_id})}>{tl("Edit course")}</button><button className="btn ghost" onClick={()=>setSheet({type:'owner',c:co})}>{tl("Change owner")}</button></div>}</div>}
     {!nav.length&&user.role==='faculty'&&<><h3 className="sec first">{tl("My courses")}</h3>{myCourses.length?<Paged rows={myCourses} render={({p,s,c},i)=><div key={c.id} className="card"><button className="hit" onClick={()=>setNav([p.id,s.id,c.id])}><span className="dot" style={{background:COL[i%5]}}>{c.name[0]}</span><div><b>{c.name}<ArchPill x={c}/></b><span>{p.name}{" "}{tl("› {name} · {length} units",{name:s.name,length:c.units.length})}</span></div></button></div>}/>
       :<p className="known">{tl("No course is assigned to you yet. An admin makes you the owner of a course.")}</p>}<h3 className="sec">{tl("All programs")}</h3></>}
    {mayEdit&&co&&!unit&&!co.shared&&<button className="btn ghost lead" onClick={()=>setSheet({type:'unit',un:{},cid:co.id})}>{tl("Add unit")}</button>}
    {mayEdit&&unit&&!co.shared&&<div className="two lead2"><button className="btn ghost" onClick={()=>setEd({unit_id:unit.id})}>{tl("Add topic to")}{" "}{unit.name}</button><button className="btn ghost" onClick={()=>setBulk(unit)}><Upload size={16}/>{" "}{tl("Upload topic files")}</button></div>}
    {!staff&&unit&&<button className="btn ghost lead" onClick={()=>setRev(unit.id)}><FileText size={16}/>{" "}{tl("Revision sheet")}</button>}
    {staff&&unit&&<button className="btn ghost lead" onClick={()=>setCopy({kind:'unit',id:unit.id,title:unit.name})}>{tl("Copy this unit to another course")}</button>}
    {<Paged rows={list} render={(x,i)=>x.locked?<div key={x.id} className="card" style={{opacity:.7}}><button className="hit" onClick={()=>toast(x.soon||tl("This course is unavailable right now"))} aria-label={tl("{n}, unavailable right now",{n:x.n})}><span className="dot" style={{background:'var(--mut)'}}><Lock size={18}/></span><div><b>{x.n}</b><span>{tl("Unavailable right now")}</span></div></button></div>:<div key={x.id} className="card" style={x.archived?{opacity:.75}:undefined}><button className="hit" onClick={x.go}><span className="dot" style={{background:COL[i%5]}}>{x.n[0]}</span><div><b>{x.n}<ArchPill x={x}/></b>{x.sub&&<span>{x.sub}</span>}</div>{(x.s||x.b)&&<span className="marks">{x.b&&<Bookmark className="bm" size={16} fill="currentColor"/>}{x.s&&<Mark s={x.s}/>}</span>}</button>
      <div className="acts">{staff&&x.can&&(x.archived_self||!x.archived)&&<button className="ic sm" aria-label={(x.archived_self?'Restore ':'Archive ')+x.n} onClick={()=>setArch({kind:x.kind,id:x.id,name:x.n,on:!x.archived_self})}>{x.archived_self?<ArchiveRestore size={16}/>:<Archive size={16}/>}</button>}
      {mayEdit&&<>{(x.kind==='units'||x.kind==='topics')&&list.length>1&&[[-1,ArrowUp,'up'],[1,ArrowDown,'down']].map(([d,I,w])=><button key={w} className="ic sm" aria-label={tl("Move {n} {w}",{n:x.n,w:w})} disabled={i+d<0||i+d>=list.length} onClick={()=>move(list,i,d,x.kind==='units'?`/courses/${co.id}/units/order`:`/units/${unit.id}/topics/order`)}><I size={16}/></button>)}{x.pub&&<button className="ic sm" aria-label={(x.draft?'Publish ':'Unpublish ')+x.n} onClick={x.pub}>{x.draft?<Eye size={16}/>:<EyeOff size={16}/>}</button>}{x.share&&<button className="ic sm" aria-label={tl("Share {n}",{n:x.n})} onClick={x.share}><Link2 size={16}/></button>}<button className="ic sm" aria-label={tl("Edit {n}",{n:x.n})} onClick={x.edit}><Pencil size={16}/></button><button className="ic sm" aria-label={tl("Delete {n}",{n:x.n})} onClick={()=>setDel(x.unlink?{...x,unlink:x.unlink}:x)}><Trash2 size={16}/></button></>}</div></div>}/>}
    {co&&!unit&&(co.tests?.length>0||(mayEdit&&!co.shared))&&<><h3 className="sec">{tl("MCQ tests")}</h3>
      {<Paged rows={co.tests} render={(q,i)=><div key={q.id} className="card"><button className="hit" onClick={()=>setQz(q.id)}><span className="dot" style={{background:COL[(i+1)%5]}}><ClipboardList size={18}/></span><div><b>{q.title}</b><span>{q.questions}{" "}{tl("questions · pass {pass_percent}%",{pass_percent:q.pass_percent})}{q.best!=null?tl(" · best {best}%",{best:q.best}):''}{q.published?'':tl(" · Draft")}</span></div>{q.best!=null&&q.best>=q.pass_percent&&<span className="marks"><Check size={16}/></span>}</button>
        {mayEdit&&<><button className="ic sm" aria-label={tl("Results of {title}",{title:q.title})} onClick={()=>setQr(q.id)}><BarChart3 size={16}/></button><button className="ic sm" aria-label={tl("Edit {title}",{title:q.title})} onClick={()=>setQe({id:q.id,course_id:co.id})}><Pencil size={16}/></button></>}</div>}/>}
      {mayEdit&&!co.shared&&<button className="btn ghost" onClick={()=>setQe({course_id:co.id,csvFirst:true})}><Upload size={16}/>{" "}{tl("New MCQ test from a CSV")}</button>}
      {mayEdit&&<button className="btn ghost" onClick={()=>setGb(co.id)}><BarChart3 size={16}/>{" "}{tl("Gradebook: final scores for every test")}</button>}
      {mayEdit&&<button className="btn ghost" onClick={()=>setFin(co.id)}><ClipboardCheck size={16}/>{" "}{tl("Who has finished this course")}</button>}
      {mayEdit&&<button className="btn ghost" onClick={()=>setResM(co.id)}><FileText size={16}/>{" "}{tl("Teacher resources")}</button>}
      {mayEdit&&<button className="btn ghost" onClick={()=>setCi(co.id)}><BarChart3 size={16}/>{" "}{tl("Class insight")}</button>}
      {mayEdit&&<button className="btn ghost" onClick={()=>setSp(co.id)}><Target size={16}/>{" "}{tl("Support plans")}</button>}</>}
    {unit&&(unit.quizzes.length>0||mayEdit)&&<><h3 className="sec">{tl("Quizzes")}</h3>
      {<Paged rows={unit.quizzes} render={(q,i)=><div key={q.id} className="card"><button className="hit" onClick={()=>setQz(q.id)}><span className="dot" style={{background:COL[(i+3)%5]}}>?</span><div><b>{q.title}</b><span>{q.questions}{" "}{tl("questions · pass {pass_percent}%",{pass_percent:q.pass_percent})}{q.best!=null?tl(" · best {best}%",{best:q.best}):''}{q.published?'':tl(" · Draft")}</span></div>{q.best!=null&&q.best>=q.pass_percent&&<span className="marks"><Check size={16}/></span>}</button>
        {mayEdit&&<><button className="ic sm" aria-label={tl("Results of {title}",{title:q.title})} onClick={()=>setQr(q.id)}><BarChart3 size={16}/></button><button className="ic sm" aria-label={tl("Edit {title}",{title:q.title})} onClick={()=>setQe({id:q.id,unit_id:unit.id,unitTopics:unit.topics.map(t=>({id:t.id,title:t.title}))})}><Pencil size={16}/></button></>}</div>}/>}
      {mayEdit&&<button className="btn ghost" onClick={()=>setQe({unit_id:unit.id,unitTopics:unit.topics.map(t=>({id:t.id,title:t.title}))})}>{tl("Add quiz")}</button>}</>}
    {user.role==='student'&&sem&&!co&&!prog?.offered&&!sem.courses.length&&<NoCoursesYet term={sem.name} onGo={onGo} onStudy={onStudy}/>}
    {!list.length&&!(user.role==='student'&&sem&&!co&&!prog?.offered)&&<p className="known">{(mayEdit&&co)||isAdmin?tl("Nothing here yet. Use the button above to add it."):!nav.length&&user.role==='student'?tl("You are not enrolled in a program yet. Ask your admin to add you to one."):tl("Nothing here yet. Your admin will add it soon.")}</p>}</div>
   {arch&&<ArchiveSheet a={arch} toast={toast} close={()=>setArch(null)} done={()=>setArch(null)}/>}
   {copy&&<CopySheet {...copy} toast={toast} close={()=>{setCopy(null);load()}}/>}{bulk&&<BulkTopics unit={bulk} toast={toast} close={()=>setBulk(null)} done={()=>{setBulk(null);load()}}/>}
   {del&&<Sheet close={()=>setDel(null)}><h3>{del.unlink?tl("Remove"):tl("Delete")} “{del.n}”{del.unlink?tl(" from this {v}",{v:(prog?.term||'semester').toLowerCase()}):''}?</h3>
     <p className="known">{del.unlink?tl("It only disappears from this {v}. The course stays where it was created.",{v:(prog?.term||'semester').toLowerCase()}):DELETES[del.kind]}{" "}{tl("This can't be undone.")}</p>
     <button className="btn danger" onClick={remove}>{del.unlink?tl("Remove"):tl("Delete")}</button><button className="btn ghost" onClick={()=>setDel(null)}>{tl("Cancel")}</button></Sheet>}
   {sh&&<Sheet page close={()=>setSh(null)}><h3>{tl("Share “{name}”",{name:sh.name})}</h3><p className="known">{tl("Tick every semester or year that should also show this course. You still edit it in one place.")}</p>
     {allSems.filter(x=>x.id!==sh.home).map(x=><label key={x.id} className="chk"><input type="checkbox" checked={sh.sel.includes(x.id)} onChange={e=>setSh({...sh,sel:e.target.checked?[...sh.sel,x.id]:sh.sel.filter(i=>i!==x.id)})}/> {x.label}</label>)}
     <button className="btn" onClick={saveShare}>{tl("Save")}</button><button className="btn ghost" onClick={()=>setSh(null)}>{tl("Cancel")}</button></Sheet>}
   {sheet?.type==='program'&&<ProgramSheet p={sheet.p} toast={toast} close={()=>setSheet(null)} done={()=>setSheet(null)}/>}
   {sheet?.type==='semester'&&<SemesterSheet sem={sheet.sem} pid={sheet.pid} term={prog?.term} toast={toast} close={()=>setSheet(null)} done={()=>setSheet(null)}/>}
   {sheet?.type==='course'&&<CourseSheet c={sheet.c} pid={sheet.pid} sid={sheet.sid} term={prog?.term} sems={tree.flatMap(p=>p.semesters.map(s=>({id:s.id,label:p.name+' › '+s.name})))} toast={toast} close={()=>setSheet(null)} done={()=>setSheet(null)}/>}
   {sheet?.type==='unit'&&<UnitSheet un={sheet.un} cid={sheet.cid} courses={isAdmin?tree.flatMap(p=>p.semesters.flatMap(s=>s.courses.filter(c=>!c.shared).map(c=>({id:c.id,label:`${p.name} › ${s.name} › ${c.name}`})))):null} toast={toast} close={()=>setSheet(null)} done={()=>setSheet(null)}/>}
   {sheet?.type==='owner'&&<OwnerSheet c={sheet.c} toast={toast} close={()=>setSheet(null)} done={()=>setSheet(null)}/>}
</>}
const DELETES={programs:"This deletes its semesters and courses with their units, topics and quizzes, and the students' reading progress, bookmarks and quiz attempts in them. Enrolled students keep their accounts but lose their program.",
  semesters:"This deletes its courses with their units, topics and quizzes, and the students' reading progress, bookmarks and quiz attempts in them. Courses shared into it from elsewhere are only unlinked.",
  courses:"This deletes its units, topics and quizzes, and the students' reading progress, bookmarks and quiz attempts in them. The owner keeps their account.",
  units:"This deletes its topics and quizzes, and the students' reading progress, bookmarks and quiz attempts in them.",
  topics:"This deletes the topic, its saved AI answers, and the students' reading progress and bookmarks for it."}
export function SemesterSheet({sem,pid,term='Semester',close,done,toast}){
  const isNew=!sem.id,[f,setF]=useState({name:sem.name||'',no:sem.number||''}),[busy,setBusy]=useState(false)
  const pickNo=e=>{const no=e.target.value;setF({no,name:!f.name||/^(Semester|Year|Grade) \d+$/.test(f.name)?(no?term+' '+no:''):f.name})}
  const save=async()=>{setBusy(true);try{const body={name:f.name,semester_no:f.no?+f.no:null};await api(isNew?`/programs/${pid}/semesters`:'/semesters/'+sem.id,{method:isNew?'POST':'PUT',body:isNew?body:{...body,program_id:pid}});toast(isNew?tl("{term} added",{term:term}):tl("Changes saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet page close={close}><h3>{isNew?tl("New {term}",{term:term.toLowerCase()}):tl("Edit {term}",{term:term.toLowerCase()})}</h3>
    <label>{term}{" "}{tl("number")}</label><select value={f.no} onChange={pickNo}><option value="">{tl("Choose…")}</option>{upTo(maxOf(term)).map(n=><option key={n} value={n}>{n}</option>)}</select>
    <label>{tl("Name")}</label><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder={term+" 3"}/>
    <p className="known" style={{marginTop:10}}>{tl("The number sets the order and which students see it: a student in {term} 3 sees {term2}s 1 to 3. Each number is used once per program.",{term:term.toLowerCase(),term2:term.toLowerCase()})}</p>
    <button className="btn" disabled={busy||!f.no||!f.name.trim()} onClick={save}>{isNew?tl("Add {term}",{term:term.toLowerCase()}):tl("Save changes")}</button></Sheet>}
export function CourseSheet({c,pid,sid,sems,term='Semester',close,done,toast}){
  const isNew=!c.id,faculty=useFaculty(true),[f,setF]=useState({name:c.name||'',sem:sid,owner:c.owner_id||''}),[busy,setBusy]=useState(false)
  const save=async()=>{setBusy(true);try{const owner=String(f.owner)!==String(c.owner_id||'')?{faculty_owner_id:f.owner?+f.owner:null}:{}  // unchanged owners are left alone
    await api(isNew?`/programs/${pid}/semesters/${sid}/courses`:'/courses/'+c.id,{method:isNew?'POST':'PUT',body:isNew?{name:f.name,...owner}:{name:f.name,semester_id:+f.sem,...owner}});toast(isNew?tl("Course added"):tl("Changes saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet page close={close}><h3>{isNew?tl("New course in {v}",{v:sems.find(x=>x.id===sid)?.label||''}):tl("Edit course")}</h3>
    <label>{tl("Name")}</label><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder={tl("Thermodynamics")}/>
    {!isNew&&<><label>{term}</label><select value={f.sem} onChange={e=>setF({...f,sem:+e.target.value})}>{sems.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></>}
    <label>{tl("Owner (faculty)")}</label><select value={f.owner} onChange={e=>setF({...f,owner:e.target.value})}><option value="">{tl("Not assigned")}</option>{c.owner_id&&!faculty.some(u=>u.id===c.owner_id)&&<option value={c.owner_id}>{c.owner}{" "}{tl("(can't edit)")}</option>}{faculty.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select>
    {!isNew&&+f.sem!==sid&&<p className="known">{tl("Moving the course takes its units, topics, quizzes and owner with it. Students placed there will see it.")}</p>}
    <button className="btn" disabled={busy||!f.name.trim()} onClick={save}>{isNew?tl("Add course"):tl("Save changes")}</button></Sheet>}

const STUDY=L({not_started:'Not opened yet',in_progress:'Opened, not marked completed',completed:'Marked completed'})
const AREA_GROUPS=L([['needs_study',tl("Needs another round of study"),tl("Read these topics again, then retake the quiz.")],['getting_there',tl("Getting there"),''],['strong',tl("Strong areas"),tl("You answered these well.")]])
// a result's facts: which attempt, and right, wrong and left blank (S32)
const ResultFacts=({r})=>{const c=r.counts,n=r.number;if(!c&&!n)return null
  return <p className="known" style={{margin:'4px 0 0'}}>{[n&&(n.of?tl("Attempt {n} of {of}",{n:n.n,of:n.of}):tl("Attempt {n}",{n:n.n})),c&&tl("{n} right",{n:c.correct}),c&&tl("{n} wrong",{n:c.wrong}),c&&tl("{n} left blank",{n:c.blank})].filter(Boolean).join(' · ')}</p>}
// where the student stands now in the result's topics, over all their answers (S32)
const Standing=({rows,onStudy})=>rows?.length?<><h3 className="sec">{tl("Where you stand now in these topics")}</h3><AreaList areas={rows} onStudy={onStudy}/></>:null
function AreaList({areas,onStudy,staff}){
  return <>{AREA_GROUPS.map(([k,title,hint])=>{const L=areas.filter(a=>a.status===k);if(!L.length)return null
    return <div className={'qbox area '+k} key={k}><b>{title} ({L.length})</b>{hint&&!staff&&<p className="known" style={{margin:'4px 0 8px'}}>{hint}</p>}
      {<Paged rows={L} render={a=><div className="arow" key={a.topic_id||'u'+a.unit_id}><div><span>{a.title}</span><small>{a.correct}{" "}{tl("of {total} right · {percent}%",{total:a.total,percent:a.percent})}{a.study&&!staff?' · '+STUDY[a.study]:''}{a.course?' · '+a.course:''}</small><Bar2 v={a.percent}/></div>
        {a.topic_id&&onStudy&&<button className="tool" onClick={()=>onStudy(a.topic_id)}>{k==='strong'?tl("Review"):tl("Study again")}</button>}</div>}/>}</div>})}</>}
export const handoff={usersPlan:'',settingsTab:''}  // a filter for the Users page and a Settings tab, set when the Home page sends the admin there
// the admin's menu has seven sections; each opens on its first page, and the section's other pages are tabs along the top, so every page stays one tap away
const ADMIN_SECTIONS=[['courses',BookOpen,"Courses",[['courses',"Courses"],['offered',"Offered courses"],['programs',"Programs"],['reports',"Reports"],['struggles',"Where students struggle"]]],
  ['teachers',UsersIcon,"Teachers",[['teachers',"Teachers"],['classes',"Classes and announcements"],['questions',"Student questions"]]],
  ['students',GraduationCap,"Students",[['students',"Students"],['parents',"Parents and school teachers"]]],
  ['tests',ClipboardCheck,"Tests",[['assign',"Assigned tests"],['mcqbank',"MCQ bank"],['mcq',"MCQ practice"]]],
  ['calendar',CalendarDays,"Calendar",[['calendar',"Calendar"]]],
  ['settings',Sparkles,"Settings",[['ai',"Settings"],['users',"All users"],['activity',"Activity log"]]],
  ['about',Info,"About",[['about',"About"]]]]
const sectionOf=page=>ADMIN_SECTIONS.find(x=>x[3].some(([k])=>k===page))
const SectionTabs=({page,go})=>{const sec=sectionOf(page);if(!sec||sec[3].length<2)return null
  return <div className="sectabs"><Tabs label={tl(sec[2])} scroll items={sec[3].map(([k,l])=>[k,tl(l)])} value={page} onChange={go}/></div>}
// a student tells the topic's teacher its notes have a problem; like "This looks wrong?", who sent it is never shown
const NOTE_PROBLEM={missing:'The notes are missing',incomplete:'The notes are incomplete',incorrect:'Something in the notes is wrong',wrong:'The notes are about a different topic'}
function NotesReport({tid,close,toast}){
  const [kind,setKind]=useState(''),[why,setWhy]=useState(''),[busy,setBusy]=useState(false)
  const send=async()=>{setBusy(true);try{await api('/ai/flag',{method:'POST',body:{source:'notes',topic_id:tid,kind,reason:why.trim()}});toast(tl("Thanks. Your teacher will check the notes."));close()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet close={close}><h3>{tl("Report a problem with these notes")}</h3><p className="known" style={{marginTop:0}}>{tl("Your teacher sees what you report, never who sent it.")}</p>
    {Object.entries(NOTE_PROBLEM).map(([k,l])=><label key={k} className="row" style={{gap:10}}><input type="radio" name="np" checked={kind===k} onChange={()=>setKind(k)}/>{tl(l)}</label>)}
    <label htmlFor="npw">{tl("What's the problem? (optional)")}</label><textarea id="npw" rows={2} maxLength={300} value={why} onChange={e=>setWhy(e.target.value)}/>
    <button className="btn" disabled={busy||!kind} onClick={send}>{tl("Send")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
// AI replies students flagged as looking wrong, on this person's topics (all of them for admins), never with who flagged them
export const FLAG_KIND={...NOTE_PROBLEM,gist:'The gist',why:'Why?',example:'Example',exam:'Exam angle',check:'Quick check',simpler:'More simply',outline:'Answer outline',explain:'Explain',answer:'Sample answer',line:'Highlight explanation',search:'Search answer',photo:'Photo answer'}
// ---- ask the teacher: a student's question about a topic goes to the teacher of its course (an admin when it has none), who answers in a
// ---- short thread. Unlike "This looks wrong?" it is not anonymous: the teacher sees who asked
const Q_STATE={waiting:['Waiting for your teacher','var(--warn)'],answered:['Answered','var(--ok)'],closed:['Closed','var(--mut)']}
const Q_LABEL={pending:['Pending','var(--warn)'],follow_up:['Follow-up','var(--warn)'],answered:['Answered','var(--ok)'],resolved:['Resolved','var(--mut)']}  // S40, for the student
export const QChip=({s,teacher,label})=>{if(label&&!teacher&&Q_LABEL[label]){const [l,c]=Q_LABEL[label];return <span className="chip" style={{color:c}}>{tl(l)}</span>}
  const [l,c]=Q_STATE[s]||Q_STATE.waiting;return <span className="chip" style={{color:c}}>{tl(s==='waiting'&&teacher?'Waiting for your answer':l)}</span>}
// a photo with a question or an answer (working on paper, a diagram): picked or taken, shrunk in the browser, shown before sending
function PhotoPick({photo,setPhoto,toast}){
  const pick=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{setPhoto(await shrink(f))}catch(x){toast(x.message)}}
  return photo?<div className="qphoto"><img src={photo} alt={tl("Your photo")}/><button className="ic sm" aria-label={tl("Remove the photo")} onClick={()=>setPhoto(null)}><X size={16}/></button></div>
    :<label className="btn ghost photopick"><Camera size={16}/> {tl("Add a photo")}<input type="file" accept="image/*" onChange={pick} hidden/></label>}
// S41: a video link in a message shows as a card that opens it (no thumbnails: the page loads no pictures from other sites)
const VIDEO_RE=/https:\/\/(?:www\.)?(youtube\.com\/watch\?[^\s)]*v=[\w-]{6,}[^\s)]*|youtu\.be\/[\w-]{6,}[^\s)]*|vimeo\.com\/\d+[^\s)]*|drive\.google\.com\/[^\s)]+|[^\s)]+\.(?:mp4|webm|mov)(?:\?[^\s)]*)?)/gi
const videoHost=u=>/youtu/.test(u)?'YouTube':/vimeo/.test(u)?'Vimeo':/drive\.google/.test(u)?'Google Drive':tl("Video")
const VideoCards=({text})=>{const urls=[...new Set((text||'').match(VIDEO_RE)||[])].slice(0,3);return urls.map(u=><a key={u} className="msgfile vcard" href={u} target="_blank" rel="noreferrer noopener"><Play size={18}/><span>{tl("Watch video")}</span><small>{videoHost(u)}</small></a>)}
const MsgBody=({m})=><>{m.text&&<div className="prose"><Md>{m.text}</Md></div>}<VideoCards text={m.text}/>{m.image&&<a href={at(m.image)} target="_blank" rel="noreferrer"><img className="msgimg" src={at(m.image)} alt={tl("Photo")} loading="lazy"/></a>}
  {m.file&&<a className="msgfile" href={at(m.file.url)} download={m.file.name}><FileText size={18}/><span>{m.file.name}</span><small>{tl("Download")}</small></a>}</>
function AskTeacher({tid,excerpt,ai,aiText,close,toast,onDone}){  // ai: {kind,id} of the AI answer it is asked from (S40); the server looks it up itself
  const {go:goTo}=useContext(Ctx),[text,setText]=useState(''),[photo,setPhoto]=useState(null),[busy,setBusy]=useState(false),[sim,setSim]=useState([]),[open,setOpen]=useState({}),[review,setReview]=useState(false),[done,setDone]=useState(null),rq=useRef(rid())
  useEffect(()=>{const q=[excerpt,text].filter(Boolean).join(' ').trim();if(q.split(/\s+/).length<2){setSim([]);return}  // answers the teacher already shared that look like this one
    const h=setTimeout(()=>api(`/topics/${tid}/similar?q=${encodeURIComponent(q.slice(0,500))}`).then(r=>setSim(r.items)).catch(()=>{}),500);return()=>clearTimeout(h)},[text,tid,excerpt])
  const send=async()=>{setBusy(true);try{setDone(await api(`/topics/${tid}/questions`,{method:'POST',body:{text,excerpt:excerpt||'',photo:photo||'',request_id:rq.current,...(ai?.id?{ai}:{})}}))}catch(e){toast(srv(e.message))}setBusy(false)}  // the same id on a retry: never two questions
  if(done)return <Sheet close={close}><h3>{tl("Sent to your teacher")}</h3>
    <p>{done.answered_by?tl("{name} will see it with the topic{ai}.",{name:done.answered_by,ai:done.ai?tl(" and the AI's explanation"):''}):tl("No teacher is assigned to this course yet. Your question is kept, and your school's admins can see it.")}</p>
    <p className="known">{[done.course,done.unit,done.topic].filter(Boolean).join(' › ')}{' · '}<QChip s={done.status} label={done.label}/></p>
    <button className="btn" onClick={()=>{close();onDone?onDone():goTo?.('questions')}}>{tl("See my questions")}</button><button className="btn ghost" onClick={close}>{tl("Back to the topic")}</button></Sheet>
  if(review)return <Sheet close={close}><h3>{tl("Check before sending")}</h3>
    {excerpt&&<p className="hltext" style={{marginBottom:10}}>“{excerpt}”</p>}
    {aiText&&<div className="qbox"><small className="steplab">{tl("The AI's explanation (your teacher sees a short part of it)")}</small><div className="prose"><Md>{aiText.length>600?aiText.slice(0,600)+'…':aiText}</Md></div></div>}
    <div className="qbox"><small className="steplab">{tl("Your question")}</small><p style={{whiteSpace:'pre-wrap',margin:0}}>{text}</p>{photo&&<img className="msgimg" src={photo} alt={tl("Your photo")}/>}</div>
    <p className="known">{tl("Your teacher sees your name and the topic you ask about.")}</p>
    <button className="btn" disabled={busy} onClick={send}>{busy?tl("Sending…"):tl("Send to my teacher")}</button><button className="btn ghost" disabled={busy} onClick={()=>setReview(false)}>{tl("Edit")}</button></Sheet>
  return <Sheet close={close}><h3>{tl("Ask my teacher")}</h3>
    {excerpt&&<p className="hltext" style={{marginBottom:10}}>“{excerpt}”</p>}
    {aiText&&<p className="known" style={{marginTop:0}}>{tl("The AI's explanation goes with it, so your teacher knows what you already read.")}</p>}
    <label htmlFor="tqtext">{tl("Your question")}</label><textarea id="tqtext" rows={4} maxLength={1000} value={text} onChange={e=>setText(e.target.value)} placeholder={tl("What would you like your teacher to explain?")}/>
    <small className="known">{tl("For maths, write it between dollar signs, like $x^2 + y^2$.")}</small>
    {sim.length>0&&<div className="simq"><b>{tl("Already answered for your class")}</b><small className="known" style={{display:'block'}}>{tl("Check these first. If one answers it, there's no need to send.")}</small>
      {sim.map(x=>{const [first,...rest]=x.messages;return <div key={x.id} className="qbox classq">{x.topic&&x.topic_id!==tid&&<small className="steplab">{x.topic}</small>}{first&&<MsgBody m={first}/>}
        {open[x.id]?<div className="thread">{rest.map(m=><div key={m.id} className={'msg'+(m.teacher?' teach':'')}><small>{m.teacher?m.who:tl("A student")}</small><MsgBody m={m}/></div>)}</div>
          :<button className="link" onClick={()=>setOpen(o=>({...o,[x.id]:true}))}>{tl(rest.length===1?"Show the answer":"Show the {n} replies",{n:rest.length})}</button>}</div>})}</div>}
    <PhotoPick photo={photo} setPhoto={setPhoto} toast={toast}/>
    <button className="btn" disabled={text.trim().length<3&&!(photo&&!text.trim())} onClick={()=>setReview(true)}>{tl("Review and send")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
export function QuestionThread({id,back,toast}){
  const confirm=useConfirm(),[q,setQ]=useState(null),[text,setText]=useState(''),[photo,setPhoto]=useState(null),[busy,setBusy]=useState(false),[topic,setTopic]=useState(false),{role}=useContext(Ctx)
  const [file,setFile]=useState(null),[ed,setEd]=useState(null),[hist,setHist]=useState(null),box=useRef(null)
  useEffect(()=>{api('/questions/'+id).then(setQ).catch(e=>{toast(srv(e.message));back()})},[id])
  const send=async()=>{setBusy(true);try{setQ(await api(`/questions/${id}/replies`,{method:'POST',body:{text,photo:photo||'',...(file?{file}:{})}}));setText('');setPhoto(null);setFile(null)}catch(e){toast(srv(e.message))}setBusy(false)}
  const pickDoc=e=>{const x=e.target.files?.[0];e.target.value='';if(!x)return;if(x.size>15*1024*1024){toast(tl("Keep the file under 15 MB"));return}
    const rd=new FileReader();rd.onload=()=>setFile({name:x.name,data:rd.result});rd.onerror=()=>toast(tl("That file could not be read"));rd.readAsDataURL(x)}
  const got=async()=>{setBusy(true);try{setQ(await api(`/questions/${id}/understood`,{method:'POST'}));toast(tl("Glad it's clear now"))}catch(e){toast(srv(e.message))}setBusy(false)}
  const still=()=>{box.current?.focus();box.current?.scrollIntoView({block:'center'})}
  const saveEdit=async()=>{setBusy(true);try{setQ(await api(`/questions/${id}/replies/${ed.id}`,{method:'PUT',body:{text:ed.text}}));setEd(null)}catch(e){toast(srv(e.message))}setBusy(false)}
  const showHist=async m=>{try{setHist({m,...await api(`/questions/${id}/replies/${m.id}/edits`)})}catch(e){toast(srv(e.message))}}
  const end=async()=>{if(!await confirm({title:tl("Close this question?"),body:tl("Nobody can reply after this. A new question can be asked from the topic."),ok:tl("Close it")}))return
    try{setQ(await api(`/questions/${id}/close`,{method:'POST'}))}catch(e){toast(srv(e.message))}}
  const withdraw=async()=>{if(!await confirm({title:tl("Withdraw this question?"),body:tl("It is deleted and leaves your teacher's list. They may already have had an email about it."),ok:tl("Withdraw"),danger:true}))return
    try{await api(`/questions/${id}/withdraw`,{method:'POST'});toast(tl("Question withdrawn"));back()}catch(e){toast(srv(e.message))}}
  const share=async on=>{if(on&&!await confirm({title:tl("Share with the class?"),body:tl("Everyone studying this topic will see the question and the answers under the topic. The student who asked is not named."),ok:tl("Share")}))return
    try{setQ(await api(`/questions/${id}/share`,{method:'POST',body:{shared:on}}));toast(on?tl("Shared with the class"):tl("No longer shared"))}catch(e){toast(srv(e.message))}}
  if(topic)return <Topic id={q.topic_id} back={()=>setTopic(false)} toast={toast} role={role}/>
  return <><Bar title={q?q.topic:tl("Question")} sub={q?[q.course,q.student].filter(Boolean).join(' · '):''} back={back}/><div className="main">
    {!q?<Skeleton/>:<><div className="tools" style={{justifyContent:'space-between',alignItems:'center'}}><span><QChip s={q.status} teacher={q.teacher} label={q.label}/>{q.shared&&<>{" "}<span className="chip">{tl("Shared with the class")}</span></>}{q.message&&<>{" "}<span className="chip">{tl("Message from your teacher")}</span></>}</span>{q.topic_id&&<button className="link" onClick={()=>setTopic(true)}>{tl("Open the topic")}</button>}</div>
      {q.excerpt&&<p className="hltext" style={{margin:'8px 0 12px'}}>“{q.excerpt}”</p>}
      {!q.teacher&&!q.message&&<p className="known" style={{margin:'4px 0 8px'}}>{[q.unit,q.at&&tl("Sent {when}",{when:when(q.at)}),q.answered_by?tl("To {name}",{name:q.answered_by}):tl("No teacher assigned yet; your school's admins can see it")].filter(Boolean).join(' · ')}</p>}
      {q.ai&&<details className="qbox"><summary className="known">{q.teacher?tl("What the AI had explained"):tl("The AI's explanation you sent with it")}</summary>{q.ai.q&&<p className="hltext">“{q.ai.q}”</p>}<p className="known" style={{whiteSpace:'pre-wrap'}}>{q.ai.a}</p></details>}
      <div className="thread">{q.messages.map(m=><div key={m.id} className={'msg'+(m.mine?' mine':'')+(m.teacher?' teach':'')}><small>{m.mine?tl("You"):m.who}{' · '}{when(m.at)}{m.edited&&<>{' · '}<button className="link" onClick={()=>showHist(m)}>{tl("edited")}</button></>}
        {q.teacher&&m.mine&&m.teacher&&ed?.id!==m.id&&<>{' · '}<button className="link" onClick={()=>setEd({id:m.id,text:m.text})}>{tl("Edit")}</button></>}</small>
        {ed?.id===m.id?<><textarea rows={4} maxLength={1000} value={ed.text} onChange={e=>setEd({...ed,text:e.target.value})} aria-label={tl("Edit your answer")}/><p className="known">{tl("The earlier wording is kept, and the answer shows it was edited.")}</p>
          <button className="btn" disabled={busy||ed.text.trim().length<3} onClick={saveEdit}>{tl("Save")}</button><button className="btn ghost" onClick={()=>setEd(null)}>{tl("Cancel")}</button></>:<MsgBody m={m}/>}</div>)}</div>
      {hist&&<Sheet close={()=>setHist(null)}><h3>{tl("Earlier versions")}</h3>{hist.items.map((x,i)=><div key={i} className="qbox"><small className="known">{tl("Until {when}",{when:when(x.until)})}</small><div className="prose"><Md>{x.text}</Md></div></div>)}
        <div className="qbox"><small className="known">{tl("Now")}</small><div className="prose"><Md>{hist.now}</Md></div></div><button className="btn ghost" onClick={()=>setHist(null)}>{tl("Close")}</button></Sheet>}
      {!q.teacher&&q.label==='answered'&&<div className="qbox"><b>{tl("Was this explanation helpful?")}</b><div className="two" style={{marginTop:8}}><button className="btn" disabled={busy} onClick={got}>{tl("Yes, I understand now")}</button><button className="btn ghost" onClick={still}>{tl("I still have a doubt")}</button></div></div>}
      {q.teacher&&(q.can_share||q.shared)&&<button className="btn ghost" onClick={()=>share(!q.shared)}>{q.shared?tl("Stop sharing with the class"):tl("Share with the class")}</button>}
      {q.status==='closed'&&!q.can_reopen?<p className="known">{q.helpful?tl("Resolved: you said it's clear now."):tl("This question is closed.")}{!q.teacher&&!q.message?' '+tl("For something new, ask from the topic."):''}</p>:<>
        {q.status==='closed'&&<p className="known">{tl("Resolved. Still unsure? You can reopen it ({n} left, within 14 days of resolving).",{n:q.reopens_left})}</p>}
        <label htmlFor="tqr">{q.teacher?tl("Your answer"):q.status==='closed'||q.label==='answered'?tl("I still have a doubt"):tl("Reply")}</label>
        <textarea id="tqr" ref={box} rows={3} maxLength={1000} value={text} onChange={e=>setText(e.target.value)} placeholder={q.teacher?tl("Explain it. Maths between dollar signs, like $x^2$. Paste a video link to show it as a card."):''}/>
        <PhotoPick photo={photo} setPhoto={setPhoto} toast={toast}/>
        {q.teacher&&(file?<div className="msgfile" style={{marginTop:8}}><FileText size={18}/><span>{file.name}</span><button className="ic sm" aria-label={tl("Remove the file")} onClick={()=>setFile(null)}><X size={16}/></button></div>
          :<label className="btn ghost photopick"><Upload size={16}/> {tl("Attach material")}<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,image/png,image/jpeg" onChange={pickDoc} hidden/></label>)}
        <button className="btn" disabled={busy||(text.trim().length<3&&!(photo&&!text.trim()))} onClick={send}>{busy?tl("Sending…"):q.teacher?tl("Send answer"):q.status==='closed'?tl("Reopen and send"):tl("Send")}</button>
        {q.status!=='closed'&&<button className="btn ghost" onClick={end}>{q.teacher?tl("Mark resolved"):tl("Close the question")}</button>}
        {q.can_withdraw&&<button className="btn ghost" onClick={withdraw}>{tl("Withdraw the question")}</button>}</>}</>}</div></>}  {/* before any answer: take it back */}
// ---- classroom learning intelligence (S44): for a course's teachers, where students struggle, read from existing records. Every figure shows its sample;
// ---- a topic is judged only once enough students have enough evidence; suggestions show the evidence behind them; the AI explains only when asked
const CI_STATUS={needs_study:['Needs attention','var(--bad)'],getting_there:['Needs revision','var(--warn)'],strong:['Strong','var(--ok)'],not_assessed:['Not assessed yet','var(--mut)']}
export const CI_CAT={attention:'Needs attention',revision:'Needs revision',insufficient:'Not enough evidence yet',studied_not_assessed:'Studied, not assessed',not_studied:'Not studied yet',strong:'Strong'}
const ciRec=r=>({explain:[tl("Explain this topic again in class"),tl("{n} of {of} students with enough evidence need attention",r)],
  common:[tl("Prepare one explanation for a shared doubt"),tl("{n} students asked about: {words}",{n:r.n,words:(r.words||[]).join(', ')})],
  practice:[tl("Assign targeted MCQs on the idea behind a commonly missed question"),tl("{n} of {of} answers chose the same wrong option: “{question}”",r)],
  revise:[tl("Point students to the revision sheet"),tl("{n} students marked it learned, but their results say it hasn't settled yet",r)],
  individual:[tl("Consider individual support"),tl("{n} students keep scoring low after 3 or more sittings",r)],
  keep:[tl("Keep the current approach"),tl("Accuracy rose from {from}% to {to}% in the last 30 days",r)]}[r.key]||[r.key,''])
const ciAcc=a=>a.asked?tl("{p}% of {n} answers, {k} students",{p:a.percent,n:a.asked,k:a.students}):tl("none yet")
const CiChip=({st})=>{const [l,c]=CI_STATUS[st]||CI_STATUS.not_assessed;return <span className="chip" style={{color:c}}>{tl(l)}</span>}
function ClassInsight({cid,toast,back}){
  const [f,setF]=useState({unit_id:0,since:'',until:''}),[d,setD]=useState(null),[open,setOpen]=useState(null)
  const qs=new URLSearchParams(Object.entries(f).filter(([,v])=>v).map(([k,v])=>[k,String(v)])).toString()
  useEffect(()=>{setD(null);api(`/reports/courses/${cid}/topics?${qs}`).then(setD).catch(e=>{toast(e.message);back()})},[qs])
  if(open)return <ClassTopic cid={cid} tid={open} f={f} toast={toast} back={()=>setOpen(null)}/>
  const r=d?.rule
  return <><Bar title={tl("Class insight")} sub={d?d.course:''} back={back}/><div className="main">
    <div className="qopt"><select aria-label={tl("Unit")} value={f.unit_id} onChange={e=>setF({...f,unit_id:+e.target.value})}><option value={0}>{tl("All units")}</option>{(d?.units||[]).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <div className="qopt"><label className="known">{tl("From")}{" "}<input type="date" value={f.since} onChange={e=>setF({...f,since:e.target.value})}/></label><label className="known">{tl("To")}{" "}<input type="date" value={f.until} onChange={e=>setF({...f,until:e.target.value})}/></label></div>
    {!d?<Skeleton rows={4}/>:<>
      <p className="known" style={{marginTop:0}}>{tl("{a} of {n} students were active in this period.",{a:d.active,n:d.students})}{' '}{tl("Opening a topic counts as studied, and marking it learned is the student's own word; neither shows understanding. Understanding comes from tests and MCQ practice: a student needs {q}+ questions over {k}+ sittings, and a topic needs {m}+ such students before it is judged.",{q:r.student.min_questions,k:r.student.min_sittings,m:r.min_assessed})}</p>
      <details className="known"><summary>{tl("How a topic is judged")}</summary><p>{tl("Needs attention: {s}% or more of the students with enough evidence need attention, and at least one more sign: {d}+ students raised doubts, or {w}% or more of the answers to a question ({m}+ answers) chose the same wrong option. Needs revision: {s}% or more need revision or attention. Strong: otherwise.",{s:r.share,d:r.doubt_students,w:r.wrong_share,m:r.wrong_min})}</p></details>
      {d.topics.map(t=><button key={t.topic_id} className="card ward" onClick={()=>setOpen(t.topic_id)}><span className="wtop"><b>{t.title}</b><CiChip st={t.status}/></span>
        <small className="known">{[tl("studied {a}/{n}",{a:t.studied,n:t.students}),tl("learned {a}",{a:t.learned}),tl("assessed {a}",{a:t.assessed}),tl("enough evidence {a}",{a:t.evidence})].join(' · ')}</small>
        {t.evidence>0&&<small className="known" style={{display:'block'}}>{tl("Strong {a} · needs revision {b} · needs attention {c}",{a:t.strong,b:t.needs_revision,c:t.needs_attention})}</small>}
        <small className="known" style={{display:'block'}}>{tl("Tests")}: {ciAcc(t.tests)} · {tl("Practice")}: {ciAcc(t.practice)}</small>
        {(t.doubts>0||t.not_clear>0)&&<small className="known" style={{display:'block'}}>{tl("Doubts {a} ({u} unresolved) · “Not clear?” {b}",{a:t.doubts,u:t.unresolved,b:t.not_clear})}</small>}
        {t.trend&&<small className="known" style={{display:'block'}}>{tl("Accuracy {a}% before the last 30 days ({n} answers), {b}% since ({m})",{a:t.trend.before,n:t.trend.before_asked,b:t.trend.recent,m:t.trend.recent_asked})}</small>}
        {t.recommendations.length>0&&<span style={{display:'block',marginTop:6}}>{t.recommendations.map((x,k)=>{const [a,b]=ciRec(x);return <small key={k} style={{display:'block'}}>{'→ '}<span style={{fontWeight:600}}>{a}</span>{b?' — '+b:''}</small>})}</span>}</button>)}</>}</div></>}
function ClassTopic({cid,tid,f,toast,back}){
  const [d,setD]=useState(null),[cat,setCat]=useState(''),[page,setPage]=useState(0),[ai,setAi]=useState(null),[busy,setBusy]=useState(false),[stu,setStu]=useState(null),[plan,setPlan]=useState(null)
  const base=`/reports/courses/${cid}/topics/${tid}`,qs=new URLSearchParams({...(f.since?{since:f.since}:{}),...(f.until?{until:f.until}:{})}).toString()
  useEffect(()=>{api(`${base}?${qs}&category=${cat}&limit=${PAGE}&offset=${page*PAGE}`).then(setD).catch(e=>{toast(e.message);back()})},[cat,page])
  if(stu)return <ClassStudent cid={cid} tid={tid} sid={stu} toast={toast} back={()=>setStu(null)}/>
  if(plan==='new')return <SupportEditor cid={cid} tids={[tid]} pick toast={toast} done={p=>setPlan(p.id)} cancel={()=>setPlan(null)}/>
  if(plan)return <SupportPlan id={plan} toast={toast} back={()=>setPlan(null)}/>
  const explain=async()=>{setBusy(true);try{setAi(await api(`${base}/explain?${qs}`,{method:'POST'}))}catch(e){toast(srv(e.message))}setBusy(false)}
  const t=d?.topic
  return <><Bar title={t?t.title:tl("Topic")} sub={tl("Class insight")} back={back}/><div className="main">{!d?<Skeleton rows={4}/>:<>
    <p style={{marginTop:0}}><CiChip st={t.status}/>{' '}<small className="known">{tl("{e} of {n} students have enough evidence",{e:t.evidence,n:t.students})}</small></p>
    {(d.categories.attention>0||d.categories.revision>0)&&<button className="btn ghost" onClick={()=>setPlan('new')}><Target size={16}/>{" "}{tl("Create a support plan for these students")}</button>}
    <div className="qbox"><b>{tl("Ask the AI what the evidence suggests")}</b><p className="known" style={{margin:'4px 0'}}>{tl("It gets only the figures below, the commonly missed questions and the doubts' words, never names, and must cite them. Nothing is decided for you.")}</p>
      {!ai?<button className="btn ghost" disabled={busy} onClick={explain}><Sparkles size={16}/> {busy?tl("Thinking…"):tl("Explain this topic's difficulties")}</button>:<>
        <div className="prose"><Md>{ai.text}</Md></div>
        {ai.unverified_numbers.length>0&&<p className="known" style={{color:'var(--bad)'}}>{tl("Check these numbers: they aren't in the evidence: {list}",{list:ai.unverified_numbers.join(', ')})}</p>}
        <details><summary className="known">{tl("The evidence it was given ({n} lines)",{n:ai.evidence.length})}</summary>{ai.evidence.map(e=><p key={e.id} className="known" style={{margin:'4px 0'}}><b>[{e.id}]</b> {e.text}</p>)}</details></>}</div>
    {d.common_wrong.length>0&&<><h3 className="sec">{tl("Questions many got wrong the same way")}</h3>{d.common_wrong.map(q=><div key={q.key} className="qbox"><div className="prose"><Md>{q.text}</Md></div>
      <small className="known">{tl("{n} answers from {k} students · {source}",{n:q.answered,k:q.students,source:q.source==='practice'?tl("MCQ practice"):q.source})}</small>
      {(q.options||[]).map((o,k)=><div key={k} className="row" style={{padding:'4px 0'}}><div>{k===q.correct?'✓ ':k===q.wrong_option?'✗ ':''}{String(o)}<small>{k===q.correct?tl("correct"):tl("chosen wrongly {n}×",{n:q.picks[k]||0})}</small></div></div>)}</div>)}</>}
    {(d.doubt_groups.length>0||d.other_doubts.length>0)&&<><h3 className="sec">{tl("Doubts")}</h3>
      {d.doubt_groups.map((g,k)=><details key={k} className="qbox"><summary><b>{tl("{n} students asked about: {words}",{n:g.students,words:g.words.join(', ')})}</b></summary>{g.doubts.map(x=><p key={x.id} className="known">“{x.text}” — {x.student}</p>)}</details>)}
      {d.other_doubts.length>0&&<details className="qbox"><summary>{tl("Other doubts ({n})",{n:d.other_doubts.length})}</summary>{d.other_doubts.map(x=><p key={x.id} className="known">“{x.text}” — {x.student}</p>)}</details>}</>}
    <h3 className="sec">{tl("Students")}</h3><p className="known" style={{marginTop:0}}>{tl("Grouped by what their records show, not ranked.")}</p>
    <div className="filters fit" style={{flexWrap:'wrap'}}><button className={'chip'+(cat===''?' on':'')} onClick={()=>{setCat('');setPage(0)}}>{tl("All")} ({Object.values(d.categories).reduce((a,b)=>a+b,0)})</button>
      {Object.entries(CI_CAT).map(([k,l])=>d.categories[k]>0&&<button key={k} className={'chip'+(cat===k?' on':'')} onClick={()=>{setCat(k);setPage(0)}}>{tl(l)} ({d.categories[k]})</button>)}</div>
    {d.students.map(x=><button key={x.id} className="row rowbtn" onClick={()=>setStu(x.id)}><div>{x.name}<small>{[tl(CI_CAT[x.category]),x.asked?tl("{p}% of {n} answers over {k} sittings",{p:x.percent,n:x.asked,k:x.sittings}):'',x.improving&&tl("improving"),x.repeated_errors>0&&tl("{n} questions wrong twice or more",{n:x.repeated_errors}),x.learned&&tl("marked learned"),x.doubts>0&&(x.doubts===1?tl("1 doubt"):tl("{n} doubts",{n:x.doubts}))].filter(Boolean).join(' · ')}</small></div><ChevronRight size={18}/></button>)}
    <Pager page={page} total={d.total} onPage={setPage}/></>}</div></>}
function ClassStudent({cid,tid,sid,toast,back}){
  const [d,setD]=useState(null);useEffect(()=>{api(`/reports/courses/${cid}/topics/${tid}/students/${sid}`).then(setD).catch(e=>{toast(e.message);back()})},[sid])
  return <><Bar title={d?.student||''} sub={d?.topic||''} back={back}/><div className="main">{!d?<Skeleton/>:<>
    <p style={{marginTop:0}}>{d.label?<CiChip st={d.label}/>:<span className="chip">{tl("Not assessed yet")}</span>}{' '}<small className="known">{[d.studied?tl("opened the topic"):tl("hasn't opened the topic"),d.learned&&tl("marked learned"),d.last_read&&tl("last read {when}",{when:when(d.last_read)})].filter(Boolean).join(' · ')}</small></p>
    <h3 className="sec">{tl("Sittings")}</h3>{!d.sittings.length?<p className="known">{tl("No tests or MCQ sets on this topic yet.")}</p>:d.sittings.map((x,k)=><div key={k} className="row"><div>{x.kind==='test'?tl("Test"):tl("MCQ practice")}<small>{when(x.at)} · {tl("{a} of {n} right",{a:x.right,n:x.asked})} ({x.percent}%)</small></div></div>)}
    {d.repeated_errors.length>0&&<><h3 className="sec">{tl("Questions got wrong twice or more")}</h3>{d.repeated_errors.map((x,k)=><div key={k} className="qbox"><div className="prose"><Md>{x.text}</Md></div><small className="known">{tl("Wrong {n} times; usually chose “{o}”; correct: “{c}”",{n:x.times_wrong,o:x.chosen!=null?String(x.options[x.chosen]):'?',c:x.correct!=null?String(x.options[x.correct]):'?'})}</small></div>)}</>}
    <h3 className="sec">{tl("Revision")}</h3><p className="known">{d.revised.length?tl("Read the revision sheet {n} times, last {when}",{n:d.revised.length,when:when(d.revised[d.revised.length-1])}):tl("Hasn't read the revision sheet.")}</p>
    {d.doubts.length>0&&<><h3 className="sec">{tl("Doubts")}</h3>{d.doubts.map(q=><div key={q.id} className="qbox"><QChip s="" label={q.label}/><div className="thread">{q.messages.map((m,k)=><div key={k} className={'msg'+(m.teacher?' teach':'')}><small>{m.teacher?tl("Teacher"):d.student} · {when(m.at)}</small><div className="prose"><Md>{m.text}</Md></div></div>)}</div></div>)}</>}</>}</div></>}
// ---- learning support plans (S45): a course's teacher gathers existing activities for chosen students. Progress comes from what the students do after
// ---- they are assigned; the outcome compares the same topics before and after (tests and practice apart) and waits for enough evidence; the teacher decides
export const IV_KIND={study:'Study the topic',revise:'Read the revision sheet',mcq:'MCQ practice',test:'Take the test',resource:'Open the teacher resource',ask:'Ask your teacher about it',relearn:'Learn the topic again from the start'}
const IV_PROG={not_started:'Not started',in_progress:'In progress',completed:'Completed'}
const IV_STATUS={draft:'Draft',active:'Active',completed:'Completed',cancelled:'Cancelled'}
const IV_OUT={improved:'Improved',partly:'Partly improved',not_yet:'Not yet improved',more_support:'Needs more support'}
const IV_OVERALL={not_established:'Outcome not yet established',rose:'Accuracy rose',fell:'Accuracy fell',steady:'About the same',mixed:'Tests and practice moved differently'}
const IV_EV={learned:'learned',opened:'opened',read:'read',asked:'asked','learned again':'learned again','started over':'started over'}
const ivEv=e=>IV_EV[e]?tl(IV_EV[e]):e
const ivShow=s=>s?new Date(new Date(s).getTime()-1).toLocaleDateString(locale(),{day:'numeric',month:'short'}):''
export const ivAct=a=>tl(IV_KIND[a.kind]||a.kind)+(a.label?': '+a.label:'')+(a.kind==='mcq'&&a.size?' · '+tl("{n} questions",{n:a.size}):'')
function IvCompare({c}){  // before and after on the plan's topics: shown with the number of answers, never as proof the plan caused it
  const side=(k,l)=>{const x=c[k];if(!x.before.asked&&!x.after.asked)return null
    return <small className="known" style={{display:'block'}}>{tl(l)}: {x.before.asked?tl("{p}% of {n} answers",{p:x.before.percent,n:x.before.asked}):tl("none")}{' → '}{x.after.asked?tl("{p}% of {n} answers",{p:x.after.percent,n:x.after.asked}):tl("none yet")}{x.established?'':' · '+tl("not enough yet")}</small>}
  return <><b style={{display:'block'}}>{tl(IV_OVERALL[c.overall])}</b>{side('test',"Tests")}{side('practice',"Practice")}</>}
function SupportPlans({cid,toast,back}){
  const [d,setD]=useState(null),[open,setOpen]=useState(null),[ed,setEd]=useState(null),[st,setSt]=useState('')
  const load=()=>api(`/interventions?course_id=${cid}&status=${st}`).then(setD).catch(e=>{toast(e.message);back()});useEffect(()=>{if(!open&&!ed)load()},[open,ed,st])
  if(ed)return <SupportEditor cid={cid} toast={toast} done={p=>{setEd(null);setOpen(p.id)}} cancel={()=>setEd(null)}/>
  if(open)return <SupportPlan id={open} toast={toast} back={()=>setOpen(null)}/>
  return <><Bar title={tl("Support plans")} sub={d?.items[0]?.course||''} back={back}/><div className="main">
    <p className="known" style={{marginTop:0}}>{tl("Extra practice for chosen students, made from what the course already has. Progress comes from what they do after the plan starts.")}</p>
    <button className="btn" onClick={()=>setEd(true)}><Plus size={16}/>{" "}{tl("New support plan")}</button>
    <div className="filters fit" style={{flexWrap:'wrap'}}>{['',...Object.keys(IV_STATUS)].map(k=><button key={k} className={'chip'+(st===k?' on':'')} onClick={()=>setSt(k)}>{k?tl(IV_STATUS[k]):tl("All")}</button>)}</div>
    {!d?<Skeleton rows={2}/>:!d.items.length?<p className="known">{tl("No support plans yet.")}</p>:d.items.map(p=><button key={p.id} className="card ward" onClick={()=>setOpen(p.id)}>
      <span className="wtop"><b>{p.title}</b><span className="chip">{tl(IV_STATUS[p.status])}</span></span>
      <small className="known">{p.topics.map(t=>t.title).join(', ')}{p.target?' · '+tl("target {date}",{date:ivShow(p.target)}):''}</small>
      <small className="known" style={{display:'block'}}>{[pl(p.counts.students,'student'),tl("{n} completed",{n:p.counts.completed}),tl("{n} in progress",{n:p.counts.in_progress}),tl("{n} not started",{n:p.counts.not_started}),p.counts.needs_review>0&&tl("{n} to review",{n:p.counts.needs_review}),p.counts.overdue>0&&tl("{n} past the target",{n:p.counts.overdue})].filter(Boolean).join(' · ')}</small></button>)}</div></>}
function SupportPlan({id,toast,back}){
  const confirm=useConfirm(),[p,setP]=useState(null),[ed,setEd]=useState(false),[stu,setStu]=useState(null),[busy,setBusy]=useState(false)
  const load=()=>api('/interventions/'+id).then(setP).catch(e=>{toast(e.message);back()});useEffect(()=>{load()},[id])
  if(!p)return <><Bar title={tl("Support plan")} back={back}/><div className="main"><Skeleton rows={3}/></div></>
  if(ed)return <SupportEditor cid={p.course_id} plan={p} toast={toast} done={x=>{setP(x);setEd(false)}} cancel={()=>setEd(false)}/>
  if(stu)return <SupportStudent p={p} sid={stu} toast={toast} back={()=>setStu(null)} onSaved={setP}/>
  const status=async s=>{if(s!=='active'&&!await confirm({title:s==='completed'?tl("Mark this plan completed?"):tl("Cancel this plan?"),body:tl("Students will no longer see it. Its records stay."),ok:s==='completed'?tl("Mark completed"):tl("Cancel the plan")}))return
    setBusy(true);try{setP(await api(`/interventions/${id}/status`,{method:'POST',body:{status:s}}))}catch(e){toast(srv(e.message))}setBusy(false)}
  const c=p.counts,live=p.status==='draft'||p.status==='active'
  return <><Bar title={p.title} sub={tl(IV_STATUS[p.status])} back={back}/><div className="main">
    <p className="known" style={{marginTop:0}}>{p.topics.map(t=>t.title).join(', ')}{p.target?' · '+tl("target {date}",{date:ivShow(p.target)}):''}</p>
    {p.description&&<p style={{whiteSpace:'pre-wrap'}}>{p.description}</p>}{p.criteria&&<p className="known">{tl("How you will judge it")}: {p.criteria}</p>}
    <p className="known">{[pl(c.students,'student'),tl("{n} completed",{n:c.completed}),tl("{n} in progress",{n:c.in_progress}),tl("{n} not started",{n:c.not_started}),c.needs_review>0&&tl("{n} to review",{n:c.needs_review}),c.overdue>0&&tl("{n} past the target",{n:c.overdue})].filter(Boolean).join(' · ')}</p>
    {live&&<div className="qopt"><button className="btn ghost" onClick={()=>setEd(true)}><Pencil size={16}/>{" "}{tl("Edit")}</button>
      {p.status==='draft'&&<button className="btn" disabled={busy} onClick={()=>status('active')}>{tl("Start the plan")}</button>}
      {p.status==='active'&&<button className="btn ghost" disabled={busy} onClick={()=>status('completed')}>{tl("Mark completed")}</button>}
      <button className="btn ghost" disabled={busy} onClick={()=>status('cancelled')}>{tl("Cancel the plan")}</button></div>}
    <h3 className="sec">{tl("Activities")}</h3>{p.activities.map((a,k)=><div key={a.id} className="row" style={a.removed_at?{opacity:.6}:null}><div>{k+1}. {ivAct(a)}<small>{[a.required?tl("Required"):tl("Optional"),a.removed_at&&tl("removed {when}",{when:day(a.removed_at)})].filter(Boolean).join(' · ')}</small></div></div>)}
    <h3 className="sec">{tl("Students")}</h3><p className="known" style={{marginTop:0}}>{tl("Before and after compare the same topics, tests and practice apart. A change needs {q}+ answers over {k}+ sittings after the start; it doesn't show the plan caused it.",{q:5,k:2})}</p>
    {p.students.map(x=><button key={x.user_id} className="row rowbtn" style={x.removed?{opacity:.6}:null} onClick={()=>setStu(x.user_id)}><div>{x.name}
      <small>{[x.removed?tl("Removed from the plan"):x.assigned_at?tl(IV_PROG[x.progress])+' · '+tl("{a} of {n} done",{a:x.done,n:x.required}):tl("Not started yet: the plan is a draft"),x.overdue&&tl("past the target"),x.needs_review&&tl("to review"),x.outcome&&tl(IV_OUT[x.outcome]),x.assigned_at&&tl(IV_OVERALL[x.comparison.overall])].filter(Boolean).join(' · ')}</small></div><ChevronRight size={18}/></button>)}</div></>}
function SupportStudent({p,sid,toast,back,onSaved}){
  const x=p.students.find(y=>y.user_id===sid),[out,setOut]=useState(x?.outcome||''),[note,setNote]=useState(x?.outcome_note||''),[busy,setBusy]=useState(false)
  if(!x)return null
  const save=async()=>{setBusy(true);try{onSaved(await api(`/interventions/${p.id}/students/${sid}/review`,{method:'POST',body:{outcome:out,note}}));toast(tl("Saved"));back()}catch(e){toast(srv(e.message))}setBusy(false)}
  return <><Bar title={x.name} sub={p.title} back={back}/><div className="main">
    {x.reason&&<p className="known" style={{marginTop:0}}>{tl("Why")}: {x.reason}</p>}
    <p>{x.assigned_at?tl("In the plan since {when}",{when:day(x.assigned_at)}):tl("Not started yet: the plan is a draft")}{x.removed?' · '+tl("Removed from the plan"):''}</p>
    <h3 className="sec">{tl("Activities")}</h3>{x.activities.map(a=>{const pa=p.activities.find(y=>y.id===a.id)||a;return <div key={a.id} className="row" style={a.removed?{opacity:.6}:null}><div>{a.state==='done'?'✓ ':a.state==='started'?'… ':'○ '}{ivAct(pa)}
      <small>{[a.state==='done'?tl("Done"):a.state==='started'?tl("Started"):tl("Not yet"),a.evidence&&ivEv(a.evidence),!a.required&&tl("Optional"),a.removed&&tl("removed, done before")].filter(Boolean).join(' · ')}</small></div></div>})}
    <p className="known">{tl("Opening a resource only shows it was opened, not that it was understood.")}</p>
    <h3 className="sec">{tl("Before and after")}</h3><div className="qbox"><IvCompare c={x.comparison}/><small className="known" style={{display:'block',marginTop:4}}>{tl("Same topics, before the plan and since. This doesn't show the plan caused the change.")}</small></div>
    {x.assigned_at&&<><h3 className="sec">{tl("Your review")}</h3><div className="filters fit" style={{flexWrap:'wrap'}}>{Object.entries(IV_OUT).map(([k,l])=><button key={k} className={'chip'+(out===k?' on':'')} onClick={()=>setOut(k)}>{tl(l)}</button>)}</div>
      <textarea rows={3} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} aria-label={tl("Note")} placeholder={tl("A note for yourself (optional)")}/>
      <button className="btn" disabled={busy||!out} onClick={save}>{tl("Save review")}</button>{x.reviewed_at&&<p className="known">{tl("Last reviewed {when}",{when:when(x.reviewed_at)})}</p>}</>}</div></>}
// what a student sees: the plan in supportive words, each activity one tap away; done ticks come from what they did, never from a box they tick
function MySupport({toast,openTopic,onSet,onQuiz}){
  const confirm=useConfirm(),[d,setD]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{api('/me/support').then(r=>setD(r.items)).catch(()=>{})},[])
  if(!d?.length)return null
  const go=async(p,a)=>{if(a.kind==='test')return onQuiz(a.ref_id);if(a.kind==='revise')return openTopic(a.topic_id,'revise')
    if(a.kind==='mcq'){setBusy(true);const run=source=>api('/mcq/attempts',{method:'POST',body:{mode:'topic',source,size:a.size||10,topic_id:a.topic_id,request_id:rid()}})
      try{onSet((await run('bank')).id)}catch(e){if(e.status!==409)toast(e.message);else if(await confirm({title:tl("Not enough bank questions here"),body:tl("Make a new AI set instead? It counts toward your MCQ sets."),ok:tl("A new AI set")})){try{onSet((await run('ai')).id)}catch(e2){toast(e2.message)}}}
      setBusy(false);return}
    openTopic(a.topic_id||p.topics[0]?.id)}
  return <>{d.map(p=><div key={p.id} className="qbox welcome"><b>{tl("Extra practice from your teacher")}</b>
    <p style={{margin:'4px 0'}}>{p.title}<small className="known" style={{display:'block'}}>{p.course}{p.target?' · '+tl("aim to finish by {date}",{date:ivShow(p.target)}):''} · {tl("{a} of {n} done",{a:p.done,n:p.required})}</small></p>
    {p.description&&<p className="known" style={{whiteSpace:'pre-wrap',margin:'4px 0'}}>{p.description}</p>}
    {p.activities.map(a=><button key={a.id} className="row rowbtn" disabled={busy} onClick={()=>go(p,a)}><div>{a.state==='done'?<Check size={15}/>:null}{" "}{ivAct(a)}<small>{[a.state==='done'?tl("Done"):a.state==='started'?tl("Started"):'',!a.required&&tl("Optional")].filter(Boolean).join(' · ')}</small></div><ChevronRight size={18}/></button>)}</div>)}</>}
// ---- teacher resources (S43): material a course's teacher adds to the course, a unit or a topic. Students see the published ones inside the topic;
// ---- documents and videos come through a signed-in download, never a bare link
export const RES_KIND={note:'Note',example:'Worked example',image:'Image',document:'Document',video:'Video',link:'Link'}
const RES_LEVEL={topic:'This topic',unit:'This unit',course:'This course'}
function ResFile({f,toast}){
  const [src,setSrc]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>()=>{if(src)URL.revokeObjectURL(src)},[src])
  const load=async()=>{setBusy(true);try{const r=await fetch(ROOT+'/api'+f.url,{headers:{Authorization:'Bearer '+localStorage.t}});if(!r.ok)throw new Error(tl("This file is no longer available"))
    const u=URL.createObjectURL(await r.blob());if(f.video)setSrc(u);else{const a=document.createElement('a');a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}}catch(e){toast(e.message)}setBusy(false)}
  if(f.video&&src)return <video className="resvideo" src={src} controls playsInline/>
  return <button className="msgfile" style={{width:'100%'}} disabled={busy} onClick={load}>{f.video?<Play size={18}/>:<FileText size={18}/>}<span>{f.name}</span><small>{busy?tl("Loading…"):f.video?tl("Play"):tl("Download")}</small></button>}
export function ResBody({r,toast,onUnclear}){
  return <>{r.description&&<p className="known" style={{margin:'4px 0'}}>{r.description}</p>}
    {(r.kind==='note'||r.kind==='example')&&<><div className="prose"><Md>{r.body}</Md></div>{onUnclear&&<button className="link" onClick={onUnclear}>{tl("Not clear? Ask about a phrase")}</button>}</>}
    {r.kind==='image'&&r.image&&<a href={at(r.image)} target="_blank" rel="noreferrer"><img className="msgimg" src={at(r.image)} alt={r.title} loading="lazy"/></a>}
    {r.url&&(r.kind==='video'?<VideoCards text={r.url}/>:null)}{r.url&&(r.kind==='link'||(r.kind==='video'&&!(r.url.match(VIDEO_RE)||[]).length))&&<a className="msgfile" href={r.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={18}/><span>{r.url.replace(/^https:\/\//,'').slice(0,60)}</span><small>{tl("Open")}</small></a>}
    {r.file&&<ResFile f={r.file} toast={toast}/>}</>}
function TopicResources({t,toast}){
  const [d,setD]=useState(null),[open,setOpen]=useState({}),[ask,setAsk]=useState(null),[phrase,setPhrase]=useState('')
  useEffect(()=>{api(`/topics/${t.id}/resources`).then(r=>setD(r.items)).catch(()=>setD([]))},[t.id])
  if(!d?.length)return null
  return <><h3 className="sec">{tl("Teacher resources")}</h3>{d.map(r=><div key={r.id} className="qbox">
    <button className="hit" style={{width:'100%',textAlign:'start'}} onClick={()=>{if(!open[r.id])api(`/resources/${r.id}/opened`,{method:'POST'}).catch(()=>{});setOpen(o=>({...o,[r.id]:!o[r.id]}))}} aria-expanded={!!open[r.id]}><b>{r.title}</b><small className="known" style={{display:'block'}}>{[tl(RES_KIND[r.kind]),tl(RES_LEVEL[r.level]),r.status==='draft'&&tl("Draft: students can't see it")].filter(Boolean).join(' · ')}</small></button>
    {open[r.id]&&<ResBody r={r} toast={toast} onUnclear={t.published!==false?()=>{setAsk(r);setPhrase('')}:null}/>}</div>)}
    {ask&&<Sheet close={()=>setAsk(null)}><h3>{tl("Not clear?")}</h3><p className="known">{tl("Copy or type the words from “{title}” that you don't follow.",{title:ask.title})}</p>
      <input value={phrase} maxLength={120} onChange={e=>setPhrase(e.target.value)} aria-label={tl("The phrase")}/>
      {phrase.trim().length>=2&&<DoubtBox key={phrase} tid={t.id} askState={t.ask} phrase={phrase.trim()} close={()=>setAsk(null)} toast={toast}/>}</Sheet>}</>}
// under a topic: questions the teacher shared with the class, each with its answers; who asked is never shown
function ClassQuestions({tid}){
  const [d,setD]=useState(null),[open,setOpen]=useState({})
  useEffect(()=>{api(`/topics/${tid}/class-questions`).then(setD).catch(()=>setD({items:[]}))},[tid])
  if(!d?.items.length)return null
  return <><h3 className="sec">{tl("Questions from your class")}</h3>{d.items.map(x=>{const [first,...rest]=x.messages,on=open[x.id]
    return <div key={x.id} className="qbox classq"><small className="steplab">{x.mine?tl("Your question"):tl("A student asked")}</small>
      {x.excerpt&&<p className="hltext" style={{margin:'4px 0 8px'}}>“{x.excerpt}”</p>}{first&&<MsgBody m={first}/>}
      {on?<div className="thread">{rest.map(m=><div key={m.id} className={'msg'+(m.teacher?' teach':'')}><small>{m.teacher?m.who:tl("A student")}</small><MsgBody m={m}/></div>)}</div>
        :<button className="link" onClick={()=>setOpen(o=>({...o,[x.id]:true}))}>{tl(rest.length===1?"Show the answer":"Show the {n} replies",{n:rest.length})}</button>}</div>})}</>}
// a student's questions to their teachers, newest first; answered ones they haven't read are marked
function MyQuestions({toast}){
  const [d,setD]=useState(null),[open,setOpen]=useState(null)
  useEffect(()=>{if(!open)api('/me/questions').then(setD).catch(e=>toast(e.message))},[open])
  if(open)return <QuestionThread id={open} back={()=>setOpen(null)} toast={toast}/>
  return <><Bar title={tl("My questions")} sub={d?pl(d.items.length,'question'):''}/><div className="main">
    {!d?<Skeleton/>:!d.items.length?<p className="known">{tl("No questions yet. On any topic, tap Ask my teacher, or choose it under Not clear? on a phrase you highlighted.")}</p>
      :<Paged rows={d.items} render={x=><QRow key={x.id} x={x} onOpen={()=>setOpen(x.id)}/>}/>}</div></>}
const QRow=({x,onOpen,teacher})=><button className="card ward" onClick={onOpen}><span className="wtop"><b>{x.topic}</b>{x.unread?<span className="chip">{tl("New answer")}</span>:<QChip s={x.status} teacher={teacher} label={x.label}/>}</span>
  <span className="known">{[x.course,x.student,!teacher&&x.at&&day(x.at.slice(0,10))].filter(Boolean).join(' · ')}</span><span style={{display:'block',marginTop:4,overflowWrap:'anywhere'}}>{x.last}</span></button>
// ---- announcements and classes: a teacher posts a note to a course, or schedules a class with a video link (Google Meet, Zoom). Students and
// ---- parents read them here and join a class from here; a class is also in their calendars, and they are told by email, in the bell and on the phone
export const classWhen=x=>x.starts_at?new Date(x.starts_at).toLocaleString(locale(),{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})+' · '+tl("{n} min",{n:x.minutes}):''
export const joinClass=x=>api(`/announcements/${x}/join`,{method:'POST'}).catch(()=>{})  // counted for the teacher; the link opens as usual
// ---- a topic's marked model answer: the teacher writes the exam question and the answer in parts, each with its marks; students see it first under Sample answer
function ModelAnswer({t,canEdit,toast,onSaved}){
  const m=t.model_answer,[ed,setEd]=useState(null),[busy,setBusy]=useState(false),confirm=useConfirm()
  const start=()=>setEd(m?{question:m.question,parts:m.parts.map(p=>({...p,marks:String(p.marks)}))}:{question:'',parts:[{text:'',marks:'2'},{text:'',marks:'3'}]})
  const save=async()=>{setBusy(true);try{const r=await api(`/topics/${t.id}/model-answer`,{method:'PUT',body:{question:ed.question,parts:ed.parts.map(p=>({text:p.text,marks:Number(p.marks)||0}))}});onSaved(r);setEd(null);toast(tl("Saved"))}catch(e){toast(srv(e.message))}setBusy(false)}
  const drop=async()=>{if(!await confirm({title:tl("Remove the model answer?"),ok:tl("Remove"),danger:true}))return;try{await api(`/topics/${t.id}/model-answer`,{method:'DELETE'});onSaved(null);setEd(null)}catch(e){toast(srv(e.message))}}
  const setP=(i,k,v)=>setEd({...ed,parts:ed.parts.map((p,j)=>j===i?{...p,[k]:v}:p)})
  if(ed)return <div className="qbox"><h4 style={{marginTop:0}}>{tl("Your model answer, with marks")}</h4>
    <label htmlFor="maq">{tl("Exam question")}</label><textarea id="maq" rows={2} maxLength={500} value={ed.question} onChange={e=>setEd({...ed,question:e.target.value})} placeholder={tl("Explain temporary and permanent hardness. (5 marks)")}/>
    {ed.parts.map((p,i)=><div key={i} className="mapart"><div style={{flex:1}}><label htmlFor={'map'+i}>{tl("Part {n}",{n:i+1})}</label><textarea id={'map'+i} rows={3} maxLength={2000} value={p.text} onChange={e=>setP(i,'text',e.target.value)} placeholder={i===0?tl("Definition: hardness is…"):''}/></div>
      <div style={{width:90}}><label htmlFor={'mam'+i}>{tl("Marks")}</label><input id={'mam'+i} type="number" min={0.5} step={0.5} value={p.marks} onChange={e=>setP(i,'marks',e.target.value)}/></div>
      <button className="tool" aria-label={tl("Remove this part")} onClick={()=>setEd({...ed,parts:ed.parts.filter((_,j)=>j!==i)})}><Trash2 size={16}/></button></div>)}
    {ed.parts.length<12&&<button className="btn ghost" onClick={()=>setEd({...ed,parts:[...ed.parts,{text:'',marks:'1'}]})}><Plus size={16}/>{" "}{tl("Add a part")}</button>}
    <p className="known">{tl("Total: {n} marks",{n:ed.parts.reduce((a,p)=>a+(Number(p.marks)||0),0)})}</p>
    <button className="btn" disabled={busy} onClick={save}>{tl("Save")}</button>{m&&<button className="btn ghost danger" onClick={drop}>{tl("Remove")}</button>}<button className="btn ghost" onClick={()=>setEd(null)}>{tl("Cancel")}</button></div>
  if(!m)return canEdit?<button className="btn ghost" onClick={start}><Plus size={16}/>{" "}{tl("Add your model answer, with marks for each part")}</button>:null
  return <div className="qbox modelans"><small className="steplab">{tl("Model answer from your teacher")}{m.by?' · '+m.by:''}</small>
    <div className="prose flat"><Md>{m.question}</Md></div>
    <div className="markparts">{m.parts.map((p,i)=><div key={i} className="mrow"><div className="prose flat">{<Md>{p.text}</Md>}</div><b className="mk">{tl(p.marks===1?"1 mark":"{n} marks",{n:p.marks})}</b></div>)}
      <div className="mrow tot"><b>{tl("Total")}</b><b className="mk">{tl("{n} marks",{n:m.total})}</b></div></div>
    {canEdit&&<button className="link" onClick={start}><Pencil size={14}/> {tl("Edit")}</button>}</div>}
// ---- courses a teacher offers: faculty, admins and school teachers run a course of their own, seen only by the students on its list.
// ---- Students are invited (48 hours to accept), ask to join (the teacher has 48 hours to decide), or join at once when it is open to anyone
const OFFER_STATE={upcoming:['Starts soon','var(--acct)'],running:['Running','var(--ok)'],paused:['Paused','var(--warn)'],ended:['Ended','var(--mut)'],cancelled:['Cancelled','var(--bad)'],archived:['Archived','var(--mut)']}
export const offerDates=c=>c.starts_on||c.ends_on?[c.starts_on&&tl("from {date}",{date:day(c.starts_on)}),c.ends_on&&tl("to {date}",{date:day(c.ends_on)})].filter(Boolean).join(' '):tl("No fixed dates")
export const hoursLeft=iso=>{const h=Math.max(0,Math.round((new Date(iso)-Date.now())/36e5));return h<1?tl("less than an hour left"):tl(h===1?"1 hour left":"{n} hours left",{n:h})}
export const OfferChip=({c})=>{const [l,col]=OFFER_STATE[c.state]||[];return l?<span className="chip" style={{color:col,margin:0}}>{tl(l)}</span>:null}
// ---- for students: courses they are invited to (accept within 48 hours), and courses they can join or ask to join
const joinable=c=>c.access==='open'||c.applications  // an invitation-only course can't be joined or asked for: only a new invitation brings them in
const toldNote=c=>({lapsed_request:"Your last request lapsed because your teacher didn't answer within 48 hours. You can ask again.",decline:"Your teacher couldn't take you last time. You can ask again.",
  lapsed_invite:joinable(c)?"Your invitation lapsed after 48 hours. You can still ask to join.":"Your invitation lapsed after 48 hours. This course is by invitation only, so ask your teacher for a new one.",
  declined_by_me:joinable(c)?"You declined the invitation. You can still ask to join.":"You declined the invitation. This course is by invitation only, so ask your teacher if you change your mind."})[c.told]  // why a course they were waiting on is in the list
function JoinPage({toast,openCourse,onStudy}){
  const confirm=useConfirm(),[d,setD]=useState(null),[busy,setBusy]=useState(0)
  const load=()=>api('/offered/catalog').then(setD).catch(e=>toast(e.message));useEffect(()=>{load()},[])
  const join=async c=>{setBusy(c.id);try{const r=await api(`/offered/${c.id}/join`,{method:'POST'});toast(r.mine==='active'?tl("You're in. It is in your courses."):tl("Asked. Your teacher has 48 hours to decide."));load()}catch(e){toast(srv(e.message))}setBusy(0)}
  const answer=async(c,action)=>{setBusy(c.id);try{await api('/enrolments/'+c.enrolment,{method:'POST',body:{action}});toast(action==='accept'?tl("You're in. It is in your courses."):tl("Declined"));load()}catch(e){toast(srv(e.message))}setBusy(0)}
  const withdraw=async c=>{setBusy(c.id);try{await api('/enrolments/'+c.enrolment,{method:'POST',body:{action:'withdraw'}});toast(tl("Request withdrawn"));load()}catch(e){toast(srv(e.message))}setBusy(0)}
  const leave=async c=>{if(!await confirm({title:tl("Leave {course}?",{course:c.name}),body:tl("It goes from your courses. Your work so far is kept; you can ask to join again later."),ok:tl("Leave"),danger:true}))return
    setBusy(c.id);try{await api('/enrolments/'+c.enrolment,{method:'POST',body:{action:'leave'}});toast(tl("You have left the course"));load()}catch(e){toast(srv(e.message))}setBusy(0)}
  const ON=['active','completed','suspended','applied'],isMine=x=>ON.includes(x.mine)||(!joinable(x)&&!!x.told),mine=d?d.items.filter(isMine):[],others=d?d.items.filter(x=>x.mine!=='invited'&&!isMine(x)):[]  // an invitation-only course they declined or let lapse sits with their own: it can't be joined  // the courses they are on (or asked for) apart from the ones they could join
  const card=c=><div key={c.id} className="qbox"><div className="wtop" style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{c.name}</b><OfferChip c={c}/></div>
        <small className="known" style={{display:'block'}}>{c.teacher} · {offerDates(c)} · {pl(c.topics,'topic')}</small>{c.about&&<div className="prose flat"><Md>{c.about}</Md></div>}
        {(c.mine==='active'||c.mine==='completed')&&c.state==='paused'&&<p className="known">{tl("This course is paused for now. Your place is kept, and your teacher will reopen it.")}</p>}
        {c.mine==='active'||c.mine==='completed'?<div className="two">{c.state!=='paused'&&<button className="btn ghost" onClick={()=>openCourse(c.id)}>{tl("Open")}</button>}{c.mine==='active'&&<button className="btn ghost" disabled={busy===c.id} onClick={()=>leave(c)}>{tl("Leave the course")}</button>}</div>
          :c.mine==='applied'?<>{c.state==='paused'&&<p className="known">{tl("This course is paused for now. Your request stays open and your teacher can still answer it.")}</p>}<p className="known">{tl("You asked to join. Your teacher has 48 hours to decide.")}{c.expires_at?' ('+hoursLeft(c.expires_at)+')':''} {tl("If they don't answer in time, the request lapses and you can ask again.")}</p>
            <button className="btn ghost" disabled={busy===c.id} onClick={()=>withdraw(c)}>{tl("Withdraw my request")}</button></>
          :c.mine==='suspended'?<p className="known">{tl("Your place is on hold. Ask your teacher.")}</p>
          :<>{toldNote(c)&&<p className="known">{tl(toldNote(c))}</p>}{joinable(c)&&<button className="btn" disabled={busy===c.id} onClick={()=>join(c)}>{c.access==='open'?tl("Join"):tl("Ask to join")}</button>}</>}</div>
  return <><Bar title={tl("Join a course")}/><div className="main">
    {!d?<Skeleton/>:<>{d.invited.length>0&&<><h3 className="sec first">{tl("You're invited")}</h3>{d.invited.map(c=><div key={c.id} className="qbox"><b>{c.name}</b><small className="known" style={{display:'block'}}>{c.teacher} · {offerDates(c)} · {hoursLeft(c.expires_at)}</small>
        {c.about&&<div className="prose flat"><Md>{c.about}</Md></div>}{c.state==='paused'&&<p className="known">{tl("This course is paused for now. If you accept, you can open it once your teacher reopens it.")}</p>}<div className="two"><button className="btn" disabled={busy===c.id} onClick={()=>answer(c,'accept')}>{tl("Accept")}</button><button className="btn ghost" disabled={busy===c.id} onClick={()=>answer(c,'decline')}>{tl("Decline")}</button></div></div>)}</>}
      {mine.length>0&&<><h3 className={'sec'+(d.invited.length?'':' first')}>{tl("Your offered courses")}</h3><Paged rows={mine} render={card}/></>}
      <h3 className={'sec'+(d.invited.length||mine.length?'':' first')}>{tl("Courses you can join")}</h3>
      {!others.length?<><p className="known">{tl("No courses are open to join right now. You can ask your teacher for an invitation, or start learning now by building a course from your own notes.")}</p>
        {onStudy&&<div className="card"><button className="hit" onClick={onStudy}><span className="dot" style={{background:'var(--acc)'}}><Upload size={18}/></span><div><b>{tl("Build a course from your own notes")}</b><span>{tl("Upload a PDF or Word file and study it with quick checks, quizzes and reviews")}</span></div><ChevronRight size={18}/></button></div>}</>
        :<Paged rows={others} render={card}/>}</>}</div></>}
// ---- assigned tests: a teacher gives one student or a group a course quiz or an MCQ set, due by a date and time, with 1, 2, 3 or unlimited
// ---- attempts; the best attempt before the due time counts. Due times are the students' clock, written "2026-11-05T17:00".
export const dueText=v=>v?day(v.slice(0,10))+' '+v.slice(11,16):''
const ASG_STATE={done:['Done','var(--ok)'],late:['Late','var(--warn)'],missed:['Missed','var(--bad)'],to_do:['To do','var(--mut)'],upcoming:['Upcoming','var(--mut)']}
export const COUNT_LABEL=L({best:'The best attempt counts',latest:'The latest attempt counts',first:'The first attempt counts'})
export const StateChip=({x})=>{const [l,c]=ASG_STATE[x.status]||ASG_STATE.to_do;return <span className="chip" style={{color:c}}>{tl(l)}{x.status==='done'&&x.best!=null?' · '+x.best+'%':x.status==='late'&&x.late_best!=null?' · '+x.late_best+'%':''}</span>}
// a student's assigned tests: still to do first (soonest due), then the rest; quizzes open here, MCQ sets start from the assignment
function AssignedToMe({toast}){
  const [d,setD]=useState(null),[quiz,setQuiz]=useState(null),[set,setSet]=useState(null),[busy,setBusy]=useState(null)
  const load=()=>api('/me/assignments').then(setD).catch(e=>toast(e.message));useEffect(()=>{if(!quiz&&!set)load()},[quiz,set])
  if(quiz)return <QuizPlay id={quiz} back={()=>setQuiz(null)} toast={toast} role="student"/>
  if(set)return <McqPlay id={set} back={()=>setSet(null)} toast={toast}/>
  const open=async x=>{if(x.kind==='quiz')return setQuiz(x.quiz_id);setBusy(x.id);try{setSet((await api(`/assignments/${x.id}/start`,{method:'POST',body:{request_id:'a'+x.id+'-'+Date.now()}})).id)}catch(e){toast(e.message)}setBusy(null)}
  return <><Bar title={tl("Assigned to me")}/><div className="main">
    {!d&&<Skeleton rows={2}/>}{d&&!d.items.length&&<p className="known">{tl("Nothing assigned to you right now.")}</p>}
    {d?.items.map(x=>{const can=x.status!=='upcoming'&&(x.left!==0||x.status!=='to_do')
      return <div key={x.id} className="card ward"><span className="wtop"><b>{x.title}</b><StateChip x={x}/></span>
        <small className="known">{x.course}{x.by?' · '+tl("from {name}",{name:x.by}):''}</small>
        <small className="known">{x.status==='upcoming'&&tl("opens {when}",{when:dueText(x.opens)})+' · '}{tl("due {when}",{when:dueText(x.due)})} · {x.left==null?tl("Unlimited attempts"):tl("Attempts left: {n}",{n:x.left})} · {COUNT_LABEL[x.counts||'best']}</small>
        {x.instructions&&<p className="known" style={{whiteSpace:'pre-wrap',margin:'6px 0 0'}}>{x.instructions}</p>}
        {can&&<button className="btn ghost" disabled={busy===x.id} onClick={()=>open(x)}>{x.status==='to_do'?tl("Start"):tl("Try again")}</button>}</div>})}</div></>}
// a student's Home, made for a phone: what to do next (most useful first, one button each), then this week at a glance
const DO_LABEL={assignment:'Open',topic:'Open',quiz:'Take the quiz',progress:'See weak topics',calendar:'Open calendar',mcq:'Practise',plan:'See my plan',courses:'My courses'}
function DoNext({d:d0,openTopic,onOpen,onGo,onCalendar,session}){  // with a routine, today's session already lists the topics: then only the other signals
  const d={...d0,items:session?d0.items.filter(x=>!x.key.startsWith('focus_')):d0.items}
  const run=x=>{const t=x.target||{};if(x.action==='topic'&&t.topic_id)return openTopic(t.topic_id);if(x.action==='quiz'&&t.nav)return onOpen(t.nav)
    if(x.action==='calendar')return onCalendar();onGo({progress:'progress',mcq:'mcq',plan:'profile',courses:'learn',assignment:'assigned'}[x.action]||'learn')}
  if(!d.items.length)return null
  return <><h3 className="sec first">{tl("Do next")}</h3>{d.items.map((x,i)=><div key={x.key+i} className={'card dash '+x.level}><span className="dot" aria-hidden="true"/>
    <div style={{flex:1}}><b>{x.title||tl(x.text,{...x.vars,...(x.vars.date?{date:day(x.vars.date)}:{}),...(x.vars.due?{due:dueText(x.vars.due)}:{})})}</b>{x.title&&<small className="known">{srv(x.text)}{x.course?' · '+x.course:''}</small>}</div>
    <button className="btn ghost" onClick={()=>run(x)}>{tl(DO_LABEL[x.action]||'Open')}</button></div>)}</>}
function ThisWeek({d,onGo}){
  const days=[...Array(7)].map((_,i)=>{const t=new Date();t.setDate(t.getDate()-6+i);return t.toLocaleDateString(getLang(),{weekday:'narrow'})})
  return <button className="card ward" onClick={()=>onGo('progress')} aria-label={tl("My progress")}>
    <span className="wtop"><b>{tl("This week")}</b>{d.streak>0&&<span className="chip">{tl("{n}-day streak",{n:d.streak})}</span>}</span>
    <span className="wweek" aria-label={tl("Studied on {n} of the last 7 days",{n:d.week.filter(Boolean).length})}>{d.week.map((on,i)=><span key={i} className={on?'on':''} aria-hidden="true">{days[i]}</span>)}</span>
    <small className="known">{tl("Topics learned this week: {n}",{n:d.completed_this_week})} · {tl("{p}% of your topics learned",{p:d.percent})}</small></button>}
function Dashboard({user,toast,onOpen,onStudy,onRoutine,onCalendar,onGo}){
  const unplaced=user.self_registered&&!user.placed,[sme,setSme]=useState(null);useEffect(()=>{api('/study/me').then(setSme).catch(()=>{})},[])
  const [tree,setTree]=useState(null),[today,setToday]=useState(null),[topic,setTopic]=useState(null),[sess,setSess]=useState(null)
  const [dd,setDd]=useState(null),[mset,setMset]=useState(null),[ttab,setTtab]=useState(null),[qz,setQz]=useState(null)
  useEffect(()=>{if(topic)return;api('/tree').then(setTree).catch(e=>toast(e.message));api('/me/today').then(setToday).catch(()=>{});api('/me/dashboard').then(setDd).catch(()=>{})},[topic,toast])
  if(topic)return <Topic id={topic} tab0={ttab} back={()=>{setTopic(null);setTtab(null)}} toast={toast} role={user.role}/>
  if(qz)return <QuizPlay id={qz} back={()=>setQz(null)} toast={toast} role={user.role}/>
  if(mset)return <McqPlay id={mset} back={()=>setMset(null)} toast={toast} openTopic={x=>{setMset(null);setTopic(x)}}/>
  const hour=new Date().getHours(),hi=hour<12?'Good morning, {name}':hour<17?'Good afternoon, {name}':'Good evening, {name}'
  const seen=new Map(),courses=[]
  for(const p of tree||[])for(const s of p.semesters)for(const c of s.courses){const at=seen.get(c.id),item={p,s,c,topics:c.units.flatMap(un=>un.topics.map(t=>({...t,unit:un})))}
    if(at===undefined){seen.set(c.id,courses.length);courses.push(item)}else if(courses[at].c.archived&&!c.archived)courses[at]=item}  // a course shown twice counts once, and a live place wins over an archived one
  const resume=(today?.focus||[]).filter(f=>f.kind==='resume').sort((a,b)=>(b.last_read||'').localeCompare(a.last_read||''))[0]||(today?.focus||[]).find(f=>f.kind==='next')
  return <><Bar title={tl(hi,{name:firstName(user.name)})}/><div className="main">
    <Invitations/><CourseInvites onGo={onGo}/>
    {user.role==='student'&&<WelcomeBack openTopic={setTopic} toast={toast} onSet={setMset}/>}
    {user.role==='student'&&<MySupport toast={toast} openTopic={(id,tab)=>{setTtab(tab||null);setTopic(id)}} onSet={setMset} onQuiz={setQz}/>}
    <SessionCard toast={toast} onRoutine={onRoutine} openTopic={setTopic} onStudy={onStudy} refresh={topic} onLoad={setSess}/>
    {dd&&<DoNext d={dd} openTopic={setTopic} onOpen={onOpen} onGo={onGo} onCalendar={onCalendar} session={!!sess?.routine}/>}
    {dd&&<ThisWeek d={dd} onGo={onGo}/>}
    {!dd&&!sess?.routine&&resume&&<div className="card"><button className="hit" onClick={()=>setTopic(resume.topic_id)}><span className="dot" style={{background:'var(--acc)'}}><Play size={18}/></span><div><b>{resume.title}</b><span>{resume.kind==='resume'?tl("Where you left off"):tl("Up next, if you like")} · {resume.course}</span></div><ChevronRight size={18}/></button></div>}
    <RecallCard open={setTopic}/>
    <ComingUp onAll={onCalendar}/>
    {sme&&sme.courses>0&&<><h3 className="sec">{tl("Your own courses")}</h3><LearnCard me={sme} compact onContinue={n=>onStudy({id:n.course_id,topic:n.topic_id})} onReview={cid=>onStudy({review:cid})}/></>}
    {sme&&!sme.courses&&tree&&!courses.length&&!unplaced&&<div className="card"><button className="hit" onClick={()=>onStudy(null)}><span className="dot" style={{background:'var(--acc)'}}><Upload size={18}/></span><div><b>{tl("Build a course from your own notes")}</b><span>{tl("Upload a PDF or Word file and study it with quick checks, quizzes and reviews")}</span></div><ChevronRight size={18}/></button></div>}
    {!tree&&<><div className="sk"/><div className="sk"/></>}
    {tree&&!courses.length&&unplaced&&<><h3 className="sec">{tl("Your account is ready")}</h3>  {/* placement is the admin's; two ways in meanwhile */}
      <p className="known" style={{marginTop:0}}>{user.level==='school'?tl("Your institution's admin will assign your program and grade. Your institution's courses will appear here after that."):tl("Your institution's admin will assign your program and semester or year. Your institution's courses will appear here after that.")}</p>
      <p style={{margin:'4px 0 8px'}}><b>{tl("You don't have to wait to start learning.")}</b></p>
      <div className="card"><button className="hit" onClick={()=>onStudy(null)}><span className="dot" style={{background:'var(--acc)'}}><Upload size={18}/></span><div><b>{tl("Build a course from your own notes")}</b><span>{tl("Upload a PDF or Word file and study it with quick checks, quizzes and reviews")}</span></div><ChevronRight size={18}/></button></div>
      <div className="card"><button className="hit" onClick={()=>onGo('join')}><span className="dot" style={{background:'var(--acc)'}}><Plus size={18}/></span><div><b>{tl("Join a course offered by a teacher")}</b><span>{tl("Open courses, courses you can ask to join, and invitations")}</span></div><ChevronRight size={18}/></button></div></>}
    {tree&&!courses.length&&!unplaced&&<p className="known">{tl("You are not enrolled in a course yet. Ask your admin to add you to one.")}</p>}
    {courses.length>0&&<><h3 className="sec">{tl("My courses")}</h3><Paged rows={courses} render={({p,s,c,topics},i)=>{const done=topics.filter(t=>t.status==='completed').length,opened=topics.filter(t=>t.status!=='not_started').length
      if(c.archived)return <div key={c.id} className="card" style={{opacity:.7}}><button className="hit" onClick={()=>toast(tl("This course is unavailable right now"))} aria-label={tl("{name}, unavailable right now",{name:c.name})}><span className="dot" style={{background:'var(--mut)'}}><Lock size={18}/></span><div><b>{c.name}</b><span>{tl("Unavailable right now")}</span></div></button></div>
      return <div key={c.id} className="card"><button className="hit" onClick={()=>onOpen([p.id,s.id,c.id])}><span className="dot" style={{background:COL[i%5]}}>{c.name[0]}</span><div><b>{c.name}</b><span>{pl(topics.length,'topic')}{opened?' · '+tl("{n} opened",{n:opened}):''}{done?' · '+tl("{n} learned",{n:done}):''}</span></div><ChevronRight size={18}/></button></div>}}/></>}
  </div></>}
// "Remember this?": one curious question from something read a few days ago, answered with a tap, easy to ignore (hidden for the day once dismissed)
function RecallCard({open}){
  const today=new Date().toDateString(),[d,setD]=useState(null),[off,setOff]=useState(()=>{try{return localStorage.recallOff===today}catch{return false}})
  useEffect(()=>{if(!off)api('/me/recall').then(r=>setD(r.item)).catch(()=>{})},[off])
  if(off||!d)return null
  const hide=()=>{try{localStorage.recallOff=today}catch{/* a private window: it just shows again next time */}setOff(true)}
  return <div className="recall"><div className="recallh"><small>{tl("Remember this?")}</small><button className="ic sm" aria-label={tl("Not now")} title={tl("Not now")} onClick={hide}><X size={15}/></button></div>
    <p className="recallq">{d.question}</p>
    <Reveal label={tl("Think, then tap for the answer")}><Md>{d.answer}</Md><button className="link" onClick={()=>open(d.topic_id)}>{tl("Open {title}",{title:d.title})}</button></Reveal></div>}
export const WD=[0,1,2,3,4,5,6],wd=i=>new Date(2024,0,1+i).toLocaleDateString(locale(),{weekday:'short'})  // Monday first; 1 Jan 2024 was a Monday. Names in the reader's language
const nextStudyDay=n=>!n?'':n.in===1?tl('tomorrow'):wd(n.weekday)  // worked out by the server, which counts days the way the students' college does
// a short knowledge check on one topic: five bank questions, or (if the bank is short and they agree) a new AI set
const topicCheck=async(topic_id,confirm,toast)=>{const go=source=>api('/mcq/attempts',{method:'POST',body:{mode:'topic',source,size:5,topic_id,request_id:rid()}})
  try{return (await go('bank')).id}catch(e){if(e.status!==409){toast(e.message)}else if(await confirm({title:tl("Not enough bank questions here"),body:tl("Make a new AI set for this check instead? It counts toward your MCQ sets."),ok:tl("A new AI set")})){try{return (await go('ai')).id}catch(e2){toast(e2.message)}}}
  return null}
// back after a break (S39): a short summary and a choice of where to start. Nothing is reset; the student picks, or just closes it
const PATH_LABEL={resume:"Pick up where you left off",revise:"Revise what was hard",check:"A short knowledge check",next:"Go on to the next topic"}
function WelcomeBack({openTopic,toast,onSet}){
  const confirm=useConfirm(),[w,setW]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{api('/me/welcome').then(setW).catch(()=>{})},[])
  if(!w?.show)return null
  const act=async what=>{setBusy(true);try{const r=await api('/me/welcome',{method:'POST',body:{what}});setW(r);if(what==='spread')toast(r.spread===1?tl("1 topic moved to the coming week"):tl("{n} topics moved to the coming week",{n:r.spread}))}catch(e){toast(e.message)}setBusy(false)}
  const go=async p=>{if(p.key==='check'){setBusy(true);const id=await topicCheck(p.topic_id,confirm,toast);setBusy(false);if(id)onSet(id)}else openTopic(p.topic_id)}
  const a=w.assignments||{},rv=w.revision||{}
  return <div className="qbox welcome"><b>{tl("Welcome back")}</b>
    <p style={{margin:'4px 0'}}>{w.last?tl("Last time you were on {topic} in {course}.",{topic:w.last.topic,course:w.last.course}):tl("Good to see you again.")}{w.progress?' '+tl("You had {p}% of that course done, and it is all still there.",{p:w.progress.percent}):''}</p>
    {(a.open_count>0||a.closed?.length>0)&&<p className="known" style={{margin:'4px 0'}}>{[a.open_count>0&&(a.open_count===1?tl("1 assignment is open: {title}, due {due}",{title:a.open[0].title,due:a.open[0].due.replace('T',' ')}):tl("{n} assignments are open; the next is due {due}",{n:a.open_count,due:a.open[0].due.replace('T',' ')})),
      a.closed?.length>0&&(a.closed.length===1?tl("1 closed while you were away"):tl("{n} closed while you were away",{n:a.closed.length}))].filter(Boolean).join(' · ')}</p>}
    {rv.due>0&&<p className="known" style={{margin:'4px 0'}}>{rv.due===1?tl("1 topic is due for revision: {t}",{t:rv.top[0].title}):tl("{n} topics are due for revision. Start with {t}.",{n:rv.due,t:rv.top.map(x=>x.title).join(', ')})}{rv.due>3&&<>{" "}<button className="link" disabled={busy} onClick={()=>act('spread')}>{tl("Spread the rest over the coming week")}</button></>}</p>}
    {w.paths?.length>0&&<><p style={{margin:'8px 0 4px'}}>{tl("Where would you like to start?")}</p>
      {w.paths.map(p=><button key={p.key} className="row rowbtn" disabled={busy} onClick={()=>go(p)}><div>{tl(PATH_LABEL[p.key])}<small>{p.key==='revise'&&p.topics?.length>1?p.topics.map(x=>x.title+(x.percent!=null?' ('+x.percent+'%)':'')).join(', '):p.title}</small></div><ChevronRight size={18}/></button>)}</>}
    {w.easing&&<p className="known" style={{margin:'8px 0 4px'}}>{tl("For the next {n} days your session is shorter, with revision first.",{n:w.ease_days})}{" "}<button className="link" disabled={busy} onClick={()=>act('usual')}>{tl("Keep my usual plan")}</button></p>}
    <button className="btn ghost" disabled={busy} onClick={()=>act('hide')}>{tl("Close")}</button></div>}
function SessionCard({toast,onRoutine,openTopic,onStudy,refresh,onLoad}){  // today's one session, from the student's own routine
  const [v,setV]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{api('/me/session').then(x=>{setV(x);onLoad?.(x)}).catch(()=>{})},[refresh])
  if(!v)return null
  if(!v.routine)return null  // a routine is the student's own idea: it lives under My routine, never pushed on Home
  const open=x=>x.kind==='review'?onStudy({review:x.course_id}):x.src==='study'?onStudy({id:x.course_id,topic:x.id}):openTopic(x.id)
  const extra=async()=>{setBusy(true);try{const x=await api('/me/session',{method:'POST'});setV(x);onLoad?.(x)}catch(e){toast(e.message)}setBusy(false)}
  const r=v.routine,ss=v.session,left=ss?.items.filter(x=>!x.done)||[]
  return <div className="hero session"><div className="shead"><small>{tl("Today's session · {minutes} min",{minutes:r.minutes})}{r.at?' · '+r.at:''}</small><button className="schip" onClick={onRoutine} aria-label={tl("Change my routine")}><Clock size={14}/>{" "}{tl("Routine")}</button></div>
    {v.easing&&<p style={{margin:'6px 0 0'}}>{tl("A lighter session this week while you settle back in.")}</p>}
    {v.missed>=2&&!v.studied_today&&<p style={{margin:'6px 0 0'}}>{tl("Welcome back. Today is just one session, the same as always. No catching up needed.")}</p>}
    {!ss&&<><h2 style={{fontSize:22}}>{tl("Rest day")}</h2><p>{tl("Your next session is {nextStudyDay}.",{nextStudyDay:nextStudyDay(v.next_day)})}</p><button className="btn inv" disabled={busy} onClick={extra}>{tl("Study anyway")}</button></>}
    {ss&&ss.caught_up&&<><h2 style={{fontSize:22}}>{tl("All caught up")}</h2><p>{tl("Nothing is left to study right now. Well done.")}</p></>}
    {ss&&!ss.caught_up&&<>{ss.done?<h2 style={{fontSize:22}}><Check size={22}/>{" "}{tl("Done for today")}</h2>:<h2 style={{fontSize:22}}>{left.length}{" "}{tl("of {length} to go",{length:ss.items.length})}</h2>}
      <ul className="sitems">{ss.items.map((x,i)=><li key={i}><button className={'sitem'+(x.done?' done':'')} onClick={()=>open(x)}><span className="sx">{x.done?<Check size={16}/>:(x.kind==='review'||x.kind==='revise')?<RotateCcw size={16}/>:<Play size={16}/>}</span><span><b>{x.title}</b><small>{x.kind==='revise'?tl("Revise")+' · '+x.course:x.course}</small></span></button></li>)}</ul>
      {!ss.done&&<button className="btn inv" onClick={()=>open(left[0])}>{left.length===ss.items.length?tl("Start"):tl("Continue")}: {left[0].title}</button>}
      {ss.done&&<p>{tl("See you {nextStudyDay}.",{nextStudyDay:nextStudyDay(v.next_day)})}</p>}</>}
    <p className="splan">{v.plan.left?tl("{left} topics left · at this pace, done by {v}",{left:v.plan.left,v:new Date(v.plan.finish+'T00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'})}):tl("Nothing left in your courses")}{v.plan.late>0?tl(" · {late} would miss their deadline. {v}",{late:v.plan.late,v:v.plan.advice||''}):''}</p></div>}
function SearchPage({user,toast,initial}){
  const {aiOff}=useContext(Ctx)
  const [q,setQ]=useState(initial||''),[live,setLive]=useState(null),[asked,setAsked]=useState(''),[ai,setAi]=useState(null),[aiBusy,setAiBusy]=useState(false),[aiErr,setAiErr]=useState(''),[topic,setTopic]=useState(null),[pend,setPend]=useState(false)
  const typed=q.trim()
  useEffect(()=>{if(typed.length<2){setLive(null);return}const t=setTimeout(()=>api('/search?q='+encodeURIComponent(typed)).then(r=>setLive({...r,for:typed})).catch(()=>{}),300);return()=>clearTimeout(t)},[typed])
  const askAi=async(query,refresh)=>{setAiBusy(true);setAiErr('');try{setAi({...await api('/search/ai',{method:'POST',body:{q:query,refresh}}),for:query,fresh:refresh})}catch(e){setAiErr(e.message)}setAiBusy(false)}
  const submit=async()=>{if(typed.length<2)return;setPend(true);setAi(null);setAiErr('')
    try{const r=await api('/search?q='+encodeURIComponent(typed));setLive({...r,for:typed});setAsked(typed);setPend(false)
      if(!aiOff&&(!r.results.length||!r.confident))await askAi(typed,false)}catch(e){toast(e.message);setPend(false)}}  // nothing good in the app's own notes, so the AI answers
  useEffect(()=>{if(initial)submit()},[])  // once, for a search started from the header
  if(topic)return <Topic id={topic} back={()=>setTopic(null)} toast={toast} role={user.role}/>
  const res=asked&&live?.for===asked?live:null,aiNote=ai&&res&&res.results.length>0&&!res.confident
  return <><Bar title={tl("Search")} sub={aiOff?tl("Find a topic in your courses"):tl("Find a topic, or ask the AI")}/><div className="main">
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search topics")} autoFocus placeholder={tl("e.g. temporary hardness of water")} value={q} maxLength={200} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
    <button className="btn" disabled={pend||aiBusy||typed.length<2} onClick={submit}>{pend?tl("Searching…"):tl("Search")}</button>
    {!asked&&live&&live.results.length>0&&<><h3 className="sec">{tl("Topics in your courses")}</h3>{!aiOff&&<p className="known">{tl("Press Enter to search properly. If nothing here fits, the AI answers.")}</p>}{live.results.slice(0,5).map(x=><Hit key={x.id} x={x} open={setTopic}/>)}</>}
    {!asked&&live?.mine?.length>0&&<MineHits rows={live.mine} open={setTopic}/>}
    {!asked&&typed.length>=2&&live&&!live.results.length&&<p className="known">{aiOff?tl("Nothing in your courses matches yet."):tl("Nothing in your courses matches yet. Press Enter and the AI will answer instead.")}</p>}
    {res&&<>{res.results.length>0?<><h3 className="sec">{aiNote?tl("Possible matches in your courses"):tl("In your courses")}</h3>{<Paged rows={res.results} render={x=><Hit key={x.id} x={x} open={setTopic}/>}/>}</>
      :<p className="known" style={{marginTop:18}}>{tl("Nothing in your courses matches “{asked}”.",{asked:asked})}</p>}
      {res.mine?.length>0&&<MineHits rows={res.mine} open={setTopic}/>}
      {aiOff&&<p className="known">{tl("AI help is off. A parent or teacher can turn it on by adding their AI key to their account.")}</p>}{!aiOff&&!ai&&!aiBusy&&<button className="btn ghost" onClick={()=>askAi(asked,false)}><Sparkles size={16}/>{" "}{tl("Not what you wanted? Recheck with AI")}</button>}</>}
    {aiBusy&&<div className="qbox" aria-live="polite"><b>{tl("Asking the AI…")}</b><div className="sk"/></div>}
    {aiErr&&<div className="qbox" role="alert"><b>{tl("The AI could not answer")}</b><p className="known" style={{margin:'6px 0 0'}}>{aiErr}</p></div>}
    {ai&&!aiBusy&&<><h3 className="sec">{tl("AI answer")}</h3><div className="prose">{ai.cached&&<span className="chip">{tl("Saved answer · no tokens used")}</span>}<Md>{ai.text}</Md>{!ai.support&&<FlagLink source="search" id={ai.id} excerpt={ai.text}/>}</div>
      <p className="known">{tl("AI answers can contain mistakes. Check them against your notes and textbook.")}</p>
      <button className="btn ghost" disabled={aiBusy} onClick={()=>askAi(ai.for,true)}><Sparkles size={16}/>{" "}{tl("Not happy? Recheck with AI")}</button></>}</div></>}
// the student's own words that match: their notes under a topic and the notes on their highlights; only ever theirs, never sent to the AI
const MineHits=({rows,open})=><><h3 className="sec">{tl("Your notes")}</h3>{rows.map(x=><button key={x.topic_id+x.kind} className="hitrow" onClick={()=>open(x.topic_id)}>
  <b>{x.title}<span className="chip" style={{marginLeft:8}}>{x.kind==='highlight'?tl("Your highlight note"):tl("Your notes")}</span></b>{x.snippet&&<span className="snip">{x.snippet}</span>}</button>)}</>
function Hit({x,open}){return <button className="hitrow" onClick={()=>open(x.id)}><b>{x.title}{x.in_title&&<span className="chip" style={{marginLeft:8}}>{tl("Best match")}</span>}</b><small>{[x.program,x.semester,x.course,x.unit].filter(Boolean).join(' › ')}</small>{x.snippet&&<span className="snip">{x.snippet}</span>}</button>}

// My progress: a calm mirror, not a report card. What clicked and what is worth another look (from quizzes and tests, without percentages),
// the optional routine, test results folded away, and what the app has picked up about how they learn
const ACH_HINT={first_unit:"Mark every required topic of a unit as learned.",first_course:"Finish a course: every required topic learned, every test tried.",
  steady:"Revise in four different weeks (read a revision sheet, or check yourself on a topic you've learned).",improved:"Score 20 points more on a test than your first try.",hard_topic:"Pass a check (80%+) on a topic you once scored under 60% on."}
// who has finished a course, who is close, and what is outstanding (S36): for its teachers
function CyclePasses({d}){  // a student's passes through a course, side by side (S37)
  const c=d.compare
  return <div className="qbox"><b>{tl("Your passes through this course")}</b>
    {d.cycles.map(x=><div key={x.number} className="row"><div>{tl("Pass {n}",{n:x.number})}{x.current?' · '+tl("now"):''}<small>{[tl("Started {when}",{when:day(x.started_at.slice(0,10))}),
      x.completed_at?(x.days!=null?tl("finished in {n} days",{n:x.days}):tl("finished")):x.current?'':tl("not finished"),tl("{done} of {n} topics learned",{done:x.learned,n:x.topics_total}),
      x.average!=null&&tl("test average {n}%",{n:x.average}),x.unit_restarts.length>0&&tl("units restarted: {names}",{names:x.unit_restarts.map(r=>r.name).join(', ')})].filter(Boolean).join(' · ')}</small></div></div>)}
    {c&&(d.cycles[0].tests_total>0||c.improved.length>0||c.still_weak.length>0)&&<><p className="known">{tl("Pass {a} and pass {b}, on the same tests and topics:",{a:c.from,b:c.to})}</p>
      {c.tests.length?c.tests.map(q=><div key={q.id} className="row"><div>{q.title}<small>{q.before+'% → '+q.after+'%'}</small></div></div>):d.cycles[0].tests_total>0&&<p className="known">{tl("No test was tried in both passes yet, so scores can't be compared.")}</p>}
      {c.improved.length>0&&<p className="known">{tl("Weak before, strong now:")}{" "}<b>{c.improved.map(x=>x.title).join(', ')}</b></p>}
      {c.still_weak.length>0&&<p className="known">{tl("Still weak:")}{" "}<b>{c.still_weak.map(x=>x.title).join(', ')}</b></p>}</>}</div>}
function CourseFinishers({cid,back,toast}){
  const [d,setD]=useState(null),[show,setShow]=useState('all')
  useEffect(()=>{api(`/courses/${cid}/completion`).then(setD).catch(e=>{toast(e.message);back()})},[cid])
  const rows=d?d.students.filter(r=>show==='all'||(show==='done'?r.complete:show==='close'?!r.complete&&r.percent>=75:!r.complete)):[]
  return <><Bar title={tl("Who has finished")} sub={d?d.course+' · '+tl("{done} of {n} finished",{done:d.completed,n:d.students.length}):''} back={back}/><div className="main">
    {!d?<Skeleton rows={3}/>:<><div className="seg" role="group" aria-label={tl("Show")} style={{gridTemplateColumns:'repeat(4,1fr)',marginTop:0}}>{[['all','All'],['done','Finished'],['close','Close (75%+)'],['open','Work left']].map(([k,l])=><button key={k} className={show===k?'on':''} aria-pressed={show===k} onClick={()=>setShow(k)}>{tl(l)}</button>)}</div>
    <p className="known">{tl("Finished: every required topic marked as learned and every test of the course tried. It says nothing about scores; the average shows those.")}</p>
    {!rows.length&&<p className="known">{tl("No students here.")}</p>}
    <Paged rows={rows} render={r=><div key={r.user_id} className="row"><div>{r.name}<small>{r.complete?tl("Finished {when}",{when:day(r.completed_at.slice(0,10))}):[r.topics_left&&(r.topics_left===1?tl("1 topic left"):tl("{n} topics left",{n:r.topics_left})),r.tests_left&&(r.tests_left===1?tl("1 test to try"):tl("{n} tests to try",{n:r.tests_left}))].filter(Boolean).join(' · ')}{r.average!=null?' · '+tl("average {n}%",{n:r.average}):''}{r.cycle>1?' · '+tl("pass {n}",{n:r.cycle})+(r.first_completed_at?' · '+tl("first finished {when}",{when:day(r.first_completed_at.slice(0,10))}):''):''}</small><Bar2 v={r.percent}/></div><span className="chip">{r.percent}%</span></div>}/></>}
  </div></>}
function Insights({toast,role,onRoutine}){
  const [d,setD]=useState(null),[topic,setTopic]=useState(null),[sc,setSc]=useState(null),[td,setTd]=useState(null),[cm,setCm]=useState(null),[ach,setAch]=useState(null)
  useEffect(()=>{if(!topic){api('/me/insights').then(setD).catch(e=>toast(e.message));if(role==='student'){api('/me/today').then(setTd).catch(()=>{});api('/me/completion').then(setCm).catch(()=>{});api('/me/achievements').then(r=>setAch(r.items)).catch(()=>{})}}},[topic])
  if(topic)return <Topic id={topic} back={()=>setTopic(null)} toast={toast} role={role}/>
  if(sc)return <ScoreCourse c={sc} back={()=>setSc(null)} toast={toast} role={role}/>
  const clicked=d?.strong||[],looks=d?[...d.needs_study,...d.getting_there]:[]
  const item=a=><button key={a.topic_id||'u'+a.unit_id} className="row rowbtn" disabled={!a.topic_id} onClick={()=>setTopic(a.topic_id)}><div>{a.title}<small>{[a.course,a.status!=='strong'&&tl(STATUS_LABEL[a.status]),a.sittings&&pl(a.sittings,'sitting')].filter(Boolean).join(' · ')}</small></div>{a.topic_id&&<ChevronRight size={18}/>}</button>
  return <><Bar title={tl("My progress")}/><div className="main">
    {cm?.courses?.length>0?<><h3 className="sec first">{tl("Your courses")}</h3>
      <p className="known" style={{marginTop:0}}>{tl("A course is finished when every required topic is marked as learned and every test has been tried. Finishing is not the same as mastering: your scores below show that.")}</p>
      <Paged rows={cm.courses} render={c=><div className="qbox" key={c.course_id}><b>{c.course}</b>{" "}{c.complete?<span className="chip" style={{color:'var(--ok)'}}>{tl("Finished {when}",{when:day(c.completed_at.slice(0,10))})}</span>:c.completed_at?<span className="chip">{tl("Finished {when}; new work added since",{when:day(c.completed_at.slice(0,10))})}</span>:c.first_completed_at?<span className="chip">{tl("Pass {n} · first finished {when}",{n:c.cycle,when:day(c.first_completed_at.slice(0,10))})}</span>:null}
        <Bar2 v={c.percent}/><small className="known">{c.tests.total?tl("{percent}% · {done} of {req} required topics learned · {tried} of {tests} tests tried",{percent:c.percent,done:c.topics.done,req:c.topics.required,tried:c.tests.tried,tests:c.tests.total}):tl("{percent}% · {done} of {req} required topics learned",{percent:c.percent,done:c.topics.done,req:c.topics.required})}{c.average!=null?' · '+tl("test average {n}%",{n:c.average}):''}</small>
        {(c.remaining.length>0||c.pending_tests.length>0)&&<details><summary className="known">{tl("What's left ({n})",{n:c.remaining.length+c.pending_tests.length})}</summary>
          {c.remaining.map(t=><button key={t.id} className="row rowbtn" onClick={()=>setTopic(t.id)}><div>{t.title}<small>{tl("Topic to mark as learned")}</small></div><ChevronRight size={18}/></button>)}
          {c.pending_tests.map(q=><div key={q.id} className="row"><div>{q.title}<small>{tl("Test to try")}</small></div></div>)}</details>}</div>}/></>
    :td?.courses?.length>0&&<><h3 className="sec first">{tl("Your courses")}</h3>  {/* what they marked as learned: their own word for it, not a score */}
      <p className="known" style={{marginTop:0}}>{tl("{done} of {total} topics marked as learned. Quizzes below show how well they stuck.",{done:td.topics_completed,total:td.topics_total})}</p>
      <Paged rows={td.courses} render={c=><div className="row" key={c.id}><div>{c.name}<small>{tl("{done} of {total} topics marked as learned",{done:c.completed,total:c.total})}{' · '}{Math.round(100*c.completed/c.total)}%</small><Bar2 v={100*c.completed/c.total}/></div></div>}/></>}
    {ach&&<><h3 className="sec">{tl("Milestones")}</h3><div className="stats">{ach.map(a=><div key={a.key} className="stat" style={{opacity:a.at?1:.55}}><b style={{fontSize:16}}>{tl(a.title)}</b>
      <small className="known">{a.at?tl("Reached {when}",{when:day(a.at.slice(0,10))})+(a.detail?' · '+a.detail:''):tl(ACH_HINT[a.key]||'')}</small></div>)}</div></>}
    {!d&&<Skeleton/>}
    {d?.not_assessed?.length>0&&<p className="known">{tl("Not assessed yet: {n}. A topic is judged after 5 or more questions over 2 or more sittings, so one wrong answer never marks it weak.",{n:d.not_assessed.length})}</p>}
    {d&&!clicked.length&&!looks.length&&<p className="known">{tl("After you try a quiz or a test, the topics that clicked and the ones worth another look show up here.")}</p>}
    {clicked.length>0&&<><h3 className={'sec'+(td?.courses?.length?'':' first')}>{tl("What clicked")}</h3><Paged rows={clicked} render={item}/></>}
    {looks.length>0&&<><h3 className={'sec'+(clicked.length?'':' first')}>{tl("Worth another look")}</h3><Paged rows={looks} render={item}/></>}
    <h3 className="sec">{tl("Study routine")}</h3>
    <button className="row rowbtn" onClick={onRoutine}><div>{tl("Set or change your study days")}<small>{tl("Optional. Some people like a rhythm; nothing changes unless you set one.")}</small></div><ChevronRight size={18}/></button>
    <details className="fold"><summary>{tl("Test results")}</summary><MyScores onCourse={setSc}/></details>
    <AdaptCard toast={toast}/></div></>}
// what the app has picked up from how this student uses a topic's steps, in plain words, with a way to start fresh. Only they see it
function AdaptCard({toast}){
  const {appName}=useContext(Ctx),[d,setD]=useState(null),load=()=>api('/me/learning').then(setD).catch(()=>{});useEffect(()=>{load()},[])
  if(!d)return null
  const taps=Object.values(d.taps||{}).reduce((a,b)=>a+b,0),fav=taps>=3?STEP_LABEL(d.order[0]):null
  const lines=[fav&&tl("{step} comes first on a topic, since you reach for it most",{step:fav}),
    d.level==='hard'&&tl("Quick checks ask you to apply ideas, since you have been getting them"),d.level==='easy'&&tl("Quick checks are plainer for now, with a hint when it helps"),
    tl("After a few topics in a unit, a topic starts with its question and keeps the gist one tap away"),
    tl("Remember this? brings back topics you marked “Not quite”")].filter(Boolean)
  const reset=async()=>{try{await api('/me/learning/steps',{method:'DELETE'});toast(tl("Started fresh"));load()}catch(e){toast(e.message)}}
  return <><h3 className="sec">{tl("How {name} adapts to you",{name:appName})}</h3><div className="qbox"><ul className="adapt">{lines.map((x,i)=><li key={i}>{x}</li>)}</ul>
    <p className="known" style={{margin:'8px 0 0'}}>{tl("It learns only from the steps you open and your own “I had it” / “Not quite”. Your teachers never see this.")}</p>
    {(taps>0||d.checks>0)&&<button className="btn ghost" onClick={reset}>{tl("Start fresh")}</button>}</div></>}

export const uploadImg=async f=>{const r=await fetch(ROOT+'/api/uploads',{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream',Authorization:'Bearer '+localStorage.t},body:f}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(tl(j.detail||'Upload failed'));return j.url}
// what to revise and when (S35): worked out on the server from what the student did; a check (an MCQ set) moves a topic on, reading its sheet doesn't
const REV_GROUPS=[['overdue','Overdue'],['today','Due today'],['upcoming','Coming up this week']]
// a student's learning history and performance (S38): only figures the server worked out from their stored results; tests and practice kept apart
const STATUS_LABEL={strong:"Strong",getting_there:"Needs revision",needs_study:"Needs attention",not_assessed:"Not assessed yet"},STATUS_CLS={strong:'okp',needs_study:'off',getting_there:'',not_assessed:''}
const HIST_LABEL={learned:"Topic learned",unit_done:"Unit finished",studied:"Studied",revised:"Revision sheet read",practice:"MCQ practice",test:"Test submitted",course_done:"Course finished",restart:"Course started over",unit_restart:"Unit started over"}
export function Spark({xs}){return <div className="spark" aria-hidden="true">{xs.map((v,i)=><i key={i} style={{height:Math.max(6,v)+'%'}}/>)}</div>}
export function TrendsView({d,onTopic}){
  const r=d.rule,ta=d.test_answers,pr=d.practice,groups=['needs_study','getting_there','strong','not_assessed']
  return <>
    <div className="stats">
      {ta.percent!=null&&<div className="stat"><b>{ta.percent}%</b><small className="known">{tl("Test answers right ({right} of {n})",{right:ta.right,n:ta.right+ta.wrong})}</small></div>}
      {pr.percent!=null&&<div className="stat"><b>{pr.percent}%</b><small className="known">{tl("MCQ practice right ({right} of {n}, {sets} sets)",{right:pr.right,n:pr.right+pr.wrong,sets:pr.sets})}</small></div>}
      {d.retakes.tests>0&&<div className="stat"><b>{d.retakes.first}% → {d.retakes.latest}%</b><small className="known">{tl("Tests taken again: first try to latest, on average")}</small></div>}</div>
    {d.insights.length>0&&<><h3 className="sec">{tl("What your results say")}</h3><div className="qbox">{d.insights.map((x,i)=><p key={i} style={{margin:'4px 0'}}>{srv(x.text)}</p>)}</div></>}
    {d.topics.length>0&&<><h3 className="sec">{tl("Topics")}</h3>
      <p className="known" style={{marginTop:0}}>{tl("Judged only after {q} or more questions over {n} or more sittings (tests and MCQ sets). Strong: {s}% or more overall and last time. Needs attention: under {w}% overall and last time. Needs revision: in between or mixed.",{q:r.min_questions,n:r.min_sittings,s:r.strong,w:r.weak})}</p>
      {groups.map(g=>{const L=d.topics.filter(t=>t.status===g);return L.length?<div key={g}><b className="known">{tl(STATUS_LABEL[g])} ({L.length})</b>
        {L.map(t=><button key={t.topic_id} className="row rowbtn" disabled={!onTopic} onClick={()=>onTopic&&onTopic(t.topic_id)}><div>{t.title}<small>{[tl("{p}% of {n} questions",{p:t.percent,n:t.asked}),pl(t.sittings,'sitting'),t.test_percent!=null&&tl("tests {p}%",{p:t.test_percent}),t.practice_percent!=null&&tl("practice {p}%",{p:t.practice_percent}),t.sittings>1&&tl("first {a}% · last {b}%",{a:t.first,b:t.latest})].filter(Boolean).join(' · ')}</small><Bar2 v={t.percent}/></div><span className={'pill sm '+STATUS_CLS[g]}>{tl(STATUS_LABEL[g])}</span></button>)}</div>:null})}</>}
    {d.tests.length>0&&<><h3 className="sec">{tl("Tests over time")}</h3>{d.tests.map(t=><div key={t.id} className="row"><div>{t.title}<small>{t.attempts.length>1?tl("{n} attempts · first {a}% · latest {b}% · best {c}%",{n:t.attempts.length,a:t.first,b:t.latest,c:t.best}):tl("1 attempt · {a}%",{a:t.first})}</small></div>{t.attempts.length>1&&<Spark xs={t.attempts.map(a=>a.percent)}/>}</div>)}</>}
    {pr.weeks.length>0&&<><h3 className="sec">{tl("MCQ practice by week")}</h3><div className="row"><div><small>{tl("Share right each week, oldest first: {list}",{list:pr.weeks.map(w=>w.percent+'%').join(', ')})}</small></div><Spark xs={pr.weeks.map(w=>w.percent)}/></div></>}
    {d.cycles?.cycles?.length>1&&<CyclePasses d={d.cycles}/>}</>}
function LearningPage({toast,role}){
  const [tab,setTab]=useState('perf'),[cid,setCid]=useState(0),[d,setD]=useState(null),[h,setH]=useState(null),[f,setF]=useState({unit:0,since:'',until:'',kind:''}),[topic,setTopic]=useState(null)
  useEffect(()=>{setD(null);api('/me/trends'+(cid?'?course_id='+cid:'')).then(setD).catch(e=>toast(e.message))},[cid])
  useEffect(()=>{const q=new URLSearchParams({...(cid?{course_id:cid}:{}),...(f.unit?{unit_id:f.unit}:{}),...(f.since?{since:f.since}:{}),...(f.until?{until:f.until}:{}),...(f.kind?{kind:f.kind}:{})});api('/me/history?'+q).then(setH).catch(e=>toast(e.message))},[cid,f])
  if(topic)return <Topic id={topic} back={()=>setTopic(null)} toast={toast} role={role}/>
  const units=h?.courses.find(c=>c.id===cid)?.units||[]
  return <><Bar title={tl("My learning")}/><div className="main">
    <div className="qopt"><select aria-label={tl("Course")} value={cid} onChange={e=>{setCid(+e.target.value);setF({...f,unit:0})}}><option value={0}>{tl("All courses")}</option>{(h?.courses||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="seg" role="group" style={{gridTemplateColumns:'1fr 1fr'}}>{[['perf',tl("Performance")],['hist',tl("History")]].map(([k,l])=><button key={k} className={tab===k?'on':''} aria-pressed={tab===k} onClick={()=>setTab(k)}>{l}</button>)}</div>
    {tab==='perf'&&(!d?<Skeleton rows={3}/>:!d.tests.length&&!d.practice.sets&&!d.topics.length?<p className="known">{tl("After you try a test or an MCQ set, your results over time show up here.")}</p>:<TrendsView d={d} onTopic={setTopic}/>)}
    {tab==='hist'&&<>
      <div className="qopt">{cid>0&&<select aria-label={tl("Unit")} value={f.unit} onChange={e=>setF({...f,unit:+e.target.value})}><option value={0}>{tl("All units")}</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>}
        <select aria-label={tl("What")} value={f.kind} onChange={e=>setF({...f,kind:e.target.value})}><option value="">{tl("Everything")}</option>{Object.entries(HIST_LABEL).map(([k,l])=><option key={k} value={k}>{tl(l)}</option>)}</select></div>
      <div className="qopt"><label className="known">{tl("From")}{" "}<input type="date" value={f.since} onChange={e=>setF({...f,since:e.target.value})}/></label><label className="known">{tl("To")}{" "}<input type="date" value={f.until} onChange={e=>setF({...f,until:e.target.value})}/></label></div>
      {!h?<Skeleton rows={3}/>:!h.items.length?<p className="known">{tl("Nothing here for these filters.")}</p>:<>
        {cid===0&&!f.unit&&<p className="known" style={{marginTop:0}}>{tl("“Studied” days count the topics you opened; which ones isn't recorded.")}</p>}
        <Paged rows={h.items} render={(e,i)=><div className="row" key={e.kind+e.at+i}><div>{tl(HIST_LABEL[e.kind])}{e.title?': '+e.title:''}<small>{[when(e.at),
          e.kind==='test'&&tl("{p}% · attempt {n}",{p:e.percent,n:e.attempt}),e.kind==='practice'&&tl("{p}% ({score} of {total})",{p:e.percent,score:e.score,total:e.total}),
          e.kind==='studied'&&(e.reads===1?tl("1 topic opened"):tl("{n} topics opened",{n:e.reads})),(e.kind==='restart'||e.kind==='course_done')&&e.cycle&&tl("pass {n}",{n:e.cycle}),
          e.unit&&e.kind!=='unit_done'&&e.kind!=='unit_restart'?e.unit:'',e.course&&!cid?e.course:''].filter(Boolean).join(' · ')}</small></div></div>}/>
        {h.total>h.items.length&&<p className="known">{tl("Showing the latest {n} of {total}. Narrow the dates to see older ones.",{n:h.items.length,total:h.total})}</p>}</>}</>}
  </div></>}
function RevisionPage({toast,role}){
  const confirm=useConfirm(),[d,setD]=useState(null),[topic,setTopic]=useState(null),[set,setSet]=useState(null),[busy,setBusy]=useState(null)
  const load=()=>api('/me/revision').then(setD).catch(e=>toast(e.message));useEffect(()=>{if(!topic&&!set)load()},[topic,set])
  if(topic)return <Topic id={topic} tab0="revise" back={()=>setTopic(null)} toast={toast} role={role}/>
  if(set)return <McqPlay id={set} back={()=>setSet(null)} toast={toast} openTopic={setTopic}/>
  const check=async x=>{setBusy(x.topic_id);const id=await topicCheck(x.topic_id,confirm,toast);if(id)setSet(id);setBusy(null)}
  const later=async(x,days)=>{try{const r=await api(`/me/revision/${x.topic_id}/postpone`,{method:'POST',body:{days}});toast(tl("Moved to {day}",{day:day(r.due)}));load()}catch(e){toast(e.message)}}
  const done=async x=>{try{await api(`/topics/${x.topic_id}/revised`,{method:'POST'});toast(tl("Marked as revised"));load()}catch(e){toast(e.message)}}
  const why=x=>[x.weak&&tl("Last check {percent}%",{percent:x.last.percent}),x.wrong>1&&tl("{n} wrong answers so far",{n:x.wrong}),x.not_yet>0&&tl("You found it hard"),!x.checked&&tl("Not checked yet")].filter(Boolean)
  const Row=({x,actions})=><div className="card ward"><span className="wtop"><b>{x.title}</b><span className="chip">{x.due<new Date().toISOString().slice(0,10)?tl("due {when}",{when:day(x.due)}):day(x.due)}</span></span>
    <small className="known">{x.course}{x.unit?' · '+x.unit:''}{' · '}{x.interval===1?tl("every day"):tl("every {n} days",{n:x.interval})}</small>
    {why(x).length>0&&<small className="known">{why(x).join(' · ')}</small>}
    {actions&&<div className="two" style={{marginTop:8}}><button className="btn" onClick={()=>setTopic(x.topic_id)}>{tl("Revise now")}</button><button className="btn ghost" disabled={busy===x.topic_id} onClick={()=>check(x)}>{busy===x.topic_id?tl("Starting…"):tl("Check myself")}</button></div>}
    {actions&&<span className="tools" style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}><button className="tool" onClick={()=>done(x)}>{tl("Mark as revised")}</button>{[1,3,7].map(n=><button key={n} className="tool" onClick={()=>later(x,n)}>{tl("Later: {n} d",{n})}</button>)}</span>}</div>
  return <><Bar title={tl("Revision")} sub={d?tl("{n} to revise now",{n:d.overdue.length+d.today.length}):''}/><div className="main">
    {!d&&<Skeleton rows={3}/>}
    {d&&<p className="known" style={{marginTop:0}}>{tl("Topics come back after {days} days, further apart each time you pass a check (80% or more) and sooner when one goes badly. Reading the sheet counts as revising, not as a check.",{days:d.intervals.join(', ')})}</p>}
    {d&&!d.overdue.length&&!d.today.length&&!d.upcoming.length&&<p className="known">{tl("Nothing to revise yet. Topics you mark as learned, or check yourself on, come here when it is time to revise them.")}</p>}
    {d&&REV_GROUPS.map(([k,l])=>d[k].length>0&&<Fragment key={k}><h3 className="sec">{tl(l)} ({d[k].length})</h3><Paged rows={d[k]} render={x=><Row key={x.topic_id} x={x} actions={k!=='upcoming'}/>}/></Fragment>)}
    {d?.recent.length>0&&<><h3 className="sec">{tl("Recently revised")}</h3>{d.recent.map(x=><div key={x.topic_id} className="row"><div>{x.title}<small>{x.last.kind==='check'?tl("Checked: {percent}%",{percent:x.last.percent}):tl("Read the sheet")}{' · '}{when(x.last.at)}</small></div><span className="chip">{tl("next {when}",{when:day(x.due)})}</span></div>)}</>}
  </div></>}
// a topic's revision sheet (S34): written once when asked for, shown three ways from the same sheet; "your focus" comes from the student's own results
const REV_FORMATS=[['quick','Quick'],['detailed','Detailed'],['exam','Exam']]
function TopicRevision({id,toast}){
  const [d,setD]=useState(null),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[fmt,setFmt]=useState('quick'),[ex,setEx]=useState({})
  const load=make=>api(`/topics/${id}/revision${make?'?make=1':''}`).then(setD)
  useEffect(()=>{setD(null);load().catch(e=>setErr(e.message))},[id])
  const make=async()=>{setBusy(true);setErr('');try{await load(true)}catch(e){setErr(e.message)}setBusy(false)}
  const revised=async()=>{try{const r=await api(`/topics/${id}/revised`,{method:'POST'});setD(x=>({...x,revised_at:r.revised_at}));toast(tl("Marked as revised"))}catch(e){toast(e.message)}}
  const explain=async(k,text)=>{setEx(x=>({...x,[k]:{busy:true}}));try{const r=await api(`/topics/${id}/explain`,{method:'POST',body:{text}});setEx(x=>({...x,[k]:{text:r.explain.text}}))}catch(e){setEx(x=>({...x,[k]:{err:e.message}}))}}
  if(!d)return err?<p className="known">{err}</p>:<Skeleton rows={3}/>
  const Line=({k,text,children})=><div className="revline">{children}<button className="tool" disabled={ex[k]?.busy} onClick={()=>explain(k,text)}>{ex[k]?.busy?tl("Thinking…"):tl("Explain this")}</button>
    {ex[k]?.text&&<div className="known prose"><Md>{ex[k].text}</Md></div>}{ex[k]?.err&&<p className="known">{ex[k].err}</p>}</div>
  const sh=d.sheet,f=d.focus,Sec=({title,show,children})=>show?<div className="qbox"><b>{title}</b>{children}</div>:null
  const ideas=detail=>sh.concepts.map((c,i)=><Line key={'c'+i} k={'c'+i} text={c.title+': '+c.point}><div className="prose"><Md>{`**${c.title}**: ${c.point}`+(detail&&c.detail?`\n\n${c.detail}`:'')}</Md></div></Line>)
  const formulas=meaning=>sh.formulas.map((x,i)=><Line key={'f'+i} k={'f'+i} text={x.formula+' '+x.meaning}><div className="prose"><Md>{x.formula+(meaning&&x.meaning?' · '+x.meaning:'')}</Md></div></Line>)
  const defs=sh&&sh.definitions.map((x,i)=><Line key={'d'+i} k={'d'+i} text={x.term+': '+x.meaning}><div className="prose"><Md>{`**${x.term}**: ${x.meaning}`}</Md></div></Line>)
  const list=(L,p)=>L.map((x,i)=><Line key={p+i} k={p+i} text={x}><div className="prose"><Md>{x}</Md></div></Line>)
  const focus=f&&(f.wrong.length||f.marked.length||f.not_yet||f.standing)
  return <>
    {focus&&<div className="qbox area needs_study"><b>{tl("Your focus")}</b>
      {f.standing&&<p className="known">{tl("Your MCQs on this topic: {correct} of {total} right · {percent}%",{correct:f.standing.correct,total:f.standing.answered,percent:f.standing.percent})}</p>}
      {f.wrong.length>0&&<><small className="known">{tl("Questions you got wrong")}</small><ul>{f.wrong.map((w,i)=><li key={i} className="prose"><Md>{w}</Md></li>)}</ul></>}
      {f.marked.length>0&&<><small className="known">{tl("Passages you highlighted")}</small><ul>{f.marked.map((w,i)=><li key={i}>{w}</li>)}</ul></>}
      {f.not_yet>0&&<p className="known">{tl("You said \"Not quite\" on {n} quick checks here.",{n:f.not_yet})}</p>}</div>}
    {d.empty?<p className="known">{tl("This topic has no notes yet, so there is nothing to revise from.")}</p>
    :!sh?<div className="qbox"><p className="known" style={{marginTop:0}}>{tl("A one-screen summary of what matters in this topic, with a detailed and an exam view.")}</p>
      <button className="btn" disabled={busy} onClick={make}>{busy?tl("Writing…"):tl("Write my revision sheet")}</button>{err&&<p className="known">{err}{" "}<button className="tool" onClick={make}>{tl("Try again")}</button></p>}</div>
    :<><div className="seg" role="group" aria-label={tl("How much to show")} style={{gridTemplateColumns:'1fr 1fr 1fr'}}>{REV_FORMATS.map(([k,l])=><button key={k} className={fmt===k?'on':''} aria-pressed={fmt===k} onClick={()=>setFmt(k)}>{tl(l)}</button>)}</div>
      {d.own_notes&&<p className="known">{tl("Written from your own notes, for you only.")}</p>}
      {fmt==='quick'&&<><Sec title={tl("Key ideas")} show>{ideas(false)}</Sec><Sec title={tl("Formulas")} show={sh.formulas.length>0}>{formulas(false)}</Sec><Sec title={tl("Watch out for")} show={sh.mistakes.length>0}>{list(sh.mistakes.slice(0,3),'m')}</Sec></>}
      {fmt==='detailed'&&<><Sec title={tl("Key ideas")} show>{ideas(true)}</Sec><Sec title={tl("Definitions")} show={sh.definitions.length>0}>{defs}</Sec><Sec title={tl("Formulas")} show={sh.formulas.length>0}>{formulas(true)}</Sec>
        <Sec title={tl("Key facts")} show={sh.facts.length>0}>{list(sh.facts,'k')}</Sec><Sec title={tl("Examples")} show={sh.examples.length>0}>{sh.examples.map((x,i)=><Line key={'e'+i} k={'e'+i} text={x.title+': '+x.text}><div className="prose"><Md>{`**${x.title}**: ${x.text}`}</Md></div></Line>)}</Sec>
        <Sec title={tl("Common mistakes")} show={sh.mistakes.length>0}>{list(sh.mistakes,'m')}</Sec></>}
      {fmt==='exam'&&<><Sec title={tl("Definitions")} show={sh.definitions.length>0}>{defs}</Sec><Sec title={tl("Formulas")} show={sh.formulas.length>0}>{formulas(true)}</Sec>
        <Sec title={tl("Likely questions")} show={sh.likely.length>0}>{list(sh.likely,'l')}</Sec><Sec title={tl("Common mistakes")} show={sh.mistakes.length>0}>{list(sh.mistakes,'m')}</Sec></>}
      <button className="btn ghost" onClick={revised}>{tl("Mark as revised")}</button>{d.revised_at&&<p className="known">{tl("Last revised {when}",{when:when(d.revised_at)})}</p>}</>}</>}
// one image place on a question or an answer: shows the image, the file the CSV asked for, or a small "Add image" button
export function ImgSlot({url,need,label,onSet,toast,small}){
  const ref=useRef(),[busy,setBusy]=useState(false)
  const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;setBusy(true);try{onSet(await uploadImg(f))}catch(x){toast(x.message)}setBusy(false)}
  const input=<input ref={ref} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={pick}/>
  if(url)return <div className={'islot'+(small?' sm':'')}>{input}<img src={at(url)} alt={label}/><span><button className="tool" onClick={()=>ref.current.click()}>{tl("Replace")}</button><button className="tool" onClick={()=>onSet('')}>{tl("Remove image")}</button></span></div>
  if(need)return <div className="islot need" role="status">{input}<AlertTriangle size={16}/><span>{tl("Needs")}{" "}<b>{need}</b></span><button className="tool" disabled={busy} onClick={()=>ref.current.click()}>{busy?tl("Uploading…"):tl("Upload")}</button><button className="tool" onClick={()=>onSet('',true)}>{tl("Skip")}</button></div>
  return <>{input}<button className="tool" disabled={busy} onClick={()=>ref.current.click()} aria-label={tl("Add image to {label}",{label:label})}>{busy?tl("Uploading…"):small?tl("Image"):tl("Add image")}</button></>}
export const QImg=({src,alt})=>src?<img className="qimg" src={at(src)} alt={alt} loading="lazy"/>:null
export const OptBody=({text,img,k})=><span className="obody">{img&&<img src={at(img)} alt={tl("Answer {k}",{k:LET[k]})}/>}{text?<Md>{text}</Md>:!img&&<span>—</span>}</span>
export const LET='ABCDEF'
function QuizPlay({id,back,toast,role}){
  const confirm=useConfirm()
  const [q,setQ]=useState(null),[ans,setAns]=useState([]),[res,setRes]=useState(null),[busy,setBusy]=useState(false),[topic,setTopic]=useState(null),[view,setView]=useState(null),[sit,setSit]=useState('')
  const [kept,setKept]=useState(''),[resumed,setResumed]=useState(false),cur=useRef({})  // kept: '', 'saving', 'saved' or 'offline'; cur: what a save needs, always the newest
  const key='zg-quiz-draft:'+id,readLocal=()=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  const writeLocal=v=>{try{v?localStorage.setItem(key,JSON.stringify(v)):localStorage.removeItem(key)}catch{/* private window: the server copy still holds */}}
  // a sitting: its id (sit) goes with every save and every try of its submit, so a retry is never a second attempt. Answers come back from the server's
  // copy, or this browser's if it is newer (saved while offline); fresh (Try again) starts a new sitting
  const start=(d,fresh)=>{const srv=fresh?null:d.draft,loc=fresh?null:readLocal(),useLoc=loc&&(!srv||(loc.sit===srv.request_id&&loc.ver>srv.version))
    const from=useLoc?{sit:loc.sit,ver:loc.ver,a:loc.answers}:srv?{sit:srv.request_id,ver:srv.version,a:srv.answers}:{sit:rid(),ver:0,a:{}}
    const a=d.questions.map(x=>from.a[x.id]??null);if(fresh)writeLocal(null)
    cur.current={sit:from.sit,ver:from.ver,ans:a,qs:d.questions,pending:!!useLoc};setQ(d);setAns(a);setRes(null);setSit(from.sit);setResumed(a.some(v=>v!==null));setKept(useLoc?'offline':'')
    if(useLoc)push()}
  const push=async()=>{const c=cur.current;if(!c.qs)return
    const body={request_id:c.sit,version:c.ver,answers:Object.fromEntries(c.qs.map((x,i)=>[x.id,c.ans[i]]).filter(([,v])=>v!==null))};setKept('saving')
    try{const r=await api(`/quizzes/${id}/draft`,{method:'PUT',body});if(cur.current!==c)return
      if(!r.saved&&r.draft&&r.draft.version>c.ver){const a=c.qs.map(x=>r.draft.answers[x.id]??null);cur.current={...c,ver:r.draft.version,ans:a};setAns(a)}  // newer answers from another tab or device
      c.pending=false;setKept('saved')}
    catch(e){if(cur.current!==c)return;if(e.status===409){writeLocal(null);c.pending=false;setKept('submitted');return}  // that sitting was submitted elsewhere
      c.pending=true;setKept('offline')}}
  const pick=(i,k)=>{const c=cur.current,a=c.ans.map((v,n)=>n===i?k:v);cur.current={...c,ver:c.ver+1,ans:a,pending:true};setAns(a)
    writeLocal({sit:c.sit,ver:c.ver+1,answers:Object.fromEntries(c.qs.map((x,n)=>[x.id,a[n]]).filter(([,v])=>v!==null))});push()}
  useEffect(()=>{api('/quizzes/'+id).then(d=>start(d)).catch(e=>{toast(e.message);back()})},[id])
  useEffect(()=>{const again=()=>{if(cur.current.pending)push()};addEventListener('online',again);const t=setInterval(again,15000);return()=>{removeEventListener('online',again);clearInterval(t)}},[id])
  if(topic)return <Topic id={topic} back={()=>setTopic(null)} toast={toast} role={role}/>
  if(view)return view.kind==='attempt'?<AttemptView id={view.id} back={()=>setView(null)} toast={toast} role={role}/>:view.kind==='mine'?<MyAttempts quiz={id} back={()=>setView(null)} toast={toast} role={role}/>:<QuizResults id={id} back={()=>setView(null)} toast={toast} role={role}/>
  if(!q)return <><Bar title={tl("Quiz")} back={back}/><div className="main"><Skeleton/></div></>
  const left=ans.filter(a=>a===null).length
  const submit=async()=>{if(busy)return;const n=ans.length
    if(!await confirm({title:tl("Submit your test?"),stats:[[n-left,tl("Answered")],[left,tl("Unanswered")],[n,tl("Total")]],ok:tl("Confirm submission"),cancel:tl("Go back"),
      body:left===0?tl("You have answered every question."):left===1?tl("You have 1 unanswered question. It will be marked wrong."):tl("You have {n} unanswered questions. They will be marked wrong.",{n:left})}))return
    setBusy(true);try{setRes(await api(`/quizzes/${id}/attempt`,{method:'POST',body:{answers:ans,request_id:sit}}));writeLocal(null);cur.current={};setKept('');window.scrollTo(0,0)}catch(e){toast(e.message)}setBusy(false)}
  return <><Bar title={q.title} sub={tl("{length} questions · pass mark {pass_percent}%{v}",{length:q.questions.length,pass_percent:q.pass_percent,v:q.kind==='course'?' · course test':''})} back={back}/><div className="main">
    {!res&&q.can_edit&&<button className="btn ghost" style={{marginTop:0}} onClick={()=>setView({kind:'results'})}><BarChart3 size={16}/>{" "}{tl("Results and scores")}</button>}
    {!res&&resumed&&<p className="known" role="status" style={{marginTop:0}}>{tl("Welcome back: your answers so far are restored. This test is not submitted yet.")}</p>}
    {!res&&q.attempts>0&&<p className="known" style={{marginTop:0}}>{tl("You have tried this {n}. Best {best}% · latest {latest}%.",{n:pl(q.attempts,'time'),best:q.best,latest:q.latest})}{" "}<button className="tool" onClick={()=>setView({kind:'mine'})}>{tl("See your attempts")}</button></p>}
    {res&&<div className="qbox"><h2 style={{margin:0}}>{res.score} / {res.total} · {res.percent}%</h2><ResultFacts r={res}/><p className="known">{tl("Pass mark {pass}%.",{pass:res.pass_percent??q.pass_percent})}{res.summary&&' '+res.summary}</p>
      <div className="two"><button className="btn" onClick={()=>setView({kind:'attempt',id:res.attempt_id})}>{tl("Review answers")}</button><button className="btn ghost" onClick={()=>start(q,true)}>{tl("Try again")}</button></div><button className="btn ghost" onClick={back}>{tl("Back")}</button></div>}
    {res&&res.areas?.length>0&&<><h3 className="sec">{tl("What you are good at and what to revisit")}</h3><AreaList areas={res.areas} onStudy={setTopic}/></>}
    {res&&<Standing rows={res.standing} onStudy={setTopic}/>}
    {q.questions.map((x,i)=><div className="qbox" key={x.id}><b>{tl("Question")}{" "}{i+1}</b><div className="prose"><Md>{x.text}</Md></div><QImg src={x.image} alt={tl("Picture for question {pos}",{pos:i+1})}/>
      {x.options.map((o,k)=>{const r=res&&res.results[i],cls=r?(k===r.correct||(r.ok&&k===r.chosen)?' ok':k===r.chosen?' bad':''):ans[i]===k?' sel':''
        return <button key={k} className={'opt'+cls} disabled={!!res} aria-pressed={!res&&ans[i]===k} onClick={()=>pick(i,k)}><b className="olet">{LET[k]}</b><OptBody text={o} img={x.option_images[k]} k={k}/></button>})}
      {res&&res.results[i].explanation&&<div className="known"><Md>{res.results[i].explanation}</Md></div>}</div>)}
    {!res&&<button className="btn" disabled={busy} onClick={submit}>{busy?tl("Checking…"):tl("Submit answers")}</button>}
    {!res&&left>0&&<p className="known">{left}{" "}{tl("unanswered. Blank answers count as wrong.")}</p>}
    {!res&&<p className="known" role="status" aria-live="polite">{kept==='submitted'?tl("This test was already submitted, in another tab or on another device. Go back and open it again to see your result."):kept==='saving'?tl("Saving your answers…"):kept==='offline'?tl("Not saved yet: you seem to be offline. Your answers are kept on this device and will be saved when you are back online."):tl("Your answers are saved as you go.")}</p>}</div></>}
// one attempt, question by question
function AttemptView({id,back,toast,role}){
  const [d,setD]=useState(null),[topic,setTopic]=useState(null)
  useEffect(()=>{api('/attempts/'+id).then(setD).catch(e=>{toast(e.message);back()})},[id])
  if(topic)return <Topic id={topic} back={()=>setTopic(null)} toast={toast} role={role}/>
  if(!d)return <><Bar title={tl("Attempt")} back={back}/><div className="main"><Skeleton/></div></>
  const staff=role!=='student',right=d.questions.filter(x=>x.ok).length
  return <><Bar title={d.quiz} sub={(staff?d.user+' · ':'')+when(d.at)} back={back}/><div className="main">
    <div className="qbox" style={{marginTop:0}}><h2 style={{margin:0}}>{d.score} / {d.total} · {d.percent}%</h2><ResultFacts r={d}/><p className="known" style={{marginBottom:0}}>{tl("Pass mark {pass}%.",{pass:d.pass_percent})}{d.summary&&' '+d.summary}</p></div>
    {d.areas.length>0&&<><h3 className="sec">{staff?tl("Strengths and weak areas"):tl("What you are good at and what to revisit")}</h3><AreaList areas={d.areas} onStudy={staff?null:setTopic} staff={staff}/></>}
    {d.no_detail&&<p className="known">{tl("This attempt was made before answers were kept question by question, so only the score is known.")}</p>}
    {d.changed>0&&<p className="known">{pl(d.changed,'question')}{" "}{tl("of this attempt {v} changed or removed since, so {v2} not shown.",{v:d.changed===1?'was':'were',v2:d.changed===1?'it is':'they are'})}</p>}
    {!d.reveal&&d.questions.length>0&&<p className="known">{tl("You see which answers were right ({right} of {length}). This quiz does not show the correct answers.",{right:right,length:d.questions.length})}</p>}
    {d.questions.map((x,i)=><div className="qbox" key={x.id}><b>{tl("Question {v} ·",{v:i+1})}{" "}{x.ok?tl("Right"):tl("Wrong")}{x.area?' · '+x.area:''}</b><div className="prose"><Md>{x.text}</Md></div><QImg src={x.image} alt={tl("Picture for question {pos}",{pos:i+1})}/>
      {x.options.map((o,k)=>{const mine=x.chosen_known&&x.chosen===k,key=d.reveal&&x.correct===k,cls=key||(mine&&x.ok)?' ok':mine?' bad':''
        return <div key={k} className={'opt'+cls}><b className="olet">{LET[k]}</b><OptBody text={o} img={x.option_images[k]} k={k}/>{(mine||key)&&<span className="otag">{[mine&&(staff?tl('Their answer'):tl('Your answer')),key&&tl('Correct answer')].filter(Boolean).join(' · ')}</span>}</div>})}
      {x.chosen_known&&x.chosen==null&&<p className="known">{tl("Left blank.")}</p>}
      {x.explanation&&<div className="known"><Md>{x.explanation}</Md></div>}</div>)}</div></>}
function MyAttempts({quiz,user,back,toast,role}){  // a person's attempts at one quiz; staff pass user to see a student's
  const [d,setD]=useState(null),[open,setOpen]=useState(null)
  useEffect(()=>{api(`/quizzes/${quiz}/attempts`+(user?'?user_id='+user:'')).then(setD).catch(e=>{toast(e.message);back()})},[quiz,user])
  if(open)return <AttemptView id={open} back={()=>setOpen(null)} toast={toast} role={role}/>
  return <><Bar title={d?.quiz||tl("Attempts")} sub={d?(user?d.user+' · ':'')+pl(d.items.length,'attempt'):''} back={back}/><div className="main">
    {d&&!d.items.length&&<p className="known">{tl("No attempts yet.")}</p>}
    {<Paged rows={d?.items} render={(a,i)=><button key={a.id} className="row rowbtn" onClick={()=>setOpen(a.id)}><div>{a.score} / {a.total} · {a.percent}%<small>{when(a.at)}{a.passed?' · '+tl("reached the pass mark"):''}{i===0?tl(" · latest"):''}</small><Bar2 v={a.percent}/></div><ChevronRight size={18}/></button>}/>}</div></>}
export const rid=()=>(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()).replace(/[^A-Za-z0-9-]/g,'')
export function McqPlay({id,toast,back,openTopic}){  // one set: answers are saved as they go; after submitting, the score, each answer and what to revisit
  const confirm=useConfirm()
  const [d,setD]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{api('/mcq/attempts/'+id).then(setD).catch(e=>{toast(e.message);back()})},[id])
  if(!d)return <><Bar title={tl("MCQ set")} back={back}/><div className="main"><Skeleton/></div></>
  const open=d.status==='open',left=d.questions.filter(x=>x.chosen==null).length
  const pick=(i,k)=>{const qs=d.questions.map((x,n)=>n===i?{...x,chosen:k}:x);setD({...d,questions:qs})
    api(`/mcq/attempts/${id}/answers`,{method:'PUT',body:{answers:{[d.questions[i].pos]:k}}}).catch(e=>toast(e.message))}
  const submit=async()=>{if(left&&!await confirm({title:tl("Submit with {n} unanswered?",{n:left}),body:tl("Blank answers count as wrong."),ok:tl("Submit")}))return
    setBusy(true);try{setD(await api(`/mcq/attempts/${id}/submit`,{method:'POST',body:{answers:Object.fromEntries(d.questions.map(x=>[x.pos,x.chosen]))}}));window.scrollTo(0,0)}catch(e){toast(e.message)}setBusy(false)}
  const areas=(d.feedback||[]).map(f=>({topic_id:f.topic_id,title:f.topic,correct:f.correct,total:f.total,percent:f.percent,status:f.status}))
  return <><Bar title={d.mode==='topic'&&d.questions[0]?d.questions[0].topic:tl("MCQ practice")} sub={open?tl("{n} questions · answers are saved as you go",{n:d.total}):when(d.submitted_at)} back={back}/><div className="main">
    {!open&&<div className="qbox" style={{marginTop:0}}><h2 style={{margin:0}}>{d.score} / {d.total} · {d.percent}%</h2><ResultFacts r={d}/><p className="known" style={{marginBottom:0}}>{d.source==='ai'?tl("An AI set, written from your topics' notes."):tl("A set from the question bank.")}</p></div>}
    {!open&&areas.length>0&&<><h3 className="sec">{tl("What you are good at and what to revisit")}</h3><AreaList areas={areas} onStudy={openTopic}/></>}
    {!open&&<Standing rows={d.standing} onStudy={openTopic}/>}
    {d.questions.map((x,i)=><div className="qbox" key={x.pos}><b>{tl("Question")}{" "}{i+1}{!open?' · '+(x.ok?tl("Right"):tl("Wrong")):''}{d.mode!=='topic'&&x.topic?' · '+x.topic:''}</b><div className="prose"><Md>{x.text}</Md></div><QImg src={x.image} alt={tl("Picture for question {pos}",{pos:i+1})}/>
      {x.options.map((o,k)=>{const cls=open?(x.chosen===k?' sel':''):k===x.correct?' ok':k===x.chosen?' bad':''
        return open?<button key={k} className={'opt'+cls} aria-pressed={x.chosen===k} onClick={()=>pick(i,k)}><b className="olet">{LET[k]}</b><OptBody text={o} img={x.option_images[k]} k={k}/></button>
          :<div key={k} className={'opt'+cls}><b className="olet">{LET[k]}</b><OptBody text={o} img={x.option_images[k]} k={k}/>{(k===x.chosen||k===x.correct)&&<span className="otag">{[k===x.chosen&&tl('Your answer'),k===x.correct&&tl('Correct answer')].filter(Boolean).join(' · ')}</span>}</div>})}
      {!open&&x.chosen==null&&<p className="known">{tl("Left blank.")}</p>}
      {!open&&(x.explanation||x.explanation_image)&&<div className="known"><Md>{x.explanation}</Md><QImg src={x.explanation_image} alt={tl("Picture for the explanation")}/></div>}</div>)}
    {open&&<><button className="btn" disabled={busy} onClick={submit}>{busy?tl("Checking…"):tl("Submit answers")}</button>{left>0&&<p className="known">{left}{" "}{tl("unanswered. Blank answers count as wrong.")}</p>}</>}
    {!open&&<button className="btn ghost" onClick={back}>{tl("Back")}</button>}</div></>}

// score spread: one series, so one hue and no legend; every bar has its count as text and a tooltip
const Spread=({rows,pass})=>{const top=Math.max(1,...rows.map(r=>r.count))
  return <figure className="spread" aria-label={tl("How many students scored in each band")}><div className="sbars">{rows.map((r,i)=><div key={r.label} className="sbar" title={`${r.label}%: ${pl(r.count,'student')}`}><em>{r.count||''}</em><i style={{height:r.count?Math.max(4,100*r.count/top)+'%':0}} className={i*10+9<pass?'below':''}/></div>)}</div>
    <div className="saxis">{rows.map(r=><span key={r.label}>{r.label.split('–')[0]}</span>)}</div><figcaption>{tl("Final score in bands of 10%. Lighter bars are below the {pass}% pass mark.",{pass:pass})}</figcaption></figure>}
const PassPill=({ok})=><span className={'pill sm '+(ok?'okp':'off')}>{ok?tl("Passed"):tl("Not yet")}</span>
function QuizResults({id,back,toast,role}){
  const [d,setD]=useState(null),[tab,setTab]=useState('overview'),[who,setWho]=useState(null),[sort,setSort]=useState('order')
  useEffect(()=>{api(`/quizzes/${id}/results`).then(setD).catch(e=>{toast(e.message);back()})},[id])
  if(who)return <MyAttempts quiz={id} user={who} back={()=>setWho(null)} toast={toast} role={role}/>
  if(!d)return <><Bar title={tl("Results")} back={back}/><div className="main"><Skeleton/></div></>
  const sm=d.summary,qs=sort==='hard'?[...d.questions].sort((a,b)=>(a.percent??101)-(b.percent??101)):d.questions
  return <><Bar title={d.title} sub={tl("Results · {took} of {students} students took it",{took:sm.took,students:sm.students})} back={back}/><div className="main">
    <Tabs scroll label={tl("Result sections")} items={[['overview',tl("Overview")],['students',tl("Students")],['questions',tl("Questions")],['areas',tl("Strengths")]]} value={tab} onChange={setTab}/>
    {tab==='overview'&&<>{!sm.took?<p className="known">{tl("Nobody has taken it yet.")}{d.published?'':tl(" It is still a draft, so students cannot see it.")}</p>:<>
      <div className="stats">{[['Average final score',sm.average+'%'],['Pass rate',sm.pass_rate+'%',`${sm.passed} of ${sm.took} passed`],['Median',sm.median+'%'],['Highest · lowest',sm.highest+'% · '+sm.lowest+'%'],
        ['Took it',sm.took+' / '+sm.students,sm.not_taken?tl("{not_taken} not yet",{not_taken:sm.not_taken}):tl('everyone')],['Attempts',sm.attempts,tl("latest average {average_latest}%",{average_latest:sm.average_latest})]].map(([l,v,x])=><div className="stat" key={l}><b>{v}</b>{l}{x&&<small style={{display:'block',color:'var(--mut)'}}>{x}</small>}</div>)}</div>
      <h3 className="sec">{tl("Spread of final scores")}</h3><Spread rows={sm.distribution} pass={d.pass_percent}/>
      <p className="known">{tl("The final score is each student's best attempt. Strengths and the question analysis use each student's latest attempt, so a retake replaces the earlier result.")}</p></>}
      {d.not_taken.length>0&&<><h3 className="sec">{tl("Not taken yet ({not_taken})",{not_taken:sm.not_taken})}</h3><p className="known" style={{margin:0}}>{d.not_taken.map(x=>x.name).join(', ')}{sm.not_taken>d.not_taken.length?'…':''}</p></>}
      <button className="btn ghost" onClick={()=>fetchFile(`/quizzes/${id}/results?format=csv`,'results-'+d.title.replace(/\s+/g,'_')+'.csv',toast)}>{tl("Download results CSV")}</button></>}
    {tab==='students'&&<>{!d.students.length&&<p className="known">{tl("No results yet.")}</p>}
      {<Paged rows={d.students} render={x=><button key={x.user_id} className="row rowbtn" onClick={()=>setWho(x.user_id)}><div>{x.name}<PassPill ok={x.passed}/><small>{tl("Final {best}% · latest {latest}% · {n} ·",{best:x.best,latest:x.latest,n:pl(x.attempts,'attempt')})}{" "}{day(x.last_at)}</small>
        {(x.strong.length>0||x.needs_study.length>0)&&<small>{x.strong.length>0&&tl("Good at: {strong}",{strong:x.strong.join(', ')})}{x.strong.length>0&&x.needs_study.length>0&&' · '}{x.needs_study.length>0&&tl("Revisit: {needs_study}",{needs_study:x.needs_study.join(', ')})}</small>}<Bar2 v={x.best}/></div><ChevronRight size={18}/></button>}/>}</>}
    {tab==='questions'&&<><div className="seg" style={{gridTemplateColumns:'1fr 1fr',margin:'0 0 12px'}}>{[['order',tl("In test order")],['hard',tl("Hardest first")]].map(([k,l])=><button key={k} className={sort===k?'on':''} aria-pressed={sort===k} onClick={()=>setSort(k)}>{l}</button>)}</div>
      {qs.map(x=>{const n=x.picks.reduce((a,b)=>a+b,0)+x.blank
        return <div className="qbox" key={x.id}><b>{tl("Question {pos} ·",{pos:x.pos})}{" "}{x.percent==null?tl("no answers yet"):tl("{percent}% right",{percent:x.percent})}{x.area?' · '+x.area:''}</b><div className="prose"><Md>{x.text}</Md></div><QImg src={x.image} alt={tl("Picture for question {pos}",{pos:x.pos})}/>
          {x.options.map((o,k)=>{const c=x.picks[k],pc=n?Math.round(100*c/n):0
            return <div key={k} className="pick" title={`${LET[k]}: ${pl(c,'student')}`}><div className="pickh"><b className="olet">{LET[k]}</b><OptBody text={o} img={x.option_images[k]} k={k}/>{k===x.correct&&<span className="otag ok"><Check size={14}/>{" "}{tl("Correct")}</span>}<span className="pickn">{c} · {pc}%</span></div><div className="meter"><i style={{width:pc+'%'}} className={k===x.correct?'ok':''}/></div></div>})}
          {x.picks_known>0&&x.blank>0&&<p className="known" style={{margin:'6px 0 0'}}>{tl("Left blank:")}{" "}{x.blank}</p>}
          {x.total>x.picks_known&&<p className="known" style={{margin:'6px 0 0'}}>{x.total-x.picks_known}{" "}{tl("older {v} not record which answer was picked.",{v:x.total-x.picks_known===1?'attempt does':'attempts do'})}</p>}</div>})}</>}
    {tab==='areas'&&<>{!d.areas.length?<p className="known">{tl("No results yet.")}</p>:<><p className="known" style={{marginTop:0}}>{tl("Weakest first, from each student's latest attempt.")}</p>
      {<Paged rows={d.areas} render={a=><div className="row" key={a.title+(a.topic_id||'')}><div>{a.title}<small>{a.percent}{tl("% right · {strong} strong · {getting_there} getting there · {needs_study} need another round",{strong:a.strong,getting_there:a.getting_there,needs_study:a.needs_study})}{a.unit?' · '+a.unit:''}</small><Bar2 v={a.percent}/></div></div>}/>}</>}</>}</div></>}
function Gradebook({cid,back,toast,role}){
  const [d,setD]=useState(null),[open,setOpen]=useState(null),[stu,setStu]=useState(null),gb=useLocalPage(d?.students,[d]),top=useRef()
  useEffect(()=>{api(`/courses/${cid}/gradebook`).then(setD).catch(e=>{toast(e.message);back()})},[cid])
  if(open)return <QuizResults id={open} back={()=>setOpen(null)} toast={toast} role={role}/>
  if(stu)return stu.quiz?<MyAttempts quiz={stu.quiz} user={stu.id} back={()=>setStu({...stu,quiz:null})} toast={toast} role={role}/>
    :<><Bar title={stu.name} sub={tl("{course} · final {v}",{course:d.course,v:stu.final==null?'–':stu.final+'%'})} back={()=>setStu(null)}/><div className="main">{<Paged rows={d.tests} render={(t,i)=><button key={t.id} className="row rowbtn" disabled={stu.scores[i]==null} onClick={()=>setStu({...stu,quiz:t.id})}><div>{t.title}{stu.scores[i]!=null&&<PassPill ok={stu.scores[i]>=t.pass_percent}/>}<small>{t.unit||tl("Course test")}{" "}{tl("· {v} · pass {pass_percent}%",{v:stu.scores[i]==null?'not taken':'final '+stu.scores[i]+'%',pass_percent:t.pass_percent})}</small>{stu.scores[i]!=null&&<Bar2 v={stu.scores[i]}/>}</div>{stu.scores[i]!=null&&<ChevronRight size={18}/>}</button>}/>}</div></>
  if(!d)return <><Bar title={tl("Gradebook")} back={back}/><div className="main"><Skeleton/></div></>
  return <><Bar title={tl("Gradebook")} sub={d.course+' · '+pl(d.tests.length,'test')} back={back}/><div className="main">
    {!d.tests.length?<p className="known">{tl("No published tests or quizzes in this course yet.")}</p>:<>
    <p className="known" style={{marginTop:0}}>{tl("Each cell is a student's final (best) score. The final course score is the average of the tests they took. Tap a student or a test to drill down.")}</p>
    <div className="gbwrap pgtop" ref={top}><table className="gb"><thead><tr><th>{tl("Student")}</th>{d.tests.map(t=><th key={t.id}><button className="tool" onClick={()=>setOpen(t.id)} title={t.unit||tl("Course test")}>{t.title}</button><small>{tl("avg {v}%",{v:t.average??'–'})}</small></th>)}<th>{tl("Final")}</th></tr></thead>
      <tbody>{gb.items.map(r=><tr key={r.user_id}><td><button className="tool" onClick={()=>setStu(r)}>{r.name}</button></td>{r.scores.map((v,i)=><td key={i} className={v==null?'na':v>=d.tests[i].pass_percent?'':'low'}>{v==null?'–':v+'%'}</td>)}<td><b>{r.final==null?'–':r.final+'%'}</b><small>{r.taken}/{d.tests.length}</small></td></tr>)}</tbody></table></div>
    <Pager page={gb.page} total={gb.total} onPage={gb.setPage} anchor={top}/>
    <p className="known">{tl("A dash means not taken. Scores below a test's pass mark are marked with a lighter background.")}</p>
    <button className="btn ghost" onClick={()=>fetchFile(`/courses/${cid}/gradebook?format=csv`,'gradebook-'+d.course.replace(/\s+/g,'_')+'.csv',toast)}>{tl("Download gradebook CSV")}</button></>}</div></>}
function ScoreCourse({c,back,toast,role}){  // one course of a student's scores: each test, then its attempts
  const [q,setQ]=useState(null)
  if(q)return <MyAttempts quiz={q} back={()=>setQ(null)} toast={toast} role={role}/>
  return <><Bar title={c.course} sub={tl("Final score {v} · {taken} of {length} taken",{v:c.final==null?'–':c.final+'%',taken:c.taken,length:c.tests.length})} back={back}/><div className="main">
    {<Paged rows={c.tests} render={t=><button key={t.id} className="row rowbtn" disabled={!t.attempts} onClick={()=>setQ(t.id)}><div>{t.title}{t.attempts>0&&t.passed&&<PassPill ok/>}<small>{t.unit||tl("Course test")}{" "}{tl("· {v} · pass {pass_percent}%",{v:t.attempts?`best ${t.best}% · latest ${t.latest}% · ${pl(t.attempts,'attempt')}`:'not taken yet',pass_percent:t.pass_percent})}</small>{t.attempts>0&&<Bar2 v={t.best}/>}</div>{t.attempts>0&&<ChevronRight size={18}/>}</button>}/>}
    <p className="known">{tl("Your final score in a test is your best attempt. The course score is the average of the tests you have taken.")}</p></div></>}
function MyScores({onCourse}){  // a student's final score per course
  const [d,setD]=useState(null)
  useEffect(()=>{api('/me/scores').then(setD).catch(()=>setD({courses:[]}))},[])
  if(!d)return null
  if(!d.courses.length)return <p className="known">{tl("No test results yet.")}</p>
  return <><h3 className="sec first">{tl("Scores")}</h3>{<Paged rows={d.courses} render={x=><button key={x.course_id} className="row rowbtn" onClick={()=>onCourse(x)}><div>{x.course}<small>{x.final==null?tl("No tests taken yet"):tl("Final score {final}%",{final:x.final})}{" "}{tl("· {taken} of {length} taken · {passed} passed",{taken:x.taken,length:x.tests.length,passed:x.passed})}</small>{x.final!=null&&<Bar2 v={x.final}/>}</div><ChevronRight size={18}/></button>}/>}</>}
// the next step in a course the student built, and topics ready to look at again: no streaks, points or levels
export function LearnCard({me,onContinue,onReview}){
  if(!me)return null
  return <div className="learn">
    {me.next&&<button className="btn" onClick={()=>onContinue(me.next)}><Play size={16}/> {me.next.done?tl("Continue"):tl("Start")}: {me.next.topic}<small className="sub">{me.next.course}</small></button>}
    {me.reviews_due>0&&<button className="btn ghost" onClick={()=>onReview(me.review_courses[0].course_id)}><RotateCcw size={16}/>{" "}{tl("Look again at {n}",{n:pl(me.reviews_due,'topic')})}</button>}</div>}
export function StudyQuizPlay({quiz,toast,back,again,next}){
  const mcq=quiz.kind!=='quiz',[ans,setAns]=useState(quiz.questions.map(()=>null)),[fb,setFb]=useState({}),[res,setRes]=useState(null),[busy,setBusy]=useState(false),[sit]=useState(rid)  // sit: sent with every try of this submit, so a retry counts once
  const [flagged,setFlagged]=useState({})
  const flag=async i=>{try{await api(`/study/quizzes/${quiz.id}/flag`,{method:'POST',body:{index:i}});setFlagged(f=>({...f,[i]:true}));toast(tl("Thanks. That question won't come back in your reviews."))}catch(e){toast(e.message)}}
  const pick=async(i,k)=>{if(res||(mcq&&fb[i]))return;setAns(a=>a.map((v,n)=>n===i?k:v));if(!mcq)return
    try{const r=await api(`/study/quizzes/${quiz.id}/check`,{method:'POST',body:{index:i,answer:k}});setFb(f=>({...f,[i]:r}))}catch(e){toast(e.message)}}
  const submit=async()=>{setBusy(true);try{setRes(await api(`/study/quizzes/${quiz.id}/attempt`,{method:'POST',body:{answers:ans,request_id:sit}}));window.scrollTo(0,0)}catch(e){toast(e.message)}setBusy(false)}
  const left=ans.filter(a=>a==null).length,review=quiz.kind==='review',label=review?'Review':mcq?'Quick check':'Full quiz'
  return <><Bar title={label} sub={quiz.topic+' · '+pl(quiz.questions.length,'question')} back={back}/><div className="main">
    {res&&<div className="qbox score" style={{marginTop:0}} role="status">
      <h2 style={{margin:0}}>{res.score} / {res.total} · {res.percent}%</h2><ResultFacts r={res}/>
      <p className="known">{review?tl("Review done."):mcq?tl("Done. The answers are below."):tl("Done. A new set is there whenever you want one.")}{res.summary&&' '+res.summary}{res.next_review&&' '+res.next_review+'.'}</p>
      {next&&<button className="btn" onClick={next.go}>{tl("Next topic: {title}",{title:next.title})}{" "}<ChevronRight size={16}/></button>}
      <div className="two">{again&&<button className={'btn'+(next?' ghost':'')} onClick={()=>again(quiz.kind)}>{tl("New")}{" "}{mcq?'questions':'quiz'}</button>}<button className={'btn'+(again||next?' ghost':'')} onClick={back}>{review?tl("Done"):tl("Back to the topic")}</button></div></div>}
    {res&&!mcq&&res.areas.length>0&&<><h3 className="sec">{tl("What you know well and what to revisit")}</h3><AreaList areas={res.areas} onStudy={null} staff/></>}
    {quiz.questions.map((x,i)=>{const f=mcq?fb[i]:res&&res.results[i]
      return <div className="qbox" key={i}><b>{tl("Question")}{" "}{i+1}{f?(f.ok?tl(" · Right"):tl(" · Wrong")):''}</b>{x.topic&&<small className="known" style={{display:'block'}}>{x.topic}</small>}<div className="prose"><Md>{x.text}</Md></div>
        {x.options.map((o,k)=>{const cls=f?(k===f.correct?' ok':k===ans[i]?' bad':''):ans[i]===k?' sel':''
          return <button key={k} className={'opt'+cls} disabled={!!f||!!res} aria-pressed={ans[i]===k} onClick={()=>pick(i,k)}><b className="olet">{LET[k]}</b><span className="obody"><Md>{o}</Md></span>{f&&k===f.correct&&<span className="otag ok"><Check size={14}/>{" "}{tl("Correct")}</span>}</button>})}
        {f&&f.explanation&&<div className="known"><Md>{f.explanation}</Md></div>}
        {f&&(flagged[i]?<p className="known" style={{margin:'4px 0 0'}}>{tl("Reported.")}</p>:<button className="tool" onClick={()=>flag(i)}>{tl("This question is wrong")}</button>)}</div>})}
    {!res&&<><button className="btn" disabled={busy||(mcq&&Object.keys(fb).length<quiz.questions.length)} onClick={submit}>{busy?tl("Checking…"):mcq?tl("See my score"):tl("Submit answers")}</button>
      {mcq?<p className="known">{tl("Pick an answer to see right away if it is right.")}{Object.keys(fb).length<quiz.questions.length?tl(" {v} to go.",{v:quiz.questions.length-Object.keys(fb).length}):''}</p>:left>0&&<p className="known">{left}{" "}{tl("unanswered. Blank answers count as wrong.")}</p>}</>}</div></>}

function CopySheet({kind,id,title,close,toast}){
  const [tree,setTree]=useState(null),[cid,setCid]=useState(''),[uid,setUid]=useState(''),[wq,setWq]=useState(true),[busy,setBusy]=useState(false),[res,setRes]=useState(null)
  useEffect(()=>{api('/tree').then(setTree).catch(e=>{toast(e.message);close()})},[toast,close])
  const courses=(tree||[]).flatMap(p=>p.semesters.flatMap(s=>s.courses.filter(c=>c.editable&&!c.shared).map(c=>({...c,label:`${p.name} › ${s.name} › ${c.name}`}))))
  const dest=courses.find(c=>String(c.id)===cid)
  const run=async()=>{setBusy(true);try{setRes(await api(`/${kind==='topic'?'topics':'units'}/${id}/copy`,{method:'POST',body:kind==='topic'?{unit_id:+uid}:{course_id:+cid,with_quizzes:wq}}))}catch(e){toast(e.message)}setBusy(false)}
  if(res)return <Sheet close={close}><h3>{tl("Copied")}</h3><p className="known">{kind==='topic'?tl("“{title}” is a draft in {label} › {name}.",{title:res.title,label:dest.label,name:dest.units.find(u=>u.id===res.unit_id)?.name}):tl("“{name}” is in {label} with {n}{v}.",{name:res.name,label:dest.label,n:pl(res.topics,'topic'),v:res.quizzes?` and ${pl(res.quizzes,'quiz')}`:''})}{" "}{tl("Everything arrives as a draft, so students see nothing until you publish it.")}</p><button className="btn" onClick={close}>{tl("Done")}</button></Sheet>
  return <Sheet close={close}><h3>{tl("Copy")}{" "}{kind==='topic'?'topic':'unit'}</h3><p className="known">{tl("Makes a copy of “{title}”{v} in a course you can edit. The original is not changed. Reading progress and bookmarks are not copied.",{title:title,v:kind==='unit'?' with its topics'+(' and, if you may edit the original, its quizzes'):''})}</p>
    {!tree?<div className="sk"/>:!courses.length?<p className="known">{tl("You do not own a course to copy into. An admin makes you the owner of a course.")}</p>:<>
      <label htmlFor="cc">{tl("Copy into course")}</label><select id="cc" value={cid} onChange={e=>{setCid(e.target.value);setUid('')}}><option value="">{tl("Choose a course")}</option>{courses.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
      {kind==='topic'&&dest&&<><label htmlFor="cu">{tl("Unit")}</label><select id="cu" value={uid} onChange={e=>setUid(e.target.value)}><option value="">{tl("Choose a unit")}</option>{dest.units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>{!dest.units.length&&<p className="known">{tl("That course has no units yet. Add a unit first.")}</p>}</>}
      {kind==='unit'&&<label className="chk"><input type="checkbox" checked={wq} onChange={e=>setWq(e.target.checked)}/>{" "}{tl("Include its quizzes (as drafts)")}</label>}</>}
    <button className="btn" disabled={busy||!dest||(kind==='topic'&&!uid)} onClick={run}>{busy?tl("Copying…"):tl("Copy")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}
const FIELD_LABEL=L({title:'Title',content:'Notes',content_format:'Content format',sample_content:'Sample answer',question_pattern:'Question pattern',guideline:'Answer guideline'})
const lineDiff=(a,b)=>{const x=a.split('\n'),y=b.split('\n'),n=x.length,m=y.length
  if(n*m>250000)return [...x.map(t=>({k:'del',t})),...y.map(t=>({k:'add',t}))]  // very long texts: show both rather than spend the time
  const L=Array.from({length:n+1},()=>new Uint16Array(m+1))
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=x[i]===y[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1])
  const out=[];let i=0,j=0
  while(i<n&&j<m){if(x[i]===y[j]){out.push({k:'same',t:x[i]});i++;j++}else if(L[i+1][j]>=L[i][j+1])out.push({k:'del',t:x[i++]});else out.push({k:'add',t:y[j++]})}
  while(i<n)out.push({k:'del',t:x[i++]});while(j<m)out.push({k:'add',t:y[j++]});return out}
function HistorySheet({tid,close,done,toast}){
  const confirm=useConfirm()
  const [list,setList]=useState(null),[v,setV]=useState(null),[busy,setBusy]=useState(false)
  useEffect(()=>{api(`/topics/${tid}/versions`).then(setList).catch(e=>{toast(e.message);close()})},[tid,toast,close])
  const open=async x=>{try{setV({...(await api('/topic-versions/'+x.id)),current:x.current})}catch(e){toast(e.message)}}
  const restore=async()=>{if(!await confirm({title:tl("Put this version back?"),body:tl("What is there now stays in the history, so you can undo it."),ok:tl("Restore version")}))return;setBusy(true)
    try{await api(`/topic-versions/${v.id}/restore`,{method:'POST'});toast(tl("Version restored"));done()}catch(e){toast(e.message);setBusy(false)}}
  if(v){const changed=Object.keys(FIELD_LABEL).filter(k=>v[k]!==v.now[k])
    return <Sheet close={close}><button className="link" onClick={()=>setV(null)}><ChevronLeft size={16}/>{" "}{tl("All versions")}</button>
      <h3>{v.saved_at?when(v.saved_at):tl("Earlier version")}</h3><p className="known">{v.note}{v.current?tl(" · this is the current text"):''}</p>
      {!changed.length&&<p className="known">{tl("Same as the current text.")}</p>}
      {changed.map(k=><div key={k} className="qbox"><b>{FIELD_LABEL[k]}</b><p className="known" style={{margin:'2px 0 8px'}}>{tl("Red lines are in this version only. Green lines are in the current text.")}</p>
        <div className="diff">{lineDiff(v[k],v.now[k]).map((l,i)=><div key={i} className={'dl '+l.k}>{l.t||'\u00a0'}</div>)}</div></div>)}
      {!v.current&&<button className="btn" disabled={busy} onClick={restore}>{tl("Restore this version")}</button>}<button className="btn ghost" onClick={close}>{tl("Close")}</button></Sheet>}
  return <Sheet close={close}><h3>{tl("Version history")}</h3><p className="known">{tl("Every save is kept (the latest {v}). Pick one to compare it with the current text.",{v:100})}</p>
    {!list?<div className="sk"/>:!list.length?<p className="known">{tl("No versions recorded yet. They appear the next time this topic is saved.")}</p>
      :<Paged rows={list} render={x=><button key={x.id} className="row" style={{width:'100%',textAlign:'start',background:'none'}} onClick={()=>open(x)}><div>{x.saved_at&&!(x.by===null&&x.note.startsWith('Before'))?when(x.saved_at):tl("Before history began")}<small>{x.note}{x.by?' · '+x.by:''}</small></div>{x.current&&<span className="pill">{tl("Current")}</span>}<ChevronRight size={16}/></button>}/>}
    <button className="btn ghost" onClick={close}>{tl("Close")}</button></Sheet>}
export function Topic({id:first,back,toast,role,tab0}){
  const confirm=useConfirm()
  const {aiOff}=useContext(Ctx)
  useLearnClock()  // a lite person's learning minutes
  const [mcq,setMcq]=useState(false),[report,setReport]=useState(false),[practice,setPractice]=useState(null),[checking,setChecking]=useState(''),[reading,setReading]=useState(false),[hls,setHls]=useState([]),[tr,setTr]=useState(null)
  useEffect(()=>{setTr(null)},[first])
  const [id,setId]=useState(first),[editing,setEditing]=useState(false),[v,setV]=useState(0),[t,setT]=useState(null),[tab,setTab]=useState(tab0||'notes'),[known,setKnown]=useState([]),[ai,setAi]=useState({}),[aiOk,setAiOk]=useState(null),[ownKey,setOwnKey]=useState(false),[aiMsg,setAiMsg]=useState(''),[busy,setBusy]=useState(false),[bm,setBm]=useState(false),[pv,setPv]=useState(false),[hist,setHist]=useState(false),[cp,setCp]=useState(false),[gone,setGone]=useState('')
  const [mat,setMat]=useState(false),[askT,setAskT]=useState(false),[upNext,setUpNext]=useState(null),opened=useRef(false),jump=nid=>{opened.current=false;setUpNext(null);setGone('');setT(null);setTab('notes');setAi({});setAiMsg('');setKnown([]);setEditing(false);setId(nid);window.scrollTo(0,0)},learn=r=>setT(p=>({...p,status:r.status,overdue:r.overdue,late:r.late,completed_at:r.completed_at}))
  useEffect(()=>{api('/topics/'+id).then(x=>{setT(x);setBm(!!x.bookmarked)
    if(!opened.current){opened.current=true;api(`/topics/${id}/read`,{method:'POST'}).then(r=>{setKnown(r.known);learn(r)}).catch(()=>{})}}).catch(e=>{toast(e.message);if(/unavailable right now/.test(e.message))setGone(e.message)})},[id,v])  // opening starts it, after the page has loaded
  const redo=async()=>{if(!await confirm({title:tl("Start this topic over?"),body:tl("It goes back to not started, so you can study it again. Your quiz scores and your streak stay."),ok:tl("Start over")}))return
    try{await api(`/topics/${id}/redo`,{method:'POST'});setT(p=>({...p,status:'not_started',completed_at:null}));toast(tl("Started over"))}catch(e){toast(e.message)}}
  const setDone=async on=>{try{learn(await api(`/topics/${id}/complete`,{method:on?'PUT':'DELETE'}));toast(on?tl("Marked as completed"):tl("Marked as not completed"))}catch(e){toast(e.message);return}
    setUpNext(null);if(!on||role!=='student')return
    try{const items=(await api('/me/session')).session?.items||[];if(items.some(x=>x.id===id&&x.kind!=='review'&&x.src!=='study'))setUpNext({items,next:items.find(x=>!x.done)})}catch{/* no session today: nothing to lead on to */}}
  useEffect(()=>{api('/ai/status').then(r=>{setAiOk(r.available);setOwnKey(!!r.own_key)}).catch(()=>{})},[id])
  useEffect(()=>{setHls([]);api(`/topics/${id}/highlights`).then(r=>setHls(r.items)).catch(()=>{})},[id,v])
  const dropHl=async h=>{try{await api('/me/highlights/'+h.id,{method:'DELETE'});setHls(l=>l.filter(x=>x.id!==h.id));toast(tl("Highlight removed"))}catch(e){toast(e.message)}}
  const ask=async k=>{setBusy(true);setAiMsg('');try{const r=await api(`/topics/${id}/ai/${k}`);setAi(a=>({...a,[k]:r}))}catch(e){setAiMsg(e.message)}setBusy(false)}
  async function practise(kind){setChecking(kind);try{setPractice(await api(`/topics/${id}/practice`,{method:'POST',body:{kind}}))}catch(e){toast(e.message)}setChecking('')}
  if(mat&&t)return <MyMaterial cid={t.course_id} name={t.course} back={()=>{setMat(false);setAi({});setAiMsg('');setV(v+1)}} toast={toast}/>  // clear saved answers: the notes may have changed, so Explain must be asked again
  if(mcq)return <McqHome topic={id} toast={toast} back={()=>setMcq(false)} openTopic={nid=>{setMcq(false);jump(nid)}}/>  // the Per topic way in
  if(practice)return <StudyQuizPlay quiz={practice} toast={toast} back={()=>setPractice(null)} again={k=>practise(k)}/>
  if(editing)return <TopicEditor role={role} toast={toast} edit={{id}} done={()=>{setEditing(false);setV(v+1)}} cancel={()=>setEditing(false)}/>
  if(gone)return <><Bar title={tl("Unavailable")} back={back}/><div className="main"><div className="hero"><h2>{gone}</h2><p>{tl("It has been archived. Check back later or ask your teacher.")}</p></div></div></>
  if(!t)return <><Bar title={tl("Loading")} back={back}/><div className="main"><div className="sk"/><div className="sk"/></div></>
  const flip=async()=>{const on=!bm;setBm(on);try{await api(`/topics/${id}/bookmark`,{method:on?'PUT':'DELETE'});toast(on?tl("Bookmarked"):tl("Bookmark removed"))}catch(e){setBm(!on);toast(e.message)}}
  const view=k=>ai[k]?<div className="prose">{ai[k].cached&&<span className="chip">{tl("Saved answer · no tokens used")}</span>}{ai[k].own_notes&&<span className="chip">{tl("Written with your own notes")}</span>}<Md>{ai[k].text}</Md><FlagLink source="topic" id={ai[k].id} topicId={id} excerpt={ai[k].text}/></div>
    :aiOk===false?<p className="known">{aiOff?tl("AI help is off. A parent or teacher can turn it on by adding their AI key to their account."):ownKey?tl("Add your own AI key under “My AI key” in the menu to use AI help."):tl("AI unavailable. Try again later.")}</p>
    :<>{aiMsg&&<p className="known" role="alert">{aiMsg}</p>}  {/* after a failed try: what went wrong, then the same request again */}
      <button className="btn" disabled={busy} onClick={()=>ask(k)}><Sparkles size={16}/> {busy?tl("Thinking…"):aiMsg?tl("Try again"):k==='explain'?tl("Explain it to me"):tl("Show a sample answer")}</button>{t.my_notes&&<p className="known">{tl("Uses your own notes too. It counts toward your daily AI requests.")}</p>}</>
  return <><Bar title={t.title} sub={[t.program,t.semester,t.course,t.unit].filter(Boolean).join(' › ')} back={back} right={role!=='admin'&&<button className={'ic'+(bm?' on':'')} aria-label={bm?tl("Remove bookmark"):tl("Bookmark this topic")} aria-pressed={bm} onClick={flip}><Bookmark fill={bm?'currentColor':'none'}/></button>}/><div className="main">
    {t.can_edit&&pv&&<div className="qbox" style={{marginTop:0}}><b>{tl("Previewing as a student")}</b><p className="known" style={{margin:'4px 0 8px'}}>{tl("This is what students see: no editing buttons, and drafts show as unavailable to them.")}</p><button className="btn ghost" style={{marginTop:0}} onClick={()=>setPv(false)}>{tl("Back to editing")}</button></div>}
    {t.can_edit&&!pv&&<div className="two" style={{marginBottom:12}}><button className="btn ghost" style={{marginTop:0}} onClick={()=>setEditing(true)}><Pencil size={16}/>{" "}{tl("Edit topic")}</button>
      <button className="btn ghost" style={{marginTop:0}} onClick={async()=>{if(!t.published&&t.empty&&!await confirm({title:tl("Publish a topic with no notes?"),body:tl("Students will see that it has no notes yet and can only bring their own. Add its notes first, or publish it anyway."),ok:tl("Publish anyway")}))return  // nothing to study yet
        try{await api(`/topics/${id}/publish`,{method:'PUT',body:{published:!t.published}});toast(t.published?tl("Moved to drafts"):tl("Published"));setV(v+1)}catch(e){toast(e.message)}}}>{t.published?<><EyeOff size={16}/>{" "}{tl("Unpublish")}</>:<><Eye size={16}/>{" "}{tl("Publish")}</>}</button></div>}
    {role!=='student'&&<div className="qbox" style={{marginTop:0}}><div className="row"><div>{t.learning_due_at?when(t.learning_due_at):tl("No deadline")}<small>{tl("Learn by")}</small></div></div></div>}
    {upNext&&<div className="qbox" role="status"><b>{tl("Today's session · {length} of {length2} done",{length:upNext.items.filter(x=>x.done).length,length2:upNext.items.length})}</b>
      {!upNext.next?<p className="known" style={{margin:'4px 0 0'}}>{tl("That's today's session done. See you next study day.")}</p>
        :upNext.next.kind!=='review'&&upNext.next.src!=='study'?<button className="btn" onClick={()=>jump(upNext.next.id)}>{tl("Next:")}{" "}{upNext.next.title}<ChevronRight size={16}/></button>
        :<button className="btn ghost" onClick={back}>{tl("Back for the next part:")}{" "}{upNext.next.title}</button>}</div>}
    {t.can_edit&&!pv&&<><button className="tool" onClick={()=>setPv(true)}><Eye size={14}/>{" "}{tl("Preview as student")}</button><button className="tool" onClick={()=>setHist(true)}><History size={14}/>{" "}{tl("Version history")}</button></>}
    {role!=='student'&&!pv&&<button className="tool" onClick={()=>setCp(true)}><Copy size={14}/>{" "}{tl("Copy to another course")}</button>}
    {cp&&<CopySheet kind="topic" id={id} title={t.title} toast={toast} close={()=>setCp(false)}/>}
    {hist&&<HistorySheet tid={id} toast={toast} close={()=>setHist(false)} done={()=>{setHist(false);setV(v+1)}}/>}
    {t.can_edit&&!t.published&&<p className="known" style={{marginTop:0}}>{tl("Draft · students cannot see it")}</p>}
    {aiOk&&(t.content||t.my_notes)&&<TopicSteps id={id} student={role==='student'} diagram={pv&&t.diagram?'on':t.diagram}/>}  {/* no gist from a topic's name alone: from its notes, or the student's own */}
    {aiOff?<p className="known">{tl("AI help is off. A parent or teacher can turn it on by adding their AI key to their account.")}</p>:<Tabs label={tl("Topic sections")} items={[['notes',tl("Notes")],['explain',tl("Explain")],['answer',tl("Sample answer")],['revise',tl("Revise")]]} value={tab} onChange={setTab}/>}
    {known.length>0&&tab==='explain'&&<p className="known">{tl("You’ve already covered:")}{" "}{known.join(', ')}</p>}
    {tab==='notes'&&t.content&&<button className="btn lead" onClick={()=>setReading(true)}><Maximize2 size={16}/> {t.content_format==='interactive'?tl("Open the interactive page"):tl("Read in full screen")}</button>}
    {tab==='notes'&&<NotesLang t={t} aiOk={aiOk} tr={tr} setTr={setTr}/>}
    {tab==='notes'&&<div className="prose">{t.content?(t.content_format==='interactive'?<p className="known" style={{margin:0}}>{tl("This topic is an interactive page. Open it above to use it and highlight its text.")}</p>:<Body text={tr?.on&&tr.content?tr.content:t.content} format={t.content_format}/>):!t.my_notes&&(role==='student'?<div className="qbox" style={{marginTop:0}}><b>{tl("This topic has no notes yet")}</b><p className="known" style={{margin:'4px 0 8px'}}>{tl("Bring your own notes for this course. They are filed under its topics, for you only, and you study them here.")}</p><button className="btn" onClick={()=>setMat(true)}><FileText size={16}/>{" "}{tl("Bring your own notes")}</button></div>:<Md>{tl("No notes yet.")}</Md>)}{t.my_notes&&<>{t.content&&<h3>{tl("Your notes")}</h3>}{!t.content&&<span className="chip">{tl("Your notes")}</span>}<Md>{t.my_notes}</Md></>}{t.question_pattern&&<><h3>{tl("Question pattern")}</h3><Md>{t.question_pattern}</Md></>}{t.guideline&&<><h3>{tl("Answer guideline")}</h3><Md>{t.guideline}</Md></>}{role==='student'&&(t.content||t.my_notes)&&<button className="tool" onClick={()=>setMat(true)}><FileText size={14}/> {t.my_notes?tl("Update your notes for this course"):tl("Add your own notes for this topic")}</button>}</div>}
    {tab==='notes'&&hls.length>0&&<><h3 className="sec">{tl("Your highlights ({length})",{length:hls.length})}</h3>{<Paged rows={hls} render={h=><HlItem key={h.id} h={{...h,tid:id}} toast={toast} onSaved={r=>setHls(l=>l.map(x=>x.id===r.id?r:x))} onDrop={()=>dropHl(h)}/>}/>}</>}
    {tab==='explain'&&view('explain')}{(tab==='answer'||(aiOff&&tab==='notes'))&&<ModelAnswer t={t} canEdit={!!t.can_edit&&!pv} toast={toast} onSaved={m=>setT(p=>({...p,model_answer:m}))}/>}{tab==='answer'&&(aiOk===false?view('answer'):<><Outline id={id}/>{ai.answer?view('answer'):<button className="btn ghost" disabled={busy} onClick={()=>ask('answer')}>{busy?tl("Thinking…"):tl("Show the full sample answer")}</button>}{!ai.answer&&aiMsg&&<p className="known">{aiMsg}</p>}</>)}
    {tab==='revise'&&!aiOff&&<TopicRevision id={id} toast={toast}/>}
    {reading&&<Reader t={t} auto={role==='student'} toast={toast} onList={setHls} close={()=>setReading(false)}/>}
    {role!=='guardian'&&t.published!==false&&<button className="btn ghost" onClick={()=>setMcq(true)}><ListChecks size={16}/>{" "}{tl("MCQ practice on this topic")}</button>}
    {role==='student'&&aiOk!==false&&(!t.empty||t.my_notes)&&<><h3 className="sec">{tl("Want to test yourself?")}</h3><div className="two"><button className="btn ghost" disabled={!!checking} onClick={()=>practise('mcq')}><ClipboardList size={16}/> {checking==='mcq'?tl("Writing questions…"):tl("5 quick questions")}</button><button className="btn ghost" disabled={!!checking} onClick={()=>practise('quiz')}><Target size={16}/> {checking==='quiz'?tl("Writing the quiz…"):tl("Full quiz · 10")}</button></div>
      <p className="known" style={{marginTop:4}}>{tl("New questions from this topic's notes each time. 5 quick questions: the answer right after each one. Full quiz: scored at the end.")}</p></>}
    {role==='student'&&<div className="mine"><span>{t.learning_due_at&&<>{tl("Your teacher's date")}: {day(t.learning_due_at)} · </>}{t.status==='completed'?tl("You marked this as learned"):tl("Not marked as learned yet")}</span>
      {t.status==='completed'?<button className="link" onClick={()=>setDone(false)}>{tl("Undo")}</button>:<button className="link" onClick={()=>setDone(true)}>{tl("I've learned this")}</button>}
      {t.status!=='not_started'&&<button className="link" onClick={redo}>{tl("Start over")}</button>}</div>}
    <TopicResources t={t} toast={toast}/>
    {t.published!==false&&<ClassQuestions tid={t.id}/>}
    {t.ask&&t.published!==false&&<button className={'btn ghost'+(t.ask==='pro'?' locked':'')} onClick={()=>t.ask==='pro'?toast(tl("Asking your teacher comes with Pro. See AI help on your profile.")):setAskT(true)}>{t.ask==='pro'?<Lock size={16}/>:<MessageCircle size={16}/>}{" "}{tl("Ask my teacher")}{t.ask==='pro'&&<span className="pill sm">{tl("Pro")}</span>}</button>}
    {askT&&<AskTeacher tid={t.id} close={()=>setAskT(false)} toast={toast}/>}
    {role==='student'&&t.published!==false&&<p><button className="link" onClick={()=>setReport(true)}><Flag size={14}/>{" "}{tl("Report a problem with these notes")}</button></p>}
    {report&&<NotesReport tid={t.id} close={()=>setReport(false)} toast={toast}/>}
    {t.nav&&t.nav.total>1&&<nav className="pager" aria-label={tl("Topics in this unit")}><button className="btn ghost" disabled={!t.nav.prev} onClick={()=>jump(t.nav.prev.id)} aria-label={t.nav.prev?tl("Previous topic: {title}",{title:t.nav.prev.title}):tl("No previous topic")}><ChevronLeft size={18}/><span>{t.nav.prev?t.nav.prev.title:tl("Previous")}</span></button>
      <small>{t.nav.position}{" "}{tl("of")}{" "}{t.nav.total}</small>
      <button className={'btn'+(t.nav.next?'':' ghost')} disabled={!t.nav.next} onClick={()=>jump(t.nav.next.id)} aria-label={t.nav.next?tl("Next topic: {title}",{title:t.nav.next.title}):tl("No next topic")}><span>{t.nav.next?t.nav.next.title:tl("Next")}</span><ChevronRight size={18}/></button></nav>}</div></>}

// the top of a topic page: the gist and one curious question, then short steps the reader picks (Why?, Example, Exam angle, Quick check).
// Every reply is a few lines and saved for everyone; the notes below stay the reference
const STEP_KINDS=L([['why',tl("Why?")],['example',tl("Example")],['exam',tl("Exam angle")],['check',tl("Quick check")]])
const STEP_LABEL=k=>k==='simpler'?tl("More simply"):STEP_KINDS.find(x=>x[0]===k)?.[1]
const Reveal=({label,children})=>{const [on,setOn]=useState(false);return on?<div className="reveal">{children}</div>:<button className="link" onClick={()=>setOn(true)}>{label}</button>}
const Hook=({q,a})=><div className="hook"><p>{q}</p>{a&&<Reveal label={tl("Think, then tap for the answer")}><Md>{a}</Md></Reveal>}</div>
// after a quick check's answer: the student's own private "I had it" / "Not quite"; not quite offers the idea again, more simply
function SelfMark({id,onSimpler}){
  const [got,setGot]=useState('')
  const mark=async o=>{setGot(o);try{await api(`/topics/${id}/check-result`,{method:'POST',body:{outcome:o}})}catch{/* only a hint for next time */}}
  if(got==='knew')return <p className="known selfm">{tl("Nice. The next ones will stretch you a little more.")}</p>
  if(got==='not_yet')return <p className="known selfm">{tl("That's fine, it takes a few goes.")}{onSimpler&&<>{" "}<button className="link inl" onClick={onSimpler}>{tl("Explain it more simply")}</button></>}</p>
  return <div className="selfm" role="group" aria-label={tl("How did it go? Only you see this")}><button className="stepchip" onClick={()=>mark('knew')}>{tl("I had it")}</button><button className="stepchip" onClick={()=>mark('not_yet')}>{tl("Not quite")}</button><small className="known">{tl("Only you see this")}</small></div>}
function StepCard({id,rid,k,d,student,onSimpler}){
  return <div className={'stepcard '+k}><small className="steplab">{STEP_LABEL(k)}</small>
    {k==='why'||k==='example'||k==='simpler'?<><Md>{d.text||''}</Md>{d.hook&&<p className="hookq">{d.hook}</p>}</>
      :<><div className="stepq"><Md>{d.question||''}</Md></div><Reveal label={k==='exam'?tl("Show a model answer"):tl("Show the answer")}><Md>{d.answer||''}</Md>{d.tip&&<p className="known">{tl("Examiners look for")}: {d.tip}</p>}{k==='check'&&student&&<SelfMark id={id} onSimpler={onSimpler}/>}</Reveal></>}<FlagLink source="topic" id={rid} topicId={id}/></div>}
// the top of a topic page: the gist and one curious question, then short steps the reader picks. It adapts to each student, privately:
// the steps they use most come first, quick checks get easier or harder from their own "I had it" / "Not quite", and after a few topics
// in a unit the question comes first with the gist one tap away. Every reply is a few lines and saved for everyone; the notes stay the reference
function TopicSteps({id,student,diagram}){
  const [g,setG]=useState(null),[you,setYou]=useState(null),[err,setErr]=useState(''),[trail,setTrail]=useState([]),[busy,setBusy]=useState(''),[open,setOpen]=useState(false)
  const [gid,setGid]=useState(null),[own,setOwn]=useState(false),[dia,setDia]=useState({busy:false,url:'',msg:''})
  // the topic's diagram, when its teacher turned one on: drawn by the AI once, then shared; on Lite the server says it comes with Pro
  const diagramOpen=async()=>{setDia({busy:true,url:'',msg:''});try{const u=(await api(`/topics/${id}/diagram`)).frame_url,off=`./diagram-offline/${id}`
    try{const r=await fetch(at(u));if(!r.ok)throw 0;const h=await r.text()  // kept for offline, with the frame's own sandbox rules
      caches.open('zg-frames').then(c=>c.put(new URL(off,location.href).href,new Response(h,{headers:{'Content-Type':'text/html','Content-Security-Policy':r.headers.get('content-security-policy')||"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"}}))).catch(()=>{})
      setDia({busy:false,url:at(u),msg:''})}
    catch{const k=await caches.match(new URL(off,location.href).href,{cacheName:'zg-frames'}).catch(()=>null);setDia(k?{busy:false,url:off,msg:''}:{busy:false,url:'',msg:tl("You're offline. Topics you have opened before still work.")})}}
    catch(e){setDia({busy:false,url:'',msg:e.message})}}
  useEffect(()=>{setG(null);setYou(null);setOpen(false);setErr('');setTrail([]);api(`/topics/${id}/ai/gist`).then(r=>{setG(r.data);setGid(r.id);setYou(r.you||null);setOwn(!!r.own_notes)}).catch(e=>setErr(e.message))},[id])
  const step=async k=>{setBusy(k);setErr('');try{const r=await api(`/topics/${id}/ai/${k}`);setTrail(x=>[...x.filter(y=>y.k!==k),{k,d:r.data,rid:r.id,raw:r.text}])}catch(e){setErr(e.message)}setBusy('')}
  const again=()=>{setErr('');api(`/topics/${id}/ai/gist`).then(r=>{setG(r.data);setGid(r.id);setYou(r.you||null);setOwn(!!r.own_notes)}).catch(e=>setErr(e.message))}
  if(err&&!g)return <section className="gist" role="status"><h3>{tl("The gist didn't load.")}</h3><p className="known" style={{margin:'4px 0 8px'}}>{srv(err)} {tl("The notes below are all here.")}</p>
    <button className="btn ghost" onClick={again}>{tl("Try again")}</button></section>  // never a silent gap; the notes stay the reference
  const order=you?.order||STEP_KINDS.map(x=>x[0]),left=order.filter(k=>!trail.some(x=>x.k===k)).map(k=>[k,STEP_LABEL(k)])
  const qFirst=you?.question_first&&!open&&g?.hook
  return <section className="gist" aria-label={tl("The gist")} aria-busy={!g}>
    {!g?<Skeleton rows={2}/>:qFirst?<><h3>{tl("A question first")}<small>{tl("then the gist")}</small></h3><Hook q={g.hook} a={g.hook_answer}/>
        <button className="link" style={{marginTop:10}} onClick={()=>setOpen(true)}>{tl("Show the gist")}</button></>
      :<><h3>{tl("The gist")}<small>{tl("about 30 seconds")}</small></h3>
        {own&&<span className="chip">{tl("Written with your own notes")}</span>}<ul>{(g.points||[]).map((x,i)=><li key={i}><Md>{x}</Md></li>)}</ul>
        {g.hook&&!open&&<Hook q={g.hook} a={g.hook_answer}/>}<FlagLink source="topic" id={gid} topicId={id}/></>}
    {g&&<>{trail.map(x=><StepCard key={x.k} id={id} rid={x.rid} k={x.k} d={x.d} student={student} onSimpler={trail.some(y=>y.k==='simpler')?null:()=>step('simpler')}/>)}
      {err&&<p className="known" role="alert">{err}</p>}
      {(left.length>0||diagram)&&<div className="stepchips">{left.map(([k,l])=><button key={k} className="stepchip" disabled={!!busy} onClick={()=>step(k)}>{busy===k?tl("Thinking…"):l}</button>)}
        {diagram&&<button className={'stepchip diag'+(diagram==='pro'?' locked':'')} disabled={dia.busy} onClick={diagramOpen}>{diagram==='pro'?<Lock size={14}/>:<Shapes size={14}/>}{" "}{dia.busy?tl("Drawing…"):tl("Diagram")}{diagram==='pro'&&<span className="pill sm">{tl("Pro")}</span>}</button>}</div>}
      {dia.msg&&<p className="known" role="status">{dia.msg}</p>}
      {dia.url&&<div className="diagview" role="dialog" aria-modal="true" aria-label={tl("Diagram")}><div className="diagbar"><b>{tl("Diagram")}</b><button className="ic" aria-label={tl("Close")} onClick={()=>setDia({busy:false,url:'',msg:''})}><X size={18}/></button></div>
        <iframe title={tl("Diagram")} src={dia.url} sandbox="allow-scripts"/></div>}
      {busy==='simpler'&&<p className="known">{tl("Thinking…")}</p>}</>}
  </section>}
// Ask from a photo: snap a question, a paragraph or a diagram in a book. The photo is shrunk in the browser, the server reads its text (nothing leaves),
// the student checks the text and asks. Only that text goes to the AI, unless they say it is about a diagram: then the photo goes to Claude, which can see it
const PHOTO_SIZE=1568
const shrink=file=>new Promise((ok,bad)=>{const fail=()=>bad(new Error(tl("That file is not a photo we can read."))),rd=new FileReader()  // read as data: (the page's CSP allows data: images, not blob:)
  rd.onerror=fail;rd.onload=()=>{const im=new Image()
    im.onload=()=>{const k=Math.min(1,PHOTO_SIZE/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k)
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',0.85))}  // a re-drawn JPEG carries no location or camera details
    im.onerror=fail;im.src=rd.result};rd.readAsDataURL(file)})
// The camera inside the page: a live view and a shutter button. The photo is drawn to a canvas at PHOTO_SIZE, like a chosen photo,
// so only a small JPEG is kept. When the camera can't be opened (no camera, or permission refused) it says so and offers the gallery.
function CameraSheet({close,gallery,shot}){
  const v=useRef(),[err,setErr]=useState(''),[live,setLive]=useState(false)
  useEffect(()=>{let stream,gone=false
    if(!navigator.mediaDevices?.getUserMedia){setErr(tl("This browser can't open the camera here. Choose a photo from your gallery instead."));return}
    navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false}).then(s=>{
      if(gone){s.getTracks().forEach(t=>t.stop());return}stream=s;v.current.srcObject=s;v.current.play().catch(()=>{});setLive(true)
    }).catch(e=>setErr(e?.name==='NotAllowedError'?tl("Camera permission was refused. Allow the camera for this site in your browser, or choose a photo from your gallery."):tl("The camera couldn't be opened. Choose a photo from your gallery instead.")))
    return()=>{gone=true;stream?.getTracks().forEach(t=>t.stop())}},[])
  const take=()=>{const el=v.current,w=el.videoWidth,h=el.videoHeight;if(!w||!h)return
    const k=Math.min(1,PHOTO_SIZE/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k)
    c.getContext('2d').drawImage(el,0,0,c.width,c.height);shot(c.toDataURL('image/jpeg',0.85))}
  return <div className="camsheet" role="dialog" aria-modal="true" aria-label={tl("Take a photo")}>
    <video ref={v} playsInline muted autoPlay/>
    {err&&<p className="camerr">{err}</p>}
    <div className="cambar"><button className="btn ghost" onClick={close}>{tl("Cancel")}</button>
      {live?<button className="shutter" aria-label={tl("Take the photo")} onClick={take}/>:<span/>}
      <button className="btn ghost" onClick={gallery}><ImagePlus size={18}/>{" "}{tl("Gallery")}</button></div>
  </div>}
function PhotoAsk({toast}){
  const [img,setImg]=useState(null),[text,setText]=useState(''),[reading,setReading]=useState(false),[q,setQ]=useState(''),[diagram,setDiagram]=useState(false)
  const [busy,setBusy]=useState(false),[answers,setAnswers]=useState([]),[st,setSt]=useState({}),gal=useRef()
  useEffect(()=>{api('/ai/status').then(setSt).catch(()=>{})},[])
  const [camOn,setCamOn]=useState(false)
  const readPhoto=async d=>{setImg(d);setText('');setAnswers([]);setDiagram(false);setReading(true)
    try{const r=await api('/photo/read',{method:'POST',body:{image:d}});setText(r.text)}catch(er){toast(er.message)}setReading(false)}
  const pick=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return
    let d;try{d=await shrink(f)}catch(er){toast(er.message);return}readPhoto(d)}
  // the camera opens inside the page: handing over to the phone's camera app made Android close the browser tab for memory
  const ask=async(question=q)=>{if(!question.trim())return;setBusy(true)
    try{const r=await api('/photo/ask',{method:'POST',body:{question,text,image:diagram?img:null,diagram}});setAnswers(a=>[{q:question,...r},...a]);setQ('')}catch(er){toast(er.message)}setBusy(false)}
  const quick=diagram?[tl("What does the diagram show?"),tl("Explain the labelled parts")]:[tl("Explain this simply"),tl("Solve it step by step"),tl("What will the exam ask about this?")]
  return <><Bar title={tl("Ask from a photo")} sub={tl("A question, a paragraph or a diagram from your book")}/><div className="main">
    <input ref={gal} type="file" accept="image/*" hidden onChange={pick}/>
    {camOn&&<CameraSheet close={()=>setCamOn(false)} gallery={()=>{setCamOn(false);gal.current.click()}} shot={d=>{setCamOn(false);readPhoto(d)}}/>}
    <div className="two"><button className="btn" style={{marginTop:0}} onClick={()=>setCamOn(true)}><Camera size={18}/>{" "}{img?tl("Retake"):tl("Take a photo")}</button>
      <button className="btn ghost" style={{marginTop:0}} onClick={()=>gal.current.click()}><ImagePlus size={18}/>{" "}{tl("Choose a photo")}</button></div>
    {!img&&<p className="known">{tl("Hold the phone flat over the page, in good light, with only the part you are asking about in the photo.")}</p>}
    {img&&<><img className="photoprev" src={img} alt={tl("Your photo")}/>
      <label htmlFor="ptext">{tl("What the photo says")}</label>
      {reading?<Skeleton rows={2}/>:<textarea id="ptext" rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder={st.ocr===false?tl("This server can't read photos yet. Type the question here."):tl("Nothing was read. Type the question here, or retake the photo closer.")}/>}
      {!reading&&text&&<p className="known" style={{marginTop:4}}>{tl("Check it and fix anything misread before you ask.")}</p>}
      {st.vision?<label className="chk"><input type="checkbox" checked={diagram} onChange={e=>setDiagram(e.target.checked)}/>{" "}{tl("My question is about a diagram or figure in the photo")}</label>
        :<p className="known">{tl("For a diagram, only its labels are read. Say in your question what the diagram shows.")}</p>}
      <label htmlFor="pq">{tl("Your question")}</label>
      <div className="stepchips" style={{marginTop:0,marginBottom:8}}>{quick.map(x=><button key={x} className="stepchip" disabled={busy||reading} onClick={()=>ask(x)}>{x}</button>)}</div>
      <form onSubmit={e=>{e.preventDefault();ask()}} className="pform"><input id="pq" value={q} maxLength={500} onChange={e=>setQ(e.target.value)} placeholder={tl("Or type your own question")}/>
        <button className="btn" style={{marginTop:8}} disabled={busy||reading||!q.trim()}>{busy?tl("Thinking…"):tl("Ask")}</button></form>
      <p className="known privacy">{diagram?tl("Your photo goes to Claude so it can look at the diagram. It is not stored."):tl("Your photo stays here: only the text above goes to the AI. Nothing is stored.")}</p>
      {answers.map((a,i)=><div key={answers.length-i} className="gist panswer"><small className="steplab">{a.q}</small><Md>{a.text}</Md>{!a.support&&<FlagLink source="photo" excerpt={a.text}/>}</div>)}</>}
  </div></>}
// My profile: who they are, their password, and (for students) the rewards for answers others reused. Nothing to share by hand:
// when others are shown an answer a student's own search, doubt or highlight first brought, it counts, once per person per answer per day
function Profile({toast,onPassword,onKey}){
  const [d,setD]=useState(null);useEffect(()=>{api('/me/profile').then(setD).catch(e=>toast(e.message))},[toast])
  if(!d)return <><Bar title={tl("My profile")}/><div className="main"><Skeleton/></div></>
  const r=d.rewards,src={search:tl("Search"),doubt:tl("Not clear?"),line:tl("Highlight")}
  return <><Bar title={tl("My profile")}/><div className="main">
    <div className="card profcard"><span className="av big" aria-hidden="true">{initials(d.name)}</span><div><b>{d.name}</b><span>{d.email||d.username}</span>
      <span>{tl(cap(d.role))}{d.program?' · '+d.program+(d.semester?' · '+tl('{term} {n}',{term:d.term,n:d.semester}):''):''}</span></div></div>
    <div className="two"><button className="btn ghost" onClick={onPassword}>{tl("Change password")}</button>{d.self_registered&&<button className="btn ghost" onClick={onKey}>{tl("My AI key")}</button>}</div>
    {(d.self_registered||d.role==='student')&&<PlanCard toast={toast} onKey={onKey}/>}
    {r&&<><h3 className="sec">{tl("Rewards")}</h3>
      <div className="qbox rewards"><div className="rwtop"><b className="rwpts">{r.points.toLocaleString()}</b><span>{tl("points")}</span></div>
        <p className="known" style={{margin:'6px 0'}}>{tl("Other students were shown answers your questions brought {n} times.",{n:r.uses.toLocaleString()})}</p>
        <div className="meter" role="progressbar" aria-label={tl("Toward your next points")} aria-valuemin={0} aria-valuemax={r.per} aria-valuenow={r.toward_next}><i style={{width:Math.round(100*r.toward_next/r.per)+'%'}}/></div>
        <small className="known">{tl("{n} of {per} toward your next {points} points",{n:r.toward_next.toLocaleString(),per:r.per.toLocaleString(),points:r.points_per})}</small></div>
      <p className="known">{tl("There is nothing to share by hand. When you search, ask about something that isn't clear, or highlight a passage, the answer is saved, and other students who ask the same thing get it straight away. Each time someone else is shown one of your answers counts once a day for them, and every {per} times earns you {points} points. Nobody sees that the answer came from you.",{per:r.per.toLocaleString(),points:r.points_per})}</p>
      {r.top.length>0&&<><h3 className="sec">{tl("Your answers others use most")}</h3>{r.top.map((x,i)=><div className="row" key={i}><div>{x.label||'—'}<small>{src[x.source]||x.source} · {pl(x.uses,'use')}</small></div></div>)}</>}</>}
  </div></>}
// the switch above a topic's notes for Arabic and Tamil readers: the original, or the notes in their language (translated once, then shared).
// Highlighting works on the original, so the full-screen reader always opens it
function NotesLang({t,aiOk,tr,setTr}){
  const lang=getLang(),name=(LANGS.find(x=>x[0]===lang)||[])[1]
  if(!['ar','ta'].includes(lang)||!aiOk||!t.content||!['markdown','html',undefined,null].includes(t.content_format))return null
  const show=async()=>{if(tr?.content){setTr({...tr,on:true});return}setTr({busy:true,on:true})
    try{const r=await api(`/topics/${t.id}/translation`);setTr({on:true,content:r.content,id:r.id})}catch(e){setTr({on:false,err:e.message})}}
  return <div className="nlang"><div className="seg" role="group" aria-label={tl("Notes language")}><button className={!tr?.on?'on':''} aria-pressed={!tr?.on} onClick={()=>setTr(x=>({...(x||{}),on:false}))}>{tl("Original")}</button>
    <button className={tr?.on?'on':''} aria-pressed={!!tr?.on} disabled={tr?.busy} onClick={show}>{tr?.busy?tl("Translating…"):name}</button></div>
    {tr?.on&&tr.content&&<><p className="known">{tl("Translated by AI. Formulas and terms are kept as in the original. Highlighting works on the original.")}</p><FlagLink source="topic" id={tr.id} topicId={t.id}/></>}
    {tr?.err&&<p className="known" role="alert">{tr.err}</p>}</div>}
// "This looks wrong?" under an AI reply: a student's private report, which the topic's teacher sees (never who sent it) and can have written again
function FlagLink({source,id,topicId,excerpt}){
  const {role}=useContext(Ctx),[st,setSt]=useState(''),[why,setWhy]=useState(''),[err,setErr]=useState('')
  if(role!=='student')return null
  if(st==='sent')return <p className="known flagl">{tl("Thanks. Your teacher will take a look.")}</p>
  if(st!=='open')return <button className="link flagl" onClick={()=>setSt('open')}><Flag size={13}/> {tl("This looks wrong?")}</button>
  const send=async()=>{setErr('');try{await api('/ai/flag',{method:'POST',body:{source,id:id||null,topic_id:topicId||null,excerpt:String(excerpt||'').slice(0,600),reason:why}});setSt('sent')}catch(e){setErr(e.message)}}
  return <div className="flagf"><input value={why} maxLength={300} onChange={e=>setWhy(e.target.value)} placeholder={tl("What looks wrong? (optional)")} aria-label={tl("What looks wrong? (optional)")}/>
    <div className="tools"><button onClick={send}>{tl("Send to my teacher")}</button><button onClick={()=>setSt('')}>{tl("Cancel")}</button></div>{err&&<p className="known">{err}</p>}</div>}
// a unit on one printable sheet, made only when the student asks: each topic's gist and question, and their own highlights.
// Saved gists show at once; the missing ones are written two at a time and fill in as they arrive. A print page, so no numbered pages
function RevisionSheet({uid,back,toast}){
  const [d,setD]=useState(null),[left,setLeft]=useState(0)
  useEffect(()=>{let live=true
    api(`/units/${uid}/revision`).then(async r=>{if(!live)return;setD(r);const q=r.topics.filter(x=>!x.gist);if(!q.length)return
      const on=await api('/ai/status').then(x=>x.available).catch(()=>false);if(!on||!live)return;setLeft(q.length)
      const work=async()=>{while(live&&q.length){const x=q.shift();try{const g=(await api(`/topics/${x.id}/ai/gist`)).data;if(live)setD(p=>({...p,topics:p.topics.map(y=>y.id===x.id?{...y,gist:g}:y)}))}catch{/* that topic stays without its gist */}if(live)setLeft(n=>n-1)}}
      await Promise.all([work(),work()])}).catch(e=>toast(e.message))
    return()=>{live=false}},[uid,toast])
  return <><Bar title={tl("Revision sheet")} sub={d?d.course+' · '+d.unit:''} back={back}/><div className="main">
    <div className="revtools"><button className="btn ghost" style={{marginTop:0}} onClick={()=>window.print()}><Printer size={16}/>{" "}{tl("Print or save as PDF")}</button>{left>0&&<small className="known">{tl("Writing {n} more…",{n:left})}</small>}</div>
    {!d?<Skeleton/>:<article className="revsheet"><h2 className="revhead">{d.unit}<small>{d.course}</small></h2>
      {d.topics.map(x=><section key={x.id} className="revtopic"><h3>{x.title}</h3>
        {x.gist?<ul>{(x.gist.points||[]).map((p,i)=><li key={i}><Md>{p}</Md></li>)}</ul>:<p className="known">{left>0?tl("Writing…"):tl("No gist yet. Open the topic once to make it.")}</p>}
        {x.gist?.hook&&<p className="revq">{tl("Ask yourself")}: {x.gist.hook}</p>}
        {x.highlights.length>0&&<div className="revhl"><small>{tl("Your highlights")}</small><ul>{x.highlights.map((h,i)=><li key={i}>{h}</li>)}</ul></div>}</section>)}</article>}
  </div></>}
// the skeleton of a full-marks answer, shown before the full sample answer
function Outline({id}){
  const [d,setD]=useState(null),[err,setErr]=useState(''),[rid,setRid]=useState(null)
  useEffect(()=>{setD(null);setErr('');api(`/topics/${id}/ai/outline`).then(r=>{setD(r.data);setRid(r.id)}).catch(e=>setErr(e.message))},[id])
  if(err)return <p className="known">{err}</p>
  if(!d)return <Skeleton rows={2}/>
  return <div className="gist"><h3>{tl("How a full-marks answer goes")}</h3><ol>{(d.points||[]).map((x,i)=><li key={i}><Md>{x}</Md></li>)}</ol>{d.marks&&<p className="known">{d.marks}</p>}<FlagLink source="topic" id={rid} topicId={id}/></div>}

// a topic's content full screen, with the reader's own highlights: select text to highlight it, tap a highlight to remove it.
// Markdown and HTML are highlighted right here; an interactive page runs in a sandboxed frame (no access to the app or the sign-in) and
// sends its highlight requests here by postMessage, which this page checks and saves for it.
const Content=memo(({text,format})=><Body text={text} format={format}/>)
const HL_COL={coral:'#fb923c',yellow:'#ffd60a',green:'#50c878',blue:'#5aa0ff'}
// one saved highlight: the passage in its colour, where it is (on the list of all of them), the reader's note, and remove
function HlItem({h,where,onGo,onSaved,onDrop,onExplain,focus,toast}){
  const [ed,setEd]=useState(!!focus),[note,setNote]=useState(h.note||''),ta=useRef(null)
  useEffect(()=>{if(focus)setEd(true)},[focus])
  useEffect(()=>{if(ed)ta.current?.focus()},[ed])
  const save=async()=>{try{onSaved(await api('/me/highlights/'+h.id,{method:'PATCH',body:{note}}));setEd(false)}catch(e){toast(e.message)}}
  return <div className="hlrow" style={{'--hc':HL_COL[h.color]||HL_COL.coral}}><div className="hlbody">
    {onGo?<button className="hltext" onClick={onGo}>{h.text}</button>:<p className="hltext">{h.text}</p>}
    {where&&<small className="hlwhere">{where}</small>}
    {h.explain?<div className="hlexp"><Md>{h.explain.text}</Md><FlagLink source="topic" id={h.explain.id} topicId={h.topic_id||h.tid}/></div>:onExplain&&<button className="link hladd" onClick={onExplain}>{tl("Explain this")}</button>}
    {ed?<><textarea ref={ta} className="hlnote" value={note} maxLength={2000} placeholder={tl("Your note")} aria-label={tl("Your note")} onChange={e=>setNote(e.target.value)}/><div className="tools"><button onClick={save}>{tl("Save note")}</button><button onClick={()=>{setNote(h.note||'');setEd(false)}}>{tl("Cancel")}</button></div></>
      :h.note?<button className="hlnoted" onClick={()=>setEd(true)} title={tl("Edit note")}>{h.note}</button>:<button className="link hladd" onClick={()=>setEd(true)}>{tl("Add a note")}</button>}</div>
    <button className="ic sm" aria-label={tl("Remove highlight")} title={tl("Remove")} onClick={onDrop}><Trash2 size={15}/></button></div>}
// "Not clear?" on a marked phrase. Step one stays on the server: where the phrase sits in the topic and in the student's own notes, and a kept AI answer if there is one.
// Step two, only if the student asks for it, sends the AI the names of the program, semester, course and topic and the phrase. Never the notes.
function DoubtBox({tid,askState,phrase,close,toast}){
  const {aiOff,role}=useContext(Ctx)
  const [askT,setAskT]=useState(false),[d,setD]=useState(null),[ans,setAns]=useState(null),[busy,setBusy]=useState(false),[err,setErr]=useState('')
  useEffect(()=>{setD(null);setAns(null);setErr('');api(`/topics/${tid}/doubt`,{method:'POST',body:{phrase}}).then(setD).catch(e=>{toast(e.message);close()})},[tid,phrase])
  const ask=async()=>{setBusy(true);setErr('');try{setAns(await api(`/topics/${tid}/doubt/ask`,{method:'POST',body:{phrase}}))}catch(e){setErr(e.message)}setBusy(false)}
  const shown=ans||(d?.saved?{text:d.saved,cached:true,id:d.saved_id}:null)
  return <><div className="tools" style={{justifyContent:'space-between'}}><b>{tl("Not clear?")}</b><button className="ic sm" aria-label={tl("Close")} onClick={close}><X size={16}/></button></div>
    <p className="hltext" style={{marginTop:8}}>“{phrase}”</p>
    {!d?<Skeleton/>:<>
      {d.where&&<small className="known">{[d.where.program,d.where.semester,d.where.course,d.where.topic].filter(Boolean).join(' › ')}</small>}
      <h4 style={{margin:'14px 0 4px'}}>{tl("In your topic")}</h4>
      {d.passage?<p className="prose">{d.passage}</p>:<p className="known">{tl("This exact phrase is not in the topic text. It may be in a picture or formula.")}</p>}
      {d.my_passage&&<><h4 style={{margin:'14px 0 4px'}}>{tl("In your own notes")}</h4><p className="prose">{d.my_passage}</p></>}
      {shown?<><h4 style={{margin:'14px 0 4px'}}>{tl("Explained")}</h4>{shown.cached&&<span className="chip">{tl("Saved answer · nothing was sent")}</span>}{shown.support?<p>{shown.text}</p>:<div className="prose"><Md>{shown.text}</Md></div>}</>
        :aiOff?<p className="known">{tl("AI help is off. A parent or teacher can turn it on by adding their AI key to their account.")}</p>:<><button className="btn" disabled={busy} onClick={ask}><Sparkles size={16}/> {busy?tl("Thinking…"):tl("Still not clear? Ask AI")}</button>
          <p className="known">{tl("Only the names of your program, semester, course and topic and this phrase are sent. Your notes never are.")}{d.ai_left!=null&&d.ai_left<=10?' '+tl("{n} left today.",{n:d.ai_left}):''}</p>
          {err&&<p className="known">{err}</p>}</>}
      {role==='student'&&askState==='on'&&<button className="link" style={{marginTop:12}} onClick={()=>setAskT(true)}><MessageCircle size={14}/> {tl("Still not clear? Ask my teacher")}</button>}
      {askT&&<AskTeacher tid={tid} excerpt={phrase} ai={shown?.id?{kind:'doubt',id:shown.id}:null} aiText={shown&&!shown.support?shown.text:''} close={()=>setAskT(false)} toast={toast}/>}</>}</>}
function Reader({t,auto,toast,onList,close}){
  const {role}=useContext(Ctx),[askX,setAskX]=useState(null)
  const [list,setList]=useState(null),[panel,setPanel]=useState(false),[doubt,setDoubt]=useState(null),[noteFor,setNoteFor]=useState(null),[fs,setFs]=useState(!!document.fullscreenElement),box=useRef(null),frame=useRef(null),hl=useRef(null),now=useRef([])
  const inter=t.content_format==='interactive',ready=list!==null
  now.current=list||[]
  useEffect(()=>{api(`/topics/${t.id}/highlights`).then(r=>setList(r.items)).catch(e=>{toast(e.message);setList([])})},[t.id,toast])
  useEffect(()=>{if(list)onList?.(list)},[list,onList])
  useEffect(()=>{document.body.style.overflow='hidden';if(auto)document.documentElement.requestFullscreen?.().catch(()=>{/* the browser wants a tap first: the button is there */})
    const f=()=>setFs(!!document.fullscreenElement),k=e=>{if(e.key==='Escape'&&!document.fullscreenElement)close()}
    document.addEventListener('fullscreenchange',f);addEventListener('keydown',k)
    return()=>{document.body.style.overflow='';document.removeEventListener('fullscreenchange',f);removeEventListener('keydown',k);if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})}},[auto,close])
  // the explanation of a passage: written when it is highlighted (and AI is on), shown in a small card, kept on the highlight
  const [exp,setExp]=useState(null),[aiOn,setAiOn]=useState(false)
  useEffect(()=>{api('/ai/status').then(r=>setAiOn(!!r.available)).catch(()=>{})},[])
  const explain=useCallback(async hid=>{const have=now.current.find(x=>x.id===+hid)?.explain;if(have){setExp({hid:+hid,...have});return}
    setExp({hid:+hid,busy:true});try{const x=(await api(`/me/highlights/${hid}/explain`,{method:'POST'})).explain;setExp({hid:+hid,...x});setList(l=>l.map(y=>y.id===+hid?{...y,explain:x}:y))}catch(e){setExp({hid:+hid,err:e.message})}},[])
  const save=useCallback(async h=>{const r=await api(`/topics/${t.id}/highlights`,{method:'POST',body:{text:String(h.text||'').slice(0,5000),prefix:String(h.prefix||'').slice(-200),color:h.color||'coral'}});setList(l=>[...l,r]);if(aiOn)setTimeout(()=>explain(r.id),0);return r},[t.id,aiOn,explain])
  const remove=useCallback(async id=>{await api('/me/highlights/'+id,{method:'DELETE'});setList(l=>l.filter(x=>x.id!==+id))},[])
  const recolor=useCallback(async(id,color)=>{const r=await api('/me/highlights/'+id,{method:'PATCH',body:{color}});setList(l=>l.map(x=>x.id===r.id?r:x));return r},[])
  const noteOn=useCallback(id=>{setPanel(true);setNoteFor(+id)},[])
  useEffect(()=>{if(!ready||inter||!box.current||!window.zgHighlighter)return
    const loud=f=>(...a)=>f(...a).catch(e=>{toast(e.message);throw e})
    hl.current=window.zgHighlighter.attach(box.current,{list:now.current,save:loud(save),remove:loud(remove),update:loud((id,c)=>recolor(id,c.color)),note:noteOn,doubt:p=>{setPanel(false);setDoubt(p)},...(aiOn?{explain}:{}),doubtLabel:tl("Not clear?")})
    return()=>{hl.current?.detach();hl.current=null}},[ready,inter,save,remove,recolor,noteOn,toast,aiOn,explain])
  useEffect(()=>{if(!ready||!inter)return
    const win=()=>frame.current?.contentWindow,reply=(k,d)=>win()?.postMessage({zg:1,k,...d},'*')
    const on=async e=>{const d=e.data;if(!win()||e.source!==win()||!d||d.zg!==1)return  // only our own frame, and only these requests
      if(d.type==='ready')win().postMessage({zg:1,type:'init',list:now.current.map(({id,text,prefix,color})=>({id,text,prefix,color}))},'*')
      else if(d.type==='save'){try{const h=await save(d);reply(d.k,{id:h.id})}catch(er){toast(er.message);reply(d.k,{error:1})}}
      else if(d.type==='remove'){try{await remove(+d.id);reply(d.k,{})}catch(er){toast(er.message);reply(d.k,{error:1})}}
      else if(d.type==='update'){try{await recolor(+d.id,String(d.color));reply(d.k,{})}catch(er){toast(er.message);reply(d.k,{error:1})}}
      else if(d.type==='note')noteOn(d.id)
      else if(d.type==='explain'&&aiOn)explain(+d.id)
      else if(d.type==='store'&&d.data&&typeof d.data==='object'){const data=Object.fromEntries(Object.entries(d.data).filter(([,v])=>typeof v==='string'))  // the page's localStorage, kept for this person
        api(`/topics/${t.id}/store`,{method:'PUT',body:{data}}).catch(er=>toast(er.message))}}
    addEventListener('message',on);return()=>removeEventListener('message',on)},[ready,inter,save,remove,recolor,noteOn,toast,t.id,aiOn,explain])
  const goTo=id=>{if(inter)frame.current?.contentWindow?.postMessage({zg:1,type:'scroll',id},'*');else hl.current?.scrollTo(id);if(innerWidth<900)setPanel(false)}
  const drop=async id=>{try{await remove(id);if(inter)frame.current?.contentWindow?.postMessage({zg:1,type:'unpaint',id},'*');else hl.current?.remove(id)}catch(e){toast(e.message)}}
  const toggleFs=()=>document.fullscreenElement?document.exitFullscreen().catch(()=>{}):document.documentElement.requestFullscreen?.().catch(()=>toast(tl("Full screen is not available here")))
  return <div className="reader" role="dialog" aria-modal="true" aria-label={t.title}>
    <div className="rbar"><button className="ic" aria-label={tl("Close")} title={tl("Close")} onClick={close}><X size={20}/></button>
      <span className="rtitle"><b>{t.title}</b><small>{[t.course,t.unit].filter(Boolean).join(' › ')}</small></span>
      <span className="rhint">{tl("Select text to highlight it")}</span>
      <button className={'tool rhl'+(panel?' on':'')} aria-expanded={panel} onClick={()=>setPanel(!panel)}><Highlighter size={15}/> {list?.length||0}<span className="rlab">{" "}{tl("highlight")}{list?.length===1?'':'s'}</span></button>
      <button className="ic" aria-label={fs?tl("Exit full screen"):tl("Full screen")} title={fs?tl("Exit full screen"):tl("Full screen")} onClick={toggleFs}>{fs?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button></div>
    <div className="rmain">
      {inter?(ready&&<iframe ref={frame} className="rframe" title={t.title} src={at(t.frame_url)} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-forms allow-downloads"/>)
        :<div className="rscroll"><div className="prose rtext" ref={box}>{ready?<Content text={t.content} format={t.content_format}/>:<Skeleton/>}</div></div>}
      {doubt&&<aside className="rpanel" aria-label={tl("Not clear?")}><DoubtBox tid={t.id} askState={t.ask} phrase={doubt} close={()=>setDoubt(null)} toast={toast}/></aside>}
      {!doubt&&panel&&<aside className="rpanel" aria-label={tl("Your highlights")}><b>{tl("Your highlights")}</b><p className="known">{tl("Select text and pick a colour. Tap a highlight to change its colour, add a note or remove it.")}</p>
        {list?.length?<Paged rows={list} render={h=><HlItem key={h.id} h={{...h,tid:t.id}} toast={toast} focus={noteFor===h.id} onExplain={aiOn?()=>explain(h.id):null} onGo={()=>goTo(h.id)} onSaved={r=>{setList(l=>l.map(x=>x.id===r.id?r:x));setNoteFor(null)}} onDrop={()=>drop(h.id)}/>}/>:<p className="known">{tl("None yet.")}</p>}</aside>}</div>
    {exp&&<div className="rexp" role="status"><div className="rexph"><small>{tl("What this means")}</small><button className="ic sm" aria-label={tl("Close")} onClick={()=>setExp(null)}><X size={15}/></button></div>
      <p className="rexpq">“{(list?.find(x=>x.id===exp.hid)?.text||'').slice(0,140)}{(list?.find(x=>x.id===exp.hid)?.text||'').length>140?'…':''}”</p>
      {exp.busy?<p className="known">{tl("Thinking…")}</p>:exp.err?<p className="known">{exp.err}</p>:<><Md>{exp.text||''}</Md><FlagLink source="topic" id={exp.id} topicId={t.id}/>
        {role==='student'&&t.ask==='on'&&exp.id&&<button className="link" style={{display:'block',marginTop:6}} onClick={()=>setAskX({excerpt:(list?.find(x=>x.id===exp.hid)?.text||'').slice(0,600),ai:{kind:'topic',id:exp.id},aiText:exp.text||''})}><MessageCircle size={14}/> {tl("Still not clear? Ask my teacher")}</button>}</>}</div>}
      {askX&&<AskTeacher tid={t.id} excerpt={askX.excerpt} ai={askX.ai} aiText={askX.aiText} close={()=>setAskX(null)} toast={toast}/>}</div>}
function UnitSheet({un,cid,courses,close,done,toast}){  // courses is given to admins only: moving a unit to another course is theirs to do
  const isNew=!un.id,[f,setF]=useState({name:un.name||'',course:cid}),[busy,setBusy]=useState(false)
  const save=async()=>{setBusy(true);try{await api(isNew?'/units':'/units/'+un.id,{method:isNew?'POST':'PUT',body:{name:f.name,course_id:+f.course}});toast(isNew?tl("Unit added"):tl("Changes saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet close={close}><h3>{isNew?tl("New unit"):tl("Edit unit")}</h3>
    <label>{tl("Name")}</label><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} onKeyDown={e=>e.key==='Enter'&&f.name.trim()&&save()} placeholder={tl("Unit 1: Basic concepts")} autoFocus/>
    {!isNew&&courses&&<><label>{tl("Course")}</label><select value={f.course} onChange={e=>setF({...f,course:+e.target.value})}>{courses.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></>}
    <button className="btn" disabled={busy||!f.name.trim()} onClick={save}>{isNew?tl("Add unit"):tl("Save changes")}</button></Sheet>}

const unmarked=(tree,id)=>tree.map(p=>({...p,semesters:p.semesters.map(s=>({...s,courses:s.courses.map(c=>({...c,units:c.units.map(u=>({...u,topics:u.topics.map(x=>x.id===id?{...x,bookmarked:false}:x)}))}))}))}))
const tabTo=e=>e.currentTarget.scrollIntoView?.({inline:'center',block:'nearest'})

export const srcLine=x=>x.status==='reading'?(x.done?tl("Reading scanned pages… {done} of {pages}",{done:x.done,pages:x.pages}):tl("Waiting to read {pages} scanned pages…",{pages:x.pages}))
  :x.status==='failed'?srv(x.error):`${x.kind==='scan'?tl("Scanned, read with text recognition")+' · ':''}${tl("{n} words",{n:x.words.toLocaleString()})}${x.note?' · '+x.note:''}`
export const usePoll=(on,fn,ms=3000)=>useEffect(()=>{if(!on)return;const h=setInterval(fn,ms);return()=>clearInterval(h)},[on])  // while scanned pages are being read
function MyMaterial({cid,name,back,toast}){  // a student's own material, filed under the course's syllabus topics (private to them)
  const confirm=useConfirm()
  const [v,setV]=useState(null),[busy,setBusy]=useState(''),[paste,setPaste]=useState(null),[open,setOpen]=useState({}),[pick,setPick]=useState(null),fileRef=useRef()
  const base=`/courses/${cid}/my-material`,load=()=>api(base).then(setV).catch(e=>{toast(e.message);back()})
  useEffect(()=>{load()},[cid]);usePoll(!!v?.reading,()=>api(base).then(setV).catch(()=>{}))
  const run=async(label,fn,msg)=>{setBusy(label);try{const r=await fn();if(r&&r.syllabus)setV(r);else await load();msg&&toast(tl(msg))}catch(e){toast(e.message)}setBusy('')}
  const upload=async e=>{const fs=[...e.target.files];e.target.value='';for(const f of fs)if(tooBig(f))toast(tl("{name} is over {MAX_FILE_MB} MB. Split it into smaller files.",{name:f.name,MAX_FILE_MB:MAX_FILE_MB}));else await run('file',async()=>{const r=await fetch(ROOT+'/api'+base+'/files?name='+encodeURIComponent(f.name),{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+localStorage.t},body:f}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(tl(j.detail||'Upload failed'));if(j.status==='reading')toast(tl("{name} is scanned pages. Reading them now; you can stay or come back later.",{name:f.name}))},f.name.toLowerCase().endsWith('.pdf')?'':tl("Added {name}",{name:f.name}))}
  const match=m=>run(m,()=>api(base+'/match',{method:'POST',body:{method:m}}),'Matched to the syllabus. Check it below, then save.')
  const file=(i,tid)=>{setPick(null);return run('sec',()=>api(base+'/sections',{method:'PUT',body:{sections:v.sections.map((x,k)=>({from:x.from,to:x.to,topic_id:k===i?(tid?+tid:null):x.topic_id}))}}))}
  const read=async x=>{const k=x.from;if(open[k]!==undefined)return setOpen({...open,[k]:undefined});try{const r=await api(`${base}/preview?start=${x.from}&end=${x.to}`);setOpen({...open,[k]:r.content})}catch(e){toast(e.message)}}
  if(!v)return <><Bar title={tl("Your material")} back={back}/><div className="main"><div className="sk"/><div className="sk"/></div></>
  const names=new Map(v.syllabus.flatMap(u=>u.topics.map(x=>[x.id,x.title]))),filed=new Set(v.sections.map(x=>x.topic_id).filter(Boolean)),missing=v.syllabus.flatMap(u=>u.topics.filter(x=>!filed.has(x.id)).map(x=>x.title)),noAi=!v.ai_available||v.ai_left===0
  return <><Bar title={tl("Your material")} sub={name} back={back}/><div className="main">
    <p className="known" style={{marginTop:0}}>{tl("Your college sets the course, units and topics. Bring your own notes or book chapters and they are filed under the right topics, so you study the syllabus in your own words. Only you see them.")}</p>
    <h3>{tl("1. Your files")}</h3>
    {v.sources.length?<Paged rows={v.sources} render={(x,i)=><div className="row" key={i}><div>{x.name}<small role={x.status==='reading'?'status':undefined}>{srcLine(x)}</small></div><button className="ic sm" aria-label={tl("Remove {name}",{name:x.name})} disabled={!!busy} onClick={()=>run('drop',()=>api(base+'/sources/'+i,{method:'DELETE'}))}><X size={16}/></button></div>}/>:<p className="known">{tl("No files yet. PDFs, Word (.docx) and text files work, up to {MAX_FILE_MB} MB each.",{MAX_FILE_MB:MAX_FILE_MB})}{v.ocr_available?tl(" Scanned PDFs are read too; that takes a few seconds a page."):tl(" Scanned PDFs can't be read on this server yet.")}</p>}
    <div className="two"><button className="btn ghost" disabled={!!busy} onClick={()=>fileRef.current.click()}><Upload size={16}/> {busy==='file'?tl("Reading…"):tl("Add a file")}</button><button className="btn ghost" disabled={!!busy} onClick={()=>setPaste({text:''})}>{tl("Paste text")}</button></div>
    <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md" onChange={upload}/>
    {v.sources.length>0&&<><h3>{tl("2. File it under the syllabus")}</h3>
      {v.reading&&<p className="known" role="status">{tl("Your scanned pages are still being read. Matching starts once they are done.")}</p>}
      {v.ai_available&&<button className={'btn'+(noAi?' ghost':'')} disabled={!!busy||noAi||v.reading} onClick={()=>match('ai')}><Sparkles size={16}/> {busy==='ai'?tl("Matching…"):tl("Match with AI")}</button>}
      <button className={'btn'+(noAi?'':' ghost')} disabled={!!busy||v.reading} onClick={()=>match('headings')}>{busy==='headings'?tl("Matching…"):v.ai_available?tl("Match by headings (no AI)"):tl("Match by headings")}</button>
      {noAi&&<p className="known">{v.ai_available?tl("No AI requests are left today. "):''}{tl("Matching by headings works best when your notes use the topic names as headings.")}</p>}</>}
    {v.sections.length>0&&<><h3>{tl("3. Check where each part goes")}</h3>
      <p className="known">{tl("Your notes cover {covered} of {topics} topics.",{covered:v.covered,topics:v.topics})}{missing.length>0&&tl(" Not covered yet: {missing}{v}.",{missing:missing.slice(0,6).join(', '),v:missing.length>6?' and '+(missing.length-6)+' more':''})}</p>
      {<Paged rows={v.sections} render={(x,i)=><div className="qbox" key={x.from}>{x.heading?<b>{x.heading}</b>:<span style={{display:'block'}}>“{x.excerpt.slice(0,80)+(x.excerpt.length>80?'…':'')}”</span>}<small className="known" style={{display:'block'}}>{tl("Part {v} · {words} words",{v:i+1,words:x.words})}</small>
        <div className="sfile">{x.topic_id?<span className="chip">{names.get(x.topic_id)||tl("Topic")}</span>:<span className="chip none">{tl("Left out")}</span>}<button className="tool" disabled={!!busy} aria-expanded={pick===i} onClick={()=>setPick(pick===i?null:i)}>{pick===i?tl("Cancel"):x.topic_id?tl("Change"):tl("File it")}</button></div>
        {pick===i&&<select aria-label={tl("Topic for part {i}{v}",{i:i,v:1})} autoFocus value={x.topic_id||''} disabled={!!busy} onChange={e=>file(i,e.target.value)}><option value="">{tl("Not in the syllabus (left out)")}</option>{v.syllabus.map(u=><optgroup key={u.id} label={u.name}>{u.topics.map(tp=><option key={tp.id} value={tp.id}>{tp.title}</option>)}</optgroup>)}</select>}
        <button className="tool" onClick={()=>read(x)}>{open[x.from]!==undefined?tl("Hide"):tl("Read it")}</button>{open[x.from]!==undefined&&<div className="prose"><Md>{open[x.from]}</Md></div>}</div>}/>}
      <button className="btn" disabled={!!busy||!filed.size} onClick={async()=>{if(v.saved_at&&!await confirm({title:tl("Save again and rebuild your notes?"),body:tl("Your notes in every topic of this course are rebuilt from the material and matching shown here. Notes from material you removed or sections you left out are gone after this. Your progress and quiz results stay."),ok:tl("Save again")}))return  // saving again replaces the course's notes
        run('save',()=>api(base+'/save',{method:'POST'}),'Saved. Open a topic to study your notes.')}}>{v.saved_at?tl("Save again to my topics"):tl("Save to my topics")}</button>
      {v.saved_at&&<p className="known">{tl("Last saved {n}. Saving again rebuilds your notes from this material; your progress and quiz results stay.",{n:when(v.saved_at)})}</p>}</>}
    {v.sources.length>0&&<p style={{marginTop:28}}><button className="link" style={{color:"var(--bad)"}} disabled={!!busy} onClick={async()=>{if(await confirm({title:tl("Remove your material?"),body:tl("All your notes in this course go with it, in every topic, not just one file's. Your progress and quiz results stay."),ok:tl("Remove"),danger:true}))run('del',()=>api(base,{method:'DELETE'}),'Your material was removed')}}>{tl("Remove my material from this course")}</button></p>}</div>
    {paste&&<Sheet close={()=>setPaste(null)}><h3>{tl("Paste text")}</h3><textarea aria-label={tl("Text to add")} value={paste.text} onChange={e=>setPaste({text:e.target.value})} placeholder={tl("Paste your notes. Lines starting with # are headings.")}/>
      <button className="btn" disabled={!paste.text.trim()||!!busy} onClick={async()=>{await run('paste',()=>api(base+'/text',{method:'POST',body:{text:paste.text}}),'Added');setPaste(null)}}>{tl("Add")}</button></Sheet>}</>}

// every highlight this person has made, newest first: search (passage, note or topic), a colour filter and pages; a highlight opens its topic
function MyHighlights({toast,role,head}){
  const [q,setQ]=useState(''),[color,setColor]=useState(''),[t,setT]=useState(null)
  const {items,total,page,setPage,reload}=usePaged(o=>`/me/highlights?q=${encodeURIComponent(q)}&color=${color}&limit=${PAGE}&offset=${o}`,[q,color],toast)
  if(t)return <Topic id={t} back={()=>{setT(null);reload()}} toast={toast} role={role}/>
  const drop=async h=>{try{await api('/me/highlights/'+h.id,{method:'DELETE'});toast(tl("Highlight removed"));reload()}catch(e){toast(e.message)}}
  return <><Bar title={head?tl("Saved"):tl("My highlights")} sub={q||color?matches(total):pl(total,'highlight')}/><div className="main">{head}
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search your highlights")} placeholder={tl("Search your highlights, notes or topics")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="chips wrap" role="group" aria-label={tl("Colour")} style={{marginTop:12}}>{[['',tl('All colours')],...Object.keys(HL_COL).map(c=>[c,tl(c[0].toUpperCase()+c.slice(1))])].map(([k,l])=><button key={l} className={'sbtn'+(color===k?' on':'')} aria-pressed={color===k} onClick={()=>setColor(k)}>{k&&<i className="hldot" style={{background:HL_COL[k]}}/>}{l}</button>)}</div>
    {items.map(h=><HlItem key={h.id} h={h} toast={toast} where={[h.topic,h.course].filter(Boolean).join(' · ')} onGo={()=>setT(h.topic_id)} onSaved={reload} onDrop={()=>drop(h)}/>)}
    {!items.length&&<p className="known">{q||color?tl("No highlight matches."):tl("No highlights yet. Open a topic, select some text and pick a colour.")}</p>}
    <Pager page={page} total={total} onPage={setPage}/></div></>}
const FMT=L({markdown:'Markdown',html:'HTML',interactive:'HTML + JavaScript'})
// many topic files into one unit: pick files or a whole folder (with its images), see what each file becomes, then add them all
function BulkTopics({unit,toast,close,done}){
  const [rows,setRows]=useState(null),[files,setFiles]=useState([]),[images,setImages]=useState({}),[scripts,setScripts]=useState(false),[pub,setPub]=useState(false),[busy,setBusy]=useState(''),pick=useRef(null),folder=useRef(null)
  const ext=x=>(x.name.split('.').pop()||'').toLowerCase()
  const send=(dry,o={})=>api(`/units/${unit.id}/topics/bulk`,{method:'POST',body:{files,images,scripts,published:pub,...o,dry_run:dry}})
  const preview=async o=>{if(!(o?.files||files).length)return;setBusy('Checking the files…');try{setRows(await send(true,o))}catch(e){toast(e.message)}setBusy('')}
  const choose=async e=>{const all=[...e.target.files];e.target.value='';if(!all.length)return
    const docs=all.filter(x=>['html','htm','md','markdown','txt'].includes(ext(x))),imgs=all.filter(x=>/^image\//.test(x.type))
    if(!docs.length)return toast(tl("Choose .html or .md files, or a folder with them"))
    if(docs.length>200)return toast(tl("Choose up to 200 files at a time"))
    const big=imgs.find(x=>x.size>3*1024*1024);if(big)return toast(tl("{name} is over 3 MB. Make it smaller first.",{name:big.name}))
    try{setBusy(`Reading ${pl(docs.length,'file')}…`);const fs=await Promise.all(docs.map(async x=>({name:x.webkitRelativePath||x.name,text:await x.text()}))),im={}
      for(const [i,x] of imgs.entries()){setBusy(`Uploading images: ${i+1} of ${imgs.length}…`);im[x.name]=await uploadImg(x)}
      setFiles(fs);setImages(im);await preview({files:fs,images:im})}catch(er){toast(er.message)}setBusy('')}
  const add=async()=>{setBusy('Adding the topics…');try{const r=await send(false);toast(tl("{n} added to {name}",{n:pl(r.created,'topic'),name:unit.name}));done()}catch(e){toast(e.message);setBusy('')}}
  const ok=rows?.ready||0
  return <Sheet page close={close}><h3>{tl("Upload topic files to")}{" "}{unit.name}</h3>
    <p className="known">{tl("One topic per file. Choose .html or .md files, or a whole folder: images in it are matched to the pages by file name. Topics are added in file-name order (2 before 10), after the topics already here. A Markdown file with the config sections (see Config template in the topic editor) also fills in the question pattern, sample answer and guideline.")}</p>
    <label className="chk"><input type="checkbox" checked={scripts} onChange={e=>{setScripts(e.target.checked);preview({scripts:e.target.checked})}}/>{" "}{tl("Keep each HTML page's JavaScript (HTML + JavaScript, run in a sandbox)")}</label>
    <label className="chk"><input type="checkbox" checked={pub} onChange={e=>{setPub(e.target.checked);preview({published:e.target.checked})}}/>{" "}{tl("Publish them now (otherwise they are drafts)")}</label>
    <div className="two"><button className="btn" disabled={!!busy} onClick={()=>pick.current.click()}><Upload size={16}/>{" "}{tl("Choose files")}</button><button className="btn ghost" disabled={!!busy} onClick={()=>folder.current.click()}>{tl("Choose a folder")}</button></div>
    <input ref={pick} type="file" hidden multiple accept=".html,.htm,.md,.markdown,.txt,image/png,image/jpeg,image/gif,image/webp" onChange={choose}/>
    <input ref={folder} type="file" hidden multiple webkitdirectory="" onChange={choose}/>
    {busy&&<p className="known" role="status">{busy}</p>}
    {rows&&<><b className="sec" style={{display:'block'}}>{ok}{" "}{tl("of {n} ready",{n:pl(rows.topics.length,'file')})}</b>
      {rows.topics.map((r,i)=><div key={i} className="row"><div>{r.ok?<b>{r.title}</b>:<s>{r.title||r.file}</s>}<small>{r.file}{r.ok?` · ${FMT[r.format]} · ${r.published?'published':'draft'}`:''}</small>{r.warnings.map((w,j)=><small key={j} className="warnline">{w}</small>)}</div></div>)}
      <button className="btn" disabled={!ok||!!busy} onClick={add}>{tl("Add")}{" "}{pl(ok,'topic')}</button></>}</Sheet>}
// Saved: a student's bookmarks and highlights in one place
function Saved({toast,role}){
  const [tab,setTab]=useState('bookmarks'),head=<Tabs label={tl("Saved")} items={[['bookmarks',tl("Bookmarks")],['highlights',tl("Highlights")]]} value={tab} onChange={setTab}/>
  return tab==='bookmarks'?<Bookmarks toast={toast} role={role} head={head}/>:<MyHighlights toast={toast} role={role} head={head}/>}
function Bookmarks({toast,role,head}){
  const [tree,setTree]=useState(null),[sem,setSem]=useState(null),[course,setCourse]=useState(null),[t,setT]=useState(null)
  const load=()=>api('/tree').then(setTree).catch(e=>toast(e.message));useEffect(()=>{load()},[t])
  if(t)return <Topic id={t} back={()=>setT(null)} toast={toast} role={role}/>
  if(!tree)return <><Bar title={head?tl("Saved"):tl("Bookmarks")}/><div className="main">{head}<div className="sk"/><div className="sk"/></div></>
  const marks=u=>u.topics.filter(x=>x.bookmarked),cnt=c=>c.units.reduce((n,u)=>n+marks(u).length,0)
  const sems=tree.flatMap(p=>p.semesters.map(sm=>({...sm,prog:p.name,courses:sm.courses.filter(c=>cnt(c)>0)}))).filter(sm=>sm.courses.length)
    .sort((a,b)=>a.prog.localeCompare(b.prog)||(a.number??99)-(b.number??99)||a.id-b.id)
  const multi=new Set(sems.map(x=>x.prog)).size>1,total=sems.reduce((n,x)=>n+x.courses.reduce((m,c)=>m+cnt(c),0),0)
  const sm=sems.find(x=>x.id===sem)||sems[0],co=sm?.courses.find(x=>x.id===course)||sm?.courses[0]
  const drop=async id=>{try{await api(`/topics/${id}/bookmark`,{method:'DELETE'});setTree(unmarked(tree,id));toast(tl("Bookmark removed"))}catch(e){toast(e.message)}}
  return <><Bar title={head?tl("Saved"):tl("Bookmarks")} sub={total?tl(total===1?'{n} topic saved':'{n} topics saved',{n:total}):tl("Nothing saved yet")}/><div className="main">{head}
    {!sm&&<p className="known">{tl("Open any topic and tap the bookmark icon to save it here. It shows only the topics you saved, grouped by semester or year, course and unit.")}</p>}
    {sm&&<>
      <div className="chips" role="group" aria-label={tl("Semester or year")}>{sems.map(x=><button key={x.id} className={'sbtn'+(x.id===sm.id?' on':'')} aria-pressed={x.id===sm.id} onClick={e=>{setSem(x.id);setCourse(null);tabTo(e)}}>
        <span className="lbl">{multi&&x.prog+' · '}{x.name}</span><em>{x.courses.reduce((n,c)=>n+cnt(c),0)}</em></button>)}</div>
      <div className="tabs scroll" role="tablist" aria-label={tl("Course")}>{sm.courses.map(c=><button key={c.id} role="tab" aria-selected={c.id===co.id} className={c.id===co.id?'on':''} onClick={e=>{setCourse(c.id);tabTo(e)}}>
        <span className="lbl">{c.name}</span><em>{cnt(c)}</em></button>)}</div>
      <Paged rows={co.units.flatMap(u=>marks(u).map(x=>({u,x})))} render={({u,x},i,j,pg)=><Fragment key={x.id}>{(!j||pg[j-1].u!==u)&&<h3 className="sec">{u.name}</h3>}
        <div className="card"><button className="hit" onClick={()=>setT(x.id)}><span className="dot" style={{background:COL[i%5]}}>{x.title[0]}</span><div><b>{x.title}</b></div><Mark s={x.status}/></button>
          <button className="ic sm on" aria-label={tl("Remove bookmark: {title}",{title:x.title})} onClick={()=>drop(x.id)}><Bookmark size={16} fill="currentColor"/></button></div></Fragment>}/>
    </>}</div></>}

const sheets=[]  // open sheets, topmost last, so Escape closes only the one on top
// a pop-up for short questions; with page set, a form that takes over the content area like a page of its own, with a way back
let pages=0  // forms open as pages right now; while any is open the page under it is hidden
const flat=(ch,at='')=>Children.toArray(ch).flatMap(c=>isValidElement(c)&&c.type===Fragment?flat(c.props.children,at+c.key):[isValidElement(c)?cloneElement(c,{key:at+c.key}):c])  // keys carry their fragment's, so two fragments' children never share one
export function Sheet({close,children,page}){
  const box=useRef(null),cb=useRef(close);cb.current=close
  useEffect(()=>{const me={},was=document.activeElement;sheets.push(me)
    const k=e=>{if(e.key==='Escape'&&sheets[sheets.length-1]===me)cb.current()}
    addEventListener('keydown',k);if(box.current&&!box.current.contains(document.activeElement))box.current.focus()
    return()=>{sheets.splice(sheets.indexOf(me),1);removeEventListener('keydown',k);if(was&&was.isConnected)was.focus?.()}},[])
  useEffect(()=>{if(!page)return;pages++;document.body.classList.add('has-page');scrollTo({top:0});return()=>{if(!--pages)document.body.classList.remove('has-page')}},[page])
  const slot=page&&document.getElementById('pageslot')
  if(slot){const all=flat(children),i=all.findIndex(c=>isValidElement(c)&&c.type==='h3'),title=i<0?'':all[i].props.children  // the form's heading becomes the page title
    return createPortal(<><Bar title={title} back={()=>cb.current()}/><div className="main" ref={box} tabIndex={-1} role="region" aria-label={typeof title==='string'?title:undefined}>{all.filter((_,j)=>j!==i)}</div></>,slot)}
  return <div className="scrim" onClick={()=>cb.current()}><div className="sheet" ref={box} tabIndex={-1} role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>{children}</div></div>}
const Confirm=({o,answer})=><Sheet close={()=>answer(false)}><h3>{o.title}</h3>
  {o.stats&&<div className="stats" style={{gridTemplateColumns:`repeat(${o.stats.length},1fr)`,margin:'8px 0'}}>{o.stats.map(([n,l])=><div className="stat" key={l} style={{overflowWrap:'anywhere',minWidth:0}}><b>{n}</b>{l}</div>)}</div>}
  {o.body&&<p className="known">{o.body}</p>}
  <button className={'btn'+(o.danger?' danger':'')} onClick={()=>answer(true)}>{o.ok||tl("Confirm")}</button><button className="btn ghost" onClick={()=>answer(false)}>{o.cancel||tl("Cancel")}</button></Sheet>
export const useConfirm=()=>useContext(Ctx).confirm
const Toast=({msg})=>msg?<div className="toast" role="status">{msg}</div>:null
export const Skeleton=({rows=3})=><div aria-busy="true" aria-label={tl("Loading")}>{Array.from({length:rows},(_,i)=><div className="sk" key={i}/>)}</div>
// numbered pages under a list: Previous, page numbers (with … in long lists), Next, and which rows are shown
const pageList=(n,at)=>n<=7?[...Array(n).keys()]:[...new Set([0,1,at-1,at,at+1,n-2,n-1].filter(i=>i>=0&&i<n))].sort((a,b)=>a-b).flatMap((i,j,a)=>j&&i-a[j-1]>1?['…'+i,i]:[i])
export function Pager({page,total,onPage,size=PAGE,anchor}){
  const n=Math.ceil(total/size);if(n<=1)return null
  const go=i=>{onPage(i);if(anchor?.current)anchor.current.scrollIntoView({block:'start'});else scrollTo({top:0})}
  return <nav className="pgr" aria-label={tl("Pages")}><small>{page*size+1}{tl("–{Math} of",{Math:Math.min(total,(page+1)*size)})}{" "}{total}</small>
    <span className="pgb"><button className="tool" disabled={page===0} onClick={()=>go(page-1)} aria-label={tl("Previous page")}><ChevronLeft size={16}/></button>
      {pageList(n,page).map(i=>typeof i==='string'?<span key={i} className="gap">…</span>:<button key={i} className={'tool'+(i===page?' on':'')} aria-current={i===page?'page':undefined} onClick={()=>go(i)}>{i+1}</button>)}
      <button className="tool" disabled={page>=n-1} onClick={()=>go(page+1)} aria-label={tl("Next page")}><ChevronRight size={16}/></button></span></nav>}
// the list's rows for the current page; a filter change goes back to page 1, and a page left empty (say after a delete) steps back one
export function usePaged(url,deps,toast,size=PAGE){
  const [page,setPage]=useState(0),[items,setItems]=useState([]),[total,setTotal]=useState(0),[n,setN]=useState(0),[ready,setReady]=useState(false),[data,setData]=useState(null)
  useEffect(()=>{setPage(0)},deps)
  useEffect(()=>{const t=setTimeout(()=>api(url(page*size)).then(r=>{if(!r.items.length&&page>0)setPage(page-1);else{setItems(r.items);setTotal(r.total);setData(r);setReady(true)}}).catch(e=>toast(e.message)),250);return()=>clearTimeout(t)},[...deps,page,n])
  return {items,total,page,setPage,ready,data,reload:()=>setN(x=>x+1)}}
// the same for a list the browser already holds: the rows of the current page, back to page 1 when the search, filter or sort changes
export function useLocalPage(rows,deps,size=PAGE){
  const [page,setPage]=useState(0)
  useEffect(()=>{setPage(0)},deps)
  const n=Math.max(1,Math.ceil((rows?.length||0)/size)),at=Math.min(page,n-1)
  return {items:(rows||[]).slice(at*size,(at+1)*size),total:rows?.length||0,page:at,setPage}}
// a list the page already holds, ten rows at a time; render gets each row, its place in the whole list, and its place on this page
export function Paged({rows,render,size=PAGE}){
  const [page,setPage]=useState(0),top=useRef(),all=rows||[],n=Math.max(1,Math.ceil(all.length/size)),at=Math.min(page,n-1),shown=all.slice(at*size,(at+1)*size)
  if(all.length<=size)return all.map((x,i)=>render(x,i,i,all))
  return <><span ref={top} className="pgtop"/>{shown.map((x,j)=>render(x,at*size+j,j,shown))}<Pager page={at} total={all.length} onPage={setPage} size={size} anchor={top}/></>}
export const has=(q,...v)=>{q=q.trim().toLowerCase();return !q||v.some(x=>String(x??'').toLowerCase().includes(q))}
export const Opts=({label,value,set,items})=><select aria-label={label} value={value} onChange={e=>set(e.target.value)}>{items.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
export const Tabs=({items,value,onChange,scroll,label})=><div className={'tabs'+(scroll?' scroll':'')} role="tablist" aria-label={label}>{items.map(([k,l])=><button key={k} role="tab" aria-selected={value===k} className={value===k?'on':''} onClick={()=>onChange(k)}>{l}</button>)}</div>

export const download=(name,text)=>{const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));l.download=name;l.click()}
export const TERM_MAX={Grade:12},maxOf=term=>TERM_MAX[term]||8,upTo=n=>Array.from({length:n},(_,i)=>i+1)
export const termOf=(progs,id)=>progs.find(p=>String(p.id)===String(id))?.term||'Semester',semsOf=(progs,id)=>upTo(id?maxOf(termOf(progs,id)):Math.max(8,...progs.map(p=>maxOf(p.term))))
const PATTERN_EN={semester:['Semesters','Semester',8,'Semester pattern, for example B.E., B.Tech or M.E. Students move up one semester at a time.'],
  year:['Years','Year',4,'Annual pattern, for example M.B.B.S, B.Sc or law degrees, up to 8 years. For a school, choose School grades. Students move up one year at a time.'],
  grade:['School grades','Grade',12,'School pattern, Grade 1 to Grade 12. Students move up one grade at a time.']},PATTERN=L(PATTERN_EN)  // PATTERN_EN for logic, PATTERN for what is shown

// AI plans of self-registered people: lite (a free daily allowance on the college's key), their own key, or pro (more, given by an admin until a date)
export const PLAN_NAME={lite:'Lite',pro:'Pro',own:'Own key',college:'College',family:'Family key',off:'No AI'}
const planLine=u=>u.plan==='pro'?tl("Pro until {date}",{date:day(new Date(new Date(u.pro_until)-1).toISOString())}):u.plan==='own'?tl("Own key: uses their own AI key"):tl("Lite: the free daily allowance")
function ProControl({u,toast,done}){
  const [until,setUntil]=useState(''),[busy,setBusy]=useState(false),confirm=useConfirm()
  const set=async body=>{setBusy(true);try{await api(`/admin/users/${u.id}/pro`,{method:'PUT',body});toast(body.end?tl("Back on Lite"):tl("{name} is Pro now",{name:u.name}));setUntil('');done()}catch(e){toast(srv(e.message))}setBusy(false)}
  return <><h3 className="sec">{tl("More AI")}</h3>
    {u.asked&&<div className="qbox" style={{marginTop:0}}><b>{tl("Asked for more AI")}</b> · <small>{when(u.asked.at)}</small>{u.asked.note&&<p style={{margin:'4px 0 0'}}>“{u.asked.note}”</p>}</div>}
    <p className="known">{u.plan==='pro'?tl("Pro: the college's AI with the usual limits, until the date below. Then back to Lite."):u.plan==='own'?tl("They use their own AI key, so no limit applies. Pro would also let them ask about diagrams in photos."):tl("Lite: a few free AI searches and minutes of learning a day. Pro lifts that until a date you choose.")}</p>
    <div className="chips wrap">{[7,30,90,365].map(d=><button key={d} className="stepchip" disabled={busy} onClick={()=>set({days:d})}>{d===365?tl("1 year"):tl("{n} days",{n:d})}</button>)}</div>
    <label htmlFor="prou">{tl("Or Pro until")}</label><div className="two"><input id="prou" type="date" value={until} onChange={e=>setUntil(e.target.value)} min={new Date().toISOString().slice(0,10)}/><button className="btn" style={{marginTop:0}} disabled={busy||!until} onClick={()=>set({until})}>{tl("Make Pro")}</button></div>
    {u.plan==='pro'&&<button className="btn ghost" disabled={busy} onClick={async()=>{if(await confirm({title:tl("End Pro for {name}?",{name:u.name}),body:tl("They go back to the free daily allowance straight away."),ok:tl("End Pro"),danger:true}))set({end:true})}}>{tl("End Pro now")}</button>}</>}
// the learning clock: while a learning screen is open and on screen, a lite person's minutes are counted (one tick a minute; the server counts each minute once)
let litePlan=null
export function useLearnClock(){
  useEffect(()=>{let t=null,off=false
    const start=()=>{t=setInterval(()=>{if(document.visibilityState==='visible')api('/me/plan/tick',{method:'POST'}).catch(()=>{})},60000)}
    if(litePlan===null)api('/ai/status').then(r=>{litePlan=r.plan==='lite';if(litePlan&&!off)start()}).catch(()=>{});else if(litePlan)start()
    return()=>{off=true;if(t)clearInterval(t)}},[])}
export const money=(v,cur)=>{try{return new Intl.NumberFormat(locale(),{style:'currency',currency:cur,maximumFractionDigits:3,minimumFractionDigits:v%1?2:0}).format(v)}catch{return cur+' '+v}}
export const spanOf=d=>d%365===0?tl(d===365?'1 year':'{n} years',{n:d/365}):d%30===0?tl(d===30?'1 month':'{n} months',{n:d/30}):tl(d===1?'1 day':'{n} days',{n:d})
// a self-registered student's plan, with today's free allowance and the ways to more: their own key, asking the admin, or buying Pro
function PlanCard({toast,onKey}){
  const [p,setP]=useState(null),[note,setNote]=useState(''),[asking,setAsking]=useState(false),[busy,setBusy]=useState(false),[o,setO]=useState(null)
  const load=()=>api('/me/plan').then(r=>{setP(r);litePlan=r.plan==='lite'}).catch(()=>{});useEffect(()=>{load();api('/me/pro/offers').then(setO).catch(()=>{})},[])
  const buy=async i=>{setBusy(true);try{location.href=(await api('/me/pro/buy',{method:'POST',body:{offer:i}})).url}catch(e){toast(srv(e.message));setBusy(false)}}  // Razorpay's page, then back to #paid=
  if(!p||p.plan==='college')return null
  const send=async()=>{setBusy(true);try{toast(srv((await api('/me/plan/request',{method:'POST',body:{note}})).message));setAsking(false);setNote('');load()}catch(e){toast(srv(e.message))}setBusy(false)}
  const meter=(used,max,label)=><div style={{marginTop:8}}><small className="known">{label}</small><div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={used}><i style={{width:Math.min(100,Math.round(100*used/Math.max(1,max)))+'%'}}/></div></div>
  return <><h3 className="sec">{tl("AI help")}</h3><div className="qbox">
    <b>{tl(PLAN_NAME[p.plan])}</b>
    {p.plan==='pro'&&<p className="known" style={{margin:'4px 0 0'}}>{tl("No daily limit until {date}. Then you are back on Lite.",{date:day(new Date(new Date(p.pro_until)-1).toISOString())})}</p>}
    {p.plan==='own'&&<p className="known" style={{margin:'4px 0 0'}}>{tl("You use your own AI key, so there is no daily limit.")}</p>}
    {p.plan==='family'&&<p className="known" style={{margin:'4px 0 0'}}>{tl("Your AI help runs on your parent's or teacher's AI key.")}</p>}
    {p.plan==='off'&&<p className="known" style={{margin:'4px 0 0'}}>{tl("AI help is off. A parent or teacher can turn it on by adding their AI key to their account.")}</p>}
    {p.plan==='lite'&&<><p className="known" style={{margin:'4px 0 0'}}>{tl("Free each day: {s} AI searches and {m} minutes of learning with AI. Saved answers never count.",{s:p.searches_limit,m:p.minutes_limit})}</p>
      {meter(p.searches_used,p.searches_limit,tl("Searches today: {n} of {max}",{n:p.searches_used,max:p.searches_limit}))}
      {meter(p.minutes_used,p.minutes_limit,tl("Minutes today: {n} of {max}",{n:p.minutes_used,max:p.minutes_limit}))}
      <div className="two" style={{marginTop:10}}>{p.own_key&&<button className="btn ghost" onClick={onKey}>{tl("Use my own AI key")}</button>}
        {p.asked?<button className="btn ghost" disabled>{tl("Asked your admin")}</button>:<button className="btn ghost" onClick={()=>setAsking(true)}>{tl("Ask my admin for more")}</button>}</div></>}
    {o?.on&&o.offers.length>0&&(p.plan==='lite'||p.plan==='pro')&&<><p className="known" style={{margin:'12px 0 0'}}>{p.plan==='pro'?tl("Add more Pro time:"):tl("Or get Pro now: no daily limit, and diagrams where your teacher turns them on.")}</p>
      <div className="offers">{o.offers.map(x=><button key={x.id} className="btn" disabled={busy} onClick={()=>buy(x.id)}><CreditCard size={16}/> {tl("Pro for {time}",{time:spanOf(x.days)})}{" · "}{money(x.price,o.currency)}</button>)}</div>
      <small className="known">{tl("You pay on Razorpay's secure page, by card, UPI, netbanking or wallet. Pro starts as soon as the payment is confirmed.")}</small></>}</div>
    {asking&&<Sheet close={()=>setAsking(false)}><h3>{tl("Ask for more AI")}</h3><p className="known">{tl("Your admin can give you more for a while. Say why if you like.")}</p>
      <label htmlFor="mnote">{tl("Note (optional)")}</label><input id="mnote" value={note} maxLength={300} onChange={e=>setNote(e.target.value)} placeholder={tl("Exams next week")}/>
      <button className="btn" disabled={busy} onClick={send}>{tl("Send request")}</button><button className="btn ghost" onClick={()=>setAsking(false)}>{tl("Cancel")}</button></Sheet>}</>}
export function UserDetail({id,me,progs,back,toast}){
  const confirm=useConfirm()
  const [u,setU]=useState(null),[ed,setEd]=useState(false),[ask,setAsk]=useState(false),[pw,setPw]=useState(null),[busy,setBusy]=useState(false),[asg,setAsg]=useState(null),[ctree,setCtree]=useState([])
  const load=()=>api('/admin/users/'+id).then(setU).catch(e=>{toast(e.message);back()})
  useEffect(()=>{load()},[id]);useEffect(()=>{if(u?.role==='faculty')api('/tree').then(setCtree)},[u?.role])
  if(!u)return <><Bar title={tl("Loading")} back={back}/><div className="main"><div className="sk"/><div className="sk"/></div></>
  const reset=async()=>{setBusy(true);try{const r=await api(`/admin/users/${u.id}/reset-password`,{method:'POST'});setAsk(false);setPw(r.password)}catch(e){toast(e.message)}setBusy(false)}
  const remove=async()=>{if(!await confirm({title:tl("Delete {name}?",{name:u.name}),body:tl("This permanently removes the account and {v}. Content they created stays.{v2} To keep their history, edit the user and set Status to Disabled instead.",{v:u.role==='student'?'their progress, test results and bookmarks':'their own records',v2:u.role==='faculty'?' Courses they own will have no owner.':''}),ok:tl("Delete user"),danger:true}))return
    try{await api('/admin/users/'+u.id,{method:'DELETE'});toast(tl("{name} deleted",{name:u.name}));back()}catch(e){toast(e.message)}}
  const copy=async()=>{try{await navigator.clipboard.writeText(pw);toast(tl("Copied"))}catch{toast(tl("Press and hold the password to copy it"))}}
  const row=(v,l)=><div className="row"><div>{v}<small>{l}</small></div></div>
  const allCourses=ctree.flatMap(p=>p.semesters.flatMap(s=>s.courses.filter(c=>!c.shared).map(c=>({id:c.id,owner_id:c.owner_id,owner:c.owner,label:`${p.name} › ${s.name} › ${c.name}`}))))
  const saveAsg=async()=>{try{await api(`/admin/users/${u.id}/courses`,{method:'PUT',body:{course_ids:asg}});toast(tl("Courses updated"));setAsg(null);load()}catch(e){toast(e.message)}}
  const decide=async ok=>{if(!ok&&!await confirm({title:tl("Decline {name}?",{name:u.name}),body:tl("Their account stays switched off, and they are told."),ok:tl("Decline"),danger:true}))return
    try{await api(`/admin/users/${u.id}/approval`,{method:'POST',body:{approve:ok}});toast(ok?tl("Approved. They can sign in now."):tl("Declined"));load()}catch(e){toast(srv(e.message))}}
  return <><Bar title={u.name} sub={u.email} back={back}/><div className="main">
    {u.approval==='pending'&&<div className="qbox" role="status"><b>{tl("Waiting for your approval")}</b><p className="known" style={{margin:'4px 0 8px'}}>{tl("This person signed up as a school teacher. Approve to let them sign in, add students and offer courses.")}</p>
      <div className="two"><button className="btn" onClick={()=>decide(true)}>{tl("Approve")}</button><button className="btn ghost danger" onClick={()=>decide(false)}>{tl("Decline")}</button></div></div>}
    <div className="stats"><div className="stat"><b>{u.topics_read}</b>{tl("Topics read")}</div><div className="stat"><b>{u.reads}</b>{tl("Total reads")}</div></div>
    <h3 className="sec">{tl("Profile")}</h3>
    {row(roleName(u),'Role')}{u.username&&row(u.username,tl("Username"))}{row(u.active?'Active':'Disabled','Status')}{row(u.program||'Not set','Program')}{row(u.semester||'Not set',termOf(progs,u.program_id))}{u.self_registered&&<>{row(u.institution||'—','Institution')}{row(u.id_number||'—','ID number')}{row(u.phone||'—','Phone')}{row(planLine(u),'AI plan')}</>}{!u.self_registered&&(u.plan==='lite'||u.plan==='pro')&&row(planLine(u),'AI plan')}{row(day(u.last_active),'Last active')}
    {(u.self_registered||u.plan==='lite'||u.plan==='pro')&&<ProControl u={u} toast={toast} done={load}/>}
    {u.role==='faculty'&&<><h3 className="sec">{tl("Courses they own")}</h3>{(u.course_ids||[]).length?allCourses.filter(c=>u.course_ids.includes(c.id)).map(c=><div className="row" key={c.id}><div>{c.label}</div></div>):<p className="known">{tl("None yet. They can read published content but edit nothing until they own a course.")}</p>}<button className="btn ghost" onClick={()=>setAsg([...(u.course_ids||[])])}>{tl("Assign courses")}</button></>}
    {(u.links||[]).length>0&&<><h3 className="sec">{u.role==='student'?tl("Parents and teachers"):u.relation==='teacher'?tl("Their students"):tl("Their children")}</h3>
      {u.links.map(x=><div className="row" key={x.id}><div>{x.name}{x.status==='invited'&&<span className="pill sm">{tl("Invited")}</span>}<small>{u.role==='student'?(x.who==='teacher'?tl("Teacher"):tl("Parent")):x.who}</small></div></div>)}</>}
    <h3 className="sec">{tl("Recently read")}</h3>
    {u.recent.length?<Paged rows={u.recent} render={(x,i)=><div className="row" key={i}><div>{x.title}<small>{x.reads}{" "}{tl("reads, last")}{" "}{day(x.last_read)}</small></div></div>}/>:<p className="known">{tl("No reading activity yet.")}</p>}
    <div className="two"><button className="btn ghost" onClick={()=>setEd(true)}>{tl("Edit")}</button><button className="btn" onClick={()=>setAsk(true)}>{tl("Reset password")}</button></div>
    {u.id!==me.id&&<button className="btn danger" onClick={remove}>{tl("Delete user")}</button>}</div>
    {ed&&<UserSheet u={u} me={me} progs={progs} toast={toast} close={()=>setEd(false)} done={()=>{setEd(false);load()}}/>}
    {ask&&<Sheet close={()=>setAsk(false)}><h3>{tl("Reset password?")}</h3><p className="known">{tl("This gives {name} a new password and replaces the old one straight away. You will see the new password once.",{name:u.name})}</p>
      <button className="btn danger" disabled={busy} onClick={reset}>{tl("Reset password")}</button><button className="btn ghost" onClick={()=>setAsk(false)}>{tl("Cancel")}</button></Sheet>}
    {pw&&<Sheet close={()=>setPw(null)}><h3>{tl("New password")}</h3><p className="known">{tl("Share this with {name} now. It is not shown again.",{name:u.name})}</p><div className="pw">{pw}</div>
      <button className="btn" onClick={copy}>{tl("Copy password")}</button><button className="btn ghost" onClick={()=>setPw(null)}>{tl("Done")}</button></Sheet>}
    {asg&&<Sheet page close={()=>setAsg(null)}><h3>{tl("Courses {name} owns",{name:u.name})}</h3><p className="known">{tl("The owner adds and edits the units, topics and quizzes of a course. Each course has one owner, so ticking a course another person owns moves it to {name}.",{name:u.name})}</p>{allCourses.map(c=><label key={c.id} className="chk"><input type="checkbox" checked={asg.includes(c.id)} onChange={e=>setAsg(e.target.checked?[...asg,c.id]:asg.filter(i=>i!==c.id))}/> {c.label}{c.owner_id&&c.owner_id!==u.id?tl(" (now {owner})",{owner:c.owner}):''}</label>)}<button className="btn" onClick={saveAsg}>{tl("Save")}</button><button className="btn ghost" onClick={()=>setAsg(null)}>{tl("Cancel")}</button></Sheet>}</>}

export function UserSheet({u,me,progs,close,done,toast}){
  const isNew=!u.id,self=u.id===me.id,[busy,setBusy]=useState(false)
  const [f,setF]=useState({name:u.name||'',email:u.email||'',role:u.kind||u.role||'student',active:u.active??true,password:'',program_id:u.program_id||'',semester:u.semester||''}),set=k=>e=>setF({...f,[k]:e.target.value})
  const save=async()=>{setBusy(true);try{
    const enrol={program_id:f.program_id?+f.program_id:null,semester:f.semester?+f.semester:null}
    if(isNew)await api('/admin/users',{method:'POST',body:{...f,...enrol}})
    const r=isNew?null:await api('/admin/users/'+u.id,{method:'PATCH',body:{name:f.name,email:f.email,...enrol,...(self?{}:{role:f.role,active:f.active})}})
    toast(isNew?tl("User added"):r.courses_needing_owner?tl("Saved. {courses_needing_owner} course(s) they own need a new owner.",{courses_needing_owner:r.courses_needing_owner}):tl("Changes saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet page close={close}><h3>{isNew?tl("New user"):tl("Edit user")}</h3>
    <label>{tl("Name")}</label><input value={f.name} onChange={set('name')}/><label>{u.username?tl("Email (optional)"):tl("Email")}</label><input type="email" value={f.email} onChange={set('email')}/>
    <label>{tl("Role")}</label><select disabled={self} value={f.role} onChange={set('role')}><option value="student">{tl("Student")}</option><option value="faculty">{tl("Faculty")}</option><option value="admin">{tl("Admin")}</option><option value="parent">{tl("Parent")}</option><option value="teacher">{tl("School teacher")}</option></select>
    {f.role==='student'&&<><label>{tl("Program")}</label><select value={f.program_id} onChange={e=>{const id=e.target.value;setF({...f,program_id:id,semester:+f.semester>semsOf(progs,id).length?'':f.semester})}}><option value="">{tl("Not set")}</option>{progs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <label>{termOf(progs,f.program_id)}</label><select value={f.semester} onChange={set('semester')}><option value="">{tl("Not set")}</option>{semsOf(progs,f.program_id).map(n=><option key={n} value={n}>{n}</option>)}</select></>}
    <label>{tl("Status")}</label><select disabled={self} value={f.active?'1':'0'} onChange={e=>setF({...f,active:e.target.value==='1'})}><option value="1">{tl("Active")}</option><option value="0">{tl("Disabled")}</option></select>
    {isNew?<><label>{tl("Password (8+ characters)")}</label><input type="password" autoComplete="new-password" value={f.password} onChange={set('password')}/></>
      :<p className="known" style={{marginTop:14}}>{tl("To give this person a new password, use Reset password on their page.")}</p>}
    {self&&<p className="known">{tl("You can't change your own role or status.")}</p>}
    <button className="btn" disabled={busy} onClick={save}>{isNew?tl("Add user"):tl("Save changes")}</button></Sheet>}

function OwnerSheet({c,close,done,toast}){
  const faculty=useFaculty(true),[sel,setSel]=useState(c.owner_id||''),[busy,setBusy]=useState(false)
  const save=async()=>{if(String(sel)===String(c.owner_id||''))return close();setBusy(true);try{await api(`/courses/${c.id}/owner`,{method:'PUT',body:{user_id:sel?+sel:null}});toast(tl("Owner updated"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet page close={close}><h3>{tl("Owner of “{name}”",{name:c.name})}</h3><p className="known">{tl("The owner adds and edits this course's units, topics and quizzes. Changing the owner keeps all content and student progress.")}{c.owner_problem&&c.owner_id?' '+srv(c.owner_problem)+'.':''}</p>
    <label>{tl("Owner (faculty)")}</label><select value={sel} onChange={e=>setSel(e.target.value)}><option value="">{tl("Not assigned")}</option>{c.owner_id&&!faculty.some(u=>u.id===c.owner_id)&&<option value={c.owner_id}>{c.owner}{" "}{tl("(can't edit)")}</option>}{faculty.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select>
    <button className="btn" disabled={busy} onClick={save}>{tl("Save")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}

export function ProgramSheet({p,close,done,toast}){
  const isNew=!p.id,[name,setName]=useState(p.name||''),[pat,setPat]=useState(p.pattern||'semester'),[terms,setTerms]=useState(PATTERN[pat][2]),[touched,setTouched]=useState(false),[busy,setBusy]=useState(false)
  const lab=PATTERN_EN[pat][1],pick=k=>{setPat(k);setTerms(touched?Math.min(terms,maxOf(PATTERN_EN[k][1])):PATTERN[k][2])}
  const save=async()=>{setBusy(true);try{const r=await api(isNew?'/programs':'/programs/'+p.id,{method:isNew?'POST':'PUT',body:{name,pattern:pat,...(isNew?{terms}:{})}});toast(isNew?(r.terms?tl("Program added with {terms} {lab}{v}",{terms:r.terms,lab:lab.toLowerCase(),v:r.terms===1?'':'s'}):tl("Program added")):tl("Changes saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  return <Sheet page close={close}><h3>{isNew?tl("New program"):tl("Edit program")}</h3>
    <label>{tl("Name")}</label><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder={tl("B.E. Mechanical Engineering")} autoFocus/>
    <p className="known" style={{marginTop:10}}>{tl("Names must be unique. The users CSV import matches programs by name.")}</p>
    <label id="pat">{tl("How is the program divided?")}</label><div role="group" aria-labelledby="pat" className="seg" style={{marginTop:0}}>{Object.entries(PATTERN).map(([k,[l]])=><button key={k} className={pat===k?'on':''} aria-pressed={pat===k} onClick={()=>pick(k)}>{l}</button>)}</div>
    <p className="known" style={{marginTop:6}}>{PATTERN[pat][3]}</p>
    {isNew?<><label htmlFor="nt">{tl("How many {lab}s?",{lab:tl(lab).toLowerCase()})}</label><select id="nt" value={terms} onChange={e=>{setTerms(+e.target.value);setTouched(true)}}>{[0,...upTo(maxOf(lab))].map(n=><option key={n} value={n}>{n===0?tl("None yet, I will add them myself"):n}</option>)}</select>
      <p className="known" style={{marginTop:6}}>{terms?tl("{lab} 1{v} {v2} created for you, so you can go straight to adding courses.",{lab:tl(lab),v:terms>1?` to ${lab} ${terms}`:'',v2:terms>1?'are':'is'}):tl("You can add them one by one later.")}</p></>
      :p.pattern&&pat!==p.pattern&&<p className="known" style={{marginTop:6}}>{tl("Terms still named “{v} n” are renamed to “{lab} n”. Terms you named yourself keep their names.",{v:PATTERN[p.pattern]?.[1]||'Semester',lab:lab})}{pat==='grade'&&tl(" Any of Grade 1 to Grade 12 the program does not have yet are added.")}</p>}
    <button className="btn" disabled={busy||!name.trim()} onClick={save}>{isNew?tl("Add program"):tl("Save changes")}</button></Sheet>}
export const day=d=>d?new Date(d).toLocaleDateString(locale(),{day:'numeric',month:'short'}):tl('never')
export const fetchFile=async(url,name,toast)=>{try{const r=await fetch(ROOT+'/api'+url,{headers:{Authorization:'Bearer '+localStorage.t}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).detail||'Download failed')
  const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download=name;a.click();URL.revokeObjectURL(a.href)}catch(e){toast(e.message)}}
export const Bar2=({v})=><div className="meter"><i style={{width:Math.min(100,v||0)+'%'}}/></div>

function About({user}){
  const {appName}=useContext(Ctx),[c,setC]=useState({});useEffect(()=>{api('/config').then(setC)},[])
  return <><Bar title={tl("About")}/><div className="main"><div className="hero"><h2>{appName}</h2><p>{tl("Version")}{" "}{c.version||''}</p></div>
    <div className="prose"><p>{tl("A study companion for engineering students. Your admin adds programs, semesters, courses, units and topics along with the question pattern and answer guideline. Open a topic to get a clear explanation and a sample answer that follows the guideline.")}</p>
    <p>{tl("The app remembers which topics you have read. Explanations and sample answers are generated once with AI and shared, so they open instantly.")}</p>
    <p>{tl("Signed in as")}{" "}<strong>{user.name}</strong> ({user.role}).</p></div></div></>}
