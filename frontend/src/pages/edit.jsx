// edit pages, loaded only when one of them is opened (split from App.jsx; the shell and shared helpers stay there)
import {useState,useEffect,useRef} from 'react'
import {Md,Body} from '../content.jsx'
import {ROOT,at} from '../base.js'
import {Plus,Sparkles,X,ArrowUp,ArrowDown,Search,Upload,Trash2,FileText} from 'lucide-react'
import {t as tl,srv} from '../i18n.js'
import {Bar,CI_CAT,IV_KIND,ImgSlot,LET,PAGE,Pager,RES_KIND,ResBody,Sheet,Skeleton,api,download,ivAct,pl,uploadImg,useConfirm,usePaged,when} from '../App.jsx'
export const localInput=iso=>{if(!iso)return '';const d=new Date(iso),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
export const ivDay=s=>s?new Date(new Date(s).getTime()-1).toLocaleDateString('en-CA'):''  // the server keeps the end of the chosen day; this gives the day back
export const ivReason=w=>w.topics.filter(x=>x.category!=='strong').map(x=>x.title+': '+tl(CI_CAT[x.category])+(x.asked?' · '+tl("{p}% of {n} answers over {k} sittings",{p:x.percent,n:x.asked,k:x.sittings}):'')+(x.doubts?' · '+(x.doubts===1?tl("1 doubt"):tl("{n} doubts",{n:x.doubts})):'')).join('; ')
export function SupportEditor({cid,plan,tids,pick,toast,done,cancel}){  // new, or an edit of an active plan: kept activities and students keep their history
  const [o,setO]=useState(null),[busy,setBusy]=useState(false),[sug,setSug]=useState(null),[add,setAdd]=useState(null)
  const [f,setF]=useState(()=>plan?{title:plan.title,description:plan.description,criteria:plan.criteria,target:ivDay(plan.target),topic_ids:plan.topics.map(t=>t.id),
    activities:plan.activities.filter(a=>!a.removed_at).map(a=>({id:a.id,kind:a.kind,topic_id:a.topic_id,ref_id:a.ref_id,size:a.size,required:a.required,label:a.label})),
    student_ids:plan.students.filter(x=>!x.removed).map(x=>x.user_id),reasons:Object.fromEntries(plan.students.map(x=>[x.user_id,x.reason]))}
    :{title:'',description:'',criteria:'',target:'',topic_ids:tids||[],activities:[],student_ids:[],reasons:{}})
  const tq=f.topic_ids.join(',')
  useEffect(()=>{api(`/courses/${cid}/support-options?topic_ids=${tq}`).then(r=>{setO(r)
    if(pick&&!plan)setF(v=>{if(v.student_ids.length)return v;const ws=r.students.filter(w=>w.topics.some(x=>x.category==='attention'||x.category==='revision'))
      return {...v,title:v.title||tl("Extra practice: {topics}",{topics:r.topics.filter(t=>v.topic_ids.includes(t.id)).map(t=>t.title).join(', ')}),student_ids:ws.map(w=>w.id),reasons:Object.fromEntries(ws.map(w=>[w.id,ivReason(w)]))}})}).catch(e=>{toast(e.message);cancel()})},[tq])
  if(!o)return <><Bar title={tl("Support plan")} back={cancel}/><div className="main"><Skeleton rows={3}/></div></>
  const tname=id=>o.topics.find(t=>t.id===id)?.title||''
  const label=a=>a.label||(a.kind==='test'?o.tests.find(q=>q.id===a.ref_id)?.title:a.kind==='resource'?o.resources.find(r=>r.id===a.ref_id)?.title:tname(a.topic_id))||''
  const togT=id=>setF(v=>({...v,topic_ids:v.topic_ids.includes(id)?v.topic_ids.filter(x=>x!==id):[...v.topic_ids,id]}))
  const togS=w=>setF(v=>v.student_ids.includes(w.id)?{...v,student_ids:v.student_ids.filter(x=>x!==w.id)}:{...v,student_ids:[...v.student_ids,w.id],reasons:{...v.reasons,[w.id]:v.reasons[w.id]||ivReason(w)}})
  const setA=(k,p)=>setF(v=>({...v,activities:v.activities.map((a,i)=>i===k?{...a,...p}:a)}))
  const move=(k,d)=>setF(v=>{const a=[...v.activities],j=k+d;if(j<0||j>=a.length)return v;[a[k],a[j]]=[a[j],a[k]];return {...v,activities:a}})
  const addOk=add&&(add.kind==='test'?add.ref_id:add.kind==='resource'?add.ref_id:add.topic_id)
  const suggest=async()=>{setBusy(true);try{setSug(await api('/interventions/suggest',{method:'POST',body:{course_id:cid,topic_ids:f.topic_ids}}))}catch(e){toast(srv(e.message))}setBusy(false)}
  const save=async activate=>{setBusy(true);try{const b={...f,course_id:cid,reasons:Object.fromEntries(Object.entries(f.reasons).map(([k,v])=>[k,v||''])),activate}
    const p=plan?await api('/interventions/'+plan.id,{method:'PUT',body:b}):await api('/interventions',{method:'POST',body:b});done(p)}catch(e){toast(srv(e.message))}setBusy(false)}
  return <><Bar title={plan?tl("Edit support plan"):tl("New support plan")} back={cancel}/><div className="main">
    <h3 className="sec first">{tl("Topics")}</h3><div className="filters fit" style={{flexWrap:'wrap'}}>{o.topics.map(t=><button key={t.id} className={'chip'+(f.topic_ids.includes(t.id)?' on':'')} aria-pressed={f.topic_ids.includes(t.id)} onClick={()=>togT(t.id)}>{t.title}</button>)}</div>
    <label htmlFor="ivt">{tl("Title")}</label><input id="ivt" value={f.title} maxLength={200} onChange={e=>setF({...f,title:e.target.value})}/>
    <label htmlFor="ivd">{tl("Instructions for the students (optional)")}</label><textarea id="ivd" rows={3} value={f.description} maxLength={4000} onChange={e=>setF({...f,description:e.target.value})}/>
    <label htmlFor="ivg">{tl("Target date (optional)")}</label><input id="ivg" type="date" value={f.target} onChange={e=>setF({...f,target:e.target.value})}/>
    <label htmlFor="ivc">{tl("How you will judge it (optional, for you)")}</label><input id="ivc" value={f.criteria} maxLength={2000} onChange={e=>setF({...f,criteria:e.target.value})} placeholder={tl("For example: 70% or more in two practice sets")}/>
    <h3 className="sec">{tl("Activities")}</h3>
    {!f.activities.length&&<p className="known" style={{marginTop:0}}>{tl("Add what the students should do, in order.")}</p>}
    {f.activities.map((a,k)=><div key={k} className="row"><div>{k+1}. {tl(IV_KIND[a.kind])}{label(a)?': '+label(a):''}
      <small><label className="chk" style={{padding:"4px 0"}}><input type="checkbox" checked={a.required!==false} onChange={e=>setA(k,{required:e.target.checked})}/>{" "}{tl("Required")}</label>{a.kind==='mcq'&&<>{' · '}<select aria-label={tl("Questions")} value={a.size||10} onChange={e=>setA(k,{size:+e.target.value})}>{[5,10,15,20].map(n=><option key={n} value={n}>{tl("{n} questions",{n})}</option>)}</select></>}</small></div>
      <button className="ic sm" aria-label={tl("Move up")} onClick={()=>move(k,-1)}><ArrowUp size={15}/></button><button className="ic sm" aria-label={tl("Move down")} onClick={()=>move(k,1)}><ArrowDown size={15}/></button>
      <button className="ic sm" aria-label={tl("Remove")} onClick={()=>setF(v=>({...v,activities:v.activities.filter((_,i)=>i!==k)}))}><X size={15}/></button></div>)}
    {f.topic_ids.length>0&&!add&&<div className="qopt"><button className="btn ghost" onClick={()=>setAdd({kind:'study',topic_id:f.topic_ids[0],size:10,required:true})}><Plus size={16}/>{" "}{tl("Add an activity")}</button>
      <button className="btn ghost" disabled={busy} onClick={suggest}><Sparkles size={16}/>{" "}{busy?tl("Thinking…"):tl("Suggest activities (AI)")}</button></div>}
    {add&&<div className="qbox"><select aria-label={tl("Activity")} value={add.kind} onChange={e=>setAdd({...add,kind:e.target.value,ref_id:null})}>{Object.entries(IV_KIND).map(([k,l])=><option key={k} value={k}>{tl(l)}</option>)}</select>
      {add.kind==='test'?<select aria-label={tl("Test")} value={add.ref_id||''} onChange={e=>setAdd({...add,ref_id:+e.target.value})}><option value="">{o.tests.length?tl("Choose a test"):tl("No published test asks about these topics")}</option>{o.tests.map(q=><option key={q.id} value={q.id}>{q.title} ({tl("{n} questions",{n:q.questions})})</option>)}</select>
      :add.kind==='resource'?<select aria-label={tl("Resource")} value={add.ref_id||''} onChange={e=>setAdd({...add,ref_id:+e.target.value})}><option value="">{o.resources.length?tl("Choose a resource"):tl("No published resource for these topics")}</option>{o.resources.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>
      :<select aria-label={tl("Topic")} value={add.topic_id||''} onChange={e=>setAdd({...add,topic_id:+e.target.value})}>{f.topic_ids.map(id=><option key={id} value={id}>{tname(id)}{add.kind==='mcq'?' ('+tl("{n} bank questions",{n:o.topics.find(t=>t.id===id)?.bank||0})+')':''}</option>)}</select>}
      <div className="qopt"><button className="btn" disabled={!addOk} onClick={()=>{setF(v=>({...v,activities:[...v.activities,{...add,size:add.kind==='mcq'?add.size:null}]}));setAdd(null)}}>{tl("Add")}</button><button className="btn ghost" onClick={()=>setAdd(null)}>{tl("Cancel")}</button></div></div>}
    {sug&&<div className="qbox"><b>{tl("Suggested by AI from what the course already has")}</b>{sug.note&&<p className="known" style={{margin:'4px 0'}}>{sug.note}</p>}
      {!sug.activities.length?<p className="known">{tl("No suggestion this time.")}</p>:sug.activities.map((a,k)=><p key={k} className="known" style={{margin:'4px 0'}}>{k+1}. <b>{ivAct({...a,label:label(a)})}</b>{a.why?' — '+a.why:''}</p>)}
      <details><summary className="known">{tl("The evidence it was given ({n} lines)",{n:sug.evidence.length})}</summary>{sug.evidence.map((e,k)=><p key={k} className="known" style={{margin:'4px 0'}}><b>[E{k+1}]</b> {e}</p>)}</details>
      <div className="qopt">{sug.activities.length>0&&<button className="btn" onClick={()=>{setF(v=>({...v,activities:[...v.activities,...sug.activities.map(a=>({kind:a.kind,topic_id:a.topic_id||null,ref_id:a.ref_id||null,size:a.size||null,required:true}))]}));setSug(null)}}>{tl("Use these")}</button>}<button className="btn ghost" onClick={()=>setSug(null)}>{tl("Close")}</button></div></div>}
    <h3 className="sec">{tl("Students")}</h3><p className="known" style={{marginTop:0}}>{tl("Each with what their records show on these topics. The reason stays with you; students don't see it.")}</p>
    {o.students.map(w=>{const on=f.student_ids.includes(w.id);return <div key={w.id} className="row"><div style={{flex:1}}><label className="chk" style={{padding:"4px 0"}}><input type="checkbox" checked={on} onChange={()=>togS(w)}/>{" "}{w.name}</label>
      <small>{w.topics.map(x=>x.title+': '+tl(CI_CAT[x.category])+(x.asked?' ('+x.percent+'%)':'')).join(' · ')}</small>
      {on&&<input aria-label={tl("Reason for {name}",{name:w.name})} value={f.reasons[w.id]||''} maxLength={500} onChange={e=>setF({...f,reasons:{...f.reasons,[w.id]:e.target.value}})} placeholder={tl("Why this student (for you)")}/>}</div></div>})}
    <div className="qopt" style={{marginTop:12}}>{(!plan||plan.status==='draft')&&<button className="btn ghost" disabled={busy} onClick={()=>save(false)}>{tl("Save as draft")}</button>}
      <button className="btn" disabled={busy||!f.title.trim()||!f.activities.length||!f.student_ids.length||!f.topic_ids.length} onClick={()=>save(true)}>{plan?.status==='active'?tl("Save changes"):tl("Save and start")}</button></div>
    {plan?.status==='active'&&<p className="known">{tl("Students hear about it once if activities or students change. Removed activities stay in the history where they were done.")}</p>}</div></>}
// a course's teacher manages its resources: add, edit (each save a new version), publish, archive; nothing is deleted
export function ResourceManager({cid,toast,back}){
  const confirm=useConfirm(),[d,setD]=useState(null),[tree,setTree]=useState(null),[ed,setEd]=useState(null),[hist,setHist]=useState(null),[busy,setBusy]=useState(false),[prev,setPrev]=useState(false)
  const load=()=>api(`/courses/${cid}/resources`).then(r=>setD(r.items)).catch(e=>{toast(e.message);back()});useEffect(()=>{load();api('/tree').then(tr=>{for(const p of tr)for(const sm of p.semesters)for(const c of sm.courses)if(c.id===cid)setTree(c)}).catch(()=>{})},[cid])
  const blank={kind:'note',title:'',description:'',body:'',url:'',image:'',file:null,unit_id:0,topic_id:0}
  const pickFile=e=>{const x=e.target.files?.[0];e.target.value='';if(!x)return;if(x.size>15*1024*1024){toast(tl("Keep the file under 15 MB"));return}
    const rd=new FileReader();rd.onload=()=>setEd(v=>({...v,file:{name:x.name,data:rd.result}}));rd.onerror=()=>toast(tl("That file could not be read"));rd.readAsDataURL(x)}
  const pickImg=async e=>{const x=e.target.files?.[0];e.target.value='';if(!x)return;try{const url=await uploadImg(x);setEd(v=>({...v,image:url}))}catch(er){toast(er.message)}}
  const save=async publish=>{setBusy(true);try{const b={...ed,course_id:cid,unit_id:ed.unit_id||null,topic_id:ed.topic_id||null,publish,file:ed.file||null}
      if(ed.id)await api(`/resources/${ed.id}`,{method:'PUT',body:b});else await api('/resources',{method:'POST',body:b});toast(publish?tl("Published"):tl("Saved as a draft"));setEd(null);load()}catch(e){toast(srv(e.message))}setBusy(false)}
  const status=async(r,st)=>{if(st==='archived'&&!await confirm({title:tl("Archive “{title}”?",{title:r.title}),body:tl("Students stop seeing it. Nothing is deleted: its versions stay, and you can publish it again."),ok:tl("Archive")}))return
    try{await api(`/resources/${r.id}/status`,{method:'POST',body:{status:st}});load()}catch(e){toast(srv(e.message))}}
  const units=tree?.units||[],topics=units.find(u=>u.id===ed?.unit_id)?.topics||[]
  if(ed)return <><Bar title={ed.id?tl("Edit resource"):tl("New resource")} back={()=>setEd(null)}/><div className="main">
    {!ed.id&&<><label>{tl("Where")}</label><div className="qopt"><select aria-label={tl("Unit")} value={ed.unit_id} onChange={e=>setEd({...ed,unit_id:+e.target.value,topic_id:0})}><option value={0}>{tl("The whole course")}</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
      {ed.unit_id>0&&<select aria-label={tl("Topic")} value={ed.topic_id} onChange={e=>setEd({...ed,topic_id:+e.target.value})}><option value={0}>{tl("The whole unit")}</option>{topics.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>}</div>
      <label>{tl("Kind")}</label><div className="seg" style={{gridTemplateColumns:'repeat(3,1fr)'}}>{Object.entries(RES_KIND).map(([k,l])=><button key={k} className={ed.kind===k?'on':''} aria-pressed={ed.kind===k} onClick={()=>setEd({...ed,kind:k})}>{tl(l)}</button>)}</div></>}
    <label htmlFor="rt">{tl("Title")}</label><input id="rt" maxLength={200} value={ed.title} onChange={e=>setEd({...ed,title:e.target.value})}/>
    <label htmlFor="rd">{tl("Description or instructions (optional)")}</label><textarea id="rd" rows={2} maxLength={2000} value={ed.description} onChange={e=>setEd({...ed,description:e.target.value})}/>
    {(ed.kind==='note'||ed.kind==='example')&&<><label htmlFor="rb">{ed.kind==='example'?tl("The worked example"):tl("The note")}</label>
      <textarea id="rb" rows={10} maxLength={20000} value={ed.body} onChange={e=>setEd({...ed,body:e.target.value})} placeholder={tl("Markdown. Maths between dollar signs, like $x^2$. Number the steps of a worked example.")}/>
      <button className="link" onClick={()=>setPrev(!prev)}>{prev?tl("Hide preview"):tl("Preview")}</button>{prev&&<div className="qbox prose"><Md>{ed.body}</Md></div>}</>}
    {ed.kind==='image'&&<>{ed.image&&<img className="msgimg" src={at(ed.image)} alt=""/>}<label className="btn ghost photopick"><Upload size={16}/> {ed.image?tl("Replace the picture"):tl("Upload a picture")}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={pickImg} hidden/></label></>}
    {(ed.kind==='link'||ed.kind==='video')&&<><label htmlFor="ru">{ed.kind==='video'?tl("Video link (or attach a short video below)"):tl("Link")}</label><input id="ru" value={ed.url} maxLength={490} placeholder="https://" onChange={e=>setEd({...ed,url:e.target.value})}/></>}
    {(ed.kind==='document'||(ed.kind==='video'&&!ed.url))&&<>{ed.file?<div className="msgfile"><FileText size={18}/><span>{ed.file.name}</span><button className="ic sm" aria-label={tl("Remove the file")} onClick={()=>setEd({...ed,file:null})}><X size={16}/></button></div>
      :<label className="btn ghost photopick"><Upload size={16}/> {ed.kind==='video'?tl("Attach a video (MP4, up to 15 MB)"):ed.id?tl("Replace the document"):tl("Attach the document")}<input type="file" accept={ed.kind==='video'?'video/mp4,video/webm':'.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,image/png,image/jpeg'} onChange={pickFile} hidden/></label>}
      {ed.id&&!ed.file&&ed.current_file&&<p className="known">{tl("Keeps {name} unless you attach another.",{name:ed.current_file})}</p>}</>}
    {ed.id&&<p className="known">{tl("Saving makes a new version. The earlier ones are kept.")}</p>}
    <button className="btn" disabled={busy||!ed.title.trim()} onClick={()=>save(true)}>{ed.status==='published'?tl("Save"):tl("Publish")}</button>
    {ed.status!=='published'&&<button className="btn ghost" disabled={busy||!ed.title.trim()} onClick={()=>save(false)}>{tl("Save as a draft")}</button>}</div></>
  if(hist)return <><Bar title={hist.title} sub={tl("Versions")} back={()=>setHist(null)}/><div className="main">{hist.items.map(v=><div key={v.version} className="qbox"><small className="known">{[tl("Version {n}",{n:v.version}),v.current&&tl("current"),v.saved_by,when(v.saved_at)].filter(Boolean).join(' · ')}</small><b style={{display:'block'}}>{v.title}</b><ResBody r={v} toast={toast}/></div>)}</div></>
  const where=r=>{const u=units.find(x=>x.id===r.unit_id),tp=u?.topics.find(x=>x.id===r.topic_id);return tp?tp.title:u?u.name:tl("The whole course")}
  return <><Bar title={tl("Teacher resources")} sub={tree?.name||''} back={back}/><div className="main">
    <p className="known" style={{marginTop:0}}>{tl("Your own notes, worked examples, pictures, documents, videos and links, placed on the course, a unit or a topic. Students see published ones inside the topic they are studying.")}</p>
    <button className="btn" onClick={()=>setEd(blank)}><Plus size={16}/> {tl("Add a resource")}</button>
    {!d?<Skeleton/>:!d.length?<p className="known">{tl("No resources yet.")}</p>:d.map(r=><div key={r.id} className="qbox"><div className="wtop"><b>{r.title}</b><span className="chip" style={{color:r.status==='published'?'var(--ok)':'var(--mut)'}}>{tl({draft:'Draft',published:'Published',archived:'Archived'}[r.status])}</span></div>
      <small className="known">{[tl(RES_KIND[r.kind]),where(r),tl("Version {n}",{n:r.version}),r.saved_by&&tl("saved by {name}",{name:r.saved_by}),when(r.saved_at)].filter(Boolean).join(' · ')}</small>
      <div className="tools" style={{flexWrap:'wrap'}}><button onClick={()=>setEd({...blank,...r,file:null,current_file:r.file?.name,unit_id:r.unit_id||0,topic_id:r.topic_id||0})}>{tl("Edit")}</button>
        {r.status!=='published'&&<button onClick={()=>status(r,'published')}>{tl("Publish")}</button>}{r.status==='published'&&<button onClick={()=>status(r,'draft')}>{tl("Unpublish")}</button>}
        {r.status!=='archived'&&<button onClick={()=>status(r,'archived')}>{tl("Archive")}</button>}<button onClick={async()=>{try{setHist({title:r.title,...await api(`/resources/${r.id}/versions`)})}catch(e){toast(e.message)}}}>{tl("Versions")}</button></div></div>)}</div></>}

export const MCQ_TEMPLATE=`question,a,b,c,d,correct,explanation,topic,area,question_image,a_image,b_image,c_image,d_image
"Which ion makes water hard?",Na+,Ca2+,Cl-,K+,B,"Calcium and magnesium salts cause hardness.",Water Treatment,,,,,,
"Which boiler is shown in the picture?",Fire tube,Water tube,Electric,Packaged,A,,Boilers,,boiler.png,,,,
"Pick the symbol for a resistor",,,,,C,,,Circuit symbols,,sym-a.png,sym-b.png,sym-c.png,sym-d.png
"What is 15% of 200?",20,30,15,35,30,,,Arithmetic,,,,,
`
export const CSV_COLS=[['question',tl("The question. Markdown and $math$ work.")],['a, b, c, d (up to f)','The answer choices. Leave the later ones blank if a question has fewer. A choice can be only an image.'],
  ['correct',tl("The right answer: its letter (B), its number (2) or its exact text.")],['explanation',tl("Optional. Shown after submitting when the test reveals answers.")],
  ['topic',tl("Optional. A topic title from this course; strengths are worked out per topic.")],['area',tl("Optional. A skill or area name for questions not tied to a topic.")],
  ['question_image, a_image … f_image','Optional. Image file names. You upload the files in the preview, matched by name.']]
export const blankQ=()=>({text:'',options:['',''],option_images:['',''],correct:0,explanation:'',topic_id:null,area:'',image:'',need:{image:'',options:[]}})
export const fromCsv=x=>({text:x.text,options:x.options,option_images:x.option_images.map(v=>v||''),correct:x.correct,explanation:x.explanation||'',topic_id:x.topic_id,area:x.area||'',image:x.image||'',
  need:{image:x.image?'':x.image_name,options:x.option_image_names.map((n,k)=>x.option_images[k]?'':n)}})
export const missing=qs=>qs.flatMap((x,i)=>[...(x.need.image&&!x.image?[{i,k:-1,name:x.need.image}]:[]),...x.need.options.map((n,k)=>n&&!x.option_images[k]?{i,k,name:n}:null).filter(Boolean)])
export function QuizEditor({id,unit_id,course_id,unitTopics,csvFirst,done,toast}){
  const confirm=useConfirm()
  const [m,setM]=useState({title:'',pass_percent:50,published:false,reveal:false}),[qs,setQs]=useState([blankQ()]),[busy,setBusy]=useState(false),[topics,setTopics]=useState(unitTopics||[]),csvRef=useRef(null),imgRef=useRef(null)
  const [csv,setCsv]=useState(null),[bank,setBank]=useState(false),[btags,setBtags]=useState(''),[stage,setStage]=useState(csvFirst&&!id?'csv':'edit'),[cid,setCid]=useState(course_id)
  const course=!unit_id
  useEffect(()=>{if(id)api('/quizzes/'+id).then(d=>{setM({title:d.title,pass_percent:d.pass_percent,published:d.published,reveal:d.reveal});setCid(d.course_id);setTopics(d.topics||[])
    setQs(d.questions.length?d.questions.map(x=>({id:x.id,text:x.text,options:x.options,option_images:x.options.map((_,k)=>x.option_images[k]||''),correct:x.correct,explanation:x.explanation||'',topic_id:x.topic_id??null,area:x.area||'',image:x.image||'',need:{image:'',options:[]}})):[blankQ()])}).catch(e=>{toast(e.message);done()})
    else if(course&&course_id)api('/courses/'+course_id+'/topics').then(setTopics).catch(()=>{})},[id])
  const upd=(i,p)=>setQs(cur=>cur.map((x,n)=>n===i?{...x,...p}:x))
  const setOpt=(i,k,v)=>upd(i,{options:qs[i].options.map((o,n)=>n===k?v:o)})
  const setOptImg=(i,k,v,skip)=>setQs(cur=>cur.map((x,n)=>n!==i?x:{...x,option_images:x.options.map((_,j)=>j===k?v:x.option_images[j]||''),need:skip||v?{...x.need,options:x.need.options.map((nm,j)=>j===k?'':nm)}:x.need}))
  const setQImg=(i,v,skip)=>setQs(cur=>cur.map((x,n)=>n!==i?x:{...x,image:v,need:skip||v?{...x.need,image:''}:x.need}))
  const delOpt=(i,k)=>{const x=qs[i];upd(i,{options:x.options.filter((_,n)=>n!==k),option_images:x.option_images.filter((_,n)=>n!==k),need:{...x.need,options:x.need.options.filter((_,n)=>n!==k)},correct:x.correct===k?0:x.correct>k?x.correct-1:x.correct})}
  const todo=missing(qs)
  const payload=()=>qs.filter(x=>x.text.trim()||x.image).map(x=>({id:x.id??null,text:x.text,options:x.options,option_images:x.option_images,correct:x.correct,explanation:x.explanation,topic_id:x.topic_id,area:x.area,image:x.image}))
  const save=async()=>{setBusy(true);try{const body={...(course?{course_id:cid}:{unit_id}),...m,pass_percent:+m.pass_percent},qid=id||(await api('/quizzes',{method:'POST',body})).id
    if(id)await api('/quizzes/'+id,{method:'PUT',body})
    await api(`/quizzes/${qid}/questions`,{method:'PUT',body:{questions:payload()}});toast(course?tl("Test saved"):tl("Quiz saved"));done()}catch(e){toast(e.message)}setBusy(false)}
  const readCsv=async(f,replace)=>{try{const r=await api('/quizzes/parse-csv',{method:'POST',body:{csv:await f.text(),...(course?{course_id:cid}:{unit_id})}});setCsv(r)
    if(!r.questions.length){toast(tl("No questions could be read from the file"));return}
    const got=r.questions.map(fromCsv);setQs(cur=>replace?got:[...cur.filter(x=>x.text.trim()||x.image),...got])
    if(replace&&!m.title)setM(v=>({...v,title:f.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,200)}))
    setStage('edit');toast(tl("{n} read. Check them below{v}, then save.",{n:pl(r.questions.length,'question'),v:r.images_needed.length?' and upload the images':''}))}catch(e){toast(e.message)}}
  const importCsv=async e=>{const f=e.target.files[0];e.target.value='';if(f)readCsv(f,stage==='csv')}
  const bulkImages=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length)return;setBusy(true);let used=0;const extra=[];let next=qs
    for(const f of files){const hits=missing(next).filter(s=>s.name.toLowerCase()===f.name.toLowerCase());if(!hits.length){extra.push(f.name);continue}
      try{const url=await uploadImg(f);used++;next=next.map((x,i)=>{const h=hits.filter(s=>s.i===i);if(!h.length)return x
        return {...x,image:h.some(s=>s.k<0)?url:x.image,option_images:x.option_images.map((v,k)=>h.some(s=>s.k===k)?url:v),need:{image:h.some(s=>s.k<0)?'':x.need.image,options:x.need.options.map((n,k)=>h.some(s=>s.k===k)?'':n)}}})}catch(x){toast(f.name+': '+x.message)}}
    setQs(next);setBusy(false);toast(tl("{n} matched{v}",{n:pl(used,'image'),v:extra.length?`. Not in the CSV: ${extra.slice(0,3).join(', ')}${extra.length>3?'…':''}`:''}))}
  const addFromBank=picked=>{setQs(cur=>[...cur.filter(x=>x.text.trim()),...picked.map(x=>({...blankQ(),text:x.text,options:x.options,option_images:x.options.map(()=>''),correct:x.correct,explanation:x.explanation||''}))]);setBank(false);toast(tl("{n} added. Tie them to topics if you like, then save.",{n:pl(picked.length,'question')}))}
  const toBank=async()=>{const list=qs.filter(x=>x.text.trim());let added=0,skipped=0,bad=0;setBusy(true)
    for(const x of list){if(x.image||x.option_images.some(Boolean)){bad++;continue}try{await api('/bank',{method:'POST',body:{text:x.text,options:x.options,correct:x.correct,explanation:x.explanation,tags:btags,source:m.title}});added++}catch(e){/already in the bank/.test(e.message)?skipped++:bad++}}
    setBusy(false);toast(tl("{added} saved to the bank{v}{v2}",{added:added,v:skipped?`, ${skipped} already there`:'',v2:bad?`, ${bad} skipped (incomplete or with images)`:''}))}
  const del=async()=>{if(!await confirm({title:tl("Delete this {v}?",{v:course?'test':'quiz'}),body:tl("This also deletes every student attempt. This can't be undone."),ok:tl("Delete"),danger:true}))return;try{await api('/quizzes/'+id,{method:'DELETE'});toast(tl("Deleted"));done()}catch(e){toast(e.message)}}
  const fileInputs=<><input ref={csvRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={importCsv}/><input ref={imgRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={bulkImages}/></>
  const csvNotes=csv&&(csv.error_count>0||csv.warnings.length>0)&&<div className="qbox" role="alert">{csv.error_count>0&&<><b>{pl(csv.error_count,'row')}{" "}{tl("could not be read and {v} left out",{v:csv.error_count===1?'was':'were'})}</b>{csv.errors.slice(0,10).map((x,i)=><p className="known" style={{margin:'4px 0'}} key={i}>{tl("Row {row}:",{row:x.row})}{" "}{x.error}</p>)}{csv.error_count>10&&<p className="known">{tl("…and {v} more.",{v:csv.error_count-10})}</p>}</>}
    {csv.warnings.length>0&&<><b style={{display:'block',marginTop:csv.error_count?10:0}}>{tl("Worth a look")}</b>{csv.warnings.slice(0,8).map((w,i)=><p className="known" style={{margin:'4px 0'}} key={i}>{w}</p>)}{csv.warnings.length>8&&<p className="known">{tl("…and {v} more.",{v:csv.warnings.length-8})}</p>}</>}</div>
  if(stage==='csv')return <><Bar title={tl("New MCQ test")} sub={tl("Step 1 of 2 · attach the questions CSV")} back={done}/><div className="main">{fileInputs}
    <p className="known" style={{marginTop:0}}>{tl("A course test is built from a CSV file with one question per row. In the next step you check every question, upload any pictures for questions and answer choices, then save.")}</p>
    <button className="btn" onClick={()=>csvRef.current.click()}><Upload size={16}/>{" "}{tl("Choose the CSV file")}</button><button className="btn ghost" onClick={()=>download('mcq-template.csv',MCQ_TEMPLATE)}>{tl("Download the template")}</button>
    {csvNotes}
    <h3 className="sec">{tl("Columns")}</h3>{CSV_COLS.map(([c,h])=><div className="row" key={c}><div><code>{c}</code><small>{h}</small></div></div>)}
    <p className="known">{tl("The first row names the columns. Comma, semicolon and tab separated files all work. A course test holds up to 200 questions.")}</p></div></>
  return <><Bar title={id?(course?tl("Edit test"):tl("Edit quiz")):csvFirst?tl("New MCQ test"):tl("New quiz")} sub={csvFirst&&!id?tl("Step 2 of 2 · check, add images, save"):''} back={done}/><div className="main">{fileInputs}
    {csvNotes}
    {todo.length>0&&<div className="qbox need" role="status"><b>{pl(todo.length,'image')}{" "}{tl("still to upload")}</b><p className="known" style={{margin:'4px 0 8px'}}>{tl("Choose them all at once and they are matched to their questions by file name, or upload each one below.")}{" "}{[...new Set(todo.map(x=>x.name))].slice(0,6).join(', ')}{todo.length>6?'…':''}</p>
      <button className="btn" style={{margin:0}} disabled={busy} onClick={()=>imgRef.current.click()}><Upload size={16}/> {busy?tl("Uploading…"):tl("Upload images")}</button></div>}
    <label>{tl("Title")}</label><input value={m.title} onChange={e=>setM({...m,title:e.target.value})} placeholder={course?tl("e.g. Chemistry final MCQ"):tl("e.g. Water treatment check")}/>
    <label>{tl("Pass mark (%)")}</label><input type="number" min="1" max="100" value={m.pass_percent} onChange={e=>setM({...m,pass_percent:e.target.value})}/>
    <label className="chk"><input type="checkbox" checked={m.published} onChange={e=>setM({...m,published:e.target.checked})}/>{" "}{tl("Published (students can take it)")}</label>
    <label className="chk"><input type="checkbox" checked={m.reveal} onChange={e=>setM({...m,reveal:e.target.checked})}/>{" "}{tl("Show students the correct answers and explanations after they submit")}</label>
    {qs.map((x,i)=><div className="qbox" key={i}><b>{tl("Question")}{" "}{i+1}</b>
      <textarea placeholder={tl("Question (Markdown and $math$ work)")} value={x.text} onChange={e=>upd(i,{text:e.target.value})}/>
      <ImgSlot url={x.image} need={x.need.image} label={tl("question {i}{v}",{i:i,v:1})} toast={toast} onSet={(v,skip)=>setQImg(i,v,skip)}/>
      {x.options.map((o,k)=><div key={k}><div className="qopt"><input type="radio" name={'c'+i} aria-label={tl("Answer {k} is correct",{k:LET[k]})} checked={x.correct===k} onChange={()=>upd(i,{correct:k})}/><b className="olet">{LET[k]}</b><input value={o} placeholder={tl("Answer {k}{v}",{k:LET[k],v:x.option_images[k]?' (optional with an image)':''})} onChange={e=>setOpt(i,k,e.target.value)}/>
        {!x.option_images[k]&&!x.need.options[k]&&<ImgSlot small label={tl("answer {k}",{k:LET[k]})} toast={toast} onSet={v=>setOptImg(i,k,v)}/>}{x.options.length>2&&<button className="ic sm" aria-label={tl("Remove answer {k}",{k:LET[k]})} onClick={()=>delOpt(i,k)}><X size={16}/></button>}</div>
        {(x.option_images[k]||x.need.options[k])&&<div style={{paddingLeft:48}}><ImgSlot small url={x.option_images[k]} need={x.need.options[k]} label={tl("answer {k}",{k:LET[k]})} toast={toast} onSet={(v,skip)=>setOptImg(i,k,v,skip)}/></div>}</div>)}
      {x.options.length<6&&<button className="tool" onClick={()=>upd(i,{options:[...x.options,''],option_images:[...x.option_images,'']})}>{tl("Add answer")}</button>}
      <label>{tl("Topic this tests")}</label><select value={x.topic_id??''} onChange={e=>upd(i,{topic_id:e.target.value?+e.target.value:null})}><option value="">{tl("Not tied to one topic")}</option>{topics.map(t=><option key={t.id} value={t.id}>{t.unit?t.unit+' › ':''}{t.title}</option>)}</select>
      {x.topic_id==null&&<><label>{tl("Area or skill")}</label><input value={x.area} onChange={e=>upd(i,{area:e.target.value})} placeholder={tl("e.g. Arithmetic (used for strengths when there is no topic)")}/></>}
      <textarea placeholder={tl("Explanation shown after submitting (optional)")} value={x.explanation} onChange={e=>upd(i,{explanation:e.target.value})}/>
      {qs.length>1&&<button className="tool" onClick={()=>setQs(qs.filter((_,n)=>n!==i))}>{tl("Remove question")}</button>}</div>)}
    <p className="known">{tl("Tick the radio button beside the correct answer. Tie each question to the topic it tests, or name an area: students then see what they are good at and what needs another round of study.")}</p>
    <button className="btn ghost" onClick={()=>setQs([...qs,blankQ()])}>{tl("Add question")}</button>
    <div className="two"><button className="btn ghost" onClick={()=>csvRef.current.click()}><Upload size={16}/>{" "}{tl("Add from a CSV")}</button><button className="btn ghost" onClick={()=>download('mcq-template.csv',MCQ_TEMPLATE)}>{tl("CSV template")}</button></div>
    <button className="btn ghost" onClick={()=>setBank(true)}>{tl("Add from the question bank")}</button>
    <label htmlFor="bt">{tl("Share these questions in the bank")}</label><div className="two"><input id="bt" value={btags} onChange={e=>setBtags(e.target.value)} placeholder={tl("Tags, e.g. water, hardness (optional)")}/><button className="btn ghost" disabled={busy||!qs.some(x=>x.text.trim())} onClick={toBank}>{tl("Save to bank")}</button></div>
    <button className="btn" disabled={busy||todo.length>0} onClick={save}>{busy?tl("Saving…"):todo.length?tl("Upload {n} first",{n:pl(todo.length,'image')}):id?tl("Save changes"):course?tl("Create test"):tl("Save quiz")}</button>{bank&&<BankSheet close={()=>setBank(false)} onAdd={addFromBank} toast={toast}/>}
    {id&&<button className="btn danger" onClick={del}>{tl("Delete")}{" "}{course?'test':'quiz'}</button>}</div></>}
export function BankSheet({close,onAdd,toast}){
  const confirm=useConfirm()
  const [q,setQ]=useState(''),[tag,setTag]=useState(''),[mine,setMine]=useState(false),[sel,setSel]=useState({}),top=useRef()
  const {items,total,page,setPage,ready,data,reload}=usePaged(o=>`/bank?limit=${PAGE}&offset=${o}&q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`+(mine?'&mine=true':''),[q,tag,mine],toast)
  const picked=Object.values(sel)
  const flip=x=>{const c={...sel};c[x.id]?delete c[x.id]:c[x.id]=x;setSel(c)}
  const del=async x=>{if(!await confirm({title:tl("Delete this question from the bank?"),body:tl("It disappears for everyone. Quizzes that already use it keep their copy."),ok:tl("Delete"),danger:true}))return;try{await api('/bank/'+x.id,{method:'DELETE'});const c={...sel};delete c[x.id];setSel(c);reload()}catch(e){toast(e.message)}}
  return <Sheet close={close}><h3>{tl("Question bank")}</h3><p className="known">{tl("Questions shared by every teacher. Adding one puts a copy in this quiz, so later changes to the bank never alter a quiz students are taking.")}</p>
    <div className="search"><Search size={18}/><input type="search" aria-label={tl("Search the bank")} placeholder={tl("Search questions, tags or source")} value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="filters"><select aria-label={tl("Filter by tag")} value={tag} onChange={e=>setTag(e.target.value)}><option value="">{tl("All tags")}</option>{(data?.tags||[]).map(t=><option key={t} value={t}>{t}</option>)}</select>
      <label className="chk" style={{padding:0}}><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/>{" "}{tl("Only mine")}</label></div>
    <span ref={top} className="pgtop"/>{!ready?<div className="sk"/>:!items.length?<p className="known">{q||tag||mine?tl("Nothing matches that."):tl("The bank is empty. Use “Save to bank” in any quiz to start it.")}</p>:items.map(x=><div key={x.id} className="row"><label className="chk" style={{alignItems:'flex-start',flex:1}}><input type="checkbox" checked={!!sel[x.id]} onChange={()=>flip(x)}/><span><span style={{display:'block'}}>{x.text.length>180?x.text.slice(0,180)+'…':x.text}</span><small>{x.options.length}{" "}{tl("answers{v} · by",{v:x.tags.length>0&&' · '+x.tags.join(', ')})}{" "}{x.owner||'someone'}{x.uses>0&&tl(" · used {n}",{n:pl(x.uses,'time')})}</small></span></label>{x.can_edit&&<button className="ic sm" aria-label={tl("Delete from the bank")} onClick={()=>del(x)}><Trash2 size={16}/></button>}</div>)}
    <Pager page={page} total={total} onPage={setPage} anchor={top}/>
    <button className="btn" disabled={!picked.length} onClick={()=>onAdd(picked)}>{picked.length?tl("Add {n}",{n:pl(picked.length,'question')}):tl("Choose questions to add")}</button><button className="btn ghost" onClick={close}>{tl("Cancel")}</button></Sheet>}

export const TOPIC_CONFIG_TEMPLATE=`---
title: 1. Introduction and learning objectives
published: no
deadline: 2026-10-20 17:00
---

## Question pattern
- Recite the verses from memory
- Explain the vocabulary

## Sample content
**Q:** Name the three parts of the verses.

**A:** First, verses 28–29 ...

## How an answer should be
- Answer what the verb asks: explain, infer, or give the ruling with the reason.
- Support every answer with the verse or hadith.
`
export const FILES_HELP='Pick the content: an HTML file or a Markdown .md file. To keep a page’s JavaScript, first choose HTML + JavaScript as the content format below. You can add a config .md file for the title and the other boxes, and any images the page uses. The form fills in; check it, then save.'
export function TopicEditor({role,toast,done,cancel,edit,unitId}){  // edit = {id} of a topic, or null for a new one in unitId
  const confirm=useConfirm()
  const fac=role==='faculty',[prev,setPrev]=useState(false),[up,setUp]=useState(false),fileRef=useRef(null),taRef=useRef(null),filesRef=useRef(null),[busy,setBusy]=useState(false)
  const [tree,setTree]=useState([]),[f,setF]=useState({title:'',unit_id:unitId||'',content:'',content_format:'markdown',sample_content:'',question_pattern:'',guideline:'',published:!fac,due:'',diagram:false,diagram_note:'',optional:false}),[cid,setCid]=useState(null)
  const [fromFiles,setFromFiles]=useState(null),[shown,setShown]=useState(''),[imp,setImp]=useState(false)
  useEffect(()=>{api('/tree').then(setTree).catch(()=>{});if(edit)api('/topics/'+edit.id).then(t=>{setCid(t.course_id);setF({title:t.title,unit_id:t.unit_id||'',content:t.content||'',content_format:t.content_format||'markdown',sample_content:t.sample_content||'',question_pattern:t.question_pattern||'',guideline:t.guideline||'',published:t.published!==false,due:localInput(t.learning_due_at),diagram:!!t.diagram_on,diagram_note:t.diagram_note||'',optional:!!t.optional})}).catch(e=>toast(e.message))},[])
  const html=f.content_format==='html',inter=f.content_format==='interactive',[frameUrl,setFrameUrl]=useState('')
  useEffect(()=>{if(!prev||!inter)return;let live=true;setFrameUrl('');api('/topics/frame-preview',{method:'POST',body:{html:f.content}}).then(r=>live&&setFrameUrl(r.url)).catch(e=>toast(e.message));return()=>{live=false}},[prev,inter,f.content])
  useEffect(()=>{if(!prev||!html)return;let live=true;api('/topics/clean-html',{method:'POST',body:{html:f.content}}).then(r=>live&&setShown(r.html)).catch(e=>toast(e.message));return()=>{live=false}},[prev,html,f.content])
  const set=k=>e=>setF({...f,[k]:e.target.value})
  const pickFiles=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length)return
    const ext=x=>(x.name.split('.').pop()||'').toLowerCase(),htmlF=files.filter(x=>['html','htm'].includes(ext(x))),cfgF=files.filter(x=>['md','markdown','txt'].includes(ext(x))),imgs=files.filter(x=>/^image\//.test(x.type))
    if(htmlF.length>1||cfgF.length>1)return toast(tl("Choose one HTML file and one config file at a time"))
    if(!htmlF.length&&!cfgF.length)return toast(tl("Choose an HTML file, a config .md file, or both"))
    if((f.content.trim()||f.question_pattern.trim()||f.sample_content.trim()||f.guideline.trim())&&!await confirm({title:tl("Replace what is in the form?"),body:tl("The boxes the files fill in are replaced. Nothing is saved until you save."),ok:tl("Fill from files")}))return
    setBusy(true);try{const images={};for(const x of imgs)images[x.name]=await uploadImg(x)
      const r=await api('/topics/from-files',{method:'POST',body:{unit_id:+(f.unit_id||unitId),html:htmlF.length?await htmlF[0].text():'',config:cfgF.length?await cfgF[0].text():'',images,scripts:f.content_format==='interactive'}})
      setF(cur=>({...cur,...['title','content','content_format','question_pattern','sample_content','guideline'].reduce((o,k)=>r[k]!==undefined?{...o,[k]:r[k]}:o,{}),...(r.published!==undefined?{published:r.published}:{}),...(r.learning_due_at?{due:r.learning_due_at}:{})}))
      setFromFiles({names:[...htmlF,...cfgF].map(x=>x.name),warnings:r.warnings,images:r.images_saved+imgs.length});setPrev(!!r.content&&['html','interactive'].includes(r.content_format));toast(tl("Filled from {v}. Check it, then save.",{v:[...htmlF,...cfgF].map(x=>x.name).join(' and ')}))}catch(er){toast(er.message)}setBusy(false)}
  const pickImg=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>3*1024*1024)return toast(tl("Image is too large. Keep it under 3 MB."))
    setUp(true);try{const r=await fetch(ROOT+'/api/uploads',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream',Authorization:'Bearer '+localStorage.t},body:file});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||'Upload failed')
      const pos=taRef.current?.selectionStart??f.content.length,tag=html||inter?`\n<p><img src="${d.url}" alt="Describe the image"></p>\n`:`\n\n![Describe the image](${d.url})\n\n`;setF({...f,content:f.content.slice(0,pos)+tag+f.content.slice(pos)});toast(tl("Image added"))}catch(er){toast(er.message)}setUp(false)}
  const all=tree.flatMap(p=>p.semesters.flatMap(s=>s.courses.filter(c=>!c.shared&&c.editable).flatMap(c=>c.units.map(n=>({...n,course_id:c.id,label:`${c.name} › ${n.name}`})))))
  const units=role==='admin'?all:all.filter(n=>n.course_id===cid)  // faculty move a topic only between units of its own course
  const here=all.find(n=>n.id===+f.unit_id)
  const save=async()=>{setBusy(true);try{await api(edit?'/topics/'+edit.id:'/topics',{method:edit?'PUT':'POST',body:{...f,due:undefined,unit_id:+f.unit_id,published:f.published!==false,learning_due_at:f.due?new Date(f.due).toISOString():null}});toast(edit?tl("Changes saved"):tl("Topic added"));done()}catch(e){toast(e.message)}setBusy(false)}
  const T=(k,l,ph)=><><label>{l}</label><textarea placeholder={ph} value={f[k]} onChange={set(k)}/></>
  return <><Bar title={edit?tl("Edit topic"):tl("New topic")} sub={here?.label} back={cancel}/><div className="main">
    {!imp&&!fromFiles&&<button className="tool" style={{marginTop:0}} onClick={()=>setImp(true)}><Upload size={14}/>{" "}{tl("Fill from files (HTML and config)")}</button>}
    {(imp||fromFiles)&&<div className="qbox" style={{marginTop:0}}><b>{tl("Fill from files")}</b><p className="known" style={{margin:'4px 0 8px'}}>{FILES_HELP}</p>
      <input ref={filesRef} type="file" hidden multiple accept=".html,.htm,.md,.markdown,.txt,text/html,text/markdown,image/png,image/jpeg,image/gif,image/webp" onChange={pickFiles}/>
      <div className="two"><button className="btn" style={{margin:0}} disabled={busy} onClick={()=>filesRef.current.click()}><Upload size={16}/> {busy?tl("Reading…"):tl("Choose files")}</button><button className="btn ghost" style={{margin:0}} onClick={()=>download('topic-config.md',TOPIC_CONFIG_TEMPLATE)}>{tl("Config template")}</button></div>
      {fromFiles&&<div role="status" style={{marginTop:10}}><p className="known" style={{margin:0}}>{tl("Filled from {names}{v}.",{names:fromFiles.names.join(' and '),v:fromFiles.images?` · ${pl(fromFiles.images,'image')}`:''})}</p>
        {fromFiles.warnings.map((w,i)=><p key={i} className="known" style={{margin:'4px 0 0',color:'var(--warn)'}}>{w}</p>)}</div>}</div>}
    {edit&&units.length>1&&<><label>{tl("Unit")}</label><select value={f.unit_id} onChange={set('unit_id')}>{units.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></>}
    <label>{tl("Topic title")}</label><input value={f.title} onChange={set('title')} placeholder={tl("First law of thermodynamics")}/>
    <label>{tl("Topic content")}</label><div className="seg" style={{gridTemplateColumns:'1fr 1fr 1fr',margin:'0 0 8px'}} role="group" aria-label={tl("Content format")}>{[['markdown',tl("Markdown")],['html',tl("HTML")],['interactive',tl("HTML + JavaScript")]].map(([k,l])=><button key={k} type="button" className={f.content_format===k?'on':''} aria-pressed={f.content_format===k} onClick={()=>setF({...f,content_format:k})}>{l}</button>)}</div>
    <div className="tools"><button type="button" disabled={up} onClick={()=>fileRef.current.click()}>{up?tl("Uploading…"):tl("Add image")}</button><button type="button" onClick={()=>setPrev(!prev)}>{prev?tl("Back to editing"):tl("Preview")}</button></div>
    <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={pickImg}/>
    {prev&&inter?(f.content?(frameUrl?<iframe className="pframe" title={tl("Preview")} src={at(frameUrl)} sandbox="allow-scripts allow-popups allow-modals allow-forms"/>:<Skeleton/>):<div className="prose"><Md>{tl("Nothing to preview yet.")}</Md></div>)
      :prev?<div className="prose">{!f.content?<Md>{tl("Nothing to preview yet.")}</Md>:html?<Body text={shown} format="html"/>:<Md>{f.content}</Md>}</div>:<textarea ref={taRef} className={html||inter?'code':''} placeholder={html||inter?tl("HTML (or choose an HTML file above)"):tl("Paste notes or syllabus text")} value={f.content} onChange={set('content')}/>}
    <p className="known">{inter?tl("The page runs as it is, with its own scripts and styles, in a sandbox: it can't reach the app or anyone's account (so it also can't keep data in the browser between visits). Students open it full screen and can highlight its text."):html?tl("HTML content shows as it is laid out in the file. Scripts, styles, forms and outside frames are removed when you save, so the page takes the app's look in light and dark mode."):tl("Equations: $x^2$ inline. For a centred block, put $$ on its own line above and below the equation. Chemistry: $\\ce{CaCO3 + CO2 + H2O -> Ca(HCO3)2}$")}</p>{T('question_pattern','Question pattern','e.g. 2 marks: define · 13 marks: derive + numerical')}
    <label>{tl("Learning deadline")}</label><div className="qopt"><input type="datetime-local" aria-label={tl("Learning deadline")} value={f.due} onChange={set('due')}/>{f.due&&<button type="button" className="tool" onClick={()=>setF({...f,due:''})}>{tl("No deadline")}</button>}</div>
    <p className="known" style={{marginTop:4}}>{f.due?tl("Students should have learnt this topic by then. They can still open it afterwards."):tl("No deadline")}</p>
    <label className="chk"><input type="checkbox" checked={f.published!==false} onChange={e=>setF({...f,published:e.target.checked})}/>{" "}{tl("Published (students can see this topic)")}</label>
    <label className="chk"><input type="checkbox" checked={!!f.optional} onChange={e=>setF({...f,optional:e.target.checked})}/>{" "}{tl("Optional (doesn't count toward finishing the course)")}</label>
    <label className="chk"><input type="checkbox" checked={!!f.diagram} onChange={e=>setF({...f,diagram:e.target.checked})}/>{" "}{tl("Diagram for students on Pro")}</label>
    {f.diagram&&<><label htmlFor="dgn">{tl("What should the diagram show? (optional)")}</label><textarea id="dgn" maxLength={1000} value={f.diagram_note} onChange={set('diagram_note')}
      placeholder={tl("For example: the lime-soda process as a flow, step by step")}/></>}
    <p className="known" style={{marginTop:4}}>{f.diagram?tl("The AI draws an interactive diagram from the notes, once, and students open it full screen. Students on Lite see that it comes with Pro."):tl("Off: no diagram for this topic.")}</p>
    {T('sample_content','Sample content','A sample question and answer')}{T('guideline','How an answer should be','Intro, labelled diagram, steps, units, conclusion')}
    <button className="btn" disabled={busy||!f.title.trim()} onClick={save}>{edit?tl("Save changes"):tl("Save topic")}</button></div></>}
