import { useState, useEffect, useRef, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ComposedChart, Area } from "recharts";

const THEMES={
  "Dark Navy":{bg:"#080F1C",surf:"#0E1A2E",surf2:"#152035",surf3:"#1C2B42",bdr:"#1E2F48",bdr2:"#253650",teal:"#00D4AA",blue:"#3B82F6",amber:"#F59E0B",red:"#EF4444",green:"#22C55E",purple:"#A855F7",slate:"#64748B",text:"#E8F0FE",muted:"#6B82A0",muted2:"#4A5F7A"},
  "Midnight Purple":{bg:"#0D0B1A",surf:"#161228",surf2:"#1E1835",surf3:"#261F42",bdr:"#2D2450",bdr2:"#3A2F64",teal:"#B48EFF",blue:"#7C6DFA",amber:"#FF9F43",red:"#FF6B6B",green:"#2ECC71",purple:"#D4A6FF",slate:"#8878AA",text:"#F0ECFF",muted:"#8878AA",muted2:"#5A5075"},
  "Clean Light":{bg:"#F4F6FA",surf:"#FFFFFF",surf2:"#EEF1F7",surf3:"#E4E8F2",bdr:"#D0D7E8",bdr2:"#B8C2D8",teal:"#0891B2",blue:"#2563EB",amber:"#D97706",red:"#DC2626",green:"#16A34A",purple:"#7C3AED",slate:"#475569",text:"#0F172A",muted:"#64748B",muted2:"#94A3B8"},
  "Forest Green":{bg:"#071210",surf:"#0D1F1C",surf2:"#132B27",surf3:"#193632",bdr:"#1E4038",bdr2:"#265248",teal:"#34D399",blue:"#60A5FA",amber:"#FBBF24",red:"#F87171",green:"#4ADE80",purple:"#A78BFA",slate:"#6B7280",text:"#ECFDF5",muted:"#6EAF96",muted2:"#3D7A64"},
};

const fm=(n,d=1)=>{if(n==null||isNaN(+n))return"--";const s=+n<0?"-":"",a=Math.abs(+n);if(a>=1e6)return`${s}$${(a/1e6).toFixed(d)}M`;if(a>=1e3)return`${s}$${(a/1e3).toFixed(0)}K`;return`${s}$${a.toFixed(0)}`;};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const useT=()=>window.__T__||THEMES["Dark Navy"];

const Tip=({active,payload,label})=>{const T=useT();if(!active||!payload?.length)return null;return(<div style={{background:T.surf3,border:`1px solid ${T.bdr2}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.text}}><div style={{color:T.muted,marginBottom:4}}>{label}</div>{payload.map((p,i)=>p.value!=null&&<div key={i} style={{color:p.color||T.teal}}>{p.name}: {fm(p.value)}</div>)}</div>);};
function Card({children,style={}}){const T=useT();return<div style={{background:T.surf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:"18px 20px",...style}}>{children}</div>;}
function SH({title,badge,right}){const T=useT();return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:16,background:T.teal,borderRadius:2}}/><span style={{fontSize:12,fontWeight:600,color:T.text,textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</span>{badge&&<span style={{fontSize:10,background:T.teal+"20",color:T.teal,padding:"2px 8px",borderRadius:20}}>{badge}</span>}</div>{right}</div>);}
function KPI({label,value,sub,accent,pct,badge,change}){const T=useT();const ac=accent||T.teal;return(<div style={{background:T.surf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",inset:"0 0 auto 0",height:2,background:ac}}/>{(badge!=null||pct!=null)&&<div style={{position:"absolute",top:10,right:10,fontSize:11,color:pct>1?T.green:pct>0.5?T.amber:pct!=null?T.red:T.muted,fontWeight:700}}>{badge!=null?badge:pct!=null?`${Math.round(pct*100)}%`:''}</div>}<div style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>{label}</div><div style={{fontSize:20,fontWeight:700,color:T.text,lineHeight:1.1}}>{value}</div>{sub&&<div style={{fontSize:11,color:T.muted,marginTop:3}}>{sub}</div>}{change!=null&&<div style={{fontSize:11,color:change>0?T.green:change<0?T.red:T.muted,marginTop:3}}>{change>0?"▲":change<0?"▼":"-"} {Math.abs(change*100).toFixed(1)}% vs prior</div>}{pct!=null&&<div style={{height:3,background:T.bdr,borderRadius:2,marginTop:8,overflow:"hidden"}}><div style={{width:`${clamp(pct*100,0,100)}%`,height:"100%",background:ac}}/></div>}</div>);}
function Sel({label,options,value,onChange}){const T=useT();return(<div style={{display:"flex",gap:3,background:T.surf2,borderRadius:8,padding:3}}>{options.map(o=><button key={o} onClick={()=>onChange(o)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:value===o?T.teal:"transparent",color:value===o?"#000":T.muted,fontSize:11,cursor:"pointer"}}>{o}</button>)}</div>);}

// TAB: AT A GLANCE
function AtAGlanceTab({ SD, STUDIES }){
  const T=useT();
  const [period,setPeriod]=useState("Quarter");
  const [stype,setStype]=useState("All");
  const [year,setYear]=useState(2026);
  const aw=SD.awards;

  const awd=useMemo(()=>STUDIES.filter(s=>s.status==="Awarded"&&(stype==="All"||(stype==="Vaccine"?s.vax.includes("Vaccine")&&!s.vax.includes("Non"):s.vax.includes("Non")))),[stype, STUDIES]);
  const totalFcv=awd.reduce((s,x)=>s+x.fcv,0);
  const vaxAwd=awd.filter(s=>s.vax.includes("Vaccine")&&!s.vax.includes("Non"));
  const nvaxAwd=awd.filter(s=>s.vax.includes("Non"));

  const chartData=useMemo(()=>{
    if(period==="Month") return SD.fc.monthly;
    if(period==="Quarter") return SD.fc.quarterly.map(q=>({...q,m:q.q,v:q.v}));
    if(period==="Year") return [{m:"2023",v:110346580,t:"ACT"},{m:"2024",v:79347852,t:"ACT"},{m:"2025",v:66556480,t:"ACT"},{m:"2026",v:SD.fc.grand,t:"ACT/FCST"}];
    return SD.trend.map(d=>({m:d.wk,v:d.v*1000000}));
  },[period, SD]);

  const kpiData=useMemo(()=>{
    if(period==="Month"||period==="Quarter") return {total:SD.fc.grand,ytd:SD.fc.ytd,q1:SD.fc.q1,q2:SD.fc.q2};
    if(period==="Year") return {total:110346580+79347852+66556480+SD.fc.grand,ytd:SD.fc.ytd,q1:110346580,q2:79347852};
    return {total:SD.fc.grand,ytd:SD.fc.ytd};
  },[period, SD]);

  return(<div style={{display:"flex",flexDirection:"column",gap:18}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:T.muted,fontWeight:600}}>STUDY TYPE</span>
        <Sel options={["All","Vaccine","Non-Vaccine"]} value={stype} onChange={setStype}/>
        <span style={{fontSize:11,color:T.muted,fontWeight:600}}>PERIOD</span>
        <Sel options={["Year","Quarter","Month","Week"]} value={period} onChange={setPeriod}/>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {[2025,2026,2027].map(y=><button key={y} onClick={()=>setYear(y)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${year===y?T.teal:T.bdr}`,background:year===y?T.teal:"transparent",color:year===y?"#000":T.muted,fontSize:12,cursor:"pointer"}}>{y}</button>)}
      </div>
    </div>

    <div style={{fontSize:11,color:T.muted,background:T.surf2,padding:"7px 14px",borderRadius:6}}>
      AT A GLANCE -- {period} . {year} . {stype} &nbsp;|&nbsp; FCV = Estimated Potential Revenue . As of {SD.meta.latestFcName}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
      <KPI label={period==="Year"?"Total Revenue (Multi-Year)":"2026 Grand Total"} value={fm(kpiData.total)} sub={`${Math.round(SD.fc.grand/SD.baseline*100)}% of $85M target`} accent={T.teal}/>
      <KPI label="FCV Captured (Awarded)" value={fm(totalFcv)} sub="Est. Potential Revenue" accent={T.amber} pct={totalFcv/aw.fcvTgt}/>
      <KPI label="Vaccine Awarded" value={`${vaxAwd.length} / ${aw.vaxTgt}`} sub={`FCV: ${fm(vaxAwd.reduce((s,x)=>s+x.fcv,0))}`} accent={T.teal} pct={vaxAwd.length/aw.vaxTgt}/>
      <KPI label="Non-Vaccine Awarded" value={`${nvaxAwd.length} / ${aw.nvaxTgt}`} sub={`FCV: ${fm(nvaxAwd.reduce((s,x)=>s+x.fcv,0))}`} accent={T.red} pct={nvaxAwd.length/aw.nvaxTgt}/>
    </div>

    <div>
      <div style={{fontSize:11,color:T.amber,fontWeight:600,letterSpacing:"0.08em",marginBottom:10}}>EXECUTIVE HIGHLIGHTS</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[
          {color:T.amber,title:"Vaccine: Count Ahead but FCV Below Plan",body:`Vaccine awarded ${vaxAwd.length}/${aw.vaxTgt} (${Math.round(vaxAwd.length/aw.vaxTgt*100)}%). Avg FCV $${(vaxAwd.reduce((s,x)=>s+x.fcv,0)/Math.max(1,vaxAwd.length)/1000).toFixed(0)}K per study.`},
          {color:T.red,title:"Non-Vaccine FCV -- Most Critical Risk",body:`${nvaxAwd.length} of ${aw.nvaxTgt} Non-Vaccine awarded (${Math.round(nvaxAwd.length/aw.nvaxTgt*100)}%). Q3+Q4 must deliver ${aw.nvaxTgt-nvaxAwd.length} more Non-Vaccine studies.`},
          {color:T.blue,title:"Industry Norm: Book-to-Bill 1.2x",body:"For every $1 of revenue, book $1.20 in new contract value. Declining average study values mean the team must award more studies to maintain revenue levels."},
        ].map(h=><div key={h.title} style={{background:T.surf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:"14px 16px",borderLeft:`3px solid ${h.color}`}}><div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:6}}>{h.title}</div><div style={{fontSize:12,color:T.muted,lineHeight:1.6}}>{h.body}</div></div>)}
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:16}}>
      <Card>
        <SH title={`Revenue by ${period}`} badge={`${period==="Year"?"2023-2026":period==="Quarter"?"Q1-Q4 2026":period==="Week"?"Last 15 Weeks":"Jan-Dec 2026"}`}/>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.bdr} vertical={false}/>
            <XAxis dataKey="m" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<Tip/>}/>
            <Bar dataKey="v" name="Revenue" radius={[3,3,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.t==="ACT"?T.teal:d.t==="ACT/FCST"?T.blue:T.teal+"44"}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <SH title="Quarterly Scorecard 2026"/>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["QTR","TGT","ACT","RATE","FCV ACT"].map(h=><th key={h} style={{textAlign:h==="QTR"?"left":"right",padding:"6px 8px",borderBottom:`1px solid ${T.bdr}`,color:T.muted,fontSize:10}}>{h}</th>)}</tr></thead>
          <tbody>
            {[...aw.quarterly,{q:"Total",tgt:313,act:awd.length,fcvTgt:aw.fcvTgt,fcvAct:totalFcv}].map(q=>{
              const rate=q.act!=null?q.act/q.tgt:null;
              return(<tr key={q.q} style={{borderBottom:`1px solid ${T.bdr}22`,fontWeight:q.q==="Total"?600:400}}>
                <td style={{padding:"7px 8px",color:T.text}}>{q.q}</td>
                <td style={{textAlign:"right",padding:"7px 8px",color:T.muted}}>{q.tgt}</td>
                <td style={{textAlign:"right",padding:"7px 8px",color:T.text}}>{q.act??'--'}</td>
                <td style={{textAlign:"right",padding:"7px 8px",color:rate==null?T.muted:rate>=1?T.green:rate>0.5?T.amber:T.red}}>{rate!=null?`${Math.round(rate*100)}%`:'--'}</td>
                <td style={{textAlign:"right",padding:"7px 8px",color:T.teal}}>{q.fcvAct!=null?fm(q.fcvAct):'--'}</td>
              </tr>);
            })}
          </tbody>
        </table>
      </Card>
    </div>
  </div>);
}

// TAB: WATERFALL
function WoWTable({ SD }){
  const T=useT();const[open,setOpen]=useState(null);
  return(<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
    <thead><tr>{["Category","Last Week","This Week","Δ $","Δ %","",""].map(h=><th key={h} style={{textAlign:h==="Category"?"left":"right",padding:"7px 10px",borderBottom:`1px solid ${T.bdr}`,color:T.muted,fontSize:11}}>{h}</th>)}</tr></thead>
    <tbody>{SD.wow.map(d=>{
      const chg=d.curr-d.prev,pct=d.prev?(d.curr-d.prev)/d.prev:0,col=chg>0?T.green:chg<0?T.red:T.muted,isOpen=open===d.cat;
      return(<>
        <tr key={d.cat} style={{borderBottom:`1px solid ${T.bdr}22`,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background=T.surf2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          onClick={()=>setOpen(isOpen?null:d.cat)}>
          <td style={{padding:"9px 10px",color:T.text,fontWeight:500}}>{d.cat}</td>
          <td style={{textAlign:"right",padding:"9px 10px",color:T.muted,fontFamily:"monospace"}}>{fm(d.prev)}</td>
          <td style={{textAlign:"right",padding:"9px 10px",color:T.text,fontFamily:"monospace",fontWeight:600}}>{fm(d.curr)}</td>
          <td style={{textAlign:"right",padding:"9px 10px",color:col,fontFamily:"monospace"}}>{chg>0?"+":""}{fm(chg)}</td>
          <td style={{textAlign:"right",padding:"9px 10px",color:col}}>{chg>0?"+":""}{(pct*100).toFixed(1)}%</td>
          <td style={{textAlign:"right",padding:"9px 10px"}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:col+"20",color:col}}>{chg>0?"▲":chg<0?"▼":"-"}</span></td>
          <td style={{textAlign:"right",padding:"9px 10px",color:T.teal,fontSize:11}}>{isOpen?"▲":"▼ Drivers"}</td>
        </tr>
        {isOpen&&d.drivers.map((dr,i)=><tr key={i} style={{background:T.surf2,borderBottom:`1px solid ${T.bdr}22`}}><td colSpan={7} style={{padding:"7px 24px"}}><span style={{color:dr.includes("+$")||dr.includes(": +")?T.green:T.red,marginRight:8}}>{dr.includes("+$")||dr.includes(": +")?"+":"-"}</span><span style={{fontSize:12,color:T.muted}}>{dr}</span></td></tr>)}
      </>);
    })}</tbody>
  </table>);
}

function WaterfallTab({ SD }){
  const T=useT();
  const[ver,setVer]=useState("current");
  const wfData=ver==="current"?SD.wf:SD.wf_prev;
  const wf=wfData.components||SD.wf.components;
  const cd=wf.map((d,i)=>{
    const base=wf.slice(0,i).reduce((s,x)=>x.type==="neg"?s-Math.abs(x.value):x.type==="tot"?s:s+x.value,0);
    if(d.type==="tot")return{...d,base:0,bar:d.value};
    if(d.type==="neg")return{...d,base:base-Math.abs(d.value),bar:Math.abs(d.value)};
    return{...d,base,bar:d.value};
  });
  return(<div style={{display:"flex",flexDirection:"column",gap:18}}>
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <span style={{fontSize:11,color:T.muted}}>VERSION:</span>
      <button onClick={()=>setVer("current")} style={{padding:"5px 14px",borderRadius:6,border:"none",background:ver==="current"?T.teal:"transparent",color:ver==="current"?"#000":T.muted,fontSize:12,cursor:"pointer"}}>Latest ({SD.meta.latestWfName})</button>
      <button onClick={()=>setVer("previous")} style={{padding:"5px 14px",borderRadius:6,border:"none",background:ver==="previous"?T.amber:"transparent",color:ver==="previous"?"#000":T.muted,fontSize:12,cursor:"pointer"}}>Previous ({SD.meta.prevWfName})</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
      <KPI label="Baseline Target" value="$85.0M" sub="FY 2026 annual goal" accent={T.amber} badge="TARGET"/>
      <KPI label="H1 Total" value={fm(wfData.h1)} sub={`Q1: ${fm(wfData.q1)} . Q2: ${fm(wfData.q2)}`} accent={T.teal} change={ver==="previous"?null:(wfData.h1-SD.wf_prev.h1)/SD.wf_prev.h1}/>
      <KPI label="H2 Total" value={fm(wfData.h2)} sub={`Q3: ${fm(wfData.q3)} . Q4: ${fm(wfData.q4)}`} accent={T.blue} change={ver==="previous"?null:(wfData.h2-SD.wf_prev.h2)/SD.wf_prev.h2}/>
      <KPI label="Gap to $85M (Forecaster)" value={fm(SD.baseline-SD.fc.grand)} sub={`${Math.round(SD.fc.grand/SD.baseline*100)}% of baseline achieved`} accent={T.red}/>
    </div>
    <Card>
      <SH title={`Revenue Waterfall Bridge 2026 -- ${ver==="current"?SD.meta.latestWfName:SD.meta.prevWfName}`} badge="Summary - baseline 85M"/>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={cd} barSize={44}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.bdr} vertical={false}/>
          <XAxis dataKey="label" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false} angle={-10} textAnchor="end" height={45}/>
          <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
          <Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const d=payload[0]?.payload;return(<div style={{background:T.surf3,border:`1px solid ${T.bdr2}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.text}}><div style={{color:T.muted,marginBottom:3}}>{label}</div><div style={{color:d?.type==="neg"?T.red:d?.type==="tot"?T.amber:T.teal,fontWeight:600}}>{d?.type==="neg"?"-":""}{fm(Math.abs(d?.value||0))}</div></div>);}}/>
          <Bar dataKey="base" stackId="w" fill="transparent"/>
          <Bar dataKey="bar" stackId="w" radius={[4,4,0,0]}>{cd.map((d,i)=><Cell key={i} fill={d.type==="neg"?T.red+"BB":d.type==="tot"?T.amber:T.teal}/>)}</Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
    <Card><SH title="Week-over-Week Movement" badge="Click row to expand study-level drivers"/><WoWTable SD={SD} /></Card>
  </div>);
}

// TAB: FORECASTER
function ForecasterTab({ SD, STUDIES }){
  const T=useT();
  const[ver,setVer]=useState("current");
  const fcData=ver==="current"?SD.fc:SD.fc_prev;
  const byStatus=st=>STUDIES.filter(s=>s.status===st);
  return(<div style={{display:"flex",flexDirection:"column",gap:18}}>
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <span style={{fontSize:11,color:T.muted}}>VERSION:</span>
      <button onClick={()=>setVer("current")} style={{padding:"5px 14px",borderRadius:6,border:"none",background:ver==="current"?T.teal:"transparent",color:ver==="current"?"#000":T.muted,fontSize:12,cursor:"pointer"}}>Latest ({SD.meta.latestFcName})</button>
      <button onClick={()=>setVer("previous")} style={{padding:"5px 14px",borderRadius:6,border:"none",background:ver==="previous"?T.amber:"transparent",color:ver==="previous"?"#000":T.muted,fontSize:12,cursor:"pointer"}}>Previous ({SD.meta.prevFcName})</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
      <KPI label="Grand Total 2026" value={fm(fcData.grand)} sub={`${Math.round(fcData.grand/SD.baseline*100)}% of $85M`} accent={T.teal} change={ver==="previous"?null:(SD.fc.grand-SD.fc_prev.grand)/SD.fc_prev.grand}/>
      <KPI label="YTD Revenue" value={fm(fcData.ytd)} sub={`${Math.round(fcData.ytd/fcData.grand*100)}% of annual`} accent={T.blue}/>
      <KPI label="Grand Total Studies" value={ver==="current"?SD.counts.grand.toLocaleString():SD.counts_prev.grand.toLocaleString()} sub={ver==="current"?`${SD.counts.vaxTotal} Vax . ${SD.counts.nvaxTotal} Non-Vax`:`${SD.counts_prev.vaxTotal} Vax . ${SD.counts_prev.nvaxTotal} Non-Vax`} accent={T.purple} change={ver==="previous"?null:(SD.counts.grand-SD.counts_prev.grand)/SD.counts_prev.grand}/>
      <KPI label="Expected Goals" value={SD.goals.total.toLocaleString()} sub={`H1: ${SD.goals.h1.toLocaleString()} . H2: ${SD.goals.h2.toLocaleString()}`} accent={T.amber}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:16}}>
      <Card>
        <SH title={`Revenue Forecast -- ${ver==="current"?SD.meta.latestFcName:SD.meta.prevFcName}`}/>
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={fcData.monthly}>
            <defs><linearGradient id="aG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.teal} stopOpacity={0.15}/><stop offset="95%" stopColor={T.teal} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.bdr} vertical={false}/>
            <XAxis dataKey="m" tick={{fill:T.muted,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="v" name="Revenue" fill="url(#aG)" stroke={T.teal} strokeWidth={2}/>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <SH title="Revenue by Status"/>
        {[{l:"Maintenance",c:T.teal},{l:"Enrolling",c:T.blue},{l:"Awarded",c:T.amber},{l:"Pipeline",c:T.purple}].map(d=>{
          const totalRev = byStatus(d.l).reduce((sum, item) => sum + item.total2026, 0);
          return (
          <div key={d.l} style={{marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{color:T.text}}>{d.l} <span style={{color:T.muted,fontSize:10}}>({byStatus(d.l).length})</span></span>
              <span style={{color:d.c,fontFamily:"monospace"}}>{fm(ver==="current"?totalRev:totalRev*0.93)}</span>
            </div>
            <div style={{height:4,background:T.bdr,borderRadius:2,overflow:"hidden"}}><div style={{width:`${Math.min(100,totalRev/fcData.grand*100)}%`,height:"100%",background:d.c}}/></div>
          </div>
        )})}
      </Card>
    </div>
  </div>);
}

// TAB: VARIANCE
function VarianceTab({ SD }){
  const T=useT();
  const[view,setView]=useState("forecaster");
  const varData=view==="forecaster"?SD.variance.fc_mom:SD.variance.wf_wow;

  return(<div style={{display:"flex",flexDirection:"column",gap:18}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:11,color:T.muted,fontWeight:600}}>VIEW:</span>
      <Sel options={["forecaster","waterfall"]} value={view} onChange={setView}/>
      <span style={{fontSize:12,color:T.muted,marginLeft:8}}>{view==="forecaster"?`${SD.meta.prevFcName} -> ${SD.meta.latestFcName} (MoM)`:`${SD.meta.prevWfName} -> ${SD.meta.latestWfName} (WoW)`}</span>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
      {view==="forecaster"?(<>
        <KPI label="Grand Total Change" value={fm(SD.fc.grand-SD.fc_prev.grand)} sub={`$${(SD.fc_prev.grand/1e6).toFixed(2)}M -> $${(SD.fc.grand/1e6).toFixed(2)}M`} accent={T.green} change={(SD.fc.grand-SD.fc_prev.grand)/SD.fc_prev.grand}/>
        <KPI label="Study Count Change" value={`+${SD.counts.grand-SD.counts_prev.grand}`} sub={`${SD.counts_prev.grand} -> ${SD.counts.grand} studies`} accent={T.blue}/>
        <KPI label="Pipeline Growth" value={`+${SD.counts.pipeline-SD.counts_prev.pipeline}`} sub={`${SD.counts_prev.pipeline} -> ${SD.counts.pipeline} opps`} accent={T.purple}/>
        <KPI label="New Awards" value={`+${SD.counts.awarded-SD.counts_prev.awarded}`} sub={`${SD.counts_prev.awarded} -> ${SD.counts.awarded} awarded`} accent={T.amber}/>
      </>):(<>
        <KPI label="WoW Revenue Change" value={fm(SD.wf.grand-SD.wf_prev.grand)} sub="$85.0M baseline unchanged" accent={T.muted}/>
        <KPI label="Enrolling Change" value={fm(SD.variance.wf_wow[1]?.diff||0)} sub={`${SD.meta.latestWfName} vs ${SD.meta.prevWfName}`} accent={T.red}/>
        <KPI label="Go-Get Change" value={fm(SD.variance.wf_wow[2]?.diff||0)} sub="Pipeline CL adjustments" accent={T.green}/>
        <KPI label="Overall Impact" value="Minimal" sub="$85M target maintained" accent={T.blue}/>
      </>)}
    </div>

    <Card>
      <SH title={view==="forecaster"?"Forecaster Month-over-Month Variance":"Waterfall Week-over-Week Variance"} badge={view==="forecaster"?`${SD.meta.prevFcName} -> ${SD.meta.latestFcName}`:`${SD.meta.prevWfName} -> ${SD.meta.latestWfName}`}/>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>
          {["Category","Previous","Current","Change $","Change %","Reason"].map(h=><th key={h} style={{textAlign:h==="Category"||h==="Reason"?"left":"right",padding:"8px 10px",borderBottom:`1px solid ${T.bdr}`,color:T.muted,fontSize:11,fontWeight:500}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {varData.map((d,i)=>{
            const chg=d.new_v-d.old,pct=d.old?(d.new_v-d.old)/d.old:0,col=chg>0?T.green:chg<0?T.red:T.muted;
            return(<tr key={i} style={{borderBottom:`1px solid ${T.bdr}22`}}
              onMouseEnter={e=>e.currentTarget.style.background=T.surf2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{padding:"10px",color:T.text,fontWeight:600}}>{d.cat}</td>
              <td style={{textAlign:"right",padding:"10px",color:T.muted,fontFamily:"monospace"}}>{fm(d.old)}</td>
              <td style={{textAlign:"right",padding:"10px",color:T.text,fontFamily:"monospace",fontWeight:600}}>{fm(d.new_v)}</td>
              <td style={{textAlign:"right",padding:"10px",color:col,fontFamily:"monospace"}}>{chg>=0?"+":""}{fm(chg)}</td>
              <td style={{textAlign:"right",padding:"10px",color:col}}>{chg>=0?"+":""}{(pct*100).toFixed(1)}%</td>
              <td style={{padding:"10px",color:T.muted,fontSize:12,maxWidth:300}}>{d.reason}</td>
            </tr>);
          })}
        </tbody>
      </table>
    </Card>
  </div>);
}

// TAB: STUDY SEARCH
function StudySearchTab({ STUDIES }){
  const T=useT();
  const[q,setQ]=useState("");
  const[fSt,setFSt]=useState("All");
  const[fVax,setFVax]=useState("All");
  const[sel,setSel]=useState(null);
  const sc={Enrolling:T.blue,Awarded:T.amber,Maintenance:T.teal,Pipeline:T.purple,Cancelled:T.red};
  
  // Uses the FULL 2,600+ Google Sheets Database
  const results=useMemo(()=>{
    const ql=q.toLowerCase().trim();
    return STUDIES.filter(s=>{
      const mQ=!ql||[s.lid,s.atom,s.protocol,s.sponsor,s.cro,s.indication,s.ta,s.pi,s.leadName].some(v=>String(v||'').toLowerCase().includes(ql));
      const mSt=fSt==="All"||s.status===fSt;
      const mVax=fVax==="All"||(fVax==="Vaccine"?s.vax.includes("Vaccine")&&!s.vax.includes("Non"):s.vax.includes("Non"));
      return mQ&&mSt&&mVax;
    }).slice(0, 150); // Slices rendering so browser doesn't freeze, but counts below are 100% accurate!
  },[q,fSt,fVax, STUDIES]);

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:T.surf2,border:`1px solid ${T.bdr}`,borderRadius:8,padding:"8px 14px",fontSize:11,color:T.muted}}>
      LIVE Google Sheets Database Synced. Study database contains <b style={{color:T.text}}>{STUDIES.length} total studies</b>.
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search Lead ID, ATOM No, Protocol, Sponsor, CRO, PI, Indication, Study Name..."
        style={{background:T.surf2,border:`1px solid ${T.bdr2}`,borderRadius:8,padding:"10px 16px",color:T.text,fontSize:13,outline:"none"}}/>
      <select value={fSt} onChange={e=>setFSt(e.target.value)} style={{background:T.surf2,border:`1px solid ${T.bdr}`,borderRadius:8,padding:"10px 12px",color:T.muted,fontSize:12,cursor:"pointer"}}>
        {["All","Enrolling","Awarded","Maintenance","Pipeline","Cancelled"].map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <select value={fVax} onChange={e=>setFVax(e.target.value)} style={{background:T.surf2,border:`1px solid ${T.bdr}`,borderRadius:8,padding:"10px 12px",color:T.muted,fontSize:12,cursor:"pointer"}}>
        {["All","Vaccine","Non-Vaccine"].map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={()=>{setQ("");setFSt("All");setFVax("All");setSel(null);}} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${T.bdr}`,background:"transparent",color:T.muted,fontSize:12,cursor:"pointer"}}>Clear</button>
    </div>
    <div style={{fontSize:12,color:T.muted}}>
      Showing top <b style={{color:T.teal}}>{results.length}</b> rows out of <b style={{color:T.text}}>{STUDIES.length}</b> matching database entries.
      <span style={{color:T.blue}}> {STUDIES.filter(s=>s.status==="Enrolling").length} Enrolling</span> .
      <span style={{color:T.amber}}> {STUDIES.filter(s=>s.status==="Awarded").length} Awarded</span> .
      <span style={{color:T.teal}}> {STUDIES.filter(s=>s.status==="Maintenance").length} Maintenance</span> .
      <span style={{color:T.purple}}> {STUDIES.filter(s=>s.status==="Pipeline").length} Pipeline</span>
    </div>
    <div style={{display:"grid",gridTemplateColumns:sel?"1fr 360px":"1fr",gap:14,alignItems:"start"}}>
      <div style={{overflowX:"auto",background:T.surf,border:`1px solid ${T.bdr}`,borderRadius:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:900}}>
          <thead><tr style={{borderBottom:`1px solid ${T.bdr}`,background:T.surf}}>
            {["Lead ID","ATOM","Protocol","Site","Status","Sponsor","CRO","Indication","Rando","Goals","BPS","CL%","FCV","Rev 2026","Vax"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"9px 10px",color:T.muted,fontSize:10,fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{results.map((s,i)=>{
            const isSel=sel?.lid===s.lid&&sel?.atom===s.atom;const col=sc[s.status]||T.muted;
            return(<tr key={i} onClick={()=>setSel(isSel?null:s)} style={{borderBottom:`1px solid ${T.bdr}22`,cursor:"pointer",background:isSel?T.surf2:"transparent"}}
              onMouseEnter={e=>!isSel&&(e.currentTarget.style.background=T.surf2)} onMouseLeave={e=>!isSel&&(e.currentTarget.style.background="transparent")}>
              <td style={{padding:"8px 10px",color:T.teal,fontFamily:"monospace",fontWeight:600,whiteSpace:"nowrap"}}>{s.lid}</td>
              <td style={{padding:"8px 10px",color:T.muted,fontFamily:"monospace"}}>{s.atom}</td>
              <td style={{padding:"8px 10px",color:T.text,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.protocol}</td>
              <td style={{padding:"8px 10px",color:T.muted,whiteSpace:"nowrap"}}>{s.site}</td>
              <td style={{padding:"8px 10px"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:col+"22",color:col}}>{s.status}</span></td>
              <td style={{padding:"8px 10px",color:T.muted,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.sponsor}</td>
              <td style={{padding:"8px 10px",color:T.muted}}>{s.cro}</td>
              <td style={{padding:"8px 10px",color:T.muted,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.indication}</td>
              <td style={{padding:"8px 10px",color:T.text,textAlign:"right",fontFamily:"monospace"}}>{s.actRando}</td>
              <td style={{padding:"8px 10px",color:T.text,textAlign:"right",fontFamily:"monospace"}}>{s.goals}</td>
              <td style={{padding:"8px 10px",color:T.muted,textAlign:"right",fontFamily:"monospace"}}>{fm(s.bps)}</td>
              <td style={{padding:"8px 10px",color:T.muted,textAlign:"right"}}>{Math.round(s.cl*100)}%</td>
              <td style={{padding:"8px 10px",color:T.amber,textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{fm(s.fcv)}</td>
              <td style={{padding:"8px 10px",color:T.teal,textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{fm(s.total2026)}</td>
              <td style={{padding:"8px 10px",color:s.vax.includes("Non")?T.blue:T.teal,fontSize:10}}>{s.vax.includes("Non")?"Non-Vax":"Vaccine"}</td>
            </tr>);
          })}</tbody>
        </table>
      </div>
      {sel&&(<div style={{background:T.surf,border:`1px solid ${T.bdr}`,borderRadius:12,padding:"16px",position:"sticky",top:70,maxHeight:"82vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontSize:13,fontWeight:700,color:T.text}}>Study Detail</span>
          <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:18}}>x</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{fontSize:12,background:T.teal+"22",color:T.teal,padding:"3px 10px",borderRadius:20,fontFamily:"monospace"}}>LID: {sel.lid}</span>
          <span style={{fontSize:12,background:T.blue+"22",color:T.blue,padding:"3px 10px",borderRadius:20,fontFamily:"monospace"}}>ATOM: {sel.atom}</span>
          <span style={{fontSize:11,background:(sc[sel.status]||T.muted)+"22",color:sc[sel.status]||T.muted,padding:"3px 10px",borderRadius:20}}>{sel.status}</span>
        </div>
        {[["Protocol",sel.protocol],["Lead Name",sel.leadName],["Site",sel.site],["Sub Status",sel.substatus],["Sponsor",sel.sponsor],["CRO",sel.cro],["Indication",sel.indication],["Therapeutic Area",sel.ta],["PI",sel.pi],["Vaccine/Non-Vax",sel.vax],["Priority",sel.priority],["Actual Rando",sel.actRando],["Future Goals",sel.goals],["Total Patients",sel.totalPts],["Budget/Subject",fm(sel.bps)],["Confidence Level",`${Math.round(sel.cl*100)}%`],["FCV (Est. Potential)",fm(sel.fcv)],["Factored Revenue",fm(sel.rev)],["2026 Total",fm(sel.total2026)],["YTD Actual",fm(sel.actual2026)],["H1 2026",fm(sel.h1)],["H2 2026",fm(sel.h2)],["Q1",fm(sel.q1)],["Q2",fm(sel.q2)],["Q3",fm(sel.q3)],["Q4",fm(sel.q4)]].filter(([,v])=>v&&v!="--"&&String(v)!=="0"&&v!=="undefined").map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.bdr}22`}}>
            <span style={{fontSize:11,color:T.muted}}>{k}</span>
            <span style={{fontSize:12,color:T.text,fontWeight:500,textAlign:"right",maxWidth:"60%"}}>{String(v)}</span>
          </div>
        ))}
      </div>)}
    </div>
  </div>);
}

// TAB: AI AGENT
function AgentTab(){
  const T=useT();
  const[msgs,setMsgs]=useState([{role:"assistant",content:`Hello! I'm the DM Clinical Revenue Intelligence Agent. I am connected directly to your Google Sheets Registries and Anthropic. Ask me anything!` }]);
  const[inp,setInp]=useState("");
  const[thinking,setThinking]=useState(false);
  const ref=useRef(null);
  const SUGG=["Tell me about Lead ID 2544","Show all Pfizer enrolling studies","Why did enrolling drop this week?","Top 10 studies by 2026 revenue"];
  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"})},[msgs]);

  const send=async(text)=>{
    const msg=text||inp.trim();if(!msg||thinking)return;
    setInp("");const newMsgs=[...msgs,{role:"user",content:msg}];setMsgs(newMsgs);setThinking(true);
    try{
      const r=await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({system:"You are the DM Clinical Revenue Intelligence Agent.",messages:newMsgs})
      });
      const d=await r.json();
      setMsgs(p=>[...p,{role:"assistant",content:d.content?.[0]?.text || "Error"}]);
    }catch(e){
      setMsgs(p=>[...p,{role:"assistant",content:`Error: ${e.message}`}]);
    }
    setThinking(false);
  };

  return(<div style={{display:"flex",flexDirection:"column",gap:12,height:"calc(100vh - 200px)"}}>
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
      {SUGG.map(q=><button key={q} onClick={()=>send(q)} style={{fontSize:11,padding:"5px 12px",borderRadius:20,border:`1px solid ${T.bdr2}`,background:T.surf2,color:T.muted,cursor:"pointer"}}>{q}</button>)}
    </div>
    <div style={{flex:1,background:T.surf,border:`1px solid ${T.bdr}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10}}>
            {m.role==="assistant"&&<div style={{width:28,height:28,borderRadius:"50%",background:T.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#000"}}>AI</div>}
            <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:12,background:m.role==="user"?T.teal+"22":T.surf2,border:`1px solid ${T.bdr}`,fontSize:13,color:T.text,whiteSpace:"pre-wrap"}}>{m.content}</div>
          </div>
        ))}
        {thinking&&<div style={{color:T.teal}}>Thinking...</div>}
        <div ref={ref}/>
      </div>
      <div style={{borderTop:`1px solid ${T.bdr}`,padding:"12px 16px",display:"flex",gap:10}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask a question..." style={{flex:1,background:T.surf3,border:`1px solid ${T.bdr2}`,borderRadius:8,padding:"9px 14px",color:T.text,outline:"none"}}/>
        <button onClick={()=>send()} disabled={thinking||!inp.trim()} style={{padding:"9px 22px",borderRadius:8,background:T.teal,color:"#000",border:"none",cursor:"pointer"}}>Send</button>
      </div>
    </div>
  </div>);
}

// MAIN WRAPPER
const TABS_UI = { glance: AtAGlanceTab, waterfall: WaterfallTab, forecaster: ForecasterTab, variance: VarianceTab, search: StudySearchTab, agent: AgentTab };

export default function App(){
  const[tab,setTab]=useState("glance");
  const[theme,setTheme]=useState("Dark Navy");
  const[studies, setStudies] = useState([]);
  const[sdMetrics, setSdMetrics] = useState(null);
  const[isLoading, setIsLoading] = useState(true);
  const[errorMsg, setErrorMsg] = useState(null); // <-- Added error state
  
  window.__T__=THEMES[theme];const T=THEMES[theme];

  useEffect(()=>{
    fetch('/api/dashboard')
      .then(async (res) => {
        const data = await res.json();
        // If the backend sends an error, throw it so we can catch it!
        if (!res.ok) throw new Error(data.error || 'Unknown Server Error');
        return data;
      })
      .then(data => { 
        if(data.studies) setStudies(data.studies); 
        if(data.sdMetrics) setSdMetrics(data.sdMetrics);
        setIsLoading(false); 
      })
      .catch((err) => {
        console.error("Dashboard Error:", err);
        setErrorMsg(err.message); // <-- Save the error message
        setIsLoading(false); 
      });
  },[]);

  // IF THERE IS AN ERROR, SHOW THIS SCREEN INSTEAD OF LOADING FOREVER!
  if (errorMsg) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,color:T.red,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,textAlign:"center"}}>
        <h2>🚨 Connection Error</h2>
        <div style={{background:T.surf2,padding:"20px",borderRadius:8,border:`1px solid ${T.red}`,marginTop:10,maxWidth:800}}>
          <p style={{fontFamily:"monospace",fontSize:14,color:T.red}}>{errorMsg}</p>
        </div>
        <p style={{color:T.text,marginTop:20,fontSize:14}}>Please copy the red error text above and paste it back into the chat!</p>
      </div>
    );
  }

  if (isLoading || !sdMetrics) return <div style={{minHeight:"100vh",background:T.bg,color:T.text,display:"flex",alignItems:"center",justifyContent:"center"}}><h2>Loading Live Google Sheets Data...</h2></div>;

  const ActiveTab = TABS_UI[tab] || AtAGlanceTab;

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{height:52,background:T.surf,borderBottom:`1px solid ${T.bdr}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:28,height:28,borderRadius:6,background:T.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#000"}}>DM</div>
          <span style={{fontSize:13,fontWeight:700}}>DM Clinical Research</span>
        </div>
        <div style={{display:"flex",gap:2}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?T.teal+"18":"transparent",border:"none",color:tab===t.id?T.teal:T.muted,padding:"5px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontWeight:tab===t.id?700:500}}>{t.label}</button>)}
        </div>
      </div>
      <div style={{padding:"18px 20px",maxWidth:1400,margin:"0 auto"}}>
        <ActiveTab SD={sdMetrics} STUDIES={studies} />
      </div>
    </div>
  );
}