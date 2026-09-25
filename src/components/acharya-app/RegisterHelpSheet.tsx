"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import AcharyaAvatar from "@/components/acharya-avatar";
import { ghostIconButtonStyle } from "@/components/ghost-icon-button";
import type { HelperAcharya } from "@/components/auth/MahAcharyaHelpCard";
import type { StateOption, TradeOption } from "@/lib/api/network";
import type { Lang } from "@/lib/store";
import { normalizeRegisterLang, registerCopy } from "@/lib/i18n/register-strings";
import { matchCity } from "@/lib/city-match";

export type RegisterFormPatch = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  trade_id?: string;
  state_id?: string;
  city_id?: string;
  /** When city list for the new state is not loaded yet. */
  city_name?: string;
  address_line?: string;
  pincode?: string;
  bio?: string;
  preferred_lang?: "en" | "hi" | "bn";
};

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  open: boolean;
  onClose: () => void;
  helper: HelperAcharya;
  states: StateOption[];
  trades: TradeOption[];
  /** Current draft for prompt context (names, not only ids). */
  draft: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    tradeId: string;
    stateId: string;
    cityId: string;
    addressLine: string;
    pincode: string;
    bio: string;
  };
  cities: Array<{ id: string; name: string }>;
  preferredLang: Lang;
  onApply: (patch: RegisterFormPatch) => void;
  onLanguage: (lang: Lang) => void;
  onSendCode: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

const FORM_RX = /<<REGISTER_FORM\|(\{[\s\S]*?\})>>/g;
const SEND_RX = /<<REGISTER_SEND_CODE>>/g;

function stripAndExtract(raw: string): {
  visible: string;
  patches: Record<string, string>[];
  sendCode: boolean;
} {
  const patches: Record<string, string>[] = [];
  let sendCode = false;
  const visible = raw
    .replace(FORM_RX, (_full, json: string) => {
      try {
        const obj = JSON.parse(json) as Record<string, unknown>;
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "string" && v.trim()) clean[k] = v.trim();
        }
        if (Object.keys(clean).length) patches.push(clean);
      } catch { /* ignore malformed */ }
      return "";
    })
    .replace(SEND_RX, () => {
      sendCode = true;
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { visible, patches, sendCode };
}

/** Non-null only when the city needs a follow-up question instead of a silent guess. */
function cityClarification(lang: Lang, cities: { name: string }[], kind: "options" | "suggestions" | "none"): string {
  const names = cities.map((c) => c.name);
  const copy = registerCopy(lang);
  if (kind === "options") return copy.cityDidYouMeanOptions(names);
  if (kind === "suggestions") return copy.cityDidYouMeanNearest(names[0] || "");
  return copy.cityNotFound;
}

function resolvePatch(
  raw: Record<string, string>,
  states: StateOption[],
  trades: TradeOption[],
  cities: Array<{ id: string; name: string }>,
  lang: Lang,
): { patch: RegisterFormPatch; cityNote: string | null } {
  const patch: RegisterFormPatch = {};
  if (raw.first_name) patch.first_name = raw.first_name;
  if (raw.last_name) patch.last_name = raw.last_name;
  if (raw.phone) patch.phone = raw.phone.replace(/\D/g, "").slice(0, 10);
  if (raw.email) patch.email = raw.email;
  if (raw.address_line) patch.address_line = raw.address_line;
  if (raw.pincode) patch.pincode = raw.pincode.replace(/\D/g, "").slice(0, 6);
  if (raw.bio) patch.bio = raw.bio;
  if (raw.preferred_lang || raw.language) {
    patch.preferred_lang = normalizeRegisterLang(raw.preferred_lang || raw.language);
  }

  if (raw.trade) {
    const t = trades.find((x) => x.name.toLowerCase() === raw.trade!.toLowerCase())
      || trades.find((x) => x.name.toLowerCase().includes(raw.trade!.toLowerCase()));
    if (t) patch.trade_id = t.id;
  }
  if (raw.state) {
    const s = states.find((x) => x.name.toLowerCase() === raw.state!.toLowerCase())
      || states.find((x) => x.name.toLowerCase().includes(raw.state!.toLowerCase()));
    if (s) patch.state_id = s.id;
  }

  let cityNote: string | null = null;
  if (raw.city) {
    const cityMatch = matchCity(raw.city, cities);
    if (cityMatch.type === "exact") {
      patch.city_id = cityMatch.city.id;
    } else if (cityMatch.type === "options" || cityMatch.type === "suggestions") {
      cityNote = cityClarification(lang, cityMatch.cities, cityMatch.type);
    } else {
      cityNote = cityClarification(lang, [], "none");
    }
  }
  return { patch, cityNote };
}

export default function RegisterHelpSheet({
  open, onClose, helper, states, trades, draft, cities, preferredLang, onApply, onLanguage, onSendCode,
}: Props) {
  const helperName = helper.displayName || "MahAcharya'ji";
  const copy = registerCopy(preferredLang);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: copy.helpGreeting(helperName) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const langRef = useRef(preferredLang);
  const onSendCodeRef = useRef(onSendCode);
  const onLanguageRef = useRef(onLanguage);

  useEffect(() => { langRef.current = preferredLang; }, [preferredLang]);
  useEffect(() => { onSendCodeRef.current = onSendCode; }, [onSendCode]);
  useEffect(() => { onLanguageRef.current = onLanguage; }, [onLanguage]);

  // Refresh greeting when language changes and the thread is still the initial prompt.
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== "assistant") return prev;
      return [{ role: "assistant", content: registerCopy(preferredLang).helpGreeting(helperName) }];
    });
  }, [preferredLang, helperName]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setLoading(true);

    const tradeName = trades.find((t) => t.id === draft.tradeId)?.name || "";
    const stateName = states.find((s) => s.id === draft.stateId)?.name || "";
    const cityName = cities.find((c) => c.id === draft.cityId)?.name || "";

    try {
      const r = await fetch("/api/auth/register/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          stateId: draft.stateId || null,
          lang: langRef.current,
          draft: {
            first_name: draft.firstName,
            last_name: draft.lastName,
            phone: draft.phone,
            email: draft.email,
            trade: tradeName,
            state: stateName,
            city: cityName,
            address_line: draft.addressLine,
            pincode: draft.pincode,
            bio: draft.bio,
            preferred_lang: langRef.current,
          },
        }),
      });
      if (!r.ok || !r.body) throw new Error(`help ${r.status}`);

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let sendRequested = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const { visible, patches, sendCode } = stripAndExtract(acc);
        if (sendCode) sendRequested = true;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: visible || "…" };
          return copy;
        });
        for (const p of patches) {
          const { patch } = resolvePatch(p, states, trades, cities, langRef.current);
          if (patch.preferred_lang) onLanguageRef.current(patch.preferred_lang);
          onApply(patch);
        }
      }
      const final = stripAndExtract(acc);
      if (final.sendCode) sendRequested = true;
      let cityNote: string | null = null;
      for (const p of final.patches) {
        const resolved = resolvePatch(p, states, trades, cities, langRef.current);
        if (resolved.patch.preferred_lang) onLanguageRef.current(resolved.patch.preferred_lang);
        onApply(resolved.patch);
        if (resolved.cityNote) cityNote = resolved.cityNote;
      }

      let closing = final.visible || "I have updated what I could on the form. What else should we add?";
      if (cityNote) closing = `${closing}\n\n${cityNote}`;
      if (sendRequested) {
        const sent = await onSendCodeRef.current();
        if (sent.ok) {
          closing = final.visible || "Code sent. Enter the six digits on the next screen.";
          onClose();
        } else {
          closing = `${final.visible ? `${final.visible}\n\n` : ""}${sent.error}`;
        }
      }

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: closing };
        return copy;
      });
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "I could not reach the help service just now. Fill the form yourself, or try again in a moment.",
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={`${helperName} registration help`}>
      <button type="button" aria-label="Close" onClick={onClose} style={backdropStyle} />
      <div style={sheetStyle}>
        <header style={sheetHeaderStyle}>
          <AcharyaAvatar
            slug={helper.slug}
            name={helperName}
            imageUrl={helper.avatarUrl}
            size={40}
            shape="rounded"
          />
          <div style={{ minWidth: 0 }}>
            <p style={eyebrowStyle}>Acharya help</p>
            <h2 style={titleStyle}>{helperName}</h2>
          </div>
          <button type="button" onClick={onClose} className="press" style={closeBtnStyle} aria-label="Close">
            ✕
          </button>
        </header>

        <div style={threadStyle} className="hide-scrollbar">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              style={{
                ...bubbleStyle,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "var(--green-deep)" : "var(--surface-sunk)",
                color: m.role === "user" ? "var(--surface)" : "var(--ink)",
              }}
            >
              {m.content}
            </div>
          ))}
          {loading ? <p style={typingStyle}>{helperName} is writing…</p> : null}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          style={composerStyle}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Tell ${helperName} your details…`}
            disabled={loading}
            className="flex-1"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="press"
            style={sendBtnStyle}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
};

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  border: "none",
  background: "color-mix(in srgb, var(--ink) 35%, transparent)",
  cursor: "pointer",
};

const sheetStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxHeight: "78vh",
  display: "flex",
  flexDirection: "column",
  background: "var(--page)",
  borderTopLeftRadius: "var(--r-lg)",
  borderTopRightRadius: "var(--r-lg)",
  borderTop: "1px solid var(--rule)",
  boxShadow: "var(--shadow-md)",
  paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
};

const sheetHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px 10px",
  borderBottom: "1px solid var(--rule)",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};

const titleStyle: CSSProperties = {
  margin: "2px 0 0",
  fontFamily: "var(--serif)",
  fontStyle: "italic",
  fontSize: 20,
  fontWeight: 500,
  color: "var(--ink)",
};

const closeBtnStyle: CSSProperties = {
  ...ghostIconButtonStyle,
  marginLeft: "auto",
  color: "var(--ink)",
};

const threadStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 180,
};

const bubbleStyle: CSSProperties = {
  maxWidth: "88%",
  padding: "10px 12px",
  borderRadius: "var(--r-md)",
  fontSize: 14,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
};

const typingStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--ink-mute)",
};

const composerStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  padding: "10px 16px 0",
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--rule)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 15,
  outline: "none",
};

const sendBtnStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--green-deep)",
  background: "var(--green-deep)",
  color: "var(--surface)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
