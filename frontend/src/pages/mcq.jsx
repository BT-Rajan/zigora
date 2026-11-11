// mcq pages, loaded only when one of them is opened (split from App.jsx; the shell and shared helpers stay there)
import {useState,useEffect,useContext} from 'react'
import {Sparkles,Play,ClipboardList} from 'lucide-react'
import {t as tl} from '../i18n.js'
import {Bar,Ctx,McqPlay,PAGE,Pager,Skeleton,Tabs,Topic,api,pl,rid,useConfirm,usePaged,when} from '../App.jsx'
// ---- MCQ practice: two ways in, Practice (across a course's topics) and Per topic (from a topic's page), on one engine. The server keeps the answers
// until a set is submitted, counts sets (students on Lite: one every 48 hours; on Pro: four a day) and gives back a set still open instead of counting another
export const MCQ_SIZES=[5,10,15,20]
export function McqQuota({q}){
  if(!q||q.tier==='none')return null  // no limit: only students on Lite or Pro have one
  const txt=q.tier==='lite'?(q.left?tl("Lite: one free MCQ set every 48 hours. Your set is ready."):tl("Lite: one free MCQ set every 48 hours. Your next set is ready {when}.",{when:when(q.next_at)}))
    :q.left?tl("{left} of {limit} MCQ sets left today.",{left:q.left,limit:q.limit}):tl("You have used today's {limit} MCQ sets. The next is ready {when}.",{limit:q.limit,when:when(q.next_at)})
  return <p className={'known'+(q.left?'':' warn')} role="status" style={{marginTop:0}}>{txt}</p>}
export function McqHome({toast,topic,back,openTopic}){  // topic: the Per topic way in, from a topic's page
  const confirm=useConfirm(),{role}=useContext(Ctx)
  const [tp,setTp]=useState(null),[h,setH]=useState(null),[tab,setTab]=useState(topic?'topic':'practice'),[course,setCourse]=useState(''),[tid,setTid]=useState(topic||''),[size,setSize]=useState(10),[busy,setBusy]=useState(''),[play,setPlay]=useState(null),[n,setN]=useState(0)
  const load=()=>api('/mcq/home').then(d=>{setH(d);setSize(s=>Math.min(s,d.max));if(topic){const c=d.courses.find(c=>c.topics.some(t=>t.id===topic));if(c)setCourse(String(c.id))}}).catch(e=>{toast(e.message);back&&back()})
  useEffect(()=>{load()},[n])
  const hist=usePaged(o=>`/mcq/attempts?limit=${PAGE}&offset=${o}`,[n],toast)
  if(tp)return <Topic id={tp} back={()=>setTp(null)} toast={toast} role={role}/>  // "Study again" from a result, when not already inside a topic
  if(play)return <McqPlay id={play} toast={toast} back={()=>{setPlay(null);setN(n+1)}} openTopic={openTopic||setTp}/>
  if(!h)return <><Bar title={tl("MCQ practice")} back={back}/><div className="main"><Skeleton/></div></>
  const c=h.courses.find(x=>String(x.id)===String(course)),topics=c?c.topics:h.courses.flatMap(x=>x.topics),t=topics.find(x=>String(x.id)===String(tid))
  const pool=tab==='topic'?(t?t.questions:0):c?c.questions:h.courses.reduce((a,x)=>a+x.questions,0),ready=tab==='practice'||!!t
  const notes=tab==='topic'?!!t?.notes:topics.some(x=>x.notes)  // an AI set is written from the topics' notes: none, nothing to write from
  const go=async source=>{setBusy(source);try{const r=await api('/mcq/attempts',{method:'POST',body:{mode:tab,source,size:Number(size),request_id:rid(),...(tab==='topic'?{topic_id:Number(tid)}:course?{course_id:Number(course)}:{})}})
    if(r.resumed)toast(tl("You have a set in progress. Here it is."));setPlay(r.id)}catch(e){toast(e.message);load()}setBusy('')}
  const drop=async()=>{if(!await confirm({title:tl("Leave this set?"),body:tl("It ends without a score. The set it used is not given back."),ok:tl("Leave it"),danger:true}))return
    try{await api(`/mcq/attempts/${h.open.id}/abandon`,{method:'POST'});setN(n+1)}catch(e){toast(e.message)}}
  return <><Bar title={tl("MCQ practice")} sub={tl("Questions from your courses, with answers explained")} back={back}/><div className="main">
    <McqQuota q={h.quota}/>
    {h.open&&<div className="qbox" style={{marginTop:0}}><b>{tl("A set is waiting for you")}</b><p className="known" style={{margin:'4px 0 8px'}}>{tl("{answered} of {total} answered. Coming back to it doesn't use another set.",{answered:h.open.answered,total:h.open.total})}</p>
      <div className="two"><button className="btn" style={{marginTop:0}} onClick={()=>setPlay(h.open.id)}><Play size={16}/>{" "}{tl("Continue")}</button><button className="btn ghost" style={{marginTop:0}} onClick={drop}>{tl("Leave it")}</button></div></div>}
    {!h.courses.length?<p className="known">{tl("There are no topics to practise yet.")}</p>:<>
    <Tabs label={tl("Ways to practise")} items={[['practice',tl("Practice")],['topic',tl("Per topic")]]} value={tab} onChange={setTab}/>
    <label htmlFor="mcqc">{tl("Course")}</label>
    <select id="mcqc" value={course} onChange={e=>{setCourse(e.target.value);setTid('')}}>{tab==='practice'&&<option value="">{tl("All my courses")}</option>}{tab==='topic'&&!course&&<option value="">{tl("Choose a course")}</option>}
      {h.courses.map(x=><option key={x.id} value={x.id}>{x.name}{x.semester?' · '+x.semester:''}</option>)}</select>
    {tab==='topic'&&<><label htmlFor="mcqt">{tl("Topic")}</label><select id="mcqt" value={tid} onChange={e=>setTid(e.target.value)} disabled={!c}><option value="">{tl("Choose a topic")}</option>
      {topics.map(x=><option key={x.id} value={x.id}>{x.title}{' · '+pl(x.questions,'question')}{x.stats?' · '+tl("you {p}%",{p:x.stats.percent}):''}</option>)}</select></>}
    <label htmlFor="mcqn">{tl("Questions in the set")}</label><select id="mcqn" value={size} onChange={e=>setSize(e.target.value)}>{MCQ_SIZES.filter(x=>x<=h.max).map(x=><option key={x} value={x}>{x}</option>)}</select>
    <div className="two"><button className="btn" disabled={!!busy||!ready||pool<h.min||h.quota.left===0} onClick={()=>go('bank')}><ClipboardList size={16}/>{" "}{busy==='bank'?tl("Starting…"):tl("Questions from the bank")}</button>
      {h.ai&&<button className="btn ghost" disabled={!!busy||!ready||!notes||h.quota.left===0} onClick={()=>go('ai')}><Sparkles size={16}/>{" "}{busy==='ai'?tl("Writing questions…"):tl("A new AI set")}</button>}</div>
    <p className="known">{ready&&pool<h.min?tl("Not enough published questions here yet: a set needs at least {min}.",{min:h.min}):tl(pool===1?"{n} published question to draw from.":"{n} published questions to draw from.",{n:pool})}{" "}{tab==='practice'&&h.ai&&notes?tl("A new AI set looks at the topics you find hardest."):''}{" "}{tl("A set counts when it starts.")}</p>
    {h.ai&&ready&&!notes&&<p className="known">{tab==='topic'?tl("This topic has no notes yet, so the AI can't write questions for it."):tl("These topics have no notes yet, so the AI can't write questions for them.")}</p>}</>}
    {hist.total>0&&<><h3 className="sec">{tl("Your sets")}</h3>{hist.items.map(a=><button key={a.id} className="row rowbtn" onClick={()=>a.status==='submitted'&&setPlay(a.id)} disabled={a.status!=='submitted'}>
      <div>{a.topic||a.course||tl("All my courses")}<small>{when(a.at)} · {a.mode==='topic'?tl("Per topic"):tl("Practice")} · {a.source==='ai'?tl("AI set"):tl("Bank")}</small></div>
      <span className="chip">{a.status==='submitted'?`${a.score}/${a.total} · ${a.percent}%`:tl("Left")}</span></button>)}<Pager page={hist.page} total={hist.total} onPage={hist.setPage}/></>}
  </div></>}
