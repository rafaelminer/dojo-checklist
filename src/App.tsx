import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ClipboardCheck, LayoutDashboard, MessageCircle, LogOut, Eye, EyeOff, QrCode, Download, Sparkles, Camera, Images, Trash2, Sun, Moon, X, Bell, Mic, Share2 } from "lucide-react";
import { api, flushQueue, getAuthToken, queueSize, setAuthToken } from "./api";
import { supabaseCreateUser, supabaseSignIn } from "./auth";
import { comparePhotos } from "./vision";
import { translate, type Lang } from "./i18n";
import CameraGuide from "./components/CameraGuide";
const ChatScreen = lazy(() => import("./screens/ChatScreen"));
const DashboardScreen = lazy(() => import("./screens/DashboardScreen"));
const ChecklistScreen = lazy(() => import("./screens/ChecklistScreen"));
import { enablePush, getPushStatus, notifyMessage, pushSupported } from "./push";
import QrModal from "./components/QrModal";
import SignatureModal from "./components/SignatureModal";
import PhotoViewerModal from "./components/PhotoViewerModal";
import VoiceModal from "./components/VoiceModal";
import ProductSheet from "./components/ProductSheet";

import type { Freq, Status, Section, Item, Entry, ChatMsg, SubmissionItem, Submission, ActionPlan, Handover, Shortage, WeeklySubmission, ExpiryEntry, MaintEntry, CredentialRecord, SignatureRecord, TempEntry, ShiftEntry, RecordRow, TaskRecord, LogbookRecord, TrainingRecord, InstructionRecord, StockItemRecord, StockCountRecord, ReceivingRecord, TempLimitRecord, ItemRuleRecord, QuestionRecord, QualityAnswerRecord, TemplateRecord, CustomItemsRecord, Tab, ChecklistRecord, ChecklistItemRecord, TaskTemplate } from "./data";
import { PROFILES, KIOSK_PROFILES, KIOSK_NIGHT_PROFILES, STATIONS, LOGIN_TO_PROFILE, DEFAULT_PASSWORD, STAFF_PROFILES, GROUP_CHANNELS, today, brazilNowString, fmtDate, nowTime, normalizeLogin, hashPassword, formatOverdue, addDays, daysBetween, parseTempValue, PISTA_GUIDE, byProfile, ALL_ITEMS, ITEM_DEPENDENCIES, SECTIONS, WEEKLY_ITEMS, OVERVIEW_FILTER_PEOPLE, MAINT_ITEMS, weekKeyFor, sectionsForProfile, complianceColor } from "./data";
function drawQrCode(canvas:HTMLCanvasElement,text:string){
  const modules=29, quiet=4, size=modules+quiet*2, cell=10;
  canvas.width=size*cell; canvas.height=size*cell;
  const ctx=canvas.getContext("2d"); if(!ctx) return;
  ctx.fillStyle="#FFFFFF"; ctx.fillRect(0,0,canvas.width,canvas.height);
  let seed=2166136261; for(let i=0;i<text.length;i++){ seed^=text.charCodeAt(i); seed=Math.imul(seed,16777619); }
  const rand=()=>{ seed=Math.imul(seed^seed>>>15,2246822519); seed^=seed>>>13; return ((seed>>>0)%100)/100; };
  const grid:boolean[][]=Array.from({length:size},()=>Array(size).fill(false));
  const reserved:boolean[][]=Array.from({length:size},()=>Array(size).fill(false));
  const finder=(ox:number,oy:number)=>{ for(let y=-1;y<8;y++) for(let x=-1;x<8;x++){ const xx=ox+x, yy=oy+y; if(xx<0||yy<0||xx>=size||yy>=size) continue; reserved[yy][xx]=true; const edge=x===-1||x===7||y===-1||y===7; const ring=x>=0&&x<7&&y>=0&&y<7&&(x===0||x===6||y===0||y===6); const core=x>=2&&x<=4&&y>=2&&y<=4; grid[yy][xx]=edge?false:(ring||core); } };
  finder(quiet,quiet); finder(size-quiet-7,quiet); finder(quiet,size-quiet-7);
  for(let i=0;i<size;i++){ if(!reserved[quiet+6][i]){ reserved[quiet+6][i]=true; grid[quiet+6][i]=i%2===0; } if(!reserved[i][quiet+6]){ reserved[i][quiet+6]=true; grid[i][quiet+6]=i%2===0; } }
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){ if(!reserved[y][x]) grid[y][x]=rand()>0.52; }
  ctx.fillStyle="#111111"; for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(grid[y][x]) ctx.fillRect(x*cell,y*cell,cell,cell);
}
function freqStyle(f:Freq){
  if(f==="DIÁRIO") return {background:"color-mix(in srgb, var(--green) 16%, transparent)",color:"var(--success-text)",label:"DIÁRIO"};
  if(f==="SEMANAL") return {background:"var(--warning-bg)",color:"var(--warning-text)",label:"SEMANAL"};
  return {background:"color-mix(in srgb, var(--primary) 13%, transparent)",color:"var(--primary)",label:"MENSAL"};
}
const AVATAR_COLORS = ["#FF6B1A","var(--green)","#00A884","#8E24AA","#039BE5","#D81B60","#F9A825","#00897B","#5E35B1","#EF6C00"];
function avatarColor(name:string){ let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))%1000; return AVATAR_COLORS[h%AVATAR_COLORS.length]; }
function initials(name:string){ return name.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase(); }
function toNonNegativeInt(value: string | number | undefined | null): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
function statusLabel(s: Status): string {
  if(s==="Feito") return "Feito";
  if(s==="Não feito") return "Não feito";
  return "Sem marcação";
}
function Stepper({ value, onChange, label, disabled }: { value: number; onChange: (n: number) => void; label: string; disabled?: boolean }) {
  return <div className="flex items-stretch gap-2 mt-2" role="group" aria-label={label}>
    <button type="button" disabled={disabled} aria-label={`Diminuir ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-extrabold text-[22px] leading-none grid place-items-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">−</button>
    <input aria-label={label} disabled={disabled} inputMode="numeric" pattern="[0-9]*" value={String(value)} onChange={(ev) => { const cleaned = ev.target.value.replace(/[^\d]/g, ""); onChange(cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10))); }} className="field !mt-0 !py-0 h-12 min-h-[48px] text-center font-extrabold text-[20px] flex-1 min-w-0 disabled:opacity-50" />
    <button type="button" disabled={disabled} aria-label={`Aumentar ${label}`} onClick={() => onChange(value + 1)} className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-[var(--primary)] text-white font-extrabold text-[22px] leading-none grid place-items-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
  </div>;
}

// ---- Fotos: câmera, galeria e exclusão ----
function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida. Tire outra foto."));
    img.src = src;
  });
}
function drawCompressed(img: HTMLImageElement, maxSide: number, quality: number): string {
  const ratio = Math.min(1, maxSide / Math.max(1, img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * ratio));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  const original = await readImageAsDataUrl(file);
  if (original.length <= 500000) return original;
  const img = await loadImage(original);
  let side = 1280, quality = 0.72, out = "";
  for (let i = 0; i < 5; i++) {
    out = drawCompressed(img, side, quality);
    if (out && out.length <= 500000) return out;
    side = Math.round(side * 0.75);
    quality = Math.max(0.5, quality - 0.08);
  }
  return out || original;
}
function PhotoField({ value, onChange, label, disabled, onPreview }: { value: string; onChange: (dataUrl: string) => void; label?: string; disabled?: boolean; onPreview?: (src: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const title = label || "Foto";
  async function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const input = ev.currentTarget;
    const file = input.files && input.files[0];
    if (!file) return;
    setBusy(true); setError("");
    try { onChange(await compressPhoto(file)); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível usar esta foto."); }
    finally { input.value = ""; setBusy(false); }
  }
  return <div className="mt-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-inset)] px-3 py-3">
    <p className="text-[13px] font-bold flex items-center gap-1.5"><Camera size={15} /> {title}</p>
    <p className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">Tire uma foto com a câmera ou escolha uma da galeria. Depois você pode excluir a foto.</p>
    {value ? <div className="mt-3">
      {onPreview
        ? <button type="button" onClick={() => onPreview(value)} className="photo-thumb w-full max-w-[260px] aspect-[4/3]" aria-label={`Ampliar ${title}`}><img src={value} alt={`Prévia de ${title}`} className="w-full h-full object-cover" /></button>
        : <img src={value} alt={`Prévia de ${title}`} className="w-full max-w-[260px] rounded-xl border border-[var(--line)]" />}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => cameraRef.current?.click()} className="flex-1 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold py-2.5 rounded-xl text-[13px] disabled:opacity-50 pressable">Tirar outra</button>
        <button type="button" disabled={disabled || busy} onClick={() => galleryRef.current?.click()} className="flex-1 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold py-2.5 rounded-xl text-[13px] disabled:opacity-50 pressable">Da galeria</button>
        <button type="button" disabled={disabled || busy} onClick={() => { onChange(""); setError(""); }} className="flex-1 bg-[var(--danger)] text-white font-extrabold py-2.5 rounded-xl text-[13px] disabled:opacity-50 pressable"><Trash2 size={14} className="inline mr-1" />Excluir foto</button>
      </div>
    </div> : <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={disabled || busy} onClick={() => cameraRef.current?.click()} className="flex-1 bg-[var(--primary)] text-white font-extrabold py-2.5 rounded-xl text-[13px] disabled:opacity-50 pressable"><Camera size={14} className="inline mr-1" />Tirar foto</button>
      <button type="button" disabled={disabled || busy} onClick={() => galleryRef.current?.click()} className="flex-1 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold py-2.5 rounded-xl text-[13px] disabled:opacity-50 pressable"><Images size={14} className="inline mr-1" />Da galeria</button>
    </div>}
    {busy && <p className="text-[12px] text-[var(--muted)] mt-2">Preparando foto…</p>}
    {error && <p role="alert" className="text-[12px] font-bold text-[var(--danger-text)] mt-2">{error}</p>}
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFile} aria-label={`Tirar foto — ${title}`} />
    <input ref={galleryRef} type="file" accept="image/*" className="sr-only" onChange={handleFile} aria-label={`Escolher foto da galeria — ${title}`} />
  </div>;
}

export default function App(){
  const [authUser,setAuthUser]=useState<string|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [date,setDate]=useState(today());
  const [perfil,setPerfil]=useState("Normal");
  const [turno,setTurno]=useState("Manhã");
  const [period,setPeriod]=useState<"DIÁRIO"|"SEMANAL"|"MENSAL">("DIÁRIO");
  const [entries,setEntries]=useState<Record<string,{id:string,value:Entry}>>({});
  const [chat,setChat]=useState<{id:string,value:ChatMsg}[]>([]);
  const [submissions,setSubmissions]=useState<Record<string,{id:string,value:Submission}>>({});
  const [temps,setTemps]=useState<Record<string,{id:string,value:TempEntry}>>({});
  const [shifts,setShifts]=useState<Record<string,{id:string,value:ShiftEntry}>>({});
  const [actionPlans,setActionPlans]=useState<Record<string,{id:string,value:ActionPlan}>>({});
  const [handovers,setHandovers]=useState<{id:string,value:Handover}[]>([]);
  const [shortages,setShortages]=useState<Record<string,{id:string,value:Shortage}>>({});
  const [weeklySubs,setWeeklySubs]=useState<Record<string,{id:string,value:WeeklySubmission}>>({});
  const [handoverDialogOpen,setHandoverDialogOpen]=useState(false);
  const [pendingHandoverSection,setPendingHandoverSection]=useState<Section|null>(null);
  const [handoverText,setHandoverText]=useState("");
  const [handoverSaving,setHandoverSaving]=useState(false);
  const [weeklyOpen,setWeeklyOpen]=useState(false);
  const [expiries,setExpiries]=useState<Record<string,{id:string,value:ExpiryEntry}>>({});
  const [maintenance,setMaintenance]=useState<Record<string,{id:string,value:MaintEntry}>>({});
  const [checklists,setChecklists]=useState<{id:string,value:ChecklistRecord}[]>([]);
  const [checklistItems,setChecklistItems]=useState<{id:string,value:ChecklistItemRecord}[]>([]);
  const [taskTemplates,setTaskTemplates]=useState<{id:string,value:TaskTemplate}[]>([]);
  const [credentials,setCredentials]=useState<{id:string,value:CredentialRecord}[]>([]);
  const [tasks,setTasks]=useState<{id:string,value:TaskRecord}[]>([]);
  const [logbook,setLogbook]=useState<{id:string,value:LogbookRecord}[]>([]);
  const [trainings,setTrainings]=useState<{id:string,value:TrainingRecord}[]>([]);
  const [instructions,setInstructions]=useState<{id:string,value:InstructionRecord}[]>([]);
  const [stockItems,setStockItems]=useState<{id:string,value:StockItemRecord}[]>([]);
  const [stockCounts,setStockCounts]=useState<{id:string,value:StockCountRecord}[]>([]);
  const [receivings,setReceivings]=useState<{id:string,value:ReceivingRecord}[]>([]);
  const [tempLimits,setTempLimits]=useState<{id:string,value:TempLimitRecord}[]>([]);
  const [itemRules,setItemRules]=useState<{id:string,value:ItemRuleRecord}[]>([]);
  const [questions,setQuestions]=useState<{id:string,value:QuestionRecord}[]>([]);
  const [qualityAnswers,setQualityAnswers]=useState<{id:string,value:QualityAnswerRecord}[]>([]);
  const [qualityDraft,setQualityDraft]=useState<Record<string,{verdict?:string;answer?:string;note?:string;photo?:string;temperature?:string}>>({});
  const [historyDate,setHistoryDate]=useState(today());
  const [historyMonth,setHistoryMonth]=useState(today().slice(0,7));
  const [consolidated,setConsolidated]=useState<{destaques:string[];inconsistencias:string[];riscos:string[];oportunidades:string[]}|null>(null);
  const [reportFilters,setReportFilters]=useState<{unit:string;person:string;section:string}>({unit:"Todas",person:"Todos",section:"Todas"});
  const [unitFilter,setUnitFilter]=useState("Todas");
  const [dashTab,setDashTab]=useState<"conferencia"|"equipe"|"qualidade">("conferencia");
  const [signatureOpen,setSignatureOpen]=useState(false);
  const [signatures,setSignatures]=useState<{id:string;value:SignatureRecord}[]>([]);
  const [templates,setTemplates]=useState<{id:string;value:TemplateRecord}[]>([]);
  const [customItems,setCustomItems]=useState<{id:string;value:CustomItemsRecord}[]>([]);
  const [cameraQuestion,setCameraQuestion]=useState<string|null>(null);
  const [guidedOpen,setGuidedOpen]=useState(false);
  const [guidedStep,setGuidedStep]=useState(0);
  const [guidedSection,setGuidedSection]=useState("");
  const [guidedAnswers,setGuidedAnswers]=useState<Record<string,any>>({});
  const [guidedResult,setGuidedResult]=useState(false);
  const [guidedSaving,setGuidedSaving]=useState(false);
  const [guidedCameraOpen,setGuidedCameraOpen]=useState(false);
  const signatureCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);
  const [reads,setReads]=useState<{id:string,value:{messageId:string;profile:string;at:string}}[]>([]);
  const [auxForm,setAuxForm]=useState<Record<string,string>>({});
  const [staffForm,setStaffForm]=useState<Record<string,string>>({});
  const [staffEditingId,setStaffEditingId]=useState<string|null>(null);
  const [staffSaving,setStaffSaving]=useState(false);
  const [staffMsg,setStaffMsg]=useState("");
  const [missingCollections,setMissingCollections]=useState<string[]>([]);
  const [moduleErrors,setModuleErrors]=useState<Record<string,string>>({});
  const [moduleTab,setModuleTab]=useState<string>("checklists");
  const [moduleForm,setModuleForm]=useState<Record<string,string>>({});
  const [moduleEditingId,setModuleEditingId]=useState<string|null>(null);
  const [moduleConfirmDelete,setModuleConfirmDelete]=useState<string|null>(null);
  const [moduleSaving,setModuleSaving]=useState(false);
  const [moduleMsg,setModuleMsg]=useState("");
  const [validityOpen,setValidityOpen]=useState(false);
  const [expiryProduct,setExpiryProduct]=useState("");
  const [expiryDateInput,setExpiryDateInput]=useState("");
  const [expirySaving,setExpirySaving]=useState(false);
  const [maintOpen,setMaintOpen]=useState(false);
  const [maintNoteDraft,setMaintNoteDraft]=useState<Record<string,string>>({});
  const maintTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [overviewPerson,setOverviewPerson]=useState("Todos");
  const [historySearch,setHistorySearch]=useState("");
  const [weeklySaving,setWeeklySaving]=useState(false);
  const [tempFria,setTempFria]=useState("");
  const [tempFreezer,setTempFreezer]=useState("");
  const [tempSaving,setTempSaving]=useState(false);
  const [showTodayDone,setShowTodayDone]=useState(false);
  const [draftAt,setDraftAt]=useState("");
  const [weeklySummaryOpen,setWeeklySummaryOpen]=useState(false);
  const [rankingOpen,setRankingOpen]=useState(false);
  const escalatedSentRef = useRef<Set<string>>(new Set());
  const [guideOpen,setGuideOpen]=useState<Record<string,boolean>>({});
  const [onlyMissing,setOnlyMissing]=useState(false);
  const [tempOpen,setTempOpen]=useState(false);
  const [showPrevious,setShowPrevious]=useState(false);
  const [aiInsights,setAiInsights]=useState<string[]|null>(null);
  const [stationQrOpen,setStationQrOpen]=useState(false);
  const [stationQrInfo,setStationQrInfo]=useState<{label:string;url:string}>({label:"",url:""});
  const [productItem,setProductItem]=useState<Item|null>(null);
  const [listening,setListening]=useState(false);
  const [quickEntryOpen,setQuickEntryOpen]=useState(false);
  const [quickEntryText,setQuickEntryText]=useState("");
  const stationQrCanvasRef=useRef<HTMLCanvasElement|null>(null);
  const chatScrollRef=useRef<HTMLDivElement|null>(null);
  const chatEndRef=useRef<HTMLDivElement|null>(null);
  const appLink = typeof window!=="undefined" ? `${window.location.origin}${window.location.pathname}` : "Dojo Checklist";
  const lastTempKey = useRef("");
  const tempTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft,setDraft]=useState("");
  const [recording,setRecording]=useState(false);
  const mediaRecorderRef=useRef<MediaRecorder|null>(null);
  const audioChunksRef=useRef<Blob[]>([]);
  const recordStartRef=useRef(0);
  const readMarkedRef=useRef("");
  const [occurrenceOpen,setOccurrenceOpen]=useState(false);
  const [occurrenceText,setOccurrenceText]=useState("");
  const [occurrenceSending,setOccurrenceSending]=useState(false);
  const [justDraft,setJustDraft]=useState<Record<string,string>>({});
  const [justOpen,setJustOpen]=useState<Record<string,boolean>>({});
  const [justSaving,setJustSaving]=useState<Record<string,boolean>>({});
  const [justSaved,setJustSaved]=useState<Record<string,boolean>>({});
  const justTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const QUICK_REASONS = ["Já foi produzido","Faltou insumo","Equipamento quebrou","Sem tempo / pico","Produto vencido","Outro"];
  const [msg,setMsg]=useState("");
  const [offlineMode,setOfflineMode]=useState(false);
  const [connectionError,setConnectionError]=useState("");
  const [queuedCount,setQueuedCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [tab,setTab]=useState<Tab>("checklist");
  const [conversation,setConversation]=useState<string|null>(null);
  const [loginInput,setLoginInput]=useState("");
  const [passwordInput,setPasswordInput]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [rememberMe,setRememberMe]=useState(false);
  const [loginError,setLoginError]=useState("");
  const [attempts,setAttempts]=useState<Record<string,number>>({});
  const [lockedUntil,setLockedUntil]=useState<Record<string,number>>({});
  const [nowTick,setNowTick]=useState(Date.now());
  const [theme,setTheme]=useState<"light"|"dark">(()=>{ try{ const stored=localStorage.getItem("dojo-theme"); if(stored==="dark"||stored==="light") return stored; return "dark"; }catch{ return "dark"; } });
  const [lang,setLang]=useState<Lang>(()=>{ try{ return localStorage.getItem("dojo-lang")==="en"?"en":"pt"; }catch{ return "pt"; } });
  const t = (key:string) => translate(lang,key);
  const [pushOn,setPushOn]=useState(false);
  const [pushBusy,setPushBusy]=useState(false);
  const [pushInfo,setPushInfo]=useState("");
  useEffect(()=>{ try{ document.documentElement.dataset.theme=theme; localStorage.setItem("dojo-theme",theme); }catch{} },[theme]);
  useEffect(()=>{ try{ localStorage.setItem("dojo-lang",lang); document.documentElement.lang=lang; }catch{} },[lang]);
  useEffect(()=>{
    try{
      const posto = new URLSearchParams(window.location.search).get("posto");
      if(posto) setLoginInput(posto);
    }catch{}
  },[]);
  const [toast,setToast]=useState<{text:string;undo?:()=>void}|null>(null);
  const [photoViewer,setPhotoViewer]=useState<{src:string;label:string;onDelete?:()=>void}|null>(null);
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),5200); return ()=>clearTimeout(t); },[toast]);
  useEffect(()=>{ if(msg && authUser) setToast({text:msg}); },[msg,authUser]);
  useEffect(()=>{ const onKey=(ev:KeyboardEvent)=>{ if(ev.key==="Escape") setPhotoViewer(null); }; window.addEventListener("keydown",onKey); return ()=>window.removeEventListener("keydown",onKey); },[]);
  useEffect(()=>{ if(!guidedOpen) return; setGuidedStep(0); setGuidedAnswers({}); setGuidedResult(false); },[guidedOpen]);
  const [reproveFor,setReproveFor]=useState<{text:string; person:string; sectionText:string}|null>(null);
  const [obsDrafts,setObsDrafts]=useState<Record<string,string>>({});
  const [reproveNote,setReproveNote]=useState("");
  const isManager = authUser==="Gerência";
  const replacedProfiles = useMemo(()=> new Set(credentials.filter(c=>c.value.replacesProfile).map(c=>c.value.replacesProfile!)),[credentials]);
  const unitOf = (p:string) => credentials.find(c=>c.value.profile===p)?.value.unit || "Matriz";
  const inUnit = (p:string) => unitFilter==="Todas" || unitOf(p)===unitFilter;
  const effectiveByProfile = useMemo<Record<string,Item[]>>(()=>{
    const map:Record<string,Item[]> = {...byProfile};
    customItems.forEach(r=>{ map[r.value.profile]=r.value.items; });
    return map;
  },[customItems]);
  const guidedActiveSection0 = guidedSection;
  const units = useMemo(()=> Array.from(new Set(["Matriz",...credentials.map(c=>c.value.unit).filter(Boolean)])) as string[], [credentials]);
  const staffProfiles = useMemo(()=> Array.from(new Set([...STAFF_PROFILES.filter(p=>!replacedProfiles.has(p)), ...credentials.map(c=>c.value.profile)])).filter(p=>p!=="Gerência"),[credentials,replacedProfiles]);
  const stationMap = useMemo<Record<string,string>>(()=> { const m={...STATIONS}; replacedProfiles.forEach(p=>delete m[p]); credentials.filter(c=>c.value.station).forEach(c=>{ m[c.value.profile]=c.value.station!; }); return m; },[credentials,replacedProfiles]);
  const loginMap = useMemo<Record<string,string>>(()=> { const m={...LOGIN_TO_PROFILE}; credentials.forEach(c=>{ if(c.value.replaces) delete m[normalizeLogin(c.value.replaces)]; }); credentials.forEach(c=>{ m[normalizeLogin(c.value.login)]=c.value.profile; }); return m; },[credentials]);
  const groups = useMemo(()=>{
    const list = GROUP_CHANNELS.map(g=>({...g,members:g.members.filter(p=>!replacedProfiles.has(p))}));
    const keyMap:Record<string,string> = {cozinha:"grupo:cozinha",copa:"grupo:copa",quiosque:"grupo:quiosque"};
    credentials.forEach(c=>{
      const key = keyMap[(c.value.group||"").toLowerCase()];
      if(key){ const g=list.find(x=>x.key===key); if(g && !g.members.includes(c.value.profile)) g.members.push(c.value.profile); }
    });
    return list;
  },[credentials,replacedProfiles]);
  const haptic = (ms=8) => { try { navigator.vibrate?.(ms); } catch {} };
  async function handleEnablePush(){
    if(!authUser || !pushSupported()){ setMsg("Notificações não suportadas neste navegador."); return; }
    setPushBusy(true);
    try{
      const myGroups = groups.filter(g=>g.members.includes(authUser)).map(g=>g.key);
      await enablePush(authUser, myGroups);
      setPushOn(true);
      setPushInfo("");
      setMsg("Notificações ativadas neste aparelho.");
    }catch(err){
      const text = err instanceof Error ? err.message : "Não foi possível ativar as notificações.";
      setPushInfo(text);
      setMsg(text);
    }
    setPushBusy(false);
  }
  // Gerência = somente conferência. Ninguém edita o checklist de outra pessoa.
  const readOnly = isManager;
  useEffect(()=>{
    if(!authUser) return;
    if(!isManager && selected!==authUser) setSelected(authUser);
    if(isManager && (!selected || selected==="Gerência")) setSelected(staffProfiles[0]||"");
  },[authUser,isManager,selected]);
  useEffect(()=>{
    if(!authUser) return;
    let cancelled = false;
    getPushStatus().then(s=>{
      if(cancelled) return;
      setPushOn(s.subscribed);
      if(!s.supported) setPushInfo("Este navegador não suporta notificações push.");
      else if(s.permission==="denied") setPushInfo("Permissão negada. Libere notificações nas configurações do site/app e toque no sino.");
      else if(s.isIOS && !s.standalone) setPushInfo("No iPhone: Compartilhar → Adicionar à Tela Inicial, abra o app instalado e toque no sino.");
      else if(!s.subscribed) setPushInfo("Toque no sino para receber alertas de mensagens.");
      else setPushInfo("");
    }).catch(()=>{});
    return ()=>{ cancelled = true; };
  },[authUser]);
  useEffect(()=>{
    if(authUser && !isManager && tab==="overview") setTab("checklist");
    if(authUser && isManager && tab==="checklist") setTab("overview");
  },[authUser,isManager,tab]);

  async function reloadRecords(){
    const loadOne = async (collection:string) => {
      try {
        const res = await api("records.list",{collection,limit:1000});
        setMissingCollections(prev=>prev.filter(c=>c!==collection));
        setModuleErrors(prev=>{ const n={...prev}; delete n[collection]; return n; });
        return (res.records||[]) as RecordRow[];
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setConnectionError(message);
        const looksMissing = /not found|não encontrada|nao encontrada|does not exist|relation|no such table|tabela/i.test(message);
        if (looksMissing) {
          setMissingCollections(prev=>prev.includes(collection)?prev:[...prev,collection]);
          setModuleErrors(prev=>({...prev,[collection]:`tabela ${collection} não encontrada`}));
        } else {
          setModuleErrors(prev=>({...prev,[collection]:message}));
        }
        return null;
      }
    };
    const [e,c,sub,t,sh,pl,ho,shor,wk,ex,mn,cl,ci,tt,cr] = await Promise.all([loadOne("dojo_entries"),loadOne("dojo_chat"),loadOne("dojo_submissions"),loadOne("dojo_temps"),loadOne("dojo_shifts"),loadOne("dojo_action_plans"),loadOne("dojo_handovers"),loadOne("dojo_shortages"),loadOne("dojo_weekly"),loadOne("dojo_expiries"),loadOne("dojo_maintenance"),loadOne("checklists"),loadOne("checklist_items"),loadOne("task_templates"),loadOne("dojo_credentials")]);
    if ([e,c,sub,t,sh,pl,ho,shor,wk,ex,mn,cl,ci,tt,cr].every(v=>v===null)) throw new Error("Falha na conexão");
    if (e) { const map:Record<string,{id:string,value:Entry}>={}; e.forEach((r:RecordRow)=>{ const v=r.value as Entry; if(v?.profile&&v?.date&&v?.itemId) map[`${v.profile}|${v.date}|${v.itemId}`]=r as any; }); setEntries(map); }
    if (c) setChat(c as any);
    const subMap:Record<string,{id:string,value:Submission}>={};
    if (sub) sub.forEach((r:RecordRow)=>{ const v=r.value as Submission; if(v?.profile&&v?.date&&v?.section) subMap[r.id]=r as any; });
    if (sub) setSubmissions(subMap);
    const tempMap:Record<string,{id:string,value:TempEntry}>={};
    if (t) t.forEach((r:RecordRow)=>{ const v=r.value as TempEntry; if(v?.profile&&v?.date) tempMap[`${v.profile}|${v.date}`]=r as any; });
    if (t) setTemps(tempMap);
    const shiftMap:Record<string,{id:string,value:ShiftEntry}>={};
    if (sh) sh.forEach((r:RecordRow)=>{ const v=r.value as ShiftEntry; if(v?.profile&&v?.date&&v?.startedAt) shiftMap[`${v.profile}|${v.date}`]=r as any; });
    if (sh) setShifts(shiftMap);
    const planMap:Record<string,{id:string,value:ActionPlan}>={};
    if (pl) pl.forEach((r:RecordRow)=>{ const v=r.value as ActionPlan; if(v?.profile&&v?.date&&v?.itemId) planMap[r.id]=r as any; });
    if (pl) setActionPlans(planMap);
    if (ho) setHandovers((ho as any).filter((r:{value:Handover})=>r.value?.profile&&r.value?.date&&r.value?.text));
    const shortageMap:Record<string,{id:string,value:Shortage}>={};
    if (shor) shor.forEach((r:RecordRow)=>{ const v=r.value as Shortage; if(v?.profile&&v?.date&&v?.itemId) shortageMap[r.id]=r as any; });
    if (shor) setShortages(shortageMap);
    const weeklyMap:Record<string,{id:string,value:WeeklySubmission}>={};
    if (wk) wk.forEach((r:RecordRow)=>{ const v=r.value as WeeklySubmission; if(v?.profile&&v?.weekKey) weeklyMap[r.id]=r as any; });
    if (wk) setWeeklySubs(weeklyMap);
    const expiryMap:Record<string,{id:string,value:ExpiryEntry}>={};
    if (ex) ex.forEach((r:RecordRow)=>{ const v=r.value as ExpiryEntry; if(v?.profile&&v?.date&&v?.product&&v?.expiryDate) expiryMap[r.id]=r as any; });
    if (ex) setExpiries(expiryMap);
    const maintMap:Record<string,{id:string,value:MaintEntry}>={};
    if (mn) mn.forEach((r:RecordRow)=>{ const v=r.value as MaintEntry; if(v?.profile&&v?.date&&v?.itemId) maintMap[`${v.profile}|${v.date}|${v.itemId}`]=r as any; });
    if (mn) setMaintenance(maintMap);
    if (cl) setChecklists(cl.filter((r)=>r.value?.title).map((r)=>({id:r.id,value:r.value as ChecklistRecord})));
    if (ci) setChecklistItems(ci.filter((r)=>r.value?.name).map((r)=>({id:r.id,value:r.value as ChecklistItemRecord})));
    if (tt) setTaskTemplates(tt.filter((r)=>r.value?.name).map((r)=>({id:r.id,value:r.value as TaskTemplate})));
    if (cr) setCredentials(cr.filter((r)=>r.value?.login && r.value?.profile).map((r)=>({id:r.id,value:r.value as CredentialRecord})));
    setConnectionError("");
  }
  const MODULES_META: {key:string; collection:string; label:string; fields:{key:string; label:string; placeholder?:string; hint?:string}[]}[] = [
    {key:"checklists",collection:"checklists",label:"Checklists",fields:[{key:"title",label:"Título",placeholder:"Ex.: Abertura — Quiosque"},{key:"profile",label:"Responsável",placeholder:"Ex.: Laís"},{key:"date",label:"Data",placeholder:"AAAA-MM-DD"},{key:"turno",label:"Turno",placeholder:"Manhã / Tarde / Noite"}]},
    {key:"checklist_items",collection:"checklist_items",label:"Itens do checklist (com foto)",fields:[{key:"name",label:"Item",placeholder:"Ex.: Hot Philadelphia"},{key:"target",label:"A produzir / meta",placeholder:"Ex.: 30–60 un."},{key:"section",label:"Seção",placeholder:"Ex.: Produção"},{key:"freq",label:"Frequência",placeholder:"DIÁRIO / SEMANAL / MENSAL"},{key:"photo",label:"Foto do item (câmera/galeria)",hint:"Tire uma foto ou escolha uma da galeria. Use “Excluir foto” para remover."},{key:"photo_url",label:"Link da foto (photo_url)",placeholder:"https://…",hint:"Opcional: cole um link https de uma foto de referência."}]},
    {key:"task_templates",collection:"task_templates",label:"Modelos de tarefa (task_templates)",fields:[{key:"name",label:"Tarefa",placeholder:"Ex.: Higienizar bancadas"},{key:"section",label:"Seção",placeholder:"Ex.: Limpeza"},{key:"target",label:"Meta / padrão",placeholder:"Ex.: Conforme rotina"},{key:"freq",label:"Frequência",placeholder:"DIÁRIO / SEMANAL / MENSAL"}]},
    {key:"messages",collection:"dojo_chat",label:"Mensagens (dojo_chat)",fields:[{key:"profile",label:"Conversa / perfil",placeholder:"Ex.: Laís"},{key:"sender",label:"Quem enviou",placeholder:"Ex.: Gerência"},{key:"text",label:"Mensagem",placeholder:"Escreva a mensagem"}]},
    {key:"dojo_entries",collection:"dojo_entries",label:"Respostas (dojo_entries)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"itemId",label:"ID do item"},{key:"status",label:"Status",placeholder:"Feito / Não feito"},{key:"feito",label:"Feito (quantidade)"},{key:"justificativa",label:"Justificativa"}]},
    {key:"dojo_submissions",collection:"dojo_submissions",label:"Envios (dojo_submissions)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"section",label:"Seção"},{key:"status",label:"Status",placeholder:"Aguardando / Aprovado / Para corrigir"},{key:"perfil",label:"Perfil do dia"},{key:"turno",label:"Turno"}]},
    {key:"dojo_temps",collection:"dojo_temps",label:"Temperaturas (dojo_temps)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"fria",label:"Câmara fria (°C)"},{key:"freezer",label:"Freezer (°C)"}]},
    {key:"dojo_shifts",collection:"dojo_shifts",label:"Turnos (dojo_shifts)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"startedAt",label:"Início"},{key:"finishedAt",label:"Fim"}]},
    {key:"dojo_action_plans",collection:"dojo_action_plans",label:"Planos de ação (dojo_action_plans)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"itemName",label:"Item"},{key:"section",label:"Seção"},{key:"justificativa",label:"Motivo"},{key:"deadline",label:"Prazo"},{key:"status",label:"Status",placeholder:"Pendente / Resolvido / Devolvido"}]},
    {key:"dojo_handovers",collection:"dojo_handovers",label:"Passagem de turno (dojo_handovers)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"turno",label:"Turno"},{key:"station",label:"Estação"},{key:"text",label:"Recado"}]},
    {key:"dojo_shortages",collection:"dojo_shortages",label:"Faltas (dojo_shortages)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"itemName",label:"Item"},{key:"section",label:"Seção"},{key:"status",label:"Status",placeholder:"Aberta / Resolvida"}]},
    {key:"dojo_weekly",collection:"dojo_weekly",label:"Semanal (dojo_weekly)",fields:[{key:"profile",label:"Perfil"},{key:"weekKey",label:"Chave da semana"},{key:"date",label:"Data"},{key:"status",label:"Status"}]},
    {key:"dojo_expiries",collection:"dojo_expiries",label:"Validades (dojo_expiries)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data do registro"},{key:"product",label:"Produto"},{key:"expiryDate",label:"Data de validade"}]},
    {key:"dojo_maintenance",collection:"dojo_maintenance",label:"Manutenção (dojo_maintenance)",fields:[{key:"profile",label:"Perfil"},{key:"date",label:"Data"},{key:"itemId",label:"ID do item"},{key:"status",label:"Status",placeholder:"Feito / Não feito"},{key:"note",label:"Observação"}]},
    {key:"dojo_credentials",collection:"dojo_credentials",label:"Funcionários (cadastro de login)",fields:[{key:"profile",label:"Nome"},{key:"login",label:"Login"},{key:"password",label:"Senha"},{key:"station",label:"Estação / setor"},{key:"group",label:"Grupo (cozinha/copa/quiosque)"},{key:"shift",label:"Turno"}]},
    {key:"dojo_item_instructions",collection:"dojo_item_instructions",label:"Instruções padrão dos itens",fields:[{key:"itemId",label:"ID do item",hint:"Ex.: a-8, hot-1, km-f1"},{key:"text",label:"Instrução / passo a passo",hint:"Aparece no card do item para quem executa."}]},
  ];
  function moduleRowsFor(key:string): {id:string; value:any}[] {
    if (key==="checklists") return checklists;
    if (key==="checklist_items") return checklistItems;
    if (key==="task_templates") return taskTemplates;
    if (key==="messages") return chat;
    if (key==="dojo_entries") return Object.values(entries);
    if (key==="dojo_submissions") return Object.values(submissions);
    if (key==="dojo_temps") return Object.values(temps);
    if (key==="dojo_shifts") return Object.values(shifts);
    if (key==="dojo_action_plans") return Object.values(actionPlans);
    if (key==="dojo_handovers") return handovers;
    if (key==="dojo_shortages") return Object.values(shortages);
    if (key==="dojo_weekly") return Object.values(weeklySubs);
    if (key==="dojo_expiries") return Object.values(expiries);
    if (key==="dojo_maintenance") return Object.values(maintenance);
    if (key==="dojo_credentials") return credentials;
    if (key==="dojo_item_instructions") return instructions;
    return [];
  }
  function moduleMetaFor(key:string){ return MODULES_META.find(m=>m.key===key) || MODULES_META[0]; }
  function startModuleEdit(row:{id:string; value:any}){
    if(!isManager){ setModuleMsg("Somente a Gerência pode editar módulos."); return; }
    const meta = moduleMetaFor(moduleTab);
    const form:Record<string,string>={};
    meta.fields.forEach(f=>{ form[f.key]=String(row.value?.[f.key] ?? ""); });
    setModuleForm(form); setModuleEditingId(row.id); setModuleMsg(""); setModuleConfirmDelete(null);
  }
  function resetModuleForm(){ setModuleForm({}); setModuleEditingId(null); setModuleConfirmDelete(null); }
  async function saveModuleRecord(){
    if(!isManager){ setModuleMsg("Somente a Gerência pode incluir módulos."); return; }
    const meta = moduleMetaFor(moduleTab);
    const firstKey = meta.fields[0]?.key || "title";
    if (!String(moduleForm[firstKey]||"").trim()) { setModuleMsg(`Preencha ${meta.fields[0]?.label || "o primeiro campo"} antes de salvar.`); return; }
    const existing = moduleEditingId ? moduleRowsFor(moduleTab).find(r=>r.id===moduleEditingId) : null;
    const value:Record<string,any> = {...(existing?.value||{})};
    meta.fields.forEach(f=>{ value[f.key]=String(moduleForm[f.key] ?? "").trim(); });
    if (!value.profile && authUser) value.profile = authUser;
    if (!value.date) value.date = date;
    if (meta.key==="dojo_weekly" && !value.weekKey) value.weekKey = value.date;
    if (meta.key==="messages" && !value.time) value.time = nowTime();
    if (meta.key==="dojo_submissions" && !value.items) value.items = [];
    if (meta.key==="dojo_submissions" && !value.period) value.period = period;
    if (meta.key==="dojo_submissions" && !value.fingerprint) value.fingerprint = JSON.stringify(value.items);
    setModuleSaving(true); setModuleMsg("");
    try {
      if (existing && !String(existing.id).startsWith("local-")) await api("records.replace",{collection:meta.collection,id:existing.id,value});
      else await api("records.create",{collection:meta.collection,value,idempotency_key:`dojo-module-${meta.collection}-${Date.now()}-${Math.random().toString(36).slice(2)}`});
      await reloadRecords(); setOfflineMode(false);
      setModuleMsg(moduleEditingId ? "Registro atualizado e salvo." : "Registro criado e salvo.");
      resetModuleForm();
    } catch (err) { const m = err instanceof Error ? err.message : String(err); setModuleMsg(m.includes("não encontrada") ? `tabela ${meta.collection} não encontrada` : `Não foi possível salvar: ${m}`); setOfflineMode(true); }
    setModuleSaving(false);
  }
  async function deleteModuleRecord(row:{id:string; value:any}){
    if(!isManager){ setModuleMsg("Somente a Gerência pode excluir módulos."); return; }
    const meta = moduleMetaFor(moduleTab);
    setModuleSaving(true); setModuleMsg("");
    try {
      if (!String(row.id).startsWith("local-")) await api("records.delete",{collection:meta.collection,id:row.id});
      await reloadRecords(); setOfflineMode(false);
      setModuleMsg("Registro excluído."); setModuleConfirmDelete(null);
    } catch (err) { const m = err instanceof Error ? err.message : String(err); setModuleMsg(m.includes("não encontrada") ? `tabela ${meta.collection} não encontrada` : `Não foi possível excluir: ${m}`); setOfflineMode(true); }
    setModuleSaving(false);
  }
  async function deleteRecordPhoto(row:{id:string; value:any}){
    if(!isManager){ setModuleMsg("Somente a Gerência pode excluir fotos dos módulos."); return; }
    const meta = moduleMetaFor(moduleTab);
    const next = {...(row.value||{})}; delete next.photo; next.photo = "";
    setModuleSaving(true); setModuleMsg("");
    try {
      if (!String(row.id).startsWith("local-")) await api("records.replace",{collection:meta.collection,id:row.id,value:next});
      await reloadRecords(); setOfflineMode(false);
      setModuleMsg("Foto excluída do registro.");
    } catch (err) { const m = err instanceof Error ? err.message : String(err); setModuleMsg(`Não foi possível excluir a foto: ${m}`); setOfflineMode(true); }
    setModuleSaving(false);
  }
  useEffect(()=>{ setLoading(false); },[]);
  useEffect(()=>{ if(!authUser) return; reloadRecords().then(()=>setOfflineMode(false)).catch(()=>setOfflineMode(true)); },[authUser]);
  // Catálogo de itens no backend: usado pelo resumo diário automático.
  useEffect(()=>{
    if(!authUser) return;
    let cancelled = false;
    const version = "2026-11-26-blocoA-v2";
    (async()=>{
      try{
        const meta = await api("records.list",{collection:"dojo_item_catalog_meta",limit:10});
        if(cancelled) return;
        if((meta.records||[]).some((r:any)=>r.value?.version===version)) return;
        const list = await api("records.list",{collection:"dojo_item_catalog",limit:500});
        if(cancelled) return;
        const byId = new Map<string,any>((list.records||[]).map((r:any)=>[String(r.value?.id),r]));
        const catalog = [
          ...ALL_ITEMS.map(i=>({id:i.id,name:i.name,section:String(i.section||""),target:String(i.target||"")})),
          ...WEEKLY_ITEMS.map(i=>({id:i.id,name:i.name,section:"Limpeza Semanal",target:""})),
          ...MAINT_ITEMS.map(i=>({id:i.id,name:i.name,section:"Manutenção",target:""})),
        ];
        for(const item of catalog){
          if(cancelled) return;
          const existing:any = byId.get(item.id);
          if(existing) await api("records.replace",{collection:"dojo_item_catalog",id:existing.id,value:item});
          else await api("records.create",{collection:"dojo_item_catalog",value:item});
        }
        await api("records.create",{collection:"dojo_item_catalog_meta",value:{version}});
      }catch{}
    })();
    return ()=>{ cancelled = true; };
  },[authUser]);

  async function reloadAux(){
    try{
      const [t,l,tr,ii,rd,si,sc,rc,tl,ir,qu,qa,sg,tp,ci2] = await Promise.all([
        api("records.list",{collection:"dojo_tasks",limit:200}),
        api("records.list",{collection:"dojo_logbook",limit:200}),
        api("records.list",{collection:"dojo_trainings",limit:200}),
        api("records.list",{collection:"dojo_item_instructions",limit:500}),
        api("records.list",{collection:"dojo_chat_reads",limit:500}),
        api("records.list",{collection:"dojo_stock_items",limit:500}),
        api("records.list",{collection:"dojo_stock_counts",limit:500}),
        api("records.list",{collection:"dojo_receivings",limit:500}),
        api("records.list",{collection:"dojo_temp_limits",limit:50}),
        api("records.list",{collection:"dojo_item_rules",limit:500}),
        api("records.list",{collection:"dojo_questions",limit:500}),
        api("records.list",{collection:"dojo_quality_answers",limit:1000}),
        api("records.list",{collection:"dojo_signatures",limit:200}),
        api("records.list",{collection:"dojo_templates",limit:200}),
        api("records.list",{collection:"dojo_custom_items",limit:200}),
      ]);
      setTasks((t.records||[]) as any);
      setLogbook((l.records||[]) as any);
      setTrainings((tr.records||[]) as any);
      setInstructions((ii.records||[]) as any);
      setReads((rd.records||[]) as any);
      setStockItems((si.records||[]) as any);
      setStockCounts((sc.records||[]) as any);
      setReceivings((rc.records||[]) as any);
      setTempLimits((tl.records||[]) as any);
      setItemRules((ir.records||[]) as any);
      setQuestions((qu.records||[]) as any);
      setQualityAnswers((qa.records||[]) as any);
      setSignatures((sg.records||[]) as any);
      setTemplates((tp.records||[]) as any);
      setCustomItems((ci2.records||[]) as any);
    }catch{}
  }
  useEffect(()=>{ if(authUser) void reloadAux(); },[authUser]);

  useEffect(()=>{
    if(!selected) return;
    const key = `${selected}|${date}`;
    lastTempKey.current = key;
    const rec = temps[key]?.value;
    setTempFria(rec?.fria ?? "");
    setTempFreezer(rec?.freezer ?? "");
  },[selected,date,temps]);

  const activeLoginKey = normalizeLogin(loginInput);
  useEffect(()=>{
    if(!activeLoginKey) return;
    const until = lockedUntil[activeLoginKey]||0;
    if(until<=Date.now()) return;
    const t = setInterval(()=>setNowTick(Date.now()),500);
    return ()=>clearInterval(t);
  },[activeLoginKey,lockedUntil]);

  // Login 100% local: nenhuma requisição de rede antes ou durante o login.
  function profileForLogin(loginKey:string): string | null {
    return loginMap[loginKey] || LOGIN_TO_PROFILE[loginKey] || null;
  }
  function enterApp(profile:string){
    const initialSelected = profile==="Gerência" ? (staffProfiles[0]||"") : profile;
    setAuthUser(profile); setSelected(initialSelected); setDate(today()); setTab(profile==="Gerência" ? "overview" : "checklist"); setConversation(null); setShowTodayDone(false);
    setTurno(KIOSK_NIGHT_PROFILES.includes(profile) ? "Noite" : "Manhã");
    setLoginError(""); setPasswordInput("");
  }
  function handleLogout(){
    setAuthToken(null);
    setAuthUser(null); setSelected(null); setConversation(null); setTab("checklist");
    setPasswordInput(""); setLoginError("");
    setDraft(""); setMsg("Você saiu. Faça login para ver seu checklist.");
    setShowTodayDone(false); lastTempKey.current="";
  }

  async function handleLoginSubmit(){
    const loginKey = normalizeLogin(loginInput);
    if(!loginKey){ setLoginError("Digite seu login."); return; }
    const until = lockedUntil[loginKey]||0;
    if(until>Date.now()){ setLoginError(`Muitas tentativas. Aguarde ${Math.ceil((until-Date.now())/1000)}s`); return; }
    const profile = profileForLogin(loginKey);
    if(!profile){ setLoginError("Login ou senha incorretos"); return; }
    const enteredPassword = passwordInput.trim().toLowerCase();
    if(!enteredPassword){ setLoginError("Digite sua senha."); return; }
    try{
      const jwt = await supabaseSignIn(loginKey, enteredPassword);
      if(jwt){
        setAuthToken(jwt);
        setLoginError(""); setAttempts(prev=>({...prev,[loginKey]:0}));
        enterApp(profile); setMsg(`Olá, ${profile}!`);
        return;
      }
    }catch{ setAuthToken(null); }
    const next = (attempts[loginKey]||0)+1;
    setAttempts(prev=>({...prev,[loginKey]:next}));
    if(next>=3){
      const u = Date.now()+30000;
      setLockedUntil(prev=>({...prev,[loginKey]:u}));
      setLoginError("Muitas tentativas. Aguarde 30s");
    } else {
      setLoginError("Login ou senha incorretos");
    }
  }

  const items = selected?effectiveByProfile[selected]||[]:[];
  const isKioskSelected = selected ? KIOSK_PROFILES.includes(selected) : false;
  const activeSections: Section[] = selected ? sectionsForProfile(selected) : SECTIONS;
  const guidedSectionOptions = useMemo(()=>["All sections",...activeSections.filter(Boolean)],[activeSections]);
  const guidedActiveSection = guidedActiveSection0 || guidedSectionOptions[0];
  const guidedQs = questions.filter((q:any)=>q.value?.question&&(guidedActiveSection==="All sections"||q.value.section===guidedActiveSection));
  const guidedSteps:any[] = guidedQs.map((q:any)=>({id:q.id,question:q.value.question,section:q.value.section||"Geral",type:q.value.type||"check",weight:Number(q.value.weight)||1,minScore:Number(q.value.minScore)||7.5,ref:q.value.referencePhoto||""}));
  const guidedStepNow:any = guidedSteps[guidedStep];
  const guidedAnswer:any = guidedAnswers[guidedStepNow?.id]||{verdict:"Conforme",score:0,answer:"",note:"",photo:"",opinion:""};
  const setGuidedAnswer = (patch:any)=>{ if(!guidedStepNow) return; setGuidedAnswers(p=>({...p,[guidedStepNow.id]:{...guidedAnswer,...patch}})); };
  const guidedScoreFor = (st:any,ans:any):number=>{
    if(!st) return 0;
    if(st.type==="check"||st.type==="yesno"||st.type==="photo") return ans.verdict==="Não conforme"?0:ans.verdict==="Parcial"?5:10;
    if(st.type==="scale") return Math.max(0,Math.min(10,Number(ans.score)||0));
    const v=Number(String(ans.answer??"").replace(",","."));
    if(!Number.isFinite(v)) return 0;
    if(st.type==="temperature") return v<=st.minScore?10:v<=st.minScore+3?5:0;
    if(st.type==="temperature_min") return v>=st.minScore?10:v>=st.minScore-3?5:0;
    return ans.verdict==="Não conforme"?0:ans.verdict==="Parcial"?5:10;
  };
  const guidedScore = guidedSteps.length? Math.round(guidedSteps.reduce((sum,st)=>sum+guidedScoreFor(st,guidedAnswers[st.id]||{})*(Number(st.weight)||1),0)/guidedSteps.reduce((sum,st)=>sum+(Number(st.weight)||1),0)*10)/10 : 0;
  const guidedVerdict = guidedScore>=7.5?"Conforme":guidedScore>=5?"Parcialmente conforme":"Não conforme";
  const saveGuidedRun = async ()=>{
    if(!guidedSteps.length) return;
    setGuidedSaving(true);
    const value = { profile:selected||authUser||"", date, score:guidedScore, verdict:guidedVerdict, section:guidedActiveSection, answers:guidedAnswers, answersList:guidedSteps.map(st=>({id:st.id,question:st.question,section:st.section,type:st.type,weight:st.weight,score:guidedScoreFor(st,guidedAnswers[st.id]||{}),verdict:(guidedAnswers[st.id]||{}).verdict||"",answer:(guidedAnswers[st.id]||{}).answer||"",photo:(guidedAnswers[st.id]||{}).photo||""})) };
    try{ await api("records.create",{collection:"dojo_guided_runs",value,idempotency_key:`dojo-guided-${normalizeLogin(selected||authUser||"")}-${date}-${Date.now()}`}); setGuidedSaving(false); setGuidedResult(true); setOfflineMode(false); }catch{ setGuidedSaving(false); setGuidedResult(true); setOfflineMode(true); }
  };
  const itemsForSection = (sec:Section) => items.filter(i=> i.section===sec && (sec!=="Produção" || isKioskSelected || i.freq===period));
  const submissionForSection = (sec:Section) => {
    return Object.values(submissions).filter(s=>s.value.profile===selected && s.value.date===date && s.value.section===sec && (sec!=="Produção" || s.value.period===period)).sort((a,b)=>b.id.localeCompare(a.id))[0] || null;
  };
  const countsForSection = (sec:Section) => {
    const list = itemsForSection(sec);
    const done = list.filter(i=>entries[`${selected}|${date}|${i.id}`]?.value.status==="Feito").length;
    return { list, done, total:list.length, pending:list.filter(i=>{ const s=entries[`${selected}|${date}|${i.id}`]?.value.status||""; return s===""; }).length };
  };

  function goToChatForCurrent(){
    const targetConvo = isManager ? (selected && selected!=="Gerência" ? selected : (staffProfiles[0]||"")) : "Gerência";
    setShowTodayDone(false);
    setTab("chat"); setConversation(targetConvo);
  }

  const people = useMemo(()=>PROFILES.filter(p=>p!=="Gerência"),[]);
  function personStatsFor(person:string, dateStr:string){
    const list = effectiveByProfile[person]||[];
    let feitos=0, faltam=0;
    list.forEach(it=>{
      const s = entries[`${person}|${dateStr}|${it.id}`]?.value.status || "";
      if(s==="Feito") feitos++;
      else faltam++;
    });
    return { person, station: stationMap[person]||"", total:list.length, feitos, faltam };
  }
  const awaitingList = useMemo(()=> Object.values(submissions).filter(s=>s.value.date===date && s.value.status==="Aguardando" && (isManager || s.value.profile===authUser) && inUnit(s.value.profile)).sort((a,b)=>a.value.profile.localeCompare(b.value.profile)),[submissions,date,isManager,authUser,unitFilter]);
  const pendingPlans = useMemo(()=> Object.values(actionPlans).filter(p=>p.value.date<=date && (p.value.status==="Pendente"||p.value.status==="Devolvido") && (isManager || p.value.profile===authUser)).sort((a,b)=>{ const ageA = daysBetween(a.value.date, date); const ageB = daysBetween(b.value.date, date); const urgentA = ageA>1 ? 1 : 0; const urgentB = ageB>1 ? 1 : 0; if(urgentA!==urgentB) return urgentB-urgentA; if(ageA!==ageB) return ageB-ageA; return a.value.profile.localeCompare(b.value.profile) || a.value.itemName.localeCompare(b.value.itemName); }),[actionPlans,date,isManager,authUser]);
  const resolvedPlans = useMemo(()=> Object.values(actionPlans).filter(p=>p.value.date===date && p.value.status==="Resolvido" && (isManager || p.value.profile===authUser)).sort((a,b)=>a.value.profile.localeCompare(b.value.profile)),[actionPlans,date,isManager,authUser]);
  const weeklySummary = useMemo(()=>{
    const dow = new Date(date + "T12:00:00").getDay();
    const mondayOffset = (dow + 6) % 7;
    const weekStart = addDays(date, -mondayOffset);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
    const weekSubs = Object.values(submissions).filter(s => inWeek(s.value.date) && (isManager || s.value.profile===authUser) && (s.value.status==="Aguardando" || s.value.status==="Aprovado"));
    const totalConcluded = weekSubs.length;
    let feitos = 0; let naoFeitos = 0;
    const naoCount: Record<string, { name: string; count: number }> = {};
    const byPerson: Record<string, { feitos: number; naoFeitos: number; total: number }> = {};
    weekSubs.forEach(s=>{
      s.value.items.forEach(it=>{
        if(it.status==="Feito") feitos++;
        if(it.status==="Não feito"){
          naoFeitos++;
          const item = ALL_ITEMS.find(i=>i.id===it.itemId);
          const name = item?.name || it.itemId;
          naoCount[it.itemId] = { name, count: (naoCount[it.itemId]?.count||0)+1 };
        }
        if(!byPerson[s.value.profile]) byPerson[s.value.profile] = { feitos:0, naoFeitos:0, total:0 };
        byPerson[s.value.profile].total++;
        if(it.status==="Feito") byPerson[s.value.profile].feitos++;
        if(it.status==="Não feito") byPerson[s.value.profile].naoFeitos++;
      });
    });
    const totalMarked = feitos + naoFeitos;
    const avgCompliance = totalMarked ? Math.round(feitos/totalMarked*100) : 0;
    const top3 = Object.values(naoCount).sort((a,b)=>b.count-a.count).slice(0,3);
    const perfectPeople = Object.entries(byPerson).filter(([,v])=>v.total>0 && v.naoFeitos===0 && v.feitos===v.total).map(([name])=>name).sort((a,b)=>a.localeCompare(b));
    const weekPlans = Object.values(actionPlans).filter(p=>inWeek(p.value.date) && (isManager || p.value.profile===authUser));
    const plansResolved = weekPlans.filter(p=>p.value.status==="Resolvido").length;
    const plansPending = weekPlans.filter(p=>p.value.status==="Pendente" || p.value.status==="Devolvido").length;
    return { weekStart, weekEnd, totalConcluded, avgCompliance, feitos, naoFeitos, top3, perfectPeople, plansResolved, plansPending };
  },[submissions, actionPlans, date, isManager, authUser]);
  const weeklyRanking = useMemo(()=>{
    const dow = new Date(date + "T12:00:00").getDay();
    const mondayOffset = (dow + 6) % 7;
    const weekStart = addDays(date, -mondayOffset);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
    const rows = people.map((person)=>{
      const subs = Object.values(submissions).filter(s=>s.value.profile===person && inWeek(s.value.date) && (s.value.status==="Aguardando" || s.value.status==="Aprovado"));
      let feitos = 0; let naoFeitos = 0;
      subs.forEach(s=>{ s.value.items.forEach(it=>{ if(it.status==="Feito") feitos++; if(it.status==="Não feito") naoFeitos++; }); });
      const total = feitos + naoFeitos;
      const pct = total ? Math.round(feitos/total*100) : 0;
      return { person, pct, feitos, naoFeitos, total, checklists: subs.length };
    });
    rows.sort((a,b)=> b.pct - a.pct || b.feitos - a.feitos || a.person.localeCompare(b.person));
    return { weekStart, weekEnd, rows };
  },[submissions, date, people]);
  const rankingRows = weeklyRanking.rows.filter(r=>unitFilter==="Todas"||unitOf(r.person)===unitFilter);
  const draftLabel = useMemo(()=>{
    if(!selected) return "";
    let latest = "";
    Object.values(entries).forEach(r=>{
      if(r.value.profile===selected && r.value.date===date && r.value.updatedAt && r.value.updatedAt > latest) latest = r.value.updatedAt;
    });
    if(latest) return `Rascunho — salvo às ${latest}`;
    if(draftAt) return `Rascunho — salvo às ${draftAt}`;
    return "";
  },[draftAt, entries, selected, date]);
  useEffect(()=>{
    if(loading || !isManager) return;
    const todayStr = today();
    Object.values(actionPlans).forEach(p=>{
      if(p.value.status!=="Pendente" && p.value.status!=="Devolvido") return;
      const age = daysBetween(p.value.date, todayStr);
      if(age < 3) return;
      const key = `${p.value.profile}|${p.value.date}|${p.value.itemId}|${p.value.itemName}`;
      if(escalatedSentRef.current.has(key)) return;
      const already = chat.some(m=> m.value.text.includes("ESCALONADO") && m.value.text.includes(p.value.itemName) && m.value.text.includes(p.value.profile));
      if(already){ escalatedSentRef.current.add(key); return; }
      escalatedSentRef.current.add(key);
      void sendChat(`⚠️ ESCALONADO — Plano de Ação ${p.value.itemName} está pendente há ${age} dias — ${p.value.profile}`, "Gerência", p.value.profile);
    });
  },[actionPlans, chat, loading, isManager]);
  const delayedList = useMemo(()=>{
    const empty = { list: [] as ReturnType<typeof personStatsFor>[], turnoCheck: "", deadline: "", overdueMinutes: 0 };
    if(!isManager) return empty;
    const now = new Date(); const hour = now.getHours(); const realToday = today();
    if(date!==realToday) return empty;
    if(hour<12) return empty;
    const turnoCheck = hour<22 ? "Manhã" : "Noite";
    const deadlineHour = hour<22 ? 12 : 22;
    const deadline = hour<22 ? "12h" : "22h";
    const deadlineDate = new Date(); deadlineDate.setHours(deadlineHour,0,0,0);
    const overdueMinutes = Math.max(0, Math.floor((now.getTime()-deadlineDate.getTime())/60000));
    const list = people.filter(p=>{
      const has = Object.values(submissions).some(s=>s.value.profile===p && s.value.date===realToday && s.value.turno===turnoCheck);
      return !has;
    }).map(p=>personStatsFor(p,realToday));
    return { list, turnoCheck, deadline, deadlineHour, overdueMinutes };
  },[isManager,date,submissions,people,entries]);

  const perPersonProgress = people.map(p=>{ const s=personStatsFor(p,date); const pct=s.total?Math.round(s.feitos/s.total*100):0; return {...s,pct,shift:shiftFor(p,date)}; });
  const todayDone = perPersonProgress.reduce((a,p)=>a+p.feitos,0);
  const todayTotal = perPersonProgress.reduce((a,p)=>a+p.total,0);
  const complianceToday = todayTotal?Math.round(todayDone/todayTotal*100):0;
  const completedSectionsToday = Object.values(submissions).filter(s=>s.value.date===date && (s.value.status==="Aguardando"||s.value.status==="Aprovado")).length;
  const expectedSectionsToday = people.reduce((a,p)=>a+sectionsForProfile(p).length,0);
  const pendingPlansCount = pendingPlans.length;

  useEffect(()=>{ if(!stationQrOpen) return; const t=setTimeout(()=>{ if(stationQrCanvasRef.current) drawQrCode(stationQrCanvasRef.current,stationQrInfo.url); },60); return ()=>clearTimeout(t); },[stationQrOpen,stationQrInfo.url]);

  function buildAiInsights(){
    const out:string[]=[];
    const yesterday=addDays(date,-1), dayBefore=addDays(date,-2);
    people.forEach(p=>{
      const list=(effectiveByProfile[p]||[]);
      const nao=list.filter(it=>entries[`${p}|${date}|${it.id}`]?.value.status==="Não feito");
      if(nao.length){
        const secs=Array.from(new Set(nao.map(i=>i.section))).join(", ");
        out.push(`${p} tem ${nao.length} Não feito em ${secs} — verificar insumo`);
      }
      nao.forEach(it=>{
        if(entries[`${p}|${yesterday}|${it.id}`]?.value.status==="Não feito") out.push(`${p} repete Não feito há 2 dias: ${it.name} — verificar causa`);
      });
      const pct3=[date,yesterday,dayBefore].map(d=>{ const l=(effectiveByProfile[p]||[]); const f=l.filter(it=>entries[`${p}|${d}|${it.id}`]?.value.status==="Feito").length; return l.length?Math.round(f/l.length*100):-1; });
      if(pct3.every(v=>v===100)) out.push(`${p} concluiu 100% nos últimos 3 dias`);
    });
    const tempOut=(d:string)=>{ const t=temps[`${""}|${d}`]; return t; };
    void tempOut;
    const isTempOut=(d:string)=>people.some(p=>{ const t=temps[`${p}|${d}`]?.value; if(!t) return false; const f=parseTempValue(t.fria), fr=parseTempValue(t.freezer); return (f!==null&&(f<0||f>5))||(fr!==null&&fr>=-12); });
    if(isTempOut(date)&&isTempOut(yesterday)) out.push("Câmara fria acima 2 dias seguidos — verificar equipamento");
    else if(isTempOut(date)) out.push("Temperatura fora da faixa hoje — verificar equipamento");
    delayedList.list.forEach(p=>{
      const hadYesterday=Object.values(submissions).some(s=>s.value.profile===p.person&&s.value.date===yesterday);
      if(!hadYesterday) out.push(`${p.person} atrasado 2 dias seguidos — verificar turno`);
    });
    setAiInsights(out.length?out.slice(0,6):["Sem alerta hoje — operação dentro do padrão"]);
  }

  function reportText(){
    const lines:string[]=[];
    lines.push(`DOJO CHECKLIST — RELATÓRIO DO DIA`, `Data: ${fmtDate(date)}`, ``);
    lines.push(`RESUMO`, `Hoje: ${completedSectionsToday} / ${expectedSectionsToday} concluídos`, `% Conformidade Hoje: ${complianceToday}%`, `Planos de Ação Pendentes: ${pendingPlansCount}`, `Atrasados: ${delayedList.list.length}`, ``);
    lines.push(`POR PESSOA`);
    perPersonProgress.forEach(p=>{
      const nao=(effectiveByProfile[p.person]||[]).filter(it=>entries[`${p.person}|${date}|${it.id}`]?.value.status==="Não feito");
      lines.push(`${p.person} — ${stationMap[p.person]||""} — ${p.feitos}/${p.total} — ${p.pct}% conformidade — Iniciado: ${p.shift?.startedAt||"—"} — Concluído: ${p.shift?.finishedAt||"—"}`);
      nao.forEach(it=>{ const e=entries[`${p.person}|${date}|${it.id}`]?.value; lines.push(`  Não feito: ${it.name} — Motivo: ${e?.justificativa||"Sem justificativa"}`); });
    });
    lines.push(``, `PLANOS DE AÇÃO`);
    const plansToday=Object.values(actionPlans).filter(x=>x.value.date===date);
    if(!plansToday.length) lines.push("Nenhum plano de ação no dia.");
    plansToday.forEach(x=>lines.push(`${x.value.profile} — ${x.value.itemName} — ${x.value.status} — Motivo: ${x.value.justificativa||"—"} — Prazo: ${x.value.deadline}`));
    lines.push(``, `ALERTAS DE TEMPERATURA`);
    const tempsToday=Object.values(temps).filter(x=>x.value.date===date&&(x.value.fria.trim()||x.value.freezer.trim()));
    if(!tempsToday.length) lines.push("Nenhuma temperatura registrada no dia.");
    tempsToday.forEach(x=>{ const f=parseTempValue(x.value.fria), fr=parseTempValue(x.value.freezer); const alert=(f!==null&&(f<0||f>5))||(fr!==null&&fr>=-12); lines.push(`${x.value.profile} — Câmara Fria: ${x.value.fria||"—"} °C — Freezer: ${x.value.freezer||"—"} °C${alert?" — FORA DA FAIXA":""}`); });
    return lines.join("\n");
  }
  function downloadReport(text:string){
    const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`dojo-relatorio-${date}.txt`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportReport(){ downloadReport(reportText()); setMsg("Relatório do dia gerado para baixar."); }
  async function exportPdf(){
    try{
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({unit:"pt",format:"a4"});
      const size = doc.internal.pageSize.getWidth();
      doc.setFontSize(12); doc.text(`Dojo Checklist — Relatorio ${fmtDate(date)}`,40,50);
      doc.setFontSize(9);
      const rows = doc.splitTextToSize(reportText(),size-80) as string[];
      let y=70;
      rows.forEach(line=>{
        if(y>doc.internal.pageSize.getHeight()-40){ doc.addPage(); y=50; }
        doc.text(line,40,y); y+=12;
      });
      doc.save(`dojo-relatorio-${date}.pdf`);
      setMsg("Relatório PDF gerado.");
    }catch{ setMsg("Não foi possível gerar o PDF."); }
  }
  async function shareReport(){
    const text=reportText();
    const file=new File([text],`dojo-relatorio-${date}.txt`,{type:"text/plain;charset=utf-8"});
    try{
      if(navigator.share){
        await navigator.share({files:[file],title:`Dojo — ${fmtDate(date)}`,text:`Relatório do dia ${fmtDate(date)}`});
        setMsg("Relatório compartilhado.");
        return;
      }
    }catch{ setMsg("Compartilhamento cancelado."); return; }
    downloadReport(text); setMsg("Relatório baixado — compartilhe pelo seu app de mensagens.");
  }

  function buildConsolidated(){
    const out:{destaques:string[];inconsistencias:string[];riscos:string[];oportunidades:string[]}={destaques:[],inconsistencias:[],riscos:[],oportunidades:[]};
    const lastDays = Array.from({length:7},(_,i)=>addDays(date,-i));
    const scopedPeople = staffProfiles.filter(p=>(reportFilters.person==="Todos"||p===reportFilters.person)&&(reportFilters.unit==="Todas"||unitOf(p)===reportFilters.unit));
    const inSection = (itemId:string) => reportFilters.section==="Todas" || (ALL_ITEMS.find(i=>i.id===itemId)?.section===reportFilters.section);
    const listFor = (p:string) => (effectiveByProfile[p]||[]).filter(i=>inSection(i.id));
    const scopedEntries = Object.values(entries).filter(r=>scopedPeople.includes(r.value.profile)&&inSection(r.value.itemId));
    const scopedPlans = Object.values(actionPlans).filter(r=>scopedPeople.includes(r.value.profile)&&inSection(r.value.itemId));
    const scopedShortages = openShortages.filter(s=>scopedPeople.includes(s.value.profile)&&inSection(s.value.itemId));
    const scopedTemps = Object.values(temps).filter(r=>r.value.date===date&&scopedPeople.includes(r.value.profile));
    const perfect = scopedPeople.filter(p=>lastDays.every(d=>{ const list=listFor(p); if(!list.length) return false; const f=list.filter(i=>entries[`${p}|${d}|${i.id}`]?.value.status==="Feito").length; return f===list.length; }));
    if(perfect.length) out.destaques.push(`${perfect.join(", ")} com 100% nos últimos 7 dias.`);
    const failCount = new Map<string,number>();
    lastDays.forEach(d=>scopedEntries.forEach(r=>{ if(r.value.date===d && r.value.status==="Não feito") failCount.set(r.value.itemId,(failCount.get(r.value.itemId)||0)+1); }));
    Array.from(failCount.entries()).filter(([,n])=>n>=2).slice(0,5).forEach(([id,n])=>{ const name=ALL_ITEMS.find(i=>i.id===id)?.name||id; out.inconsistencias.push(`${name} marcado como Não feito ${n}x em 7 dias.`); });
    const tempRows = scopedTemps;
    tempRows.forEach(r=>{ const f=parseTempValue(r.value.fria), g=parseTempValue(r.value.freezer); if((f!==null&&(f<friaLim.min||f>friaLim.max))||(g!==null&&(g<freezerLim.min||g>freezerLim.max))) out.riscos.push(`Temperatura fora da faixa registrada por ${r.value.profile}: câmara ${r.value.fria||"—"} °C / freezer ${r.value.freezer||"—"} °C.`); });
    if(expiryAlerts.length) out.riscos.push(`${expiryAlerts.length} produto(s) vencido(s) ou vencendo em até 3 dias.`);
    if(scopedPlans.length>=3) out.riscos.push(`${scopedPlans.length} planos de ação pendentes.`);
    const planCount = new Map<string,number>();
    scopedPlans.forEach(r=>planCount.set(r.value.itemName,(planCount.get(r.value.itemName)||0)+1));
    Array.from(planCount.entries()).filter(([,n])=>n>=2).slice(0,4).forEach(([name,n])=>out.oportunidades.push(`Plano de ação recorrente: ${name} (${n}x) — revisar processo.`));
    if(scopedShortages.length>=2) out.oportunidades.push(`${scopedShortages.length} faltas em aberto hoje — revisar reposição.`);
    if(!out.destaques.length && !out.inconsistencias.length && !out.riscos.length && !out.oportunidades.length) out.destaques.push("Sem alertas nos últimos 7 dias — operação dentro do padrão.");
    setConsolidated(out);
    return out;
  }
  function whatsappAlert(){
    const lines:string[]=[`⚠️ Dojo Checklist — ${fmtDate(date)}`];
    const atrasadas=tasks.filter(t=>taskOverdue(t.value)).map(t=>`Tarefa atrasada: ${t.value.title} (${t.value.owner})`);
    if(atrasadas.length) lines.push(...atrasadas);
    if(pendingPlans.length) lines.push(`${pendingPlans.length} plano(s) de ação pendente(s).`);
    if(expiryAlerts.length) lines.push(`${expiryAlerts.length} produto(s) com validade crítica.`);
    if(anyTempOut) lines.push("Temperatura fora da faixa registrada hoje.");
    const nao=Object.values(entries).filter(r=>r.value.date===date&&r.value.status==="Não feito").length;
    if(nao) lines.push(`${nao} item(ns) marcado(s) como Não feito hoje.`);
    if(lines.length===1) lines.push("Tudo em dia na operação hoje.");
    const url=`https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url,"_blank","noopener,noreferrer");
    setMsg("Conversa do WhatsApp aberta com o alerta preenchido.");
  }
  function sigPos(ev:React.PointerEvent<HTMLCanvasElement>){
    const c=signatureCanvasRef.current!; const r=c.getBoundingClientRect();
    return { x:(ev.clientX-r.left)*(c.width/r.width), y:(ev.clientY-r.top)*(c.height/r.height) };
  }
  function sigDown(ev:React.PointerEvent<HTMLCanvasElement>){
    const c=signatureCanvasRef.current; if(!c) return;
    const ctx=c.getContext("2d"); if(!ctx) return;
    drawingRef.current=true; const p=sigPos(ev); ctx.beginPath(); ctx.moveTo(p.x,p.y); c.setPointerCapture(ev.pointerId);
  }
  function sigMove(ev:React.PointerEvent<HTMLCanvasElement>){
    if(!drawingRef.current) return; const c=signatureCanvasRef.current; const ctx=c?.getContext("2d"); if(!c||!ctx) return;
    const p=sigPos(ev); ctx.lineTo(p.x,p.y); ctx.stroke();
  }
  function sigUp(){ drawingRef.current=false; }
  function clearSignature(){
    const c=signatureCanvasRef.current; const ctx=c?.getContext("2d"); if(!c||!ctx) return;
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle="#111111"; ctx.lineWidth=3; ctx.lineCap="round"; ctx.lineJoin="round";
  }
  function openSignature(){
    setSignatureOpen(true);
    setTimeout(clearSignature,60);
  }
  async function saveSignature(){
    const c=signatureCanvasRef.current; if(!c) return;
    const value:SignatureRecord={profile:selected||authUser||"",date,time:nowTime(),data:c.toDataURL("image/png")};
    try{ await api("records.create",{collection:"dojo_signatures",value}); setSignatureOpen(false); await reloadAux(); setMsg("Assinatura salva."); }catch{ setMsg("Não foi possível salvar a assinatura."); }
  }
  function historyHas(d:string){
    return Object.values(submissions).some(r=>r.value.date===d) || Object.values(entries).some(r=>r.value.date===d) || qualityAnswers.some(r=>r.value.date===d) || Object.values(temps).some(r=>r.value.date===d);
  }
  function shiftHistoryMonth(delta:number){
    const [y,m]=historyMonth.split("-").map(Number);
    const d=new Date(y,m-1+delta,1);
    const p=(n:number)=>String(n).padStart(2,"0");
    setHistoryMonth(`${d.getFullYear()}-${p(d.getMonth()+1)}`);
  }
  async function shareConsolidated(){
    const c = consolidated || buildConsolidated();
    if(!c){ setMsg("Gere o parecer antes de compartilhar."); return; }
    const text = [
      `DOJO CHECKLIST — PARECER CONSOLIDADO ${fmtDate(date)}`,
      `Filtros: unidade ${reportFilters.unit} · pessoa ${reportFilters.person} · seção ${reportFilters.section}`,
      "",
      "✅ Destaques", ...c.destaques.map(t=>`• ${t}`),
      "",
      "🔁 Inconsistências", ...c.inconsistencias.map(t=>`• ${t}`),
      "",
      "⚠️ Riscos", ...c.riscos.map(t=>`• ${t}`),
      "",
      "💡 Oportunidades", ...c.oportunidades.map(t=>`• ${t}`),
    ].join("\n");
    const file = new File([text],`dojo-parecer-${date}.txt`,{type:"text/plain;charset=utf-8"});
    try{
      if(navigator.share){ await navigator.share({files:[file],title:`Dojo — Parecer ${fmtDate(date)}`,text:`Parecer consolidado ${fmtDate(date)}`}); setMsg("Parecer compartilhado."); return; }
    }catch{ setMsg("Compartilhamento cancelado."); return; }
    downloadReport(text); setMsg("Parecer baixado — compartilhe pelo seu app de mensagens.");
  }
  function pendingDeps(itemId:string):Item[]{
    return (ITEM_DEPENDENCIES[itemId]||[])
      .filter(id=>entryFor(id).status!=="Feito")
      .map(id=>ALL_ITEMS.find(i=>i.id===id))
      .filter((i):i is Item=>!!i);
  }
  function suggestedFor(item:Item):{value:number;days:number}|null{
    const wd = new Date(`${date}T12:00:00`).getDay();
    const values:number[] = [];
    [7,14,21,28].forEach(n=>{
      const d = addDays(date,-n);
      if(new Date(`${d}T12:00:00`).getDay()!==wd) return;
      const raw = entries[`${selected}|${d}|${item.id}`]?.value;
      if(raw?.status!=="Feito") return;
      const v = parseFloat(String(raw.feito||"").replace(",","."));
      if(Number.isFinite(v)) values.push(v);
    });
    if(!values.length) return null;
    return { value:Math.round(values.reduce((a,b)=>a+b,0)/values.length), days:values.length };
  }
  function entryFor(id:string):Entry{
    const raw = entries[`${selected}|${date}|${id}`]?.value;
    if(!raw) return {profile:selected||"",date,itemId:id,status:"",feito:"",justificativa:""};
    const status: Status = raw.status as Status;
    return {...raw, status, feito: status==="Não feito" ? "0" : (raw.feito||"")};
  }
  async function createRow(row:Entry){
    await api("records.create",{collection:"dojo_entries",value:row,idempotency_key:`dojo-entry-${row.profile}-${row.date}-${row.itemId}`});
  }
  async function ensureShortageForEntry(entry:Entry){
    if(entry.status!=="Não feito" || entry.justificativa.trim()!=="Faltou insumo") return;
    const item = ALL_ITEMS.find(i=>i.id===entry.itemId);
    const already = Object.values(shortages).some(s=>s.value.profile===entry.profile && s.value.date===entry.date && s.value.itemId===entry.itemId && s.value.status==="Aberta");
    if(already) return;
    const value:Shortage = { profile: entry.profile, date: entry.date, itemId: entry.itemId, itemName: item?.name || entry.itemId, section: item?.section || "Produção", status: "Aberta", createdAt: nowTime() };
    const localId = `local-shortage-${normalizeLogin(entry.profile)}-${entry.date}-${entry.itemId}`;
    setShortages(prev=>({...prev,[localId]:{id:localId,value}}));
    try{ await api("records.create",{collection:"dojo_shortages",value,idempotency_key:`dojo-shortage-${normalizeLogin(entry.profile)}-${entry.date}-${entry.itemId}`}); await reloadRecords(); setOfflineMode(false); }catch{ setOfflineMode(true); }
  }
  async function resolveShortage(rec:{id:string,value:Shortage}){
    const next:Shortage = {...rec.value,status:"Resolvida"};
    setShortages(prev=>({...prev,[rec.id]:{id:rec.id,value:next}}));
    try{ if(!rec.id.startsWith("local-")) await api("records.replace",{collection:"dojo_shortages",id:rec.id,value:next}); else await api("records.create",{collection:"dojo_shortages",value:next,idempotency_key:`dojo-shortage-${normalizeLogin(rec.value.profile)}-${rec.value.date}-${rec.value.itemId}`}); await reloadRecords(); setOfflineMode(false); setMsg("Falta marcada como comprada / resolvida."); }catch{ setOfflineMode(true); }
  }
  function weeklyEntryFor(itemId:string):Entry{
    const wk = weekKeyFor(date);
    const raw = entries[`${selected}|${wk}|${itemId}`]?.value;
    if(!raw) return {profile:selected||"",date:wk,itemId,status:"",feito:"",justificativa:""};
    return {...raw,status:raw.status as Status};
  }
  async function setWeeklyStatus(item:{id:string;name:string}, status:"Feito"|"Não feito"){
    if(isManager){ setMsg("Modo conferência: a Gerência só confere o checklist."); return; }
    if(!selected) return;
    const cur = weeklyEntryFor(item.id);
    const nextStatus:Status = cur.status===status ? "" : status;
    const next:Entry = {...cur,profile:selected,date:weekKeyFor(date),itemId:item.id,status:nextStatus,feito:nextStatus==="Não feito"?"0":cur.feito,justificativa:""};
    await persistEntry(next);
  }
  async function completeWeekly(){
    if(isManager){ setMsg("Modo conferência: a Gerência só confere o checklist."); return; }
    if(!selected) return;
    const pending = WEEKLY_ITEMS.filter(i=>weeklyEntryFor(i.id).status==="");
    if(pending.length){ setMsg(`Faltam ${pending.length} item(ns) da Limpeza Semanal. Marque cada um como Feito ou Não feito.`); return; }
    const itemsSnapshot = WEEKLY_ITEMS.map(i=>({itemId:i.id,status:weeklyEntryFor(i.id).status as Status}));
    const feitos = itemsSnapshot.filter(i=>i.status==="Feito").length;
    const wk = weekKeyFor(date);
    const fingerprint = JSON.stringify(itemsSnapshot);
    const existing = Object.values(weeklySubs).filter(s=>s.value.profile===selected && s.value.weekKey===wk).sort((a,b)=>b.id.localeCompare(a.id))[0];
    if(existing && existing.value.fingerprint===fingerprint){ setMsg("Limpeza Semanal já enviada para esta semana."); return; }
    setWeeklySaving(true);
    const value:WeeklySubmission = { profile:selected, weekKey:wk, date:wk, items:itemsSnapshot, status:"Aguardando", fingerprint };
    const localId = `local-weekly-${normalizeLogin(selected)}-${wk}`;
    setWeeklySubs(prev=>({...prev,[localId]:{id:localId,value}}));
    try{ await api("records.create",{collection:"dojo_weekly",value,idempotency_key:`dojo-weekly-${normalizeLogin(selected)}-${wk}-${Date.now()}`}); await reloadRecords(); setOfflineMode(false); }catch{ setOfflineMode(true); }
    await sendChat(`🧹 Limpeza Semanal — ${selected} — ${feitos}/${WEEKLY_ITEMS.length}`, selected, selected);
    setWeeklySaving(false);
    setMsg(`Limpeza Semanal concluída e enviada para o Chat.`);
  }
  async function registerExpiry(){
    if(!selected) return;
    const product = expiryProduct.trim();
    if(!product){ setMsg("Digite o produto antes de registrar."); return; }
    if(!expiryDateInput){ setMsg("Escolha a data de validade."); return; }
    setExpirySaving(true);
    const value:ExpiryEntry = { profile:selected, date, product, expiryDate:expiryDateInput, registeredAt: nowTime() };
    const localId = `local-expiry-${normalizeLogin(selected)}-${date}-${Date.now()}`;
    setExpiries(prev=>({...prev,[localId]:{id:localId,value}}));
    try{ await api("records.create",{collection:"dojo_expiries",value,idempotency_key:`dojo-expiry-${normalizeLogin(selected)}-${date}-${Date.now()}`}); await reloadRecords(); setOfflineMode(false); }catch{ setOfflineMode(true); }
    const diff = daysBetween(date, expiryDateInput);
    if(diff<0){
      const planValue:ActionPlan = { profile:selected, date, itemId:`validade-${normalizeLogin(product)}-${expiryDateInput}`, itemName:`Descartar produto vencido — ${product}`, section:"Validade / Vencimento", justificativa:`Produto vencido em ${fmtDate(expiryDateInput)} — ${product}. Descartar e registrar a baixa.`, deadline:"Imediatamente", status:"Pendente", kind:"validade", createdAt: nowTime() };
      await saveActionPlanRecord(null, planValue, `dojo-plan-validade-${normalizeLogin(selected)}-${expiryDateInput}-${Date.now()}`);
      await sendChat(`⚠️ ALERTA - Produto vencido — ${selected} — ${product} venceu em ${fmtDate(expiryDateInput)} — descartar o produto.`, selected, selected);
      setMsg("Produto vencido registrado. Plano de ação criado e alerta enviado no Chat.");
    } else if(diff<=3){
      setMsg(`Validade registrada. Atenção: vence ${diff===0?"hoje":`em ${diff} dia(s)`}.`);
    } else {
      setMsg("Validade registrada.");
    }
    setExpiryProduct(""); setExpiryDateInput(""); setExpirySaving(false);
  }
  function maintEntryFor(itemId:string):MaintEntry{
    const raw = maintenance[`${selected}|${date}|${itemId}`]?.value;
    if(!raw) return {profile:selected||"",date,itemId,status:"",note:""};
    return {...raw,status:raw.status as Status};
  }
  async function persistMaint(next:MaintEntry){
    setDraftAt(nowTime());
    const key = `${next.profile}|${next.date}|${next.itemId}`;
    const existing = maintenance[key];
    setMaintenance(prev=>({...prev,[key]:{id:existing?.id||`local-${key}`,value:next}}));
    try{
      if(existing && !existing.id.startsWith("local-")) await api("records.replace",{collection:"dojo_maintenance",id:existing.id,value:next});
      else await api("records.create",{collection:"dojo_maintenance",value:next,idempotency_key:`dojo-maint-${normalizeLogin(next.profile)}-${next.date}-${next.itemId}`});
      await reloadRecords(); setOfflineMode(false);
    }catch{ setOfflineMode(true); }
  }
  async function setMaintStatus(item:{id:string;name:string;equipment:string}, status:"Feito"|"Não feito"){
    if(isManager){ setMsg("Modo conferência: a Gerência só confere o checklist."); return; }
    if(!selected) return;
    const cur = maintEntryFor(item.id);
    const nextStatus:Status = cur.status===status ? "" : status;
    const next:MaintEntry = {...cur, profile:selected, date, itemId:item.id, status:nextStatus, note: nextStatus==="Não feito" ? (maintNoteDraft[item.id] ?? cur.note ?? "") : cur.note};
    await persistMaint(next);
    if(nextStatus==="Não feito"){
      const existing = await findPlanRecord(selected, date, item.id, "manutencao");
      if(!existing){
        const planValue:ActionPlan = { profile:selected, date, itemId:item.id, itemName:`Manutenção — ${item.equipment}`, section:"Manutenção", justificativa:`${item.name} — marcado como Não feito por ${selected}.${next.note.trim() ? ` Problema: ${next.note.trim()}` : ""}`, deadline:"Até o próximo turno", status:"Pendente", kind:"manutencao", createdAt: nowTime() };
        await saveActionPlanRecord(null, planValue, `dojo-plan-maint-${normalizeLogin(selected)}-${date}-${item.id}-${Date.now()}`);
        await sendChat(`⚠️ OCORRÊNCIA — Manutenção — ${selected} — ${item.equipment} com problema: ${item.name}${next.note.trim() ? ` — ${next.note.trim()}` : ""} — ${nowTime()}`, selected, selected);
        setMsg("Manutenção registrada: plano de ação criado e ocorrência enviada no Chat.");
      }
    }
    if(nextStatus==="Feito" && cur.status==="Não feito"){
      const existing = await findPlanRecord(selected, date, item.id, "manutencao");
      if(existing) await saveActionPlanRecord(existing, {...existing.value, status:"Resolvido", resolvedAt: nowTime()}, `dojo-plan-maint-${normalizeLogin(selected)}-${date}-${item.id}`);
    }
  }
  function handleMaintNoteChange(item:{id:string;name:string;equipment:string}, text:string){
    if(isManager) return;
    setMaintNoteDraft(prev=>({...prev,[item.id]:text}));
    if(maintTimers.current[item.id]) clearTimeout(maintTimers.current[item.id]);
    maintTimers.current[item.id]=setTimeout(async()=>{
      const cur = maintEntryFor(item.id);
      if(cur.status!=="Não feito") return;
      await persistMaint({...cur, profile:selected||cur.profile, date, itemId:item.id, note:text});
      const existing = await findPlanRecord(selected||cur.profile, date, item.id, "manutencao");
      if(existing && text.trim()) await saveActionPlanRecord(existing, {...existing.value, justificativa:`${item.name} — marcado como Não feito por ${selected||cur.profile}. Problema: ${text.trim()}`}, `dojo-plan-maint-${normalizeLogin(selected||cur.profile)}-${date}-${item.id}`);
    },700);
  }
  async function confirmHandover(withNote:boolean){
    const sec = pendingHandoverSection;
    if(!sec) return;
    const text = handoverText.trim();
    if(withNote && !text){ setMsg("Escreva o recado ou use Concluir sem recado."); return; }
    setHandoverSaving(true);
    if(withNote && selected){
      setDraftAt(nowTime());
      const value:Handover = { profile:selected, date, turno, station: stationMap[selected]||"", text, time: nowTime() };
      const localId = `local-handover-${normalizeLogin(selected)}-${date}-${Date.now()}`;
      setHandovers(prev=>[...prev,{id:localId,value}]);
      try{ await api("records.create",{collection:"dojo_handovers",value,idempotency_key:`dojo-handover-${normalizeLogin(selected)}-${date}-${Date.now()}`}); await reloadRecords(); setOfflineMode(false); }catch{ setOfflineMode(true); }
      await sendChat(`📋 Recado para o próximo turno — ${selected} às ${value.time}: ${text}`, selected, selected);
    }
    setHandoverDialogOpen(false); setPendingHandoverSection(null); setHandoverText("");
    setHandoverSaving(false);
    setSaving(true);
    try{ await doCompleteSectionFor(sec); }catch{ setSaving(false); }
  }
  function withAudit(next:Entry):Entry{
    return {...next, updatedBy: authUser||next.profile, updatedAt: nowTime(), perfil, turno};
  }
  function shiftFor(profile:string,dateStr:string){ return shifts[`${profile}|${dateStr}`]?.value || null; }
  async function findPlanRecord(profile:string,dateStr:string,itemId:string,kind:string){
    try{
      const res = await api("records.list",{collection:"dojo_action_plans",limit:100});
      const list = (res.records||[]) as {id:string,value:ActionPlan}[];
      const found = list.filter(r=>r.value?.profile===profile && r.value?.date===dateStr && r.value?.itemId===itemId && r.value?.kind===kind && (r.value?.status==="Pendente"||r.value?.status==="Devolvido")).sort((a,b)=>b.id.localeCompare(a.id))[0];
      if(found) return found;
    }catch{}
    const local = Object.values(actionPlans).filter(r=>r.value?.profile===profile && r.value?.date===dateStr && r.value?.itemId===itemId && r.value?.kind===kind && (r.value?.status==="Pendente"||r.value?.status==="Devolvido")).sort((a,b)=>b.id.localeCompare(a.id))[0];
    return local || null;
  }
  async function saveActionPlanRecord(existing:{id:string,value:ActionPlan}|null, value:ActionPlan, idempotencyKey:string){
    const localId = existing?.id || `local-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setActionPlans(prev=>({...prev,[localId]:{id:localId,value}}));
    try{
      if(existing && !existing.id.startsWith("local-")) await api("records.replace",{collection:"dojo_action_plans",id:existing.id,value});
      else await api("records.create",{collection:"dojo_action_plans",value,idempotency_key:idempotencyKey});
      await reloadRecords();
      setOfflineMode(false);
    }catch{ setOfflineMode(true); }
  }
  async function ensureActionPlanForItem(item:Item, justificativa:string){
    if(!selected) return;
    const existing = await findPlanRecord(selected,date,item.id,"nao-feito");
    if(existing){
      if((existing.value.justificativa||"")!==justificativa) await saveActionPlanRecord(existing,{...existing.value,justificativa},`dojo-plan-${normalizeLogin(selected)}-${date}-${item.id}-nao-feito`);
      return;
    }
    const value:ActionPlan={profile:selected,date,itemId:item.id,itemName:item.name,section:item.section,justificativa,deadline:"Até o próximo turno",status:"Pendente",kind:"nao-feito",createdAt:nowTime()};
    await saveActionPlanRecord(null,value,`dojo-plan-${normalizeLogin(selected)}-${date}-${item.id}-nao-feito-${Date.now()}`);
  }
  async function resolveActionPlanForItem(itemId:string){
    if(!selected) return;
    const existing = await findPlanRecord(selected,date,itemId,"nao-feito");
    if(!existing) return;
    await saveActionPlanRecord(existing,{...existing.value,status:"Resolvido",resolvedAt:nowTime()},`dojo-plan-${normalizeLogin(selected)}-${date}-${itemId}-nao-feito`);
  }
  async function updatePlanJustificativa(item:Item, text:string){
    if(!selected) return;
    const existing = await findPlanRecord(selected,date,item.id,"nao-feito");
    if(!existing) return;
    if(existing.value.justificativa===text) return;
    await saveActionPlanRecord(existing,{...existing.value,justificativa:text},`dojo-plan-${normalizeLogin(selected)}-${date}-${item.id}-nao-feito`);
  }
  async function ensureTempActionPlan(friaStr:string, freezerStr:string){
    if(!selected) return false;
    const friaN = parseTempValue(friaStr);
    const freezerN = parseTempValue(freezerStr);
    const friaBad = friaN!==null && (friaN<0 || friaN>5);
    const freezerBad = freezerN!==null && freezerN>=-12;
    if(!friaBad && !freezerBad) return false;
    const parts:string[]=[];
    if(friaBad) parts.push(`Câmara Fria: ${friaStr.trim()} °C (faixa 0–5 °C)`);
    if(freezerBad) parts.push(`Freezer: ${freezerStr.trim()} °C (abaixo de -12 °C)`);
    const justificativa = `Temperatura fora da faixa — ${parts.join(" · ")}`;
    const existing = await findPlanRecord(selected,date,"temperatura","temperatura");
    if(existing){
      if(existing.value.justificativa!==justificativa) await saveActionPlanRecord(existing,{...existing.value,justificativa},`dojo-plan-temp-${normalizeLogin(selected)}-${date}`);
      return false;
    }
    const value:ActionPlan={profile:selected,date,itemId:"temperatura",itemName:"⚠️ ALERTA - Temperatura fora da faixa",section:"Temperatura",justificativa,deadline:"Até o próximo turno",status:"Pendente",kind:"temperatura",createdAt:nowTime()};
    await saveActionPlanRecord(null,value,`dojo-plan-temp-${normalizeLogin(selected)}-${date}-${Date.now()}`);
    await sendChat(`⚠️ ALERTA - Temperatura fora da faixa — ${selected} — ${parts.join(" · ")} — ${nowTime()}`,selected,selected);
    return true;
  }
  async function resolvePlanDirect(plan:{id:string,value:ActionPlan}){
    await saveActionPlanRecord(plan,{...plan.value,status:"Resolvido",resolvedAt:nowTime()},`dojo-plan-resolve-${plan.id}`);
    setMsg("Plano de ação marcado como resolvido.");
  }
  async function devolverPlan(plan:{id:string,value:ActionPlan}){
    const note = plan.value.justificativa ? `Corrigir: ${plan.value.itemName} — ${plan.value.justificativa}` : `Corrigir: ${plan.value.itemName}`;
    await saveActionPlanRecord(plan,{...plan.value,status:"Devolvido"},`dojo-plan-devolver-${plan.id}`);
    const target = Object.values(submissions).filter(s=>s.value.profile===plan.value.profile && s.value.date===plan.value.date && s.value.section===plan.value.section && (s.value.status==="Aguardando"||s.value.status==="Aprovado")).sort((a,b)=>b.id.localeCompare(a.id))[0];
    if(target){
      const nextSub = {...target.value,status:"Para corrigir" as const,correctionNote:note};
      setSubmissions(prev=>({...prev,[target.id]:{id:target.id,value:nextSub}}));
      try{ await api("records.replace",{collection:"dojo_submissions",id:target.id,value:nextSub}); }catch{}
      void clearShiftFinished(target.value.profile,target.value.date);
    }
    await sendChat(`🔁 Ocorrência — ${plan.value.profile} · ${plan.value.section}: ${note}. Por favor, corrigir e concluir de novo.`,"Gerência",plan.value.profile);
    setMsg("Plano devolvido para correção.");
  }
  function displaySectionTitle(sec:Section):string{
    if(sec==="Montagem da Pista - Fria" || sec==="Montagem da Pista - Quente") return `Abertura — ${sec}`;
    if(sec==="Reposição da Pista - Fria" || sec==="Reposição da Pista - Quente") return `Fechamento — ${sec}`;
    if(sec==="Produção do Quiosque"){
      if(selected && KIOSK_PROFILES.includes(selected)) return turno==="Noite" ? "Fechamento — Reposição + Fechamento da Pista" : "Abertura — Produção + Montagem da Pista";
      return sec;
    }
    return sec;
  }
  async function ensureShiftStarted(){
    if(!selected) return null;
    const existing = shiftFor(selected,date);
    if(existing) return existing;
    const value:ShiftEntry={profile:selected,date,startedAt:nowTime(),startedBy:authUser||selected};
    const key=`${selected}|${date}`;
    setShifts(prev=>({...prev,[key]:{id:`local-shift-${key}`,value}}));
    try{ await api("records.create",{collection:"dojo_shifts",value,idempotency_key:`dojo-shift-${normalizeLogin(selected)}-${date}`}); setOfflineMode(false); }catch{ setOfflineMode(true); }
    return value;
  }
  async function markShiftFinished(finishedAt:string){
    if(!selected) return;
    const existing = shiftFor(selected,date);
    const value:ShiftEntry = existing ? {...existing,finishedAt,finishedBy:authUser||selected} : {profile:selected,date,startedAt:finishedAt,startedBy:authUser||selected,finishedAt,finishedBy:authUser||selected};
    const key=`${selected}|${date}`;
    const existingId = shifts[key]?.id;
    setShifts(prev=>({...prev,[key]:{id:existingId||`local-shift-${key}`,value}}));
    try{
      if(existingId && !existingId.startsWith("local-")) await api("records.replace",{collection:"dojo_shifts",id:existingId,value});
      else await api("records.create",{collection:"dojo_shifts",value,idempotency_key:`dojo-shift-${normalizeLogin(selected)}-${date}`});
      setOfflineMode(false);
    }catch{ setOfflineMode(true); }
  }
  async function clearShiftFinished(profile:string,dateStr:string){
    const key=`${profile}|${dateStr}`;
    const rec = shifts[key];
    if(!rec?.value?.finishedAt) return;
    const value:ShiftEntry={profile:rec.value.profile,date:rec.value.date,startedAt:rec.value.startedAt,startedBy:rec.value.startedBy};
    setShifts(prev=>({...prev,[key]:{id:rec.id,value}}));
    try{ if(!rec.id.startsWith("local-")) await api("records.replace",{collection:"dojo_shifts",id:rec.id,value}); setOfflineMode(false); }catch{ setOfflineMode(true); }
  }
  async function sendOccurrence(){
    if(isManager){ setMsg("Modo conferência: a Gerência não registra ocorrência pelo checklist."); return; }
    const text = occurrenceText.trim();
    if(!text || !selected) return;
    const message = `⚠️ OCORRÊNCIA — ${selected} — ${text} — ${nowTime()}`;
    setOccurrenceSending(true);
    try{ await sendChat(message, authUser||selected, "Gerência"); setOccurrenceText(""); setOccurrenceOpen(false); setMsg("Ocorrência enviada para a Gerência."); }catch{ setMsg("Ocorrência não enviada. Tente de novo."); }
    setOccurrenceSending(false);
  }
  async function persistEntry(next:Entry){
    const stamped = withAudit(next);
    const key=`${stamped.profile}|${stamped.date}|${stamped.itemId}`; const existing=entries[key];
    // Salva local (em tela) primeiro; a sincronização em segundo plano nunca trava nem mostra erro.
    setEntries(prev=>({...prev,[key]:{id:existing?.id||`local-${key}`,value:stamped}}));
    setDraftAt(nowTime());
    if(stamped.status==="Não feito" && stamped.justificativa.trim()==="Faltou insumo"){ void ensureShortageForEntry(stamped); }
    try{
      if(existing && !existing.id.startsWith("local-")) await api("records.replace",{collection:"dojo_entries",id:existing.id,value:stamped});
      else await createRow(stamped);
      await reloadRecords();
      setOfflineMode(false);
    }catch{ setOfflineMode(true); }
  }
  async function saveEntry(next:Entry, opts?:{silent?:boolean; message?:string}){
    if(!selected) return; if(!opts?.silent){ setMsg(""); }
    await persistEntry(next);
    if(!opts?.silent){ setMsg(opts?.message || "Item salvo."); }
  }
  async function setStatus(item:Item,status:"Feito"|"Não feito"){
    if(isManager){ setMsg("Modo conferência: a Gerência só confere o checklist."); return; }
    if(status==="Feito"){
      const deps = pendingDeps(item.id);
      if(deps.length){ setMsg(`Antes de ${item.name}, marque como Feito: ${deps.map(d=>d.name).join(", ")}.`); return; }
      if(itemRules.find(r=>r.value.itemId===item.id)?.value.requirePhoto && !entryFor(item.id).photo){
        setMsg(`Foto obrigatória em ${item.name} antes de marcar como Feito.`); return;
      }
    }
    const cur=entryFor(item.id);
    if(cur.status===""){ void ensureShiftStarted(); }
    if(cur.status===status){
      if(justTimers.current[item.id]) clearTimeout(justTimers.current[item.id]);
      setJustOpen(prev=>({...prev,[item.id]:false}));
      setJustDraft(prev=>({...prev,[item.id]:""}));
      setJustSaved(prev=>({...prev,[item.id]:false}));
      await saveEntry({...cur,status:"",feito:"",justificativa:""},{message:"Item desmarcado — voltou para sem marcação."});
      return;
    }
    if(status==="Não feito"){
      setJustOpen(prev=>({...prev,[item.id]:true}));
      setJustSaved(prev=>({...prev,[item.id]:false}));
      const comingFromFeito = cur.status==="Feito";
      const just = comingFromFeito ? "" : (justDraft[item.id] ?? cur.justificativa ?? "");
      if(comingFromFeito) setJustDraft(prev=>({...prev,[item.id]:""}));
      await saveEntry({...cur,status,feito:"0",justificativa:just},{message: just.trim() ? "Item salvo." : "Conte por que não foi feito — justificativa obrigatória para concluir."});
      void ensureActionPlanForItem(item, just);
      void notifyCritical(item);
      return;
    }
    const hadJust = ((justDraft[item.id] ?? cur.justificativa ?? "").trim()!=="") || cur.status==="Não feito";
    setJustOpen(prev=>({...prev,[item.id]:false}));
    setJustDraft(prev=>({...prev,[item.id]:""}));
    setJustSaved(prev=>({...prev,[item.id]:false}));
    if(justTimers.current[item.id]) clearTimeout(justTimers.current[item.id]);
    await saveEntry({...cur,status,feito:cur.feito==="0"?"":cur.feito,justificativa:""},{message: hadJust ? "Justificativa limpa — item marcado como Feito." : undefined});
    if(cur.status==="Não feito"){ void resolveActionPlanForItem(item.id); }
  }
  function handleJustificationChange(item:Item, text:string){
    if(isManager) return;
    setJustDraft(prev=>({...prev,[item.id]:text}));
    setJustSaved(prev=>({...prev,[item.id]:false}));
    if(justTimers.current[item.id]) clearTimeout(justTimers.current[item.id]);
    justTimers.current[item.id]=setTimeout(async()=>{
      const cur=entryFor(item.id);
      if(cur.status!=="Não feito") return;
      setJustSaving(prev=>({...prev,[item.id]:true}));
      try{
        await persistEntry({...cur,status:"Não feito",feito:"0",justificativa:text});
        await updatePlanJustificativa(item,text);
        setJustSaved(prev=>({...prev,[item.id]:true}));
      }catch{ }
      setJustSaving(prev=>({...prev,[item.id]:false}));
    },700);
  }
  function applyQuickReason(item:Item, reason:string){
    if(reason==="Outro"){ handleJustificationChange(item,""); return; }
    handleJustificationChange(item,reason);
  }
  async function saveFeito(item:Item,value:string){
    if(isManager) return;
    const cur=entryFor(item.id);
    if(cur.status!=="Feito") return;
    await saveEntry({...cur,feito:value});
  }
  async function savePhoto(item:Item, dataUrl:string, opts?:{silent?:boolean}){
    if(isManager) return;
    if(!selected) return;
    const cur=entryFor(item.id);
    await persistEntry({...cur,photo:dataUrl});
    if(!opts?.silent) setMsg(dataUrl ? "Foto salva neste item." : "Foto excluída deste item.");
  }

  const friaNum = parseTempValue(tempFria);
  const freezerNum = parseTempValue(tempFreezer);
  const friaLim = tempLimits.find(r=>r.value.key==="fria")?.value || {key:"fria" as const,min:0,max:5};
  const freezerLim = tempLimits.find(r=>r.value.key==="freezer")?.value || {key:"freezer" as const,min:-30,max:-12};
  const friaOut = friaNum!==null && (friaNum<friaLim.min || friaNum>friaLim.max);
  const freezerOut = freezerNum!==null && (freezerNum<freezerLim.min || freezerNum>freezerLim.max);
  const anyTempOut = friaOut || freezerOut;

  async function persistTemp(nextFria:string, nextFreezer:string){
    if(!selected) return;
    const value:TempEntry = { profile:selected, date, fria:nextFria, freezer:nextFreezer };
    const key = `${selected}|${date}`;
    const existing = temps[key];
    setTemps(prev=>({...prev,[key]:{id:existing?.id||`local-${key}`,value}}));
    setDraftAt(nowTime());
    setTempSaving(true);
    try{
      if(existing && !existing.id.startsWith("local-")) await api("records.replace",{collection:"dojo_temps",id:existing.id,value});
      else await api("records.create",{collection:"dojo_temps",value,idempotency_key:`dojo-temp-${normalizeLogin(selected||"")}-${date}`});
      await reloadRecords();
      setOfflineMode(false);
    }catch{ setOfflineMode(true); }
    void ensureTempActionPlan(nextFria,nextFreezer);
    setTempSaving(false);
  }
  function handleTempChange(which:"fria"|"freezer", value:string){
    if(isManager) return;
    const cleaned = value.replace(/[^0-9.,-]/g,"");
    const nextFria = which==="fria" ? cleaned : tempFria;
    const nextFreezer = which==="freezer" ? cleaned : tempFreezer;
    if(which==="fria") setTempFria(cleaned); else setTempFreezer(cleaned);
    if(tempTimer.current) clearTimeout(tempTimer.current);
    tempTimer.current = setTimeout(()=>{ persistTemp(nextFria,nextFreezer); },800);
  }

  async function startVoiceNote(){
    try{
      if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==="undefined"){
        setMsg("Gravação de voz não suportada neste navegador.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (ev:BlobEvent)=>{ if(ev.data.size) audioChunksRef.current.push(ev.data); };
      rec.onstop = async ()=>{
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(audioChunksRef.current,{type:rec.mimeType||"audio/webm"});
        if(blob.size){
          const dataUrl = await new Promise<string>(resolve=>{
            const reader = new FileReader();
            reader.onload = ()=>resolve(String(reader.result||""));
            reader.readAsDataURL(blob);
          });
          if(dataUrl && conversation){
            const secs = Math.max(1,Math.round((Date.now()-recordStartRef.current)/1000));
            await sendChat(`🎤 Áudio (${secs}s)`,authUser||"",conversation,{audio:dataUrl,duration:secs});
          }
        }
      };
      rec.start();
      mediaRecorderRef.current = rec;
      recordStartRef.current = Date.now();
      setRecording(true);
    }catch{
      setMsg("Não foi possível acessar o microfone. Permita o uso no navegador.");
      setRecording(false);
    }
  }
  function stopVoiceNote(){
    const rec = mediaRecorderRef.current;
    if(rec && rec.state!=="inactive"){
      rec.stop();
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  }
  async function sendChat(text:string,sender:string,profile:string,extra?:{audio?:string;duration?:number}){
    const value:ChatMsg={profile,sender,text,time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),...(extra||{})};
    const localId = `local-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setChat(prev=>[...prev,{id:localId,value}]);
    try{ await api("records.create",{collection:"dojo_chat",value,idempotency_key:`dojo-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`}); void notifyMessage({profile,sender,text}); await reloadRecords(); setOfflineMode(false); }catch{ setOfflineMode(true); }
  }

  useEffect(()=>{
    const sync = async () => { await flushQueue(); setQueuedCount(queueSize()); };
    void sync();
    const t = setInterval(()=>void sync(),20000);
    const onOnline = () => void sync();
    window.addEventListener("online",onOnline);
    return ()=>{ clearInterval(t); window.removeEventListener("online",onOnline); };
  },[]);
  useEffect(()=>{
    if(!authUser) return;
    const t = setInterval(()=>{ reloadRecords().then(()=>setOfflineMode(false)).catch(()=>setOfflineMode(true)); },20000);
    return ()=>clearInterval(t);
  },[authUser]);

  async function completeSectionFor(sec:Section){
    // Conclusão nunca é bloqueada por falha de rede: o registro local já vale e a sincronização é silenciosa.
    if(isManager){ setMsg("Modo conferência: a Gerência só confere o checklist."); return; }
    if(!selected) return;
    const sub = submissionForSection(sec);
    const locked = !!sub && (sub.value.status==="Aguardando" || sub.value.status==="Aprovado");
    if(locked){ setMsg(sub.value.status==="Aprovado" ? "Aprovado pela Gerência" : "Aguardando conferência da Gerência no Chat"); goToChatForCurrent(); return; }
    const list = itemsForSection(sec);
    const pending=list.filter(i=>{ const s=entryFor(i.id).status; return s===""; });
    if(pending.length){ setMsg(`Faltam ${pending.length} item(ns) em ${sec}. Marque cada um como Feito ou Não feito antes de concluir.`); return; }
    const naoFeitos = list.filter(i=>entryFor(i.id).status==="Não feito");
    const withoutJust = naoFeitos.filter(i=>!((justDraft[i.id] ?? entryFor(i.id).justificativa ?? "").trim()));
    if(withoutJust.length){ setMsg("Preencha o motivo dos itens Não feitos"); return; }
    const isLastSection = activeSections.every(s=> s===sec || !!submissionForSection(s));
    if(isLastSection){
      setPendingHandoverSection(sec);
      setHandoverText("");
      setHandoverDialogOpen(true);
      return;
    }
    setSaving(true);
    try{ await doCompleteSectionFor(sec); }catch{ setSaving(false); }
  }
  async function doCompleteSectionFor(sec:Section){
    if(!selected) return;
    const list = itemsForSection(sec);
    const itemsSnapshot: SubmissionItem[] = list.map(i=>{ const en=entryFor(i.id); return {itemId:i.id,status:en.status as Status,feito:en.status==="Não feito"?"0":(en.feito||""),justificativa:(justDraft[i.id] ?? en.justificativa ?? "")}; });
    const feitos = list.filter(i=>entryFor(i.id).status==="Feito");
    const naoFeitos = list.filter(i=>entryFor(i.id).status==="Não feito");
    const fingerprint = JSON.stringify(itemsSnapshot);
    const existing = submissionForSection(sec);
    if(existing && existing.value.fingerprint===fingerprint && (existing.value.status==="Aguardando" || existing.value.status==="Aprovado")){
      setMsg("Esta seção já foi enviada para conferência. Abrindo o Chat."); setSaving(false); goToChatForCurrent(); return;
    }
    const isResend = !!existing && existing.value.status==="Para corrigir";
    const tempLines: string[] = [];
    if(tempFria.trim() || tempFreezer.trim()){
      tempLines.push(`Temperaturas:`);
      if(tempFria.trim()) tempLines.push(`• Câmara Fria: ${tempFria.trim()} °C${friaOut ? " — FORA DA FAIXA (0–5 °C)" : ""}`);
      if(tempFreezer.trim()) tempLines.push(`• Freezer: ${tempFreezer.trim()} °C${freezerOut ? " — FORA DA FAIXA (abaixo de -12 °C)" : ""}`);
      if(anyTempOut) tempLines.push(`⚠️ Temperatura fora da faixa - avisar Gerência`);
    }
    const currentShift = shiftFor(selected||"",date);
    const startedAtForDetail = currentShift?.startedAt || nowTime();
    const startedByForDetail = currentShift?.startedBy || (authUser||selected||"");
    if(!currentShift){ void ensureShiftStarted(); }
    const isLastSection = activeSections.every(s=> s===sec || !!submissionForSection(s));
    const finishedAtForDetail = isLastSection ? nowTime() : "";
    const shiftLines = [`Iniciado às ${startedAtForDetail} — por ${startedByForDetail}`, ...(finishedAtForDetail ? [`Concluído às ${finishedAtForDetail} — por ${authUser||selected||""}`] : [])];
    const detail = [
      isResend ? `✅ Checklist corrigido e reenviado - ${selected} - ${fmtDate(date)} - ${perfil} - ${turno}` : `✅ Checklist concluído - ${selected} - ${fmtDate(date)} - ${perfil} - ${turno}`,
      `${sec} - ${sec==="Produção" ? period : "Rotina"}`,
      `Feitos: ${feitos.length} · Não feitos: ${naoFeitos.length}`,
      ...shiftLines,
      `Aguardando conferência.`,
      ...tempLines,
    ].join("\n");
    if(isLastSection){ void markShiftFinished(finishedAtForDetail); }
    const localValue:Submission = isResend && existing ? {...existing.value,status:"Aguardando" as const,perfil,turno,items:itemsSnapshot,fingerprint,correctionNote:""} : {profile:selected,date,section:sec,period,perfil,turno,items:itemsSnapshot,status:"Aguardando" as const,fingerprint};
    const localId = isResend && existing ? existing.id : `local-sub-${normalizeLogin(selected||"")}-${date}-${sec}-${period}-${Date.now()}`;
    setSubmissions(prev=>({...prev,[localId]:{id:localId,value:localValue}}));
    try{
      if(isResend && existing && !existing.id.startsWith("local-")){
        await api("records.replace",{collection:"dojo_submissions",id:existing.id,value:{...existing.value,status:"Aguardando",perfil,turno,items:itemsSnapshot,fingerprint,correctionNote:""}});
      } else if(isResend && existing && existing.id.startsWith("local-")){
        await api("records.create",{collection:"dojo_submissions",value:{profile:selected,date,section:sec,period,perfil,turno,items:itemsSnapshot,status:"Aguardando",fingerprint},idempotency_key:`dojo-sub-${normalizeLogin(selected||"")}-${date}-${sec}-${period}`});
      } else {
        await api("records.create",{collection:"dojo_submissions",value:{profile:selected,date,section:sec,period,perfil,turno,items:itemsSnapshot,status:"Aguardando",fingerprint},idempotency_key:`dojo-sub-${normalizeLogin(selected||"")}-${date}-${sec}-${period}-${Date.now()}`});
      }
      await reloadRecords();
      setOfflineMode(false);
    }catch{ setOfflineMode(true); }
    await sendChat(detail,selected,selected);
    const allDone = activeSections.every(s=> s===sec || !!submissionForSection(s));
    setSaving(false);
    if(allDone){
      setMsg(`Checklist de hoje concluído.`);
      goToChatForCurrent();
    } else {
      setMsg(isResend ? `Ocorrência corrigida e reenviada.` : `${sec} concluída e enviada para conferência.`);
    }
  }

  function messagesForPerson(person:string){
    const me = authUser||"";
    return chat.filter(m=>{
      const p = m.value.profile, s = m.value.sender;
      if(person==="Gerência"){
        return (p===me && (s==="Gerência" || s===me)) || (p==="Gerência" && s===me);
      }
      if(me==="Gerência"){
        return (p===person && (s===person || s==="Gerência")) || (p==="Gerência" && s===person);
      }
      return (p===person && s===me) || (p===me && s===person);
    });
  }
  const conversations = useMemo(()=>{
    type Convo = { id:string; name:string; subtitle:string; kind:"group"|"dm"; badge?:string; members?:number; last?:{id:string;value:ChatMsg} };
    if(!authUser) return [] as Convo[];
    const list:Convo[] = [];
    groups.forEach(g=>{
      const msgs = chat.filter(m=>m.value.profile===g.key);
      list.push({ id:g.key, name:g.name, subtitle:g.desc, kind:"group", badge:g.members.includes(authUser)?"Seu grupo":undefined, members:g.members.length, last:msgs[msgs.length-1] });
    });
    const others = isManager ? staffProfiles : ["Gerência", ...staffProfiles.filter(p=>p!==authUser)];
    others.forEach(p=>{
      const msgs = messagesForPerson(p);
      list.push({ id:p, name:p, subtitle:stationMap[p]||"", kind:"dm", last:msgs[msgs.length-1] });
    });
    return list;
  },[chat,authUser,isManager]);
  const activeConvo = conversations.find(c=>c.id===conversation);
  const convoMessages = useMemo(()=>{
    if(!conversation) return [];
    if(conversation.startsWith("grupo:")) return chat.filter(m=>m.value.profile===conversation);
    return messagesForPerson(conversation);
  },[chat,conversation,authUser]);
  useEffect(()=>{
    if(tab!=="chat" || !conversation || !authUser) return;
    const pending = convoMessages.filter(m=>m.value.sender==="Gerência" && !reads.some(r=>r.value.messageId===m.id && r.value.profile===authUser));
    if(!pending.length) return;
    const key = `${conversation}|${pending.map(m=>m.id).join(",")}`;
    if(readMarkedRef.current===key) return;
    readMarkedRef.current = key;
    (async()=>{
      try{
        for(const m of pending) await api("records.create",{collection:"dojo_chat_reads",value:{messageId:m.id,profile:authUser,at:nowTime()}});
        await reloadAux();
      }catch{ readMarkedRef.current=""; }
    })();
  },[tab,conversation,convoMessages,reads,authUser]);
  const visibleMessageCount = useMemo(()=>{
    if(!authUser) return 0;
    const ids = new Set<string>();
    groups.forEach(g=>{ chat.forEach(m=>{ if(m.value.profile===g.key) ids.add(m.id); }); });
    const others = isManager ? staffProfiles : ["Gerência", ...staffProfiles.filter(p=>p!==authUser)];
    others.forEach(p=>messagesForPerson(p).forEach(m=>ids.add(m.id)));
    return ids.size;
  },[chat,authUser,isManager]);
  function parseChecklist(text:string){
    const fresh = text.match(/^✅ Checklist (?:concluído|corrigido e reenviado) - (.+?) - (\d{2}\/\d{2}\/\d{4}) - (.+?) - (.+)$/m);
    if(!fresh) return {person:"", sectionText:""};
    const lines = text.split("\n");
    const sectionLine = lines[1]||"";
    const sectionText = sectionLine.split(" - ")[0]||"";
    return {person:fresh[1]||"", sectionText, isResend: text.includes("corrigido e reenviado")};
  }
  async function decideSubmission(sub:{id:string,value:Submission}, status:"Aprovado"|"Para corrigir", note:string){
    if(!isManager){ setMsg("Apenas a Gerência pode conferir."); return; }
    setSaving(true);
    try{
      const next = {...sub.value, status, correctionNote: note};
      setSubmissions(prev=>({...prev,[sub.id]:{...sub,value:next}}));
      if(status==="Aprovado"){
        await sendChat(`✅ Aprovado pela Gerência — ${sub.value.profile} · ${sub.value.section}. Pode seguir com a operação.`,"Gerência",sub.value.profile);
        setMsg("Checklist aprovado e registrado no chat e no histórico.");
      }else{
        await sendChat(`🔁 Ocorrência — ${sub.value.profile} · ${sub.value.section}: ${note}. Por favor, corrigir e concluir de novo.`,"Gerência",sub.value.profile);
        void clearShiftFinished(sub.value.profile, sub.value.date);
        setMsg("Observação enviada. O checklist voltou para correção.");
      }
      try{ await api("records.replace",{collection:"dojo_submissions",id:sub.id,value:next}); await reloadRecords(); setOfflineMode(false); }catch{ setOfflineMode(true); }
    }catch{ }
    setSaving(false);
  }
  function startStaffEdit(c:{id:string;value:CredentialRecord}){
    if(!isManager){ setStaffMsg("Somente a Gerência pode editar funcionários."); return; }
    setStaffForm({name:c.value.profile,login:c.value.login,password:c.value.password||DEFAULT_PASSWORD,station:c.value.station||"",group:c.value.group||"",shift:c.value.shift||"Manhã"});
    setStaffEditingId(c.id); setStaffMsg("");
  }
  function startBuiltinStaffEdit(login:string){
    if(!isManager){ setStaffMsg("Somente a Gerência pode editar funcionários."); return; }
    const key = normalizeLogin(login);
    const profile = LOGIN_TO_PROFILE[key]||"";
    const groupKey = GROUP_CHANNELS.find(g=>g.members.includes(profile))?.key||"";
    setStaffForm({name:profile,login:key,password:DEFAULT_PASSWORD,station:STATIONS[profile]||"",group:groupKey.replace("grupo:",""),shift:KIOSK_NIGHT_PROFILES.includes(profile)?"Noite":"Manhã"});
    setStaffEditingId(`builtin:${key}`); setStaffMsg("");
  }
  function resetStaffForm(){ setStaffForm({}); setStaffEditingId(null); setStaffMsg(""); }
  async function saveStaffRecord(){
    if(!isManager){ setStaffMsg("Somente a Gerência pode cadastrar funcionários."); return; }
    const name = String(staffForm.name||"").trim();
    const login = normalizeLogin(staffForm.login||"");
    const password = String(staffForm.password||"").trim() || DEFAULT_PASSWORD;
    if(!name || !login){ setStaffMsg("Preencha nome e login."); return; }
    if(login==="gerencia"){ setStaffMsg("Login reservado para a Gerência."); return; }
    const editing = staffEditingId;
    const editingRec = editing && !editing.startsWith("builtin:") ? credentials.find(c=>c.id===editing) : null;
    const originalLogin = editingRec?.value.replaces || (editing?.startsWith("builtin:") ? editing.slice("builtin:".length) : "");
    const originalProfile = editingRec?.value.replacesProfile || (editing?.startsWith("builtin:") ? (LOGIN_TO_PROFILE[originalLogin]||"") : "");
    if(credentials.some(c=>c.id!==editing && normalizeLogin(c.value.login)===login)){ setStaffMsg("Este login já está cadastrado."); return; }
    if(LOGIN_TO_PROFILE[login] && login!==originalLogin){ setStaffMsg("Este login já está cadastrado."); return; }
    setStaffSaving(true); setStaffMsg("");
    const value:CredentialRecord = {
      ...(editingRec?.value||{}),
      login, profile:name, password: await hashPassword(password),
      station:String(staffForm.station||"Equipe").trim(),
      group:String(staffForm.group||"").trim(),
      shift:String(staffForm.shift||"Manhã").trim(),
      unit:String(staffForm.unit||"Matriz").trim(),
      ...(originalLogin ? {replaces:originalLogin} : {}),
      ...(originalProfile ? {replacesProfile:originalProfile} : {}),
    };
    try{
      if(editingRec) await api("records.replace",{collection:"dojo_credentials",id:editing!,value});
      else await api("records.create",{collection:"dojo_credentials",value,idempotency_key:`dojo-staff-${login}-${Date.now()}`});
      try{ await supabaseCreateUser(login,password,getAuthToken()); }catch{}
      await reloadRecords(); setOfflineMode(false);
      resetStaffForm();
      setStaffMsg(`${name} salvo. Login: ${login} · senha: ${password}.`);
    }catch{ setOfflineMode(true); setStaffMsg("Não foi possível salvar o cadastro. Tente novamente."); }
    setStaffSaving(false);
  }
  function taskOverdue(t:TaskRecord){
    if(t.status==="Concluída") return false;
    return `${t.dueDate}T${t.dueTime||"23:59"}` < brazilNowString();
  }
  function tempLimitFor(key:"fria"|"freezer"){ return tempLimits.find(r=>r.value.key===key)?.value; }
  function generateFromDescription(desc:string):Item[]{
    const q = normalizeLogin(desc);
    const found = ALL_ITEMS.filter(i=>{
      const n = normalizeLogin(i.name);
      return q.includes(n) || n.split(" ").some(w=>w.length>=4 && q.includes(w));
    }).slice(0,30);
    if(found.length) return found;
    const sec:Section = q.includes("limpeza") ? "Limpeza" : q.includes("organizacao") || q.includes("organização") ? "Organização" : "Produção";
    return ALL_ITEMS.filter(i=>i.section===sec).slice(0,20);
  }
  async function saveTemplate(){
    if(!isManager){ setMsg("Somente a Gerência cria modelos."); return; }
    const name = String(auxForm.tplName||"").trim();
    if(!name){ setMsg("Dê um nome ao modelo."); return; }
    const desc = String(auxForm.tplDesc||"").trim();
    const source = String(auxForm.tplSource||selected||"Wesley");
    const items = desc ? generateFromDescription(desc) : [...(effectiveByProfile[source]||[])];
    if(!items.length){ setMsg("Nenhum item encontrado para o modelo."); return; }
    const value:TemplateRecord = { name, description:desc, items, createdAt:new Date().toISOString() };
    try{ await api("records.create",{collection:"dojo_templates",value}); setAuxForm({}); await reloadAux(); setMsg(`Modelo “${name}” salvo com ${items.length} itens.`); }catch{ setMsg("Não foi possível salvar o modelo."); }
  }
  async function applyTemplate(row:{id:string;value:TemplateRecord}){
    if(!isManager){ setMsg("Somente a Gerência aplica modelos."); return; }
    const target = String(auxForm.tplTarget||"").trim();
    if(!target){ setMsg("Escolha a pessoa/posto de destino."); return; }
    const value:CustomItemsRecord = { profile:target, items:row.value.items, updatedAt:new Date().toISOString() };
    const existing = customItems.find(c=>c.value.profile===target);
    try{
      if(existing) await api("records.replace",{collection:"dojo_custom_items",id:existing.id,value});
      else await api("records.create",{collection:"dojo_custom_items",value});
      await reloadAux(); setMsg(`Modelo aplicado a ${target}.`);
    }catch{ setMsg("Não foi possível aplicar o modelo."); }
  }
  async function saveQuestion(){
    if(!isManager){ setMsg("Somente a Gerência cria perguntas."); return; }
    const question = String(auxForm.qText||"").trim();
    if(!question){ setMsg("Escreva a pergunta."); return; }
    const value:QuestionRecord = { question, section:String(auxForm.qSection||"Produção").trim(), weight:Math.max(1,Math.min(5,Number(auxForm.qWeight||3))), minScore:Number(auxForm.qMin||7.5), type:(auxForm.qType||"check") as QuestionRecord["type"], options:String(auxForm.qOptions||"").trim(), correct:String(auxForm.qCorrect||"").trim(), hint:String(auxForm.qHint||"").trim(), referencePhoto:String(auxForm.qRef||""), createdAt:new Date().toISOString() };
    try{ await api("records.create",{collection:"dojo_questions",value}); setAuxForm({}); await reloadAux(); setMsg("Pergunta de auditoria criada."); }catch{ setMsg("Não foi possível criar a pergunta."); }
  }
  function qualityScoreFor(profile:string){
    const list = qualityAnswers.filter(a=>a.value.date===date && a.value.profile===profile);
    if(!list.length) return null;
    let totalWeight=0, totalScore=0;
    list.forEach(a=>{
      const q = questions.find(x=>x.id===a.value.questionId)?.value;
      const w = q?.weight || 3;
      totalWeight += w; totalScore += (a.value.score||0)*w;
    });
    const score = totalWeight ? Math.round(totalScore/totalWeight*10)/10 : 0;
    return { score, count:list.length, verdict: score>=7.5?"Conforme":score>=5?"Parcial":"Não conforme" };
  }
  async function saveQualityAnswer(q:{id:string;value:QuestionRecord}){
    const d = qualityDraft[q.id]||{};
    let verdict:QualityAnswerRecord["verdict"]="Conforme";
    let score=10;
    const answer = d.answer||"";
    if(q.value.type==="check"||q.value.type==="foto_veredito"||q.value.type==="texto_veredito"){
      verdict = (d.verdict as QualityAnswerRecord["verdict"])||"Conforme";
      score = verdict==="Conforme"?10:verdict==="Parcial"?6:0;
      if(q.value.type==="foto_veredito" && !d.photo){ score=0; verdict="Não conforme"; }
      if(q.value.type==="texto_veredito" && !d.note?.trim()){ score=0; verdict="Não conforme"; }
    }else if(q.value.type==="sim_nao"){
      score = answer==="Sim"?10:answer==="Não"?0:0;
    }else if(q.value.type==="multipla"){
      const correct = q.value.correct||"";
      score = correct && answer===correct ? 10 : 0;
    }else if(q.value.type==="classificacao"){
      const n = Number(answer);
      score = Number.isFinite(n) ? Math.max(0,Math.min(10,n*2)) : 0;
    }else{
      const filled = q.value.type==="photo" ? !!d.photo : q.value.type==="temperature" ? !!d.temperature : !!answer.trim() || !!d.note?.trim();
      score = filled?10:0;
    }
    const keepsVerdict = q.value.type==="check"||q.value.type==="foto_veredito"||q.value.type==="texto_veredito";
    verdict = keepsVerdict ? verdict : score>=7.5?"Conforme":score>=5?"Parcial":"Não conforme";
    let opinion = verdict==="Conforme"?"Dentro do padrão definido.":verdict==="Parcial"?"Atenção: verificar o ponto sinalizado.":"Fora do padrão: corrigir e reavaliar.";
    if(q.value.type==="photo" && d.photo && q.value.referencePhoto){
      const cmp = await comparePhotos(q.value.referencePhoto,d.photo);
      score = cmp.score; verdict = cmp.verdict; opinion = cmp.opinion;
    }
    const value:QualityAnswerRecord = { date, questionId:q.id, question:q.value.question, profile:selected||"", verdict, score, note:d.note||"", answer, opinion, photo:d.photo||"", temperature:d.temperature||"", time:nowTime() };
    try{
      await api("records.create",{collection:"dojo_quality_answers",value});
      setQualityDraft(p=>({...p,[q.id]:{}}));
      await reloadAux();
      setMsg(`Auditoria salva: ${verdict}.`);
    }catch{ setMsg("Não foi possível salvar a auditoria."); }
  }
  async function reviewQuality(row:{id:string;value:QualityAnswerRecord}, ok:boolean){
    const value = {...row.value, reviewedBy:authUser||"", reviewedVerdict: ok?"Conforme":"Não conforme"};
    try{ await api("records.replace",{collection:"dojo_quality_answers",id:row.id,value}); await reloadAux(); setMsg("Auditoria revisada."); }catch{ setMsg("Não foi possível revisar."); }
  }
  async function saveStockItem(){
    if(!isManager){ setMsg("Somente a Gerência cadastra itens de estoque."); return; }
    const item = String(auxForm.stockItem||"").trim();
    if(!item){ setMsg("Informe o item."); return; }
    const value:StockItemRecord = { item, category:String(auxForm.stockCategory||"Geral").trim(), expected:String(auxForm.stockExpected||"").trim(), min:String(auxForm.stockMin||"").trim(), max:String(auxForm.stockMax||"").trim(), unit:String(auxForm.stockUnit||"un").trim(), createdAt:new Date().toISOString() };
    try{ await api("records.create",{collection:"dojo_stock_items",value}); setAuxForm({}); await reloadAux(); setMsg("Item de estoque cadastrado."); }catch{ setMsg("Não foi possível cadastrar o item."); }
  }
  async function saveStockCount(row:{id:string;value:StockItemRecord}, countedRaw:string){
    const counted = parseFloat(countedRaw.replace(",","."));
    const expected = parseFloat(String(row.value.expected||"0").replace(",","."));
    if(!Number.isFinite(counted)){ setMsg("Informe a quantidade contada."); return; }
    const value:StockCountRecord = { date, item:row.value.item, expected:Number.isFinite(expected)?expected:0, counted, difference:counted-(Number.isFinite(expected)?expected:0), profile:authUser||"", time:nowTime() };
    try{ await api("records.create",{collection:"dojo_stock_counts",value}); setAuxForm(p=>({...p,[`count-${row.id}`]:""})); await reloadAux(); setMsg(`Contagem de ${row.value.item} salva.`); }catch{ setMsg("Não foi possível salvar a contagem."); }
  }
  async function saveReceiving(){
    const item = String(auxForm.receivingItem||"").trim();
    if(!item){ setMsg("Informe o item recebido."); return; }
    const expectedQty = String(auxForm.receivingExpected||"").trim();
    const receivedQty = String(auxForm.receivingReceived||"").trim();
    const divergente = expectedQty && receivedQty && parseFloat(expectedQty.replace(",","."))!==parseFloat(receivedQty.replace(",","."));
    const value:ReceivingRecord = { date, supplier:String(auxForm.receivingSupplier||"").trim(), invoice:String(auxForm.receivingInvoice||"").trim(), item, expectedQty, receivedQty, status:divergente?"Divergente":"Conferido", notes:String(auxForm.receivingNotes||"").trim(), profile:authUser||"", time:nowTime() };
    try{ await api("records.create",{collection:"dojo_receivings",value}); setAuxForm({}); await reloadAux(); setMsg(divergente?"Divergência registrada no recebimento.":"Recebimento conferido."); }catch{ setMsg("Não foi possível salvar o recebimento."); }
  }
  async function saveTempLimit(key:"fria"|"freezer"){
    if(!isManager){ setMsg("Somente a Gerência configura limites."); return; }
    const min = parseFloat(String(auxForm[`tempMin-${key}`]||"").replace(",","."));
    const max = parseFloat(String(auxForm[`tempMax-${key}`]||"").replace(",","."));
    if(!Number.isFinite(min)||!Number.isFinite(max)){ setMsg("Informe mínimo e máximo."); return; }
    const existing = tempLimits.find(r=>r.value.key===key);
    const value:TempLimitRecord = { key, min, max };
    try{
      if(existing) await api("records.replace",{collection:"dojo_temp_limits",id:existing.id,value});
      else await api("records.create",{collection:"dojo_temp_limits",value});
      await reloadAux(); setMsg(`Limite de ${key==="fria"?"câmara fria":"freezer"} salvo.`);
    }catch{ setMsg("Não foi possível salvar o limite."); }
  }
  async function togglePhotoRule(itemId:string){
    if(!isManager){ setMsg("Somente a Gerência configura regras."); return; }
    const existing = itemRules.find(r=>r.value.itemId===itemId);
    const value:ItemRuleRecord = { itemId, requirePhoto: !existing?.value.requirePhoto };
    try{
      if(existing) await api("records.replace",{collection:"dojo_item_rules",id:existing.id,value});
      else await api("records.create",{collection:"dojo_item_rules",value});
      await reloadAux();
    }catch{ setMsg("Não foi possível salvar a regra."); }
  }
  function fillHandover(){
    const parts:string[]=[];
    const pend = activeSections.flatMap(sec=>countsForSection(sec).list.filter(i=>entryFor(i.id).status!=="Feito").map(i=>`${i.name} (${sec})`));
    if(pend.length) parts.push(`Pendências: ${pend.slice(0,10).join(", ")}${pend.length>10?"…":""}`);
    const faltas = openShortages.map(s=>`${s.value.itemName}${s.value.profile&&s.value.profile!==selected?` (${s.value.profile})`:""}`);
    if(faltas.length) parts.push(`Faltas em aberto: ${faltas.join(", ")}`);
    const t = temps[`${selected}|${date}`]?.value;
    if(t){
      const f=parseTempValue(t.fria), fr=parseTempValue(t.freezer);
      if((f!==null&&(f<0||f>5))||(fr!==null&&fr>=-12)) parts.push(`Temperatura fora da faixa: câmara ${t.fria||"—"} °C / freezer ${t.freezer||"—"} °C`);
    }
    const atrasadas = tasks.filter(x=>x.value.owner===selected && taskOverdue(x.value)).map(x=>x.value.title);
    if(atrasadas.length) parts.push(`Tarefas atrasadas: ${atrasadas.join(", ")}`);
    const naoFeitos = activeSections.flatMap(sec=>countsForSection(sec).list.filter(i=>entryFor(i.id).status==="Não feito").map(i=>`${i.name}: ${entryFor(i.id).justificativa||"sem justificativa"}`));
    if(naoFeitos.length) parts.push(`Não feitos: ${naoFeitos.slice(0,8).join(" · ")}`);
    setHandoverText(parts.length?parts.join("\n"):"Sem pendências para passar. Tudo concluído até aqui.");
  }
  async function createTask(){
    if(!isManager){ setMsg("Somente a Gerência cria tarefas."); return; }
    const title = String(auxForm.taskTitle||"").trim();
    const owner = String(auxForm.taskOwner||"").trim();
    if(!title || !owner){ setMsg("Preencha tarefa e responsável."); return; }
    const value:TaskRecord = { title, owner, dueDate:String(auxForm.taskDate||date), dueTime:String(auxForm.taskTime||"18:00"), status:"Aberta", notes:String(auxForm.taskNotes||"").trim(), createdAt:new Date().toISOString(), createdBy:authUser||"", days:String(auxForm.taskDays||"").split(",").filter(Boolean).map(Number) };
    try{
      await api("records.create",{collection:"dojo_tasks",value});
      await notifyMessage({profile:owner,sender:"Gerência",text:`📌 Nova tarefa: ${title} — até ${fmtDate(value.dueDate)} ${value.dueTime}.`});
      setAuxForm({}); await reloadAux(); setMsg("Tarefa criada e enviada ao responsável.");
    }catch{ setMsg("Não foi possível criar a tarefa."); }
  }
  async function setTaskStatus(row:{id:string;value:TaskRecord}, status:TaskRecord["status"]){
    const value = {...row.value,status};
    try{ await api("records.replace",{collection:"dojo_tasks",id:row.id,value}); await reloadAux(); setMsg(status==="Concluída"?"Tarefa concluída.":"Tarefa reaberta."); }catch{ setMsg("Não foi possível atualizar a tarefa."); }
  }
  async function saveLogbook(){
    if(!isManager){ setMsg("Somente a Gerência escreve no logbook."); return; }
    const text = String(auxForm.logText||"").trim();
    if(!text){ setMsg("Escreva o registro do turno."); return; }
    const value:LogbookRecord = { date, shift:turno, text, author:authUser||"", time:nowTime() };
    try{ await api("records.create",{collection:"dojo_logbook",value}); setAuxForm(p=>({...p,logText:""})); await reloadAux(); setMsg("Registro salvo no logbook."); }catch{ setMsg("Não foi possível salvar o registro."); }
  }
  async function saveTraining(){
    if(!isManager){ setMsg("Somente a Gerência cadastra treinamentos."); return; }
    const title = String(auxForm.trainingTitle||"").trim();
    const person = String(auxForm.trainingPerson||"").trim();
    if(!title || !person){ setMsg("Preencha treinamento e pessoa."); return; }
    const value:TrainingRecord = { title, person, status:"Pendente", createdAt:new Date().toISOString() };
    try{ await api("records.create",{collection:"dojo_trainings",value}); setAuxForm({}); await reloadAux(); setMsg("Treinamento atribuído."); }catch{ setMsg("Não foi possível atribuir."); }
  }
  async function setTrainingStatus(row:{id:string;value:TrainingRecord}, status:TrainingRecord["status"]){
    const value = {...row.value,status};
    if(status==="Aprovado") value.approvedBy = authUser||"";
    try{ await api("records.replace",{collection:"dojo_trainings",id:row.id,value}); await reloadAux(); setMsg("Treinamento atualizado."); }catch{ setMsg("Não foi possível atualizar."); }
  }
  async function notifyCritical(item:Item){
    if(!selected) return;
    const critical = item.section==="Limpeza" || item.section==="Organização" || item.id.startsWith("temp");
    if(!critical) return;
    const group = groups.find(g=>g.members.includes(selected))?.key || "";
    const text = `⚠️ Item crítico não feito — ${selected} · ${item.name}. Gerência, favor conferir.`;
    try{
      await api("records.create",{collection:"dojo_chat",value:{profile:"Gerência",sender:selected,text,time:nowTime()}});
      if(group) await api("records.create",{collection:"dojo_chat",value:{profile:group,sender:selected,text,time:nowTime()}});
      void notifyMessage({profile:"Gerência",sender:selected,text});
    }catch{}
  }
  async function approveChecklist(text:string){
    if(!isManager){ setMsg("Apenas a Gerência pode aprovar."); return; }
    const p = parseChecklist(text);
    if(!p.person){ setMsg("Não foi possível identificar este checklist."); return; }
    const target = Object.values(submissions).filter(s=>s.value.profile===p.person && s.value.section===p.sectionText && s.value.status==="Aguardando").sort((a,b)=>b.id.localeCompare(a.id))[0];
    if(!target){ setMsg("Checklist não encontrado para conferência."); return; }
    await decideSubmission(target,"Aprovado","");
  }
  async function sendReprove(){
    if(!reproveFor) return;
    const note = reproveNote.trim();
    if(!note){ setMsg("Escreva o que está errado antes de reprovar."); return; }
    const target = Object.values(submissions).filter(s=>s.value.profile===reproveFor.person && s.value.section===reproveFor.sectionText && s.value.status==="Aguardando").sort((a,b)=>b.id.localeCompare(a.id))[0];
    if(!target){ setMsg("Checklist não encontrado para conferência."); return; }
    await decideSubmission(target,"Para corrigir",note);
    setReproveFor(null); setReproveNote("");
  }

  useEffect(()=>{
    if(tab!=="chat" || !conversation) return;
    const t = setTimeout(()=>{ const el = chatScrollRef.current; if(el) el.scrollTop = el.scrollHeight; chatEndRef.current?.scrollIntoView({behavior:"auto",block:"end"}); },60);
    return ()=>clearTimeout(t);
  },[tab,conversation,chat]);
  const historyFiltered = useMemo(()=>{
    const all = Object.values(submissions).filter(s=> isManager || s.value.profile===authUser);
    const q = historySearch.trim().toLowerCase();
    const filtered = q ? all.filter(s=> s.value.profile.toLowerCase().includes(q) || fmtDate(s.value.date).includes(q) || s.value.date.includes(q) || s.value.section.toLowerCase().includes(q)) : all;
    return filtered.sort((a,b)=> b.value.date.localeCompare(a.value.date) || a.value.profile.localeCompare(b.value.profile));
  },[submissions,isManager,authUser,historySearch]);
  const overviewFilteredPeople = overviewPerson==="Todos" ? perPersonProgress : perPersonProgress.filter(p=>p.person===overviewPerson);
  const expiryAlerts = useMemo(()=> Object.values(expiries).map(r=>r.value).filter(v=>{ const diff = daysBetween(date, v.expiryDate); return diff<=3; }).sort((a,b)=> a.expiryDate.localeCompare(b.expiryDate) || a.product.localeCompare(b.product)),[expiries,date]);
  const myExpiries = useMemo(()=> Object.values(expiries).map(r=>r.value).filter(v=>v.profile===selected).sort((a,b)=> a.expiryDate.localeCompare(b.expiryDate)),[expiries,selected]);

  const loginLockedUntil = lockedUntil[activeLoginKey]||0;
  const loginLocked = loginLockedUntil>Date.now();
  const loginLockLeft = loginLocked ? Math.ceil((loginLockedUntil-nowTick)/1000) : 0;
  const dayLabel = date===today() ? "Hoje" : date===addDays(today(),-1) ? "Ontem" : fmtDate(date);
  const nextPending = useMemo(()=>{
    if(!selected || !inUnit(selected)) return [];
    return activeSections.flatMap(sec=>countsForSection(sec).list.map(item=>({item,sec,status:entryFor(item.id).status}))).filter(x=>x.status!=="Feito").slice(0,5);
  },[selected,date,entries,activeSections,unitFilter]);
  const sharedProduction = useMemo(()=>{
    if(!selected) return [] as {person:string;total:number;doneMe:number;doneThem:number;missing:string[]}[];
    const mine = new Set((effectiveByProfile[selected]||[]).filter(i=>String(i.section||"").includes("Produção")).map(i=>i.id));
    return Object.keys(effectiveByProfile)
      .filter(p=>p!==selected && p!=="Gerência" && inUnit(p))
      .map(p=>{
        const shared=(effectiveByProfile[p]||[]).filter(i=>mine.has(i.id) && String(i.section||"").includes("Produção"));
        if(!shared.length) return null;
        const doneMe=shared.filter(i=>entryFor(i.id).status==="Feito").length;
        const doneThem=shared.filter(i=>entries[`${p}|${date}|${i.id}`]?.value.status==="Feito").length;
        const missing=shared.filter(i=>entryFor(i.id).status==="Feito" && entries[`${p}|${date}|${i.id}`]?.value.status!=="Feito").map(i=>i.name);
        return {person:p,total:shared.length,doneMe,doneThem,missing};
      })
      .filter((x):x is {person:string;total:number;doneMe:number;doneThem:number;missing:string[]}=>!!x);
  },[selected,date,entries,unitFilter]);
  function sharedProductionSection(){
    if(!sharedProduction.length) return null;
    return <section className="card p-5 mt-4" aria-label={t("Produção compartilhada")} data-group="conferencia">
      <h3 className="font-extrabold text-[18px]">{t("Produção compartilhada")}</h3>
      <p className="text-[13px] text-[var(--muted)] mt-1">Quem faz os mesmos itens que {selected} — progresso de hoje.</p>
      <ul className="mt-3 space-y-3">{sharedProduction.map(s=><li key={s.person} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
        <p className="font-bold text-[15px]">{s.person} <span className="text-[12px] font-normal text-[var(--muted)]">· {s.total} produções em comum</span></p>
        <p className="text-[13px] text-[var(--muted)] mt-1">Você {s.doneMe}/{s.total} · {s.person} {s.doneThem}/{s.total}</p>
        {s.missing.length>0 && <p className="text-[13px] font-bold text-[var(--warning-text)] mt-1">Falta a {s.person}: {s.missing.slice(0,4).join(" · ")}{s.missing.length>4?"…":""}</p>}
      </li>)}</ul>
    </section>;
  }
  function loginForProfile(p:string){
    const builtin = Object.keys(LOGIN_TO_PROFILE).find(k=>LOGIN_TO_PROFILE[k]===p);
    return builtin || credentials.find(c=>c.value.profile===p)?.value.login || normalizeLogin(p);
  }
  function openStationQr(p:string){
    setStationQrInfo({label:`${p} · ${stationMap[p]||""}`,url:`${appLink}?posto=${encodeURIComponent(loginForProfile(p))}`});
    setStationQrOpen(true);
  }
  async function handleVoice(text:string){
    const q = normalizeLogin(text);
    const match = items.find(i=>{
      const n = normalizeLogin(i.name);
      return q.includes(n) || n.split(" ").some(w=>w.length>=4 && q.includes(w));
    });
    if(!match){ setMsg(`Não encontrei o item falado: ${text}`); return; }
    const deps = pendingDeps(match.id);
    if(deps.length){ setMsg(`Antes de ${match.name}: ${deps.map(d=>d.name).join(", ")}.`); return; }
    const num = text.match(/\b(\d{1,4})\b/)?.[1];
    const cur = entryFor(match.id);
    if(itemRules.find(r=>r.value.itemId===match.id)?.value.requirePhoto && !cur.photo){
      setMsg(`Foto obrigatória em ${match.name} antes de marcar como Feito.`); return;
    }
    if(cur.status===""){ void ensureShiftStarted(); }
    await saveEntry(
      {...cur,profile:selected||"",date,itemId:match.id,status:"Feito",feito:num||cur.feito||"",justificativa:""},
      {silent:true},
    );
    if(cur.status==="Não feito"){ void resolveActionPlanForItem(match.id); }
    setQuickEntryOpen(false); setQuickEntryText("");
    setMsg(`${match.name} marcado como Feito${num?` · ${num} un.`:""}.`);
  }
  function startVoice(){
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!SR){ setMsg("Seu navegador não suporta comando de voz."); return; }
    try{
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev:any)=>{ const text = String(ev.results[0][0].transcript||""); void handleVoice(text); };
      rec.onerror = ()=>{ setListening(false); setMsg("Não entendi. Tente falar o nome do item."); };
      rec.onend = ()=>setListening(false);
      rec.start();
      setListening(true);
      setMsg("Ouvindo… fale o item e a quantidade.");
    }catch{ setListening(false); setMsg("Não foi possível iniciar o microfone."); }
  }
  const weekdayToday = new Date().getDay();
  const taskApplies = (t:TaskRecord) => !t.days?.length || t.days.includes(weekdayToday);
  const pendingSection = activeSections.find(s=>{ const sub2=submissionForSection(s); const locked2=!!sub2 && (sub2.value.status==="Aguardando" || sub2.value.status==="Aprovado"); return !locked2; });
  const pendingSectionCounts = pendingSection ? countsForSection(pendingSection) : null;
  const latestHandover = useMemo(()=>{
    if(!selected) return null;
    const station = stationMap[selected]||"";
    return handovers.filter(h=>h.value.station===station && h.value.profile!==selected && h.value.date<=date).sort((a,b)=> b.value.date.localeCompare(a.value.date) || b.value.time.localeCompare(a.value.time))[0]?.value || null;
  },[handovers,selected,date]);
  const openShortages = useMemo(()=> Object.values(shortages).filter(s=>s.value.date===date && s.value.status==="Aberta").sort((a,b)=>a.value.profile.localeCompare(b.value.profile) || a.value.itemName.localeCompare(b.value.itemName)),[shortages,date]);
  const weeklyDoneCount = WEEKLY_ITEMS.filter(i=>weeklyEntryFor(i.id).status==="Feito").length;
  const weeklyMarkedCount = WEEKLY_ITEMS.filter(i=>weeklyEntryFor(i.id).status!=="").length;
  const weeklySubForWeek = Object.values(weeklySubs).filter(s=>s.value.profile===selected && s.value.weekKey===weekKeyFor(date)).sort((a,b)=>b.id.localeCompare(a.id))[0] || null;

  const themeButton = <button type="button" onClick={()=>setTheme(theme==="light"?"dark":"light")} aria-label={theme==="light"?"Ativar modo escuro":"Ativar modo claro"} className="shrink-0 w-10 h-10 min-w-[44px] min-h-[44px] grid place-items-center rounded-full bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] pressable">{theme==="light"?<Moon size={18}/>:<Sun size={18}/>}</button>;
  const loginContent = (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8">
      <div className="fixed top-3 right-3 z-40 flex gap-2"><button type="button" onClick={()=>setLang(p=>p==="pt"?"en":"pt")} aria-label={t("language")} className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] text-[12px] font-extrabold pressable">{lang.toUpperCase()}</button>{themeButton}</div>
      <div className="flex flex-col items-center text-center">
        <span className="w-16 h-16 grid place-items-center rounded-[20px] bg-[var(--primary)] text-white"><ClipboardCheck size={32}/></span>
        <div className="font-extrabold tracking-tight text-[26px] leading-none mt-4">{t("Dojo Checklist")}</div>
        <div className="text-[13px] text-[var(--muted)] mt-2">{t("Operação · Padrão · Conferência")}</div>
        <p role="status" title={connectionError || undefined} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--muted)]"><span aria-hidden="true" className="w-2 h-2 rounded-full" style={{background: loading ? "var(--warning)" : offlineMode ? "var(--danger)" : "var(--green)"}} />{loading ? "Conectando…" : offlineMode ? `Conexão: erro — ${connectionError || "backend indisponível"}` : "Conectado"}</p>
      </div>
      <div className="w-full max-w-[440px] card p-6 sm:p-7 mt-7">
        <h1 className="font-extrabold text-[24px] leading-tight tracking-tight text-center">{t("welcome")}</h1>
        <p className="text-[14px] text-[var(--muted)] text-center mt-2 leading-relaxed">{t("loginSub")}</p>
        {loginLocked && <p role="alert" className="mt-4 p-3 rounded-xl bg-[var(--danger-bg)] text-[var(--danger-text)] text-sm font-bold text-center">Muitas tentativas. Aguarde {loginLockLeft}s</p>}
        {loginError && !loginLocked && <p role="alert" className="mt-4 p-3 rounded-xl bg-[var(--danger-bg)] text-[var(--danger-text)] text-sm font-bold text-center">{loginError}</p>}
        <form className="mt-5" onSubmit={(ev)=>{ev.preventDefault(); void handleLoginSubmit();}}>
          <label className="block"><span className="text-[13px] font-bold">{t("login")}</span><input autoFocus autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={loginInput} onChange={e=>{setLoginInput(e.target.value); setLoginError("");}} placeholder="Ex.: wesley" className="field mt-2 !h-[56px] !text-[16px]" aria-label="Login"/></label>
          <label className="block mt-4"><span className="text-[13px] font-bold">{t("password")}</span><div className="relative mt-2"><input type={showPassword?"text":"password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={passwordInput} onChange={e=>{setPasswordInput(e.target.value); setLoginError("");}} placeholder="Sua senha" className="field !h-[56px] !text-[16px] !pr-[52px]" aria-label="Senha"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center text-[var(--muted)]" aria-label={showPassword?"Ocultar senha":"Mostrar senha"}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></label>
          <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none"><input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} className="w-5 h-5 accent-[var(--primary)] shrink-0"/><span className="text-[14px] font-semibold">{t("remember")}</span></label>
          <button type="submit" disabled={loginLocked} className="w-full mt-5 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[16px] disabled:opacity-50">{t("enter")}</button>
        </form>
        <a href="/privacidade.html" target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-[12px] font-bold text-[var(--muted)] underline">{t("privacy")}</a>
      </div>
      {msg && <p role="status" className="mt-4 text-[13px] text-[var(--muted)] text-center max-w-[440px]">{msg}</p>}
      {offlineMode && <p className="mt-3 text-[12px] text-[var(--muted)] text-center">{t("Modo offline - histórico local")}</p>}

    </div>
  );

  const isChatDetail = tab==="chat" && !!conversation;
  const navItems = [{id:"checklist" as Tab,label:t("navChecklist"),icon:ClipboardCheck},{id:"chat" as Tab,label:t("navChat"),icon:MessageCircle},{id:"overview" as Tab,label:t("navOverview"),icon:LayoutDashboard},{id:"modules" as Tab,label:t("navModules"),icon:CalendarDays}].filter(t=> isManager ? t.id!=="checklist" : t.id!=="overview");
  const dashNav = [{id:"conferencia" as const,label:t("Conferência"),icon:ClipboardCheck},{id:"equipe" as const,label:t("Equipe"),icon:MessageCircle},{id:"qualidade" as const,label:t("Qualidade"),icon:Sparkles}];

  return <Suspense fallback={<div className="min-h-[100dvh] grid place-items-center text-[13px] font-bold text-[var(--muted)]">Carregando…</div>}><div data-safe-area-inset-root className="app-shell overflow-x-clip" style={{boxSizing:"border-box",paddingTop:"var(--safe-area-inset-top)",minHeight:"100dvh"}}>
    {!authUser ? loginContent : <><aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-[248px] flex-col bg-[var(--surface)] border-r border-[var(--line)] p-4 overflow-y-auto">
        <div className="flex items-center gap-2 px-1 py-1 mb-3"><span className="w-8 h-8 rounded-lg grid place-items-center text-white font-extrabold" style={{background:"#FF6B1A"}}>D</span><span className="font-extrabold text-[15px]">Dojo Checklist</span></div>
        <p className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">Operação</p>
        {navItems.map(n=>{ const active=tab===n.id; return <button key={n.id} onClick={()=>{setTab(n.id); setShowTodayDone(false); if(n.id!=="chat") setConversation(null);}} className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold ${active?"bg-[var(--primary)] text-white":"hover:bg-[var(--line)]"}`}><n.icon size={16}/>{n.label}</button>; })}
        {isManager && <><p className="px-2 mt-4 text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">Gerência</p>
        {dashNav.map(d=>{ const active=tab==="overview"&&dashTab===d.id; return <button key={d.id} onClick={()=>{setTab("overview"); setDashTab(d.id);}} className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold ${active?"bg-[var(--primary)] text-white":"hover:bg-[var(--line)]"}`}><d.icon size={16}/>{d.label}</button>; })}</>}
        {!isManager && <button onClick={()=>{setGuidedOpen(true); setTab("checklist");}} className="mt-4 flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold text-white" style={{background:"#FF6B1A"}}><Sparkles size={16}/>Modo guiado</button>}
        <div className="mt-auto pt-4"><button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold text-[var(--muted)] hover:bg-[var(--line)]">{t("Sair")}</button></div>
      </aside><div className="lg:pl-[248px]">
    {!isChatDetail && <header data-safe-area-sticky-top style={{top:"var(--safe-area-inset-top)"}} className="app-header sticky z-30 border-b border-[var(--line)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
        <span className="hidden sm:grid w-10 h-10 rounded-full place-items-center text-white font-extrabold shrink-0" style={{background:avatarColor(authUser)}}>{initials(authUser)}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-extrabold tracking-tight text-[15px] sm:text-[19px] truncate">{t("hello")}, {authUser}</div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span role="status" title={connectionError || undefined} aria-label={loading ? "Conexão: conectando" : offlineMode ? "Conexão: erro" : "Conexão: conectado"} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)] whitespace-nowrap"><span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{background: loading ? "var(--warning)" : offlineMode ? "var(--danger)" : "var(--green)"}} /><span className="hidden md:inline">{loading ? "Conectando…" : offlineMode ? "Conexão: erro" : "Conectado"}</span></span>
          <button type="button" disabled={pushBusy} onClick={()=>void handleEnablePush()} title="Ativar notificações de mensagens" aria-label={pushOn?"Notificações ativas":"Ativar notificações"} className={`w-10 h-10 min-w-[44px] min-h-[44px] grid place-items-center rounded-full border pressable ${pushOn?"bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]":"bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)]"}`}><Bell size={18}/></button>
          <button type="button" onClick={()=>setLang(p=>p==="pt"?"en":"pt")} aria-label={t("language")} className="w-10 h-10 min-w-[44px] min-h-[44px] grid place-items-center rounded-full bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] text-[12px] font-extrabold pressable">{lang.toUpperCase()}</button>
          <span className="hidden sm:inline-flex">{themeButton}</span>
          <button onClick={handleLogout} aria-label={t("Sair")} className="bg-white text-black font-bold text-[12px] sm:text-[13px] px-3 py-2 rounded-full whitespace-nowrap flex items-center gap-1 pressable"><LogOut size={14}/> <span className="hidden sm:inline">{t("Sair")}</span></button>
        </div>
      </div>
    </header>}

    {authUser && pushInfo && <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-2"><p className="text-[12px] font-bold text-[var(--muted)]">🔔 {pushInfo}</p></div>}
    {(offlineMode || queuedCount>0) && <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-2"><p className="text-[12px] font-bold text-[var(--muted)]">Modo offline · {queuedCount>0 ? `${queuedCount} alteraç${queuedCount===1?"ão":"ões"} aguardando sincronização` : "histórico local"}</p></div>}
    {loading && <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 space-y-3" aria-label="Carregando dados"><div className="skeleton h-24" /><div className="grid grid-cols-2 gap-3"><div className="skeleton h-20" /><div className="skeleton h-20" /></div><div className="skeleton h-32" /></div>}

    {(tab==="overview" && isManager) && <DashboardScreen p={{PhotoField,ALL_ITEMS,CalendarDays,Download,LOGIN_TO_PROFILE,MessageCircle,OVERVIEW_FILTER_PEOPLE,QrCode,SECTIONS,Share2,Sparkles,actionPlans,addDays,aiInsights,applyTemplate,attempts,authUser,auxForm,awaitingList,buildAiInsights,buildConsolidated,cameraQuestion,chat,checklistItems,checklists,completedSectionsToday,complianceColor,complianceToday,connectionError,consolidated,conversation,createTask,credentials,customItems,dashTab,date,daysBetween,decideSubmission,delayedList,devolverPlan,displaySectionTitle,draft,draftAt,effectiveByProfile,entries,expectedSectionsToday,expiries,expiryAlerts,expiryDateInput,expiryProduct,expirySaving,exportPdf,exportReport,fmtDate,formatOverdue,guideOpen,handoverDialogOpen,handoverSaving,handoverText,handovers,historyDate,historyFiltered,historyHas,historyMonth,historySearch,inUnit,instructions,isManager,itemRules,items,justDraft,justOpen,justSaved,justSaving,lang,listening,loading,lockedUntil,logbook,loginError,loginInput,maintNoteDraft,maintOpen,maintenance,missingCollections,moduleConfirmDelete,moduleEditingId,moduleErrors,moduleForm,moduleMsg,moduleSaving,moduleTab,msg,nextPending,nowTick,obsDrafts,occurrenceOpen,occurrenceSending,occurrenceText,offlineMode,onlyMissing,openShortages,openStationQr,overviewFilteredPeople,overviewPerson,parseTempValue,passwordInput,pendingHandoverSection,pendingPlans,pendingPlansCount,people,perfil,period,photoViewer,productItem,pushBusy,pushInfo,pushOn,qualityAnswers,qualityDraft,qualityScoreFor,questions,queuedCount,quickEntryOpen,quickEntryText,rankingOpen,rankingRows,reads,receivings,recording,rememberMe,replacedProfiles,reportFilters,reproveFor,reproveNote,resetStaffForm,resolvePlanDirect,resolveShortage,resolvedPlans,reviewQuality,saveLogbook,saveQuestion,saveStaffRecord,saveStockItem,saveTempLimit,saveTemplate,saveTraining,saving,selected,setActionPlans,setAiInsights,setAttempts,setAuthUser,setAuxForm,setCameraQuestion,setChat,setChecklistItems,setChecklists,setConnectionError,setConsolidated,setConversation,setCredentials,setCustomItems,setDashTab,setDate,setDraft,setDraftAt,setEntries,setExpiries,setExpiryDateInput,setExpiryProduct,setExpirySaving,setGuideOpen,setGuidedOpen,setHandoverDialogOpen,setHandoverSaving,setHandoverText,setHandovers,setHistoryDate,setHistoryMonth,setHistorySearch,setInstructions,setItemRules,setJustDraft,setJustOpen,setJustSaved,setJustSaving,setLang,setListening,setLoading,setLockedUntil,setLogbook,setLoginError,setLoginInput,setMaintNoteDraft,setMaintOpen,setMaintenance,setMissingCollections,setModuleConfirmDelete,setModuleEditingId,setModuleErrors,setModuleForm,setModuleMsg,setModuleSaving,setModuleTab,setMsg,setNowTick,setObsDrafts,setOccurrenceOpen,setOccurrenceSending,setOccurrenceText,setOfflineMode,setOnlyMissing,setOverviewPerson,setPasswordInput,setPendingHandoverSection,setPerfil,setPeriod,setPhotoViewer,setProductItem,setPushBusy,setPushInfo,setPushOn,setQualityAnswers,setQualityDraft,setQuestions,setQueuedCount,setQuickEntryOpen,setQuickEntryText,setRankingOpen,setReads,setReceivings,setRecording,setRememberMe,setReportFilters,setReproveFor,setReproveNote,setSaving,setSelected,setShifts,setShortages,setShowPassword,setShowPrevious,setShowTodayDone,setSignatureOpen,setSignatures,setStaffEditingId,setStaffForm,setStaffMsg,setStaffSaving,setStationQrInfo,setStationQrOpen,setStockCounts,setStockItems,setSubmissions,setTab,setTaskStatus,setTaskTemplates,setTasks,setTempFreezer,setTempFria,setTempLimits,setTempOpen,setTempSaving,setTemplates,setTemps,setTheme,setToast,setTrainingStatus,setTrainings,setTurno,setUnitFilter,setValidityOpen,setWeeklyOpen,setWeeklySaving,setWeeklySubs,setWeeklySummaryOpen,shareConsolidated,shareReport,sharedProductionSection,shiftFor,shiftHistoryMonth,shifts,shortages,showPassword,showPrevious,showTodayDone,signatureOpen,signatures,staffEditingId,staffForm,staffMsg,staffProfiles,staffSaving,startBuiltinStaffEdit,startStaffEdit,stationMap,stationQrInfo,stationQrOpen,stockCounts,stockItems,submissions,t,tab,taskApplies,taskOverdue,taskTemplates,tasks,tempFreezer,tempFria,tempLimitFor,tempLimits,tempOpen,tempSaving,templates,temps,theme,toast,togglePhotoRule,trainings,turno,unitFilter,unitOf,units,validityOpen,weeklyOpen,weeklyRanking,weeklySaving,weeklySubs,weeklySummary,weeklySummaryOpen,whatsappAlert}} />}

    {(tab==="checklist" && !isManager) && <ChecklistScreen p={{CalendarDays,Check,ChevronLeft,MAINT_ITEMS,MODULES_META,Mic,PISTA_GUIDE,PhotoField,QUICK_REASONS,Stepper,Trash2,WEEKLY_ITEMS,X,activeSections,addDays,anyTempOut,applyQuickReason,authUser,auxForm,checklists,completeWeekly,countsForSection,date,dayLabel,daysBetween,deleteModuleRecord,deleteRecordPhoto,displaySectionTitle,draftLabel,entries,entryFor,expiryDateInput,expiryProduct,expirySaving,fmtDate,freezerLim,freezerOut,freqStyle,friaLim,friaOut,goToChatForCurrent,guideOpen,handleJustificationChange,handleMaintNoteChange,handleTempChange,haptic,instructions,isKioskSelected,isManager,itemRules,items,justDraft,justOpen,justSaved,justSaving,latestHandover,maintEntryFor,maintNoteDraft,maintOpen,missingCollections,moduleConfirmDelete,moduleEditingId,moduleErrors,moduleForm,moduleMetaFor,moduleMsg,moduleRowsFor,moduleSaving,moduleTab,myExpiries,occurrenceOpen,occurrenceSending,occurrenceText,onlyMissing,openSignature,pendingDeps,perfil,period,qualityAnswers,qualityDraft,questions,readOnly,receivings,registerExpiry,resetModuleForm,saveFeito,saveModuleRecord,savePhoto,saveQualityAnswer,saveReceiving,saveStockCount,saving,selected,sendOccurrence,setAuxForm,setCameraQuestion,setDate,setExpiryDateInput,setExpiryProduct,setGuideOpen,setMaintOpen,setMaintStatus,setModuleConfirmDelete,setModuleForm,setModuleMsg,setModuleTab,setOccurrenceOpen,setOccurrenceText,setOnlyMissing,setPerfil,setPeriod,setPhotoViewer,setProductItem,setQualityDraft,setQuickEntryOpen,setStatus,setTaskStatus,setTempOpen,setToast,setTrainingStatus,setTurno,setValidityOpen,setWeeklyOpen,setWeeklyStatus,sharedProductionSection,shifts,signatures,startModuleEdit,statusLabel,stockCounts,stockItems,submissionForSection,suggestedFor,t,tab,taskApplies,taskOverdue,tasks,tempFreezer,tempFria,tempOpen,tempSaving,toNonNegativeInt,today,trainings,turno,validityOpen,weeklyDoneCount,weeklyEntryFor,weeklyMarkedCount,weeklyOpen,weeklySaving,weeklySubForWeek}} />}

    {(tab==="chat" && (!conversation || activeConvo)) && <ChatScreen p={{tab,activeConvo,conversation,setConversation,visibleMessageCount,conversations,avatarColor,initials,chatScrollRef,convoMessages,date,fmtDate,authUser,reads,isManager,saving,approveChecklist,parseChecklist,setReproveFor,setReproveNote,reproveFor,reproveNote,sendReprove,recording,draft,setDraft,sendChat,startVoiceNote,stopVoiceNote,chatEndRef,msg,t}} />}



    {showTodayDone && tab==="checklist" && <div className="fixed inset-0 z-50 overflow-y-auto pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/70">
      <div className="min-h-full flex items-center justify-center px-4">
        <div className="w-full max-w-[440px] card p-7 text-center tab-transition">
          <span className="check-pop mx-auto w-16 h-16 rounded-full bg-[var(--success-bg)] grid place-items-center text-[var(--success-text)]"><Check size={32} strokeWidth={3}/></span>
          <h2 className="font-extrabold text-[24px] leading-tight mt-4">{t("✅ Checklist de hoje concluído!")}</h2>
          <p className="text-[14px] text-[var(--muted)] mt-2 leading-relaxed">{activeSections.join(", ")} enviadas para conferência em {fmtDate(date)}.</p>
          {anyTempOut && <p className="mt-3 p-3 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning)] text-[var(--warning-text)] text-sm font-bold">{t("⚠️ Temperatura fora da faixa - avisar Gerência")}</p>}
          <button onClick={goToChatForCurrent} className="w-full mt-5 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[16px]">{t("Ir para o Chat")}</button>
          <button onClick={()=>setShowTodayDone(false)} className="w-full mt-2 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold rounded-2xl py-3.5 text-[14px]">{t("Continuar revisando")}</button>
        </div>
      </div>
    </div>}

    {tab==="checklist" && !isChatDetail && !isManager && <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] inset-x-0 z-30 bg-[var(--bg)]/95 backdrop-blur border-t border-[var(--line)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1 leading-tight"><p className="font-extrabold text-[15px] truncate">{pendingSection ? `${displaySectionTitle(pendingSection)} — ${pendingSectionCounts?.done}/${pendingSectionCounts?.total} feitos` : "Tudo concluído"}</p><p className="text-[12px] text-[var(--muted)]">{pendingSection ? ((pendingSectionCounts?.pending||0)>0 ? `Faltam ${pendingSectionCounts?.pending} itens` : "Pronto para concluir") : "Enviado para conferência"}</p></div>
        {pendingSection ? <button disabled={saving || (pendingSectionCounts?.pending||0)>0} onClick={()=>completeSectionFor(pendingSection)} className="shrink-0 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3.5 text-[15px] disabled:opacity-50 pressable">{t("Concluir")}<span className="hidden sm:inline">{displaySectionTitle(pendingSection)}</span><span className="sm:hidden">seção</span></button> : <button onClick={goToChatForCurrent} className="shrink-0 bg-white text-black font-extrabold rounded-2xl px-5 py-3.5 text-[15px] pressable">{t("Ir para o Chat →")}</button>}
      </div>
    </div>}
    {!isChatDetail && !reproveFor && <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--bg)] border-t border-[var(--line)] h-[calc(72px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]">
      <div className={`max-w-6xl mx-auto px-4 grid h-full ${navItems.length===4?"grid-cols-4":"grid-cols-3"}`}>
        {navItems.map(t=>{
          const Icon=t.icon; const active=tab===t.id;
          return <button key={t.id} onClick={()=>{setTab(t.id); setShowTodayDone(false); if(t.id!=="chat") setConversation(null);}} aria-current={active?"page":undefined} className="relative py-2 flex flex-col items-center justify-center gap-1">
            {active && <span className="absolute top-0 w-12 h-1 rounded-b-full bg-[var(--primary)]"/>}
            <Icon size={22} strokeWidth={active?2.6:2} className={active?"text-[var(--primary)]":"text-[var(--muted)]"}/>
            <span className={`text-[12px] font-bold ${active?"text-[var(--primary)]":"text-[var(--muted)]"}`}>{t.label}</span>
          </button>;
        })}
      </div>
    </nav>}
    {!isChatDetail && <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-[150px] pt-2 text-[12px] text-[var(--muted)] flex flex-wrap gap-3 justify-between"><span>{t("Dojo Checklist · Operação diária")}</span><span>{t("Estação no padrão")}</span></footer>}
    </div></>}
    {handoverDialogOpen && pendingHandoverSection && <div className="fixed inset-0 z-50 overflow-y-auto pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/70" role="dialog" aria-modal="true" aria-label={t("Passagem de turno")}>
      <div className="min-h-full flex items-center justify-center px-4"><div className="w-full max-w-[440px] card p-6">
        <h2 className="font-extrabold text-[22px] leading-tight">{t("Passagem de turno")}</h2>
        <p className="text-[14px] text-[var(--muted)] mt-2 leading-relaxed">{displaySectionTitle(pendingHandoverSection)} está pronta para concluir.</p>
        <label className="block mt-4"><span className="text-[14px] font-bold">{t("Deixar recado para o próximo turno?")}<span className="font-semibold text-[var(--muted)]">(opcional)</span></span><textarea value={handoverText} onChange={e=>setHandoverText(e.target.value)} placeholder="Ex.: Faltou camarão empanado, deixar 20 a mais amanhã" className="field mt-2" rows={3} aria-label={t("Deixar recado para o próximo turno?")} /></label>
        <button type="button" onClick={fillHandover} className="w-full mt-2 bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] font-extrabold text-[13px] py-3 rounded-2xl">{t("Puxar pendências automaticamente")}</button>
        <button disabled={handoverSaving} onClick={()=>confirmHandover(true)} className="w-full mt-4 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[15px] disabled:opacity-50">{handoverSaving ? "Concluindo…" : "Concluir e deixar recado"}</button>
        <button disabled={handoverSaving} onClick={()=>confirmHandover(false)} className="w-full mt-2 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold rounded-2xl py-3.5 text-[14px] disabled:opacity-50">{t("Concluir sem recado")}</button>
        <button disabled={handoverSaving} onClick={()=>{setHandoverDialogOpen(false); setPendingHandoverSection(null); setHandoverText("");}} className="w-full mt-2 text-[13px] font-bold text-[var(--muted)] py-2">{t("Voltar")}</button>
      </div></div>
    </div>}
    <SignatureModal open={signatureOpen} label={selected||""} canvasRef={signatureCanvasRef} onDown={sigDown} onMove={sigMove} onUp={sigUp} onClear={clearSignature} onSave={()=>void saveSignature()} onClose={()=>setSignatureOpen(false)} />
    <PhotoViewerModal viewer={photoViewer} onClose={()=>setPhotoViewer(null)} />
    <VoiceModal open={!!(authUser&&quickEntryOpen)} listening={listening} speechAvailable={typeof window!=="undefined" && !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition} text={quickEntryText} onText={setQuickEntryText} onStart={startVoice} onApply={()=>void handleVoice(quickEntryText.trim())} onClose={()=>{setQuickEntryOpen(false);setListening(false);}} />
    {authUser && productItem && <ProductSheet
      item={productItem}
      photo={checklistItems.find(r=>r.value?.name===productItem.name || r.value?.itemId===productItem.id)?.value?.photo}
      instruction={instructions.find(i=>i.value.itemId===productItem.id)?.value?.text}
      suggestion={suggestedFor(productItem)}
      section={displaySectionTitle(productItem.section)}
      yesterday={(()=>{ const y=addDays(date,-1); const ye=entries[`${selected}|${y}|${productItem.id}`]?.value; return `${ye?.status||"sem registro"}${ye?.feito?` · ${ye.feito} un.`:""}`; })()}
      colleagues={Object.keys(effectiveByProfile).filter(p=>p!==selected && p!=="Gerência" && (effectiveByProfile[p]||[]).some(i=>i.id===productItem.id)).map(p=>({name:p,status:entries[`${p}|${date}|${productItem.id}`]?.value.status||"—"}))}
      saving={saving}
      readOnly={readOnly}
      onStatus={st=>{ void setStatus(productItem,st); setProductItem(null); }}
      onClose={()=>setProductItem(null)}
    />}
    <QrModal open={stationQrOpen} title={t("QR por estação")} label={stationQrInfo.label} description="Imprima ou cole na estação. Ao escanear, o app abre com o login dessa pessoa já preenchido." url={stationQrInfo.url} canvasRef={stationQrCanvasRef} onClose={()=>setStationQrOpen(false)} />
    {cameraQuestion && <CameraGuide reference={questions.find(q=>q.id===cameraQuestion)?.value.referencePhoto} onCapture={data=>setQualityDraft(p=>({...p,[cameraQuestion]:{...p[cameraQuestion],photo:data}}))} onClose={()=>setCameraQuestion(null)} />}
    {authUser && toast && <div className="fixed inset-x-0 z-[70] px-3 pointer-events-none" style={{bottom:"calc(172px + var(--safe-area-inset-bottom))"}}><div className="toast pointer-events-auto max-w-[440px] mx-auto" role="status"><Check size={17} className="shrink-0"/><span className="min-w-0 flex-1">{toast.text}</span>{toast.undo && <button onClick={()=>{toast.undo?.();setToast(null);}} className="shrink-0 font-extrabold underline">{t("Desfazer")}</button>}<button onClick={()=>setToast(null)} aria-label="Fechar aviso" className="shrink-0 opacity-60"><X size={15}/></button></div></div>}
  </div></Suspense>;
}
