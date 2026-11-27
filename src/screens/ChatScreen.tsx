// @ts-nocheck - tela extraída com props dinâmicas do App
import { ChevronLeft, Lock, Mic, ThumbsDown, ThumbsUp, Users } from "lucide-react";

export default function ChatScreen(props: any) {
  const p = props.p;
  return <>
    {p.tab==="chat" && !p.conversation && <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-[140px] p.tab-transition">
      <div className="mt-5 overflow-hidden rounded-[20px] border border-[var(--line)]">
        <div className="bg-[#075E54] px-4 py-4 flex items-center gap-3"><span className="w-10 h-10 rounded-full grid place-items-center text-white font-extrabold bg-white/20 shrink-0">D</span><div className="min-w-0 flex-1 leading-tight"><h2 className="font-extrabold text-[18px] text-white truncate">{p.t("Dojo — Chat da Equipe")}</h2><p className="text-[12px] text-white/80 flex items-center gap-1"><Lock size={11}/>{p.t("Online")}</p></div><span className="ml-auto text-white/80 text-sm font-bold shrink-0">{p.visibleMessageCount} mensagens</span></div>
        <div className="bg-[#111B21]">
          <div className="px-4 pt-4 pb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8696A0] flex items-center gap-1.5"><Users size={12}/>{p.t("Grupos da operação")}</div>
          {p.conversations.filter(c=>c.kind==="group").map(c=>{ const lastText=c.last?.value.text||"Nenhuma mensagem ainda."; const preview=lastText.length>62?lastText.slice(0,62)+"…":lastText; return <button key={c.id} onClick={()=>p.setConversation(c.id)} className="w-full text-left flex gap-3 px-4 py-3.5 border-b border-white/5 hover:bg-white/5 transition items-center">
            <span className="w-12 h-12 shrink-0 rounded-full grid place-items-center text-white font-extrabold" style={{background:"#0F766E"}}><Users size={20}/></span>
            <span className="min-w-0 flex-1"><span className="flex justify-between gap-2 items-baseline"><span className="font-bold text-[16px] truncate text-white flex items-center gap-1.5">{c.name}{c.badge && <span className="text-[10px] font-extrabold uppercase tracking-wide bg-white/15 text-white/80 rounded-full px-1.5 py-0.5">{c.badge}</span>}</span><span className="text-[12px] text-[#8696A0] shrink-0">{c.last?.value.time||""}</span></span><span className="flex gap-1 items-center mt-0.5"><span className="text-[13px] text-[#8696A0] truncate">{preview}</span></span><span className="text-[12px] text-[#8696A0] truncate block mt-0.5">{c.subtitle} · {c.members} pessoas</span></span>
          </button>; })}
          <div className="px-4 pt-4 pb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8696A0]">{p.t("Conversas")}</div>
          {p.conversations.filter(c=>c.kind==="dm").map(c=>{ const lastText = c.last?.value.text||"Nenhuma mensagem ainda."; const preview = lastText.length>62?lastText.slice(0,62)+"…":lastText; return <button key={c.id} onClick={()=>p.setConversation(c.id)} className="w-full text-left flex gap-3 px-4 py-3.5 border-b border-white/5 hover:bg-white/5 transition items-center">
            <span className="w-12 h-12 shrink-0 rounded-full grid place-items-center text-white font-extrabold" style={{background:p.avatarColor(c.name)}}>{p.initials(c.name)}</span>
            <span className="min-w-0 flex-1"><span className="flex justify-between gap-2 items-baseline"><span className="font-bold text-[16px] truncate text-white">{c.name}</span><span className="text-[12px] text-[#8696A0] shrink-0">{c.last?.value.time||""}</span></span><span className="flex gap-1 items-center mt-0.5"><span className="text-[13px] text-[#8696A0] truncate">{preview}</span></span><span className="text-[12px] text-[#8696A0] truncate block mt-0.5">{c.subtitle}</span></span>
          </button>; })}
          {p.conversations.length===0 && <div className="p-6 text-center text-sm text-[#8696A0]">{p.t("Nenhuma conversa encontrada.")}</div>}
        </div>
      </div>
    </main>}

    {p.tab==="chat" && p.conversation && p.activeConvo && <main className="fixed inset-0 z-40 flex flex-col bg-[#ECE5DD] pt-[max(0px,var(--safe-area-inset-top))]">
      <div className="bg-[#075E54] px-2 sm:px-4 py-2.5 flex items-center gap-2 shrink-0">
        <button onClick={()=>p.setConversation(null)} className="p-2 text-white" aria-label="Voltar para conversas"><ChevronLeft size={22}/></button>
        <span className="w-10 h-10 rounded-full grid place-items-center text-white font-extrabold shrink-0" style={{background:p.avatarColor(p.activeConvo.name)}}>{p.initials(p.activeConvo.name)}</span>
        <div className="min-w-0 flex-1 leading-tight"><div className="font-bold text-white truncate">{p.activeConvo.kind==="group" ? `${p.activeConvo.name} · Grupo` : "Dojo — Chat da Equipe"}</div><div className="text-[12px] text-white/85 truncate flex items-center gap-1">{p.activeConvo.kind==="group" ? `${p.activeConvo.members} pessoas · Online` : `${p.activeConvo.name} · Online`} <Lock size={11}/></div></div>
      </div>
      <div ref={p.chatScrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-2" style={{backgroundColor:"#ECE5DD",backgroundImage:"radial-gradient(rgba(7,94,84,.08) 1px, transparent 1px)",backgroundSize:"20px 20px"}}>
        <div className="flex justify-center"><span className="bg-white text-[#667781] text-[12px] px-3 py-1.5 rounded-lg shadow-sm">Hoje · {p.fmtDate(p.date)}</span></div>
        {p.convoMessages.length===0 && <div className="text-center text-sm text-[#667781] bg-white rounded-2xl rounded-tl-[2px] p-5 mx-auto max-w-md mt-4 shadow-sm">{p.t("Nenhuma mensagem ainda. Conclua uma seção para enviar ao chat ou escreva abaixo.")}</div>}
        {p.convoMessages.map(m=>{
          const isMine = m.value.sender===p.authUser;
          const isChecklist = m.value.text.startsWith("✅ Checklist concluído") || m.value.text.startsWith("✅ Checklist corrigido");
          const isCorrection = m.value.text.startsWith("🔁");
          const isOccurrence = m.value.text.startsWith("⚠️ OCORRÊNCIA") || m.value.text.startsWith("⚠️ ALERTA");
          const isHandover = m.value.text.startsWith("📋");
          const isSystem = isChecklist || isCorrection || isOccurrence || isHandover || m.value.text.startsWith("🧹") || m.value.text.startsWith("⚠️");
          const parsed = isChecklist ? p.parseChecklist(m.value.text) : null;
          const bubbleBg = isOccurrence ? "#FDECEA" : isHandover ? "#FFF3CD" : isSystem ? "#FFFFFF" : isMine ? "#D9FDD3" : "#FFFFFF";
          const bubbleShape = isMine && !isSystem ? "rounded-2xl rounded-tr-[2px]" : "rounded-2xl rounded-tl-[2px]";
          return <div key={m.id} className={`flex ${isMine && !isSystem ?"justify-end":"justify-start"}`}>
            <div className={`max-w-[86%] sm:max-w-[72%] px-3 py-2.5 shadow-sm ${bubbleShape}`} style={{backgroundColor:bubbleBg}}>
              {!isMine && <div className="text-[13px] font-extrabold" style={{color:"#075E54"}}>{m.value.sender}</div>}
              {isMine && <div className="text-[13px] font-extrabold" style={{color:"#075E54"}}>{p.t("Você")}</div>}
              {m.value.audio ? <div className="mt-1"><audio controls src={m.value.audio} preload="metadata" className="w-full max-w-[260px] h-[42px]" aria-label={`Áudio de ${m.value.sender}`} /><p className="text-[12px] text-[#667781] mt-1">{m.value.text}</p></div> : <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] mt-0.5 text-[#111B21]">{m.value.text}</p>}
              {isChecklist && parsed && p.isManager && p.activeConvo.kind!=="group" && <div className="flex gap-2 mt-3"><button disabled={p.saving} onClick={()=>p.approveChecklist(m.value.text)} className="flex-1 bg-[#075E54] text-white text-[13px] font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"><ThumbsUp size={15}/>{p.t("Aprovar")}</button><button disabled={p.saving} onClick={()=>{p.setReproveFor({text:m.value.text,person:parsed.person,sectionText:parsed.sectionText}); p.setReproveNote("");}} className="flex-1 bg-white text-[var(--danger-strong)] border border-[var(--danger-border)] text-[13px] font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"><ThumbsDown size={15}/>{p.t("Pedir correção")}</button></div>}
              <div className="flex justify-end items-center gap-1 mt-1 flex-wrap">
                <span className="text-[11px] text-[#667781]">{m.value.time}</span>
                {isMine && (p.reads.filter(r=>r.value.messageId===m.id).length>0
                  ? <span className="text-[11px] font-bold text-[#075E54]">Lido por {Array.from(new Set(p.reads.filter(r=>r.value.messageId===m.id).map(r=>r.value.profile))).join(", ")}</span>
                  : <span className="text-[12px] font-bold text-[#53BDEB]" aria-label="Entregue">✓✓</span>)}
                {m.value.sender==="Gerência" && !isMine && p.reads.some(r=>r.value.messageId===m.id && r.value.profile===p.authUser) && <span className="text-[11px] font-bold text-[#075E54]">{p.t("✓ Lido")}</span>}
              </div>
            </div>
          </div>;
        })}
      </div>
      <div ref={p.chatEndRef} aria-hidden="true" />
      {p.reproveFor && <div className="bg-[#F0F2F5] px-4 py-3 shrink-0 border-p.t border-black/10"><p className="font-bold text-[#111B21] text-[14px]">Pedir correção — {p.reproveFor.person} · {p.reproveFor.sectionText}</p><label className="block mt-2"><span className="text-[13px] font-bold text-[#111B21]">{p.t("O que está errado?")}</span><textarea value={p.reproveNote} onChange={e=>p.setReproveNote(e.target.value)} placeholder="O que precisa ser refeito? Ex.: ponto, padrão, etiqueta…" className="mt-2 w-full bg-white text-[#111B21] rounded-2xl p-3 outline-none min-h-[90px] text-[15px] border border-black/10" /></label><div className="flex gap-2 mt-2"><button onClick={()=>p.setReproveFor(null)} className="flex-1 bg-white text-[#111B21] font-bold py-3 rounded-xl border border-black/10">{p.t("Cancelar")}</button><button disabled={p.saving} onClick={p.sendReprove} className="flex-1 bg-[var(--danger)] text-white font-bold py-3 rounded-xl disabled:opacity-50">{p.t("Enviar ocorrência")}</button></div></div>}
      {p.recording && <div className="bg-[#075E54] text-white text-center py-2 text-[13px] font-bold shrink-0">{p.t("● Gravando… solte para enviar")}</div>}
      <form className="bg-[#F0F2F5] p-2.5 sm:p-3 flex gap-2 items-end shrink-0" onSubmit={async ev=>{ev.preventDefault(); if(!p.draft.trim()) return; const text=p.draft; p.setDraft(""); await p.sendChat(text,p.authUser||"",p.conversation);}}>
        <div className="flex-1 bg-white rounded-full flex items-center gap-1 px-4 py-1.5 shadow-sm">
          <input value={p.draft} onChange={e=>p.setDraft(e.target.value)} placeholder="Mensagem" className="flex-1 bg-transparent outline-none text-[#111B21] placeholder:text-[#8696A0] text-[15px] min-w-0 py-2" aria-label="Mensagem"/>
        </div>
        {p.draft.trim() ? <button className="w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-full bg-[#00A884] text-white grid place-items-center text-[20px] font-bold shadow-sm" aria-label="Enviar mensagem">➤</button>
          : <button type="button" onPointerDown={ev=>{ev.preventDefault(); void p.startVoiceNote();}} onPointerUp={p.stopVoiceNote} onPointerLeave={p.stopVoiceNote} onPointerCancel={p.stopVoiceNote} onContextMenu={ev=>ev.preventDefault()} className={`w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-full grid place-items-center shadow-sm touch-none select-none ${p.recording?"bg-[var(--danger)] text-white scale-110":"bg-[#00A884] text-white"}`} aria-label="Segure para falar"><Mic size={20}/></button>}
      </form>
      {p.msg && <div className="bg-[#F0F2F5] px-4 pb-3 text-[13px] text-[#075E54] font-semibold">{p.msg}</div>}
    </main>}
  </>;
}
