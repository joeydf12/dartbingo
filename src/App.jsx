import React, { useState, useEffect, useRef, useCallback } from "react";
import { sb, dbg, err } from "./lib/supabase.js";
import { createRetryingSaver } from "./lib/offlineQueue.js";
import { useAuth } from "./auth/useAuth.js";
import { AuthSheet } from "./auth/AuthSheet.jsx";
import { AdminPanel } from "./admin/AdminPanel.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENTS = [
  {id:"e1", label:"180",        slok:1,at:false,emoji:"🎯",cat:"score", diff:"easy"},
  {id:"e2", label:"171",        slok:1,at:false,emoji:"💥",cat:"score", diff:"medium"},
  {id:"e3", label:"174",        slok:1,at:false,emoji:"💥",cat:"score", diff:"medium"},
  {id:"e4", label:"177",        slok:1,at:false,emoji:"💥",cat:"score", diff:"medium"},
  {id:"e5", label:"140",        slok:1,at:false,emoji:"🔥",cat:"score", diff:"easy"},
  {id:"e6", label:"100",        slok:1,at:false,emoji:"💯",cat:"score", diff:"easy"},
  {id:"e7", label:"20·19·18",   slok:1,at:false,emoji:"🎱",cat:"score", diff:"medium"},
  {id:"e8", label:"BULL",       slok:1,at:false,emoji:"🎯",cat:"score", diff:"medium"},
  {id:"e9", label:"3× MISS",    slok:2,at:false,emoji:"😬",cat:"miss",  diff:"easy"},
  {id:"e10",label:"T20",        slok:1,at:false,emoji:"🎯",cat:"score", diff:"easy"},
  {id:"e11",label:"T19",        slok:1,at:false,emoji:"🎯",cat:"score", diff:"easy"},
  {id:"e12",label:"D20 FINISH", slok:2,at:false,emoji:"✅",cat:"finish",diff:"medium"},
  {id:"e13",label:"D16 FINISH", slok:2,at:false,emoji:"✅",cat:"finish",diff:"medium"},
  {id:"e14",label:"160 FINISH", slok:2,at:false,emoji:"🏆",cat:"finish",diff:"hard"},
  {id:"e15",label:"121 FINISH", slok:2,at:false,emoji:"🏆",cat:"finish",diff:"hard"},
  {id:"e16",label:"9 DART",     slok:5,at:true, emoji:"🤯",cat:"special"},
  {id:"e17",label:"BULL BULL",  slok:3,at:true, emoji:"🎯",cat:"special"},
  {id:"e18",label:"170 FINISH", slok:4,at:true, emoji:"🐟",cat:"finish"},
  {id:"e19",label:"167 FINISH", slok:3,at:true, emoji:"🎳",cat:"finish"},
  {id:"e20",label:"164 FINISH", slok:2,at:false,emoji:"🎳",cat:"finish",diff:"hard"},
  {id:"e21",label:"D10 FINISH", slok:1,at:false,emoji:"🎲",cat:"finish",diff:"medium"},
  {id:"e22",label:"MISS BULL",  slok:1,at:false,emoji:"😅",cat:"miss",  diff:"easy"},
  {id:"e23",label:"161 FINISH", slok:3,at:true, emoji:"🎳",cat:"finish"},
];
const REWARDS = [
  "🍺 Geef iemand anders 2 slokken","🎉 IEDEREEN 1 slok!",
  "😈 Kies iemand: 3 slokken","🔥 Jij deelt 2 slokken uit",
  "👑 Dartskoning — iedereen 1 slok","💀 Kies wie er een shot neemt",
];
const LINES   = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const COLORS  = {
  rood:  {a:"#e03030",bg:"#fff5f5",card:"#fff",bd:"#fbbfbf",tx:"#1a0505",sub:"#a05050",cell:"#ffe0e0",lbl:"🔴 Rood"},
  groen: {a:"#149a4d",bg:"#f0f7ef",card:"#fff",bd:"#b8ddb8",tx:"#082015",sub:"#306845",cell:"#e0f4e8",lbl:"🟢 Groen"},
  blauw: {a:"#1a73e8",bg:"#f0f4ff",card:"#fff",bd:"#b3c8f5",tx:"#080830",sub:"#3a55a8",cell:"#e0e8ff",lbl:"🔵 Blauw"},
  oranje:{a:"#ec7d16",bg:"#fff6ef",card:"#fff",bd:"#f5cc8a",tx:"#201000",sub:"#a85820",cell:"#ffe8d0",lbl:"🟠 Oranje"},
  paars: {a:"#7c3aed",bg:"#f6f0ff",card:"#fff",bd:"#ccb0f5",tx:"#180828",sub:"#5828b0",cell:"#ece0ff",lbl:"🟣 Paars"},
  geel:  {a:"#d97706",bg:"#fffbef",card:"#fff",bd:"#eed880",tx:"#201000",sub:"#8a6010",cell:"#fff8d0",lbl:"🟡 Geel"},
};
const EMOJIS  = ["🎯","💥","🔥","💯","🎱","😬","✅","🏆","🤯","🎳","🎲","😅","🍺","🍻","👑","💀","🎉","😈","🐟","⚡","🌟","💎","🚀","🎪"];
const AVATARS = ["🎯","🏆","👑","🔥","💪","🎱","⚡","🍺","💥","😎","🤯","🦁","🐺","🐯","🦊","🌟","💎","🚀","🎭","🎪"];
const CATS    = {score:{lbl:"Score",c:"#1a73e8"},finish:{lbl:"Finish",c:"#149a4d"},miss:{lbl:"Miss",c:"#ec7d16"},special:{lbl:"Speciaal",c:"#7c3aed"}};
const DIFFS   = {easy:{lbl:"Makkelijk",c:"#149a4d"},medium:{lbl:"Gemiddeld",c:"#ec7d16"},hard:{lbl:"Moeilijk",c:"#e03030"}};

// ── Achievements ──────────────────────────────────────────────────────────────
const ACHS = [
  {id:"first_hit",    e:"👆",lbl:"Eerste Tik",      d:"Eerste vakje aangetikt"},
  {id:"first_180",    e:"🎯",lbl:"180!",             d:"Eerste 180 gescoord"},
  {id:"first_bingo",  e:"🏆",lbl:"BINGO!",           d:"Eerste bingo-rij"},
  {id:"double_bingo", e:"🎉",lbl:"Dubbel Bingo",     d:"2 bingo-rijen"},
  {id:"triple_bingo", e:"🔱",lbl:"Triple Bingo",     d:"3 bingo-rijen"},
  {id:"full_card",    e:"💯",lbl:"Vol Kaart",        d:"Alle 9 vakjes aangetikt"},
  {id:"nine_dart",    e:"🤯",lbl:"Perfect Game",     d:"9-darter geregistreerd"},
  {id:"fish",         e:"🐟",lbl:"De Vis",           d:"170-finish geregistreerd"},
  {id:"drink_10",     e:"🍺",lbl:"Slok Prins",       d:"10+ slokken"},
  {id:"drink_20",     e:"🍻",lbl:"Slok Kampioen",    d:"20+ slokken"},
  {id:"drink_30",     e:"💀",lbl:"Slok Legende",     d:"30+ slokken"},
  {id:"bull_bull",    e:"🎯",lbl:"Bullseye Master",  d:"BULL BULL aangetikt"},
  {id:"diagonal_bingo",e:"↗️",lbl:"Diagonaal!",     d:"Bingo op een diagonaal"},
  {id:"streak_180",   e:"🔥",lbl:"180-Streak",       d:"3× 180 in één spel"},
  {id:"all_specials", e:"🌟",lbl:"Special Hunter",   d:"Alle 3 zeldzame vakjes aangetikt"},
  {id:"speed_bingo",  e:"⚡",lbl:"Snelle Bingo",     d:"Bingo met ≤5 vakjes aangetikt"},
  {id:"finisher",     e:"✅",lbl:"Finisher",         d:"3 finish-vakjes aangetikt"},
];

// ── Settings ──────────────────────────────────────────────────────────────────
const SK = "db_s2";
const DS = {sound:true,vol:0.7,scale:1,maxD:30,undoC:false,resetC:true,dTab:"players",chat:true,hideD:false,debug:false,gm:"slokken",minP:1,maxP:6,cardDist:{easy:3,medium:2,hard:1}};
const loadS = ()=>{ try{const s=localStorage.getItem(SK);return s?{...DS,...JSON.parse(s)}:{...DS};}catch{return{...DS};} };
const saveS = s=>{ try{localStorage.setItem(SK,JSON.stringify(s));localStorage.setItem("db1",s.debug?"1":"0");}catch{} };
const getVol= ()=>{ try{const s=JSON.parse(localStorage.getItem(SK)||"{}");return s.sound===false?0:(s.vol??0.7);}catch{return 0.7;} };

// ── Session History (localStorage) ───────────────────────────────────────────
const HIST_KEY="db_hist_v1";
function loadHistory(){try{return JSON.parse(localStorage.getItem(HIST_KEY)||"[]");}catch{return[];}}
function saveHistory(h){try{localStorage.setItem(HIST_KEY,JSON.stringify(h.slice(0,20)));}catch{}}
function addToHistory(sess,players){
  try{
    const h=loadHistory();
    const sorted=[...players].sort((a,b)=>(b.total_slok||0)-(a.total_slok||0));
    h.unshift({
      id:sess.id,name:sess.name||"Dart Avond",date:new Date().toISOString(),
      mode:sess.game_mode||"slokken",round:sess.round||1,
      players:sorted.map(p=>({name:p.name,color:p.color,avatar:p.avatar,slok:p.total_slok||0,bingos:LINES.filter(l=>l.every(i=>(p.counts||[])[i]>0)).length,achs:(p.achievements||[]).length}))
    });
    saveHistory(h);
  }catch{}
}

// ── Sounds ────────────────────────────────────────────────────────────────────
let _ac=null;
const ac=()=>{ if(!_ac) try{_ac=new(window.AudioContext||window.webkitAudioContext)();}catch{} if(_ac?.state==="suspended")_ac.resume().catch(()=>{}); return _ac; };
function tone(f,d,v=0.15,t="sine"){
  const c=ac();if(!c)return;const vol=getVol();if(!vol)return;
  try{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);
    o.frequency.value=f;o.type=t;const n=c.currentTime;
    g.gain.setValueAtTime(v*vol,n);g.gain.exponentialRampToValueAtTime(0.001,n+d);
    o.start(n);o.stop(n+d);}catch{}
}
const sClick  = (f=800)=>tone(f,.1,.12);
const sUndo   = ()=>tone(350,.12,.12);
const sBingo  = ()=>[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.38,.25),i*130));
const sFanfare= ()=>[392,523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>tone(f,.4,.2,"triangle"),i*100));
const sAch    = ()=>[600,800,1000].forEach((f,i)=>setTimeout(()=>tone(f,.18,.13),i*75));

// ── Utils ─────────────────────────────────────────────────────────────────────
const uid = ()=>Math.random().toString(36).slice(2,10);
const stripKicked = arr => (arr||[]).filter(p=>!p.is_kicked);

function makeCard(pool,col,sid,x="",dist=null){
  const seed=([...col+(sid||"x")+x]).reduce((a,c,i)=>a+c.charCodeAt(0)*(i+1),42);
  const cm=pool.filter(e=>!e.at),rr=pool.filter(e=>e.at);
  if(cm.length<6||rr.length<3)return null;
  function sh(arr,s){const a=[...arr];let sv=s;
    const r=()=>{sv=(sv*1664525+1013904223)&0xffffffff;return(sv>>>0)/0xffffffff;};
    for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  if(dist){
    const de=cm.filter(e=>e.diff==="easy"),dm=cm.filter(e=>e.diff==="medium"||!e.diff),dh=cm.filter(e=>e.diff==="hard");
    const{easy=3,medium=2,hard=1}=dist;
    if((easy+medium+hard)===6&&de.length>=easy&&dm.length>=medium&&dh.length>=hard){
      return sh([...sh(de,seed).slice(0,easy),...sh(dm,seed*3).slice(0,medium),...sh(dh,seed*5).slice(0,hard),...sh(rr,seed*7).slice(0,3)],seed*13);
    }
  }
  return sh([...sh(cm,seed).slice(0,6),...sh(rr,seed*7).slice(0,3)],seed*13);
}

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

function useLongPress(onTap,onLongPress,ms=600){
  const t=useRef(null);
  const fired=useRef(false);
  const mouseDown=()=>{fired.current=false;t.current=setTimeout(()=>{fired.current=true;onLongPress();},ms);};
  const mouseUp=()=>clearTimeout(t.current);
  const mouseLeave=()=>clearTimeout(t.current);
  const click=()=>{if(!fired.current)onTap();fired.current=false;};
  const touchStart=e=>{e.preventDefault();fired.current=false;t.current=setTimeout(()=>{fired.current=true;onLongPress();},ms);};
  const touchEnd=()=>{clearTimeout(t.current);if(!fired.current)onTap();fired.current=false;};
  const touchCancel=()=>{clearTimeout(t.current);fired.current=false;};
  return{onMouseDown:mouseDown,onMouseUp:mouseUp,onMouseLeave:mouseLeave,onClick:click,onTouchStart:touchStart,onTouchEnd:touchEnd,onTouchCancel:touchCancel};
}

function confetti(n=60,accentColor=null){
  const root=document.getElementById("cf");if(!root)return;
  const base=["#e8380d","#22c55e","#38bdf8","#facc15","#a78bfa","#f97316","#fff"];
  const cols=accentColor?[accentColor,accentColor,"#fff",accentColor,...base]:base;
  for(let i=0;i<n;i++){
    const el=document.createElement("div");el.className="cf";
    Object.assign(el.style,{left:Math.random()*100+"vw",top:"-12px",
      background:cols[~~(Math.random()*cols.length)],
      animationDelay:Math.random()*.6+"s",animationDuration:1.5+Math.random()*1.5+"s",
      width:6+Math.random()*7+"px",height:6+Math.random()*7+"px",
      borderRadius:Math.random()>.5?"50%":"2px",transform:`rotate(${Math.random()*360}deg)`});
    root.appendChild(el);setTimeout(()=>el.remove(),3500);
  }
}

function shareUrl(id,name,col){
  let u=`${location.origin}${location.pathname}?join=${id}`;
  if(name)u+=`&name=${encodeURIComponent(name)}`;
  if(col)u+=`&col=${encodeURIComponent(col)}`;
  return u;
}

const DIAG_LINES=[[0,4,8],[2,4,6]];
function checkAch(player,ev,newC,newBL,newSlok,card){
  const ex=player.achievements||[],earn=[];
  const add=id=>{if(!ex.includes(id)&&!earn.includes(id))earn.push(id);};
  if(newC.reduce((a,b)=>a+b,0)===1) add("first_hit");
  if(ev.label==="180")         add("first_180");
  if(ev.label==="9 DART")      add("nine_dart");
  if(ev.label==="170 FINISH")  add("fish");
  if(ev.label==="BULL BULL")   add("bull_bull");
  if(newBL.length>0&&!ex.includes("first_bingo"))   add("first_bingo");
  if(newBL.length>=2&&!ex.includes("double_bingo"))  add("double_bingo");
  if(newBL.length>=3&&!ex.includes("triple_bingo"))  add("triple_bingo");
  if(newC.every(c=>c>0)&&!ex.includes("full_card"))  add("full_card");
  if(newSlok>=10&&!ex.includes("drink_10")) add("drink_10");
  if(newSlok>=20&&!ex.includes("drink_20")) add("drink_20");
  if(newSlok>=30&&!ex.includes("drink_30")) add("drink_30");
  if(!ex.includes("diagonal_bingo")&&DIAG_LINES.some(l=>l.every(i=>newC[i]>0))) add("diagonal_bingo");
  if(ev.label==="180"&&(newC[card?.findIndex(e=>e.label==="180")]||0)>=3) add("streak_180");
  if(newBL.length>0&&!ex.includes("speed_bingo")&&newC.filter(c=>c>0).length<=5) add("speed_bingo");
  if(!ex.includes("all_specials")&&card&&card.filter(e=>e.at).every((_,ii)=>{const cardIdx=card.findIndex((e,j)=>e.at&&[...card].filter(x=>x.at).indexOf(e)===ii);return newC[cardIdx]>0;})) {
    const rareCells=card.map((e,i)=>({e,i})).filter(({e})=>e.at);
    if(rareCells.every(({i})=>newC[i]>0)) add("all_specials");
  }
  if(!ex.includes("finisher")&&card){
    const finCount=card.filter((e,i)=>e.cat==="finish"&&newC[i]>0).length;
    if(finCount>=3) add("finisher");
  }
  return earn;
}

// ── Root (routing) ────────────────────────────────────────────────────────────
export function Root(){
  const path = typeof location !== "undefined" ? location.pathname.replace(/\/$/, "") : "";
  if (path === "/admin") return <AdminPanel />;
  return <App />;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App(){
  const [scr,    setScr]    = useState("lobby");
  const [sess,   setSess]   = useState(null);
  const [players,setPlayers]= useState([]);
  const [myCol,  setMyCol]  = useState(null);
  const [loading,setLoading]= useState(true);
  const [code,   setCode]   = useState("");
  const [error,  setError]  = useState("");
  const [S,      _setS]     = useState(loadS);
  const [chat,   setChat]   = useState([]);
  const [achT,   setAchT]   = useState(null);
  const [winData,setWinData]= useState(null);
  const [rematch,setRematch]= useState(null);

  const chRef = useRef(null);
  const SR    = useRef(S);

  const setS = s=>{ SR.current=s; _setS(s); saveS(s); };
  const upS  = p=>setS({...SR.current,...p});

  // Restore session / URL param
  useEffect(()=>{
    const p=new URLSearchParams(location.search);
    const j=p.get("join");
    if(j) setCode(j.trim());
    const pn=p.get("name");const pc=p.get("col");
    if(pn||pc){sessionStorage.setItem("db_prefill",JSON.stringify({name:pn||"",col:pc||""}));}
    const saved=sessionStorage.getItem("db_v3");
    if(saved){
      try{
        const{sid,col}=JSON.parse(saved);
        sb.from("bingo_sessions").select().eq("id",sid).single()
          .then(({data,error:e})=>{
            if(e||!data){sessionStorage.removeItem("db_v3");setLoading(false);return;}
            setSess(data); setMyCol(col);
            sb.from("bingo_players").select().eq("session_id",sid)
              .then(({data:r})=>{setPlayers(stripKicked(r));setScr("play");setLoading(false);})
              .catch(()=>setLoading(false));
          }).catch(()=>setLoading(false));
      }catch{sessionStorage.removeItem("db_v3");setLoading(false);}
    }else setLoading(false);
  },[]);

  // Realtime
  useEffect(()=>{
    if(!sess||!(scr==="play"||scr==="wait")){
      if(chRef.current){sb.removeChannel(chRef.current);chRef.current=null;}
      return;
    }
    const ch=sb.channel("db-"+sess.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"bingo_players",filter:`session_id=eq.${sess.id}`},({new:nr,old:or,eventType})=>{
        if(eventType==="DELETE"){setPlayers(p=>p.filter(x=>x.id!==or?.id));return;}
        if(nr.color===myCol&&nr.is_kicked){alert("Je bent verwijderd door de host.");leave();return;}
        // Never let realtime overwrite own player — local tap state is authoritative
        if(nr.color===myCol)return;
        setPlayers(prev=>{
          const i=prev.findIndex(p=>p.id===nr.id);
          if(nr.is_kicked){
            // Kicked player disappears for everyone immediately, not just themselves
            return i===-1?prev:prev.filter(p=>p.id!==nr.id);
          }
          if(i===-1)return[...prev,nr];
          if(prev[i].color===myCol)return prev;
          return(prev[i].version||0)<=(nr.version||0)?prev.map((p,ii)=>ii===i?nr:p):prev;
        });
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"bingo_chat",filter:`session_id=eq.${sess.id}`},({new:n})=>setChat(c=>[...c,n]))
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"bingo_sessions",filter:`id=eq.${sess.id}`},({new:ns})=>{
        setSess(ns);
        if(ns.status==="active"){
          setScr(s=>s==="wait"?"play":s);
        }
        if(ns.status==="finished"){
          addToHistory(ns,players);
          setWinData({players:[...players],sess:ns});
          setScr("winner"); sFanfare();
          const wp=[...players].sort((a,b)=>(b.total_slok||0)-(a.total_slok||0))[0];
          confetti(100,wp?COLORS[wp.color]?.a:null);
        }
      })
      .subscribe(s=>dbg("rt",s));
    chRef.current=ch;
    return()=>{sb.removeChannel(ch);chRef.current=null;};
  },[sess?.id,scr,myCol]);

  async function createSess(name,pool,pwd,gm){
    setLoading(true);setError("");
    try{
      const id=uid();
      let hashed="";
      if(pwd){
        const{data:h,error:eh}=await sb.rpc("hash_password",{p_pwd:pwd});
        if(eh)throw eh;
        hashed=h||"";
      }
      const{data,error:e}=await sb.from("bingo_sessions").insert({id,name,event_pool:pool,password:hashed,game_mode:gm||"slokken"}).select().single();
      if(e)throw e;
      setSess(data);setLoading(false);setScr("setup");
    }catch(e){err("create",e);setError("Kon sessie niet aanmaken: "+(e.message||e));setLoading(false);}
  }

  async function watchSess(code){
    setLoading(true);setError("");
    try{
      const{data:s,error:e1}=await sb.from("bingo_sessions").select().eq("id",code.trim().toLowerCase()).single();
      if(e1||!s)throw new Error("Sessie niet gevonden.");
      if(s.status==="finished")throw new Error("Deze sessie is al afgelopen.");
      setSess(s);setMyCol("spectator");
      const{data:r}=await sb.from("bingo_players").select().eq("session_id",s.id);
      setPlayers(stripKicked(r));
      setLoading(false);setScr("play");
    }catch(e){err("watch",e);setError(e.message);setLoading(false);}
  }

  async function joinSess(code,col,name,pwd,avatar){
    setLoading(true);setError("");
    try{
      const{data:s,error:e1}=await sb.from("bingo_sessions").select().eq("id",code.trim().toLowerCase()).single();
      if(e1||!s)throw new Error("Sessie niet gevonden. Controleer de code en probeer opnieuw.");
      if(s.status==="finished")throw new Error("Deze sessie is al afgelopen.");
      if(s.password){
        const{data:ok,error:ep}=await sb.rpc("check_session_password",{p_id:s.id,p_pwd:pwd||""});
        if(ep)throw ep;
        if(!ok)throw new Error("Verkeerd wachtwoord.");
      }
      const{data:ex}=await sb.from("bingo_players").select().eq("session_id",s.id).eq("color",col).maybeSingle();
      if(ex&&!ex.is_kicked){
        // Herjoinen: kleur al bezet — herstel bestaande speler-sessie
        setSess(s);setMyCol(col);
        const{data:rj}=await sb.from("bingo_players").select().eq("session_id",s.id);
        setPlayers(stripKicked(rj));
        sessionStorage.setItem("db_v3",JSON.stringify({sid:s.id,col}));
        setLoading(false);
        setScr(s.status==="active"?"play":"wait");
        return;
      }
      const pool=s.event_pool;
      const card=makeCard(pool,col,s.id);
      if(!card)throw new Error("Pool te klein (min. 6 gewone + 3 zeldzame vakjes).");
      const{error:e2}=await sb.from("bingo_players").insert({
        id:uid(),session_id:s.id,name:name||"Speler",color:col,
        avatar:avatar||"🎯",card,counts:Array(9).fill(0),total_slok:0,
        bingo_lines:[],log:[],version:0,achievements:[],round_data:[]
      });
      if(e2)throw e2;
      setSess(s);setMyCol(col);
      const{data:r}=await sb.from("bingo_players").select().eq("session_id",s.id);
      setPlayers(stripKicked(r));
      sessionStorage.setItem("db_v3",JSON.stringify({sid:s.id,col}));
      setLoading(false);
      setScr((!s.host_color||s.status==="waiting")?"wait":"play");
    }catch(e){err("join",e);setError(e.message);setLoading(false);}
  }

  async function startGame(pcs,playerCards={}){
    setLoading(true);setError("");
    try{
      const pool=sess.event_pool;
      if(!pool||pool.filter(e=>!e.at).length<6||pool.filter(e=>e.at).length<3)
        throw new Error("Pool te klein: min. 6 gewone + 3 zeldzame vakjes.");
      const cols=pcs.map(p=>p.color);
      if(new Set(cols).size!==cols.length)throw new Error("Dubbele kleur in spelerslijst.");
      for(const pc of pcs){
        const savedCard=playerCards[pc.color];
        const card=(savedCard&&savedCard.length===9)?savedCard:makeCard(pool,pc.color,sess.id,"",SR.current.cardDist);
        const card2=makeCard(pool,pc.color,sess.id,"_b",SR.current.cardDist);
        await sb.from("bingo_players").upsert({
          id:uid(),session_id:sess.id,name:pc.name,color:pc.color,
          avatar:pc.avatar||"🎯",team:pc.team||null,card,card2,
          counts:Array(9).fill(0),counts2:Array(9).fill(0),
          total_slok:0,bingo_lines:[],log:[],version:0,achievements:[],round_data:[]
        },{onConflict:"id"});
      }
      const hls=new Date().toISOString();
      await sb.from("bingo_sessions").update({host_color:pcs[0].color,status:"active",host_last_seen:hls}).eq("id",sess.id);
      setSess(s=>({...s,host_color:pcs[0].color,status:"active",host_last_seen:hls}));
      const{data:r}=await sb.from("bingo_players").select().eq("session_id",sess.id);
      setPlayers(stripKicked(r));
      setMyCol(pcs[0].color);
      sessionStorage.setItem("db_v3",JSON.stringify({sid:sess.id,col:pcs[0].color}));
      setLoading(false);setScr("play");
    }catch(e){err("start",e);setError(e.message);setLoading(false);}
  }

  async function upPool(np){
    await sb.from("bingo_sessions").update({event_pool:np}).eq("id",sess.id);
    setSess(s=>({...s,event_pool:np}));
  }

  async function kick(col){
    // Flag first so the kicked client's own realtime listener fires its alert,
    // then delete shortly after so the row disappears for everyone and the
    // color slot becomes joinable again.
    await sb.from("bingo_players").update({is_kicked:true}).eq("session_id",sess.id).eq("color",col);
    setPlayers(prev=>prev.filter(p=>p.color!==col));
    setTimeout(()=>{ sb.from("bingo_players").delete().eq("session_id",sess.id).eq("color",col); },300);
  }

  async function claimHost(col){
    await sb.from("bingo_sessions").update({host_color:col,host_last_seen:new Date().toISOString()}).eq("id",sess.id);
    setSess(s=>({...s,host_color:col,host_last_seen:new Date().toISOString()}));
  }

  async function nextRound(){
    const nr=(sess.round||1)+1;
    for(const p of players){
      const rd={round:sess.round||1,counts:p.counts,slok:p.total_slok,bingo_lines:p.bingo_lines};
      await sb.from("bingo_players").update({counts:Array(9).fill(0),counts2:Array(9).fill(0),bingo_lines:[],round_data:[...(p.round_data||[]),rd],version:(p.version||0)+1}).eq("id",p.id);
    }
    await sb.from("bingo_sessions").update({round:nr}).eq("id",sess.id);
    setSess(s=>({...s,round:nr}));
    setPlayers(prev=>prev.map(p=>({...p,counts:Array(9).fill(0),counts2:Array(9).fill(0),bingo_lines:[]})));
  }

  async function startBreak(mins){
    const until=new Date(Date.now()+mins*60000).toISOString();
    await sb.from("bingo_sessions").update({break_until:until}).eq("id",sess.id);
    setSess(s=>({...s,break_until:until}));
  }

  async function endBreak(){
    await sb.from("bingo_sessions").update({break_until:null}).eq("id",sess.id);
    setSess(s=>({...s,break_until:null}));
  }

  async function endGame(){
    await sb.from("bingo_sessions").update({status:"finished"}).eq("id",sess.id);
    addToHistory(sess,players);
    setWinData({players:[...players],sess:{...sess}});
    setScr("winner"); sFanfare();
    const wp=[...players].sort((a,b)=>(b.total_slok||0)-(a.total_slok||0))[0];
    confetti(100,wp?COLORS[wp.color]?.a:null);
  }

  async function sendChat(msg){
    const me=players.find(p=>p.color===myCol);
    await sb.from("bingo_chat").insert({id:uid(),session_id:sess.id,color:myCol,name:me?.name||myCol,message:msg});
  }

  function showAch(a){setAchT(a);sAch();setTimeout(()=>setAchT(null),3500);}

  function leave(){
    if(chRef.current){sb.removeChannel(chRef.current);chRef.current=null;}
    sessionStorage.removeItem("db_v3");
    setScr("lobby");setSess(null);setPlayers([]);setMyCol(null);setError("");setChat([]);setRematch(null);
  }

  async function doRematch(pcs){
    setLoading(true);setError("");
    try{
      const id=uid();
      const{data:ns,error:e}=await sb.from("bingo_sessions").insert({
        id,name:winData?.sess?.name||"Revanche",
        event_pool:winData?.sess?.event_pool||EVENTS,
        password:"",game_mode:S.gm||"slokken"
      }).select().single();
      if(e)throw e;
      setSess(ns);
      await startGame_inner(ns,pcs);
    }catch(e){err("rematch",e);setError(e.message);setLoading(false);}
  }

  async function startGame_inner(sessObj,pcs){
    const pool=sessObj.event_pool;
    for(const pc of pcs){
      const card=makeCard(pool,pc.color,sessObj.id,"",SR.current.cardDist);
      const card2=makeCard(pool,pc.color,sessObj.id,"_b",SR.current.cardDist);
      await sb.from("bingo_players").upsert({
        id:uid(),session_id:sessObj.id,name:pc.name,color:pc.color,
        avatar:pc.avatar||"🎯",team:pc.team||null,card,card2,
        counts:Array(9).fill(0),counts2:Array(9).fill(0),
        total_slok:0,bingo_lines:[],log:[],version:0,achievements:[],round_data:[]
      },{onConflict:"id"});
    }
    const hls=new Date().toISOString();
    await sb.from("bingo_sessions").update({host_color:pcs[0].color,status:"active",host_last_seen:hls}).eq("id",sessObj.id);
    setSess(s=>({...s,host_color:pcs[0].color,status:"active",host_last_seen:hls}));
    const{data:r}=await sb.from("bingo_players").select().eq("session_id",sessObj.id);
    setPlayers(stripKicked(r));
    setMyCol(pcs[0].color);
    sessionStorage.setItem("db_v3",JSON.stringify({sid:sessObj.id,col:pcs[0].color}));
    setLoading(false);setScr("play");
  }

  if(loading) return <Skel />;

  return (
    <>
      {achT&&(
        <div className="ach-toast">
          <div style={{fontSize:24,marginBottom:2}}>{achT.e}</div>
          <div style={{fontWeight:900,fontSize:13,color:"var(--or)"}}>{achT.lbl}</div>
          <div style={{fontSize:11,color:"var(--mu)",marginTop:1}}>{achT.d}</div>
        </div>
      )}
      {scr==="lobby" &&<Lobby  onNew={createSess} onJoin={joinSess} onWatch={watchSess} code={code} setCode={setCode} error={error} S={S} />}
      {scr==="setup" &&<Setup  sess={sess} onStart={startGame} onPool={upPool} onBack={()=>setScr("lobby")} error={error} S={S} />}
      {scr==="wait"  &&<WaitRoom sess={sess} players={players} myCol={myCol} onLeave={leave} />}
      {scr==="play"  &&<Play   sess={sess} players={players} myCol={myCol} setPlayers={setPlayers}
                          onBack={leave} S={S} upS={upS} chat={chat} onChat={sendChat}
                          onKick={kick} onNextRound={nextRound} onEnd={endGame} onAch={showAch}
                          onBreak={startBreak} onBreakEnd={endBreak} onPool={upPool} onClaimHost={claimHost} />}
      {scr==="winner"&&<Winner winData={winData} onBack={leave} onRematch={doRematch} S={S} />}
    </>
  );
}

// ── Wait Room ─────────────────────────────────────────────────────────────────
function WaitRoom({sess,players,myCol,onLeave}){
  const me=players.find(p=>p.color===myCol);
  const t=COLORS[myCol]||COLORS.rood;
  const [dots,setDots]=useState(".");
  useEffect(()=>{const iv=setInterval(()=>setDots(d=>d.length>=3?".":d+"."),600);return()=>clearInterval(iv);},[]);
  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",gap:20}}>
      <div style={{width:70,height:70,borderRadius:"50%",border:`3px solid ${t.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,background:t.cell,boxShadow:`0 2px 16px ${t.a}44`}}>
        {me?.avatar||"🎯"}
      </div>
      <div style={{textAlign:"center"}}>
        <div className="anto" style={{fontSize:"clamp(1.8rem,8vw,2.8rem)",color:"var(--dk)",lineHeight:.95,marginBottom:8}}>WACHTEN OP<br/><span style={{color:t.a}}>HOST</span></div>
        <div style={{fontSize:13,color:"var(--mu)",marginTop:4}}>De host is de kaarten aan het instellen{dots}</div>
      </div>
      <div style={{background:"#fff",border:"1.5px solid var(--bd)",borderRadius:16,padding:"16px 20px",width:"100%",maxWidth:360,boxShadow:"var(--sh)"}}>
        <div className="neon-lbl" style={{marginBottom:10}}>IN DE WACHTKAMER ({players.length})</div>
        {players.map(p=>{
          const c=COLORS[p.color]||COLORS.rood;
          return(
            <div key={p.color} className="p-row" style={{animation:"playerDrop .4s ease-out both"}}>
              <div className="p-av" style={{borderColor:c.a,background:c.cell}}>{p.avatar||"🎯"}</div>
              <div style={{flex:1,fontWeight:800,color:p.color===myCol?c.a:"var(--dk)"}}>{p.name||p.color}{p.color===myCol?" (jij)":""}</div>
              <span className="pill-ready">● klaar</span>
            </div>
          );
        })}
      </div>
      <div style={{background:"#fff",border:"1.5px solid var(--bd)",borderRadius:12,padding:"12px 18px",textAlign:"center",boxShadow:"var(--sh-sm)"}}>
        <div className="neon-lbl" style={{marginBottom:4}}>GAME CODE</div>
        <div className="game-code-big">{sess.id}</div>
      </div>
      <button onClick={onLeave} style={{padding:"10px 24px",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:10,color:"var(--mu)",fontWeight:800,fontSize:13,cursor:"pointer"}}>← Verlaten</button>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel({onJoin,setCode}){
  const [hist,setHist]=useState(()=>loadHistory());
  const [open,setOpen]=useState(null);
  if(!hist.length)return null;
  const fmt=d=>{try{const dt=new Date(d);return dt.toLocaleDateString("nl-NL",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}catch{return"";} };
  return(
    <div style={{marginTop:20}}>
      <div className="neon-lbl" style={{marginBottom:10}}>RECENTE SESSIES</div>
      {hist.map((h,idx)=>{
        const win=h.players?.[0];
        const wc=win?COLORS[win.color]||COLORS.rood:COLORS.rood;
        const isOpen=open===idx;
        return(
          <div key={h.id} style={{background:"#fff",border:"1.5px solid var(--bd)",borderRadius:14,marginBottom:8,overflow:"hidden",boxShadow:"var(--sh-sm)"}}>
            <button onClick={()=>setOpen(isOpen?null:idx)} style={{width:"100%",background:"none",border:"none",padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:18}}>{win?.avatar||"🎯"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:800,color:"var(--dk)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                <div style={{fontSize:10,color:"var(--mu)"}}>{fmt(h.date)} · {h.players?.length||0} spelers · R{h.round}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:12,fontWeight:800,color:wc.a}}>{win?.name}</div>
                <div style={{fontSize:10,color:"var(--mu)"}}>{win?.slok||0} {h.mode==="punten"?"🏆":"🍺"}</div>
              </div>
              <span style={{color:"var(--mu)",fontSize:14,marginLeft:4}}>{isOpen?"▲":"▼"}</span>
            </button>
            {isOpen&&(
              <div style={{borderTop:"1px solid var(--bd)",padding:"10px 14px",background:"var(--gr-bg)"}}>
                {h.players?.map((p,i)=>{const c=COLORS[p.color]||COLORS.rood;return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",fontSize:12}}>
                    <span style={{fontSize:14}}>{p.avatar}</span>
                    <span style={{color:c.a,fontWeight:700,minWidth:80}}>{p.name}</span>
                    <span style={{color:"var(--mu)",flex:1}}>{p.slok} {h.mode==="punten"?"🏆":"🍺"} · 🏆{p.bingos} · 🏅{p.achs}</span>
                  </div>
                );}) }
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button onClick={()=>{setCode(h.id);}} style={{flex:1,padding:"8px 0",background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:9,color:"var(--gr-dk)",fontSize:12,fontWeight:800,cursor:"pointer"}}>
                    🔗 Code kopiëren
                  </button>
                  <button onClick={()=>setHist(hh=>{const n=hh.filter((_,ii)=>ii!==idx);saveHistory(n);return n;})} style={{padding:"8px 12px",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:9,color:"var(--mu)",fontSize:12,cursor:"pointer"}}>🗑️</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skel(){
  return(
    <div style={{padding:20,maxWidth:460,margin:"0 auto",paddingTop:60}}>
      <div className="sk" style={{height:38,width:200,marginBottom:10}} />
      <div className="sk" style={{height:18,width:140,marginBottom:32}} />
      <div className="sk" style={{height:48,marginBottom:10}} />
      <div className="sk" style={{height:48,marginBottom:24}} />
      <div className="grid">{Array(9).fill(0).map((_,i)=><div key={i} className="sk" style={{height:92}} />)}</div>
    </div>
  );
}

// ── Lobby ─────────────────────────────────────────────────────────────────────
function Lobby({onNew,onJoin,onWatch,code,setCode,error,S}){
  const prefill=(()=>{try{const s=sessionStorage.getItem("db_prefill");return s?JSON.parse(s):{};}catch{return{};}})();
  const [tab,   setTab]  = useState(code?"join":"new");
  const [name,  setName] = useState("Dart Avond");
  const [pwd,   setPwd]  = useState("");
  const [gm,    setGm]   = useState(S.gm||"slokken");
  const [jName, setJName]= useState(prefill.name||"");
  const [jCol,  setJCol] = useState(prefill.col&&COLORS[prefill.col]?prefill.col:"rood");
  const [jAv,   setJAv]  = useState("🎯");
  const [jPwd,  setJPwd] = useState("");
  const [busy,  setBusy] = useState(false);
  const [showP, setShowP]= useState(false);
  const [showAuth,setShowAuth]=useState(false);

  async function doNew(){ setBusy(true); await onNew(name||"Dart Avond",EVENTS,pwd,gm); setBusy(false); }
  async function doJoin(){ setBusy(true); await onJoin(code,jCol,jName||"Speler",jPwd,jAv); setBusy(false); }
  async function doWatch(){ setBusy(true); await onWatch(code); setBusy(false); }

  const inp = {className:"inp",style:{marginBottom:12}};

  const colC = COLORS[jCol]||COLORS.rood;

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",padding:"0 0 40px"}}>
      {/* App header */}
      <div style={{padding:"18px 20px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#149a4d 40%,#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 2px 12px rgba(20,154,77,.3)"}}>🎯</div>
          <div style={{lineHeight:1}}>
            <div className="anto" style={{fontSize:18,color:"var(--dk)"}}>DART</div>
            <div className="anto" style={{fontSize:18,color:"var(--gr)"}}>BINGO</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setShowAuth(true)} style={{border:"1.5px solid var(--bd)",background:"#fff",borderRadius:20,padding:"5px 12px",fontSize:12,color:"var(--mu)",fontWeight:700,cursor:"pointer"}}>🔐 Account</button>
          <div style={{border:"1.5px solid var(--gr)",borderRadius:20,padding:"5px 14px",fontSize:12,color:"var(--gr)",display:"flex",alignItems:"center",gap:7,fontWeight:700,background:"var(--gr-lt)"}}>
            <span className="live-dot" />live
          </div>
        </div>
      </div>

      <div style={{padding:"0 20px",flex:1,maxWidth:440,width:"100%",margin:"0 auto"}}>
        {/* Hero section */}
        <div style={{marginBottom:20}}>
          <div className="neon-lbl" style={{marginBottom:8}}>AVOND BIJ DE GOUDEN PIJL</div>
          {tab==="new"
            ? <div className="anto" style={{fontSize:"clamp(2.4rem,11vw,3.8rem)",lineHeight:.92,marginBottom:10,color:"var(--dk)"}}>MAAK EEN<br/>NIEUW SPEL</div>
            : <div className="anto" style={{fontSize:"clamp(2.4rem,11vw,3.8rem)",lineHeight:.92,marginBottom:10,color:"var(--dk)"}}>IEDEREEN<br/>AAN DE<br/>OCHE?</div>
          }
          <div style={{fontSize:13,color:"var(--mu)",lineHeight:1.6}}>
            {tab==="new"
              ? "Maak een sessie aan en deel de code met vrienden."
              : "Deel de code, kies je kleur en vink dartmomenten af. Volle rij = bingo = anderen drinken."
            }
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:"#fff",borderRadius:12,padding:4,marginBottom:20,border:"1.5px solid var(--bd)",boxShadow:"var(--sh-sm)"}}>
          {[["new","🆕 NIEUW"],["join","🔗 JOIN"],["watch","👁️ KIJK"]].map(([t,lbl])=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"10px 0",borderRadius:9,background:tab===t?"var(--gr)":"transparent",color:tab===t?"#fff":"var(--mu)",border:"none",fontWeight:900,fontSize:12,letterSpacing:.5,transition:"all .15s"}}>
              {lbl}
            </button>
          ))}
        </div>

        {tab==="new" ? (
          <div style={{background:"#fff",borderRadius:18,padding:"20px 18px",border:"1.5px solid var(--bd)",boxShadow:"var(--sh)"}}>
            <div className="neon-lbl" style={{marginBottom:8}}>SESSIE NAAM</div>
            <input {...inp} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doNew()} style={{...inp.style,display:"block",width:"100%",background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:10,padding:"12px 14px",color:"var(--dk)",fontSize:16,fontWeight:700}} />
            <div className="neon-lbl" style={{marginBottom:8}}>SPELMODUS</div>
            <div style={{display:"flex",gap:6,marginBottom:16}}>
              {[["slokken","🍺"],["punten","🏆"]].map(([m,em])=>(
                <button key={m} onClick={()=>setGm(m)} style={{flex:1,padding:"10px 0",borderRadius:10,border:`2px solid ${gm===m?"var(--gr)":"var(--bd)"}`,background:gm===m?"var(--gr-lt)":"transparent",color:gm===m?"var(--gr-dk)":"var(--mu)",fontWeight:900,fontSize:13}}>
                  {em} {m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
            </div>
            <div className="neon-lbl" style={{marginBottom:8}}>WACHTWOORD <span style={{color:"var(--bd)"}}>(optioneel)</span></div>
            <div style={{position:"relative",marginBottom:20}}>
              <input value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Leeg = geen wachtwoord" type={showP?"text":"password"} style={{display:"block",width:"100%",background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:10,padding:"12px 44px 12px 14px",color:"var(--dk)",fontSize:14}} />
              <button onClick={()=>setShowP(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--mu)",fontSize:16,padding:0}}>{showP?"🙈":"👁️"}</button>
            </div>
            <Btn onClick={doNew} loading={busy} color="var(--gr)">MAAK SESSIE AAN →</Btn>
            <div style={{textAlign:"center",fontSize:12,color:"var(--mu)",marginTop:10}}>Jij bent de host — deel de code met vrienden</div>
          </div>
        ) : (
          <>
            {/* Profile preview card */}
            <div style={{background:"#fff",borderRadius:16,padding:"16px 20px",marginBottom:16,border:"1.5px solid var(--bd)",boxShadow:"var(--sh-sm)",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:58,height:58,borderRadius:"50%",border:`3px solid ${colC.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,background:colC.cell,boxShadow:`0 2px 10px ${colC.a}44`,flexShrink:0}}>
                {jAv}
              </div>
              <div>
                <div style={{fontWeight:900,fontSize:18,lineHeight:1,color:"var(--dk)"}}>{jName||"JIJ"}</div>
                <div className="neon-lbl" style={{marginTop:4,color:colC.a}}>{colC.lbl.split(" ")[1]||"ROOD"} TEAM</div>
              </div>
            </div>

            <div style={{background:"#fff",borderRadius:18,padding:"20px 18px",border:"1.5px solid var(--bd)",boxShadow:"var(--sh)"}}>
              <div className="neon-lbl" style={{marginBottom:8}}>SESSIE CODE</div>
              <input value={code} onChange={e=>setCode(e.target.value.trim().toLowerCase())} placeholder="bijv. abc12xyz" style={{display:"block",width:"100%",background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:10,padding:"12px 14px",color:"var(--gr-dk)",fontSize:20,fontWeight:900,letterSpacing:4,marginBottom:16,textTransform:"lowercase"}} />

              <div className="neon-lbl" style={{marginBottom:8}}>JOUW NAAM</div>
              <input value={jName} onChange={e=>setJName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doJoin()} placeholder="Naam..." style={{display:"block",width:"100%",background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:10,padding:"12px 14px",color:"var(--dk)",fontSize:15,fontWeight:700,marginBottom:16}} />

              <div className="neon-lbl" style={{marginBottom:10}}>TEAMKLEUR</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}}>
                {Object.entries(COLORS).map(([k,c])=>(
                  <button key={k} onClick={()=>setJCol(k)} style={{width:36,height:36,borderRadius:"50%",background:c.a,border:`3px solid ${jCol===k?"var(--dk)":"transparent"}`,cursor:"pointer",transition:"border-color .12s",boxShadow:jCol===k?`0 0 10px ${c.a}88`:"none"}} title={c.lbl} />
                ))}
              </div>

              <div className="neon-lbl" style={{marginBottom:10}}>AVATAR</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
                {AVATARS.slice(0,8).map(a=>(
                  <button key={a} onClick={()=>setJAv(a)} style={{width:42,height:42,fontSize:20,background:jAv===a?"var(--gr-lt)":"var(--gr-bg)",border:`2px solid ${jAv===a?"var(--gr)":"var(--bd)"}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{a}</button>
                ))}
              </div>

              <div style={{position:"relative",marginBottom:20}}>
                <input value={jPwd} onChange={e=>setJPwd(e.target.value)} placeholder="Wachtwoord (indien vereist)" type={showP?"text":"password"} style={{display:"block",width:"100%",background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:10,padding:"12px 44px 12px 14px",color:"var(--dk)",fontSize:14}} />
                <button onClick={()=>setShowP(x=>!x)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--mu)",fontSize:16,padding:0}}>{showP?"🙈":"👁️"}</button>
              </div>
              <Btn onClick={doJoin} loading={busy} color="var(--gr)">Klaar — naar de kaart →</Btn>
            </div>
          </>
        )}
        {tab==="watch"&&(
          <div style={{background:"#fff",borderRadius:18,padding:"20px 18px",border:"1.5px solid var(--bd)",boxShadow:"var(--sh)"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:38,marginBottom:8}}>👁️</div>
              <div style={{fontWeight:900,fontSize:16,marginBottom:4,color:"var(--dk)"}}>Meekijken zonder te spelen</div>
              <div style={{fontSize:12,color:"var(--mu)",lineHeight:1.6}}>Je ziet alle kaarten live maar tikt zelf niets aan. Geen speler-record aangemaakt.</div>
            </div>
            <div className="neon-lbl" style={{marginBottom:8}}>SESSIE CODE</div>
            <input value={code} onChange={e=>setCode(e.target.value.trim().toLowerCase())} placeholder="bijv. abc12xyz" style={{display:"block",width:"100%",background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:10,padding:"12px 14px",color:"var(--gr-dk)",fontSize:20,fontWeight:900,letterSpacing:4,marginBottom:20,textTransform:"lowercase"}} />
            <Btn onClick={doWatch} loading={busy} color="var(--b)">👁️ Meekijken →</Btn>
          </div>
        )}
        {error&&<div style={{color:"#c0392b",fontSize:13,marginTop:12,background:"#fff5f5",border:"1px solid #fbbfbf",borderRadius:8,padding:"10px 14px",animation:"fadeUp .2s"}}>⚠️ {error}</div>}
        <HistoryPanel setCode={setCode} />
      </div>
      {showAuth&&<AuthSheet onClose={()=>setShowAuth(false)} />}
    </div>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────
function Setup({sess,onStart,onPool,onBack,error,S}){
  const [pool,  setPool] = useState(sess.event_pool);
  const [pls,   setPls]  = useState([{color:"rood",name:"Speler 1",avatar:"🎯",team:null}]);
  const [tab,   setTab]  = useState(S.dTab||"players");
  const [editI, setEditI]= useState(null);
  const [addEv, setAddEv]= useState(false);
  const [newEv, setNewEv]= useState({label:"",slok:1,at:false,emoji:"🎯",cat:"score"});
  const [busy,  setBusy] = useState(false);
  const [lerr,  setLerr] = useState("");
  const [qr,    setQr]   = useState(false);
  const [copied,setCopied]= useState(false);
  const [playerCards, setPlayerCards] = useState({});
  const [cardEditP, setCardEditP] = useState(null);

  const used=pls.map(p=>p.color);
  const poolOk=pool.filter(e=>!e.at).length>=6&&pool.filter(e=>e.at).length>=3;
  const url=shareUrl(sess.id);

  function upPool2(np){setPool(np);onPool(np);}
  async function doStart(){
    setLerr("");
    if(!poolOk){setLerr("Pool te klein (min. 6 gewone + 3 zeldzame vakjes).");return;}
    if(pls.length<S.minP){setLerr(`Minimaal ${S.minP} speler(s) vereist.`);return;}
    setBusy(true);await onStart(pls,playerCards);setBusy(false);
  }
  function copy(){navigator.clipboard?.writeText(sess.id);setCopied(true);setTimeout(()=>setCopied(false),2000);}

  const catMap={};
  pool.forEach((ev,i)=>{const c=ev.cat||"score";if(!catMap[c])catMap[c]=[];catMap[c].push({ev,i});});

  return(
    <>
    <div style={{minHeight:"100vh",background:"var(--bg)",padding:"0 0 32px"}}>
      {/* Header */}
      <div style={{padding:"14px 16px 12px",borderBottom:"1.5px solid var(--bd)",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,background:"var(--bg)",zIndex:10}}>
        <button onClick={onBack} style={{background:"#fff",border:"1.5px solid var(--bd)",borderRadius:10,width:38,height:38,fontSize:20,color:"var(--mu)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"var(--sh-sm)"}}>‹</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,var(--gr),#22c55e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎯</div>
            <div className="anto" style={{fontSize:16,color:"var(--dk)"}}>DART</div>
            <div className="anto" style={{fontSize:16,color:"var(--gr)"}}>BINGO</div>
          </div>
          <div style={{fontSize:11,color:"var(--mu)",marginTop:2}}>{sess.name} · {sess.game_mode==="punten"?"🏆 Punten":"🍺 Slokken"}</div>
        </div>
        <div style={{border:"1.5px solid var(--gr)",borderRadius:20,padding:"4px 12px",fontSize:11,color:"var(--gr)",display:"flex",alignItems:"center",gap:6,fontWeight:700,background:"var(--gr-lt)"}}>
          <span className="live-dot" style={{width:6,height:6}} />live
        </div>
      </div>

      <div style={{padding:"14px 16px",maxWidth:460,margin:"0 auto"}}>
        {/* Session code — prominent */}
        <div style={{background:"#fff",border:"1.5px solid var(--bd)",borderRadius:16,padding:"16px 20px",marginBottom:16,boxShadow:"var(--sh)"}}>
          <div className="neon-lbl" style={{marginBottom:8}}>GAME-CODE</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div className="game-code-big">{sess.id}</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setQr(x=>!x)} style={{background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:8,padding:"8px 12px",color:"var(--gr-dk)",fontSize:12,fontWeight:800}}>⬛ QR</button>
              <button onClick={copy} style={{background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:8,padding:"8px 12px",color:copied?"var(--gr)":"var(--gr-dk)",fontSize:12,fontWeight:800}}>{copied?"✓":"📋"}</button>
              <button onClick={()=>{if(navigator.share)navigator.share({title:"Dart Bingo",url});else navigator.clipboard?.writeText(url);}} style={{background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:8,padding:"8px 12px",color:"var(--gr-dk)",fontSize:12,fontWeight:800}}>🔗</button>
            </div>
          </div>
          {qr&&<div style={{textAlign:"center",paddingTop:14}}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=180x180&bgcolor=f0f7ef&color=0e6e37&margin=10`} style={{borderRadius:10,width:150,border:"1.5px solid var(--bd)"}} alt="QR" />
            <div style={{fontSize:11,color:"var(--mu)",marginTop:6}}>Scan om direct te joinen</div>
          </div>}
        </div>

        {/* Tabs */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:"#fff",borderRadius:12,padding:4,marginBottom:16,border:"1.5px solid var(--bd)",boxShadow:"var(--sh-sm)"}}>
          {[["players","👥 Spelers"],["pool","🎯 Vakjes"]].map(([t,lbl])=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"9px 0",borderRadius:9,background:tab===t?"var(--gr)":"transparent",color:tab===t?"#fff":"var(--mu)",border:"none",fontWeight:900,fontSize:12}}>
              {lbl}
            </button>
          ))}
        </div>

        {tab==="players"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div className="neon-lbl">IN DE WACHTRUIMTE</div>
              <div style={{fontSize:12,color:"var(--mu)",fontWeight:700}}>{pls.length}/{S.maxP}</div>
            </div>
            {pls.map((p,i)=>{
              const pc=COLORS[p.color]||COLORS.rood;
              return(
              <div key={i} style={{background:"#fff",border:`1.5px solid ${i===0?pc.a+"66":pc.bd}`,borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"var(--sh-sm)"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div className="p-av" style={{borderColor:pc.a,background:pc.cell,fontSize:22}}>{p.avatar||"🎯"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <input value={p.name} onChange={e=>setPls(ps=>ps.map((pp,ii)=>ii===i?{...pp,name:e.target.value}:pp))}
                      placeholder="Naam..." style={{background:"transparent",border:"none",borderBottom:`1.5px solid ${pc.bd}`,color:"var(--dk)",fontSize:16,fontWeight:800,padding:"2px 0",outline:"none",width:"100%"}} />
                    <div style={{fontSize:10,color:pc.a,marginTop:3,letterSpacing:1,fontWeight:700}}>{pc.lbl.split(" ")[1]?.toUpperCase()}</div>
                  </div>
                  {i===0
                    ? <span className="pill-host">host</span>
                    : <button onClick={()=>setPls(ps=>ps.filter((_,ii)=>ii!==i))} style={{background:"transparent",border:"none",color:"#e03030",fontSize:16,padding:0,lineHeight:1}}>✕</button>
                  }
                </div>
                {/* Color selector */}
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {Object.entries(COLORS).map(([k,c])=>(
                    <button key={k} onClick={()=>setPls(ps=>ps.map((pp,ii)=>ii===i?{...pp,color:k}:pp))}
                      disabled={used.includes(k)&&k!==p.color}
                      style={{width:26,height:26,borderRadius:"50%",background:c.a,border:`3px solid ${p.color===k?"var(--dk)":"transparent"}`,opacity:used.includes(k)&&k!==p.color?.35:1,cursor:used.includes(k)&&k!==p.color?"not-allowed":"pointer",transition:"border-color .12s"}} />
                  ))}
                </div>
                {/* Avatar selector */}
                <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                  {AVATARS.slice(0,8).map(a=>(
                    <button key={a} onClick={()=>setPls(ps=>ps.map((pp,ii)=>ii===i?{...pp,avatar:a}:pp))}
                      style={{width:32,height:32,fontSize:16,background:p.avatar===a?"var(--gr-lt)":"transparent",border:`1.5px solid ${p.avatar===a?"var(--gr)":"transparent"}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>{a}</button>
                  ))}
                  <div style={{display:"flex",gap:4,alignItems:"center",marginLeft:"auto"}}>
                    <span style={{fontSize:10,color:"var(--mu)"}}>Team</span>
                    {[null,"A","B"].map(t=>(
                      <button key={String(t)} onClick={()=>setPls(ps=>ps.map((pp,ii)=>ii===i?{...pp,team:t}:pp))}
                        style={{width:26,height:26,borderRadius:7,border:`1.5px solid ${p.team===t?"var(--or)":"var(--bd)"}`,background:p.team===t?"var(--or-lt)":"transparent",color:p.team===t?"var(--or)":"var(--mu)",fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {t===null?"–":t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Voorspellingen per speler */}
                <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${pc.bd}`}}>
                  {i===0&&<div style={{fontSize:10,color:"var(--or)",letterSpacing:2,fontWeight:900,marginBottom:6}}>👑 JOUW KAART — vul hieronder jouw voorspellingen in</div>}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <button onClick={()=>setCardEditP(p.color)} style={{flex:1,padding:"9px 12px",background:playerCards[p.color]?"var(--gr-lt)":"var(--gr-bg)",border:`1.5px solid ${playerCards[p.color]?"var(--gr)":"var(--bd)"}`,borderRadius:9,color:playerCards[p.color]?"var(--gr-dk)":"var(--mu)",fontSize:12,fontWeight:800,cursor:"pointer",textAlign:"left"}}>
                      🎯 {playerCards[p.color]?"Voorspellingen ingesteld ✓ — bekijk kaart":"Voorspellingen instellen / kaart bekijken"}
                    </button>
                    {playerCards[p.color]&&<button onClick={()=>setPlayerCards(pc=>({...pc,[p.color]:null}))} style={{padding:"9px 10px",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:9,color:"#e03030",fontSize:12,cursor:"pointer"}}>✕</button>}
                  </div>
                  {!playerCards[p.color]&&<div style={{fontSize:10,color:"var(--mu)",marginTop:5}}>Klik om de 9 vakjes op de kaart te kiezen — of laat willekeurig genereren</div>}
                </div>
              </div>
              );
            })}
            {pls.length<S.maxP&&(
              <button onClick={()=>{const free=Object.keys(COLORS).find(c=>!used.includes(c));if(free)setPls(ps=>[...ps,{color:free,name:`Speler ${ps.length+1}`,avatar:"🎯",team:null}]);}} style={{width:"100%",padding:"12px 0",background:"transparent",border:"1.5px dashed var(--bd)",borderRadius:12,color:"var(--mu)",fontWeight:800,fontSize:13,marginBottom:14}}>
                + Speler toevoegen
              </button>
            )}
            {!poolOk&&<div style={{background:"var(--or-lt)",border:"1px solid var(--or)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"var(--or)",marginBottom:12}}>⚠️ Pool heeft min. 6 gewone + 3 zeldzame vakjes nodig. Ga naar "Vakjes".</div>}
            {(lerr||error)&&<div style={{background:"#fff5f5",border:"1px solid #fbbfbf",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#e03030",marginBottom:12}}>⚠️ {lerr||error}</div>}
            <Btn onClick={doStart} loading={busy} color="var(--gr)" disabled={!poolOk}>🎯 START SPEL →</Btn>
          </>
        )}

        {tab==="pool"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:12,color:"var(--mu)"}}>{pool.length} vakjes · {pool.filter(e=>!e.at).length} gewoon · {pool.filter(e=>e.at).length} zeldzaam</div>
              <div style={{fontSize:12,color:poolOk?"var(--gr)":"var(--or)",fontWeight:800}}>{poolOk?"✓ Pool OK":"⚠️ Te klein"}</div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              {Object.entries(DIFFS).map(([k,{lbl,c}])=>{
                const cnt=pool.filter(e=>!e.at&&e.diff===k).length;
                return <div key={k} style={{padding:"4px 10px",borderRadius:8,background:c+"22",border:`1px solid ${c}66`,fontSize:11,color:c,fontWeight:700}}>{lbl}: {cnt}</div>;
              })}
              <div style={{padding:"4px 10px",borderRadius:8,background:"var(--gr-lt)",border:"1.5px solid var(--gr)",fontSize:11,color:"var(--gr-dk)",fontWeight:700}}>Zeldzaam: {pool.filter(e=>e.at).length}</div>
            </div>
            {Object.entries(CATS).map(([cat,{lbl,c}])=>{
              const items=catMap[cat]||[];
              if(!items.length)return null;
              return(
                <div key={cat} style={{marginBottom:16}}>
                  <div style={{fontSize:10,color:c,letterSpacing:2,fontWeight:900,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:c,display:"inline-block"}} />{lbl.toUpperCase()} ({items.length})
                  </div>
                  {items.map(({ev,i})=>(
                    <div key={ev.id||i}>
                      {editI===i
                        ?<EvForm ev={ev} onSave={e=>{upPool2(pool.map((ee,ii)=>ii===i?{...ee,...e}:ee));setEditI(null);}} onCancel={()=>setEditI(null)} />
                        :(
                          <div style={{background:"#fff",border:`1.5px solid ${ev.at?"var(--gr)":"var(--bd)"}`,borderRadius:10,padding:"10px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10,boxShadow:"var(--sh-sm)"}}>
                            <span style={{fontSize:20}}>{ev.emoji}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:800,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--dk)"}}>{ev.label}</div>
                              <div style={{fontSize:12,color:ev.at?"var(--gr)":"var(--mu)",marginTop:1,display:"flex",alignItems:"center",gap:6}}>
                                {ev.at?`🍻 Iedereen ${ev.slok}×`:`${ev.slok} slok`}
                                {!ev.at&&ev.diff&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:5,background:DIFFS[ev.diff]?.c+"22",color:DIFFS[ev.diff]?.c,fontWeight:800}}>{DIFFS[ev.diff]?.lbl}</span>}
                              </div>
                            </div>
                            <button onClick={()=>setEditI(i)} style={{background:"var(--gr-bg)",border:"1px solid var(--bd)",borderRadius:7,width:32,height:32,color:"var(--mu)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
                            <button onClick={()=>upPool2(pool.filter((_,ii)=>ii!==i))} style={{background:"#fff5f5",border:"1px solid #fbbfbf",borderRadius:7,width:32,height:32,color:"#e03030",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                          </div>
                        )
                      }
                    </div>
                  ))}
                </div>
              );
            })}
            {addEv
              ?<EvForm ev={newEv} onChange={setNewEv} isNew onSave={e=>{if(!e.label.trim())return;upPool2([...pool,{id:uid(),...e}]);setNewEv({label:"",slok:1,at:false,emoji:"🎯",cat:"score"});setAddEv(false);}} onCancel={()=>setAddEv(false)} />
              :<button onClick={()=>setAddEv(true)} style={{width:"100%",padding:"12px 0",background:"transparent",border:"1.5px dashed var(--gr)",borderRadius:12,color:"var(--gr)",fontWeight:800,fontSize:13}}>+ Vakje toevoegen</button>
            }
          </>
        )}
      </div>
    </div>
    {cardEditP&&(
      <CardPicker
        pool={pool}
        value={playerCards[cardEditP]||[]}
        playerName={pls.find(p=>p.color===cardEditP)?.name||cardEditP}
        playerColor={cardEditP}
        sessId={sess.id}
        dist={S.cardDist}
        onSave={sel=>setPlayerCards(pc=>({...pc,[cardEditP]:sel}))}
        onClose={()=>setCardEditP(null)}
      />
    )}
    </>
  );
}

// ── Card Picker (voorspellingen per speler) ───────────────────────────────────
function CardPicker({pool,value,playerName,playerColor,sessId,onSave,onClose,dist=null}){
  const [sel,setSel]=useState(()=>value&&value.length===9?value:makeCard(pool,playerColor,sessId,"",dist)||[]);
  const [showC2,setShowC2]=useState(false);
  const card2Prev=makeCard(pool,playerColor,sessId,"_b",dist)||[];
  const reg=pool.filter(e=>!e.at);
  const rare=pool.filter(e=>e.at);
  const selReg=sel.filter(e=>!e.at);
  const selRare=sel.filter(e=>e.at);

  function toggle(ev){
    if(sel.some(e=>e.id===ev.id)){setSel(sel.filter(e=>e.id!==ev.id));return;}
    if(ev.at&&selRare.length>=3)return;
    if(!ev.at&&selReg.length>=6)return;
    setSel([...sel,ev]);
  }
  function removeSlot(i){setSel(sel.filter((_,ii)=>ii!==i));}
  function randomize(){
    const card=makeCard(pool,playerColor||"rood",sessId+"_rnd_"+uid(),"",dist);
    if(card)setSel(card);
  }

  const valid=selReg.length===6&&selRare.length===3;

  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="sheet">
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
          <div>
            <div style={{fontWeight:900,fontSize:16,color:"var(--dk)"}}>🎯 Kaart van {playerName}</div>
            <div style={{fontSize:11,color:"var(--mu)",marginTop:2}}>Selecteer 6 gewone + 3 zeldzame vakjes</div>
          </div>
          <button onClick={onClose} style={{background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:9,width:34,height:34,color:"var(--mu)",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
        </div>

        {/* Card preview */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"14px 0 8px"}}>
          <div style={{fontSize:10,color:"var(--or)",letterSpacing:2,fontWeight:900}}>KAARTPREVIEW ({sel.length}/9)</div>
          <button onClick={randomize} style={{fontSize:11,background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:8,padding:"4px 10px",color:"var(--gr-dk)",cursor:"pointer",fontWeight:700}}>🎲 Willekeurig</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:16}}>
          {Array(9).fill(null).map((_,i)=>{
            const ev=sel[i];
            return ev?(
              <button key={i} onClick={()=>removeSlot(i)}
                style={{background:ev.at?"#fff5f5":"var(--gr-bg)",border:`1.5px solid ${ev.at?"var(--r)":"var(--bd)"}`,borderRadius:10,padding:"7px 4px",textAlign:"center",minHeight:70,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,cursor:"pointer",position:"relative"}}>
                <div style={{position:"absolute",top:3,right:4,fontSize:9,color:"var(--mu)",lineHeight:1}}>✕</div>
                <div style={{fontSize:20}}>{ev.emoji}</div>
                <div style={{fontSize:ev.label?.length>7?8:9,fontWeight:900,color:ev.at?"var(--r)":"var(--dk)",lineHeight:1.2,padding:"0 2px"}}>{ev.label}</div>
                <div style={{fontSize:8,color:ev.at?"var(--r)":"var(--mu)"}}>{ev.at?"🍻":"🍺"}{ev.slok}</div>
              </button>
            ):(
              <div key={i} style={{background:"var(--gr-bg)",border:"1.5px dashed var(--bd)",borderRadius:10,minHeight:70,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--bd)",fontSize:24}}>+</div>
            );
          })}
        </div>

        {/* Regular events */}
        <div style={{fontSize:10,color:"var(--b)",letterSpacing:2,fontWeight:900,marginBottom:6}}>GEWONE VAKJES ({selReg.length}/6)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
          {reg.map(ev=>{
            const on=sel.some(e=>e.id===ev.id);
            const dis=!on&&selReg.length>=6;
            return(
              <button key={ev.id} onClick={()=>toggle(ev)} disabled={dis}
                style={{padding:"4px 9px",borderRadius:8,border:`1.5px solid ${on?"var(--b)":"var(--bd)"}`,background:on?"#e8f0fe":"transparent",color:on?"var(--b)":dis?"var(--bd)":"var(--mu)",fontSize:11,fontWeight:on?800:400,cursor:dis?"not-allowed":"pointer"}}>
                {ev.emoji} {ev.label}
              </button>
            );
          })}
        </div>

        {/* Rare events */}
        <div style={{fontSize:10,color:"var(--gr)",letterSpacing:2,fontWeight:900,marginBottom:6}}>ZELDZAME VAKJES ({selRare.length}/3)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:18}}>
          {rare.map(ev=>{
            const on=sel.some(e=>e.id===ev.id);
            const dis=!on&&selRare.length>=3;
            return(
              <button key={ev.id} onClick={()=>toggle(ev)} disabled={dis}
                style={{padding:"4px 9px",borderRadius:8,border:`1.5px solid ${on?"var(--gr)":"var(--bd)"}`,background:on?"var(--gr-lt)":"transparent",color:on?"var(--gr-dk)":dis?"var(--bd)":"var(--mu)",fontSize:11,fontWeight:on?800:400,cursor:dis?"not-allowed":"pointer"}}>
                {ev.emoji} {ev.label}
              </button>
            );
          })}
        </div>

        {/* Kaart 2 preview toggle */}
        {card2Prev.length>0&&(
          <div style={{marginBottom:14}}>
            <button onClick={()=>setShowC2(x=>!x)} style={{width:"100%",padding:"8px 0",background:"var(--gr-bg)",border:"1.5px solid var(--gr)",borderRadius:10,color:"var(--gr-dk)",fontSize:12,fontWeight:800,cursor:"pointer"}}>
              {showC2?"▲ Verberg":"▼ Bekijk"} Kaart 2 (automatisch willekeurig)
            </button>
            {showC2&&(
              <div style={{marginTop:8}}>
                <div style={{fontSize:10,color:"var(--gr)",letterSpacing:2,fontWeight:900,marginBottom:6}}>KAART 2 PREVIEW (alleen-lezen)</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
                  {card2Prev.map((ev,i)=>(
                    <div key={i} style={{background:ev.at?"#fff5f5":"var(--gr-bg)",border:`1.5px solid ${ev.at?"var(--r)":"var(--bd)"}`,borderRadius:10,padding:"6px 4px",textAlign:"center",minHeight:64,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                      <div style={{fontSize:18}}>{ev.emoji}</div>
                      <div style={{fontSize:ev.label?.length>7?8:9,fontWeight:900,color:ev.at?"var(--r)":"var(--dk)",lineHeight:1.2}}>{ev.label}</div>
                      <div style={{fontSize:8,color:ev.at?"var(--r)":"var(--mu)"}}>{ev.at?"🍻":"🍺"}{ev.slok}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:"var(--mu)",marginTop:6,textAlign:"center"}}>Kaart 2 wordt altijd automatisch gegenereerd — niet aanpasbaar</div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{if(valid){onSave(sel);onClose();}}} disabled={!valid}
            style={{flex:2,padding:"13px 0",background:valid?"var(--gr)":"var(--gr-bg)",border:`1.5px solid ${valid?"var(--gr)":"var(--bd)"}`,borderRadius:12,color:valid?"#fff":"var(--mu)",fontWeight:900,fontSize:13,cursor:valid?"pointer":"not-allowed"}}>
            {valid?"✓ Kaart opslaan":`Nog ${6-selReg.length} gewone + ${3-selRare.length} zeldzame`}
          </button>
          <button onClick={onClose} style={{flex:1,padding:"13px 0",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:12,color:"var(--mu)",fontWeight:800,fontSize:13,cursor:"pointer"}}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}

// ── Event Edit Form ───────────────────────────────────────────────────────────
function EvForm({ev,onChange,onSave,onCancel,isNew}){
  const [l,setL]=useState({label:ev.label,slok:ev.slok,at:ev.at,emoji:ev.emoji,cat:ev.cat||"score",diff:ev.diff||"medium"});
  const set=(k,v)=>{const u={...l,[k]:v};setL(u);onChange&&onChange(u);};
  return(
    <div style={{background:"#fff",border:"1.5px solid var(--bd)",borderRadius:14,padding:14,marginBottom:10,animation:"fadeUp .2s",boxShadow:"var(--sh)"}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
        {EMOJIS.map(e=>(
          <button key={e} onClick={()=>set("emoji",e)} style={{fontSize:18,width:34,height:34,background:l.emoji===e?"var(--gr-lt)":"transparent",border:`1.5px solid ${l.emoji===e?"var(--gr)":"transparent"}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>{e}</button>
        ))}
      </div>
      <input value={l.label} onChange={e=>set("label",e.target.value)} placeholder="Label bijv. 180" className="inp" style={{marginBottom:10}} />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        <div>
          <div style={{fontSize:10,color:"var(--mu)",marginBottom:4}}>SLOKKEN</div>
          <input type="number" min="1" max="10" value={l.slok} onChange={e=>set("slok",parseInt(e.target.value)||1)} className="inp" />
        </div>
        <div>
          <div style={{fontSize:10,color:"var(--mu)",marginBottom:4}}>TYPE</div>
          <select value={l.at?"at":"jij"} onChange={e=>set("at",e.target.value==="at")} className="inp" style={{paddingTop:11,paddingBottom:11}}>
            <option value="jij">Jij drinkt</option>
            <option value="at">Iedereen</option>
          </select>
        </div>
        <div>
          <div style={{fontSize:10,color:"var(--mu)",marginBottom:4}}>CATEGORIE</div>
          <select value={l.cat||"score"} onChange={e=>set("cat",e.target.value)} className="inp" style={{paddingTop:11,paddingBottom:11,fontSize:12}}>
            {Object.entries(CATS).map(([k,{lbl}])=><option key={k} value={k}>{lbl}</option>)}
          </select>
        </div>
      </div>
      {!l.at&&(
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:"var(--mu)",marginBottom:6}}>MOEILIJKHEID (voor kaartsamenstelling)</div>
          <div style={{display:"flex",gap:6}}>
            {Object.entries(DIFFS).map(([k,{lbl,c}])=>(
              <button key={k} onClick={()=>set("diff",k)} style={{flex:1,padding:"7px 0",borderRadius:8,border:`1.5px solid ${l.diff===k?c:"var(--bd)"}`,background:l.diff===k?c+"22":"transparent",color:l.diff===k?c:"var(--mu)",fontSize:11,fontWeight:800,cursor:"pointer"}}>{lbl}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        <Btn onClick={()=>onSave(l)} color="var(--gr)">{isNew?"Toevoegen":"Opslaan"}</Btn>
        <button onClick={onCancel} style={{flex:1,padding:"12px 0",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:10,color:"var(--mu)",fontWeight:800}}>Annuleer</button>
      </div>
    </div>
  );
}

// ── Bingo Cell ────────────────────────────────────────────────────────────────
function BingoCell({ev,cnt,inBingo:glow,isPulse,isFlash,canTap,canEdit,onTap,onUndo,onEdit,t}){
  const lp=useLongPress(
    ()=>{if(canTap)onTap();},
    ()=>{if(canTap)onUndo();}
  );
  const hit=cnt>0;
  const alpha=hit?Math.min(.5+Math.min(cnt,5)*.1,1):0;
  const bg=hit?(glow?t.a:t.a+Math.round(alpha*255).toString(16).padStart(2,"0")):t.cell;
  return(
    <div {...lp} className={`cell${!canTap&&!canEdit?" view":""}${isFlash?" row-flash":""}`}
      style={{background:bg,border:`2px solid ${glow?t.a:hit?t.a+"66":t.bd}`,borderRadius:16,
        boxShadow:glow?`0 0 22px ${t.a}88,inset 0 0 8px ${t.a}22`:"none",
        animation:isPulse?"pop .25s ease":"none",minHeight:100,gap:4,padding:"10px 6px"}}>
      {cnt>1&&<div style={{position:"absolute",top:6,right:7,background:"#00000044",color:"#fff",borderRadius:20,padding:"1px 6px",fontSize:9,fontWeight:900,lineHeight:1.6}} key={cnt}>×{cnt}</div>}
      {canEdit&&<button onClick={e=>{e.stopPropagation();onEdit();}} style={{position:"absolute",top:5,left:7,background:"transparent",border:"none",fontSize:11,cursor:"pointer",opacity:.4,color:hit?"#fff":t.sub,padding:0,lineHeight:1}}>✏️</button>}
      {glow&&hit&&<div style={{position:"absolute",top:6,right:6,fontSize:13,opacity:.9}}>✅</div>}
      <div style={{fontSize:22,lineHeight:1}}>{ev.emoji}</div>
      <div style={{fontSize:ev.label?.length>8?10:ev.label?.length>5?12:13,fontWeight:900,color:hit?"#fff":t.tx,lineHeight:1.15,padding:"0 4px",textAlign:"center"}}>{ev.label}</div>
      <div style={{fontSize:10,color:hit?"#ffffffcc":(ev.at?t.a:t.sub),fontWeight:700}}>
        {ev.at?`🍻 ${ev.slok}×`:`${ev.slok} slok`}
      </div>
      <div style={{position:"absolute",bottom:6,right:7,width:6,height:6,borderRadius:"50%",background:CATS[ev.cat||"score"].c,opacity:.7}} />
    </div>
  );
}

// ── Play Screen ───────────────────────────────────────────────────────────────
function Play({sess,players,myCol,setPlayers,onBack,S,upS,chat,onChat,onKick,onNextRound,onEnd,onAch,onBreak,onBreakEnd,onPool,onClaimHost}){
  const [actCol,  setActCol]  = useState(myCol);
  const [pulse,   setPulse]   = useState(null);
  const [showR,   setShowR]   = useState(false);
  const [showSt,  setShowSt]  = useState(false);
  const [showCh,  setShowCh]  = useState(false);
  const [showSe,  setShowSe]  = useState(false);
  const [confRst, setConfRst] = useState(false);
  const [confEnd, setConfEnd] = useState(false);
  const [pendingUndo,setPendingUndo] = useState(null);
  const [editI,   setEditI]   = useState(null);
  const [saveSt,  setSaveSt]  = useState("");
  const [bAlert,  setBAlert]  = useState(null);
  const [actCard,   setActCard]   = useState(0);
  const [numAnim,   setNumAnim]   = useState(false);
  const [cardFlipA, setCardFlipA] = useState(false);
  const [flashRows, setFlashRows] = useState([]);
  const [hostAdj,   setHostAdj]   = useState(false);
  const [adjVal,    setAdjVal]    = useState("");
  const [exactScore,setExactScore]= useState("");
  const [hostShare, setHostShare] = useState(false);
  const [hostCardEditOpen,setHostCardEditOpen]=useState(false);
  const [showIdea,  setShowIdea]  = useState(false);
  const [ideaLabel, setIdeaLabel] = useState("");
  const [ideaEmoji, setIdeaEmoji] = useState("🎯");
  const [ideaDiff,  setIdeaDiff]  = useState("medium");
  const prevBL  = useRef({});
  const saverRef = useRef(null);
  const pushRef  = useRef({});
  const nameRef  = useRef(null);
  const mountedAt = useRef(Date.now());
  const [, forceTick] = useState(0);

  const isSpectator = myCol==="spectator";
  const t    = COLORS[actCol]||COLORS.rood;
  const me   = players.find(p=>p.color===actCol);
  const isMy = actCol===myCol&&!isSpectator;
  const isH  = sess.host_color===myCol&&!isSpectator;
  const sl   = S.gm==="punten"?"punten":"slokken";
  const em   = S.gm==="punten"?"🏆":"🍺";

  // WakeLock: scherm wakker houden
  useEffect(()=>{
    let wl=null;
    const req=async()=>{try{if("wakeLock" in navigator){wl=await navigator.wakeLock.request("screen");}}catch{}};
    req();
    const onVis=()=>{if(document.visibilityState==="visible")req();};
    document.addEventListener("visibilitychange",onVis);
    return()=>{wl?.release().catch(()=>{});document.removeEventListener("visibilitychange",onVis);};
  },[]);

  // Retrying/offline-safe saver (#8) — persists to localStorage and retries
  // with backoff so a tap made on a flaky connection isn't silently lost.
  useEffect(()=>{
    saverRef.current = createRetryingSaver({
      save:(key,payload)=>{
        const col=key.split("::")[1];
        return sb.from("bingo_players").update(payload).eq("session_id",sess.id).eq("color",col);
      },
      onChange:(pending)=>setSaveSt(pending?"pending":""),
    });
    // Recover anything left over from a previous tab/session for this player.
    saverRef.current.restore(`db_save_${sess.id}::${myCol}`);
  },[sess.id,myCol]);

  function queueSave(col,data){
    const key=`${sess.id}::${col}`;
    if(!pushRef.current[key]) pushRef.current[key]=debounce(payload=>saverRef.current?.push(`db_save_${key}`,payload),500);
    pushRef.current[key](data);
  }

  // Debounced name save (stable ref) — also routed through the retry queue.
  useEffect(()=>{
    nameRef.current = debounce((col,n)=>{
      const key=`db_name_${sess.id}::${col}`;
      saverRef.current?.push(key,{name:n});
    },800);
  },[sess.id]);

  // Host heartbeat + fallback claim (#7): while the host has Play open, ping
  // host_last_seen periodically. If it goes stale, any other player can claim
  // host so the night isn't stuck if the host's phone dies/loses signal.
  useEffect(()=>{
    if(!isH)return;
    let stopped=false;
    const beat=()=>{ if(!stopped) sb.from("bingo_sessions").update({host_last_seen:new Date().toISOString()}).eq("id",sess.id); };
    beat();
    const iv=setInterval(beat,20000);
    return()=>{stopped=true;clearInterval(iv);};
  },[isH,sess.id]);
  useEffect(()=>{
    const iv=setInterval(()=>forceTick(x=>x+1),10000);
    return()=>clearInterval(iv);
  },[]);
  const hostStale = !isH&&!isSpectator
    && (Date.now()-mountedAt.current>30000)
    && (!sess.host_last_seen || (Date.now()-new Date(sess.host_last_seen).getTime())>45000);
  async function claimHost(){ await onClaimHost(myCol); }

  // Bingo alerts from others
  useEffect(()=>{
    players.forEach(p=>{
      const lines=LINES.filter(l=>l.every(i=>(p.counts||[])[i]>0));
      const prev=prevBL.current[p.color]||0;
      if(lines.length>prev&&p.color!==myCol){
        setBAlert(`🎉 ${p.name||p.color} heeft BINGO!`);
        sBingo();setTimeout(()=>setBAlert(null),4000);
      }
      prevBL.current[p.color]=lines.length;
    });
  },[players]);

  if(!me&&!isSpectator){
    if(players.find(p=>p.color===myCol)){
      if(actCol!==myCol)setActCol(myCol);
      return null;
    }
    return(
      <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
        <div style={{color:"var(--mu)"}}>Speler niet gevonden</div>
        <button onClick={onBack} style={{padding:"10px 20px",background:"var(--gr)",border:"none",borderRadius:10,color:"#fff",fontWeight:800,cursor:"pointer"}}>← Terug</button>
      </div>
    );
  }
  if(isSpectator&&!me&&players.length>0){
    setActCol(players[0].color);return null;
  }
  if(isSpectator&&players.length===0)return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--mu)"}}>Nog geen spelers…</div>
  );

  const card   = actCard===0?(me.card||[]):(me.card2||me.card||[]);
  const counts = actCard===0?(me.counts||Array(9).fill(0)):(me.counts2||Array(9).fill(0));
  const compL  = LINES.filter(l=>l.every(i=>counts[i]>0));
  const bingo  = compL.length>0;
  const filled = counts.filter(c=>c>0).length;
  const pct    = Math.round(filled/9*100);
  const totAll = players.reduce((s,p)=>s+(p.total_slok||0),0);
  const nearLim= S.maxD>0&&(me.total_slok||0)>=S.maxD*0.8;
  const inBingo= i=>compL.some(l=>l.includes(i));

  async function tap(i){
    if(!isMy)return;
    const ev=card[i];if(!ev)return;
    const nc=counts.map((c,ii)=>ii===i?c+1:c);
    const scaled=ev.slok*(S.scale||1);
    const newSlok=(me.total_slok||0)+scaled;
    const cnt=nc[i];
    const msg=ev.at?`${ev.emoji} ${ev.label} ×${cnt} — 🍻 IEDEREEN ${scaled} ${sl}!`:`${ev.emoji} ${ev.label} ×${cnt} — ${scaled} ${sl}`;
    const newLog=[{msg,type:ev.at?"at":"hit",id:Date.now()},...(me.log||[])].slice(0,30);
    const prevBL2=me.bingo_lines||[];
    const newComp=LINES.filter(l=>l.every(i2=>nc[i2]>0));
    const newLns=newComp.filter(l=>!prevBL2.some(cl=>cl.join()===l.join()));
    let BL=prevBL2;
    if(newLns.length>0){
      const rw=REWARDS[~~(Math.random()*REWARDS.length)];
      newLog.unshift({msg:`🎉 BINGO-RIJ! → ${rw}`,type:"bingo",id:Date.now()+1});
      BL=[...prevBL2,...newLns];
      sBingo();
      setFlashRows(newLns.flat());setTimeout(()=>setFlashRows([]),800);
      if(navigator.vibrate)navigator.vibrate([100,50,100,50,200]);
    }else{
      sClick(600+cnt*60);
      if(navigator.vibrate)navigator.vibrate(30);
    }
    if(ev.label==="180"||ev.cat==="special") confetti(ev.label==="180"?80:50);
    const wasAllFilled = counts.every(c=>c>0);
    if(nc.every(c=>c>0)&&!wasAllFilled){
      newLog.unshift({msg:`🏆 VOLLE KAART! Alle 9 vakjes aangetikt! ${em} BONUS!`,type:"bingo",id:Date.now()+2});
      confetti(120);sFanfare();
    }
    const earned=checkAch(me,ev,nc,BL,newSlok,card);
    const newAchs=[...(me.achievements||[]),...earned];
    earned.forEach((id,idx)=>{const a=ACHS.find(x=>x.id===id);if(a)setTimeout(()=>onAch(a),idx*700);});
    const ver=(me.version||0)+1;
    const ck=actCard===0?"counts":"counts2";
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:nc,total_slok:newSlok,log:newLog,bingo_lines:BL,achievements:newAchs,version:ver}:p));
    setPulse(i);setTimeout(()=>setPulse(null),300);
    setNumAnim(true);setTimeout(()=>setNumAnim(false),400);
    queueSave(actCol,{[ck]:nc,total_slok:newSlok,log:newLog,bingo_lines:BL,achievements:newAchs,version:ver});
  }

  function undo(i){
    if(!isMy)return;
    const ev=card[i];if(!ev||counts[i]===0)return;
    const nc=counts.map((c,ii)=>ii===i?Math.max(0,c-1):c);
    const newSlok=Math.max(0,(me.total_slok||0)-(ev.slok*(S.scale||1)));
    const newBL=LINES.filter(l=>l.every(i2=>nc[i2]>0));
    const ver=(me.version||0)+1;
    const ck=actCard===0?"counts":"counts2";
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:nc,total_slok:newSlok,bingo_lines:newBL,version:ver}:p));
    sUndo();
    queueSave(actCol,{[ck]:nc,total_slok:newSlok,bingo_lines:newBL,version:ver});
  }

  // Undo confirmation (#2) — when S.undoC is on, long-press asks first instead
  // of undoing immediately.
  function requestUndo(i){
    if(!counts[i])return;
    if(S.undoC){ setPendingUndo(i); return; }
    if(isMy) undo(i); else if(isH) hostUndo(i);
  }
  function confirmUndo(){
    const i=pendingUndo;
    setPendingUndo(null);
    if(i==null)return;
    if(isMy) undo(i); else if(isH) hostUndo(i);
  }

  async function hostTap(i){
    if(!isH||isMy)return;
    const ev=card[i];if(!ev)return;
    const nc=counts.map((c,ii)=>ii===i?c+1:c);
    const scaled=ev.slok*(S.scale||1);
    const newSlok=(me.total_slok||0)+scaled;
    const ck=actCard===0?"counts":"counts2";
    const ver=(me.version||0)+1;
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:nc,total_slok:newSlok,version:ver}:p));
    queueSave(actCol,{[ck]:nc,total_slok:newSlok,version:ver});
  }

  async function hostAdjScore(delta){
    const newSlok=Math.max(0,(me.total_slok||0)+delta);
    const ver=(me.version||0)+1;
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,total_slok:newSlok,version:ver}:p));
    queueSave(actCol,{total_slok:newSlok,version:ver});
    setAdjVal("");setHostAdj(false);
  }

  async function hostSetExact(){
    const v=parseInt(exactScore);
    if(isNaN(v)||v<0)return;
    const ver=(me.version||0)+1;
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,total_slok:v,version:ver}:p));
    queueSave(actCol,{total_slok:v,version:ver});
    setExactScore("");
  }

  async function hostUndo(i){
    if(!isH||isMy)return;
    const ev=card[i];if(!ev||counts[i]===0)return;
    const nc=counts.map((c,ii)=>ii===i?Math.max(0,c-1):c);
    const newSlok=Math.max(0,(me.total_slok||0)-(ev.slok*(S.scale||1)));
    const newBL=LINES.filter(l=>l.every(i2=>nc[i2]>0));
    const ck=actCard===0?"counts":"counts2";
    const ver=(me.version||0)+1;
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:nc,total_slok:newSlok,bingo_lines:newBL,version:ver}:p));
    sUndo();
    queueSave(actCol,{[ck]:nc,total_slok:newSlok,bingo_lines:newBL,version:ver});
  }

  async function hostRotate(){
    const seed=sess.id+"_hr_"+uid();
    const nc=makeCard(sess.event_pool,actCol,seed,"",S.cardDist);
    if(!nc)return;
    const ck=actCard===0?"card":"card2";
    const cnk=actCard===0?"counts":"counts2";
    setCardFlipA(true);setTimeout(()=>setCardFlipA(false),600);
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:nc,[cnk]:Array(9).fill(0)}:p));
    await sb.from("bingo_players").update({[ck]:nc,[cnk]:Array(9).fill(0)}).eq("session_id",sess.id).eq("color",actCol);
  }

  async function hostSaveCard(newCard){
    const ck=actCard===0?"card":"card2";
    const cnk=actCard===0?"counts":"counts2";
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:newCard,[cnk]:Array(9).fill(0)}:p));
    await sb.from("bingo_players").update({[ck]:newCard,[cnk]:Array(9).fill(0)}).eq("session_id",sess.id).eq("color",actCol);
    setHostCardEditOpen(false);
  }

  async function submitIdea(){
    if(!ideaLabel.trim())return;
    const me2=players.find(p=>p.color===myCol);
    await sb.from("bingo_chat").insert({id:uid(),session_id:sess.id,color:"__idea__",name:me2?.name||"Speler",message:JSON.stringify({label:ideaLabel.trim(),emoji:ideaEmoji,diff:ideaDiff})});
    setIdeaLabel("");setShowIdea(false);
  }

  async function approveIdea(msg){
    try{
      const idea=JSON.parse(msg);
      const newEv={id:uid(),label:idea.label,emoji:idea.emoji||"🎯",slok:1,at:false,cat:"score",diff:idea.diff||"medium"};
      await onPool([...sess.event_pool,newEv]);
    }catch{}
  }

  const ideas=chat.filter(m=>m.color==="__idea__");

  async function saveEdit(i,ev){
    const ck=actCard===0?"card":"card2";
    const nc=(actCard===0?[...card]:[...(me.card2||card)]).map((e,ii)=>ii===i?{...e,...ev}:e);
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:nc}:p));
    setEditI(null);
    await sb.from("bingo_players").update({[ck]:nc}).eq("session_id",sess.id).eq("color",actCol);
  }

  async function reset(){
    const seed=sess.id+"_r_"+Date.now();
    const c1=makeCard(sess.event_pool,actCol,seed);
    const c2=makeCard(sess.event_pool,actCol,seed+"_b");
    const f={counts:Array(9).fill(0),counts2:Array(9).fill(0),total_slok:0,bingo_lines:[],log:[],card:c1,card2:c2,version:0};
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,...f}:p));
    setConfRst(false);
    await sb.from("bingo_players").update(f).eq("session_id",sess.id).eq("color",actCol);
  }
  function requestReset(){
    if(!isMy)return;
    if(S.resetC) setConfRst(true); else reset();
  }

  async function rotate(){
    setCardFlipA(true);
    setTimeout(()=>setCardFlipA(false),600);
    const seed=sess.id+"_ro_"+Date.now();
    const nc=makeCard(sess.event_pool,actCol,seed);
    const ck=actCard===0?"card":"card2";
    const cnk=actCard===0?"counts":"counts2";
    setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,[ck]:nc,[cnk]:Array(9).fill(0)}:p));
    await sb.from("bingo_players").update({[ck]:nc,[cnk]:Array(9).fill(0)}).eq("session_id",sess.id).eq("color",actCol);
  }

  return(
    <div style={{minHeight:"100vh",background:t.bg,color:t.tx}}>
      {/* Toast: bingo alert */}
      {bAlert&&<div className="bingo-toast">{bAlert}</div>}

      {/* ── Sticky header ── */}
      <div className="np" style={{position:"sticky",top:0,zIndex:50,background:t.bg,borderBottom:`1px solid ${t.bd}`,padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,maxWidth:460,margin:"0 auto"}}>
          <button onClick={onBack} style={{background:"transparent",border:"none",color:t.sub,fontSize:22,padding:0,lineHeight:1,flexShrink:0}}>‹</button>
          <div style={{width:42,height:42,borderRadius:"50%",border:`2.5px solid ${t.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,background:t.cell,flexShrink:0,boxShadow:`0 0 10px ${t.a}44`}}>
            {me.avatar||"🎯"}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:900,fontSize:15,lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isSpectator?"👁️ Toeschouwer":(me?.name||"Speler")}</div>
            <div style={{fontSize:10,color:t.sub,marginTop:1,letterSpacing:1}}>{isSpectator?"ALLE KAARTEN":`JOUW KAART${sess.round>1?` · R${sess.round}`:""}`}</div>
          </div>
          {!isSpectator&&<div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:26,fontWeight:900,color:t.a,lineHeight:1,animation:numAnim?"numPop .35s":""}} key={me?.total_slok}>{me?.total_slok||0}</div>
            <div style={{fontSize:10,color:t.sub}}>SLOKKEN 🍺</div>
          </div>}
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            {!isSpectator&&<HBtn active={showIdea} color="#facc15" onClick={()=>setShowIdea(x=>!x)}>💡</HBtn>}
            {S.chat&&<HBtn active={showCh} color={t.a} onClick={()=>setShowCh(x=>!x)}>💬</HBtn>}
            <HBtn active={showSt} color={t.a} onClick={()=>setShowSt(x=>!x)}>📊</HBtn>
            <HBtn active={showR} color={t.a} onClick={()=>setShowR(x=>!x)}>📋</HBtn>
            <HBtn color={t.sub} onClick={()=>setShowSe(true)}>⚙️</HBtn>
          </div>
        </div>
      </div>

      <div style={{maxWidth:460,margin:"0 auto",padding:"10px 14px 130px"}}>
        {/* Progress + code */}
        <div className="np" style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{flex:1,background:t.bd,borderRadius:6,height:6,overflow:"hidden"}}>
              <div style={{width:`${pct}%`,background:t.a,borderRadius:6,height:"100%",transition:"width .3s"}} />
            </div>
            <div style={{fontSize:12,color:t.sub,fontWeight:700,whiteSpace:"nowrap"}}>{filled}/9 ⭐</div>
            <button onClick={()=>navigator.clipboard?.writeText(sess.id)} style={{background:"none",border:"none",color:t.sub,fontSize:11,padding:0,cursor:"pointer",whiteSpace:"nowrap"}}>
              <b style={{color:t.a,letterSpacing:1}}>{sess.id}</b> 📋
            </button>
          </div>
        </div>

        {/* Offline/save-pending banner (#8) */}
        {saveSt==="pending"&&(
          <div className="np" style={{background:"#fff5f5",border:"1.5px solid #fbbfbf",borderRadius:10,padding:"8px 14px",marginBottom:10,fontSize:12,color:"#c0392b",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <span>⚠️ Niet alles is opgeslagen — nieuwe poging automatisch</span>
            <button onClick={()=>saverRef.current?.retryAll()} style={{padding:"5px 10px",background:"#fff",border:"1px solid #fbbfbf",borderRadius:7,color:"#c0392b",fontWeight:800,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>Probeer nu</button>
          </div>
        )}

        {/* Host-absent fallback (#7) */}
        {hostStale&&(
          <div className="np" style={{background:"var(--or-lt)",border:"1.5px solid var(--or)",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12,color:"var(--or)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <span>👑 Host lijkt afwezig</span>
            <button onClick={claimHost} style={{padding:"6px 12px",background:"var(--or)",border:"none",borderRadius:8,color:"#fff",fontWeight:800,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>Neem over</button>
          </div>
        )}

        {/* Activity ticker + emoji-reacties */}
        {(me.log||[]).length>0&&(
          <div className="np" style={{background:t.card,border:`1.5px solid ${t.bd}`,borderRadius:10,padding:"8px 14px",marginBottom:10,boxShadow:"var(--sh-sm)"}}>
            <div style={{fontSize:12,color:t.sub,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",marginBottom:6}}>
              {(me.log||[]).slice(0,4).map((e,i)=>(
                <span key={e.id||i}>
                  {i>0&&<span style={{color:t.bd,margin:"0 10px"}}>·</span>}
                  <span style={{color:e.type==="bingo"?t.a:e.type==="at"?"var(--or)":t.sub}}>{e.msg}</span>
                </span>
              ))}
            </div>
            {S.chat&&<div style={{display:"flex",gap:4}}>
              {["👍","😂","🔥","🎯","💀","🍺"].map(em=>(
                <button key={em} onClick={()=>onChat(em)} style={{fontSize:15,background:"transparent",border:`1px solid ${t.bd}`,borderRadius:7,padding:"2px 6px",cursor:"pointer",lineHeight:1.4}}>{em}</button>
              ))}
            </div>}
          </div>
        )}

        {/* View-only banner */}
        {isSpectator&&<div className="np" style={{background:"#eff5ff",border:"1.5px solid var(--b)",borderRadius:10,padding:"8px 14px",marginBottom:10,fontSize:12,color:"var(--b)",textAlign:"center"}}>
          👁️ Toeschouwer — gebruik de tabs onderaan om spelers te wisselen
        </div>}
        {!isMy&&!isSpectator&&<div className="np" style={{background:"var(--or-lt)",border:"1.5px solid var(--or)",borderRadius:10,padding:"8px 14px",marginBottom:10,fontSize:12,color:"var(--or)",textAlign:"center"}}>
          👁️ Kaart van <b>{me?.name}</b> — jouw kaart ({COLORS[myCol]?.lbl}) is bewerkbaar
        </div>}

        {/* Card 2 toggle */}
        {isMy&&me.card2&&me.card2.length>0&&(
          <div className="np" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
            {[0,1].map(idx=>(
              <button key={idx} onClick={()=>setActCard(idx)} style={{padding:"8px 0",borderRadius:10,border:`2px solid ${actCard===idx?t.a:t.bd}`,background:actCard===idx?t.a+"22":"transparent",color:actCard===idx?t.a:t.sub,fontWeight:900,fontSize:12}}>
                Kaart {idx+1}{actCard===idx?" ✓":""}
              </button>
            ))}
          </div>
        )}

        {/* Name input (own) */}
        {isMy&&(
          <div className="np" style={{background:t.card,borderRadius:11,padding:"9px 14px",marginBottom:10,border:`1px solid ${t.bd}`,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{me.avatar||"🎯"}</span>
            <span style={{fontSize:10,color:t.sub,letterSpacing:2,flexShrink:0}}>NAAM</span>
            <input defaultValue={me.name||""} onChange={e=>{
              const n=e.target.value;
              setPlayers(ps=>ps.map(p=>p.color===actCol?{...p,name:n}:p));
              nameRef.current(actCol,n);
            }} style={{background:"transparent",border:"none",color:t.tx,fontSize:15,fontWeight:800,flex:1,outline:"none"}} />
          </div>
        )}

        {/* Accordion panels */}
        {showR&&<Rules t={t} sl={sl} em={em} isHost={isH} />}
        {showSt&&<Stats players={players} S={S} />}
        {showCh&&S.chat&&<Chat chat={chat.filter(m=>m.color!=="__idea__")} onSend={onChat} myCol={myCol} t={t} />}

        {/* Idee insturen panel */}
        {showIdea&&(
          <div style={{background:"#fffbef",border:"1.5px solid var(--or)",borderRadius:12,padding:14,marginBottom:10,animation:"fadeUp .2s",boxShadow:"var(--sh-sm)"}}>
            <div style={{fontSize:10,color:"var(--or)",letterSpacing:2,fontWeight:900,marginBottom:10}}>💡 IDEE VOOR EEN VAKJE</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
              {EMOJIS.slice(0,12).map(e=>(
                <button key={e} onClick={()=>setIdeaEmoji(e)} style={{fontSize:18,width:34,height:34,background:ideaEmoji===e?"var(--or-lt)":"transparent",border:`1.5px solid ${ideaEmoji===e?"var(--or)":"transparent"}`,borderRadius:8,cursor:"pointer"}}>{e}</button>
              ))}
            </div>
            <input value={ideaLabel} onChange={e=>setIdeaLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitIdea()} placeholder="Vakje naam (bijv. 'Dubbel 20')" style={{display:"block",width:"100%",background:"#fff",border:"1.5px solid var(--bd)",borderRadius:9,padding:"10px 12px",color:"var(--dk)",fontSize:14,outline:"none",marginBottom:8}} />
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              {Object.entries(DIFFS).map(([k,{lbl,c}])=>(
                <button key={k} onClick={()=>setIdeaDiff(k)} style={{flex:1,padding:"7px 0",borderRadius:9,border:`1.5px solid ${ideaDiff===k?c:"var(--bd)"}`,background:ideaDiff===k?c+"22":"transparent",color:ideaDiff===k?c:"var(--mu)",fontSize:11,fontWeight:800,cursor:"pointer"}}>{lbl}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={submitIdea} disabled={!ideaLabel.trim()} style={{flex:2,padding:"11px 0",background:ideaLabel.trim()?"var(--or-lt)":"var(--gr-bg)",border:`1.5px solid ${ideaLabel.trim()?"var(--or)":"var(--bd)"}`,borderRadius:10,color:ideaLabel.trim()?"var(--or)":"var(--mu)",fontWeight:900,fontSize:13,cursor:ideaLabel.trim()?"pointer":"not-allowed"}}>
                💡 Verstuur idee
              </button>
              <button onClick={()=>setShowIdea(false)} style={{flex:1,padding:"11px 0",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:10,color:"var(--mu)",fontWeight:800,fontSize:13,cursor:"pointer"}}>Sluiten</button>
            </div>
          </div>
        )}

        {/* Break timer */}
        <BreakTimer sess={sess} isHost={isH} t={t} onEnd={onBreakEnd} />

        {/* Bingo banner */}
        {bingo&&(
          <div style={{background:`linear-gradient(135deg,${t.a},${t.a}99)`,borderRadius:12,padding:"11px 16px",marginBottom:10,textAlign:"center",fontWeight:900,fontSize:20,color:"#000",letterSpacing:4,animation:"bingoPulse .7s ease-in-out infinite"}}>
            🏆 BINGO! {compL.length}× RIJ!
          </div>
        )}

        {/* Confirm dialogs */}
        {confRst&&(
          <div style={{background:"#fff5f5",border:"1.5px solid #fbbfbf",borderRadius:12,padding:16,marginBottom:12,animation:"fadeUp .2s"}}>
            <div style={{fontWeight:800,marginBottom:4,color:"var(--dk)"}}>Reset kaart van {me.name}?</div>
            <div style={{fontSize:12,color:"var(--mu)",marginBottom:12}}>Alles wordt gewist. Nieuwe kaart gegenereerd.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Btn onClick={reset} color="var(--r)">Ja, reset</Btn>
              <button onClick={()=>setConfRst(false)} style={{padding:"12px 0",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:10,color:"var(--mu)",fontWeight:800,cursor:"pointer"}}>Annuleer</button>
            </div>
          </div>
        )}
        {pendingUndo!=null&&(
          <div style={{background:"#fff5f5",border:"1.5px solid #fbbfbf",borderRadius:12,padding:16,marginBottom:12,animation:"fadeUp .2s"}}>
            <div style={{fontWeight:800,marginBottom:4,color:"var(--dk)"}}>Tik van "{card[pendingUndo]?.label}" ongedaan maken?</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Btn onClick={confirmUndo} color="var(--r)">Ja, wissen</Btn>
              <button onClick={()=>setPendingUndo(null)} style={{padding:"12px 0",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:10,color:"var(--mu)",fontWeight:800,cursor:"pointer"}}>Annuleer</button>
            </div>
          </div>
        )}
        {confEnd&&isH&&(
          <div style={{background:"#fff5f5",border:"1.5px solid #fbbfbf",borderRadius:12,padding:16,marginBottom:12,animation:"fadeUp .2s"}}>
            <div style={{fontWeight:800,marginBottom:4,color:"var(--dk)"}}>Spel beëindigen voor iedereen?</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Btn onClick={()=>{onEnd();setConfEnd(false);}} color="var(--r)">Ja, einde!</Btn>
              <button onClick={()=>setConfEnd(false)} style={{padding:"12px 0",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:10,color:"var(--mu)",fontWeight:800,cursor:"pointer"}}>Annuleer</button>
            </div>
          </div>
        )}

        {/* Drink limit */}
        {nearLim&&<div style={{background:"var(--or-lt)",border:"1.5px solid var(--or)",borderRadius:10,padding:"9px 14px",marginBottom:10,fontSize:12,color:"var(--or)",textAlign:"center"}}>
          ⚠️ Bijna op {sl}limiet ({me.total_slok||0}/{S.maxD})
        </div>}

        {/* GRID */}
        <div className={`grid pc${cardFlipA?" card-flip":""}`} style={{marginBottom:12}}>
          {card.map((ev,i)=>{
            if(editI===i&&(isMy||isH)) return(
              <div key={i} style={{gridColumn:"1/-1"}}>
                <EvForm ev={ev} onSave={e=>saveEdit(i,e)} onCancel={()=>setEditI(null)} />
              </div>
            );
            const cnt=counts[i]||0,glow=inBingo(i),isPulse=pulse===i,isFlash=flashRows.includes(i);
            return(
              <BingoCell key={i} ev={ev} cnt={cnt} inBingo={glow} isPulse={isPulse} isFlash={isFlash}
                canTap={isMy||(isH&&!isMy)} canEdit={isMy||(isH&&!isMy)}
                onTap={()=>isMy?tap(i):isH?hostTap(i):null}
                onUndo={()=>requestUndo(i)}
                onEdit={()=>setEditI(i)}
                t={t} />
            );
          })}
        </div>

        {/* Hint */}
        <div style={{textAlign:"center",fontSize:11,color:t.sub,marginBottom:12,marginTop:4}}>Tik om af te vinken · houd ingedrukt om te wissen</div>

        {/* Rotate / reset buttons */}
        {isMy&&(
          <div className="np" style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={rotate} style={{flex:1,padding:"10px 0",background:"transparent",border:`1.5px solid ${t.bd}`,borderRadius:10,color:t.sub,fontWeight:700,fontSize:12}}>🔀 Nieuwe volgorde</button>
            <button onClick={requestReset} style={{flex:1,padding:"10px 0",background:"transparent",border:"1.5px solid #fbbfbf",borderRadius:10,color:"#e03030",fontWeight:700,fontSize:12}}>🗑 Reset kaart</button>
          </div>
        )}

        {/* Score counter */}
        <div style={{background:t.card,border:`1px solid ${t.bd}`,borderRadius:16,padding:"14px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div className="neon-lbl" style={{marginBottom:4,color:t.sub}}>{me.name||"JOUW"} · {sl.toUpperCase()}</div>
            <div style={{fontSize:38,fontWeight:900,color:t.a,lineHeight:1}} key={me.total_slok}>
              {me.total_slok||0}<span style={{fontSize:24,marginLeft:4}}>{em}</span>
            </div>
            <div style={{fontSize:11,color:t.sub,marginTop:4}}>Iedereen: {totAll} {em}</div>
          </div>
          <div style={{textAlign:"right",color:t.sub,fontSize:12,lineHeight:2}}>
            <div>{counts.reduce((a,b)=>a+b,0)}× getikt</div>
            <div style={{color:compL.length>0?t.a:"inherit"}}>{compL.length}× bingo-rij</div>
            {sess.round>1&&<div style={{color:t.a,fontWeight:800}}>R{sess.round}</div>}
          </div>
        </div>

        {/* Host controls */}
        {isH&&(
          <div className="np" style={{background:t.card,border:`1px solid ${t.a}33`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontSize:10,color:t.a,letterSpacing:2,fontWeight:900,marginBottom:8}}>👑 HOST BEHEER</div>

            {/* Sessie acties */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <button onClick={onNextRound} style={{padding:"11px 8px",background:t.a+"22",border:`1.5px solid ${t.a}88`,borderRadius:10,color:t.a,fontWeight:900,fontSize:12,cursor:"pointer"}}>⏭ Ronde {(sess.round||1)+1}</button>
              <button onClick={()=>setConfEnd(true)} style={{padding:"11px 8px",background:"#fff5f5",border:"1.5px solid #fbbfbf",borderRadius:10,color:"#e03030",fontWeight:900,fontSize:12,cursor:"pointer"}}>🏁 Beëindigen</button>
            </div>

            {/* Pauze */}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <div style={{fontSize:10,color:"var(--mu)",display:"flex",alignItems:"center",marginRight:2}}>☕ Pauze:</div>
              {[5,10,15].map(m=>(
                <button key={m} onClick={()=>onBreak(m)} style={{flex:1,padding:"7px 0",background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:9,color:"var(--gr-dk)",fontWeight:900,fontSize:11,cursor:"pointer"}}>{m}m</button>
              ))}
            </div>

            {/* Deellink / QR */}
            <div style={{marginBottom:8,borderTop:`1px solid ${t.bd}`,paddingTop:8}}>
              <button onClick={()=>setHostShare(x=>!x)} style={{width:"100%",padding:"8px 0",background:hostShare?"#eff5ff":"transparent",border:`1.5px solid ${hostShare?"var(--b)":"var(--bd)"}`,borderRadius:9,color:hostShare?"var(--b)":"var(--mu)",fontSize:12,fontWeight:800,cursor:"pointer"}}>
                🔗 Deellink / QR-code {hostShare?"▲":"▼"}
              </button>
              {hostShare&&(
                <div style={{marginTop:8,textAlign:"center"}}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareUrl(sess.id))}&size=160x160&bgcolor=f0f7ef&color=0e6e37&margin=8`} style={{borderRadius:10,width:130,border:"1.5px solid var(--bd)"}} alt="QR" />
                  <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"center"}}>
                    <button onClick={()=>navigator.clipboard?.writeText(sess.id)} style={{padding:"6px 14px",background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:8,color:"var(--gr-dk)",fontSize:11,fontWeight:800,cursor:"pointer"}}>📋 Code: {sess.id}</button>
                    <button onClick={()=>{if(navigator.share)navigator.share({title:"Dart Bingo",url:shareUrl(sess.id)});else navigator.clipboard?.writeText(shareUrl(sess.id));}} style={{padding:"6px 14px",background:"#eff5ff",border:"1.5px solid var(--b)",borderRadius:8,color:"var(--b)",fontSize:11,fontWeight:800,cursor:"pointer"}}>🔗 Link</button>
                  </div>
                </div>
              )}
            </div>

            {/* Ingestuurde ideeën voor vakjes */}
            {ideas.length>0&&(
              <div style={{borderTop:`1px solid ${t.bd}`,paddingTop:8,marginBottom:8}}>
                <div style={{fontSize:10,color:"var(--or)",letterSpacing:2,fontWeight:900,marginBottom:6}}>💡 INGESTUURDE IDEEËN ({ideas.length})</div>
                {ideas.map((m,i)=>{
                  let idea={label:m.message,emoji:"🎯"};
                  try{idea=JSON.parse(m.message);}catch{}
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#fffbef",border:"1.5px solid var(--or)",borderRadius:9,padding:"7px 10px",marginBottom:6}}>
                      <span style={{fontSize:18}}>{idea.emoji||"🎯"}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:800,color:"var(--dk)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{idea.label}</div>
                        <div style={{fontSize:10,color:"var(--mu)"}}>van {m.name} · {idea.diff?DIFFS[idea.diff]?.lbl:"?"}</div>
                      </div>
                      <button onClick={()=>approveIdea(m.message)} style={{padding:"5px 10px",background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:7,color:"var(--gr-dk)",fontSize:11,fontWeight:800,cursor:"pointer"}}>+ Pool</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Kaart-beheer voor geselecteerde speler */}
            {!isMy&&(
              <div style={{borderTop:`1px solid ${t.bd}`,paddingTop:8}}>
                <div style={{fontSize:10,color:"var(--mu)",marginBottom:8}}>👁️ Kaart van <b style={{color:t.a}}>{me.name}</b></div>

                {/* Score aanpassen */}
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:10,color:"var(--mu)",marginBottom:4}}>± SCORE AANPASSEN</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                    <button onClick={()=>setHostAdj(x=>!x)} style={{padding:"7px 12px",background:hostAdj?t.a+"22":"var(--gr-bg)",border:`1.5px solid ${hostAdj?t.a:"var(--bd)"}`,borderRadius:9,color:hostAdj?t.a:"var(--mu)",fontSize:12,fontWeight:800,cursor:"pointer"}}>± Delta</button>
                    <div style={{fontSize:10,color:"var(--mu)"}}>of stel exact in:</div>
                    <input type="number" value={exactScore} onChange={e=>setExactScore(e.target.value)} placeholder="Exact getal" style={{flex:1,background:"#fff",border:"1.5px solid var(--bd)",borderRadius:9,padding:"7px 10px",color:"var(--dk)",fontSize:12,outline:"none"}} />
                    <button onClick={hostSetExact} style={{padding:"7px 12px",background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:9,color:"var(--gr-dk)",fontWeight:900,fontSize:12,cursor:"pointer"}}>✓</button>
                  </div>
                  {hostAdj&&(
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input type="number" value={adjVal} onChange={e=>setAdjVal(e.target.value)} placeholder="bijv. 3 of -2" style={{flex:1,background:"#fff",border:"1.5px solid var(--bd)",borderRadius:9,padding:"8px 12px",color:"var(--dk)",fontSize:13,outline:"none"}} />
                      <button onClick={()=>hostAdjScore(parseInt(adjVal)||0)} style={{padding:"8px 14px",background:"var(--gr-lt)",border:"1.5px solid var(--gr)",borderRadius:9,color:"var(--gr-dk)",fontWeight:900,fontSize:12,cursor:"pointer"}}>✓</button>
                      <button onClick={()=>setHostAdj(false)} style={{padding:"8px 10px",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:9,color:"var(--mu)",fontSize:12,cursor:"pointer"}}>✕</button>
                    </div>
                  )}
                </div>

                {/* Vakje tappen + undo info */}
                <div style={{fontSize:11,color:"var(--mu)",marginBottom:8,lineHeight:1.5}}>
                  Tik op vakje → tik namens {me.name}<br/>Lang indrukken op vakje → tik ongedaan maken
                </div>

                {/* Kaart aanpassen / wisselen */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <button onClick={()=>setHostCardEditOpen(true)} style={{padding:"9px 0",background:"#eff5ff",border:"1.5px solid var(--b)",borderRadius:9,color:"var(--b)",fontSize:12,fontWeight:800,cursor:"pointer"}}>✏️ Kaart wisselen</button>
                  <button onClick={hostRotate} style={{padding:"9px 0",background:"#f6f0ff",border:"1.5px solid var(--p)",borderRadius:9,color:"var(--p)",fontSize:12,fontWeight:800,cursor:"pointer"}}>🔀 Nieuwe kaart</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Log */}
        {(me.log||[]).length>0&&(
          <div style={{background:t.card,border:`1px solid ${t.bd}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:10,color:t.sub,letterSpacing:2,marginBottom:8}}>📜 GESCHIEDENIS</div>
            <div style={{maxHeight:160,overflowY:"auto"}}>
              {(me.log||[]).map((e,i)=>(
                <div key={e.id||i} style={{fontSize:12,padding:"5px 0",borderBottom:`1px solid ${t.bd}`,color:e.type==="bingo"?t.a:e.type==="at"?"var(--or)":t.sub,fontWeight:e.type==="bingo"?800:400}}>
                  {e.msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom player tabs */}
      <div className="np" style={{position:"fixed",bottom:0,left:0,right:0,background:t.bg,borderTop:`1px solid ${t.bd}`,padding:"10px 14px 20px",zIndex:40}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",maxWidth:460,margin:"0 auto",paddingBottom:2}}>
          {players.map(p=>{
            const c=COLORS[p.color]||COLORS.rood;
            const pL=LINES.filter(l=>l.every(i=>(p.counts||[])[i]>0)).length;
            const mine=p.color===myCol;
            const act=p.color===actCol;
            const host=p.color===sess.host_color;
            return(
              <div key={p.color} role="button" tabIndex={0} onClick={()=>setActCol(p.color)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setActCol(p.color);}}
                style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 10px",borderRadius:14,border:`2px solid ${act?c.a:c.bd}`,background:act?c.a+"22":"transparent",minWidth:62,position:"relative",cursor:"pointer"}}>
                <div style={{width:40,height:40,borderRadius:"50%",border:`2.5px solid ${c.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:act?c.a+"33":t.cell,position:"relative",boxShadow:act?`0 0 10px ${c.a}55`:"none"}}>
                  {p.avatar||"🎯"}
                  {mine&&<div style={{position:"absolute",top:-5,left:-5,background:c.a,color:"#000",borderRadius:999,padding:"1px 4px",fontSize:7,fontWeight:900,letterSpacing:.5}}>JIJ</div>}
                  {host&&<div style={{position:"absolute",top:-6,right:-5,fontSize:9,pointerEvents:"none"}}>👑</div>}
                  {pL>0&&<div style={{position:"absolute",bottom:-4,right:-4,background:c.a,color:"#000",borderRadius:999,width:14,height:14,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,border:`2px solid ${t.bg}`}}>{pL}</div>}
                </div>
                <div style={{fontSize:10,color:act?c.a:t.sub,fontWeight:act?900:600,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                {!S.hideD&&(p.total_slok||0)>0&&<div style={{fontSize:9,color:c.a,fontWeight:700}}>{p.total_slok}{em}</div>}
                {isH&&p.color!==myCol&&<button onClick={e=>{e.stopPropagation();if(window.confirm(`${p.name} verwijderen?`))onKick(p.color);}} style={{position:"absolute",top:-5,right:-5,background:"#f87171",border:"none",borderRadius:999,width:14,height:14,fontSize:7,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#000",cursor:"pointer",zIndex:2}}>✕</button>}
              </div>
            );
          })}
        </div>
      </div>

      {showSe&&<SettingsM S={S} upS={upS} onClose={()=>setShowSe(false)} />}

      {/* Host: kaart wisselen modal */}
      {hostCardEditOpen&&isH&&!isMy&&(
        <CardPicker
          pool={sess.event_pool}
          value={card}
          playerName={me?.name||actCol}
          playerColor={actCol}
          sessId={sess.id}
          dist={S.cardDist}
          onSave={hostSaveCard}
          onClose={()=>setHostCardEditOpen(false)}
        />
      )}
    </div>
  );
}

// ── Break Timer ───────────────────────────────────────────────────────────────
function BreakTimer({sess,isHost,t,onEnd}){
  const [secs,setSecs]=useState(0);
  useEffect(()=>{
    const calc=()=>{
      if(!sess.break_until)return setSecs(0);
      const rem=Math.max(0,Math.floor((new Date(sess.break_until)-Date.now())/1000));
      setSecs(rem);
    };
    calc();
    const iv=setInterval(calc,500);
    return()=>clearInterval(iv);
  },[sess.break_until]);
  if(!sess.break_until||secs===0)return null;
  const m=String(Math.floor(secs/60)).padStart(2,"0");
  const s=String(secs%60).padStart(2,"0");
  return(
    <div style={{background:"var(--gr-lt)",border:`2px solid ${t.a}`,borderRadius:14,padding:"14px 18px",marginBottom:12,textAlign:"center",animation:"fadeUp .2s",boxShadow:"var(--sh-sm)"}}>
      <div style={{fontSize:11,color:t.a,letterSpacing:2,fontWeight:900,marginBottom:4}}>☕ PAUZE</div>
      <div style={{fontSize:48,fontWeight:900,fontFamily:"monospace",color:"var(--dk)",lineHeight:1}}>{m}:{s}</div>
      {isHost&&<button onClick={onEnd} style={{marginTop:10,padding:"7px 20px",background:t.a+"22",border:`1.5px solid ${t.a}55`,borderRadius:9,color:t.a,fontWeight:900,fontSize:12,cursor:"pointer"}}>▶ Doorgaan</button>}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function HBtn({children,onClick,active,color}){
  return(
    <button onClick={onClick} style={{background:active?color+"22":"transparent",border:`1.5px solid ${active?color:"var(--bd)"}`,color:active?color:"var(--mu)",borderRadius:9,padding:"6px 9px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",minWidth:34,minHeight:34}}>
      {children}
    </button>
  );
}

function Rules({t,sl,em,isHost}){
  return(
    <div style={{background:t.card,border:`1px solid ${t.a}33`,borderRadius:12,padding:14,marginBottom:10,fontSize:13,lineHeight:1.8,animation:"fadeUp .2s"}}>
      <div style={{fontWeight:900,color:t.a,marginBottom:6,fontSize:14}}>📋 Spelregels</div>
      <div>🎯 Tik vakje aan als het voorkomt in de wedstrijd</div>
      <div>🔁 Meerdere keren tikken telt op</div>
      <div>↩️ Lang indrukken = 1 tik ongedaan maken</div>
      <div>✏️ Potloodje = vakje inhoud aanpassen</div>
      <div>{em} {sl} = jij · 🍻 iedereen drinkt</div>
      <div>🎉 Rij / kolom / diagonaal vol = BINGO straf!</div>
      {isHost&&<div style={{color:t.a,marginTop:4,fontWeight:700}}>👑 Host: volgende ronde of spel beëindigen</div>}
    </div>
  );
}

function Stats({players,S}){
  const em=S.gm==="punten"?"🏆":"🍺";
  const sorted=[...players].sort((a,b)=>(b.total_slok||0)-(a.total_slok||0));
  const top=sorted[0];
  const teams={};
  players.forEach(p=>{if(p.team){teams[p.team]=(teams[p.team]||0)+(p.total_slok||0);}});
  const evTot={};
  players.forEach(p=>(p.card||[]).forEach((ev,i)=>{const c=(p.counts||[])[i]||0;evTot[ev.label]=(evTot[ev.label]||0)+c;}));
  const best=Object.entries(evTot).sort((a,b)=>b[1]-a[1])[0];
  return(
    <div style={{background:"#fff",border:"1.5px solid var(--bd)",borderRadius:12,padding:14,marginBottom:10,animation:"fadeUp .2s",boxShadow:"var(--sh-sm)"}}>
      <div style={{fontWeight:900,color:"var(--or)",marginBottom:10,fontSize:14}}>📊 Statistieken</div>
      {sorted.map((p,i)=>{
        const c=COLORS[p.color]||COLORS.rood;
        const pct=top?.total_slok>0?((p.total_slok||0)/top.total_slok)*100:0;
        const pL=LINES.filter(l=>l.every(ii=>(p.counts||[])[ii]>0)).length;
        return(
          <div key={p.color} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <div style={{fontSize:13,width:22,textAlign:"center",fontWeight:900,color:i===0?"var(--or)":"var(--mu)"}}>#{i+1}</div>
            <div style={{fontSize:12,color:c.a,width:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:700}}>
              {p.avatar||"🎯"} {p.name}
              {pL>0&&<span style={{fontSize:10,marginLeft:4,opacity:.8}}>🏆{pL}</span>}
            </div>
            <div style={{flex:1,background:"var(--gr-lt)",borderRadius:5,height:7}}>
              <div style={{width:`${pct}%`,background:c.a,borderRadius:5,height:"100%",transition:"width .5s"}} />
            </div>
            <div style={{fontSize:12,fontWeight:900,color:c.a,minWidth:36,textAlign:"right"}}>{S.hideD?"•":((p.total_slok||0)+em)}</div>
          </div>
        );
      })}
      {Object.keys(teams).length>1&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--bd)",display:"flex",gap:12}}>
          {Object.entries(teams).map(([t,v])=>(
            <div key={t} style={{fontSize:12,color:"var(--or)",fontWeight:800}}>Team {t}: {v}{em}</div>
          ))}
        </div>
      )}
      {best&&best[1]>0&&<div style={{fontSize:11,color:"var(--mu)",marginTop:8}}>🏅 Meest: <b style={{color:"var(--dk)"}}>{best[0]}</b> ({best[1]}×)</div>}
    </div>
  );
}

function Chat({chat,onSend,myCol,t}){
  const [msg,setMsg]=useState("");
  const endR=useRef(null);
  useEffect(()=>endR.current?.scrollIntoView({behavior:"smooth"}),[chat]);
  const send=()=>{if(!msg.trim())return;onSend(msg.trim());setMsg("");};
  return(
    <div style={{background:t.card,border:`1px solid ${t.bd}`,borderRadius:12,padding:12,marginBottom:10,animation:"fadeUp .2s"}}>
      <div style={{fontSize:10,color:t.sub,letterSpacing:2,marginBottom:8}}>💬 CHAT</div>
      <div style={{maxHeight:130,overflowY:"auto",marginBottom:8}}>
        {!chat.length&&<div style={{fontSize:12,color:t.sub,textAlign:"center",padding:"12px 0"}}>Nog geen berichten…</div>}
        {chat.map((m,i)=>{
          const c=(COLORS[m.color]||COLORS.rood);
          return(
            <div key={m.id||i} style={{padding:"4px 0",borderBottom:`1px solid ${t.bd}`,fontSize:13}}>
              <span style={{color:c.a,fontWeight:800}}>{m.name}: </span>
              <span style={{color:t.tx}}>{m.message}</span>
            </div>
          );
        })}
        <div ref={endR} />
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Bericht…" style={{flex:1,background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:9,padding:"9px 12px",color:"var(--dk)",fontSize:13,outline:"none"}} />
        <button onClick={send} style={{background:t.a,border:"none",borderRadius:9,padding:"9px 16px",color:"#fff",fontWeight:900,fontSize:14,cursor:"pointer"}}>→</button>
      </div>
    </div>
  );
}

function SettingsM({S,upS,onClose}){
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="sheet">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:900,fontSize:17}}>⚙️ Instellingen</div>
          <button onClick={onClose} style={{background:"var(--gr-bg)",border:"1.5px solid var(--bd)",borderRadius:9,width:34,height:34,color:"var(--mu)",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <Sec lbl="🔊 Geluid">
          <SR2 lbl="Geluid aan"><Tog v={S.sound} set={v=>upS({sound:v})} /></SR2>
          <SR2 lbl={`Volume: ${~~(S.vol*100)}%`}>
            <input type="range" min="0" max="1" step=".05" value={S.vol} onChange={e=>upS({vol:+e.target.value})} style={{width:"100%",accentColor:"var(--gr)"}} />
          </SR2>
        </Sec>

        <Sec lbl="🍺 Gameplay">
          <SR2 lbl="Spelmodus">
            <div style={{display:"flex",gap:4}}>
              {[["slokken","🍺"],["punten","🏆"]].map(([m,em])=>(
                <button key={m} onClick={()=>upS({gm:m})} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${S.gm===m?"var(--gr)":"var(--bd)"}`,background:S.gm===m?"var(--gr-lt)":"transparent",color:S.gm===m?"var(--gr-dk)":"var(--mu)",fontSize:12,fontWeight:800,cursor:"pointer"}}>{em} {m}</button>
              ))}
            </div>
          </SR2>
          <SR2 lbl="Slok-schaal">
            <div style={{display:"flex",gap:4}}>
              {[.5,1,2].map(v=>(
                <button key={v} onClick={()=>upS({scale:v})} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${S.scale===v?"var(--gr)":"var(--bd)"}`,background:S.scale===v?"var(--gr-lt)":"transparent",color:S.scale===v?"var(--gr-dk)":"var(--mu)",fontSize:12,fontWeight:800,cursor:"pointer"}}>{v}×</button>
              ))}
            </div>
          </SR2>
          <SR2 lbl={`Max ${S.gm}: ${S.maxD||"∞"}`}>
            <input type="range" min="0" max="60" step="5" value={S.maxD} onChange={e=>upS({maxD:+e.target.value})} style={{width:"100%",accentColor:"var(--gr)"}} />
          </SR2>
          <SR2 lbl={`Min spelers: ${S.minP}`}>
            <input type="range" min="1" max="6" step="1" value={S.minP} onChange={e=>upS({minP:+e.target.value})} style={{width:"100%",accentColor:"var(--gr)"}} />
          </SR2>
          <SR2 lbl={`Max spelers: ${S.maxP}`}>
            <input type="range" min="1" max="6" step="1" value={S.maxP} onChange={e=>upS({maxP:+e.target.value})} style={{width:"100%",accentColor:"var(--gr)"}} />
          </SR2>
        </Sec>

        <Sec lbl="🎮 Interface">
          <SR2 lbl="Chat inschakelen"><Tog v={S.chat} set={v=>upS({chat:v})} /></SR2>
          <SR2 lbl="Verberg andermans score"><Tog v={S.hideD} set={v=>upS({hideD:v})} /></SR2>
          <SR2 lbl="Undo bevestiging"><Tog v={S.undoC} set={v=>upS({undoC:v})} /></SR2>
          <SR2 lbl="Reset bevestiging"><Tog v={S.resetC} set={v=>upS({resetC:v})} /></SR2>
        </Sec>

        <Sec lbl="🎯 Kaartsamenstelling">
          <SR2 lbl={`Makkelijk: ${S.cardDist?.easy??3} vakjes`}>
            <input type="range" min="0" max="6" step="1" value={S.cardDist?.easy??3} onChange={e=>{const easy=+e.target.value;const rest=6-easy;const medium=Math.min(S.cardDist?.medium??2,rest);const hard=Math.max(0,rest-medium);upS({cardDist:{easy,medium,hard}});}} style={{width:"100%",accentColor:"var(--gr)"}} />
          </SR2>
          <SR2 lbl={`Gemiddeld: ${S.cardDist?.medium??2} vakjes`}>
            <input type="range" min="0" max="6" step="1" value={S.cardDist?.medium??2} onChange={e=>{const medium=+e.target.value;const rest=6-(S.cardDist?.easy??3);const hard=Math.max(0,Math.min(rest-medium,rest));upS({cardDist:{...(S.cardDist||{}),medium,hard}});}} style={{width:"100%",accentColor:"var(--or)"}} />
          </SR2>
          <SR2 lbl={`Moeilijk: ${S.cardDist?.hard??1} vakjes`}>
            <input type="range" min="0" max="6" step="1" value={S.cardDist?.hard??1} onChange={e=>{const hard=+e.target.value;const easy=S.cardDist?.easy??3;const medium=Math.max(0,6-easy-hard);upS({cardDist:{...(S.cardDist||{}),hard,medium}});}} style={{width:"100%",accentColor:"var(--r)"}} />
          </SR2>
          <div style={{padding:"6px 14px",fontSize:11,color:(((S.cardDist?.easy??3)+(S.cardDist?.medium??2)+(S.cardDist?.hard??1))===6)?"var(--gr)":"var(--r)"}}>
            Totaal: {(S.cardDist?.easy??3)+(S.cardDist?.medium??2)+(S.cardDist?.hard??1)}/6 reguliere vakjes {(((S.cardDist?.easy??3)+(S.cardDist?.medium??2)+(S.cardDist?.hard??1))===6)?"✓":"⚠️ Moet 6 zijn"}
          </div>
        </Sec>

        <Sec lbl="🔧 Geavanceerd">
          <SR2 lbl="Debug mode"><Tog v={S.debug} set={v=>upS({debug:v})} /></SR2>
        </Sec>

        <Btn onClick={onClose} color="var(--gr)">✓ Sluiten</Btn>
      </div>
    </div>
  );
}

function Sec({lbl,children}){
  return(
    <div style={{marginBottom:18}}>
      <div style={{fontSize:10,color:"var(--mu)",letterSpacing:3,fontWeight:900,marginBottom:8}}>{lbl}</div>
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",border:"1.5px solid var(--bd)",boxShadow:"var(--sh-sm)"}}>
        {children}
      </div>
    </div>
  );
}
function SR2({lbl,children}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:"1px solid var(--bd)"}}>
      <div style={{fontSize:13,color:"var(--dk)"}}>{lbl}</div>
      <div style={{flexShrink:0,marginLeft:12}}>{children}</div>
    </div>
  );
}
function Tog({v,set}){
  return(
    <button onClick={()=>set(!v)} style={{background:v?"var(--gr-lt)":"var(--gr-bg)",border:`1.5px solid ${v?"var(--gr)":"var(--bd)"}`,borderRadius:20,padding:"5px 12px",color:v?"var(--gr-dk)":"var(--mu)",fontWeight:900,fontSize:12,cursor:"pointer",minWidth:52,transition:"all .15s"}}>
      {v?"AAN":"UIT"}
    </button>
  );
}

// ── Winner ────────────────────────────────────────────────────────────────────
function Winner({winData,onBack,onRematch,S}){
  const [rats,setRats]=useState({});
  const [saved,setSaved]=useState(false);
  const [rmBusy,setRmBusy]=useState(false);
  const em=S.gm==="punten"?"🏆":"🍺";
  if(!winData)return null;
  const{players,sess}=winData;
  const sorted=[...players].sort((a,b)=>(b.total_slok||0)-(a.total_slok||0));

  async function saveRats(){
    for(const[col,r]of Object.entries(rats))
      await sb.from("bingo_players").update({rating:r}).eq("session_id",sess.id).eq("color",col);
    setSaved(true);
  }

  const winner = sorted[0];
  const winC = winner ? (COLORS[winner.color]||COLORS.rood) : COLORS.rood;
  const winPL = winner ? LINES.filter(l=>l.every(ii=>(winner.counts||[])[ii]>0)).length : 0;

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",padding:"0 0 40px"}}>
      {/* Hero header */}
      <div style={{textAlign:"center",padding:"36px 20px 20px",background:"linear-gradient(180deg,var(--gr-lt) 0%,var(--bg) 100%)"}}>
        <div className="neon-lbl" style={{marginBottom:12}}>DE OCHE IS GESLOTEN</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:6}}>
          <div style={{fontSize:42,animation:"trophy .8s ease-out"}}>🏆</div>
          <div className="anto" style={{fontSize:"clamp(2.2rem,10vw,3.4rem)",color:"var(--gr-dk)",lineHeight:.9}}>BAAS VAN<br/>DE AVOND</div>
        </div>
        {winner&&<div style={{fontSize:13,color:"var(--mu)",marginTop:10}}>Meeste slokken uitgedeeld{winPL>0?` én ${winPL}× bingo`:""}</div>}
      </div>

      <div style={{padding:"0 16px",maxWidth:460,margin:"0 auto"}}>
        {/* Winner card */}
        {winner&&(
          <div style={{background:"#fff",border:`2px solid ${winC.a}66`,borderRadius:22,padding:"24px 20px",marginBottom:20,textAlign:"center",boxShadow:`0 6px 22px ${winC.a}22`}}>
            <div style={{width:72,height:72,borderRadius:"50%",border:`3px solid ${winC.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,background:winC.cell,margin:"0 auto 12px",boxShadow:`0 2px 14px ${winC.a}44`}}>
              {winner.avatar||"🎯"}
            </div>
            <div className="anto" style={{fontSize:28,letterSpacing:2,marginBottom:16,color:"var(--dk)"}}>{(winner.name||winC.lbl).toUpperCase()}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[[(winner.total_slok||0),"UITGEDEELD"],[winPL,"BINGO'S"],[(winner.achievements||[]).length,"BADGES"]].map(([v,lbl])=>(
                <div key={lbl} style={{background:winC.cell,borderRadius:12,padding:"12px 8px",border:`1px solid ${winC.bd}`}}>
                  <div style={{fontSize:30,fontWeight:900,color:winC.a,lineHeight:1}}>{v}</div>
                  <div className="neon-lbl" style={{marginTop:4}}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Podium */}
        {sorted.length>=2&&(
          <div className="podium-wrap" style={{marginBottom:24}}>
            {/* 2nd */}
            {sorted[1]&&(()=>{const p=sorted[1];const c=COLORS[p.color]||COLORS.rood;return(
              <div className="podium-col">
                <div style={{width:48,height:48,borderRadius:"50%",border:`2.5px solid ${c.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,background:c.cell}}>{p.avatar||"🎯"}</div>
                <div style={{fontSize:11,color:c.a,fontWeight:700,textAlign:"center"}}>{p.name}</div>
                <div style={{fontSize:10,color:"var(--mu)"}}>🍺 {p.total_slok||0}</div>
                <div style={{background:"#d4ddd4",borderRadius:"10px 10px 0 0",height:64,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",animation:"podiumRise .7s .5s ease-out both",transformOrigin:"bottom"}}>
                  <span className="anto" style={{fontSize:28,color:"var(--mu)"}}>2</span>
                </div>
              </div>
            );})()}
            {/* 1st */}
            {sorted[0]&&(()=>{const p=sorted[0];const c=COLORS[p.color]||COLORS.rood;return(
              <div className="podium-col" style={{flex:1.2}}>
                <div style={{width:58,height:58,borderRadius:"50%",border:`3px solid ${c.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,background:c.cell,boxShadow:`0 2px 12px ${c.a}55`,animation:"playerDrop .6s .9s ease-out both"}}>{p.avatar||"🎯"}</div>
                <div style={{fontSize:13,color:c.a,fontWeight:800,textAlign:"center",animation:"playerDrop .5s 1s ease-out both"}}>{p.name}</div>
                <div style={{fontSize:11,color:"var(--gr)",fontWeight:700,animation:"playerDrop .5s 1.05s ease-out both"}}>🍺 {p.total_slok||0}</div>
                <div style={{background:"var(--gr)",borderRadius:"10px 10px 0 0",height:96,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",animation:"podiumRise .7s .3s ease-out both",transformOrigin:"bottom"}}>
                  <span className="anto" style={{fontSize:36,color:"#fff"}}>1</span>
                </div>
              </div>
            );})()}
            {/* 3rd */}
            {sorted[2]&&(()=>{const p=sorted[2];const c=COLORS[p.color]||COLORS.rood;return(
              <div className="podium-col">
                <div style={{width:44,height:44,borderRadius:"50%",border:`2px solid ${c.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,background:c.cell}}>{p.avatar||"🎯"}</div>
                <div style={{fontSize:10,color:c.a,fontWeight:700,textAlign:"center"}}>{p.name}</div>
                <div style={{fontSize:9,color:"var(--mu)"}}>🍺 {p.total_slok||0}</div>
                <div style={{background:"#e8d8b0",borderRadius:"10px 10px 0 0",height:44,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",animation:"podiumRise .7s .65s ease-out both",transformOrigin:"bottom"}}>
                  <span className="anto" style={{fontSize:24,color:"#a07838"}}>3</span>
                </div>
              </div>
            );})()}
          </div>
        )}

        {/* Buttons */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
          <button onClick={onBack} style={{padding:"14px 0",background:"transparent",border:"1.5px solid var(--bd)",borderRadius:14,color:"var(--dk)",fontWeight:900,fontSize:14,cursor:"pointer"}}>Nieuw spel</button>
          <Btn onClick={async()=>{
            setRmBusy(true);
            const pcs=players.map(p=>({color:p.color,name:p.name,avatar:p.avatar,team:p.team||null}));
            await onRematch(pcs);
            setRmBusy(false);
          }} loading={rmBusy} color="var(--gr)">🔄 Revanche →</Btn>
        </div>

      {/* Badge-gallerij */}
      <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:16,border:"1.5px solid var(--bd)",boxShadow:"var(--sh-sm)"}}>
        <div style={{fontWeight:900,color:"var(--or)",fontSize:13,letterSpacing:2,marginBottom:4}}>🏅 BADGE GALLERIJ</div>
        <div style={{fontSize:11,color:"var(--mu)",marginBottom:12}}>Grijs = nog niet behaald</div>
        {sorted.map(p=>{
          const c=COLORS[p.color]||COLORS.rood;
          const earned=new Set(p.achievements||[]);
          return(
            <div key={p.color} style={{marginBottom:14}}>
              <div style={{fontSize:12,color:c.a,fontWeight:800,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                <span>{p.avatar||"🎯"}</span>{p.name}
                <span style={{fontSize:10,color:"var(--mu)",fontWeight:400}}>({earned.size}/{ACHS.length} badges)</span>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {ACHS.map(a=>{
                  const got=earned.has(a.id);
                  return(
                    <div key={a.id} title={a.d} style={{background:got?c.cell:"var(--gr-bg)",borderRadius:9,padding:"5px 9px",fontSize:12,border:`1px solid ${got?c.a+"66":"var(--bd)"}`,opacity:got?1:.45,display:"flex",alignItems:"center",gap:4,transition:"opacity .2s"}}>
                      <span style={{fontSize:15}}>{a.e}</span>
                      <span style={{color:got?c.tx:"var(--mu)",fontWeight:got?800:400,fontSize:11}}>{a.lbl}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rating */}
      <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:16,border:"1.5px solid var(--bd)",boxShadow:"var(--sh-sm)"}}>
        <div style={{fontWeight:900,color:"var(--or)",fontSize:13,letterSpacing:2,marginBottom:4}}>⭐ BEOORDELING</div>
        <div style={{fontSize:12,color:"var(--mu)",marginBottom:12}}>Hoe vond je de avond?</div>
        {sorted.map(p=>{
          const c=COLORS[p.color]||COLORS.rood;
          const r=rats[p.color]||0;
          return(
            <div key={p.color} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{fontSize:13,color:c.a,fontWeight:700,minWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
              <div style={{display:"flex",gap:2}}>
                {[1,2,3,4,5].map(s=>(
                  <button key={s} onClick={()=>setRats(rv=>({...rv,[p.color]:s}))} style={{fontSize:20,background:"transparent",border:"none",cursor:"pointer",opacity:s<=r?1:.25,padding:0,lineHeight:1}}>⭐</button>
                ))}
              </div>
            </div>
          );
        })}
        <Btn onClick={saveRats} color={saved?"var(--mu)":"var(--gr)"} style={{marginTop:8}}>{saved?"✓ Opgeslagen":"Sla beoordelingen op"}</Btn>
      </div>

      {/* Ronde overzicht */}
      {(sorted[0]?.round_data||[]).length>0&&(
        <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:16,border:"1.5px solid var(--bd)",boxShadow:"var(--sh-sm)"}}>
          <div style={{fontWeight:900,color:"var(--or)",fontSize:13,letterSpacing:2,marginBottom:10}}>📋 RONDES</div>
          {(sorted[0].round_data||[]).map((rd,i)=>(
            <div key={i} style={{fontSize:12,color:"var(--mu)",padding:"5px 0",borderBottom:"1px solid var(--bd)"}}>
              R{rd.round}: {sorted.map(p=>{const r=(p.round_data||[])[i];return r?`${p.name} ${r.slok}${em}`:null;}).filter(Boolean).join(" · ")}
            </div>
          ))}
        </div>
      )}

      <Btn onClick={onBack} color="var(--gr)">← Terug naar lobby</Btn>
      </div>
    </div>
  );
}

// ── Shared Button ─────────────────────────────────────────────────────────────
function Btn({children,onClick,color,loading,disabled,style={}}){
  return(
    <button onClick={onClick} disabled={loading||disabled} style={{display:"block",width:"100%",padding:"13px 0",background:disabled?"var(--gr-bg)":color,border:`1.5px solid ${disabled?"var(--bd)":color}`,borderRadius:12,color:disabled?"var(--mu)":"#fff",fontWeight:900,fontSize:15,cursor:disabled?"not-allowed":"pointer",letterSpacing:.5,opacity:loading?.6:1,transition:"opacity .15s",...style}}>
      {loading?"…laden":children}
    </button>
  );
}
