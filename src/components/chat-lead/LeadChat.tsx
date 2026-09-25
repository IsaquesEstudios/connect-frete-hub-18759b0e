import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Truck, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { loadMunicipios, type Municipio, TIPOS_VEICULO, CARROCERIAS } from "@/lib/br-locations";
import { formatPhone, phoneDigits } from "@/lib/format-phone";
import { formatKg } from "@/lib/format-weight";
import { submitChatLead, type ChatLeadInput } from "@/lib/data/chat-leads.functions";

type FieldKey = Exclude<keyof ChatLeadInput, "kind">;
type InputKind = "text" | "phone" | "city" | "options" | "weight" | "money" | "optional";

export interface LeadQuestion {
  key: FieldKey;
  question: string;
  input: InputKind;
  options?: { grupo: string; opcoes: string[] }[];
  placeholder?: string;
}

export const MOTORISTA_QUESTIONS: LeadQuestion[] = [
  { key: "nome", question: "Olá! 👋 Para começar, qual é o seu nome?", input: "text", placeholder: "Seu nome" },
  { key: "whatsapp", question: "Qual é o seu WhatsApp com DDD?", input: "phone" },
  { key: "origem", question: "Em qual cidade e estado você está (origem)?", input: "city" },
  { key: "tipo_veiculo", question: "Qual é o tipo do seu veículo?", input: "options", options: TIPOS_VEICULO },
  { key: "carroceria", question: "E o tipo de carroceria?", input: "options", options: CARROCERIAS },
  { key: "peso", question: "Qual o peso suportado (kg)?", input: "weight" },
  { key: "info_extra", question: "Alguma informação extra? Se não tiver, toque em “Pular”.", input: "optional" },
];

export const CARGA_QUESTIONS: LeadQuestion[] = [
  { key: "nome", question: "Olá! 👋 Vamos cadastrar sua carga. Qual é o seu nome ou da empresa?", input: "text", placeholder: "Nome" },
  { key: "whatsapp", question: "Qual é o WhatsApp para contato, com DDD?", input: "phone" },
  { key: "origem", question: "Qual a cidade e estado de ORIGEM da carga?", input: "city" },
  { key: "destino", question: "E a cidade e estado de DESTINO?", input: "city" },
  { key: "tipo_veiculo", question: "Qual tipo de veículo você precisa?", input: "options", options: TIPOS_VEICULO },
  { key: "carroceria", question: "Qual tipo de carroceria?", input: "options", options: CARROCERIAS },
  { key: "peso", question: "Qual o peso da carga (kg)?", input: "weight" },
  { key: "valor", question: "Qual o valor do frete?", input: "money" },
  { key: "material", question: "Qual o material desta carga?", input: "text", placeholder: "Ex.: grãos, madeira, máquinas" },
  { key: "forma_pagamento", question: "Qual a forma de pagamento?", input: "text", placeholder: "Ex.: PIX, 50% na saída..." },
  { key: "info_extra", question: "Alguma informação extra? Se não tiver, toque em “Pular”.", input: "optional" },
];

function formatMoney(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Bubble = { from: "bot" | "user"; text: string };

export function LeadChat({ kind, questions, title }: { kind: "motorista" | "carga"; questions: LeadQuestion[]; title: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<FieldKey, string>>>({});
  const [history, setHistory] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(true);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMunicipios().then(setMunicipios).catch(() => {});
  }, []);

  // Bot "digitando" antes de cada pergunta
  useEffect(() => {
    if (step >= questions.length) return;
    setTyping(true);
    const t = setTimeout(() => {
      setHistory((h) => [...h, { from: "bot", text: questions[step].question }]);
      setTyping(false);
    }, 700);
    return () => clearTimeout(t);
  }, [step, questions]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, typing, done]);

  const q = questions[step];

  const submitAll = async (final: Partial<Record<FieldKey, string>>) => {
    setSaving(true);
    setTyping(true);
    try {
      const res = await submitChatLead({ data: { ...(final as ChatLeadInput), kind } });
      if (!res.ok) throw new Error(res.error);
      setHistory((h) => [...h, { from: "bot", text: "Pronto! ✅ Recebemos suas informações. Nossa equipe entrará em contato pelo WhatsApp em breve." }]);
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message || "Erro ao enviar.");
      setHistory((h) => [...h, { from: "bot", text: "Ops, não consegui enviar. Toque em “Tentar novamente”." }]);
    } finally {
      setSaving(false);
      setTyping(false);
    }
  };

  const answer = (raw: string, display?: string) => {
    if (!q) return;
    const text = raw.trim();
    if (q.input === "text" && text.length < 2) return toast.error("Digite uma resposta válida.");
    if (q.input === "phone" && phoneDigits(text).length < 10) return toast.error("Informe DDD + número.");
    if ((q.input === "weight" || q.input === "money") && !/\d/.test(text)) return toast.error("Informe um valor.");
    if ((q.input === "city" || q.input === "options") && !text) return;
    const next = { ...answers, [q.key]: text };
    setAnswers(next);
    setHistory((h) => [...h, { from: "user", text: display ?? (text || "Sem informações extras") }]);
    setValue("");
    if (step + 1 >= questions.length) {
      setStep(step + 1);
      void submitAll(next);
    } else setStep(step + 1);
  };

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#050b1a] text-slate-100">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, #0f2447 0%, #071228 45%, #030814 100%)" }} />
      <header className="relative z-10 flex items-center gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-sky-300 to-sky-500 text-slate-900">
          <Truck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{title}</div>
          <div className="text-xs text-emerald-300">{typing ? "digitando..." : "online"}</div>
        </div>
        <Logo iconClassName="h-8" />
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {history.map((b, i) => (
            <div key={i} className={b.from === "bot" ? "flex justify-start" : "flex justify-end"}>
              <div
                className={
                  b.from === "bot"
                    ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm"
                    : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-sky-500 px-4 py-2.5 text-sm text-slate-950"
                }
              >
                {b.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.07] px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-300" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </div>
            </div>
          )}
          {done && (
            <div className="mt-4 flex flex-col items-center gap-2 text-center text-sm text-slate-300">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              Cadastro enviado com sucesso.
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          {step >= questions.length ? (
            !done && !saving ? (
              <button onClick={() => submitAll(answers)} className="w-full rounded-xl bg-sky-500 py-3 font-medium text-slate-950">
                Tentar novamente
              </button>
            ) : null
          ) : typing || !q ? (
            <div className="h-12" />
          ) : q.input === "city" ? (
            <CityPicker municipios={municipios} onPick={(v) => answer(v)} />
          ) : q.input === "options" ? (
            <OptionPicker groups={q.options ?? []} onPick={(v) => answer(v)} />
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                answer(value);
              }}
            >
              {q.input === "optional" ? (
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  rows={2}
                  placeholder="Digite aqui (opcional)"
                  className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300/50"
                />
              ) : (
                <input
                  autoFocus
                  value={value}
                  inputMode={q.input === "text" ? "text" : "numeric"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setValue(
                      q.input === "phone" ? formatPhone(v) : q.input === "weight" ? formatKg(v) : q.input === "money" ? formatMoney(v) : v,
                    );
                  }}
                  placeholder={q.placeholder ?? (q.input === "phone" ? "(00) 00000-0000" : q.input === "weight" ? "Ex.: 12.000" : q.input === "money" ? "R$ 0,00" : "")}
                  className="h-12 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300/50"
                />
              )}
              {q.input === "optional" && (
                <button type="button" onClick={() => answer("")} className="h-12 rounded-xl border border-white/15 px-4 text-sm text-slate-200">
                  Pular
                </button>
              )}
              <button type="submit" aria-label="Enviar" className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-slate-950">
                <Send className="h-5 w-5" />
              </button>
            </form>
          )}
        </div>
      </footer>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 focus-within:border-sky-300/50">
      <Search className="h-4 w-4 text-slate-400" />
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
    </div>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function CityPicker({ municipios, onPick }: { municipios: Municipio[]; onPick: (v: string) => void }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const t = norm(q.trim());
    if (t.length < 2) return [];
    return municipios.filter((m) => norm(`${m.nome} ${m.uf}`).includes(t)).slice(0, 30);
  }, [q, municipios]);
  return (
    <div className="space-y-2">
      {results.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0a1630]">
          {results.map((m) => (
            <button key={`${m.nome}-${m.uf}`} onClick={() => onPick(`${m.nome} - ${m.uf}`)} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-white/10">
              {m.nome} <span className="text-slate-400">- {m.uf}</span>
            </button>
          ))}
        </div>
      )}
      <SearchBox value={q} onChange={setQ} placeholder={municipios.length ? "Digite a cidade..." : "Carregando cidades..."} />
    </div>
  );
}

function OptionPicker({ groups, onPick }: { groups: { grupo: string; opcoes: string[] }[]; onPick: (v: string) => void }) {
  const [q, setQ] = useState("");
  const t = norm(q.trim());
  const filtered = groups
    .map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => !t || norm(o).includes(t)) }))
    .filter((g) => g.opcoes.length);
  return (
    <div className="space-y-2">
      <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0a1630] p-2">
        {filtered.map((g) => (
          <div key={g.grupo} className="mb-2">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-slate-400">{g.grupo}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.opcoes.map((o) => (
                <button key={o} onClick={() => onPick(o)} className="rounded-full border border-white/15 px-3 py-1.5 text-sm hover:border-sky-300 hover:bg-sky-500/20">
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!filtered.length && <div className="p-3 text-sm text-slate-400">Nada encontrado.</div>}
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar..." />
    </div>
  );
}
