// study pages, loaded only when one of them is opened (split from App.jsx; the shell and shared helpers stay there)
import {useState,useEffect,useRef,Fragment} from 'react'
import {Md} from '../content.jsx'
import {ROOT} from '../base.js'
import {Sparkles,Search,ChevronLeft,ChevronRight,Upload,Check,Pencil,Trash2,Play,Target,RotateCcw,ClipboardList,Scissors} from 'lucide-react'
import {t as tl} from '../i18n.js'
import {Bar,Bar2,COL,LearnCard,MAX_FILE_MB,Paged,Sheet,Skeleton,StudyQuizPlay,Tabs,api,has,pl,srcLine,tooBig,useConfirm,useLearnClock,usePoll,when} from '../App.jsx'
// ---- courses students build from their own material ----
export const STAR_HELP='★ topic completed · ★★ quiz passed · ★★★ mastered (90%+ in a quiz)'
export const STEPS=['Name','Material','Slice','Preview'],AREA_LABEL={strong:'Strong',getting_there:'Getting there',needs_study:'Revisit'}
export const Steps=({at})=><ol className="steps" aria-label={tl("Setup steps")}>{STEPS.map((s,i)=><li key={s} className={i<at?'done':i===at?'on':''} aria-current={i===at?'step':undefined}><span>{i<at?<Check size={14}/>:i+1}</span>{tl(s)}</li>)}</ol>
export const NOTES_HINT='Optional. For example: "One topic per verse", "Keep the vocabulary table in one topic", "Units should follow the chapters", "Make topics very short".'
export function StudyHome({toast,start}){
  const [d,setD]=useState(null),[me,setMe]=useState(null),[open,setOpen]=useState(start&&start.id?start:null),[make,setMake]=useState(false),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[rev,setRev]=useState(null)
  const load=()=>{api('/study/courses').then(setD).catch(e=>toast(e.message));api('/study/me').then(setMe).catch(()=>{})}
  useEffect(()=>{if(!open&&!rev)load()},[open,rev])
  const review=async cid=>{try{setRev(await api(`/study/courses/${cid}/review`,{method:'POST'}))}catch(e){toast(e.message)}}
  useEffect(()=>{if(start?.review)review(start.review)},[])  // Home's "Review" button starts the review straight away
  if(rev)return <StudyQuizPlay quiz={rev} toast={toast} back={()=>setRev(null)}/>
  if(open)return open.wizard?<StudyWizard id={open.id} toast={toast} back={()=>setOpen(null)} done={()=>setOpen({id:open.id})}/>:<StudyCourse id={open.id} topic={open.topic} toast={toast} back={()=>setOpen(null)} setup={()=>setOpen({id:open.id,wizard:true})}/>
  const create=async()=>{setBusy(true);try{const r=await api('/study/courses',{method:'POST',body:{title}});setMake(false);setTitle('');setOpen({id:r.id,wizard:true})}catch(e){toast(e.message)}setBusy(false)}
  const card=(c,i)=><button key={c.id} className="row rowbtn" onClick={()=>setOpen({id:c.id,wizard:c.mine&&c.status!=='ready'})}><span className="dot" style={{background:COL[i%5]}}>{c.title[0]}</span>
    <div>{c.title}{c.status!=='ready'&&<span className="pill sm" style={{marginLeft:6}}>{tl("Setup not finished")}</span>}{c.mine&&c.share==='program'&&<span className="pill sm okp" style={{marginLeft:6}}>{tl("Shared")}</span>}
      <small>{c.status==='ready'?tl("{completed} of {topics} topics completed",{completed:c.completed,topics:c.topics}):tl("Continue the setup")}{!c.mine?tl(" · by {owner}",{owner:c.owner}):''}</small>{c.status==='ready'&&c.topics>0&&<Bar2 v={100*c.completed/c.topics}/>}</div><ChevronRight size={18}/></button>
  return <><Bar title={tl("Build a course")} sub={tl("Turn your own notes into a course")}/><div className="main">
    {me&&me.courses>0&&<LearnCard me={me} onContinue={n=>setOpen({id:n.course_id,topic:n.topic_id})} onReview={review}/>}
    <p className="known" style={{marginTop:me&&me.courses>0?16:0}}>{tl("Upload your notes, textbook chapters or handouts. The AI slices them into units and small topics, you check and adjust the outline, and then you study it with explanations, practice MCQs and quizzes.")}</p>
    <button className="btn lead" onClick={()=>setMake(true)}><Upload size={16}/>{" "}{tl("New course from my material")}</button>
    {!d?<Skeleton/>:<>{d.mine.length>0&&<><h3 className="sec">{tl("My courses")}</h3>{<Paged rows={d.mine} render={card}/>}</>}
      {d.shared.length>0&&<><h3 className="sec">{tl("Shared by classmates")}</h3>{<Paged rows={d.shared} render={card}/>}</>}
      {!d.mine.length&&!d.shared.length&&<p className="known">{tl("You have not built a course yet.")}</p>}</>}
    {make&&<Sheet close={()=>setMake(false)}><h3>{tl("New course")}</h3><label htmlFor="sct">{tl("Course name")}</label><input id="sct" autoFocus value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&title.trim()&&create()} placeholder={tl("e.g. Islamic Education · Unit 4")}/>
      <button className="btn" disabled={busy||!title.trim()} onClick={create}>{tl("Next: add material")}</button><button className="btn ghost" onClick={()=>setMake(false)}>{tl("Cancel")}</button></Sheet>}</div></>}
export function StudyWizard({id,toast,back,done}){
  const confirm=useConfirm()
  const [c,setC]=useState(null),[step,setStep]=useState(null),[text,setText]=useState(''),[busy,setBusy]=useState(''),[notes,setNotes]=useState(''),[plan,setPlan]=useState(null),[dirty,setDirty]=useState(false),[peek,setPeek]=useState(null),fileRef=useRef()
  const load=async(go)=>{try{const d=await api('/study/courses/'+id);setC(d);setNotes(d.notes);setPlan(d.plan);setDirty(false);setStep(go??(d.plan?3:d.sources.length?2:1));return d}catch(e){toast(e.message);back()}}
  useEffect(()=>{load()},[id]);usePoll(!!c?.reading,()=>api('/study/courses/'+id).then(d=>setC(d)).catch(()=>{}))  // only the file list refreshes; the step and outline stay
  if(!c||step==null)return <><Bar title={tl("Set up your course")} back={back}/><div className="main"><Skeleton/></div></>
  const files=async e=>{const fs=[...e.target.files];e.target.value='';for(const f of fs){if(tooBig(f)){toast(tl("{name} is over {MAX_FILE_MB} MB. Split it into smaller files.",{name:f.name,MAX_FILE_MB:MAX_FILE_MB}));continue}setBusy(tl("Reading {name}…",{name:f.name}))
      try{const r=await fetch(ROOT+`/api/study/courses/${id}/files?name=${encodeURIComponent(f.name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+localStorage.t},body:f}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(tl(j.detail||'Upload failed'));toast(j.status==='reading'?tl("{name} is scanned pages. Reading them now…",{name:f.name}):tl("{name}: {n} read",{name:f.name,n:pl(j.words,'word')}))}catch(x){toast(f.name+': '+x.message)}}
    setBusy('');load(1)}
  const paste=async()=>{setBusy('Adding…');try{const r=await api(`/study/courses/${id}/text`,{method:'POST',body:{text}});setText('');toast(tl("{n} added",{n:pl(r.words,'word')}))}catch(e){toast(e.message)}setBusy('');load(1)}
  const dropSrc=async i=>{if(!await confirm({title:tl("Remove this material?"),body:tl("Its text is taken out of the course. Any outline already made is cleared."),ok:tl("Remove"),danger:true}))return;try{await api(`/study/courses/${id}/sources/${i}`,{method:'DELETE'});load(1)}catch(e){toast(e.message)}}
  const slice=async method=>{if(dirty&&!await confirm({title:tl("Slice again?"),body:tl("Your renames, merges and removals in the current outline are replaced."),ok:tl("Slice again")}))return
    setBusy(method==='ai'?'The AI is reading your material and slicing it. This can take a minute…':'Slicing by headings…')
    try{let r=await api(`/study/courses/${id}/slice`,{method:'POST',body:{notes,method}})
      while(r.slicing){setBusy(tl("Long material is sliced part by part: {done} of {of} done. This can take a few minutes.",{done:r.slicing.done,of:r.slicing.of}))  // long material: in the background, a part at a time
        await new Promise(ok=>setTimeout(ok,3000));r=await api(`/study/courses/${id}/slicing`)}
      setPlan(r.plan);setDirty(false);setStep(3);window.scrollTo(0,0)}catch(e){toast(e.message)}setBusy('')}
  // preview edits stay on this screen until Finish (or Save outline) sends them
  const flat=plan?plan.units.flatMap((u,ui)=>u.topics.map((t,ti)=>({...t,ui,ti}))):[]
  const edit=f=>{const p=JSON.parse(JSON.stringify(plan));f(p);p.units=p.units.filter(u=>u.topics.length);setPlan(p);setDirty(true)}
  const rename=(ui,ti,v)=>edit(p=>{if(ti==null)p.units[ui].title=v;else p.units[ui].topics[ti].title=v})
  // the topic that comes right after this one in the material, wherever it now sits (topics can move between units)
  const after=(p,ui,ti)=>{const t=p.units[ui].topics[ti];let hit=null;p.units.forEach((u,a)=>u.topics.forEach((x,b)=>{if(x.from>t.to&&(!hit||x.from<p.units[hit[0]].topics[hit[1]].from))hit=[a,b]}));return hit}
  const merge=(ui,ti)=>edit(p=>{const [na,nb]=after(p,ui,ti),nx=p.units[na].topics[nb],t=p.units[ui].topics[ti];t.to=nx.to;t.words=(t.words||0)+(nx.words||0);p.units[na].topics.splice(nb,1)})
  const remove=async(ui,ti)=>{const t=plan.units[ui].topics[ti]
    if(await confirm({title:tl("Remove “{title}”?",{title:t.title}),body:tl("Its text ({n}) won't be in your course. To keep the text, merge it into another topic instead.",{n:pl(t.words||0,'word')}),ok:tl("Remove"),danger:true}))
      edit(p=>{p.units[ui].topics.splice(ti,1)})}
  const move=(ui,ti,to)=>edit(p=>{const [t]=p.units[ui].topics.splice(ti,1);p.units[to].topics.push(t);p.units[to].topics.sort((a,b)=>a.from-b.from)})  // its place in the unit is where its text is in the material
  const split=(ui,ti,j)=>{const t=plan.units[ui].topics[ti],ps=peek.paras,wc=a=>a.join(' ').split(/\s+/).filter(Boolean).length,ex=x=>(x||'').replace(/[#*_`>|-]/g,' ').replace(/\s+/g,' ').trim().slice(0,280)
    edit(p=>{p.units[ui].topics.splice(ti,1,{...t,to:t.from+j-1,words:wc(ps.slice(0,j))},{title:tl("{title} (part 2)",{title:t.title}),summary:'',from:t.from+j,to:t.to,words:wc(ps.slice(j)),excerpt:ex(ps[j])})})
    setPeek(null);toast(tl("Split in two. Rename the new topic if you like."))}  // between two paragraphs: the first part keeps the title
  const savePlan=async()=>{const r=await api(`/study/courses/${id}/plan`,{method:'PUT',body:{units:plan.units}});setPlan(r.plan);setDirty(false)}
  const finish=async()=>{setBusy('Building your course…');try{if(dirty)await savePlan()
      try{await api(`/study/courses/${id}/finish`,{method:'POST',body:{}})}catch(e){if(e.status!==409)throw e  // the course already has topics (the message itself may be translated)
        setBusy('');const d=await api('/study/courses/'+id).catch(()=>c),n=d.classmates_using||0;setC(d)  // how many classmates would lose their work, as of now
        if(!await confirm({title:tl("Replace the course's topics?"),body:tl("Finishing again builds the topics from this outline. Progress and quiz results on the old topics are removed.")+(n?' '+tl(n===1?"A classmate studies this course too: their progress and quiz results on it are removed as well.":"{n} classmates study this course too: their progress and quiz results on it are removed as well.",{n}):''),ok:tl("Replace topics"),danger:true}))return
        setBusy('Building your course…');await api(`/study/courses/${id}/finish`,{method:'POST',body:{replace:true,classmates:n>0}})}
      toast(tl("Your course is ready"));done()}catch(e){toast(e.message)}setBusy('')}
  const words=c.sources.reduce((a,x)=>a+x.words,0)
  return <><Bar title={c.title} sub={tl("Set up · step {step} of 4",{step:step+1})} back={back}/><div className="main">
    <Steps at={step}/>
    {busy&&<div className="qbox" role="status" style={{marginTop:0}}><b>{tl(busy)}</b></div>}
    {step===1&&<>
      <h3 className="sec first">{tl("Add your material")}</h3><p className="known" style={{marginTop:0}}>{tl("PDF, Word (.docx), or .txt and .md files, up to {MAX_FILE_MB} MB each. Add several and they are joined in the order you add them. You can also paste text.",{MAX_FILE_MB:MAX_FILE_MB})}{c.ocr_available?tl(" Scanned PDFs are read with text recognition, a few seconds a page."):tl(" Scanned PDFs can't be read on this server yet.")}</p>
      <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={files}/>
      <button className="btn" disabled={!!busy} onClick={()=>fileRef.current.click()}><Upload size={16}/>{" "}{tl("Choose files")}</button>
      <label htmlFor="pst">{tl("Or paste text")}</label><textarea id="pst" value={text} onChange={e=>setText(e.target.value)} placeholder={tl("Paste notes here. Leave an empty line between paragraphs; lines starting with # become headings.")}/>
      <button className="btn ghost" disabled={!!busy||!text.trim()} onClick={paste}>{tl("Add this text")}</button>
      {c.sources.length>0&&<><h3 className="sec">{tl("Your material ·")}{" "}{pl(words,'word')}</h3>{c.sources.map((x,i)=><div className="row" key={i}><div>{x.name}<small role={x.status==='reading'?'status':undefined}>{x.status?srcLine(x):<>{x.kind.toUpperCase()} · {pl(x.words,'word')} · {pl(x.paras,'paragraph')}</>}</small></div><div className="acts"><button className="ic sm" aria-label={tl("Remove {name}",{name:x.name})} onClick={()=>dropSrc(i)}><Trash2 size={16}/></button></div></div>)}
        <button className="btn" disabled={!!c.reading} onClick={()=>setStep(2)}>{c.reading?tl("Reading scanned pages…"):tl("Next: slice it into topics")}</button></>}</>}
    {step===2&&<>
      <h3 className="sec first">{tl("How should it be sliced?")}</h3><p className="known" style={{marginTop:0}}>{tl("The AI groups your {n} into units and the smallest topics that make sense on their own. It keeps your own words; it only decides where each topic starts and ends and what to call it.",{n:pl(c.paragraphs,'paragraph')})}</p>
      <label htmlFor="nts">{tl("Notes for the AI")}</label><textarea id="nts" value={notes} onChange={e=>setNotes(e.target.value)} placeholder={tl(NOTES_HINT)}/>
      <AiNote o={c}/>
      <button className={'btn'+(c.ai_available&&c.ai_left!==0?'':' ghost')} disabled={!!busy||!c.ai_available||c.ai_left===0} onClick={()=>slice('ai')}><Sparkles size={16}/>{" "}{tl("Slice with AI")}</button>
      <button className={'btn'+(c.ai_available&&c.ai_left!==0?' ghost':'')} disabled={!!busy} onClick={()=>slice('headings')}>{tl("Slice by headings instead (no AI)")}</button>
      <button className="btn ghost" onClick={()=>setStep(1)}>{tl("Back to material")}</button></>}
    {step===3&&plan&&<>
      <h3 className="sec first">{tl("Check the outline")}</h3><p className="known" style={{marginTop:0}}>{pl(plan.units.length,'unit')}{tl(", {n}{v}. Rename anything, merge a topic into the next one, split a long one, move one to another unit, or remove one you don't need. Not right? Change the notes and slice again.",{n:pl(flat.length,'topic'),v:c.sliced_by==='headings'?tl(' · sliced by headings'):''})}</p>
      {plan.units.map((u,ui)=><section key={ui} className="qbox"><label className="sr" htmlFor={'u'+ui}>{tl("Unit {v} title",{v:ui+1})}</label><input id={'u'+ui} className="utitle" value={u.title} onChange={e=>rename(ui,null,e.target.value)}/>
        {u.topics.map((t,ti)=>{const last=!after(plan,ui,ti)
          return <div key={t.from} className="ptopic"><label className="sr" htmlFor={`t${ui}-${ti}`}>{tl("Topic title")}</label><input id={`t${ui}-${ti}`} value={t.title} onChange={e=>rename(ui,ti,e.target.value)}/>
            <small className="known">{t.summary?t.summary+' · ':''}{pl(t.words||0,'word')}</small><p className="excerpt">{t.excerpt}{t.excerpt&&t.excerpt.length>=280?'…':''}</p>
            <div className="acts"><button className="tool" onClick={async()=>{try{setPeek({title:t.title,ui,ti,...(await api(`/study/courses/${id}/preview?start=${t.from}&end=${t.to}`))})}catch(e){toast(e.message)}}}>{t.to>t.from?tl("Read it all or split it"):tl("Read it all")}</button>
              {!last&&<button className="tool" onClick={()=>merge(ui,ti)}>{tl("Merge with next")}</button>}{flat.length>1&&<button className="tool" onClick={()=>remove(ui,ti)}>{tl("Remove")}</button>}
              {plan.units.length>1&&<select className="tool" style={{width:'auto',border:0}} aria-label={tl("Move “{title}” to another unit",{title:t.title})} value="" onChange={e=>move(ui,ti,+e.target.value)}>
                <option value="" disabled>{tl("Move to unit…")}</option>{plan.units.map((x,k)=>k!==ui&&<option key={k} value={k}>{tl("Unit {v}",{v:k+1})}{x.title?': '+x.title:''}</option>)}</select>}</div></div>})}</section>)}
      <h3 className="sec">{tl("Slice it differently")}</h3><label htmlFor="nts2">{tl("Notes for the AI")}</label><textarea id="nts2" value={notes} onChange={e=>setNotes(e.target.value)} placeholder={tl(NOTES_HINT)}/>
      <div className="two"><button className="btn ghost" disabled={!!busy} onClick={()=>slice('ai')}><Sparkles size={16}/>{" "}{tl("Slice again with AI")}</button><button className="btn ghost" disabled={!!busy} onClick={()=>setStep(1)}>{tl("Change material")}</button></div>
      <button className="btn" disabled={!!busy} onClick={finish}><Check size={16}/>{" "}{tl("Finish: build my course")}</button>
      {dirty&&<button className="btn ghost" disabled={!!busy} onClick={async()=>{try{await savePlan();toast(tl("Outline saved"))}catch(e){toast(e.message)}}}>{tl("Save outline and finish later")}</button>}</>}
    {peek&&<Sheet close={()=>setPeek(null)}><h3>{peek.title}</h3>{peek.paras?.length>1&&<p className="known" style={{marginTop:0}}>{tl("To make two topics of it, tap Split here between two paragraphs.")}</p>}
      {peek.paras?.length>1?peek.paras.map((x,j)=><Fragment key={j}>{j>0&&<button className="tool splithere" onClick={()=>split(peek.ui,peek.ti,j)}><Scissors size={14}/> {tl("Split here")}</button>}<div className="prose"><Md>{x}</Md></div></Fragment>)
        :<div className="prose"><Md>{peek.content}</Md></div>}
      <button className="btn ghost" onClick={()=>setPeek(null)}>{tl("Close")}</button></Sheet>}</div></>}
export function StudyCourse({id,topic:first,toast,back,setup}){
  const confirm=useConfirm()
  const [c,setC]=useState(null),[p,setP]=useState(null),[topic,setTopic]=useState(first||null),[ren,setRen]=useState(null),[rev,setRev]=useState(null),[find,setFind]=useState('')
  const load=()=>{api('/study/courses/'+id).then(setC).catch(e=>{toast(e.message);back()});api(`/study/courses/${id}/progress`).then(setP).catch(()=>{})}
  useEffect(()=>{if(!topic&&!rev)load()},[id,topic,rev])
  if(rev)return <StudyQuizPlay quiz={rev} toast={toast} back={()=>setRev(null)}/>
  if(topic)return <StudyTopicPage id={topic} toast={toast} back={()=>setTopic(null)} go={setTopic}/>
  if(!c)return <><Bar title={tl("Course")} back={back}/><div className="main"><Skeleton/></div></>
  if(c.status!=='ready')return <><Bar title={c.title} back={back}/><div className="main"><p className="known">{tl("This course is being set up.")}</p>{c.can_edit&&<button className="btn" onClick={setup}>{tl("Continue the setup")}</button>}</div></>
  const all=c.units.flatMap(u=>u.topics),done=all.filter(t=>t.status==='completed').length
  const share=async v=>{try{await api('/study/courses/'+id,{method:'PUT',body:{share:v}});toast(v==='program'?tl("Classmates in your program can now study it"):tl("Only you can see it now"));load()}catch(e){toast(e.message)}}
  const del=async()=>{if(!await confirm({title:tl("Delete “{title}”?",{title:c.title}),body:tl("Its topics, your progress and your quiz results are removed. This can't be undone."),ok:tl("Delete course"),danger:true}))return;try{await api('/study/courses/'+id,{method:'DELETE'});toast(tl("Course deleted"));back()}catch(e){toast(e.message)}}
  const reopen=async()=>{if(!await confirm({title:tl("Change the setup?"),body:tl("You go back to the outline. Your topics stay as they are until you finish the setup again."),ok:tl("Change the setup")}))return;try{await api(`/study/courses/${id}/reopen`,{method:'POST'});setup()}catch(e){toast(e.message)}}
  const next=all.find(t=>t.status!=='completed')
  return <><Bar title={c.title} sub={c.mine?tl("Your course"):tl("Shared by {owner}",{owner:c.owner})} back={back}/><div className="main">
    <div className="qbox" style={{marginTop:0}}><p className="known" style={{margin:0}}>{pl(all.length,'topic')}</p>
      {c.reviews_due>0&&<button className="btn ghost" onClick={async()=>{try{setRev(await api(`/study/courses/${id}/review`,{method:'POST'}))}catch(e){toast(e.message)}}}><RotateCcw size={16}/>{" "}{tl("Look again at {n}",{n:pl(c.reviews_due,'topic')})}</button>}
      {p&&p.quizzed>0&&<p className="known" style={{margin:'8px 0 0'}}>{tl("Quiz average {average}% over {n}.",{average:p.average,n:pl(p.quizzed,'topic')})}{p.summary&&' '+p.summary}</p>}
      {next&&<button className={'btn'+(c.reviews_due?' ghost':'')} onClick={()=>setTopic(next.id)}><Play size={16}/> {done?tl("Continue"):tl("Start")}: {next.title}</button>}<p className="known" style={{margin:'8px 0 0'}}>{tl(STAR_HELP)}</p></div>
    {all.length>12&&<div className="search" style={{marginTop:14}}><Search size={18}/><input type="search" aria-label={tl("Find a topic")} placeholder={tl("Find a topic")} value={find} onChange={e=>setFind(e.target.value)}/></div>}
    <Paged rows={c.units.flatMap(u=>u.topics.filter(t=>has(find,t.title,t.summary)).map(t=>({u,t})))} render={({u,t},i,j,pg)=><Fragment key={t.id}>{(!j||pg[j-1].u!==u)&&<h3 className={'sec'+(i?'':' first')}>{u.title}</h3>}
      <button className="row rowbtn" onClick={()=>setTopic(t.id)}><div>{t.title}{t.due&&<span className="pill sm" style={{marginLeft:6}}>{tl("Review due")}</span>}<small>{t.summary||''}{t.best!=null?tl("{v}best quiz {best}%",{v:t.summary?' · ':'',best:t.best}):''}</small></div><ChevronRight size={18}/></button></Fragment>}/>
    {p&&p.areas.length>0&&<><h3 className="sec">{tl("From your quizzes")}</h3><p className="known" style={{marginTop:0}}>{tl("Your best quiz score in each topic, weakest first.")}</p>
      {<Paged rows={p.areas} render={a=><button key={a.topic_id} className="row rowbtn" onClick={()=>setTopic(a.topic_id)}><div>{a.title}<span className={'pill sm '+(a.status==='strong'?'okp':a.status==='needs_study'?'off':'')} style={{marginLeft:6}}>{tl(AREA_LABEL[a.status])}</span><small>{tl("Best quiz {percent}%",{percent:a.percent})}</small><Bar2 v={a.percent}/></div><ChevronRight size={18}/></button>}/>}</>}
    {c.can_edit&&<><h3 className="sec">{tl("Course settings")}</h3>
      <label id="shr">{tl("Who can study it")}</label><div className="seg" role="group" aria-labelledby="shr" style={{gridTemplateColumns:'1fr 1fr',margin:'0 0 8px'}}>{[['private',tl("Only me")],['program',tl("My classmates")]].map(([k,l])=><button key={k} className={c.share===k?'on':''} aria-pressed={c.share===k} onClick={()=>c.share!==k&&share(k)}>{l}</button>)}</div>
      <p className="known" style={{marginTop:0}}>{c.share==='program'?tl("Students in your program can open it and take their own quizzes. Only you can change it."):tl("Private: only you can see it.")}</p>
      <div className="two"><button className="btn ghost" onClick={()=>setRen(c.title)}><Pencil size={16}/>{" "}{tl("Rename")}</button><button className="btn ghost" onClick={reopen}>{tl("Change the setup")}</button></div>
      <button className="btn danger" onClick={del}>{tl("Delete course")}</button></>}
    {ren!=null&&<Sheet close={()=>setRen(null)}><h3>{tl("Rename course")}</h3><label htmlFor="rnm">{tl("Course name")}</label><input id="rnm" autoFocus value={ren} onChange={e=>setRen(e.target.value)}/>
      <button className="btn" disabled={!ren.trim()} onClick={async()=>{try{await api('/study/courses/'+id,{method:'PUT',body:{title:ren}});setRen(null);load()}catch(e){toast(e.message)}}}>{tl("Save")}</button><button className="btn ghost" onClick={()=>setRen(null)}>{tl("Cancel")}</button></Sheet>}</div></>}
export const AiNote=({o})=>!o?null:!o.ai_available?<p className="known" role="note">{o.ai_off?tl("AI help is off. A parent or teacher can turn it on by adding their AI key to their account."):o.ai_own_key?tl("Add your own AI key under “My AI key” in the menu to use explanations, quick checks and quizzes."):tl("AI help is switched off right now. Ask your admin to add an AI key.")}</p>
  :o.ai_left!=null&&o.ai_left<=10?<p className="known" role="note">{o.ai_left?tl("{n} left today for your own courses.",{n:pl(o.ai_left,'AI request')}):tl("You have used today's AI requests for your own courses. Reviews still work; new questions come back tomorrow.")}</p>:null
export function StudyTopicPage({id,toast,back,go}){
  useLearnClock()  // a lite person's learning minutes
  const confirm=useConfirm()
  const [t,setT]=useState(null),[tab,setTab]=useState('notes'),[ex,setEx]=useState(null),[busy,setBusy]=useState(''),[quiz,setQuiz]=useState(null),[ed,setEd]=useState(null)
  const load=()=>api('/study/topics/'+id).then(setT).catch(e=>{toast(e.message);back()})
  useEffect(()=>{setT(null);setEx(null);setTab('notes');load();window.scrollTo(0,0)},[id])
  useEffect(()=>{if(!quiz&&t)load()},[quiz])
  if(quiz)return <StudyQuizPlay quiz={quiz} toast={toast} back={()=>setQuiz(null)} again={k=>make(k)} next={t?.next&&{title:t.next.title,go:()=>{setQuiz(null);go(t.next.id)}}}/>
  if(!t)return <><Bar title={tl("Topic")} back={back}/><div className="main"><Skeleton/></div></>
  const explain=async()=>{setBusy('explain');try{setEx(await api(`/study/topics/${id}/explain`))}catch(e){toast(e.message)}setBusy('')}
  async function make(kind){setBusy(kind);try{setQuiz(await api(`/study/topics/${id}/quizzes`,{method:'POST',body:{kind}}))}catch(e){toast(e.message)}setBusy('')}
  const done=async on=>{try{await api(`/study/topics/${id}/progress`,{method:'PUT',body:{completed:on}});setT({...t,completed:on});toast(on?tl("Marked as completed"):tl("Marked as not completed"))}catch(e){toast(e.message)}}
  const saveEd=async()=>{try{await api('/study/topics/'+id,{method:'PUT',body:ed});setEd(null);setEx(null);toast(tl("Topic saved"));load()}catch(e){toast(e.message)}}
  const delTopic=async()=>{if(!await confirm({title:tl("Delete “{title}”?",{title:t.title}),body:tl("The topic, your progress and your checks on it are removed. This can't be undone."),ok:tl("Delete topic"),danger:true}))return
    try{await api('/study/topics/'+id,{method:'DELETE'});toast(tl("Topic deleted"));back()}catch(e){toast(e.message)}}
  const noAi=!t.ai_available||t.ai_left===0
  return <><Bar title={t.title} sub={tl("{course} › {unit} · {position} of {total}",{course:t.course,unit:t.unit,position:t.position,total:t.total})} back={back}/><div className="main">
    <Tabs label={tl("Topic sections")} items={[['notes',tl("Notes")],['explain',tl("Explain")]]} value={tab} onChange={setTab}/>
    {tab==='notes'&&<div className="prose"><Md>{t.content}</Md></div>}
    {tab==='explain'&&(ex?<div className="prose">{ex.cached&&<span className="chip">{tl("Saved explanation · no AI request used")}</span>}<Md>{ex.text}</Md></div>
      :t.has_explain||!noAi?<button className="btn" disabled={!!busy} onClick={explain}><Sparkles size={16}/> {busy==='explain'?tl("Thinking…"):tl("Explain it to me")}</button>:<AiNote o={t}/>)}
    <h3 className="sec">{tl("Check yourself")}</h3>
    <AiNote o={t}/>
    <div className="two"><button className="btn" disabled={!!busy||noAi} onClick={()=>make('mcq')}><ClipboardList size={16}/> {busy==='mcq'?tl("Writing questions…"):tl("5 quick questions")}</button><button className="btn ghost" disabled={!!busy||noAi} onClick={()=>make('quiz')}><Target size={16}/> {busy==='quiz'?tl("Writing the quiz…"):tl("Full quiz · 10")}</button></div>
    <p className="known">{tl("Quick check: 5 practice MCQs with the answer right after each one; 4 right marks the topic completed. Full quiz: 10 questions scored at the end; pass it for ★★, score 90% for ★★★. New questions every time, and the topic comes back for review before you forget it.")}</p>
    {t.attempts.length>0&&<><h3 className="sec">{tl("Your results here")}</h3>{<Paged rows={t.attempts} render={a=><div className="row" key={a.id}><div>{a.kind==='quiz'?tl("Quiz"):tl("Practice MCQs")} · {a.score} / {a.total} · {a.percent}%<small>{when(a.at)}</small><Bar2 v={a.percent}/></div></div>}/>}</>}
    <div style={{marginTop:16}}>{t.completed?<>{t.next?<button className="btn" onClick={()=>go(t.next.id)}>{tl("Next topic: {title}",{title:t.next.title})}{" "}<ChevronRight size={16}/></button>  // where to go now; nothing else is marked
        :<><p className="known" role="status">{tl("That was the last topic of this course.")}</p><button className="btn" onClick={back}>{tl("Back to the course")}</button></>}
      <button className="btn ghost" onClick={()=>done(false)}>{tl("Mark as not completed")}</button></>:<button className="btn" onClick={()=>done(true)}><Check size={16}/>{" "}{tl("Mark as completed")}</button>}</div>
    <div className="two">{t.prev?<button className="btn ghost" onClick={()=>go(t.prev.id)}><ChevronLeft size={16}/>{" "}{tl("Previous")}</button>:<span/>}{t.next&&<button className="btn ghost" onClick={()=>go(t.next.id)}>{tl("Next")}{" "}<ChevronRight size={16}/></button>}</div>
    {t.can_edit&&<div className="two"><button className="btn ghost" onClick={()=>setEd({title:t.title,content:t.content})}><Pencil size={16}/>{" "}{tl("Edit topic")}</button><button className="btn ghost" onClick={delTopic}><Trash2 size={16}/>{" "}{tl("Delete topic")}</button></div>}
    {ed&&<Sheet close={()=>setEd(null)}><h3>{tl("Edit topic")}</h3><label htmlFor="ett">{tl("Title")}</label><input id="ett" value={ed.title} onChange={e=>setEd({...ed,title:e.target.value})}/>
      <label htmlFor="etc">{tl("Text")}</label><textarea id="etc" style={{minHeight:260}} value={ed.content} onChange={e=>setEd({...ed,content:e.target.value})}/>
      <p className="known">{tl("Markdown works: # for headings, - for lists, **bold**. Your progress and stars stay.")}</p>
      <button className="btn" disabled={!ed.title.trim()||!ed.content.trim()} onClick={saveEd}>{tl("Save")}</button><button className="btn ghost" onClick={()=>setEd(null)}>{tl("Cancel")}</button></Sheet>}</div></>}
