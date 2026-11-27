export type Freq = "DIÁRIO" | "SEMANAL" | "MENSAL";
export type Status = "Feito" | "Não feito" | "";
export type Section = "Produção" | "Produção do Quiosque" | "Limpeza" | "Organização" | "Montagem da Pista - Fria" | "Montagem da Pista - Quente" | "Reposição da Pista - Fria" | "Reposição da Pista - Quente";
export type Item = { id: string; name: string; target: string; freq: Freq; section: Section; detail?: string };
export type Entry = { profile: string; date: string; itemId: string; status: Status; feito: string; justificativa: string; updatedBy?: string; updatedAt?: string; perfil?: string; turno?: string; photo?: string };
export type ChatMsg = { profile: string; sender: string; text: string; time: string; audio?: string; duration?: number };
export type SubmissionItem = { itemId: string; status: Status; feito: string; justificativa: string };
export type Submission = { profile: string; date: string; section: Section; period: "DIÁRIO" | "SEMANAL" | "MENSAL"; perfil: string; turno: string; items: SubmissionItem[]; status: "Aguardando" | "Aprovado" | "Para corrigir"; fingerprint: string; correctionNote?: string };
export type ActionPlan = { profile: string; date: string; itemId: string; itemName: string; section: string; justificativa: string; deadline: string; status: "Pendente" | "Resolvido" | "Devolvido"; kind: "nao-feito" | "temperatura" | "validade" | "manutencao"; resolvedAt?: string; createdAt?: string };
export type Handover = { profile: string; date: string; turno: string; station: string; text: string; time: string };
export type Shortage = { profile: string; date: string; itemId: string; itemName: string; section: string; status: "Aberta" | "Resolvida"; createdAt: string };
export type WeeklySubmission = { profile: string; weekKey: string; date: string; items: { itemId: string; status: Status }[]; status: "Aguardando" | "Aprovado"; fingerprint: string };
export type ExpiryEntry = { profile: string; date: string; product: string; expiryDate: string; registeredAt: string };
export type MaintEntry = { profile: string; date: string; itemId: string; status: Status; note: string };
export type CredentialRecord = { login: string; profile: string; password: string; station?: string; group?: string; shift?: string; unit?: string; replaces?: string; replacesProfile?: string };
export type SignatureRecord = { profile: string; date: string; time: string; data: string };
export type TempEntry = { profile: string; date: string; fria: string; freezer: string };
export type ShiftEntry = { profile: string; date: string; startedAt: string; startedBy: string; finishedAt?: string; finishedBy?: string };
export type RecordRow = { id: string; value: any };
export type TaskRecord = { title: string; owner: string; dueDate: string; dueTime: string; status: "Aberta" | "Concluída"; notes?: string; createdAt: string; createdBy: string; days?: number[] };
export type LogbookRecord = { date: string; shift: string; text: string; author: string; time: string };
export type TrainingRecord = { title: string; person: string; status: "Pendente" | "Concluído" | "Aprovado"; score?: string; approvedBy?: string; createdAt: string };
export type InstructionRecord = { itemId: string; text: string };
export type StockItemRecord = { item: string; category: string; expected: string; min: string; max: string; unit: string; createdAt: string };
export type StockCountRecord = { date: string; item: string; expected: number; counted: number; difference: number; profile: string; time: string };
export type ReceivingRecord = { date: string; supplier: string; invoice: string; item: string; expectedQty: string; receivedQty: string; status: "Conferido" | "Divergente"; notes: string; profile: string; time: string };
export type TempLimitRecord = { key: "fria" | "freezer"; min: number; max: number };
export type ItemRuleRecord = { itemId: string; requirePhoto: boolean };
export type QuestionRecord = { question: string; section: string; weight: number; minScore: number; type: "check" | "sim_nao" | "multipla" | "numero" | "classificacao" | "data" | "hora" | "photo" | "text" | "temperature" | "foto_veredito" | "texto_veredito"; options?: string; correct?: string; hint?: string; referencePhoto?: string; createdAt: string };
export type QualityAnswerRecord = { date: string; questionId: string; question: string; profile: string; verdict: "Conforme" | "Parcial" | "Não conforme"; score: number; note: string; photo: string; temperature: string; time: string; reviewedBy?: string; reviewedVerdict?: string; answer?: string; opinion?: string };
export type TemplateRecord = { name: string; description: string; items: Item[]; createdAt: string };
export type CustomItemsRecord = { profile: string; items: Item[]; updatedAt: string };
export type Tab = "overview" | "checklist" | "chat" | "modules";
export type ChecklistRecord = { profile: string; date: string; title: string; turno?: string; perfil?: string };
export type ChecklistItemRecord = { checklistId?: string; itemId?: string; name: string; target?: string; section?: string; freq?: string; photo_url?: string; photo?: string };
export type TaskTemplate = { name: string; section: string; target?: string; freq?: string; detail?: string };

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
const brazilNowString = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()).replace(" ","T");
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

export { PROFILES, KIOSK_PROFILES, KIOSK_NIGHT_PROFILES, STATIONS, LOGIN_TO_PROFILE, DEFAULT_PASSWORD, STAFF_PROFILES, GROUP_CHANNELS, today, brazilNowString, fmtDate, nowTime, normalizeLogin, hashPassword, formatOverdue, addDays, daysBetween, parseTempValue, prod, other, limpeza, organizacao, hot, blocoA, blocoB, quente, kioskManhaNovo, kioskNoiteNovo, kioskProdLais, kioskProdCleide, kioskProdTalia, kioskProdTayara, quiosque, PISTA_GUIDE, copa, byProfile, ALL_ITEMS, ITEM_DEPENDENCIES, SECTIONS, WEEKLY_ITEMS, OVERVIEW_FILTER_PEOPLE, MAINT_ITEMS, weekKeyFor, KIOSK_MORNING_SECTIONS, KIOSK_NIGHT_SECTIONS, sectionsForProfile, complianceColor };
