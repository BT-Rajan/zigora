// How a topic's content and the AI's answers are shown: Markdown with tables and maths (KaTeX, chemistry with mhchem), or the cleaned HTML of an
// uploaded file. Shared by the web app and the reader page the Android app shows (reader.jsx), so both render the same text the same way.
import Markdown,{defaultUrlTransform} from 'react-markdown'
import {at,atHtml} from './base.js'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import 'katex/contrib/mhchem'
// AI answers sometimes arrive with a whole table squeezed onto one line ("| A | B | |---|---| | x | y |"). Put the rows back on their own lines so it renders as a table.
export function fixTables(text){
  return String(text||'').split('\n').map(line=>{
    const t=line.trim(),sep=t.match(/\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|/)
    if(!t.startsWith('|')||!sep||t.replace(/[|\s:-]/g,'')==='')return line
    const n=sep[0].split('|').filter(c=>c.trim()).length,cells=t.split('|').slice(1,-1),rows=[];let i=0
    while(i<cells.length){rows.push(cells.slice(i,i+n));i+=n;if(i<cells.length&&cells[i].trim()==='')i++}  // a blank cell marks the end of a row
    if(!n||rows.length<3||rows[1].length!==n||rows[1].some(c=>!/^\s*:?-{3,}:?\s*$/.test(c))||rows.slice(2).some(r=>r.length!==n))return line  // not a squeezed table
    return '\n'+rows.map(r=>'|'+r.join('|')+'|').join('\n')+'\n'
  }).join('\n')
}
// Maths written the LaTeX way, \(...\) inline and \[...\] on its own, as quiz CSVs and other tools write it: Markdown would read the backslashes as
// escapes and show plain "(x^2)", so turn it into the $...$ and $$...$$ the maths plugin reads. Code (fenced or `inline`) is left as it is.
const CODE=/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`)/
export function texDelims(text){
  const s=String(text||'');if(!s.includes('\\(')&&!s.includes('\\['))return s
  return s.split(CODE).map((part,i)=>i%2?part:part
    .replace(/^([ \t]*)\\\[((?:(?!\n[ \t]*\n)[\s\S])+?)\\\][ \t]*$/gm,(m,ind,x)=>ind+'$$\n'+ind+x.trim()+'\n'+ind+'$$')  // a line of its own: shown as a block
    .replace(/(?<!\\)\\\[((?:(?!\n[ \t]*\n)[\s\S])+?)\\\]/g,(m,x)=>'$$'+x.trim()+'$$')
    .replace(/(?<!\\)\\\(((?:(?!\n[ \t]*\n)[\s\S])+?)\\\)/g,(m,x)=>'$'+x.trim()+'$')).join('')
}
const url=u=>defaultUrlTransform(at(u))  // saved pictures (/api/uploads/...) under the site's folder
// a picture in notes (a figure or table from a student's book) opens full size on a tap, to scroll around on a phone; Escape, the button or a tap outside closes it
function zoom(src,alt){
  const box=document.createElement('div');box.className='zoom';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',alt||'Picture')
  const img=document.createElement('img');img.alt=alt||'';img.onload=()=>{img.style.width=Math.max(box.clientWidth-24,img.naturalWidth/1.5)+'px'};img.src=src  // about twice its printed size, never narrower than the screen
  const x=document.createElement('button');x.className='zoomx';x.type='button';x.setAttribute('aria-label','Close');x.textContent='✕'
  const close=()=>{box.remove();removeEventListener('keydown',key)},key=e=>{if(e.key==='Escape')close()}
  box.onclick=e=>{if(e.target===box)close()};x.onclick=close;addEventListener('keydown',key)
  box.append(img,x);document.body.append(box);x.focus()}
const MdImg=({src,alt})=><img src={src} alt={alt||''} loading="lazy" className="zoomable" onClick={e=>zoom(e.currentTarget.currentSrc||e.currentTarget.src,alt)}/>  // its address as loaded (the app's reader points it at the college's server)
// a quote in notes is a call-out box; the bold words it opens with say which kind, and so its colour and icon:
// "> **Key point** …", "> **Exam tip** …", "> **Clinical pearl** …", "> **Caution** …", "> **Diagram** …", "> **Remember (mnemonic)** …", "> **Case** …"
const CALLOUTS=[['diagram',/^(diagram|figure)/],['exam',/^(exam|viva|examiners|mcq)/],['clinic',/^(clinical|in practice|at the bedside|clinical uses?)/],
  ['case',/^(case|problem)/],['warn',/^(caution|warning|beware|careful|danger|don't|do not)/],['mnemo',/^(remember|mnemonic|memory)/],['key',/^(key|in short|summary|recap|quick recap|the idea|core idea|note)/]]
const textOf=n=>!n?'':n.type==='text'?n.value:(n.children||[]).map(textOf).join('')
function Callout({node,children}){
  const p=(node?.children||[]).find(c=>c.type==='element'),lead=p&&(p.children||[]).find(c=>c.type==='element'||(c.type==='text'&&c.value.trim()))
  const label=lead&&lead.type==='element'&&lead.tagName==='strong'?textOf(lead).trim().toLowerCase():''
  const kind=(CALLOUTS.find(([,re])=>re.test(label))||['plain'])[0]
  return <blockquote className={'callout '+kind}>{children}</blockquote>}
export const Md=({children})=><Markdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeKatex]} urlTransform={url} components={{img:MdImg,blockquote:Callout}}>{fixTables(texDelims(children))}</Markdown>
// a topic's content: Markdown, or HTML from an uploaded file (the server cleans it on every save and every read, so it carries no scripts or styles)
export const Body=({text,format})=>format==='html'?<div className="htmlc" dangerouslySetInnerHTML={{__html:atHtml(text||'')}}/>:<Md>{text}</Md>
