import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ClipboardCheck, LayoutDashboard, MessageCircle, LogOut, Eye, EyeOff, ThumbsUp, ThumbsDown, QrCode, Download, Sparkles, Lock, Camera, Images, Trash2, Sun, Moon, X, Users, Bell, Mic, Share2 } from "lucide-react";
import { api, flushQueue, queueSize } from "./api";
import { enablePush, getPushStatus, notifyMessage, pushSupported } from "./push";

type Freq = "DIÁRIO" | "SEMANAL" | "MENSAL";
type Status = "Feito" | "Não feito" | "";
type Section = "Produção" | "Produção do Quiosque" | "Limpeza" | "Organização" | "Montagem da Pista - Fria" | "Montagem da Pista - Quente" | "Reposição da Pista - Fria" | "Reposição da Pista - Quente";
type Item = { id: string; name: string; target: string; freq: Freq; section: Section; detail?: string };
type Entry = { profile: string; date: string; itemId: string; status: Status; feito: string; justificativa: string; updatedBy?: string; updatedAt?: string; perfil?: string; turno?: string; photo?: string };
type ChatMsg = { profile: string; sender: string; text: string; time: string; audio?: string; duration?: number };
type SubmissionItem = { itemId: string; status: Status; feito: string; justificativa: string };
type Submission = { profile: string; date: string; section: Section; period: "DIÁRIO" | "SEMANAL" | "MENSAL"; perfil: string; turno: string; items: SubmissionItem[]; status: "Aguardando" | "Aprovado" | "Para corrigir"; fingerprint: string; correctionNote?: string };
type ActionPlan = { profile: string; date: string; itemId: string; itemName: string; section: string; justificativa: string; deadline: string; status: "Pendente" | "Resolvido" | "Devolvido"; kind: "nao-feito" | "temperatura" | "validade" | "manutencao"; resolvedAt?: string; createdAt?: string };
type Handover = { profile: string; date: string; turno: string; station: string; text: string; time: string };
type Shortage = { profile: string; date: string; itemId: string; itemName: string; section: string; status: "Aberta" | "Resolvida"; createdAt: string };
type WeeklySubmission = { profile: string; weekKey: string; date: string; items: { itemId: string; status: Status }[]; status: "Aguardando" | "Aprovado"; fingerprint: string };
type ExpiryEntry = { profile: string; date: string; product: string; expiryDate: string; registeredAt: string };
type MaintEntry = { profile: string; date: string; itemId: string; status: Status; note: string };
type CredentialRecord = { login: string; profile: string; password: string; station?: string; group?: string; shift?: string; replaces?: string; replacesProfile?: string };
type TempEntry = { profile: string; date: string; fria: string; freezer: string };
type ShiftEntry = { profile: string; date: string; startedAt: string; startedBy: string; finishedAt?: string; finishedBy?: string };
type RecordRow = { id: string; value: any };
type TaskRecord = { title: string; owner: string; dueDate: string; dueTime: string; status: "Aberta" | "Concluída"; notes?: string; createdAt: string; createdBy: string; days?: number[] };
type LogbookRecord = { date: string; shift: string; text: string; author: string; time: string };
type TrainingRecord = { title: string; person: string; status: "Pendente" | "Concluído" | "Aprovado"; score?: string; approvedBy?: string; createdAt: string };
type InstructionRecord = { itemId: string; text: string };
type StockItemRecord = { item: string; category: string; expected: string; min: string; max: string; unit: string; createdAt: string };
type StockCountRecord = { date: string; item: string; expected: number; counted: number; difference: number; profile: string; time: string };
type ReceivingRecord = { date: string; supplier: string; invoice: string; item: string; expectedQty: string; receivedQty: string; status: "Conferido" | "Divergente"; notes: string; profile: string; time: string };
type TempLimitRecord = { key: "fria" | "freezer"; min: number; max: number };
type ItemRuleRecord = { itemId: string; requirePhoto: boolean };
type QuestionRecord = { question: string; section: string; weight: number; minScore: number; type: "check" | "photo" | "text" | "temperature"; hint?: string; referencePhoto?: string; createdAt: string };
type QualityAnswerRecord = { date: string; questionId: string; question: string; profile: string; verdict: "Conforme" | "Parcial" | "Não conforme"; score: number; note: string; photo: string; temperature: string; time: string; reviewedBy?: string; reviewedVerdict?: string };
type Tab = "overview" | "checklist" | "chat" | "modules";
type ChecklistRecord = { profile: string; date: string; title: string; turno?: string; perfil?: string };
type ChecklistItemRecord = { checklistId?: string; itemId?: string; name: string; target?: string; section?: string; freq?: string; photo_url?: string; photo?: string };
type TaskTemplate = { name: string; section: string; target?: string; freq?: string; detail?: string };

const PROFILES = ["Gerência","Wesley","Brianny","Felipe","Jessica","Quitéria","Nathi","Eliane","Michele","Laís","Cleide","Talia","Tayara","Paola","Ricardo"];
const KIOSK_PROFILES = ["Laís","Talia","Cleide","Tayara"];
const KIOSK_NIGHT_PROFILES = ["Cleide","Tayara"];
const STATIONS: Record<string,string> = { Wesley:"Hot Sushi", Brianny:"Hot Sushi", Felipe:"Bloco A · Fria 1", Jessica:"Bloco A · Fria 1", Quitéria:"Bloco B · Fria 2", Nathi:"Bloco B · Fria 2", Eliane:"Cozinha Quente", Michele:"Cozinha Quente", Laís:"Quiosque", Cleide:"Quiosque", Talia:"Quiosque", Tayara:"Quiosque", Paola:"Copa", Ricardo:"Copa", Gerência:"Conferência geral" };
const LOGIN_TO_PROFILE: Record<string,string> = { gerencia:"Gerência", wesley:"Wesley", brianny:"Brianny", felipe:"Felipe", jessica:"Jessica", quiteria:"Quitéria", nathi:"Nathi", eliane:"Eliane", michele:"Michele", lais:"Laís", claide:"Cleide", talia:"Talia", thayara:"Tayara", paola:"Paola", ricardo:"Ricardo" };
const DEFAULT_PASSWORD = "dojo123";
const STAFF_PROFILES = PROFILES.filter(p=>p!=="Gerência");
const GROUP_CHANNELS: { key:string; name:string; desc:string; members:string[] }[] = [
  { key:"grupo:cozinha", name:"Cozinha", desc:"Hot Sushi · Frias · Cozinha Quente", members:["Wesley","Brianny","Felipe","Jessica","Quitéria","Nathi","Eliane","Michele"] },
  { key:"grupo:copa", name:"Copa", desc:"Copa e apoio", members:["Paola","Ricardo"] },
  { key:"grupo:quiosque", name:"Quiosque", desc:"Quiosque · manhã e noite", members:["Laís","Cleide","Talia","Tayara"] },
];
const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const nowLocalString = () => { const d=new Date(); const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fmtDate = (d:string) => { const [y,m,dd]=d.split("-"); return `${dd}/${m}/${y}`; };
const nowTime = () => new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
function normalizeLogin(v:string){ return v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,""); }
async function hashPassword(v:string){
  try{
    const buf = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }catch{ return ""; }
}
function formatOverdue(totalMinutes:number){ if(totalMinutes<=0) return ""; const h=Math.floor(totalMinutes/60); const m=totalMinutes%60; if(h===0) return `${m}min atrasado`; if(m===0) return `${h}h atrasado`; return `${h}h${String(m).padStart(2,"0")} atrasado`; }
function addDays(dateStr:string, delta:number){ const [y,m,d]=dateStr.split("-").map(Number); const dt=new Date(y,m-1,d+delta); const yy=dt.getFullYear(); const mm=String(dt.getMonth()+1).padStart(2,"0"); const dd=String(dt.getDate()).padStart(2,"0"); return `${yy}-${mm}-${dd}`; }
function daysBetween(fromDate:string, toDate:string){ const a=new Date(fromDate+"T12:00:00"); const b=new Date(toDate+"T12:00:00"); return Math.round((b.getTime()-a.getTime())/86400000); }
function parseTempValue(v:string): number | null { if(!v.trim()) return null; const n=parseFloat(v.replace(",",".")); return Number.isFinite(n)?n:null; }
function prod(id:string,name:string,target:string,freq:Freq,detail?:string):Item{return{id,name,target,freq,section:"Produção",detail}}
function other(id:string,name:string,target:string,freq:Freq,section:Section,detail?:string):Item{return{id,name,target,freq,section,detail}}
const limpeza:Item[]=[
 other("limp-1","Higienizar bancadas, tábuas e utensílios","Conforme rotina","DIÁRIO","Limpeza","Antes, durante e após a produção."),
 other("limp-2","Lixo no cais","Sacos fechados","DIÁRIO","Limpeza","Nada acumulado na estação."),
 other("limp-3","Higienizar piso e ralos","Ao fim do turno","DIÁRIO","Limpeza"),
 other("limp-4","Limpeza profunda de equipamentos","Checklist semanal","SEMANAL","Limpeza"),
 other("limp-5","Revisar lixeiras e troca de sacos","Sem resíduos","DIÁRIO","Limpeza"),
 other("limp-6","Higienizar geladeiras e câmaras","1x por semana","SEMANAL","Limpeza"),
];
const organizacao:Item[]=[
 other("org-1","Etiquetagem completa e legível","100%","DIÁRIO","Organização","Nome, data e validade."),
 other("org-2","Cada item no lugar do padrão","Conforme padrão","DIÁRIO","Organização","Sem improviso na estação."),
 other("org-3","Nada em caixa ou pacote aberto","Zero caixas","DIÁRIO","Organização","Transferir para GN/pote identificado."),
 other("org-4","Conferência da gerência","Assinada","DIÁRIO","Organização","Aguardar validação antes de encerrar."),
 other("org-5","Reposição e organização do estoque seco","FIFO aplicado","SEMANAL","Organização"),
 other("org-6","Revisão mensal de utensílios e padrões","Registro feito","MENSAL","Organização"),
];
const hot:Item[]=[
 prod("hot-1","Ebi Hot","30–60 un.","DIÁRIO"), prod("hot-2","Haru Hot","5–8 un.","DIÁRIO"), prod("hot-3","Hot Roll","30–50 un.","DIÁRIO"), prod("hot-4","Hot Couve","12–20 un.","DIÁRIO"), prod("hot-5","Hot Haddock","15–25 un.","DIÁRIO"), prod("hot-6","Hot Philadelphia","30–60 un.","DIÁRIO"), prod("hot-7","Monte Fuji","8–12 un.","DIÁRIO"), prod("hot-8","Romeu e Julieta","10–15 un.","DIÁRIO"), prod("hot-9","Salmão Nipô","20–50 un.","DIÁRIO"), prod("hot-10","Saumatro","10–15 un.","DIÁRIO"), prod("hot-11","Tuna Roll","10–15 un.","DIÁRIO"), prod("hot-12","Hot Skin","20–40 un.","DIÁRIO"), prod("hot-13","Gunkan Salmão Grelhado","10–20 un.","DIÁRIO"), prod("hot-14","Ebi Haru","10–20 un.","DIÁRIO"),
 prod("hot-ap-1","Apoio · Camarão premium","60 un.","DIÁRIO"), prod("hot-ap-2","Apoio · Crocante harumaki","1 caixa","DIÁRIO"), prod("hot-ap-3","Apoio · Japa pizza","1 pote","DIÁRIO"), prod("hot-ap-4","Apoio · Cozinhar camarão","Conforme demanda","DIÁRIO"), prod("hot-ap-5","Apoio · Aparas","1 GN","DIÁRIO"), prod("hot-ap-6","Apoio · Shitake","1 pote","DIÁRIO"), prod("hot-ap-7","Apoio · Shimeji","1 pote","DIÁRIO"), prod("hot-ap-8","Apoio · Molho gyoza","1 pote","DIÁRIO"), prod("hot-ap-9","Apoio · Molho pesto","1 pote","DIÁRIO"), prod("hot-ap-10","Apoio · Maionese spicy","1 pote","DIÁRIO"), prod("hot-ap-11","Apoio · Macarrão yakisoba","3 pacotes","DIÁRIO"), prod("hot-ap-12","Apoio · Legumes yakisoba","1 GN","DIÁRIO"), prod("hot-ap-13","Apoio · Porcionamento macarrão","3 pacotes","DIÁRIO"),
 prod("hot-rot-1","Rotina Hot · Mise en place completa","Estação pronta","DIÁRIO","Fritura, montagem e reposição revisadas."), prod("hot-rot-2","Rotina Hot · Temperatura e ponto","Conferido","DIÁRIO","Registrar qualquer variação."), prod("hot-rot-3","Rotina Hot · Reposição contínua","Sem falta","DIÁRIO"),
];
const blocoA:Item[]=[
  prod("a-1","Califórnia","2 / 4","DIÁRIO"), prod("a-2","Jatopéia","20 / 40","DIÁRIO"), prod("a-3","Maki Fish","12 / 20","DIÁRIO"), prod("a-4","Philadelphia","30 / 60","DIÁRIO"), prod("a-5","Salmão Maki","2 / 4","DIÁRIO"), prod("a-6","Salmão Skin","15 / 25","DIÁRIO"), prod("a-7","Uramaki Philadelphia","4 / 8","DIÁRIO"),
  prod("a-8","Pescado / Cortes · Salmão limpo","5 inteiros / dia","DIÁRIO"), prod("a-9","Pescado / Cortes · Camarão descascado","2 kg / dia","DIÁRIO"), prod("a-10","Pescado / Cortes · Haddock","2 GN quando chegar","DIÁRIO"), prod("a-11","Pescado / Cortes · Sashimi Ice","1 GN / dia","DIÁRIO"), prod("a-12","Pescado / Cortes · Atum limpo","1 peça / dia","DIÁRIO"), prod("a-13","Pescado / Cortes · Tilápia","1 GN conforme necessidade","DIÁRIO"), prod("a-14","Pescado / Cortes · Aparas p/ cozinha quente","1 GN / dia","DIÁRIO"),
  prod("a-15","Preparo · Limpeza / preparo de pescado","2 / 4 peixes","DIÁRIO"), prod("a-16","Preparo · Nigiri finalizado","30 un","DIÁRIO"), prod("a-17","Preparo · Nigiri de camarão — preparo","6 kg","DIÁRIO"),
];
const blocoB:Item[]=[
 prod("b-1","Ebi Furay","30–50 un.","DIÁRIO"), prod("b-2","Light Roll","2–4 un.","DIÁRIO"), prod("b-3","Ebi Cheese","10–15 un.","DIÁRIO"), prod("b-4","Spicy Roll","30–50 un.","DIÁRIO"), prod("b-5","Spice Roll","15–25 un.","DIÁRIO"), prod("b-6","Kani Cheese","8–15 un.","DIÁRIO"), prod("b-7","Ebi Crush","Conforme demanda","DIÁRIO"),
 prod("b-8","Bateras prontas","Padrão do dia","DIÁRIO"), prod("b-9","Gunkan montado","Conforme demanda","DIÁRIO"), prod("b-10","Cones preparados","Conforme demanda","DIÁRIO"), prod("b-11","Bases e recheios","Etiquetados","DIÁRIO","Bases firmes e recheios na temperatura correta."), prod("b-12","Reposição de insumos frios","Sem falta","DIÁRIO"),
];
const quente:Item[]=[
 prod("q-1","Camarão quente","Conforme demanda","DIÁRIO"), prod("q-2","Salmão quente","Conforme demanda","DIÁRIO"), prod("q-3","Frango","Conforme demanda","DIÁRIO"), prod("q-4","Alho-poró","Conforme demanda","DIÁRIO"), prod("q-5","Yakisoba","Conforme demanda","DIÁRIO"), prod("q-6","Pipoca fish","Conforme demanda","DIÁRIO"), prod("q-7","Molhos da cozinha quente","Padrões do dia","DIÁRIO"),
 prod("q-8","Semanal · Gergelim","Estoque conferido","SEMANAL"), prod("q-9","Semanal · Amêndoas","Estoque conferido","SEMANAL"), prod("q-10","Semanal · Brigadeiro","Produção semanal","SEMANAL"), prod("q-11","Semanal · Taco","30 un.","SEMANAL"), prod("q-12","Semanal · Gyoza filé","60 un.","SEMANAL"), prod("q-13","Semanal · Ponzu","5 L","SEMANAL"), prod("q-14","Semanal · Molho Chef","5 L","SEMANAL"), prod("q-15","Semanal · Teriyaki","Produção semanal","SEMANAL"), prod("q-16","Semanal · Chari","Produção semanal","SEMANAL"), prod("q-17","Semanal · Crispys","Produção semanal","SEMANAL"), prod("q-18","Semanal · Tonkatsu","Produção semanal","SEMANAL"),
 other("kn-o1","Vitrine organizada","Conferido","DIÁRIO","Organização"), other("kn-o2","Itens no lugar da foto de referência","Conferido","DIÁRIO","Organização"), other("kn-o3","Estoque conferido","Conferido","DIÁRIO","Organização"), other("kn-o4","Fechamento do quiosque conferido (22h, 23h sex/sáb)","Conferido","DIÁRIO","Organização"), other("kn-o5","Tudo desligado e trancado","Conferido","DIÁRIO","Organização"),
];
// Visão da Gerência: união dos dois turnos do quiosque. Quem é do quiosque vê só o seu turno.
const kioskManhaNovo:Item[]=[
 other("km-f1","Montar parte de cima - Fria: Salmão Poró","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f2","Montar parte de cima - Fria: Makimagu","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f3","Montar parte de cima - Fria: Spice Roll","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f4","Montar parte de cima - Fria: Kani Cheese","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f5","Montar parte de baixo frente - Fria: Dual Fish","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f6","Montar parte de baixo frente - Fria: Ebi Crush","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f7","Montar parte de baixo frente - Fria: Jatopeia","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f8","Montar parte de baixo trás - Fria: Maki Fish","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f9","Montar parte de baixo trás - Fria: Uramaki Philadelphia","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-f10","Montar parte de baixo trás - Fria: Philadelphia","—","DIÁRIO","Montagem da Pista - Fria"),
 other("km-q1","Montar parte da frente - Quente: Hot Haddock","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q2","Montar parte da frente - Quente: Hot Couve","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q3","Montar parte da frente - Quente: Saumatro","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q4","Montar parte da frente - Quente: Hot Salmão Crush","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q5","Montar parte da frente - Quente: Hot Atum Crush","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q6","Montar parte da frente - Quente: Hot Camarão Crush","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q7","Montar parte de trás - Quente: Hot Maguru","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q8","Montar parte de trás - Quente: Kani Crocante","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q9","Montar parte de trás - Quente: Nipo","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q10","Montar parte de trás - Quente: Hot Philadelphia","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q11","Montar parte de trás - Quente: Romeu","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-q12","Montar parte de trás - Quente: Churros Doce de Leite","—","DIÁRIO","Montagem da Pista - Quente"),
 other("km-l1","Bancada limpa e higienizada","Conferido","DIÁRIO","Limpeza"),
 other("km-l2","Chão lavado","Conferido","DIÁRIO","Limpeza"),
 other("km-l3","Lixo retirado - sem caixa no chão","Conferido","DIÁRIO","Limpeza"),
 other("km-l4","Vitrine limpa","Conferido","DIÁRIO","Limpeza"),
 other("km-l5","Utensílios lavados e organizados","Conferido","DIÁRIO","Limpeza"),
 other("km-o1","Pista montada igual foto de referência - fria em cima, quente embaixo","Conferido","DIÁRIO","Organização","Frente / trás no lugar certo."),
 other("km-o2","Abertura do quiosque conferida (9h)","Conferido","DIÁRIO","Organização"),
];
const kioskNoiteNovo:Item[]=[
 other("kn-f1","Repor parte de cima: Salmão Poró, Makimagu, Spice Roll, Kani Cheese","—","DIÁRIO","Reposição da Pista - Fria"),
 other("kn-f2","Repor parte de baixo frente: Dual Fish, Ebi Crush, Jatopeia","—","DIÁRIO","Reposição da Pista - Fria"),
 other("kn-f3","Repor parte de baixo trás: Maki Fish, Uramaki Philadelphia, Philadelphia","—","DIÁRIO","Reposição da Pista - Fria"),
 other("kn-q1","Repor parte da frente: Hot Haddock, Hot Couve, Saumatro, Hot Salmão Crush, Hot Atum Crush, Hot Camarão Crush","—","DIÁRIO","Reposição da Pista - Quente"),
 other("kn-q2","Repor parte de trás: Hot Maguru, Kani Crocante, Nipo, Hot Philadelphia, Romeu, Churros Doce de Leite","—","DIÁRIO","Reposição da Pista - Quente"),
 other("kn-l1","Bancada limpa","Conferido","DIÁRIO","Limpeza"),
 other("kn-l2","Chão lavado","Conferido","DIÁRIO","Limpeza"),
 other("kn-l3","Lixo retirado","Conferido","DIÁRIO","Limpeza"),
 other("kn-l4","Vitrine limpa","Conferido","DIÁRIO","Limpeza"),
 other("kn-l5","Fritadeira limpa e desligada","Conferido","DIÁRIO","Limpeza"),
 other("kn-l6","Utensílios lavados","Conferido","DIÁRIO","Limpeza"),
 other("kn-o1","Pista igual foto de referência","Conferido","DIÁRIO","Organização"),
 other("kn-o2","Fechamento do quiosque conferido (22h, 23h sex/sáb)","Conferido","DIÁRIO","Organização"),
 other("kn-o3","Tudo desligado e trancado","Conferido","DIÁRIO","Organização"),
];
const kioskProdLais:Item[]=[
 other("kp-lais-1","Camarão empanado","150 un/dia","DIÁRIO","Produção do Quiosque"),
 other("kp-lais-2","Harumaki alho-poró","Mín. 2 caixas","DIÁRIO","Produção do Quiosque"),
 other("kp-lais-3","Mini harumaki alho-poró","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
 other("kp-lais-4","Harumaki salmão","Mín. 2 caixas","DIÁRIO","Produção do Quiosque"),
 other("kp-lais-5","Mini harumaki salmão","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
 other("kp-lais-6","Fishball","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
];
const kioskProdCleide:Item[]=[
 other("kp-cleide-1","Camarão empanado","150 un/dia","DIÁRIO","Produção do Quiosque","Preparo / empanamento"),
 other("kp-cleide-2","Harumaki doce de leite","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
 other("kp-cleide-3","Mini harumaki doce de leite","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
 other("kp-cleide-4","Harumaki frango","Mín. 2 caixas","DIÁRIO","Produção do Quiosque"),
 other("kp-cleide-5","Mini harumaki frango","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
];
const kioskProdTalia:Item[]=[
 other("kp-talia-1","Harumaki camarão","Mín. 2 caixas","DIÁRIO","Produção do Quiosque"),
 other("kp-talia-2","Gyoza salmão","Mín. 2 caixas","DIÁRIO","Produção do Quiosque"),
 other("kp-talia-3","Gyoza frango","Mín. 2 caixas","DIÁRIO","Produção do Quiosque"),
 other("kp-talia-4","Gyoza alho-poró","Mín. 2 caixas","DIÁRIO","Produção do Quiosque"),
 other("kp-talia-5","Camarão especial","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
];
const kioskProdTayara:Item[]=[
 other("kp-tayara-1","Harumaki churros","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
 other("kp-tayara-2","Harumaki Nutella","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
 other("kp-tayara-3","Harumaki brigadeiro","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
 other("kp-tayara-4","Coxinha","Mín. 1 caixa","DIÁRIO","Produção do Quiosque"),
];
const quiosque:Item[]=[...kioskManhaNovo,...kioskNoiteNovo];
const PISTA_GUIDE: {label:string; items:string}[] = [
  {label:"FRIA CIMA", items:"Salmão Poró | Makimagu | Spice Roll | Kani Cheese"},
  {label:"FRIA BAIXO FRENTE", items:"Dual Fish | Ebi Crush | Jatopeia"},
  {label:"FRIA BAIXO TRÁS", items:"Maki Fish | Uramaki Philadelphia | Philadelphia"},
  {label:"QUENTE FRENTE", items:"Hot Haddock | Hot Couve | Saumatro | Hot Salmão Crush | Hot Atum Crush | Hot Camarão Crush"},
  {label:"QUENTE TRÁS", items:"Hot Maguru | Kani Crocante | Nipo | Hot Philadelphia | Romeu | Churros"},
];
const copa:Item[]=[
 prod("c-1","Sunomono","Conforme demanda","DIÁRIO"), prod("c-2","Ceviche","Conforme demanda","DIÁRIO"), prod("c-3","Minis harumakis","Conforme demanda","DIÁRIO"), prod("c-4","Montagem de copa","Padrão do dia","DIÁRIO"), prod("c-5","Reposição de guarnições","Sem falta","DIÁRIO"),
];
const byProfile:Record<string,Item[]> = {};
["Wesley","Brianny"].forEach(p=>byProfile[p]=[...hot,...limpeza,...organizacao]);
["Felipe","Jessica"].forEach(p=>byProfile[p]=[...blocoA,...limpeza,...organizacao]);
["Quitéria","Nathi"].forEach(p=>byProfile[p]=[...blocoB,...limpeza,...organizacao]);
["Eliane","Michele"].forEach(p=>byProfile[p]=[...quente,...limpeza,...organizacao]);
byProfile["Laís"]=[...kioskProdLais,...kioskManhaNovo];
byProfile["Talia"]=[...kioskProdTalia,...kioskManhaNovo];
byProfile["Cleide"]=[...kioskProdCleide,...kioskNoiteNovo];
byProfile["Tayara"]=[...kioskProdTayara,...kioskNoiteNovo];
["Paola","Ricardo"].forEach(p=>byProfile[p]=[...copa,...limpeza,...organizacao]);
byProfile["Gerência"]=[...hot,...blocoA,...blocoB,...quente,...quiosque,...copa,...limpeza,...organizacao].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i);
const ALL_ITEMS:Item[] = [...hot,...blocoA,...blocoB,...quente,...quiosque,...copa,...limpeza,...organizacao].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i);
// Itens que precisam ser feitos antes de outros (ordem do processo).
const ITEM_DEPENDENCIES: Record<string,string[]> = {
  "a-5": ["a-8"],   // Salmão Maki depende do Salmão limpo
  "a-16": ["a-15"], // Nigiri finalizado depende da limpeza/preparo do pescado
  "a-17": ["a-9"],  // Nigiri de camarão depende do camarão descascado
};
const SECTIONS: Section[] = ["Produção","Limpeza","Organização"];
const WEEKLY_ITEMS: { id: string; group: string; name: string }[] = [
  { id: "sem-coz-1", group: "Cozinha", name: "Limpar câmara fria por dentro" },
  { id: "sem-coz-2", group: "Cozinha", name: "Limpar exaustor / coifa" },
  { id: "sem-coz-3", group: "Cozinha", name: "Limpar freezer por dentro" },
  { id: "sem-coz-4", group: "Cozinha", name: "Organizar estoque seco" },
  { id: "sem-coz-5", group: "Cozinha", name: "Limpar atrás dos equipamentos" },
  { id: "sem-quio-1", group: "Quiosque", name: "Limpar vitrine da pista por dentro" },
  { id: "sem-quio-2", group: "Quiosque", name: "Limpar gavetas da pista" },
  { id: "sem-quio-3", group: "Quiosque", name: "Organizar estoque do quiosque" },
  { id: "sem-quio-4", group: "Quiosque", name: "Limpar placa / vidro da pista" },
  { id: "sem-copa-1", group: "Copa", name: "Limpar geladeira da copa" },
  { id: "sem-copa-2", group: "Copa", name: "Organizar armário da copa" },
  { id: "sem-copa-3", group: "Copa", name: "Limpar micro-ondas / pia" },
];
const OVERVIEW_FILTER_PEOPLE = ["Todos","Laís","Talia","Cleide","Tayara","Wesley","Brianny","Felipe","Jessica","Quitéria","Nathi","Eliane","Michele"];
const MAINT_ITEMS: { id: string; name: string; equipment: string }[] = [
  { id: "maint-1", name: "Fritadeira está aquecendo normal", equipment: "Fritadeira" },
  { id: "maint-2", name: "Câmara fria está gelando normal", equipment: "Câmara fria" },
  { id: "maint-3", name: "Freezer está gelando normal", equipment: "Freezer" },
  { id: "maint-4", name: "Exaustor está funcionando", equipment: "Exaustor" },
  { id: "maint-5", name: "Fogão / forno está funcionando", equipment: "Fogão / forno" },
];
function weekKeyFor(dateStr: string): string { const d = new Date(dateStr + "T12:00:00"); const day = d.getDay(); const delta = (7 - day) % 7; return addDays(dateStr, delta); }
const KIOSK_MORNING_SECTIONS: Section[] = ["Montagem da Pista - Fria","Montagem da Pista - Quente","Limpeza","Organização"];
const KIOSK_NIGHT_SECTIONS: Section[] = ["Reposição da Pista - Fria","Reposição da Pista - Quente","Limpeza","Organização"];
function sectionsForProfile(p:string): Section[] {
  if(p==="Laís" || p==="Talia") return ["Produção do Quiosque", ...KIOSK_MORNING_SECTIONS];
  if(p==="Cleide" || p==="Tayara") return ["Produção do Quiosque", ...KIOSK_NIGHT_SECTIONS];
  if(p==="Gerência") return ["Produção","Montagem da Pista - Fria","Montagem da Pista - Quente","Reposição da Pista - Fria","Reposição da Pista - Quente","Limpeza","Organização"];
  return SECTIONS;
}

function complianceColor(pct:number){ if(pct>=90) return "var(--green)"; if(pct>=70) return "var(--warning)"; return "var(--danger)"; }
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
  const [qualityDraft,setQualityDraft]=useState<Record<string,{verdict?:string;note?:string;photo?:string;temperature?:string}>>({});
  const [historyDate,setHistoryDate]=useState(today());
  const [historyMonth,setHistoryMonth]=useState(today().slice(0,7));
  const [consolidated,setConsolidated]=useState<{destaques:string[];inconsistencias:string[];riscos:string[];oportunidades:string[]}|null>(null);
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
  const [qrOpen,setQrOpen]=useState(false);
  const [stationQrOpen,setStationQrOpen]=useState(false);
  const [stationQrInfo,setStationQrInfo]=useState<{label:string;url:string}>({label:"",url:""});
  const [productItem,setProductItem]=useState<Item|null>(null);
  const [listening,setListening]=useState(false);
  const [quickEntryOpen,setQuickEntryOpen]=useState(false);
  const [quickEntryText,setQuickEntryText]=useState("");
  const qrCanvasRef=useRef<HTMLCanvasElement|null>(null);
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
  const [pushOn,setPushOn]=useState(false);
  const [pushBusy,setPushBusy]=useState(false);
  const [pushInfo,setPushInfo]=useState("");
  useEffect(()=>{ try{ document.documentElement.dataset.theme=theme; localStorage.setItem("dojo-theme",theme); }catch{} },[theme]);
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
  const [reproveFor,setReproveFor]=useState<{text:string; person:string; sectionText:string}|null>(null);
  const [obsDrafts,setObsDrafts]=useState<Record<string,string>>({});
  const [reproveNote,setReproveNote]=useState("");
  const isManager = authUser==="Gerência";
  const replacedProfiles = useMemo(()=> new Set(credentials.filter(c=>c.value.replacesProfile).map(c=>c.value.replacesProfile!)),[credentials]);
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
  useEffect(()=>{ reloadRecords().then(()=>{ setOfflineMode(false); }).catch(()=>{ setOfflineMode(true); }).finally(()=>setLoading(false)); },[]);
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
      const [t,l,tr,ii,rd,si,sc,rc,tl,ir,qu,qa] = await Promise.all([
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
    const cred = credentials.find(c=>normalizeLogin(c.value.login)===loginKey);
    const stored = String(cred?.value.password||"").trim();
    let ok = false;
    if(/^[a-f0-9]{64}$/.test(stored)) ok = (await hashPassword(enteredPassword))===stored;
    else ok = enteredPassword===stored.toLowerCase() || (!stored && enteredPassword===DEFAULT_PASSWORD.trim().toLowerCase());
    if(!ok){
      const next = (attempts[loginKey]||0)+1;
      setAttempts(prev=>({...prev,[loginKey]:next}));
      if(next>=3){
        const u = Date.now()+30000;
        setLockedUntil(prev=>({...prev,[loginKey]:u}));
        setLoginError("Muitas tentativas. Aguarde 30s");
      } else {
        setLoginError("Login ou senha incorretos");
      }
      return;
    }
    setLoginError("");
    setAttempts(prev=>({...prev,[loginKey]:0}));
    enterApp(profile);
    setMsg(`Olá, ${profile}!`);
  }

  const items = selected?byProfile[selected]||[]:[];
  const isKioskSelected = selected ? KIOSK_PROFILES.includes(selected) : false;
  const activeSections: Section[] = selected ? sectionsForProfile(selected) : SECTIONS;
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
    const list = byProfile[person]||[];
    let feitos=0, faltam=0;
    list.forEach(it=>{
      const s = entries[`${person}|${dateStr}|${it.id}`]?.value.status || "";
      if(s==="Feito") feitos++;
      else faltam++;
    });
    return { person, station: stationMap[person]||"", total:list.length, feitos, faltam };
  }
  const awaitingList = useMemo(()=> Object.values(submissions).filter(s=>s.value.date===date && s.value.status==="Aguardando" && (isManager || s.value.profile===authUser)).sort((a,b)=>a.value.profile.localeCompare(b.value.profile)),[submissions,date,isManager,authUser]);
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

  useEffect(()=>{ if(!qrOpen) return; const t=setTimeout(()=>{ if(qrCanvasRef.current) drawQrCode(qrCanvasRef.current,appLink); },60); return ()=>clearTimeout(t); },[qrOpen,appLink]);
  useEffect(()=>{ if(!stationQrOpen) return; const t=setTimeout(()=>{ if(stationQrCanvasRef.current) drawQrCode(stationQrCanvasRef.current,stationQrInfo.url); },60); return ()=>clearTimeout(t); },[stationQrOpen,stationQrInfo.url]);

  function buildAiInsights(){
    const out:string[]=[];
    const yesterday=addDays(date,-1), dayBefore=addDays(date,-2);
    people.forEach(p=>{
      const list=(byProfile[p]||[]);
      const nao=list.filter(it=>entries[`${p}|${date}|${it.id}`]?.value.status==="Não feito");
      if(nao.length){
        const secs=Array.from(new Set(nao.map(i=>i.section))).join(", ");
        out.push(`${p} tem ${nao.length} Não feito em ${secs} — verificar insumo`);
      }
      nao.forEach(it=>{
        if(entries[`${p}|${yesterday}|${it.id}`]?.value.status==="Não feito") out.push(`${p} repete Não feito há 2 dias: ${it.name} — verificar causa`);
      });
      const pct3=[date,yesterday,dayBefore].map(d=>{ const l=(byProfile[p]||[]); const f=l.filter(it=>entries[`${p}|${d}|${it.id}`]?.value.status==="Feito").length; return l.length?Math.round(f/l.length*100):-1; });
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
      const nao=(byProfile[p.person]||[]).filter(it=>entries[`${p.person}|${date}|${it.id}`]?.value.status==="Não feito");
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
    const perfect = staffProfiles.filter(p=>lastDays.every(d=>{ const list=byProfile[p]||[]; if(!list.length) return false; const f=list.filter(i=>entries[`${p}|${d}|${i.id}`]?.value.status==="Feito").length; return f===list.length; }));
    if(perfect.length) out.destaques.push(`${perfect.join(", ")} com 100% nos últimos 7 dias.`);
    const failCount = new Map<string,number>();
    lastDays.forEach(d=>Object.values(entries).forEach(r=>{ if(r.value.date===d && r.value.status==="Não feito") failCount.set(r.value.itemId,(failCount.get(r.value.itemId)||0)+1); }));
    Array.from(failCount.entries()).filter(([,n])=>n>=2).slice(0,5).forEach(([id,n])=>{ const name=ALL_ITEMS.find(i=>i.id===id)?.name||id; out.inconsistencias.push(`${name} marcado como Não feito ${n}x em 7 dias.`); });
    const tempRows = Object.values(temps).filter(r=>r.value.date===date);
    tempRows.forEach(r=>{ const f=parseTempValue(r.value.fria), g=parseTempValue(r.value.freezer); if((f!==null&&(f<friaLim.min||f>friaLim.max))||(g!==null&&(g<freezerLim.min||g>freezerLim.max))) out.riscos.push(`Temperatura fora da faixa registrada por ${r.value.profile}: câmara ${r.value.fria||"—"} °C / freezer ${r.value.freezer||"—"} °C.`); });
    if(expiryAlerts.length) out.riscos.push(`${expiryAlerts.length} produto(s) vencido(s) ou vencendo em até 3 dias.`);
    if(pendingPlans.length>=3) out.riscos.push(`${pendingPlans.length} planos de ação pendentes.`);
    const planCount = new Map<string,number>();
    Object.values(actionPlans).forEach(r=>planCount.set(r.value.itemName,(planCount.get(r.value.itemName)||0)+1));
    Array.from(planCount.entries()).filter(([,n])=>n>=2).slice(0,4).forEach(([name,n])=>out.oportunidades.push(`Plano de ação recorrente: ${name} (${n}x) — revisar processo.`));
    if(openShortages.length>=2) out.oportunidades.push(`${openShortages.length} faltas em aberto hoje — revisar reposição.`);
    if(!out.destaques.length && !out.inconsistencias.length && !out.riscos.length && !out.oportunidades.length) out.destaques.push("Sem alertas nos últimos 7 dias — operação dentro do padrão.");
    setConsolidated(out);
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
  function historyHas(d:string){
    return Object.values(submissions).some(r=>r.value.date===d) || Object.values(entries).some(r=>r.value.date===d) || qualityAnswers.some(r=>r.value.date===d) || Object.values(temps).some(r=>r.value.date===d);
  }
  function shiftHistoryMonth(delta:number){
    const [y,m]=historyMonth.split("-").map(Number);
    const d=new Date(y,m-1+delta,1);
    const p=(n:number)=>String(n).padStart(2,"0");
    setHistoryMonth(`${d.getFullYear()}-${p(d.getMonth()+1)}`);
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
      ...(originalLogin ? {replaces:originalLogin} : {}),
      ...(originalProfile ? {replacesProfile:originalProfile} : {}),
    };
    try{
      if(editingRec) await api("records.replace",{collection:"dojo_credentials",id:editing!,value});
      else await api("records.create",{collection:"dojo_credentials",value,idempotency_key:`dojo-staff-${login}-${Date.now()}`});
      await reloadRecords(); setOfflineMode(false);
      resetStaffForm();
      setStaffMsg(`${name} salvo. Login: ${login} · senha: ${password}.`);
    }catch{ setOfflineMode(true); setStaffMsg("Não foi possível salvar o cadastro. Tente novamente."); }
    setStaffSaving(false);
  }
  function taskOverdue(t:TaskRecord){
    if(t.status==="Concluída") return false;
    return `${t.dueDate}T${t.dueTime||"23:59"}` < nowLocalString();
  }
  function tempLimitFor(key:"fria"|"freezer"){ return tempLimits.find(r=>r.value.key===key)?.value; }
  async function saveQuestion(){
    if(!isManager){ setMsg("Somente a Gerência cria perguntas."); return; }
    const question = String(auxForm.qText||"").trim();
    if(!question){ setMsg("Escreva a pergunta."); return; }
    const value:QuestionRecord = { question, section:String(auxForm.qSection||"Produção").trim(), weight:Math.max(1,Math.min(5,Number(auxForm.qWeight||3))), minScore:Number(auxForm.qMin||7.5), type:(auxForm.qType||"check") as QuestionRecord["type"], hint:String(auxForm.qHint||"").trim(), referencePhoto:String(auxForm.qRef||""), createdAt:new Date().toISOString() };
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
    if(q.value.type==="check"){
      verdict = (d.verdict as QualityAnswerRecord["verdict"])||"Conforme";
      score = verdict==="Conforme"?10:verdict==="Parcial"?6:0;
    }else{
      const filled = q.value.type==="photo" ? !!d.photo : q.value.type==="temperature" ? !!d.temperature : !!d.note?.trim();
      verdict = filled?"Conforme":"Não conforme";
      score = filled?10:0;
    }
    const value:QualityAnswerRecord = { date, questionId:q.id, question:q.value.question, profile:selected||"", verdict, score, note:d.note||"", photo:d.photo||"", temperature:d.temperature||"", time:nowTime() };
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
    if(!selected) return [];
    return activeSections.flatMap(sec=>countsForSection(sec).list.map(item=>({item,sec,status:entryFor(item.id).status}))).filter(x=>x.status!=="Feito").slice(0,5);
  },[selected,date,entries,activeSections]);
  const sharedProduction = useMemo(()=>{
    if(!selected) return [] as {person:string;total:number;doneMe:number;doneThem:number;missing:string[]}[];
    const mine = new Set((byProfile[selected]||[]).filter(i=>String(i.section||"").includes("Produção")).map(i=>i.id));
    return Object.keys(byProfile)
      .filter(p=>p!==selected && p!=="Gerência")
      .map(p=>{
        const shared=(byProfile[p]||[]).filter(i=>mine.has(i.id) && String(i.section||"").includes("Produção"));
        if(!shared.length) return null;
        const doneMe=shared.filter(i=>entryFor(i.id).status==="Feito").length;
        const doneThem=shared.filter(i=>entries[`${p}|${date}|${i.id}`]?.value.status==="Feito").length;
        const missing=shared.filter(i=>entryFor(i.id).status==="Feito" && entries[`${p}|${date}|${i.id}`]?.value.status!=="Feito").map(i=>i.name);
        return {person:p,total:shared.length,doneMe,doneThem,missing};
      })
      .filter((x):x is {person:string;total:number;doneMe:number;doneThem:number;missing:string[]}=>!!x);
  },[selected,date,entries]);
  function sharedProductionSection(){
    if(!sharedProduction.length) return null;
    return <section className="card p-5 mt-4" aria-label="Produção compartilhada">
      <h3 className="font-extrabold text-[18px]">Produção compartilhada</h3>
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
      <div className="fixed top-3 right-3 z-40">{themeButton}</div>
      <div className="flex flex-col items-center text-center">
        <span className="w-16 h-16 grid place-items-center rounded-[20px] bg-[var(--primary)] text-white"><ClipboardCheck size={32}/></span>
        <div className="font-extrabold tracking-tight text-[26px] leading-none mt-4">Dojo Checklist</div>
        <div className="text-[13px] text-[var(--muted)] mt-2">Operação · Padrão · Conferência</div>
        <p role="status" title={connectionError || undefined} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--muted)]"><span aria-hidden="true" className="w-2 h-2 rounded-full" style={{background: loading ? "var(--warning)" : offlineMode ? "var(--danger)" : "var(--green)"}} />{loading ? "Conectando…" : offlineMode ? `Conexão: erro — ${connectionError || "backend indisponível"}` : "Conectado"}</p>
      </div>
      <div className="w-full max-w-[440px] card p-6 sm:p-7 mt-7">
        <h1 className="font-extrabold text-[24px] leading-tight tracking-tight text-center">Bem-vindo</h1>
        <p className="text-[14px] text-[var(--muted)] text-center mt-2 leading-relaxed">Faça login para ver seu checklist</p>
        <form className="mt-6" onSubmit={(ev)=>{ev.preventDefault(); handleLoginSubmit();}}>
          <label className="block"><span className="text-[13px] font-bold">Login</span><input autoFocus autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={loginInput} onChange={e=>{setLoginInput(e.target.value); setLoginError("");}} placeholder="Ex.: wesley" className="field mt-2 !h-[56px] !text-[16px]" aria-label="Login"/></label>
          <label className="block mt-4"><span className="text-[13px] font-bold">Senha</span><div className="relative mt-2"><input type={showPassword?"text":"password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={passwordInput} onChange={e=>{setPasswordInput(e.target.value); setLoginError("");}} placeholder="Sua senha" className="field !h-[56px] !text-[16px] !pr-[52px]" aria-label="Senha"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center text-[var(--muted)]" aria-label={showPassword?"Ocultar senha":"Mostrar senha"}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></label>
          <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none"><input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} className="w-5 h-5 accent-[var(--primary)] shrink-0"/><span className="text-[14px] font-semibold">Lembrar de mim</span></label>
          {loginLocked && <p role="alert" className="mt-4 p-3 rounded-xl bg-[var(--danger-bg)] text-[var(--danger-text)] text-sm font-bold text-center">Muitas tentativas. Aguarde {loginLockLeft}s</p>}
          {loginError && !loginLocked && <p role="alert" className="mt-4 p-3 rounded-xl bg-[var(--danger-bg)] text-[var(--danger-text)] text-sm font-bold text-center">{loginError}</p>}
          <button type="submit" disabled={loginLocked} className="w-full mt-5 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[16px] disabled:opacity-50">Entrar</button>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-[var(--muted)]">Acesso individual.</p>
          <button type="button" onClick={()=>setQrOpen(true)} className="mt-4 w-full bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-extrabold rounded-2xl py-3.5 text-[14px] flex items-center justify-center gap-2"><QrCode size={18}/> QR do Dojo</button>
        </form>
      </div>
      {msg && <p role="status" className="mt-4 text-[13px] text-[var(--muted)] text-center max-w-[440px]">{msg}</p>}
      {offlineMode && <p className="mt-3 text-[12px] text-[var(--muted)] text-center">Modo offline - histórico local</p>}

    </div>
  );

  const isChatDetail = tab==="chat" && !!conversation;
  const navItems = [{id:"checklist" as Tab,label:"Checklist",icon:ClipboardCheck},{id:"chat" as Tab,label:"Chat",icon:MessageCircle},{id:"overview" as Tab,label:"Conferência",icon:LayoutDashboard},{id:"modules" as Tab,label:"Módulos",icon:CalendarDays}].filter(t=> isManager ? t.id!=="checklist" : t.id!=="overview");

  return <div data-safe-area-inset-root className="app-shell overflow-x-clip" style={{boxSizing:"border-box",paddingTop:"var(--safe-area-inset-top)",minHeight:"100dvh"}}>
    {!authUser ? loginContent : <>
    {!isChatDetail && <header data-safe-area-sticky-top style={{top:"var(--safe-area-inset-top)"}} className="app-header sticky z-30 border-b border-[var(--line)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
        <span className="hidden sm:grid w-10 h-10 rounded-full place-items-center text-white font-extrabold shrink-0" style={{background:avatarColor(authUser)}}>{initials(authUser)}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-extrabold tracking-tight text-[15px] sm:text-[19px] truncate">Olá, {authUser}</div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span role="status" title={connectionError || undefined} aria-label={loading ? "Conexão: conectando" : offlineMode ? "Conexão: erro" : "Conexão: conectado"} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)] whitespace-nowrap"><span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{background: loading ? "var(--warning)" : offlineMode ? "var(--danger)" : "var(--green)"}} /><span className="hidden md:inline">{loading ? "Conectando…" : offlineMode ? "Conexão: erro" : "Conectado"}</span></span>
          <button type="button" disabled={pushBusy} onClick={()=>void handleEnablePush()} title="Ativar notificações de mensagens" aria-label={pushOn?"Notificações ativas":"Ativar notificações"} className={`w-10 h-10 min-w-[44px] min-h-[44px] grid place-items-center rounded-full border pressable ${pushOn?"bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success-text)]":"bg-[var(--surface-2)] border-[var(--line)] text-[var(--ink)]"}`}><Bell size={18}/></button>
          {themeButton}
          <button onClick={handleLogout} aria-label="Sair" className="bg-white text-black font-bold text-[12px] sm:text-[13px] px-3 py-2 rounded-full whitespace-nowrap flex items-center gap-1 pressable"><LogOut size={14}/> <span className="hidden sm:inline">Sair</span></button>
        </div>
      </div>
    </header>}

    {authUser && pushInfo && <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-2"><p className="text-[12px] font-bold text-[var(--muted)]">🔔 {pushInfo}</p></div>}
    {(offlineMode || queuedCount>0) && <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-2"><p className="text-[12px] font-bold text-[var(--muted)]">Modo offline · {queuedCount>0 ? `${queuedCount} alteraç${queuedCount===1?"ão":"ões"} aguardando sincronização` : "histórico local"}</p></div>}
    {loading && <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 space-y-3" aria-label="Carregando dados"><div className="skeleton h-24" /><div className="grid grid-cols-2 gap-3"><div className="skeleton h-20" /><div className="skeleton h-20" /></div><div className="skeleton h-32" /></div>}

    {tab==="overview" && isManager && <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-[140px] tab-transition">
      <div className="mt-6">
        <p className="text-[13px] font-bold tracking-wide uppercase text-[var(--muted)]">Conferência</p>
        <h2 className="font-extrabold text-[26px] leading-tight mt-1">Hoje, {fmtDate(date)}</h2>
      </div>
      <section className="grid grid-cols-2 gap-3 mt-5" aria-label="Dashboard do dia">
        <div className="card p-4"><p className="text-[12px] font-bold text-[var(--muted)]">Hoje concluídos</p><p className="font-extrabold text-[clamp(26px,7vw,34px)] leading-tight mt-1">{completedSectionsToday} / {expectedSectionsToday}</p></div>
        <div className="card p-4"><p className="text-[12px] font-bold text-[var(--muted)]">% Conformidade Hoje</p><p className="font-extrabold text-[clamp(26px,7vw,34px)] leading-tight mt-1" style={{color:complianceColor(complianceToday)}}>{complianceToday}%</p></div>
        <div className="card p-4"><p className="text-[12px] font-bold text-[var(--muted)]">Planos de Ação Pendentes</p><p className="font-extrabold text-[clamp(26px,7vw,34px)] leading-tight mt-1">{pendingPlansCount}</p></div>
        <div className="card p-4"><p className="text-[12px] font-bold text-[var(--muted)]">Atrasados</p><p className="font-extrabold text-[clamp(26px,7vw,34px)] leading-tight mt-1">{delayedList.list.length}</p></div>
      </section>
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={buildAiInsights} className="flex-1 min-w-[150px] bg-[var(--primary)] text-white font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><Sparkles size={17}/> Revisão da IA</button>
        <button onClick={()=>setQrOpen(true)} className="flex-1 min-w-[150px] bg-[var(--secondary-bg)] text-white font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><QrCode size={17}/> QR do Dojo</button>
        <button onClick={exportReport} className="flex-1 min-w-[170px] bg-white text-black font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><Download size={17}/> Exportar relatório do dia</button>
        <button onClick={()=>void shareReport()} className="flex-1 min-w-[170px] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><Share2 size={17}/> Compartilhar relatório</button>
        <button onClick={()=>void exportPdf()} className="flex-1 min-w-[150px] bg-[var(--secondary-bg)] text-white font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><Download size={17}/> PDF</button>
        <button onClick={whatsappAlert} className="flex-1 min-w-[170px] bg-[#25D366] text-white font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><MessageCircle size={17}/> Alerta no WhatsApp</button>
        <button onClick={buildConsolidated} className="flex-1 min-w-[170px] bg-[var(--secondary-bg)] text-white font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><Sparkles size={17}/> Parecer consolidado</button>
        <button onClick={()=>setWeeklySummaryOpen(!weeklySummaryOpen)} aria-expanded={weeklySummaryOpen} className="flex-1 min-w-[170px] bg-[var(--secondary-bg)] text-white font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2"><CalendarDays size={17}/> Resumo da Semana</button>
        {isManager && <button onClick={()=>setRankingOpen(!rankingOpen)} aria-expanded={rankingOpen} className="flex-1 min-w-[170px] bg-[#FFC107] text-black font-extrabold rounded-2xl px-4 py-3.5 text-[14px] flex items-center justify-center gap-2">🏆 {rankingOpen ? "Ocultar Ranking da Semana" : "Ver Ranking da Semana"}</button>}
      </div>
      <div className="flex flex-wrap gap-2 mt-4"><button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} className="chip">↑ Conferência</button><button onClick={()=>document.getElementById("dash-equipe")?.scrollIntoView({behavior:"smooth",block:"start"})} className="chip">Equipe</button><button onClick={()=>document.getElementById("dash-qualidade")?.scrollIntoView({behavior:"smooth",block:"start"})} className="chip">Qualidade</button></div>
      {isManager && rankingOpen && <section className="card p-5 mt-4" aria-label="Ranking da Semana"><h3 className="font-extrabold text-[18px]">🏆 Ranking da Semana</h3><p className="text-[13px] text-[var(--muted)] mt-1">Segunda a domingo · {fmtDate(weeklyRanking.weekStart)} a {fmtDate(weeklyRanking.weekEnd)} · % = Feito / Total da semana</p>{weeklyRanking.rows.filter(r=>r.total>0).length===0 ? <p className="text-sm text-[var(--muted)] mt-4 leading-relaxed">Nenhum checklist concluído nesta semana ainda.</p> : <><div className="grid grid-cols-3 gap-2 mt-4">{weeklyRanking.rows.slice(0,3).map((r,i)=>{ const medal = i===0 ? "🥇" : i===1 ? "🥈" : "🥉"; return <div key={r.person} className="rounded-2xl bg-[var(--surface-2)] p-3 text-center"><div className="text-[26px] leading-none">{medal}</div><p className="font-extrabold text-[15px] mt-2 [overflow-wrap:anywhere]">{r.person}</p><p className="font-extrabold text-[20px] mt-1" style={{color:complianceColor(r.pct)}}>{r.pct}%</p><p className="text-[12px] text-[var(--muted)] mt-1">{r.checklists} checklist{r.checklists===1 ? "" : "s"}</p></div>; })}</div><ol className="mt-5 space-y-4">{weeklyRanking.rows.map((r,i)=><li key={r.person} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"><div className="flex justify-between gap-2 items-baseline"><span className="font-bold text-[16px] [overflow-wrap:anywhere]">{i+1}º {r.person}</span><span className="text-[14px] font-extrabold shrink-0" style={{color:complianceColor(r.pct)}}>{r.pct}% • {r.checklists} checklist{r.checklists===1 ? "" : "s"}</span></div><div className="h-1.5 rounded-full bg-[var(--secondary-bg)] mt-2 overflow-hidden"><div className="h-full rounded-full" style={{width:`${r.pct}%`,background:complianceColor(r.pct)}} /></div><p className="text-[12px] text-[var(--muted)] mt-1.5">{r.feitos} feitos · {r.naoFeitos} não feitos · {r.total} itens marcados</p></li>)}</ol></>}</section>}
      {weeklySummaryOpen && <section className="card p-5 mt-4" aria-label="Resumo da Semana"><h3 className="font-extrabold text-[18px]">Resumo da Semana</h3><p className="text-[13px] text-[var(--muted)] mt-1">Segunda a domingo · {fmtDate(weeklySummary.weekStart)} a {fmtDate(weeklySummary.weekEnd)}</p><ul className="mt-4 space-y-3 text-[14px] leading-relaxed"><li><b>Total de checklists concluídos na semana:</b> {weeklySummary.totalConcluded}</li><li><b>% Conformidade média da semana:</b> <span style={{color:complianceColor(weeklySummary.avgCompliance)}}>{weeklySummary.avgCompliance}%</span> <span className="text-[var(--muted)]">({weeklySummary.feitos} feitos · {weeklySummary.naoFeitos} não feitos)</span></li><li><b>Top 3 itens mais marcados como Não feito na semana:</b>{weeklySummary.top3.length===0 ? <span className="text-[var(--muted)]"> Nenhum item marcado como Não feito na semana.</span> : <ol className="mt-1 space-y-1 list-decimal pl-5">{weeklySummary.top3.map((t,i)=><li key={`${t.name}-${i}`} className="[overflow-wrap:anywhere]">{t.name} — {t.count}x</li>)}</ol>}</li><li><b>Pessoas com 100% na semana:</b>{weeklySummary.perfectPeople.length===0 ? <span className="text-[var(--muted)]"> Ninguém com 100% na semana.</span> : <span> {weeklySummary.perfectPeople.join(", ")}</span>}</li><li><b>Planos de Ação:</b> {weeklySummary.plansResolved} resolvidos / {weeklySummary.plansPending} pendentes</li></ul><button onClick={()=>setWeeklySummaryOpen(false)} className="mt-4 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold rounded-xl px-4 py-3 text-[13px]">Fechar resumo</button></section>}
      {aiInsights && <section className="card p-5 mt-4"><h3 className="font-extrabold text-[17px] flex items-center gap-2"><Sparkles size={18} className="text-[var(--primary)]"/> Revisão da IA — {fmtDate(date)}</h3><ul className="mt-3 space-y-2">{aiInsights.map((t,i)=><li key={i} className="text-[14px] leading-relaxed [overflow-wrap:anywhere]">• {t}</li>)}</ul></section>}
      {isManager && <section id="dash-qualidade" className="card p-5 mt-4" aria-label="Validade e vencimento">
        <h3 className="font-extrabold text-[18px]">Validade / Vencimento</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">Produtos vencidos ou vencendo em até 3 dias.</p>
        {expiryAlerts.length===0 ? <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">Nenhum produto vencido ou vencendo em 3 dias.</p> : <ul className="mt-4 space-y-3">{expiryAlerts.map((v,i)=>{
          const diff = daysBetween(date, v.expiryDate);
          const isExpired = diff<0;
          return <li key={`${v.profile}-${v.product}-${v.expiryDate}-${i}`} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
            <p className="font-bold text-[16px] [overflow-wrap:anywhere]">{v.product}</p>
            <p className="text-[13px] mt-1">Validade: {fmtDate(v.expiryDate)} · Quem registrou: {v.profile}</p>
            <span className="inline-block mt-2 text-[12px] font-extrabold px-2.5 py-1 rounded-full" style={{background: "var(--danger-bg)", color: "var(--danger-text)"}}>{isExpired ? "Vencido" : diff===0 ? "Vencendo hoje" : `Vencendo em ${diff} dias`}</span>
          </li>;
        })}</ul>}
      </section>}
      <section className="card p-5 mt-4">
        <h3 className="font-extrabold text-[18px]">Por pessoa — hoje</h3>
        <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Filtrar por pessoa">{OVERVIEW_FILTER_PEOPLE.map(p=><button key={p} type="button" onClick={()=>setOverviewPerson(p)} className={`chip ${overviewPerson===p?"active":""}`}>{p}</button>)}</div>
        <ul className="mt-4 space-y-4">{overviewFilteredPeople.map(p=><li key={p.person} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
          <div className="flex justify-between gap-2 items-baseline"><span className="font-bold text-[16px] [overflow-wrap:anywhere]">{p.person}</span><span className="text-[14px] font-extrabold shrink-0" style={{color:complianceColor(p.pct)}}>{p.feitos}/{p.total} — {p.pct}%</span></div>
          <div className="h-1.5 rounded-full bg-[var(--secondary-bg)] mt-2 overflow-hidden"><div className="h-full rounded-full" style={{width:`${p.pct}%`,background:complianceColor(p.pct)}} /></div>
          <p className="text-[12px] text-[var(--muted)] mt-1.5">Iniciado {p.shift?.startedAt||"—"} • Concluído {p.shift?.finishedAt||"—"}</p>
        </li>)}</ul>
      </section>
      <section className="card p-5 mt-4" aria-label="Cadastro de funcionários">
        <h3 className="font-extrabold text-[18px]">Cadastro de funcionários</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">Somente a Gerência cadastra. O novo login entra na lista de pessoas, no seletor de conferência e no grupo do chat.</p>
        <div className="grid gap-3 mt-4 sm:grid-cols-2">
          <label className="block"><span className="text-[13px] font-bold">Nome</span><input value={staffForm.name||""} onChange={e=>setStaffForm(p=>({...p,name:e.target.value}))} placeholder="Ex.: Ana Souza" className="field mt-1.5" aria-label="Nome do funcionário" /></label>
          <label className="block"><span className="text-[13px] font-bold">Login</span><input value={staffForm.login||""} onChange={e=>setStaffForm(p=>({...p,login:e.target.value}))} placeholder="Ex.: ana" className="field mt-1.5" aria-label="Login do funcionário" /></label>
          <label className="block"><span className="text-[13px] font-bold">Senha</span><input value={staffForm.password||""} onChange={e=>setStaffForm(p=>({...p,password:e.target.value}))} placeholder="dojo123" className="field mt-1.5" aria-label="Senha do funcionário" /></label>
          <label className="block"><span className="text-[13px] font-bold">Estação / setor</span><input value={staffForm.station||""} onChange={e=>setStaffForm(p=>({...p,station:e.target.value}))} placeholder="Ex.: Cozinha Quente" className="field mt-1.5" aria-label="Estação do funcionário" /></label>
          <label className="block"><span className="text-[13px] font-bold">Grupo do chat</span><select value={staffForm.group||""} onChange={e=>setStaffForm(p=>({...p,group:e.target.value}))} className="field mt-1.5" aria-label="Grupo do chat"><option value="">Sem grupo</option><option value="cozinha">Cozinha</option><option value="copa">Copa</option><option value="quiosque">Quiosque</option></select></label>
          <label className="block"><span className="text-[13px] font-bold">Turno</span><select value={staffForm.shift||"Manhã"} onChange={e=>setStaffForm(p=>({...p,shift:e.target.value}))} className="field mt-1.5" aria-label="Turno do funcionário"><option>Manhã</option><option>Tarde</option><option>Noite</option></select></label>
        </div>
        <div className="flex flex-wrap gap-2 mt-4"><button disabled={staffSaving} onClick={()=>void saveStaffRecord()} className="bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3.5 text-[14px] disabled:opacity-50">{staffSaving ? "Salvando…" : staffEditingId ? "Salvar alterações" : "Cadastrar funcionário"}</button>{staffEditingId && <button onClick={resetStaffForm} className="bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold rounded-2xl px-5 py-3.5 text-[14px]">Cancelar edição</button>}</div>
        {staffMsg && <p role="status" className="mt-3 text-[13px] font-bold">{staffMsg}</p>}
        <ul className="mt-4 space-y-2">
          <li className="border-b border-[var(--line)] pb-2"><p className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Equipe inicial — também editável</p><div className="flex flex-wrap gap-2 mt-2">{Object.keys(LOGIN_TO_PROFILE).filter(k=>k!=="gerencia" && !replacedProfiles.has(LOGIN_TO_PROFILE[k])).map(k=><button key={k} type="button" onClick={()=>startBuiltinStaffEdit(k)} className="chip">{LOGIN_TO_PROFILE[k]} <span className="text-[var(--muted)]">({k})</span></button>)}</div></li>
          {credentials.length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhum funcionário cadastrado além da equipe inicial.</li> : credentials.map(c=><li key={c.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className="font-bold text-[15px]">{c.value.profile}</span><span className="text-[12px] text-[var(--muted)]">login {c.value.login}{c.value.station ? ` · ${c.value.station}` : ""}{c.value.group ? ` · ${c.value.group}` : ""}</span><button type="button" onClick={()=>startStaffEdit(c)} className="ml-auto bg-white text-black font-extrabold text-[12px] px-3 py-2 rounded-xl">Editar login/senha</button></li>)}
        </ul>
      </section>
      <section className="card p-5 mt-4" aria-label="Próximas pendências">
        <h3 className="font-extrabold text-[18px]">Próximas pendências</h3>
        {nextPending.length===0 ? <p className="text-sm text-[var(--muted)] mt-3">Tudo em dia.</p> : <ul className="mt-3 space-y-2">{nextPending.map(({item,sec,status})=><li key={item.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className="font-bold text-[14px] flex-1 min-w-0 [overflow-wrap:anywhere]">{item.name}</span><span className="text-[12px] text-[var(--muted)]">{displaySectionTitle(sec)} · {status||"sem marcação"}</span><button onClick={()=>{setTab("chat"); setConversation(selected||"");}} className="bg-white text-black font-extrabold text-[12px] px-3 py-2 rounded-xl">Ver conversa</button></li>)}</ul>}
      </section>
      {sharedProductionSection()}
      <section className="card p-5 mt-4" aria-label="QR por estação">
        <h3 className="font-extrabold text-[18px] flex items-center gap-2"><QrCode size={18} className="text-[var(--primary)]"/> QR por estação</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1">Gere um QR para cada estação e cole no posto: abre o app com o login da pessoa preenchido.</p>
        <div className="flex flex-wrap gap-2 mt-3">{staffProfiles.map(p=><button key={p} type="button" onClick={()=>openStationQr(p)} className="chip"><QrCode size={13}/>{p}</button>)}</div>
      </section>
      {consolidated && <section className="card p-5 mt-4" aria-label="Parecer consolidado">
        <h3 className="font-extrabold text-[18px]">Parecer consolidado — últimos 7 dias</h3>
        <div className="grid gap-3 mt-4 sm:grid-cols-2">{(["destaques","inconsistencias","riscos","oportunidades"] as const).map(k=>{ const titles={destaques:"✅ Destaques",inconsistencias:"🔁 Inconsistências",riscos:"⚠️ Riscos",oportunidades:"💡 Oportunidades"}; return <div key={k} className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-[12px] font-extrabold uppercase text-[var(--muted)]">{titles[k]}</p><ul className="mt-2 space-y-1 text-[13px] leading-relaxed">{consolidated[k].length?consolidated[k].map((t,i)=><li key={i}>• {t}</li>):<li className="text-[var(--muted)]">Nada registrado.</li>}</ul></div>; })}</div>
        <button onClick={()=>void shareReport()} className="mt-3 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-4 py-3 text-[13px]">Compartilhar parecer</button>
      </section>}
      <section className="card p-5 mt-4" aria-label="Histórico em calendário">
        <h3 className="font-extrabold text-[18px]">Histórico em calendário</h3>
        <div className="flex items-center justify-between gap-2 mt-3"><button onClick={()=>shiftHistoryMonth(-1)} className="chip">←</button><p className="font-bold text-[14px] capitalize">{new Date(`${historyMonth}-02T12:00:00`).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</p><button onClick={()=>shiftHistoryMonth(1)} className="chip">→</button></div>
        <div className="grid grid-cols-7 gap-1 mt-3">{["D","S","T","Q","Q","S","S"].map((d,i)=><span key={i} className="text-center text-[11px] font-bold text-[var(--muted)]">{d}</span>)}{(()=>{ const [y,m]=historyMonth.split("-").map(Number); const first=new Date(y,m-1,1).getDay(); const days=new Date(y,m,0).getDate(); return <>{Array.from({length:first},(_,i)=><span key={`b${i}`}/>)}{Array.from({length:days},(_,i)=>{ const day=i+1; const p=(n:number)=>String(n).padStart(2,"0"); const ds=`${historyMonth}-${p(day)}`; const has=historyHas(ds); return <button key={ds} onClick={()=>setHistoryDate(ds)} className={`aspect-square rounded-lg text-[12px] font-bold border ${historyDate===ds?"bg-[var(--primary)] text-white border-[var(--primary)]":has?"bg-[var(--surface-2)] text-[var(--ink)] border-[var(--primary)]":"bg-[var(--surface-inset)] text-[var(--muted)] border-[var(--line)]"}`}>{day}</button>; })}</>; })()}</div>
        {(()=>{ const subs=Object.values(submissions).filter(r=>r.value.date===historyDate); const ent=Object.values(entries).filter(r=>r.value.date===historyDate); const qa=qualityAnswers.filter(r=>r.value.date===historyDate); const tp=Object.values(temps).filter(r=>r.value.date===historyDate); const f=ent.filter(r=>r.value.status==="Feito").length; const n=ent.filter(r=>r.value.status==="Não feito").length; const photos=ent.filter(r=>!!r.value.photo).length; return <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-3"><p className="font-extrabold text-[14px]">{fmtDate(historyDate)}</p><p className="text-[13px] text-[var(--muted)] mt-1">Checklists concluídos: {subs.length} · Itens: {f} feitos / {n} não feitos · Fotos: {photos} · Auditorias: {qa.length} · Temperaturas: {tp.length}</p>{subs.length>0 && <ul className="mt-2 space-y-1 text-[12px]">{subs.map(r=><li key={r.id}>• {r.value.profile} · {r.value.section} · {r.value.status}</li>)}</ul>}</div>; })()}
      </section>
      <section className="card p-5 mt-4" aria-label="Estoque e recebimento">
        <h3 className="font-extrabold text-[18px]">Estoque e recebimento</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1">Cadastre itens com saldo esperado, mínimo e máximo. A equipe conta e confere o recebimento.</p>
        <div className="grid gap-3 mt-4 sm:grid-cols-3">
          <input value={auxForm.stockItem||""} onChange={e=>setAuxForm(p=>({...p,stockItem:e.target.value}))} placeholder="Item" className="field" aria-label="Item de estoque" />
          <input value={auxForm.stockCategory||""} onChange={e=>setAuxForm(p=>({...p,stockCategory:e.target.value}))} placeholder="Categoria" className="field" aria-label="Categoria do item" />
          <input value={auxForm.stockExpected||""} onChange={e=>setAuxForm(p=>({...p,stockExpected:e.target.value}))} placeholder="Esperado" className="field" aria-label="Saldo esperado" />
          <input value={auxForm.stockMin||""} onChange={e=>setAuxForm(p=>({...p,stockMin:e.target.value}))} placeholder="Mínimo" className="field" aria-label="Estoque mínimo" />
          <input value={auxForm.stockMax||""} onChange={e=>setAuxForm(p=>({...p,stockMax:e.target.value}))} placeholder="Máximo" className="field" aria-label="Estoque máximo" />
          <input value={auxForm.stockUnit||"un"} onChange={e=>setAuxForm(p=>({...p,stockUnit:e.target.value}))} placeholder="Unidade" className="field" aria-label="Unidade do item" />
        </div>
        <button onClick={()=>void saveStockItem()} className="mt-3 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3 text-[13px]">Cadastrar item</button>
        <ul className="mt-4 space-y-2">{stockItems.length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhum item cadastrado.</li> : stockItems.map(r=><li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className="font-bold text-[14px] flex-1">{r.value.item}</span><span className="text-[12px] text-[var(--muted)]">{r.value.category} · esperado {r.value.expected||"—"} {r.value.unit}</span></li>)}</ul>
        <p className="text-[12px] font-bold uppercase text-[var(--muted)] mt-4">Recebimentos de hoje</p>
        <ul className="mt-2 space-y-2">{receivings.filter(r=>r.value.date===date).length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhum recebimento hoje.</li> : receivings.filter(r=>r.value.date===date).map(r=><li key={r.id} className="border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><p className="font-bold text-[14px]">{r.value.item} · {r.value.supplier||"sem fornecedor"}</p><p className="text-[12px] text-[var(--muted)]">Nota {r.value.invoice||"—"} · esperado {r.value.expectedQty||"—"} · recebido {r.value.receivedQty||"—"} · <b className={r.value.status==="Divergente"?"text-[var(--danger-text)]":"text-[var(--success-text)]"}>{r.value.status}</b></p></li>)}</ul>
      </section>
      <section className="card p-5 mt-4" aria-label="Temperatura e limites">
        <h3 className="font-extrabold text-[18px]">Temperatura — limites e histórico</h3>
        <div className="grid gap-3 mt-4 sm:grid-cols-2">{(["fria","freezer"] as const).map(k=><div key={k} className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-[13px] font-extrabold capitalize">{k==="fria"?"Câmara fria":"Freezer"}</p><div className="flex gap-2 mt-2"><input type="number" value={auxForm[`tempMin-${k}`] ?? String(tempLimitFor(k)?.min ?? "")} onChange={e=>setAuxForm(p=>({...p,[`tempMin-${k}`]:e.target.value}))} placeholder="Mín." className="field !mt-0" aria-label={`Mínimo ${k}`} /><input type="number" value={auxForm[`tempMax-${k}`] ?? String(tempLimitFor(k)?.max ?? "")} onChange={e=>setAuxForm(p=>({...p,[`tempMax-${k}`]:e.target.value}))} placeholder="Máx." className="field !mt-0" aria-label={`Máximo ${k}`} /></div><button onClick={()=>void saveTempLimit(k)} className="mt-2 bg-[var(--secondary-bg)] text-white font-bold text-[12px] px-3 py-2 rounded-xl">Salvar limite</button></div>)}</div>
        <p className="text-[12px] font-bold uppercase text-[var(--muted)] mt-4">Últimos 7 dias — {selected}</p>
        <div className="flex items-end gap-2 mt-3 h-[100px]">{Array.from({length:7},(_,i)=>addDays(date,-(6-i))).map(d=>{ const v=temps[`${selected}|${d}`]?.value; const n=parseTempValue(v?.fria||""); const h=n===null?0:Math.min(100,Math.max(6,Math.round((n+10)/20*100))); return <div key={d} className="flex-1 flex flex-col items-center gap-1"><div className="w-full rounded-t-lg bg-[var(--primary)]" style={{height:`${h}%`}} title={n===null?"sem registro":`${n} °C`} /><span className="text-[10px] text-[var(--muted)]">{d.slice(8)}</span></div>; })}</div>
      </section>
      <section className="card p-5 mt-4" aria-label="Auditoria de qualidade">
        <h3 className="font-extrabold text-[18px]">Auditoria de qualidade</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1">Perguntas com peso e nota mínima; a foto tirada aparece ao lado da referência para conferência.</p>
        <div className="grid gap-3 mt-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="text-[13px] font-bold">Pergunta</span><input value={auxForm.qText||""} onChange={e=>setAuxForm(p=>({...p,qText:e.target.value}))} placeholder="Ex.: Bancada limpa e sem resíduos" className="field mt-1.5" aria-label="Pergunta da auditoria" /></label>
          <label className="block"><span className="text-[13px] font-bold">Seção</span><select value={auxForm.qSection||"Produção"} onChange={e=>setAuxForm(p=>({...p,qSection:e.target.value}))} className="field mt-1.5" aria-label="Seção da pergunta">{SECTIONS.map(s=><option key={s}>{s}</option>)}</select></label>
          <label className="block"><span className="text-[13px] font-bold">Tipo</span><select value={auxForm.qType||"check"} onChange={e=>setAuxForm(p=>({...p,qType:e.target.value}))} className="field mt-1.5" aria-label="Tipo de pergunta"><option value="check">Conforme / Parcial / Não conforme</option><option value="photo">Foto</option><option value="text">Observação</option><option value="temperature">Temperatura</option></select></label>
          <label className="block"><span className="text-[13px] font-bold">Peso (1–5)</span><input type="number" min={1} max={5} value={auxForm.qWeight||"3"} onChange={e=>setAuxForm(p=>({...p,qWeight:e.target.value}))} className="field mt-1.5" aria-label="Peso da pergunta" /></label>
          <label className="block"><span className="text-[13px] font-bold">Nota mínima</span><input type="number" step="0.5" value={auxForm.qMin||"7.5"} onChange={e=>setAuxForm(p=>({...p,qMin:e.target.value}))} className="field mt-1.5" aria-label="Nota mínima" /></label>
          <label className="block sm:col-span-2"><span className="text-[13px] font-bold">Dica para a equipe</span><input value={auxForm.qHint||""} onChange={e=>setAuxForm(p=>({...p,qHint:e.target.value}))} placeholder="Como deve estar o padrão" className="field mt-1.5" aria-label="Dica da pergunta" /></label>
          <div className="sm:col-span-2"><span className="text-[13px] font-bold">Foto de referência</span><PhotoField value={auxForm.qRef||""} onChange={data=>setAuxForm(p=>({...p,qRef:data}))} label="Foto de referência" /></div>
        </div>
        <button onClick={()=>void saveQuestion()} className="mt-3 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3 text-[13px]">Criar pergunta</button>
        <ul className="mt-4 space-y-2">{questions.length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhuma pergunta cadastrada.</li> : questions.map(r=><li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className="font-bold text-[14px] flex-1 min-w-0">{r.value.question}</span><span className="text-[12px] text-[var(--muted)]">{r.value.section} · peso {r.value.weight} · mín {r.value.minScore}</span>{r.value.referencePhoto && <img src={r.value.referencePhoto} alt="Referência" className="w-10 h-10 object-cover rounded-lg border border-[var(--line)]" />}</li>)}</ul>
        {(()=>{ const s=qualityScoreFor(selected||""); return s ? <p className="mt-4 rounded-xl bg-[var(--surface-2)] p-3 text-[14px] font-bold">Nota de {selected}: {s.score}/10 · {s.verdict} ({s.count} respostas)</p> : null; })()}
        <p className="text-[12px] font-bold uppercase text-[var(--muted)] mt-4">Respostas de hoje — {selected}</p>
        <ul className="mt-2 space-y-3">{qualityAnswers.filter(a=>a.value.date===date && a.value.profile===selected).length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhuma resposta hoje.</li> : qualityAnswers.filter(a=>a.value.date===date && a.value.profile===selected).map(row=>{ const q=questions.find(x=>x.id===row.value.questionId)?.value; return <li key={row.id} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"><p className="font-bold text-[14px]">{row.value.question} · {row.value.verdict}</p><div className="flex flex-wrap gap-2 mt-2">{q?.referencePhoto && <div className="flex-1 min-w-[100px]"><p className="text-[11px] text-[var(--muted)]">Referência</p><img src={q.referencePhoto} alt="Referência" className="w-full h-24 object-cover rounded-xl border border-[var(--line)]" /></div>}{row.value.photo && <div className="flex-1 min-w-[100px]"><p className="text-[11px] text-[var(--muted)]">Capturada</p><img src={row.value.photo} alt="Capturada" className="w-full h-24 object-cover rounded-xl border border-[var(--line)]" /></div>}</div>{row.value.note && <p className="text-[13px] mt-2">{row.value.note}</p>}{row.value.reviewedBy ? <p className="text-[12px] font-bold text-[var(--success-text)] mt-2">Revisado por {row.value.reviewedBy} · {row.value.reviewedVerdict}</p> : <div className="flex gap-2 mt-2"><button onClick={()=>void reviewQuality(row,true)} className="bg-[var(--green)] text-white font-bold text-[12px] px-3 py-2 rounded-xl">Confirmar</button><button onClick={()=>void reviewQuality(row,false)} className="bg-[var(--danger)] text-white font-bold text-[12px] px-3 py-2 rounded-xl">Reprovar</button></div>}</li>; })}</ul>
      </section>
      <section className="card p-5 mt-4" aria-label="Regras de qualidade">
        <h3 className="font-extrabold text-[18px]">Regras de qualidade</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1">Exija foto antes de marcar um item como Feito.</p>
        <div className="flex flex-wrap gap-2 mt-3"><select value={auxForm.ruleItem||""} onChange={e=>setAuxForm(p=>({...p,ruleItem:e.target.value}))} className="field flex-1 min-w-[200px]" aria-label="Item da regra"><option value="">Selecione o item</option>{(byProfile[selected||""]||ALL_ITEMS).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><button disabled={!auxForm.ruleItem} onClick={()=>void togglePhotoRule(auxForm.ruleItem!)} className="bg-[var(--primary)] text-white font-extrabold rounded-2xl px-4 py-3 text-[13px] disabled:opacity-50">{itemRules.find(r=>r.value.itemId===auxForm.ruleItem)?.value.requirePhoto?"Remover exigência":"Exigir foto"}</button></div>
        <div className="flex flex-wrap gap-2 mt-3">{itemRules.filter(r=>r.value.requirePhoto).map(r=><span key={r.id} className="chip">{ALL_ITEMS.find(i=>i.id===r.value.itemId)?.name||r.value.itemId} 📷</span>)}</div>
      </section>
      <section id="dash-equipe" className="card p-5 mt-4" aria-label="Tarefas avulsas">
        <h3 className="font-extrabold text-[18px]">Tarefas avulsas</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1">Tarefa com responsável e prazo. Vencida, aparece em vermelho e a gerência é avisada.</p>
        <div className="grid gap-3 mt-4 sm:grid-cols-2">
          <label className="block"><span className="text-[13px] font-bold">Tarefa</span><input value={auxForm.taskTitle||""} onChange={e=>setAuxForm(p=>({...p,taskTitle:e.target.value}))} placeholder="Ex.: Trocar filtro da coifa" className="field mt-1.5" aria-label="Título da tarefa" /></label>
          <label className="block"><span className="text-[13px] font-bold">Responsável</span><select value={auxForm.taskOwner||""} onChange={e=>setAuxForm(p=>({...p,taskOwner:e.target.value}))} className="field mt-1.5" aria-label="Responsável da tarefa"><option value="">Selecione</option>{staffProfiles.map(p=><option key={p}>{p}</option>)}</select></label>
          <label className="block"><span className="text-[13px] font-bold">Data</span><input type="date" value={auxForm.taskDate||date} onChange={e=>setAuxForm(p=>({...p,taskDate:e.target.value}))} className="field mt-1.5" aria-label="Data da tarefa" /></label>
          <label className="block"><span className="text-[13px] font-bold">Hora limite</span><input type="time" value={auxForm.taskTime||"18:00"} onChange={e=>setAuxForm(p=>({...p,taskTime:e.target.value}))} className="field mt-1.5" aria-label="Hora da tarefa" /></label>
          <div className="sm:col-span-2"><span className="text-[13px] font-bold">Dias da semana <span className="font-normal text-[var(--muted)]">(vazio = todos)</span></span><div className="flex flex-wrap gap-1.5 mt-2">{["D","S","T","Q","Q","S","S"].map((d,i)=>{ const on=String(auxForm.taskDays||"").split(",").includes(String(i)); return <button key={i} type="button" aria-label={`Dia ${i}`} onClick={()=>{ const cur=String(auxForm.taskDays||"").split(",").filter(Boolean); const next=on?cur.filter(x=>x!==String(i)):[...cur,String(i)]; setAuxForm(p=>({...p,taskDays:next.sort((a,b)=>Number(a)-Number(b)).join(",")})); }} className={`w-9 h-9 rounded-full text-[12px] font-extrabold border ${on?"bg-[var(--primary)] text-white border-[var(--primary)]":"bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)]"}`}>{d}</button>; })}</div></div>
        </div>
        <button onClick={()=>void createTask()} className="mt-3 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3 text-[14px]">Criar tarefa</button>
        <ul className="mt-4 space-y-2">{tasks.filter(r=>taskApplies(r.value)).length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhuma tarefa avulsa.</li> : tasks.filter(r=>taskApplies(r.value)).map(row=><li key={row.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className={`font-bold text-[14px] flex-1 min-w-0 [overflow-wrap:anywhere] ${taskOverdue(row.value)?"text-[var(--danger-text)]":""}`}>{row.value.title}</span><span className="text-[12px] text-[var(--muted)]">{row.value.owner} · {fmtDate(row.value.dueDate)} {row.value.dueTime}{taskOverdue(row.value)?" · ATRASADA":""}</span>{row.value.status==="Aberta" ? <button onClick={()=>void setTaskStatus(row,"Concluída")} className="bg-[var(--green)] text-white font-bold text-[12px] px-3 py-2 rounded-xl">Concluir</button> : <span className="text-[12px] font-bold text-[var(--success-text)]">Concluída</span>}</li>)}</ul>
      </section>
      <section className="card p-5 mt-4" aria-label="Logbook da gerência">
        <h3 className="font-extrabold text-[18px]">Logbook da gerência</h3>
        <textarea value={auxForm.logText||""} onChange={e=>setAuxForm(p=>({...p,logText:e.target.value}))} placeholder="Registro do turno: ocorrências, decisões, visitas…" className="field mt-3 min-h-[72px]" aria-label="Texto do logbook" />
        <button onClick={()=>void saveLogbook()} className="mt-2 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3 text-[14px]">Salvar registro</button>
        <ul className="mt-4 space-y-2">{logbook.slice(0,12).map(row=><li key={row.id} className="border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><p className="text-[14px] [overflow-wrap:anywhere]">{row.value.text}</p><p className="text-[12px] text-[var(--muted)] mt-0.5">{fmtDate(row.value.date)} · {row.value.shift} · {row.value.author} {row.value.time}</p></li>)}</ul>
      </section>
      <section className="card p-5 mt-4" aria-label="Treinamentos">
        <h3 className="font-extrabold text-[18px]">Treinamentos</h3>
        <div className="flex flex-wrap gap-2 mt-3"><input value={auxForm.trainingTitle||""} onChange={e=>setAuxForm(p=>({...p,trainingTitle:e.target.value}))} placeholder="Treinamento" className="field flex-1 min-w-[160px]" aria-label="Título do treinamento" /><select value={auxForm.trainingPerson||""} onChange={e=>setAuxForm(p=>({...p,trainingPerson:e.target.value}))} className="field flex-1 min-w-[150px]" aria-label="Pessoa do treinamento"><option value="">Pessoa</option>{staffProfiles.map(p=><option key={p}>{p}</option>)}</select><button onClick={()=>void saveTraining()} className="bg-[var(--primary)] text-white font-extrabold rounded-2xl px-4 py-3 text-[13px]">Atribuir</button></div>
        <ul className="mt-4 space-y-2">{trainings.length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhum treinamento atribuído.</li> : trainings.map(row=><li key={row.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className="font-bold text-[14px] flex-1 min-w-0">{row.value.title} · {row.value.person}</span><span className="text-[12px] text-[var(--muted)]">{row.value.status}</span>{row.value.status!=="Aprovado" && <button onClick={()=>void setTrainingStatus(row,"Aprovado")} className="bg-[var(--green)] text-white font-bold text-[12px] px-3 py-2 rounded-xl">Aprovar</button>}</li>)}</ul>
      </section>
      <section className="card p-5 mt-6" aria-label="Conferência das produções">
        <h3 className="font-extrabold text-[18px]">Conferência das produções — {awaitingList.length} aguardando</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">Confira cada produção concluída. Se algo estiver errado, escreva a observação e peça correção — a equipe recebe no chat.</p>
        {awaitingList.length===0 ? <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">Nenhuma produção aguardando conferência.</p> : <ul className="mt-4 space-y-4">{awaitingList.map(s=>{
          const feitos = s.value.items.filter(i=>i.status==="Feito").length;
          const naoFeitos = s.value.items.filter(i=>i.status==="Não feito").length;
          const wrong = s.value.items.filter(i=>i.status==="Não feito");
          const obs = obsDrafts[s.id]||"";
          return <li key={s.id} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
            <p className="font-bold text-[16px] [overflow-wrap:anywhere]">{s.value.profile} · {s.value.section}</p>
            <p className="text-[13px] text-[var(--muted)] mt-1">{s.value.turno} · {feitos} feitos · {naoFeitos} não feitos · <span className="font-extrabold" style={{color:complianceColor(Math.round(feitos/Math.max(1,feitos+naoFeitos)*100))}}>{Math.round(feitos/Math.max(1,feitos+naoFeitos)*100)}% conformidade</span></p>
            {wrong.length>0 && <div className="mt-2 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] p-3"><p className="text-[12px] font-extrabold text-[var(--danger-strong)]">Itens marcados como não feitos</p><p className="text-[13px] mt-1 [overflow-wrap:anywhere]">{wrong.map(i=>ALL_ITEMS.find(x=>x.id===i.itemId)?.name||i.itemId).join(" · ")}</p></div>}
            <label className="block mt-3"><span className="text-[12px] font-bold text-[var(--muted)]">Observação (se houver algo errado)</span><textarea value={obs} onChange={e=>setObsDrafts(p=>({...p,[s.id]:e.target.value}))} placeholder="Ex.: ponto fora do padrão, etiqueta faltando…" className="field mt-1.5 min-h-[72px] !text-[14px]" /></label>
            <div className="flex flex-wrap gap-2 mt-3">
              <button disabled={saving} onClick={()=>void decideSubmission(s,"Aprovado","")} className="flex-1 min-w-[130px] bg-[var(--green)] text-white font-extrabold text-[13px] px-4 py-3 rounded-xl disabled:opacity-50">Aprovar</button>
              <button disabled={saving || !obs.trim()} onClick={()=>{ void decideSubmission(s,"Para corrigir",obs.trim()); setObsDrafts(p=>({...p,[s.id]:""})); }} className="flex-1 min-w-[180px] bg-[var(--danger)] text-white font-extrabold text-[13px] px-4 py-3 rounded-xl disabled:opacity-50">Enviar observação e pedir correção</button>
              <button onClick={()=>{setSelected(s.value.profile); setTab("chat"); setConversation(s.value.profile);}} className="bg-white text-black font-extrabold text-[13px] px-4 py-3 rounded-xl">Ver conversa →</button>
            </div>
          </li>;
        })}</ul>}
      </section>
      <section className="card p-5 mt-4">
        <h3 className="font-extrabold text-[18px]">Planos de Ação Pendentes: {pendingPlans.length}</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">Toda não-conformidade vira um plano de ação automático. Corrigir o item resolve o plano.</p>
        {pendingPlans.length===0 ? <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">Nenhum plano de ação pendente.</p> : <ul className="mt-4 space-y-4">{pendingPlans.map(p=>{
          const planAge = daysBetween(p.value.date, date);
          const isUrgent = planAge>1;
          return <li key={p.id} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0" style={isUrgent?{borderLeft:"3px solid #FF3B30",paddingLeft:"10px"}:{}}>
            {isUrgent && <span className="inline-block text-[12px] font-extrabold px-2.5 py-1 rounded-full bg-[var(--danger)] text-white">URGENTE — há {planAge} dias pendente</span>}
            <p className="font-bold text-[16px] [overflow-wrap:anywhere]">{p.value.itemName}</p>
            <p className="text-[13px] text-[var(--muted)] mt-1">Quem: {p.value.profile} · {p.value.section} · Prazo: {p.value.deadline}</p>
            <p className="text-[13px] mt-1 leading-relaxed [overflow-wrap:anywhere]">Motivo: {p.value.justificativa || "Sem justificativa registrada."}</p>
            <p className="text-[12px] font-extrabold mt-1 text-[var(--warning-text)]">Status: {p.value.status==="Devolvido" ? "Devolvido para corrigir" : "Pendente"}</p>
            {isManager && <div className="flex gap-2 mt-3"><button onClick={()=>resolvePlanDirect(p)} className="flex-1 bg-[var(--green)] text-white font-extrabold text-[13px] px-3 py-3 rounded-xl">Resolvido</button><button onClick={()=>devolverPlan(p)} className="flex-1 bg-[var(--danger-bg)] text-[var(--danger-strong)] font-extrabold text-[13px] px-3 py-3 rounded-xl">Devolver para corrigir</button></div>}
          </li>;
        })}</ul>}
        {resolvedPlans.length>0 && <div className="mt-4"><h4 className="font-bold text-[15px]">Resolvidos hoje: {resolvedPlans.length}</h4><ul className="mt-2 space-y-2">{resolvedPlans.map(p=><li key={p.id} className="text-[13px] text-[var(--muted)] [overflow-wrap:anywhere]">{p.value.itemName} — {p.value.profile} · Resolvido às {p.value.resolvedAt || ""}</li>)}</ul></div>}
      </section>
      {isManager && <section className="card p-5 mt-4" aria-label="Lista de Falta de Insumo">
        <h3 className="font-extrabold text-[18px]">Lista de Falta de Insumo</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">Automática: toda justificativa “Faltou insumo” entra aqui. Marcar como comprado tira da lista.</p>
        {openShortages.length===0 ? <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">Nenhuma falta hoje.</p> : <ul className="mt-4 space-y-4">{openShortages.map(s=><li key={s.id} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
          <p className="font-bold text-[16px] [overflow-wrap:anywhere]">{s.value.itemName}</p>
          <p className="text-[13px] text-[var(--muted)] mt-1">Quem pediu: {s.value.profile} · {fmtDate(s.value.date)} · {s.value.section}</p>
          <button onClick={()=>resolveShortage(s)} className="mt-3 bg-[var(--green)] text-white font-extrabold text-[13px] px-4 py-3 rounded-xl">Comprado / Resolvido</button>
        </li>)}</ul>}
      </section>}
      {isManager && <section className="card p-5 mt-4">
        <h3 className="font-extrabold text-[18px]">Horário do turno</h3>
        <ul className="mt-4 space-y-4">{people.map(p=>{ const sh = shiftFor(p,date); return <li key={p} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"><p className="font-bold text-[16px] [overflow-wrap:anywhere]">{p} · {stationMap[p]||""}</p><p className="text-[13px] text-[var(--muted)] mt-1">{!sh ? "Não iniciado" : sh.finishedAt ? `Iniciado ${sh.startedAt} • Concluído ${sh.finishedAt}` : `Iniciado ${sh.startedAt} • Em andamento`}</p>{sh && <p className="text-[12px] text-[var(--muted)]">por {sh.startedBy}{sh.finishedAt && sh.finishedBy ? ` • concluído por ${sh.finishedBy}` : ""}</p>}</li>; })}</ul>
      </section>}
      {isManager && <section className="card p-5 mt-4">
        <h3 className="font-extrabold text-[18px]">Atrasados hoje: {delayedList.list.length}</h3>
        {delayedList.list.length===0 ? <p className="text-sm text-[var(--muted)] mt-3 leading-relaxed">Ninguém atrasado no turno atual.</p> : <ul className="mt-4 space-y-4">{delayedList.list.map(p=><li key={p.person} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
          <p className="font-bold text-[16px] [overflow-wrap:anywhere]">{p.person}</p>
          <p className="text-[13px] text-[var(--muted)] mt-1">{delayedList.turnoCheck} · Faltam {p.faltam} itens{delayedList.overdueMinutes>0 ? ` · ${formatOverdue(delayedList.overdueMinutes)}` : ""}</p>
          <button onClick={()=>{setSelected(p.person); setTab("chat"); setConversation(p.person);}} className="mt-3 bg-white text-black font-extrabold text-[13px] px-4 py-3 rounded-xl">Ver conversa →</button>
        </li>)}</ul>}
      </section>}
      <section className="card p-4 mt-4">
        <button type="button" onClick={()=>setShowPrevious(!showPrevious)} aria-expanded={showPrevious} className="text-[13px] font-bold text-[var(--muted)]">{showPrevious ? "Ocultar anteriores ▲" : "Ver anteriores ▼"}</button>
        {showPrevious && <div className="mt-3">
          <label className="block"><span className="text-[13px] font-bold">Buscar no histórico</span><input value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Ex.: Laís ou 24/11" className="field mt-2" aria-label="Buscar no histórico por nome ou data" /></label>
          <h3 className="font-bold mt-4">Registros · {historyFiltered.length}</h3>
          <ul className="mt-3 space-y-1">{historyFiltered.map(s=>{
            const feitos = s.value.items.filter(i=>i.status==="Feito").length;
            const naoFeitos = s.value.items.filter(i=>i.status==="Não feito").length;
            const pctHist = Math.round(feitos/Math.max(1,feitos+naoFeitos)*100);
            return <li key={s.id} className="text-sm border-b border-[var(--line)] pb-3 pt-1 flex justify-between gap-2 items-start"><span className="min-w-0"><span className="font-bold text-[15px] block [overflow-wrap:anywhere]">{s.value.profile}</span><span className="block text-[12px] text-[var(--muted)] mt-0.5">{fmtDate(s.value.date)} · {s.value.section} · {s.value.turno} · {s.value.perfil}</span></span><span className="shrink-0 text-right text-[13px]"><b className="block">{feitos} feitos</b><span className="text-[var(--muted)]">{naoFeitos} não feitos</span><b className="block mt-1" style={{color:complianceColor(pctHist)}}>{pctHist}% conformidade</b><b className="block mt-1">{s.value.status==="Aguardando" ? "Aguardando" : s.value.status==="Aprovado" ? "Aprovado" : "Para corrigir"}</b></span></li>;
          })}</ul>
          {historyFiltered.length===0&&<p className="text-sm mt-2 text-[var(--muted)]">Sem registros.</p>}
        </div>}
      </section>
    </main>}

    {tab==="checklist" && !isManager && <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-[220px] tab-transition">
      {draftLabel && <div className="mt-5 p-3 rounded-2xl bg-[var(--success-bg)] border border-[var(--success-border)] text-sm font-semibold flex gap-2 items-center" role="status"><Check size={17} className="shrink-0 text-[var(--green)]"/>{draftLabel}<span className="text-[var(--muted)] font-normal">· Salvo automaticamente. Fecha e volta que está tudo aqui.</span></div>}
      <section className="mt-5 card p-5" aria-label="Minhas tarefas">
        <h3 className="font-extrabold text-[18px]">Minhas tarefas</h3>
        {tasks.filter(t=>t.value.owner===authUser && t.value.status==="Aberta" && taskApplies(t.value)).length===0 ? <p className="text-sm text-[var(--muted)] mt-3">Nenhuma tarefa pendente.</p> : <ul className="mt-3 space-y-2">{tasks.filter(t=>t.value.owner===authUser && t.value.status==="Aberta" && taskApplies(t.value)).map(row=><li key={row.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className={`font-bold text-[14px] flex-1 min-w-0 [overflow-wrap:anywhere] ${taskOverdue(row.value)?"text-[var(--danger-text)]":""}`}>{row.value.title}</span><span className="text-[12px] text-[var(--muted)]">{fmtDate(row.value.dueDate)} {row.value.dueTime}{taskOverdue(row.value)?" · ATRASADA":""}</span><button onClick={()=>void setTaskStatus(row,"Concluída")} className="bg-[var(--green)] text-white font-bold text-[12px] px-3 py-2 rounded-xl">Concluir</button></li>)}</ul>}
      </section>
      <section className="mt-4 card p-5" aria-label="Meus treinamentos">
        <h3 className="font-extrabold text-[18px]">Meus treinamentos</h3>
        {trainings.filter(t=>t.value.person===authUser).length===0 ? <p className="text-sm text-[var(--muted)] mt-3">Nenhum treinamento atribuído.</p> : <ul className="mt-3 space-y-2">{trainings.filter(t=>t.value.person===authUser).map(row=><li key={row.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><span className="font-bold text-[14px] flex-1 min-w-0">{row.value.title}</span><span className="text-[12px] font-bold">{row.value.status}</span>{row.value.status==="Pendente" && <button onClick={()=>void setTrainingStatus(row,"Concluído")} className="bg-white text-black font-bold text-[12px] px-3 py-2 rounded-xl">Marcar concluído</button>}</li>)}</ul>}
      </section>
      <section className="mt-4 card p-5" aria-label="Contagem de estoque">
        <h3 className="font-extrabold text-[18px]">Contagem de estoque</h3>
        {stockItems.length===0 ? <p className="text-sm text-[var(--muted)] mt-3">Nenhum item de estoque cadastrado pela gerência.</p> : <ul className="mt-3 space-y-3">{stockItems.map(r=>{ const last=stockCounts.filter(c=>c.value.item===r.value.item).sort((a,b)=>b.value.date.localeCompare(a.value.date)||b.value.time.localeCompare(a.value.time))[0]?.value; return <li key={r.id} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"><p className="font-bold text-[15px]">{r.value.item} <span className="text-[12px] font-normal text-[var(--muted)]">· esperado {r.value.expected||"—"} {r.value.unit}</span></p><div className="flex gap-2 mt-2"><input type="number" inputMode="decimal" value={auxForm[`count-${r.id}`]||""} onChange={e=>setAuxForm(p=>({...p,[`count-${r.id}`]:e.target.value}))} placeholder="Contado" className="field !mt-0" aria-label={`Contado ${r.value.item}`} /><button onClick={()=>void saveStockCount(r,auxForm[`count-${r.id}`]||"")} className="bg-[var(--primary)] text-white font-extrabold text-[12px] px-3 py-2 rounded-xl shrink-0">Salvar</button></div>{last && <p className="text-[12px] mt-1 text-[var(--muted)]">Última: {last.counted} · diferença <b className={last.difference!==0?"text-[var(--danger-text)]":"text-[var(--success-text)]"}>{last.difference>0?"+":""}{last.difference}</b></p>}</li>; })}</ul>}
      </section>
      <section className="mt-4 card p-5" aria-label="Recebimento de mercadorias">
        <h3 className="font-extrabold text-[18px]">Recebimento de mercadorias</h3>
        <div className="grid gap-3 mt-3 sm:grid-cols-2">
          <input value={auxForm.receivingItem||""} onChange={e=>setAuxForm(p=>({...p,receivingItem:e.target.value}))} placeholder="Item" className="field" aria-label="Item recebido" />
          <input value={auxForm.receivingSupplier||""} onChange={e=>setAuxForm(p=>({...p,receivingSupplier:e.target.value}))} placeholder="Fornecedor" className="field" aria-label="Fornecedor" />
          <input value={auxForm.receivingInvoice||""} onChange={e=>setAuxForm(p=>({...p,receivingInvoice:e.target.value}))} placeholder="Nota fiscal" className="field" aria-label="Nota fiscal" />
          <input value={auxForm.receivingExpected||""} onChange={e=>setAuxForm(p=>({...p,receivingExpected:e.target.value}))} placeholder="Esperado" className="field" aria-label="Quantidade esperada" />
          <input value={auxForm.receivingReceived||""} onChange={e=>setAuxForm(p=>({...p,receivingReceived:e.target.value}))} placeholder="Recebido" className="field" aria-label="Quantidade recebida" />
        </div>
        <button onClick={()=>void saveReceiving()} className="mt-3 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3 text-[13px]">Registrar recebimento</button>
        <ul className="mt-3 space-y-2">{receivings.filter(r=>r.value.date===date && r.value.profile===authUser).length===0 ? <li className="text-[13px] text-[var(--muted)]">Nenhum recebimento seu hoje.</li> : receivings.filter(r=>r.value.date===date && r.value.profile===authUser).map(r=><li key={r.id} className="border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"><p className="font-bold text-[14px]">{r.value.item} · {r.value.status}</p><p className="text-[12px] text-[var(--muted)]">{r.value.supplier||"—"} · nota {r.value.invoice||"—"} · {r.value.expectedQty||"—"} → {r.value.receivedQty||"—"}</p></li>)}</ul>
      </section>
      <section className="mt-4 card p-5" aria-label="Auditoria de qualidade">
        <h3 className="font-extrabold text-[18px]">Auditoria de qualidade</h3>
        {questions.filter(q=>activeSections.includes(q.value.section as Section)).length===0 ? <p className="text-sm text-[var(--muted)] mt-3">Nenhuma pergunta de auditoria para o seu posto.</p> : <ul className="mt-3 space-y-4">{questions.filter(q=>activeSections.includes(q.value.section as Section)).map(q=>{ const d=qualityDraft[q.id]||{}; const answered=qualityAnswers.some(a=>a.value.date===date&&a.value.questionId===q.id&&a.value.profile===authUser); return <li key={q.id} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"><p className="font-bold text-[15px]">{q.value.question}</p>{q.value.hint && <p className="text-[12px] text-[var(--muted)] mt-0.5">{q.value.hint}</p>}
          {q.value.referencePhoto && <div className="mt-2"><p className="text-[11px] font-bold text-[var(--muted)]">Padrão de referência</p><img src={q.value.referencePhoto} alt="Referência" className="w-24 h-24 object-cover rounded-xl border border-[var(--line)] mt-1" /></div>}
          {q.value.type==="check" && <div className="flex flex-wrap gap-2 mt-2">{(["Conforme","Parcial","Não conforme"] as const).map(v=><button key={v} type="button" onClick={()=>setQualityDraft(p=>({...p,[q.id]:{...p[q.id],verdict:v}}))} className={`chip ${d.verdict===v?"active":""}`}>{v}</button>)}</div>}
          {q.value.type==="photo" && <div className="mt-2"><PhotoField value={d.photo||""} onChange={data=>setQualityDraft(p=>({...p,[q.id]:{...p[q.id],photo:data}}))} label="Foto da auditoria" /></div>}
          {q.value.type==="temperature" && <input type="number" inputMode="decimal" value={d.temperature||""} onChange={e=>setQualityDraft(p=>({...p,[q.id]:{...p[q.id],temperature:e.target.value}}))} placeholder="°C" className="field mt-2" aria-label={`Temperatura ${q.value.question}`} />}
          {q.value.type==="text" && <textarea value={d.note||""} onChange={e=>setQualityDraft(p=>({...p,[q.id]:{...p[q.id],note:e.target.value}}))} placeholder="Descreva o que foi conferido" className="field mt-2 min-h-[64px]" aria-label={`Observação ${q.value.question}`} />}
          {q.value.type!=="text" && <textarea value={d.note||""} onChange={e=>setQualityDraft(p=>({...p,[q.id]:{...p[q.id],note:e.target.value}}))} placeholder="Observação (opcional)" className="field mt-2 min-h-[56px]" aria-label={`Observação ${q.value.question}`} />}
          <div className="flex items-center gap-2 mt-2"><button disabled={answered||readOnly} onClick={()=>void saveQualityAnswer(q)} className="bg-[var(--primary)] text-white font-extrabold text-[12px] px-3 py-2 rounded-xl disabled:opacity-50">Salvar resposta</button>{answered && <span className="text-[12px] font-bold text-[var(--success-text)]">✓ Respondido</span>}</div>
        </li>; })}</ul>}
      </section>
      <div className="[&>section]:mt-4">{sharedProductionSection()}</div>

      <section className="mt-5 card p-5">
        <div>
          <h2 className="font-extrabold leading-none tracking-tight text-[clamp(34px,9vw,42px)]">{dayLabel}</h2>
          <p className="text-[14px] font-bold text-[var(--muted)] mt-1.5">{fmtDate(date)}</p>
          {selected && !shifts[`${selected}|${date}`]?.value && <p className="text-[13px] text-[var(--muted)] mt-2">Não iniciado</p>}
          {selected && shifts[`${selected}|${date}`]?.value && <div className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]"><p>Iniciado às {shifts[`${selected}|${date}`]?.value.startedAt} — por {shifts[`${selected}|${date}`]?.value.startedBy}</p>{shifts[`${selected}|${date}`]?.value.finishedAt && <p>Concluído às {shifts[`${selected}|${date}`]?.value.finishedAt} — por {shifts[`${selected}|${date}`]?.value.finishedBy}</p>}</div>}
        </div>
        <button type="button" onClick={()=>setOnlyMissing(!onlyMissing)} aria-pressed={onlyMissing} className={`mt-4 w-full rounded-2xl py-3.5 text-[15px] font-extrabold pressable ${onlyMissing ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary-bg)] text-[var(--secondary-ink)]"}`}>{onlyMissing ? "✓ Só o que falta" : "Só o que falta"}</button>
        <button type="button" disabled={readOnly} onClick={()=>setQuickEntryOpen(true)} className="mt-2 w-full rounded-2xl border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] py-3.5 text-[14px] font-extrabold flex items-center justify-center gap-2 pressable"><Mic size={18}/> Falar ou anotar item</button>
        <div className="flex flex-col gap-4 mt-5">
          <div className="block"><span className="text-[13px] font-bold text-[var(--muted)] flex items-center gap-1"><CalendarDays size={14}/> Data</span><div className="mt-2 flex items-center gap-2" aria-label="Navegar entre dias"><button type="button" onClick={()=>setDate(addDays(date,-1))} className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--secondary-bg)] text-[var(--secondary-ink)] grid place-items-center shrink-0" aria-label="Dia anterior"><ChevronLeft size={20}/></button><div className="flex-1 grid grid-cols-2 gap-1.5" role="group" aria-label="Ontem ou hoje">{([["Ontem",addDays(today(),-1)],["Hoje",today()]] as const).map(([label,val])=>(<button key={label} type="button" onClick={()=>setDate(val)} className={`min-h-[44px] rounded-full text-[13px] sm:text-[14px] font-extrabold px-1 ${date===val ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary-bg)] text-[var(--secondary-ink)]"}`}>{label}</button>))}</div></div></div>
          {isManager ? <div className="grid grid-cols-2 gap-3 text-[13px]"><div className="rounded-xl bg-[var(--surface-2)] p-3"><span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Perfil</span><b>{perfil}</b></div><div className="rounded-xl bg-[var(--surface-2)] p-3"><span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Turno</span><b>{turno}</b></div></div> : <><label className="block"><span className="text-[13px] font-bold text-[var(--muted)]">Perfil</span><select className="field mt-2" value={perfil} onChange={e=>setPerfil(e.target.value)}><option>Fraco</option><option>Normal</option><option>Forte</option></select></label>
          <label className="block"><span className="text-[13px] font-bold text-[var(--muted)]">Turno</span><select className="field mt-2" value={turno} onChange={e=>setTurno(e.target.value)}><option>Manhã</option><option>Tarde</option><option>Noite</option></select></label></>}
        </div>
      </section>

      {latestHandover && <div className="mt-5 p-4 rounded-2xl bg-[var(--warning-bg)] border border-[var(--warning)] text-[var(--ink)]"><p className="font-extrabold text-[15px]">Recado do turno anterior</p><p className="text-[14px] leading-relaxed mt-1 [overflow-wrap:anywhere]">Recado do turno anterior — {latestHandover.profile} às {latestHandover.time}: {latestHandover.text}</p></div>}
      {isKioskSelected && <div className="mt-5 card p-4"><p className="font-extrabold text-[16px]">{turno==="Noite" ? "Fechamento — Reposição + Fechamento da Pista" : "Abertura — Produção + Montagem da Pista"}</p><p className="text-[12px] text-[var(--muted)] mt-1">{turno==="Noite" ? "Turno da noite · quiosque" : "Turno da manhã · quiosque"}</p></div>}
      {activeSections.map((sec)=>{
        const counts = countsForSection(sec);
        const sub = submissionForSection(sec);
        const locked = !!sub && (sub.value.status==="Aguardando" || sub.value.status==="Aprovado");
        const concluded = !!sub && (sub.value.status==="Aguardando" || sub.value.status==="Aprovado");
        const list = counts.list;
        const displayList = [...list].sort((a,b)=>{ const sa=entries[`${selected}|${date}|${a.id}`]?.value.status||""; const sb=entries[`${selected}|${date}|${b.id}`]?.value.status||""; return (sa==="Feito"?1:0)-(sb==="Feito"?1:0); }).filter(i=> !onlyMissing || (entries[`${selected}|${date}|${i.id}`]?.value.status||"")!=="Feito");
        const statusText = sub ? (sub.value.status==="Aguardando" ? "Aguardando conferência da Gerência no Chat" : sub.value.status==="Aprovado" ? "Aprovado pela Gerência" : "Para corrigir — ajuste os itens e conclua de novo") : "";
        const isPistaSection = ["Montagem da Pista - Fria","Montagem da Pista - Quente","Reposição da Pista - Fria","Reposição da Pista - Quente"].includes(sec);
        return <section key={sec} id={`secao-${sec}`} className="mt-8">
          <div className="sticky z-10 bg-[var(--bg)] py-2 -mx-1 px-1" style={{top:"calc(var(--safe-area-inset-top) + var(--header-h))"}}>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                {isPistaSection ? <button type="button" onClick={()=>setGuideOpen(prev=>({...prev,[sec]:!prev[sec]}))} aria-expanded={!!guideOpen[sec]} className="text-left"><h2 className="font-extrabold text-[20px] leading-tight">{displaySectionTitle(sec)} — {counts.done}/{counts.total} feitos <span className="text-[13px] font-extrabold text-[var(--warning-text)] whitespace-nowrap">{guideOpen[sec] ? "Ocultar mapa ▲" : "Ver mapa da pista ▸"}</span></h2></button> : <h2 className="font-extrabold text-[20px] leading-tight">{displaySectionTitle(sec)} — {counts.done}/{counts.total} feitos</h2>}
                {concluded && <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-extrabold text-[var(--success-text)]"><span className="check-pop inline-grid place-items-center w-4 h-4 rounded-full bg-[var(--green)] text-white"><Check size={11} strokeWidth={3}/></span> {sec} concluída</span>}
              </div>
            </div>
            {sec==="Produção" && !isKioskSelected && <div className="mt-3 segmented" role="group" aria-label="Periodicidade">{(["DIÁRIO","SEMANAL","MENSAL"] as const).map(p=><button key={p} type="button" aria-pressed={period===p} onClick={()=>setPeriod(p)}>{p}</button>)}</div>}
            <div className="mt-3 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden" role="progressbar" aria-label={`Progresso de ${sec}`} aria-valuenow={counts.total ? Math.round(counts.done/counts.total*100) : 0} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[var(--primary)] transition-all duration-300" style={{width:`${counts.total ? Math.round(counts.done/counts.total*100) : 0}%`}} /></div>
            {sub && <div className={`mt-2 p-3 rounded-2xl border text-[13px] ${sub.value.status==="Aprovado" ? "bg-[var(--success-bg)] border-[var(--success-border)]" : sub.value.status==="Para corrigir" ? "bg-[var(--warning-bg)] border-[var(--warning)]" : "bg-[var(--warning-bg)] border-[var(--warning)]"}`}><p className="font-extrabold text-[14px]">{sub.value.status==="Aprovado" ? "Aprovado pela Gerência" : sub.value.status==="Para corrigir" ? "Para corrigir" : "Aguardando conferência da Gerência no Chat"}</p><p className="text-[var(--muted)] mt-0.5 leading-relaxed">{statusText}</p>{sub.value.status==="Para corrigir" && sub.value.correctionNote && <p className="mt-1 [overflow-wrap:anywhere]">O que está errado: {sub.value.correctionNote}</p>}{locked && <button onClick={goToChatForCurrent} className="mt-2 bg-white text-black font-extrabold text-[13px] px-4 py-2.5 rounded-xl">Ir para o Chat →</button>}</div>}
          </div>
          {isPistaSection && guideOpen[sec] && <div className="mt-3 card p-5 border border-[var(--warning)]"><p className="font-extrabold text-[16px]">Mapa da pista — guia visual</p><p className="text-[12px] text-[var(--muted)] mt-1">Confira a posição de cada item antes de concluir.</p><ul className="mt-4 space-y-3">{PISTA_GUIDE.map(g=><li key={g.label} className="leading-relaxed"><span className="block text-[13px] font-extrabold tracking-wide text-[var(--warning-text)]">{g.label}</span><span className="block text-[17px] font-bold leading-snug mt-1 [overflow-wrap:anywhere]">{g.items}</span></li>)}</ul></div>}

          <div className="mt-3 space-y-4">
            {displayList.map((item,idx)=>{ const e=entryFor(item.id); const fs=freqStyle(item.freq); const feitoValue = e.status==="Não feito" ? 0 : toNonNegativeInt(e.feito); const feitoEnabled = e.status==="Feito"; const justText = justDraft[item.id] ?? e.justificativa ?? ""; const justPending = (e.status==="Não feito" || !!justOpen[item.id]) && !justText.trim(); const showJustBox = !readOnly && (e.status==="Não feito" || !!justOpen[item.id]); const deps = pendingDeps(item.id); const sug = suggestedFor(item); const needsPhoto = !!itemRules.find(r=>r.value.itemId===item.id)?.value.requirePhoto && !e.photo; return <article id={`item-${item.id}`} key={item.id} className={`card item-card p-5 sm:p-6 ${e.status==="Feito"?"is-done":e.status==="Não feito"?"is-miss":""}`} style={justPending?{background:"var(--danger-bg)",border:"2px solid var(--danger)"}:{}}>
              <div className="flex gap-3 items-start">
                <span className="w-9 h-9 shrink-0 rounded-full grid place-items-center font-extrabold text-sm bg-[var(--surface-inset)] border border-[var(--line)]">{String(idx+1).padStart(2,"0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 items-center"><span style={{background:fs.background,color:fs.color}} className="text-[11px] font-extrabold px-2.5 py-1 rounded-full">{fs.label}</span><span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${e.status==="Feito"?"bg-[var(--success-bg)] text-[var(--success-text)]":e.status==="Não feito"?"bg-[var(--danger-bg)] text-[var(--danger-text)]":"bg-[var(--surface-2)] text-[var(--muted)]"}`}>{e.status==="Feito" && <Check size={13} strokeWidth={3}/>} {statusLabel(e.status)}</span></div>
                  <h3 role="button" tabIndex={0} onClick={()=>setProductItem(item)} onKeyDown={ev=>{if(ev.key==="Enter") setProductItem(item);}} className="font-bold text-[21px] leading-snug mt-3 [overflow-wrap:anywhere] cursor-pointer hover:text-[var(--primary)]" title="Abrir ficha do produto"><span className={`strike-title ${e.status==="Feito"?"is-done":""}`}>{item.name}</span> <span className="text-[11px] font-bold text-[var(--muted)]">· ficha</span></h3>{item.detail&&<p className="text-[13px] text-[var(--muted)] mt-1 leading-relaxed">{item.detail}</p>}{instructions.find(i=>i.value.itemId===item.id)?.value?.text && <p className="mt-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] p-3 text-[13px] leading-relaxed [overflow-wrap:anywhere]">📋 {instructions.find(i=>i.value.itemId===item.id)!.value.text}</p>}
                  {(!isKioskSelected || item.section==="Produção do Quiosque") && <p className="text-[12px] text-[var(--muted)] mt-2 leading-relaxed"><span className="font-bold tracking-wide">A PRODUZIR</span> · <span className="[overflow-wrap:anywhere]">{item.target}</span></p>}
                  {deps.length>0 && <p className="mt-2 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning)] p-3 text-[13px] font-bold">⚠️ Faça antes: {deps.map(d=>d.name).join(" · ")}</p>}
                  {needsPhoto && <p className="mt-2 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning)] p-3 text-[13px] font-bold">📷 Foto obrigatória neste item</p>}
                  {sug && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[12px] font-bold text-[var(--muted)]">📈 Sugestão: {sug.value} un. ({sug.days} dias iguais)</span><button type="button" disabled={saving||locked||readOnly||!feitoEnabled} onClick={()=>void saveFeito(item,String(sug.value))} className="bg-[var(--surface-2)] border border-[var(--line)] text-[12px] font-extrabold px-3 py-2 rounded-xl disabled:opacity-50">Usar</button></div>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4" role="group" aria-label={`Status de ${item.name}`}>{(["Feito","Não feito"] as const).map(s=><button key={s} disabled={saving||locked||readOnly||(s==="Feito"&&(deps.length>0||needsPhoto))} onClick={()=>{ haptic(); setStatus(item,s); }} className={`status-btn inline-flex items-center justify-center gap-1.5 ${e.status===s?"active":""}`} style={e.status===s?{background:s==="Feito"?"var(--green)":"var(--danger)"}:{}}>{s==="Feito"?<Check size={17} strokeWidth={3}/>:<X size={17} strokeWidth={3}/>} {s}</button>)}</div>
              {(!isKioskSelected || item.section==="Produção do Quiosque") && <div className="mt-4">
                <span className="text-[13px] font-bold text-[var(--muted)]">FEITO</span><Stepper value={feitoValue} disabled={!feitoEnabled||locked||readOnly} label={`Quantidade feita de ${item.name}`} onChange={(n)=>saveFeito(item,String(n))} />{!feitoEnabled && <p className="text-[12px] text-[var(--muted)] mt-1.5">{e.status==="Não feito" ? "Travado em 0 — item marcado como Não feito." : "Marque Feito para liberar a quantidade."}</p>}
              </div>}
              <PhotoField label="Foto como prova" value={e.photo||""} onChange={(dataUrl)=>{ const prev=e.photo||""; void savePhoto(item,dataUrl,{silent:true}).then(()=>{ setToast(dataUrl?{text:"Foto salva neste item."}:{text:"Foto excluída.",undo:prev?()=>void savePhoto(item,prev,{silent:true}):undefined}); }); }} onPreview={(src)=>setPhotoViewer({src,label:item.name,onDelete:()=>{ const prev=e.photo||""; void savePhoto(item,"",{silent:true}); setPhotoViewer(null); setToast({text:"Foto excluída.",undo:prev?()=>void savePhoto(item,prev,{silent:true}):undefined}); }})} disabled={locked||readOnly} />
              {showJustBox && <div className="mt-4 rounded-2xl border-2 border-[var(--danger)] bg-[var(--danger-bg)] p-4"><label className="text-[15px] font-extrabold text-[var(--danger-text)]">Por que não foi feito?</label><textarea aria-label={`Por que não foi feito? ${item.name}`} className="field mt-3" style={{borderColor:"#FF3B30",minHeight:"110px"}} rows={4} value={justText} readOnly={readOnly} onChange={ev=>handleJustificationChange(item,ev.target.value)} placeholder="Ex.: Acabou o salmão, faltou insumo, equipamento quebrou..."/><div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Motivos rápidos">{(item.section==="Produção do Quiosque" || !isKioskSelected ? QUICK_REASONS : ["Já foi montado","Faltou insumo","Sem tempo / pico","Outro"]).map(r=><button key={r} type="button" disabled={readOnly} onClick={()=>applyQuickReason(item,r)} className={`chip !py-2 !px-3 text-[12px] ${justText===r?"active":""}`}>{r}</button>)}</div><div className="mt-3 flex items-center justify-between gap-2"><p className="text-[12px] text-[var(--danger-text)] font-semibold">Justificativa obrigatória para concluir</p></div>{justSaving[item.id] && <p className="text-[12px] text-[var(--muted)] mt-2">Salvando justificativa…</p>}{!justSaving[item.id] && justSaved[item.id] && justText.trim() && <p className="text-[12px] font-bold text-[var(--success-text)] mt-2">✓ Justificativa salva</p>}
              </div>}
            </article>; })}
            {displayList.length===0 && <div className="card p-6 text-center">{onlyMissing ? "Nada faltando aqui." : "Nenhum item encontrado."}</div>}
          </div>

          {/* Concluir fixo embaixo */}
        </section>;
      })}

      <section className="card p-5 mt-8" aria-label="Limpeza / Organização — Semanal">
        <button type="button" onClick={()=>setWeeklyOpen(!weeklyOpen)} aria-expanded={weeklyOpen} className="w-full flex items-center justify-between gap-2 text-left"><span><span className="font-extrabold text-[18px] block">Limpeza / Organização — Semanal</span><span className="text-[13px] text-[var(--muted)] block mt-1">Semanal — concluir até Domingo · {weeklyDoneCount}/{WEEKLY_ITEMS.length} feitos</span></span><span className="text-[18px] shrink-0">{weeklyOpen ? "▾" : "▸"}</span></button>
        {weeklySubForWeek && <p className="mt-3 p-3 rounded-2xl bg-[var(--success-bg)] border border-[var(--success-border)] text-[13px] font-bold">✓ Limpeza Semanal enviada — {weeklySubForWeek.value.items.filter(i=>i.status==="Feito").length}/{WEEKLY_ITEMS.length} para a semana até {fmtDate(weeklySubForWeek.value.weekKey)}.</p>}
        {weeklyOpen && <div className="mt-4">
          <p className="text-[13px] text-[var(--muted)] leading-relaxed">Não trava a conclusão do checklist diário. Só Feito / Não feito, sem quantidade.</p>
          {(["Cozinha","Quiosque","Copa"] as const).map(group=><div key={group} className="mt-5"><h3 className="font-extrabold text-[15px] text-[var(--warning-text)] tracking-wide">{group.toUpperCase()}</h3><div className="mt-3 space-y-3">{WEEKLY_ITEMS.filter(i=>i.group===group).map(item=>{ const st = weeklyEntryFor(item.id).status; return <div key={item.id} className="border-b border-[var(--line)] pb-3"><p className="font-bold text-[16px] leading-snug [overflow-wrap:anywhere]">{item.name}</p><div className="grid grid-cols-2 gap-2 mt-2" role="group" aria-label={`Status semanal de ${item.name}`}>{(["Feito","Não feito"] as const).map(s=><button key={s} disabled={weeklySaving||readOnly} onClick={()=>setWeeklyStatus(item,s)} className={`status-btn ${st===s?"active":""}`} style={st===s?{background:s==="Feito"?"var(--green)":"#FF3B30"}:{}}>{s}</button>)}</div></div>; })}</div></div>)}
          <p className="text-[13px] text-[var(--muted)] mt-4">{weeklyMarkedCount}/{WEEKLY_ITEMS.length} marcados</p>
          <button disabled={weeklySaving || readOnly || weeklyMarkedCount<WEEKLY_ITEMS.length} onClick={completeWeekly} className="w-full mt-3 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[15px] disabled:opacity-50">{weeklySaving ? "Enviando…" : "Concluir semanal"}</button>
        </div>}
      </section>

      <section className="card p-5 mt-8" aria-label="Validade / Vencimento">
        <button type="button" onClick={()=>setValidityOpen(!validityOpen)} aria-expanded={validityOpen} className="w-full flex items-center justify-between gap-2 text-left"><span><span className="font-extrabold text-[18px] block">Validade / Vencimento</span><span className="text-[13px] text-[var(--muted)] block mt-1">Registre produtos perto do vencimento. Produto vencido cria plano de ação automático.</span></span><span className="text-[18px] shrink-0">{validityOpen ? "▾" : "▸"}</span></button>
        {validityOpen && <div className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-[13px] font-bold">Produto</span><input value={expiryProduct} onChange={e=>setExpiryProduct(e.target.value)} placeholder="Ex.: Salmão fresco" className="field mt-2" aria-label="Produto" /></label>
            <label className="block"><span className="text-[13px] font-bold">Data de validade</span><input type="date" value={expiryDateInput} onChange={e=>setExpiryDateInput(e.target.value)} className="field mt-2" aria-label="Data de validade" /></label>
          </div>
          <button disabled={expirySaving || !expiryProduct.trim() || !expiryDateInput} onClick={registerExpiry} className="w-full mt-3 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[15px] disabled:opacity-50">{expirySaving ? "Registrando…" : "Registrar"}</button>
          {myExpiries.length>0 && <ul className="mt-4 space-y-3">{myExpiries.map((v,i)=>{ const diff = daysBetween(date, v.expiryDate); const isExpired = diff<0; return <li key={`${v.product}-${v.expiryDate}-${i}`} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"><p className="font-bold text-[16px] [overflow-wrap:anywhere]">{v.product}</p><p className="text-[13px] text-[var(--muted)] mt-1">Validade: {fmtDate(v.expiryDate)} · Registrado por {v.profile}</p><span className="inline-block mt-2 text-[12px] font-extrabold px-2.5 py-1 rounded-full" style={{background: isExpired || diff<=3 ? "var(--danger-bg)" : "var(--surface-2)", color: isExpired || diff<=3 ? "var(--danger-text)" : "var(--muted)"}}>{isExpired ? "Vencido" : diff===0 ? "Vencendo hoje" : diff<=3 ? `Vencendo em ${diff} dias` : "Dentro da validade"}</span></li>; })}</ul>}
        </div>}
      </section>

      <section className="card p-5 mt-8" aria-label="Manutenção">
        <button type="button" onClick={()=>setMaintOpen(!maintOpen)} aria-expanded={maintOpen} className="w-full flex items-center justify-between gap-2 text-left"><span><span className="font-extrabold text-[18px] block">Manutenção</span><span className="text-[13px] text-[var(--muted)] block mt-1">Só Feito / Não feito. Não trava o checklist diário.</span></span><span className="text-[18px] shrink-0">{maintOpen ? "▾" : "▸"}</span></button>
        {maintOpen && <div className="mt-4 space-y-4">{MAINT_ITEMS.map(item=>{ const st = maintEntryFor(item.id).status; const noteText = maintNoteDraft[item.id] ?? maintEntryFor(item.id).note ?? ""; return <div key={item.id} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"><p className="font-bold text-[16px] leading-snug [overflow-wrap:anywhere]">{item.name}</p><div className="grid grid-cols-2 gap-2 mt-3" role="group" aria-label={`Status de manutenção de ${item.name}`}>{(["Feito","Não feito"] as const).map(s=><button key={s} type="button" disabled={readOnly} onClick={()=>setMaintStatus(item,s)} className={`status-btn ${st===s?"active":""}`} style={st===s?{background:s==="Feito"?"var(--green)":"#FF3B30"}:{}}>{s}</button>)}</div>{st==="Não feito" && <label className="block mt-3"><span className="text-[13px] font-bold">Equipamento com problema?</span><input value={noteText} disabled={readOnly} onChange={e=>handleMaintNoteChange(item,e.target.value)} placeholder="Descreva o problema…" className="field mt-2" aria-label={`Equipamento com problema? ${item.name}`} /></label>}</div>; })}</div>}
      </section>

      <section className="card p-5 mt-8" aria-label="Temperaturas">
        <button type="button" onClick={()=>setTempOpen(!tempOpen)} aria-expanded={tempOpen} className="w-full flex items-center justify-between gap-2 text-left"><span className="font-extrabold text-[18px]">Line check de temperatura (opcional)</span><span className="text-[18px] shrink-0">{tempOpen ? "▾" : "▸"}</span></button>
        {tempOpen && <div>
        <div className="grid gap-4 mt-4 sm:grid-cols-2">
          <label className="block"><span className="text-[13px] font-bold">Temp. Câmara Fria</span><span className="text-[12px] text-[var(--muted)]"> · faixa {friaLim.min}–{friaLim.max} °C</span><div className="flex items-center gap-2 mt-2"><input inputMode="decimal" value={tempFria} disabled={readOnly} onChange={e=>handleTempChange("fria",e.target.value)} placeholder="Ex.: 3" className="field !mt-0" aria-label="Temp. Câmara Fria em graus Celsius"/><span className="font-extrabold text-[16px] shrink-0">°C</span></div></label>
          <label className="block"><span className="text-[13px] font-bold">Temp. Freezer</span><span className="text-[12px] text-[var(--muted)]"> · faixa {freezerLim.min} a {freezerLim.max} °C</span><div className="flex items-center gap-2 mt-2"><input inputMode="decimal" value={tempFreezer} disabled={readOnly} onChange={e=>handleTempChange("freezer",e.target.value)} placeholder="Ex.: -18" className="field !mt-0" aria-label="Temp. Freezer em graus Celsius"/><span className="font-extrabold text-[16px] shrink-0">°C</span></div></label>
        </div>
        {anyTempOut && <p role="alert" className="mt-4 p-3 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning)] text-[var(--warning-text)] text-sm font-bold leading-relaxed">⚠️ Temperatura fora da faixa - avisar Gerência{friaOut ? " · Câmara Fria fora de 0–5 °C" : ""}{freezerOut ? " · Freezer fora de abaixo de -12 °C" : ""}</p>}
        {tempSaving && <p className="text-[12px] text-[var(--muted)] mt-2">Salvando temperatura…</p>}
        </div>}
      </section>

      {!isManager && <section className="card p-5 mt-8" aria-label="Ocorrência">
        <button type="button" onClick={()=>setOccurrenceOpen(!occurrenceOpen)} aria-expanded={occurrenceOpen} className="w-full flex items-center justify-between gap-2 text-left"><span className="font-extrabold text-[18px]">Registrar ocorrência</span><span className="text-[18px] shrink-0">{occurrenceOpen ? "▾" : "▸"}</span></button>
        {occurrenceOpen && <div>
          <label className="block mt-4"><span className="text-[13px] font-bold">O que aconteceu?</span><textarea value={occurrenceText} onChange={e=>setOccurrenceText(e.target.value)} placeholder="Descreva o que aconteceu…" className="field mt-2" rows={3} aria-label="O que aconteceu?" /></label>
          <div className="flex gap-2 mt-3"><button type="button" onClick={()=>{setOccurrenceOpen(false); setOccurrenceText("");}} className="flex-1 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold py-3 rounded-xl">Cancelar</button><button type="button" disabled={!occurrenceText.trim() || occurrenceSending} onClick={sendOccurrence} className="flex-1 bg-[var(--danger)] text-white font-extrabold py-3 rounded-xl disabled:opacity-50">{occurrenceSending ? "Enviando…" : "Enviar para Gerência"}</button></div>
          <p className="text-[12px] text-[var(--muted)] mt-2">A ocorrência vai para o Chat e não trava a conclusão.</p>
        </div>}
      </section>}
    </main>}

    {tab==="modules" && <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-[160px] tab-transition">
      <div className="mt-6"><p className="text-[13px] font-bold tracking-wide uppercase text-[var(--muted)]">Módulos conectados</p><h2 className="font-extrabold text-[26px] leading-tight mt-1">Todos os módulos</h2><p className="text-[14px] text-[var(--muted)] mt-2 leading-relaxed">Cada lista abaixo lê e salva no mesmo backend de registros do app. Ao abrir, tudo é carregado de novo. Foto por item: em “Itens do checklist” use o campo Foto para tirar uma foto ou escolher uma da galeria, com opção de excluir.</p></div>
      {missingCollections.length>0 && <div role="alert" className="mt-4 p-4 rounded-2xl bg-[var(--warning-bg)] border border-[var(--warning)] text-sm leading-relaxed">{missingCollections.map(c=><p key={c} className="font-bold">tabela {c} não encontrada</p>)}<p className="text-[var(--muted)] mt-1">Os outros módulos continuam funcionando normalmente.</p></div>}
      <div className="flex flex-wrap gap-2 mt-5" role="group" aria-label="Escolher módulo">{MODULES_META.filter(m=>["checklists","checklist_items","task_templates","dojo_credentials","dojo_item_instructions"].includes(m.key)).map(m=><button key={m.key} type="button" onClick={()=>{setModuleTab(m.key); resetModuleForm(); setModuleMsg("");}} className={`chip ${moduleTab===m.key?"active":""}`}>{m.label} · {moduleRowsFor(m.key).length}</button>)}</div>
      <section className="card p-5 mt-4" aria-label={moduleMetaFor(moduleTab).label}>
        <h3 className="font-extrabold text-[18px]">{moduleMetaFor(moduleTab).label}</h3>
        <p className="text-[13px] text-[var(--muted)] mt-1">{moduleRowsFor(moduleTab).length} registro(s) carregado(s) · coleção: {moduleMetaFor(moduleTab).collection}{moduleErrors[moduleMetaFor(moduleTab).collection] ? ` · ${moduleErrors[moduleMetaFor(moduleTab).collection]}` : ""}</p>
        {isManager ? <div className="grid gap-4 mt-4 sm:grid-cols-2">{moduleMetaFor(moduleTab).fields.map(f=> f.key==="photo" ? <div key={f.key}><span className="text-[13px] font-bold">{f.label}</span><PhotoField label={f.label} value={moduleForm[f.key]||""} onChange={(dataUrl)=>setModuleForm(prev=>({...prev,[f.key]:dataUrl}))} />{f.hint && <span className="block text-[12px] text-[var(--muted)] mt-1 leading-relaxed">{f.hint}</span>}</div> : <label key={f.key} className="block"><span className="text-[13px] font-bold">{f.label}</span><input value={moduleForm[f.key]||""} onChange={e=>setModuleForm(prev=>({...prev,[f.key]:e.target.value}))} placeholder={f.placeholder||""} className="field mt-2" aria-label={f.label} />{f.hint && <span className="block text-[12px] text-[var(--muted)] mt-1 leading-relaxed">{f.hint}</span>}</label>)}</div> : <p className="text-[13px] text-[var(--muted)] mt-3 leading-relaxed">Somente leitura — somente a Gerência inclui e edita módulos.</p>}
        {isManager && <div className="flex gap-2 mt-4"><button disabled={moduleSaving} onClick={saveModuleRecord} className="flex-1 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-3.5 text-[15px] disabled:opacity-50">{moduleSaving ? "Salvando…" : moduleEditingId ? "Salvar edição" : "Criar registro"}</button>{moduleEditingId && <button onClick={resetModuleForm} className="flex-1 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold rounded-2xl py-3.5 text-[14px]">Cancelar edição</button>}</div>}
        {moduleMsg && <p role="status" className="mt-3 text-[13px] font-bold">{moduleMsg}</p>}
        <ul className="mt-5 space-y-4">{moduleRowsFor(moduleTab).length===0 ? <li className="text-sm text-[var(--muted)] leading-relaxed">Nenhum registro neste módulo ainda. Crie o primeiro acima.</li> : moduleRowsFor(moduleTab).map(row=>{ const v:any=row.value||{}; const summary = moduleMetaFor(moduleTab).fields.filter(f=>f.key!=="photo").map(f=>v[f.key]).filter(Boolean).join(" · ") || "Registro"; return <li key={row.id} className="border-b border-[var(--line)] pb-4 last:border-0 last:pb-0"><p className="font-bold text-[15px] leading-snug [overflow-wrap:anywhere]">{summary}</p>{typeof v.photo==="string" && v.photo.startsWith("data:image/") && <div className="mt-2 flex items-start gap-2"><button type="button" onClick={()=>setPhotoViewer({src:v.photo,label:summary,onDelete:()=>{void deleteRecordPhoto(row);setPhotoViewer(null);}})} className="photo-thumb w-24 h-24" aria-label={`Ampliar foto de ${summary}`}><img src={v.photo} alt="Foto do item" className="w-full h-full object-cover" /></button>{isManager && <button type="button" disabled={moduleSaving} onClick={()=>deleteRecordPhoto(row)} className="bg-[var(--danger)] text-white font-bold py-2 px-3 rounded-xl text-[12px] disabled:opacity-50 pressable"><Trash2 size={13} className="inline mr-1" />Excluir foto</button>}</div>}{v.photo_url && typeof v.photo_url==="string" && v.photo_url.startsWith("http") && <p className="mt-2 text-[13px]"><a href={v.photo_url} target="_blank" rel="noopener">Ver foto (link)</a></p>}{moduleConfirmDelete===row.id ? <div className="mt-3 p-3 rounded-xl bg-[var(--danger-bg)]"><p className="text-[13px] font-bold">Excluir este registro?</p><div className="flex gap-2 mt-2"><button onClick={()=>deleteModuleRecord(row)} className="flex-1 bg-[var(--danger)] text-white font-bold py-2.5 rounded-xl text-[13px]">Excluir</button><button onClick={()=>setModuleConfirmDelete(null)} className="flex-1 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold py-2.5 rounded-xl text-[13px]">Manter</button></div></div> : (isManager ? <div className="flex gap-2 mt-3"><button onClick={()=>startModuleEdit(row)} className="flex-1 bg-white text-black font-extrabold text-[13px] px-3 py-2.5 rounded-xl">Editar</button><button onClick={()=>setModuleConfirmDelete(row.id)} className="flex-1 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold text-[13px] px-3 py-2.5 rounded-xl">Excluir</button></div> : null)}</li>; })}</ul>
      </section>
      <section className="card p-5 mt-4"><h3 className="font-extrabold text-[18px]">Foto por item</h3><p className="text-[14px] text-[var(--muted)] mt-2 leading-relaxed">Crie ou edite um item em “Itens do checklist” e use o campo Foto: tire uma foto com a câmera ou escolha uma da galeria. A foto aparece como miniatura no item e pode ser excluída pelo botão “Excluir foto”. O campo Link da foto (photo_url) continua opcional para fotos de referência.</p></section>
    </main>}

    {tab==="chat" && !conversation && <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-[140px] tab-transition">
      <div className="mt-5 overflow-hidden rounded-[20px] border border-[var(--line)]">
        <div className="bg-[#075E54] px-4 py-4 flex items-center gap-3"><span className="w-10 h-10 rounded-full grid place-items-center text-white font-extrabold bg-white/20 shrink-0">D</span><div className="min-w-0 flex-1 leading-tight"><h2 className="font-extrabold text-[18px] text-white truncate">Dojo — Chat da Equipe</h2><p className="text-[12px] text-white/80 flex items-center gap-1"><Lock size={11}/> Online</p></div><span className="ml-auto text-white/80 text-sm font-bold shrink-0">{visibleMessageCount} mensagens</span></div>
        <div className="bg-[#111B21]">
          <div className="px-4 pt-4 pb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8696A0] flex items-center gap-1.5"><Users size={12}/> Grupos da operação</div>
          {conversations.filter(c=>c.kind==="group").map(c=>{ const lastText=c.last?.value.text||"Nenhuma mensagem ainda."; const preview=lastText.length>62?lastText.slice(0,62)+"…":lastText; return <button key={c.id} onClick={()=>setConversation(c.id)} className="w-full text-left flex gap-3 px-4 py-3.5 border-b border-white/5 hover:bg-white/5 transition items-center">
            <span className="w-12 h-12 shrink-0 rounded-full grid place-items-center text-white font-extrabold" style={{background:"#0F766E"}}><Users size={20}/></span>
            <span className="min-w-0 flex-1"><span className="flex justify-between gap-2 items-baseline"><span className="font-bold text-[16px] truncate text-white flex items-center gap-1.5">{c.name}{c.badge && <span className="text-[10px] font-extrabold uppercase tracking-wide bg-white/15 text-white/80 rounded-full px-1.5 py-0.5">{c.badge}</span>}</span><span className="text-[12px] text-[#8696A0] shrink-0">{c.last?.value.time||""}</span></span><span className="flex gap-1 items-center mt-0.5"><span className="text-[13px] text-[#8696A0] truncate">{preview}</span></span><span className="text-[12px] text-[#8696A0] truncate block mt-0.5">{c.subtitle} · {c.members} pessoas</span></span>
          </button>; })}
          <div className="px-4 pt-4 pb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8696A0]">Conversas</div>
          {conversations.filter(c=>c.kind==="dm").map(c=>{ const lastText = c.last?.value.text||"Nenhuma mensagem ainda."; const preview = lastText.length>62?lastText.slice(0,62)+"…":lastText; return <button key={c.id} onClick={()=>setConversation(c.id)} className="w-full text-left flex gap-3 px-4 py-3.5 border-b border-white/5 hover:bg-white/5 transition items-center">
            <span className="w-12 h-12 shrink-0 rounded-full grid place-items-center text-white font-extrabold" style={{background:avatarColor(c.name)}}>{initials(c.name)}</span>
            <span className="min-w-0 flex-1"><span className="flex justify-between gap-2 items-baseline"><span className="font-bold text-[16px] truncate text-white">{c.name}</span><span className="text-[12px] text-[#8696A0] shrink-0">{c.last?.value.time||""}</span></span><span className="flex gap-1 items-center mt-0.5"><span className="text-[13px] text-[#8696A0] truncate">{preview}</span></span><span className="text-[12px] text-[#8696A0] truncate block mt-0.5">{c.subtitle}</span></span>
          </button>; })}
          {conversations.length===0 && <div className="p-6 text-center text-sm text-[#8696A0]">Nenhuma conversa encontrada.</div>}
        </div>
      </div>
    </main>}

    {tab==="chat" && conversation && activeConvo && <main className="fixed inset-0 z-40 flex flex-col bg-[#ECE5DD] pt-[max(0px,var(--safe-area-inset-top))]">
      <div className="bg-[#075E54] px-2 sm:px-4 py-2.5 flex items-center gap-2 shrink-0">
        <button onClick={()=>setConversation(null)} className="p-2 text-white" aria-label="Voltar para conversas"><ChevronLeft size={22}/></button>
        <span className="w-10 h-10 rounded-full grid place-items-center text-white font-extrabold shrink-0" style={{background:avatarColor(activeConvo.name)}}>{initials(activeConvo.name)}</span>
        <div className="min-w-0 flex-1 leading-tight"><div className="font-bold text-white truncate">{activeConvo.kind==="group" ? `${activeConvo.name} · Grupo` : "Dojo — Chat da Equipe"}</div><div className="text-[12px] text-white/85 truncate flex items-center gap-1">{activeConvo.kind==="group" ? `${activeConvo.members} pessoas · Online` : `${activeConvo.name} · Online`} <Lock size={11}/></div></div>
      </div>
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-2" style={{backgroundColor:"#ECE5DD",backgroundImage:"radial-gradient(rgba(7,94,84,.08) 1px, transparent 1px)",backgroundSize:"20px 20px"}}>
        <div className="flex justify-center"><span className="bg-white text-[#667781] text-[12px] px-3 py-1.5 rounded-lg shadow-sm">Hoje · {fmtDate(date)}</span></div>
        {convoMessages.length===0 && <div className="text-center text-sm text-[#667781] bg-white rounded-2xl rounded-tl-[2px] p-5 mx-auto max-w-md mt-4 shadow-sm">Nenhuma mensagem ainda. Conclua uma seção para enviar ao chat ou escreva abaixo.</div>}
        {convoMessages.map(m=>{
          const isMine = m.value.sender===authUser;
          const isChecklist = m.value.text.startsWith("✅ Checklist concluído") || m.value.text.startsWith("✅ Checklist corrigido");
          const isCorrection = m.value.text.startsWith("🔁");
          const isOccurrence = m.value.text.startsWith("⚠️ OCORRÊNCIA") || m.value.text.startsWith("⚠️ ALERTA");
          const isHandover = m.value.text.startsWith("📋");
          const isSystem = isChecklist || isCorrection || isOccurrence || isHandover || m.value.text.startsWith("🧹") || m.value.text.startsWith("⚠️");
          const parsed = isChecklist ? parseChecklist(m.value.text) : null;
          const bubbleBg = isOccurrence ? "#FDECEA" : isHandover ? "#FFF3CD" : isSystem ? "#FFFFFF" : isMine ? "#D9FDD3" : "#FFFFFF";
          const bubbleShape = isMine && !isSystem ? "rounded-2xl rounded-tr-[2px]" : "rounded-2xl rounded-tl-[2px]";
          return <div key={m.id} className={`flex ${isMine && !isSystem ?"justify-end":"justify-start"}`}>
            <div className={`max-w-[86%] sm:max-w-[72%] px-3 py-2.5 shadow-sm ${bubbleShape}`} style={{backgroundColor:bubbleBg}}>
              {!isMine && <div className="text-[13px] font-extrabold" style={{color:"#075E54"}}>{m.value.sender}</div>}
              {isMine && <div className="text-[13px] font-extrabold" style={{color:"#075E54"}}>Você</div>}
              {m.value.audio ? <div className="mt-1"><audio controls src={m.value.audio} preload="metadata" className="w-full max-w-[260px] h-[42px]" aria-label={`Áudio de ${m.value.sender}`} /><p className="text-[12px] text-[#667781] mt-1">{m.value.text}</p></div> : <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] mt-0.5 text-[#111B21]">{m.value.text}</p>}
              {isChecklist && parsed && isManager && activeConvo.kind!=="group" && <div className="flex gap-2 mt-3"><button disabled={saving} onClick={()=>approveChecklist(m.value.text)} className="flex-1 bg-[#075E54] text-white text-[13px] font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"><ThumbsUp size={15}/> Aprovar</button><button disabled={saving} onClick={()=>{setReproveFor({text:m.value.text,person:parsed.person,sectionText:parsed.sectionText}); setReproveNote("");}} className="flex-1 bg-white text-[var(--danger-strong)] border border-[var(--danger-border)] text-[13px] font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"><ThumbsDown size={15}/> Pedir correção</button></div>}
              <div className="flex justify-end items-center gap-1 mt-1 flex-wrap">
                <span className="text-[11px] text-[#667781]">{m.value.time}</span>
                {isMine && (reads.filter(r=>r.value.messageId===m.id).length>0
                  ? <span className="text-[11px] font-bold text-[#075E54]">Lido por {Array.from(new Set(reads.filter(r=>r.value.messageId===m.id).map(r=>r.value.profile))).join(", ")}</span>
                  : <span className="text-[12px] font-bold text-[#53BDEB]" aria-label="Entregue">✓✓</span>)}
                {m.value.sender==="Gerência" && !isMine && reads.some(r=>r.value.messageId===m.id && r.value.profile===authUser) && <span className="text-[11px] font-bold text-[#075E54]">✓ Lido</span>}
              </div>
            </div>
          </div>;
        })}
      </div>
      <div ref={chatEndRef} aria-hidden="true" />
      {reproveFor && <div className="bg-[#F0F2F5] px-4 py-3 shrink-0 border-t border-black/10"><p className="font-bold text-[#111B21] text-[14px]">Pedir correção — {reproveFor.person} · {reproveFor.sectionText}</p><label className="block mt-2"><span className="text-[13px] font-bold text-[#111B21]">O que está errado?</span><textarea value={reproveNote} onChange={e=>setReproveNote(e.target.value)} placeholder="O que precisa ser refeito? Ex.: ponto, padrão, etiqueta…" className="mt-2 w-full bg-white text-[#111B21] rounded-2xl p-3 outline-none min-h-[90px] text-[15px] border border-black/10" /></label><div className="flex gap-2 mt-2"><button onClick={()=>setReproveFor(null)} className="flex-1 bg-white text-[#111B21] font-bold py-3 rounded-xl border border-black/10">Cancelar</button><button disabled={saving} onClick={sendReprove} className="flex-1 bg-[var(--danger)] text-white font-bold py-3 rounded-xl disabled:opacity-50">Enviar ocorrência</button></div></div>}
      {recording && <div className="bg-[#075E54] text-white text-center py-2 text-[13px] font-bold shrink-0">● Gravando… solte para enviar</div>}
      <form className="bg-[#F0F2F5] p-2.5 sm:p-3 flex gap-2 items-end shrink-0" onSubmit={async ev=>{ev.preventDefault(); if(!draft.trim()) return; const t=draft; setDraft(""); await sendChat(t,authUser||"",conversation);}}>
        <div className="flex-1 bg-white rounded-full flex items-center gap-1 px-4 py-1.5 shadow-sm">
          <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Mensagem" className="flex-1 bg-transparent outline-none text-[#111B21] placeholder:text-[#8696A0] text-[15px] min-w-0 py-2" aria-label="Mensagem"/>
        </div>
        {draft.trim() ? <button className="w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-full bg-[#00A884] text-white grid place-items-center text-[20px] font-bold shadow-sm" aria-label="Enviar mensagem">➤</button>
          : <button type="button" onPointerDown={ev=>{ev.preventDefault(); void startVoiceNote();}} onPointerUp={stopVoiceNote} onPointerLeave={stopVoiceNote} onPointerCancel={stopVoiceNote} onContextMenu={ev=>ev.preventDefault()} className={`w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-full grid place-items-center shadow-sm touch-none select-none ${recording?"bg-[var(--danger)] text-white scale-110":"bg-[#00A884] text-white"}`} aria-label="Segure para falar"><Mic size={20}/></button>}
      </form>
      {msg && <div className="bg-[#F0F2F5] px-4 pb-3 text-[13px] text-[#075E54] font-semibold">{msg}</div>}
    </main>}



    {showTodayDone && tab==="checklist" && <div className="fixed inset-0 z-50 overflow-y-auto pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/70">
      <div className="min-h-full flex items-center justify-center px-4">
        <div className="w-full max-w-[440px] card p-7 text-center tab-transition">
          <span className="check-pop mx-auto w-16 h-16 rounded-full bg-[var(--success-bg)] grid place-items-center text-[var(--success-text)]"><Check size={32} strokeWidth={3}/></span>
          <h2 className="font-extrabold text-[24px] leading-tight mt-4">✅ Checklist de hoje concluído!</h2>
          <p className="text-[14px] text-[var(--muted)] mt-2 leading-relaxed">{activeSections.join(", ")} enviadas para conferência em {fmtDate(date)}.</p>
          {anyTempOut && <p className="mt-3 p-3 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning)] text-[var(--warning-text)] text-sm font-bold">⚠️ Temperatura fora da faixa - avisar Gerência</p>}
          <button onClick={goToChatForCurrent} className="w-full mt-5 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[16px]">Ir para o Chat</button>
          <button onClick={()=>setShowTodayDone(false)} className="w-full mt-2 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold rounded-2xl py-3.5 text-[14px]">Continuar revisando</button>
        </div>
      </div>
    </div>}

    {tab==="checklist" && !isChatDetail && !isManager && <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] inset-x-0 z-30 bg-[var(--bg)]/95 backdrop-blur border-t border-[var(--line)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1 leading-tight"><p className="font-extrabold text-[15px] truncate">{pendingSection ? `${displaySectionTitle(pendingSection)} — ${pendingSectionCounts?.done}/${pendingSectionCounts?.total} feitos` : "Tudo concluído"}</p><p className="text-[12px] text-[var(--muted)]">{pendingSection ? ((pendingSectionCounts?.pending||0)>0 ? `Faltam ${pendingSectionCounts?.pending} itens` : "Pronto para concluir") : "Enviado para conferência"}</p></div>
        {pendingSection ? <button disabled={saving || (pendingSectionCounts?.pending||0)>0} onClick={()=>completeSectionFor(pendingSection)} className="shrink-0 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-5 py-3.5 text-[15px] disabled:opacity-50 pressable">Concluir <span className="hidden sm:inline">{displaySectionTitle(pendingSection)}</span><span className="sm:hidden">seção</span></button> : <button onClick={goToChatForCurrent} className="shrink-0 bg-white text-black font-extrabold rounded-2xl px-5 py-3.5 text-[15px] pressable">Ir para o Chat →</button>}
      </div>
    </div>}
    {!isChatDetail && !reproveFor && <nav className="fixed bottom-0 inset-x-0 z-30 bg-[var(--bg)] border-t border-[var(--line)] h-[calc(72px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]">
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
    {!isChatDetail && <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-[150px] pt-2 text-[12px] text-[var(--muted)] flex flex-wrap gap-3 justify-between"><span>Dojo Checklist · Operação diária</span><span>Estação no padrão</span></footer>}
    </>}
    {handoverDialogOpen && pendingHandoverSection && <div className="fixed inset-0 z-50 overflow-y-auto pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/70" role="dialog" aria-modal="true" aria-label="Passagem de turno">
      <div className="min-h-full flex items-center justify-center px-4"><div className="w-full max-w-[440px] card p-6">
        <h2 className="font-extrabold text-[22px] leading-tight">Passagem de turno</h2>
        <p className="text-[14px] text-[var(--muted)] mt-2 leading-relaxed">{displaySectionTitle(pendingHandoverSection)} está pronta para concluir.</p>
        <label className="block mt-4"><span className="text-[14px] font-bold">Deixar recado para o próximo turno? <span className="font-semibold text-[var(--muted)]">(opcional)</span></span><textarea value={handoverText} onChange={e=>setHandoverText(e.target.value)} placeholder="Ex.: Faltou camarão empanado, deixar 20 a mais amanhã" className="field mt-2" rows={3} aria-label="Deixar recado para o próximo turno?" /></label>
        <button type="button" onClick={fillHandover} className="w-full mt-2 bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)] font-extrabold text-[13px] py-3 rounded-2xl">Puxar pendências automaticamente</button>
        <button disabled={handoverSaving} onClick={()=>confirmHandover(true)} className="w-full mt-4 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[15px] disabled:opacity-50">{handoverSaving ? "Concluindo…" : "Concluir e deixar recado"}</button>
        <button disabled={handoverSaving} onClick={()=>confirmHandover(false)} className="w-full mt-2 bg-[var(--secondary-bg)] text-[var(--secondary-ink)] font-bold rounded-2xl py-3.5 text-[14px] disabled:opacity-50">Concluir sem recado</button>
        <button disabled={handoverSaving} onClick={()=>{setHandoverDialogOpen(false); setPendingHandoverSection(null); setHandoverText("");}} className="w-full mt-2 text-[13px] font-bold text-[var(--muted)] py-2">Voltar</button>
      </div></div>
    </div>}
    {qrOpen && <div className="fixed inset-0 z-50 overflow-y-auto pt-[max(1rem,var(--safe-area-inset-top))] pb-6 bg-black/70" role="dialog" aria-modal="true" aria-label="QR do Dojo">
      <div className="min-h-full flex items-center justify-center px-4"><div className="w-full max-w-[400px] card p-6 text-center">
        <h2 className="font-extrabold text-[22px]">QR do Dojo</h2>
        <div className="bg-white rounded-2xl p-3 mt-4 mx-auto w-fit"><canvas ref={qrCanvasRef} className="w-[240px] h-[240px] max-w-full block" aria-label="QR code para abrir o Dojo" /></div>
        <p className="text-[14px] text-[var(--muted)] mt-4 leading-relaxed">Aponte a câmera para abrir o Dojo</p>
        <p className="text-[11px] text-[var(--muted)] mt-1 [overflow-wrap:anywhere]">{appLink}</p>
        <button onClick={()=>setQrOpen(false)} className="w-full mt-5 bg-[var(--primary)] text-white font-extrabold rounded-2xl py-3.5 text-[15px]">Fechar</button>
      </div></div>
    </div>}
    {authUser && photoViewer && <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Foto — ${photoViewer.label}`}>
      <div className="w-full max-w-[620px] sheet">
        <div className="flex items-center justify-between gap-2 text-white/90 mb-3"><p className="font-bold text-[14px] truncate">{photoViewer.label}</p><button onClick={()=>setPhotoViewer(null)} aria-label="Fechar foto" className="w-10 h-10 grid place-items-center rounded-full bg-white/15 pressable"><X size={20}/></button></div>
        <img src={photoViewer.src} alt={`Foto — ${photoViewer.label}`} className="w-full max-h-[70dvh] object-contain rounded-2xl bg-black/40" />
        <div className="flex gap-2 mt-3">
          {photoViewer.onDelete && <button onClick={()=>photoViewer.onDelete?.()} className="flex-1 bg-[var(--danger)] text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 pressable"><Trash2 size={16}/> Excluir foto</button>}
          <button onClick={()=>setPhotoViewer(null)} className="flex-1 bg-white/15 text-white font-extrabold py-3.5 rounded-2xl pressable">Fechar</button>
        </div>
      </div>
    </div>}
    {authUser && quickEntryOpen && <div className="fixed inset-0 z-[66] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Falar ou anotar item">
      <div className="w-full sm:max-w-[460px] card p-5 sheet rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2"><div><p className="text-[12px] font-bold uppercase text-[var(--muted)]">Mãos ocupadas</p><h2 className="font-extrabold text-[21px] mt-1">Falar ou anotar item</h2></div><button onClick={()=>{setQuickEntryOpen(false);setListening(false);}} aria-label="Fechar" className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] pressable"><X size={18}/></button></div>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">Diga ou escreva o nome do produto e a quantidade. Exemplo: <b>Ebi Hot 12</b>. O item será marcado como Feito.</p>
        {(typeof window!=="undefined" && !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition) && <button type="button" disabled={listening} onClick={startVoice} className="w-full mt-4 bg-[var(--primary)] text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"><Mic size={18}/>{listening?"Ouvindo… fale agora":"🎤 Falar item"}</button>}
        <label className="block mt-4"><span className="text-[13px] font-bold">Ou digite</span><input autoFocus value={quickEntryText} onChange={e=>setQuickEntryText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&quickEntryText.trim()) void handleVoice(quickEntryText.trim());}} placeholder="Ex.: Ebi Hot 12" className="field mt-2" aria-label="Item e quantidade" /></label>
        <div className="flex gap-2 mt-3"><button onClick={()=>setQuickEntryOpen(false)} className="flex-1 bg-[var(--surface-2)] text-[var(--ink)] font-bold py-3 rounded-2xl">Cancelar</button><button disabled={!quickEntryText.trim()} onClick={()=>void handleVoice(quickEntryText.trim())} className="flex-1 bg-[var(--green)] text-white font-extrabold py-3 rounded-2xl disabled:opacity-50">Aplicar</button></div>
        <p className="text-[11px] text-[var(--muted)] mt-3">Se o microfone não funcionar no seu navegador, use o campo de texto — faz a mesma coisa.</p>
      </div>
    </div>}
    {authUser && productItem && <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Ficha — ${productItem.name}`}>
      <div className="w-full sm:max-w-[520px] max-h-[88dvh] overflow-y-auto card p-5 sheet rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2"><div><p className="text-[12px] font-bold tracking-wide uppercase text-[var(--muted)]">Ficha do produto</p><h2 className="font-extrabold text-[22px] leading-tight mt-1 [overflow-wrap:anywhere]">{productItem.name}</h2></div><button onClick={()=>setProductItem(null)} aria-label="Fechar ficha" className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] pressable"><X size={18}/></button></div>
        {(()=>{ const ref = checklistItems.find(r=>r.value?.name===productItem.name || r.value?.itemId===productItem.id)?.value; return ref?.photo && typeof ref.photo==="string" && ref.photo.startsWith("data:image/") ? <img src={ref.photo} alt={`Referência de ${productItem.name}`} className="w-full max-h-[220px] object-contain rounded-2xl bg-[var(--surface-inset)] mt-3" /> : null; })()}
        <div className="grid grid-cols-2 gap-2 mt-4 text-[13px]"><div className="rounded-xl bg-[var(--surface-2)] p-3"><span className="block text-[11px] font-bold uppercase text-[var(--muted)]">A produzir</span><b className="[overflow-wrap:anywhere]">{productItem.target}</b></div><div className="rounded-xl bg-[var(--surface-2)] p-3"><span className="block text-[11px] font-bold uppercase text-[var(--muted)]">Frequência</span><b>{productItem.freq}</b></div></div>
        <p className="text-[13px] text-[var(--muted)] mt-3">Seção: <b>{displaySectionTitle(productItem.section)}</b></p>
        {productItem.detail && <p className="text-[14px] mt-2 leading-relaxed">{productItem.detail}</p>}
        {instructions.find(i=>i.value.itemId===productItem.id)?.value?.text && <p className="mt-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] p-3 text-[13px] leading-relaxed">📋 {instructions.find(i=>i.value.itemId===productItem.id)!.value.text}</p>}
        {(()=>{ const s=suggestedFor(productItem); return s ? <p className="mt-3 text-[13px] font-bold text-[var(--muted)]">📈 Sugestão do dia: {s.value} un. ({s.days} dias iguais)</p> : null; })()}
        {(()=>{ const y=addDays(date,-1); const ye=entries[`${selected}|${y}|${productItem.id}`]?.value; return <p className="mt-2 text-[13px] text-[var(--muted)]">Ontem: <b>{ye?.status||"sem registro"}</b>{ye?.feito?` · ${ye.feito} un.`:""}</p>; })()}
        <div className="mt-3"><p className="text-[12px] font-bold uppercase text-[var(--muted)]">Colegas que fazem este item</p><div className="flex flex-wrap gap-2 mt-2">{Object.keys(byProfile).filter(p=>p!==selected && p!=="Gerência" && (byProfile[p]||[]).some(i=>i.id===productItem.id)).map(p=><span key={p} className="chip">{p} · {entries[`${p}|${date}|${productItem.id}`]?.value.status||"—"}</span>)}</div></div>
        <div className="flex flex-wrap gap-2 mt-5"><button disabled={saving||readOnly} onClick={()=>{ void setStatus(productItem,"Feito"); setProductItem(null); }} className="flex-1 bg-[var(--green)] text-white font-extrabold py-3.5 rounded-2xl">Feito</button><button disabled={saving||readOnly} onClick={()=>{ void setStatus(productItem,"Não feito"); setProductItem(null); }} className="flex-1 bg-[var(--danger)] text-white font-extrabold py-3.5 rounded-2xl">Não feito</button><button onClick={()=>setProductItem(null)} className="w-full bg-[var(--surface-2)] text-[var(--ink)] font-bold py-3 rounded-2xl">Fechar</button></div>
      </div>
    </div>}
    {stationQrOpen && <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={`QR — ${stationQrInfo.label}`}>
      <div className="w-full sm:max-w-[420px] card p-5 sheet rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2"><div><p className="text-[12px] font-bold uppercase text-[var(--muted)]">QR por estação</p><h2 className="font-extrabold text-[20px] mt-1">{stationQrInfo.label}</h2></div><button onClick={()=>setStationQrOpen(false)} aria-label="Fechar QR" className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] pressable"><X size={18}/></button></div>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">Imprima ou cole na estação. Ao escanear, o app abre com o login dessa pessoa já preenchido.</p>
        <div className="bg-white rounded-2xl p-3 mt-4 mx-auto w-fit"><canvas ref={stationQrCanvasRef} className="w-[240px] h-[240px] max-w-full block" aria-label="QR code da estação" /></div>
        <p className="text-[11px] text-[var(--muted)] mt-2 [overflow-wrap:anywhere]">{stationQrInfo.url}</p>
        <button onClick={()=>setStationQrOpen(false)} className="w-full mt-4 bg-[var(--primary)] text-white font-extrabold py-3.5 rounded-2xl">Fechar</button>
      </div>
    </div>}
    {authUser && toast && <div className="fixed inset-x-0 z-[70] px-3 pointer-events-none" style={{bottom:"calc(172px + var(--safe-area-inset-bottom))"}}><div className="toast pointer-events-auto max-w-[440px] mx-auto" role="status"><Check size={17} className="shrink-0"/><span className="min-w-0 flex-1">{toast.text}</span>{toast.undo && <button onClick={()=>{toast.undo?.();setToast(null);}} className="shrink-0 font-extrabold underline">Desfazer</button>}<button onClick={()=>setToast(null)} aria-label="Fechar aviso" className="shrink-0 opacity-60"><X size={15}/></button></div></div>}
  </div>;
}
