// =========================================================
// Función "whatsapp" (Supabase Edge Function)
// · modo "bot" (recomendado): asistente con IA + botones que cotiza (manda link del cotizador con origen/destino),
//   informa tours y precios, pasa a una persona cuando hace falta, y avisa al cliente "va en camino / está llegando /
//   llegó / espera" desde el número del negocio (nunca desde el del taxista).
// · modo "pedidos": como antes, la IA solo junta el pedido y la central contesta desde la agenda.
// Candados de gasto: tope diario de pláticas con IA (ia_dia_max), de mensajes con IA por número (ia_por_num),
//   de avisos pagados (avisos_dia_max), lista negra (wa_conv.bloqueado) y números del equipo con tope bajo.
// Secretos: WA_TOKEN, WA_VERIFY, WA_APP_SECRET, ANTHROPIC_API_KEY. Opcionales: AI_MODEL, GRAPH_VER,
//   WA_ALERTA_TEMPLATE, WA_AVISO_TEMPLATE (plantilla "utility" para avisos fuera de las 24 h).
// "Verify JWT" apagado (Meta no manda sesión).
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WA_TOKEN = Deno.env.get("WA_TOKEN") ?? "";
const WA_VERIFY = Deno.env.get("WA_VERIFY") ?? "";
const WA_APP_SECRET = Deno.env.get("WA_APP_SECRET") ?? "";
const AI_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "claude-haiku-5-5";
const GRAPH = "https://graph.facebook.com/" + (Deno.env.get("GRAPH_VER") ?? "v23.0");
const ALERTA_TPL = Deno.env.get("WA_ALERTA_TEMPLATE") ?? "";
const AVISO_TPL = Deno.env.get("WA_AVISO_TEMPLATE") ?? "";
const APP = "https://agenda-taxi.pages.dev/taxicel/";
const WEB = "https://taxicelcampeche.com";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-cron" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const hoyMx = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Merida" });

async function firmaOk(req: Request, raw: string) {
  if (!WA_APP_SECRET) return true;
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(WA_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(raw)));
  const hex = "sha256=" + [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.length === sig.length && hex === sig;
}
async function cronOk(req: Request) {
  const k = req.headers.get("x-cron");
  if (!k) return false;
  const { data } = await SB.from("config").select("valor").eq("clave", "cron").maybeSingle();
  return !!data && data.valor === k;
}

async function waEnviar(pnid: string, to: string, body: Record<string, unknown>) {
  const r = await fetch(`${GRAPH}/${pnid}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? `WhatsApp ${r.status}`);
  return j;
}
const waTexto = (pnid: string, to: string, texto: string) => waEnviar(pnid, to, { type: "text", text: { body: texto.slice(0, 4000), preview_url: true } });
const waBotones = (pnid: string, to: string, texto: string, b: [string, string][]) => waEnviar(pnid, to, {
  type: "interactive", interactive: { type: "button", body: { text: texto.slice(0, 1000) }, action: { buttons: b.slice(0, 3).map(([id, t]) => ({ type: "reply", reply: { id, title: t.slice(0, 20) } })) } },
});

function textoDe(m: any): string {
  switch (m.type) {
    case "text": return m.text?.body ?? "";
    case "location": {
      const l = m.location ?? {};
      return `📍 Ubicación compartida: ${[l.name, l.address].filter(Boolean).join(", ")} https://maps.google.com/?q=${l.latitude},${l.longitude}`;
    }
    case "button": return m.button?.text ?? "";
    case "interactive": return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "audio": return "[🎤 mandó un audio: hay que escucharlo en WhatsApp]";
    case "image": return "[📷 mandó una foto" + (m.image?.caption ? ": " + m.image.caption : "") + "]";
    case "document": return "[📄 mandó un documento]";
    default: return `[mensaje tipo ${m.type}]`;
  }
}
const idBoton = (m: any) => m.type === "interactive" ? (m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? "") : "";

// ---------------------------------------------------------------- Google Maps: links cortos y rutas
function coordsDe(u: string): { lat: number; lng: number } | null {
  const s = decodeURIComponent(u || "");
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/\/search\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}
// Link de ruta (/maps/dir/A/B/...): saca los puntos en orden, con nombre y coordenadas cuando vienen
function rutaDe(u: string): { t: string; lat?: number; lng?: number }[] | null {
  let s = u;
  try { s = decodeURIComponent(u.replace(/\+/g, " ")); } catch { /* */ }
  const m = s.match(/\/maps\/dir\/([^@?]*)/);
  if (!m) {
    const q = s.match(/[?&]saddr=([^&]+)&(?:.*&)?daddr=([^&]+)/);
    if (!q) return null;
    return [q[1], q[2]].map((t) => { const c = t.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/); return c ? { t: "", lat: +c[1], lng: +c[2] } : { t }; });
  }
  const P = m[1].split("/").map((x) => x.trim()).filter(Boolean).map((t) => {
    const c = t.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    return c ? { t: "", lat: +c[1], lng: +c[2] } : { t } as { t: string; lat?: number; lng?: number };
  });
  // coordenadas de cada punto en el parámetro data: ...!1d<lng>!2d<lat>...
  const C = [...s.matchAll(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/g)].map((x) => ({ lng: +x[1], lat: +x[2] }));
  let j = 0;
  for (const p of P) if (p.lat == null && p.t && j < C.length) { p.lat = C[j].lat; p.lng = C[j].lng; j++; }
  return P.length >= 2 ? P : null;
}
const VISTOS: string[] = [];
async function abrirMapsFull(url: string): Promise<{ c: { lat: number; lng: number } | null; url: string }> {
  let u = String(url || "").trim();VISTOS.length = 0;
  if (!/^https?:\/\//.test(u)) return { c: null, url: u };
  let c = rutaDe(u) ? null : coordsDe(u);
  for (let i = 0; i < 6; i++) {
    if (c || rutaDe(u)) break;
    let r: Response;
    try { r = await fetch(u, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } }); } catch { break; }
    const loc = r.headers.get("location");VISTOS.push(r.status + " " + u.slice(0, 300));
    if (loc) { u = new URL(loc, u).toString(); if (!rutaDe(u)) c = coordsDe(u); continue; }
    const html = await r.text().catch(() => "");
    const meta = html.match(/content="0;\s*url=([^"]+)"/i) || html.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s]+/);
    if (meta) { u = (meta[1] ?? meta[0]).replace(/&amp;/g, "&"); if (!rutaDe(u)) c = coordsDe(u); }
    else c = coordsDe(html.slice(0, 200000));
    break;
  }
  return { c, url: u };
}
async function abrirMaps(url: string) { return (await abrirMapsFull(url)).c; }
async function abrirLinksDatos(d: any) {
  for (const k of ["origen_maps", "destino_maps"]) {
    const v = d?.[k];
    if (v && !coordsDe(v)) {
      const r = await abrirMapsFull(v), ru = rutaDe(r.url);
      if (ru && k === "origen_maps" && !d.destino_maps) {
        const [a, b] = [ru[0], ru[ru.length - 1]];
        if (a.lat != null) d.origen_maps = `https://maps.google.com/?q=${a.lat},${a.lng}`; if (a.t && !d.origen) d.origen = a.t;
        if (b.lat != null) d.destino_maps = `https://maps.google.com/?q=${b.lat},${b.lng}`; if (b.t && !d.destino) d.destino = b.t;
      } else if (r.c) d[k] = `https://maps.google.com/?q=${r.c.lat},${r.c.lng}`;
    }
  }
  if (d?.origen_maps && d.origen_maps === d.destino_maps) d.destino_maps = null;
  return d;
}

// ---------------------------------------------------------------- IA que lee pedidos (modo "pedidos" y botón 📋 de la agenda)
const PROMPT = `Eres el asistente de una central de taxis en Campeche, México (Taxicel y grupos aliados).
Lees los mensajes de WhatsApp de UN cliente (pueden venir en español, inglés u otro idioma, formales o informales, en varios mensajes) y sacas los datos del viaje.
Reglas:
- "ahora" es true si lo quiere ya / ahorita / lo antes posible.
- Si dice "mañana", "el viernes", etc., calcula la fecha con la fecha de hoy que te doy. Hora en 24 h.
- "aeropuerto" true si el viaje sale o llega al aeropuerto de Campeche; "tren_maya" true si es la estación del Tren Maya.
- "desde_hotel" true si lo recogen en un hotel. "empresa" si dice que es para una empresa o pide factura a nombre de una empresa.
- Si compartió ubicación con link de Google Maps, ponlo en origen_maps (o destino_maps si dice que es a donde va).
- "resumen": una línea en español para la central, ej. "2 personas · Hotel Ocean View → Aeropuerto · mañana 05:30 · efectivo".
- "falta": lo que falta para poder mandar el taxi, en español corto (ej. "hora", "dónde lo recogemos", "a dónde va"). Vacío si está completo.
- "pregunta": si pregunta algo (precio, tours, si hay taxi) escríbelo corto en español.
- "es_pedido" false si solo saluda, pregunta información sin pedir viaje, o no tiene que ver con taxis.
- Nunca inventes datos que no estén en los mensajes. Si no dice cuántas personas, personas = null. Si no dice cómo paga, pago = null. factura = true SOLO si menciona factura.
- "voy a X", "al X", "para X", "llévame a X" = X es el DESTINO. Lo demás (colonia, calle, "casa verde", link de Maps sin decir que es el destino) es el ORIGEN.
- Si manda UN link de Maps y no dice que es a donde va, ese link es el ORIGEN (origen_maps). Nunca pongas el mismo link en origen_maps y destino_maps.
- "casa verde", "portón negro", "frente a…" van en origen_ref, no en origen.
- Lugares conocidos de Campeche: "ADO" = terminal de autobuses ADO Campeche; "el tren" = estación Tren Maya Campeche; "el aeropuerto" = Aeropuerto Internacional de Campeche.`;
const S_ = (d: string) => ({ type: ["string", "null"], description: d });
const PEDIDO_TOOL = {
  name: "guardar_pedido",
  description: "Guarda los datos del viaje que pidió el cliente.",
  input_schema: {
    type: "object",
    properties: {
      es_pedido: { type: "boolean" }, idioma: { type: "string" }, nombre: S_("nombre del cliente"),
      origen: S_("dónde lo recogen"), origen_ref: S_("referencias del origen"), origen_maps: S_("link de Google Maps del origen"),
      destino: S_("a dónde va"), destino_maps: S_("link de Google Maps del destino"), paradas: { type: "array", items: { type: "string" } },
      fecha: S_("YYYY-MM-DD"), hora: S_("HH:MM en 24 h"), ahora: { type: "boolean" },
      personas: { type: ["integer", "null"] }, maletas: { type: ["integer", "null"] }, pago: S_("Efectivo, Tarjeta o Transferencia"),
      factura: { type: "boolean" }, empresa: S_("empresa"), hotel: S_("hotel"), desde_hotel: { type: "boolean" },
      aeropuerto: { type: "boolean" }, tren_maya: { type: "boolean" }, vuelo_o_tren: S_("vuelo o tren"), tour: { type: "boolean" },
      pregunta: S_("pregunta del cliente"), resumen: { type: "string" }, falta: { type: "array", items: { type: "string" } },
    },
    required: ["es_pedido", "resumen", "falta"],
  },
};
async function claude(body: Record<string, unknown>) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": AI_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `IA ${r.status}`);
  return j;
}
async function iaLeer(textos: string[]) {
  const hoy = new Date().toLocaleString("es-MX", { timeZone: "America/Merida", dateStyle: "full", timeStyle: "short" });
  const j = await claude({
    max_tokens: 1200, system: PROMPT + "\nUsa la herramienta guardar_pedido para responder.",
    tools: [PEDIDO_TOOL], tool_choice: { type: "tool", name: "guardar_pedido" },
    messages: [{ role: "user", content: `Hoy es ${hoy} (hora de Campeche).\nMensajes del cliente, en orden:\n` + textos.map((t, i) => `${i + 1}. ${t}`).join("\n") }],
  });
  const tool = (j.content ?? []).find((c: any) => c.type === "tool_use");
  const datos: any = tool?.input ?? { resumen: "", falta: [], error_ia: "La IA no regresó datos" };
  return { datos, tin: j.usage?.input_tokens ?? 0, tout: j.usage?.output_tokens ?? 0 };
}

// ---------------------------------------------------------------- 🤖 BOT
const LADA_IDI: [string, string][] = [["52", "es"], ["34", "es"], ["54", "es"], ["57", "es"], ["56", "es"], ["51", "es"], ["502", "es"], ["503", "es"], ["504", "es"], ["505", "es"], ["506", "es"], ["507", "es"], ["593", "es"], ["598", "es"], ["595", "es"], ["591", "es"], ["58", "es"],
  ["33", "fr"], ["32", "fr"], ["41", "de"], ["49", "de"], ["43", "de"], ["39", "it"], ["31", "nl"], ["351", "pt"], ["55", "pt"], ["81", "ja"], ["82", "ko"], ["86", "zh"]];
const idiDe = (wa: string) => (LADA_IDI.filter(([k]) => wa.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0] ?? ["", "en"])[1];
const T = (i: string, es: string, en: string) => i === "es" ? es : en;

const SABER = `DATOS DEL NEGOCIO (úsalos tal cual; no inventes otros precios):
- Taxicel Servicio Programado, taxi privado en San Francisco de Campeche, México. 24 horas. Llegamos 10 minutos antes. Aire acondicionado, seguro de viajero. Pago en efectivo o tarjeta (débito/crédito). Factura electrónica (CFDI) si la pide al reservar. Página: ${WEB}
- Sedán hasta 4 pasajeros. Van hasta 14 pasajeros (programada).
- Aeropuerto de Campeche ↔ ciudad: sedán desde $300 MXN (el precio exacto depende de la colonia/hotel); van privada $1,500; colectivo $150 por persona. Si el vuelo se retrasa, esperamos. Página: ${WEB}/aeropuerto/
- Estación Tren Maya Campeche ↔ ciudad: sedán $300. Van para grupos: se cotiza. Página: ${WEB}/tren-maya/
- Hotel ↔ terminal ADO (dentro de la ciudad): $100.
- Viajes dentro de la ciudad: desde $55 según distancia.
- Tours (sedán privado hasta 4 personas; entradas y comida no incluidas):
  · Edzná: $1,800 (ida, hasta 2 h de espera y regreso). Paquete con guía: $2,500. ${WEB}/edzna/
  · Uxmal: $4,000 (ida, hasta 2 h en Uxmal y regreso, ~6 h). + Museo del Chocolate $400. + Parada para comer $400. ${WEB}/uxmal/
  · Bahía de Tortugas (playa, Champotón): $4,000, hasta 6 h de espera, casetas incluidas. ${WEB}/bahia-de-tortugas/
  · Edzná + Bahía de Tortugas: $5,400 (casetas y agua incluidas), + guía en Edzná $800. Sale 7:00 am. ${WEB}/edzna-bahia-de-tortugas/
  · Otros destinos (Mérida, Calakmul, Sabancuy, Chichén Itzá…): se cotizan; pasa a una persona.
  · Todos los tours: ${WEB}/tours/
- IRONMAN 70.3 Campeche (fecha por confirmar): aeropuerto → hotel en colectivo $200 por persona + $400 por bici (la bici ocupa 2 lugares, máx. 5 bicis por van); van privada $1,800; taxi sedán $300 (la caja de la bici solo cabe a veces). Regreso al aeropuerto, mismo precio. ${WEB}/ironman/
- Tiempo extra de espera en tours: $100 por cada 15 minutos.`;

const BOT_SYS = (idi: string, nombre: string) => `Eres el asistente de WhatsApp de Taxicel (taxi en Campeche, México). Hablas con un cliente${nombre ? " llamado " + nombre : ""}.
Contesta SIEMPRE en el idioma del cliente (su teléfono sugiere: ${idi}). Mensajes cortos, amables, con 1–2 emojis máximo, propios de WhatsApp.
${SABER}
CÓMO TRABAJAS:
- Para cotizar o pedir un viaje necesitas ORIGEN y DESTINO. Pídelos si faltan: el cliente puede mandar su ubicación con el clip 📎, pegar un link de Google Maps, o escribir el lugar (hotel, colonia, aeropuerto, Tren Maya).
- Cuando tengas origen y destino, usa la herramienta cotizar (con fecha y hora si las dijo). Te regresa un link: mándaselo diciendo que ahí ve el precio exacto y reserva con su nombre en un paso. No digas un precio exacto para viajes de ciudad: el link lo calcula.
- Para aeropuerto, Tren Maya, ADO y tours SÍ puedes decir los precios de arriba, y además mandar el link de cotizar o la página.
- Si pide algo que no está arriba (otro destino lejano, grupo grande, factura especial, queja, cambio o cancelación de un servicio ya reservado, objetos olvidados), o pide hablar con alguien, usa pasar_a_persona.
- Nunca des nombres ni teléfonos de taxistas ni de otros clientes. Nunca prometas algo que no esté arriba.
- Si el mensaje no tiene que ver con taxis o es broma, contesta muy corto y vuelve al tema.
Hoy es ${new Date().toLocaleString("es-MX", { timeZone: "America/Merida", dateStyle: "full", timeStyle: "short" })} (hora de Campeche).`;
const BOT_TOOLS = [
  {
    name: "cotizar", description: "Arma el link del cotizador con el viaje ya puesto. Úsalo cuando tengas origen y destino.",
    input_schema: { type: "object", properties: {
      origen: { type: "string", description: "nombre o dirección del origen" }, origen_maps: S_("link de Google Maps o ubicación del origen si lo mandó"),
      destino: { type: "string", description: "nombre o dirección del destino" }, destino_maps: S_("link de Google Maps del destino si lo mandó"),
      fecha: S_("YYYY-MM-DD si es programado"), hora: S_("HH:MM 24 h si es programado"), personas: { type: ["integer", "null"] }, van: { type: "boolean" },
    }, required: ["origen", "destino"] },
  },
  {
    name: "pasar_a_persona", description: "Pasa la plática a una persona de la central (el bot deja de contestar 2 horas).",
    input_schema: { type: "object", properties: { motivo: { type: "string" }, resumen: { type: "string", description: "resumen en español para la central" } }, required: ["motivo"] },
  },
];
async function linkCotizar(a: any, idi: string) {
  const d: any = { origen_maps: a.origen_maps, destino_maps: a.destino_maps, origen: a.origen, destino: a.destino };
  try { await abrirLinksDatos(d); } catch { /* */ }
  const p = new URLSearchParams();
  if (d.origen) p.set("ori", d.origen); if (d.origen_maps) p.set("orim", d.origen_maps);
  if (d.destino) p.set("des", d.destino); if (d.destino_maps) p.set("desm", d.destino_maps);
  if (a.fecha) { p.set("fe", a.fecha); if (a.hora) p.set("ho", a.hora); }
  if (+a.personas > 0) p.set("per", String(a.personas)); if (a.van || +a.personas > 4) p.set("van", "1");
  p.set("lang", idi === "es" ? "es" : "en");
  return APP + "?" + p.toString();
}
const ES_PERSONA = /^(persona|humano|agente|asesor|operador|human|agent|person|operator|real person)\b/i;

async function guardarPlatica(pnid: string, cli: string, grupo: string, nombre: string, entran: any[], salen: string[], extra: Record<string, unknown> = {}) {
  const hace2h = new Date(Date.now() - 2 * 3600e3).toISOString();
  const { data: ped } = await SB.from("wa_pedidos").select("id,mensajes,estado").eq("phone_number_id", pnid).eq("cliente_wa", cli)
    .gte("actualizado", hace2h).order("actualizado", { ascending: false }).limit(1).maybeSingle();
  const now = new Date().toISOString();
  const M = (ped?.mensajes ?? []).concat(entran, salen.map((t, i) => ({ id: "bot-" + Date.now() + i, de: "bot", t, ts: now })));
  if (ped) await SB.from("wa_pedidos").update({ mensajes: M, actualizado: now, ...extra }).eq("id", ped.id);
  else await SB.from("wa_pedidos").insert({ grupo_id: grupo, phone_number_id: pnid, cliente_wa: cli, cliente_nombre: nombre || null, mensajes: M, datos: { resumen: "Plática con el bot" }, estado: "bot", actualizado: now, ...extra });
}

async function botCliente(num: any, cli: string, L: any[], perfilNom: string) {
  const pnid = num.phone_number_id, grupo = String(num.grupo_id), hoy = hoyMx();
  let { data: cv } = await SB.from("wa_conv").select("*").eq("phone_number_id", pnid).eq("cliente_wa", cli).maybeSingle();
  if (!cv) {
    const { data: eq } = await SB.from("perfiles").select("id,cel").eq("grupo_id", grupo).not("cel", "is", null).limit(2000);
    const es_equipo = (eq ?? []).some((p: any) => { const d = String(p.cel).replace(/\D/g, ""); return d.length >= 10 && cli.endsWith(d.slice(-10)); });
    const ins = await SB.from("wa_conv").insert({ phone_number_id: pnid, cliente_wa: cli, grupo_id: grupo, idioma: idiDe(cli), nombre: perfilNom || null, es_equipo }).select("*").single();
    cv = ins.data;
  }
  if (!cv || cv.bloqueado) return;
  const idi = cv.idioma || idiDe(cli);
  const entran = L.map((m) => ({ id: m.id, de: "cliente", t: textoDe(m), ts: new Date(+m.timestamp * 1000).toISOString() }));
  const ahora = new Date().toISOString();
  const salen: string[] = [];
  const decir = async (t: string) => { try { await waTexto(pnid, cli, t); salen.push(t); } catch (_) { /* */ } };
  const menu = async (t: string) => {
    try { await waBotones(pnid, cli, t, [["cot", T(idi, "💰 Cotizar viaje", "💰 Get a price")], ["tours", "🗺️ Tours"], ["persona", T(idi, "👤 Una persona", "👤 Talk to a person")]]); salen.push(t + " [botones]"); }
    catch (_) { await decir(t); }
  };
  let hist: any[] = Array.isArray(cv.hist) ? cv.hist : [];
  const ultimoBtn = idBoton(L[L.length - 1]);
  const texto = entran.map((x) => x.t).join("\n").trim();
  const upd: Record<string, unknown> = { ultimo_in: ahora, actualizado: ahora, nombre: cv.nombre || perfilNom || null };
  const pedidoExtra: Record<string, unknown> = {};

  // 👤 en manos de una persona: solo se guarda
  if (cv.humano_hasta && new Date(cv.humano_hasta) > new Date() && ultimoBtn !== "menu") {
    await SB.from("wa_conv").update(upd).eq("phone_number_id", pnid).eq("cliente_wa", cli);
    await guardarPlatica(pnid, cli, grupo, cv.nombre, entran, [], { estado: "nuevo", urgente: true });
    return;
  }
  const aPersona = async (motivo: string, resumen?: string) => {
    upd.humano_hasta = new Date(Date.now() + 2 * 3600e3).toISOString();
    pedidoExtra.estado = "nuevo"; pedidoExtra.urgente = true;
    pedidoExtra.datos = { resumen: "👤 Pide una persona: " + (resumen || motivo).slice(0, 300) };
    await decir(T(idi, "👤 Listo, te comunico con una persona de la central. En unos minutos te contestan por aquí.", "👤 Sure, I'm passing you to a person from our team. They will reply here in a few minutes."));
  };

  if (ultimoBtn === "persona" || ES_PERSONA.test(texto)) await aPersona("lo pidió el cliente");
  else if (ultimoBtn === "tours") {
    await decir(T(idi,
      `🗺️ *Tours en taxi privado* (hasta 4 personas):\n• Edzná: $1,800 · con guía $2,500\n• Uxmal: desde $4,000\n• Bahía de Tortugas (playa): $4,000\n• Edzná + Bahía de Tortugas: $5,400\n\nDetalles y reservas: ${WEB}/tours/\n¿Cuál te interesa y para qué día?`,
      `🗺️ *Private taxi tours* (up to 4 people):\n• Edzná: $1,800 MXN · with guide $2,500\n• Uxmal: from $4,000\n• Bahía de Tortugas (beach): $4,000\n• Edzná + Bahía de Tortugas: $5,400\n\nDetails and booking: ${WEB}/en/tours/\nWhich one, and for what day?`));
  } else if (ultimoBtn === "cot") {
    await decir(T(idi,
      "📍 ¿Dónde te recogemos y a dónde vas?\nPuedes mandar tu ubicación con el clip 📎, pegar un link de Google Maps o escribir el lugar (hotel, colonia, aeropuerto, Tren Maya).",
      "📍 Where should we pick you up, and where are you going?\nYou can share your location with the clip 📎, paste a Google Maps link or type the place (hotel, airport, Tren Maya station)."));
  } else if (!hist.length && /^(hola|buen[oa]s?|hi|hello|hey|holi|ola|bonjour|hallo|ciao)\b[\s!.,]*$/i.test(texto)) {
    await menu(T(idi, `👋 ¡Hola${cv.nombre ? " " + cv.nombre.split(" ")[0] : ""}! Soy el asistente de *Taxicel* 🚕. ¿Qué necesitas?`, `👋 Hi${cv.nombre ? " " + cv.nombre.split(" ")[0] : ""}! I'm the *Taxicel* assistant 🚕. How can I help?`));
  } else {
    // 🧠 IA con topes
    let dia = cv.ia_dia === hoy ? cv.ia_hoy : 0;
    const lim = cv.es_equipo ? 3 : (num.ia_por_num ?? 20);
    let ok = !!AI_KEY && dia < lim;
    if (ok && dia === 0) { const { data: t } = await SB.rpc("wa_tope", { p_grupo: grupo, p_tipo: "ia_conv", p_max: num.ia_dia_max ?? 60 }); ok = !!t; }
    if (!ok) {
      await menu(T(idi, `Cotiza al instante en ${WEB} o elige una opción 👇`, `Get an instant price at ${WEB}/en/ or choose an option 👇`));
    } else {
      dia++; upd.ia_dia = hoy; upd.ia_hoy = dia;
      await SB.rpc("wa_tope", { p_grupo: grupo, p_tipo: "ia_msgs", p_max: 0 });
      const msgs: any[] = hist.slice(-14).concat([{ role: "user", content: texto }]);
      let tin = 0, tout = 0, resp = "";
      try {
        for (let vuelta = 0; vuelta < 3; vuelta++) {
          const j = await claude({ max_tokens: 600, system: BOT_SYS(idi, cv.nombre || ""), tools: BOT_TOOLS, messages: msgs });
          tin += j.usage?.input_tokens ?? 0; tout += j.usage?.output_tokens ?? 0;
          msgs.push({ role: "assistant", content: j.content });
          const usos = (j.content ?? []).filter((c: any) => c.type === "tool_use");
          resp = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
          if (!usos.length) break;
          const res: any[] = [];
          for (const u of usos) {
            if (u.name === "cotizar") res.push({ type: "tool_result", tool_use_id: u.id, content: await linkCotizar(u.input, idi) });
            else if (u.name === "pasar_a_persona") { await aPersona(u.input?.motivo ?? "", u.input?.resumen); res.push({ type: "tool_result", tool_use_id: u.id, content: "Listo, ya se avisó a la central. No digas nada más." }); resp = ""; }
          }
          msgs.push({ role: "user", content: res });
          if (pedidoExtra.estado) break;
        }
      } catch (e) { console.error(e); resp = ""; await menu(T(idi, `Cotiza al instante en ${WEB} o elige una opción 👇`, `Get an instant price at ${WEB}/en/ or choose an option 👇`)); }
      if (resp) await decir(resp);
      hist = hist.concat([{ role: "user", content: texto }], resp ? [{ role: "assistant", content: resp }] : []).slice(-16);
      upd.hist = hist;
      await SB.rpc("wa_sumar_uso", { p_grupo: grupo, p_in: 0, p_out: 0, p_tin: tin, p_tout: tout });
    }
  }
  if (!upd.hist) upd.hist = hist.concat([{ role: "user", content: texto }], salen.length ? [{ role: "assistant", content: salen.join("\n") }] : []).slice(-16);
  await SB.from("wa_conv").update(upd).eq("phone_number_id", pnid).eq("cliente_wa", cli);
  await guardarPlatica(pnid, cli, grupo, cv.nombre || perfilNom, entran, salen, pedidoExtra);
  await SB.rpc("wa_sumar_uso", { p_grupo: grupo, p_in: entran.length, p_out: salen.length, p_tin: 0, p_tout: 0 });
}

// ---------------------------------------------------------------- llegada de mensajes
const ACUSE: Record<string, (n: string, f: string[], m: string) => string> = {
  es: (n, f, m) => `¡Hola${n ? " " + n : ""}! 🚕 Gracias por escribir a ${m}. Recibimos tu mensaje y en unos minutos te confirmamos tu taxi y el precio.` + (f.length ? `\n\nPara cotizarte, ¿nos confirmas: ${f.join(", ")}?` : ""),
  en: (n, f, m) => `Hi${n ? " " + n : ""}! 🚕 Thanks for contacting ${m}. We got your message and we'll confirm your taxi and the price in a few minutes.` + (f.length ? `\n\nTo give you a quote, could you confirm: ${f.join(", ")}?` : ""),
};
const FALTA_EN: Record<string, string> = { "hora": "the time", "dónde lo recogemos": "your pickup address", "a dónde va": "your destination", "fecha": "the date", "personas": "how many people" };

async function recibir(value: any) {
  const pnid = value?.metadata?.phone_number_id;
  const msgs: any[] = value?.messages ?? [];
  if (!pnid || !msgs.length) return;
  const { data: num } = await SB.from("wa_numeros").select("*").eq("phone_number_id", pnid).eq("activo", true).maybeSingle();
  if (!num) return;
  const nombres: Record<string, string> = {};
  for (const c of value?.contacts ?? []) nombres[c.wa_id] = c.profile?.name ?? "";
  const porCli: Record<string, any[]> = {};
  for (const m of msgs) (porCli[m.from] ??= []).push(m);

  if ((num.modo ?? "bot") === "bot") {
    for (const [cli, L] of Object.entries(porCli)) { try { await botCliente(num, cli, L, nombres[cli] ?? ""); } catch (e) { console.error(e); } }
    return;
  }
  // modo "pedidos" (como antes)
  const { data: gr } = await SB.from("grupos").select("nombre").eq("id", num.grupo_id).maybeSingle();
  const marca = (gr?.nombre ?? "").trim() || "nuestra central de taxis";
  for (const [cli, L] of Object.entries(porCli)) {
    const hace2h = new Date(Date.now() - 2 * 3600e3).toISOString();
    let { data: ped } = await SB.from("wa_pedidos").select("*").eq("phone_number_id", pnid).eq("cliente_wa", cli)
      .in("estado", ["nuevo", "visto"]).gte("actualizado", hace2h).order("actualizado", { ascending: false }).limit(1).maybeSingle();
    const nuevo = !ped;
    const previos: any[] = ped?.mensajes ?? [];
    const vistos = new Set(previos.map((x) => x.id));
    const entran = L.filter((m) => !vistos.has(m.id)).map((m) => ({ id: m.id, de: "cliente", t: textoDe(m), ts: new Date(+m.timestamp * 1000).toISOString() }));
    if (!entran.length) continue;
    const mensajes = previos.concat(entran);
    let datos: any = ped?.datos ?? {}, tin = 0, tout = 0;
    if (AI_KEY) {
      try { const r = await iaLeer(mensajes.filter((x) => x.de === "cliente").map((x) => x.t)); datos = r.datos; tin = r.tin; tout = r.tout; }
      catch (e) { datos = { ...datos, error_ia: String(e).slice(0, 200) }; }
    }
    try { await abrirLinksDatos(datos); } catch (_) { /* */ }
    const urgente = !!(datos.aeropuerto || datos.tren_maya);
    const fila = { mensajes, datos, urgente, cliente_nombre: datos.nombre || nombres[cli] || ped?.cliente_nombre || null, actualizado: new Date().toISOString() };
    if (nuevo) { const ins = await SB.from("wa_pedidos").insert({ ...fila, grupo_id: num.grupo_id, phone_number_id: pnid, cliente_wa: cli }).select("*").single(); ped = ins.data; }
    else await SB.from("wa_pedidos").update(fila).eq("id", ped.id);
    let salen = 0;
    if (nuevo && num.auto_resp) {
      const id = datos.idioma === "es" || !datos.idioma ? "es" : "en";
      const f: string[] = (datos.falta ?? []).slice(0, 3).map((x: string) => id === "en" ? (FALTA_EN[x] ?? x) : x);
      const txt = ACUSE[id](fila.cliente_nombre?.split(" ")[0] ?? "", datos.es_pedido === false ? [] : f, marca);
      try { await waTexto(pnid, cli, txt); salen++;
        await SB.from("wa_pedidos").update({ mensajes: mensajes.concat([{ id: "auto-" + Date.now(), de: "bot", t: txt, ts: new Date().toISOString() }]) }).eq("id", ped.id);
      } catch (_) { /* */ }
    }
    if (urgente && nuevo && num.alerta_cel && ALERTA_TPL) {
      try {
        await waEnviar(pnid, num.alerta_cel, { type: "template", template: { name: ALERTA_TPL, language: { code: "es_MX" },
          components: [{ type: "body", parameters: [{ type: "text", text: (datos.resumen ?? "Servicio nuevo").slice(0, 900) }] }] } });
        salen++;
      } catch (_) { /* */ }
    }
    await SB.rpc("wa_sumar_uso", { p_grupo: String(num.grupo_id), p_in: entran.length, p_out: salen, p_tin: tin, p_tout: tout });
  }
}

// ---------------------------------------------------------------- 📣 avisos del servicio al cliente (desde la base de datos)
const AVISO: Record<string, (tx: string, link: string) => [string, string]> = {
  en_camino: (tx, l) => [`🚕 Tu taxi${tx} va en camino. Míralo en el mapa: ${l}`, `🚕 Your taxi${tx} is on its way. Track it here: ${l}`],
  cerca: (tx, l) => [`📍 Tu taxi${tx} está a menos de 250 m. ¡Prepárate para salir! ${l}`, `📍 Your taxi${tx} is less than 250 m away. Get ready! ${l}`],
  llego: (tx, l) => [`🛎️ Tu taxi${tx} ya llegó y te está esperando afuera.`, `🛎️ Your taxi${tx} has arrived and is waiting for you outside.`],
  espera: (tx, l) => [`⏱️ Tu taxi${tx} te está esperando. Ya pasó la tolerancia: a partir de ahora puede cobrarse tiempo de espera.`, `⏱️ Your taxi${tx} is waiting for you. The free waiting time is over: waiting time may now be charged.`],
};
async function aviso(id: string, tipo: string) {
  if (!AVISO[tipo]) return { ok: false, msg: "tipo" };
  const { data: s } = await SB.from("servicios").select("id,grupo_id,token,tomado_taxi,idioma,practica").eq("id", id).maybeSingle();
  if (!s || s.practica) return { ok: false, msg: "sin servicio" };
  const { data: c } = await SB.from("servicio_cliente").select("celular").eq("servicio_id", id).maybeSingle();
  let d = String(c?.celular ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (d.length < 10) return { ok: false, msg: "sin celular" };
  if (d.length === 10) d = "52" + d;
  if (d.startsWith("521") && d.length === 13) d = "52" + d.slice(3);
  const { data: nums } = await SB.from("wa_numeros").select("*").eq("grupo_id", s.grupo_id).eq("activo", true).order("creado");
  const num = (nums ?? []).find((n: any) => (n.modo ?? "bot") === "bot") ?? (nums ?? [])[0];
  if (!num || !WA_TOKEN) return { ok: false, msg: "sin número" };
  const { data: cv } = await SB.from("wa_conv").select("idioma,ultimo_in,bloqueado").eq("phone_number_id", num.phone_number_id).eq("cliente_wa", d).maybeSingle();
  if (cv?.bloqueado) return { ok: false, msg: "bloqueado" };
  const idi = s.idioma || cv?.idioma || idiDe(d);
  const link = s.token ? APP + "?s=" + encodeURIComponent(s.token) : WEB;
  const [es, en] = AVISO[tipo](s.tomado_taxi ? " (" + s.tomado_taxi + ")" : "", link);
  const txt = idi === "es" ? es : en;
  const en24 = cv?.ultimo_in && Date.now() - new Date(cv.ultimo_in).getTime() < 23.5 * 3600e3;
  try {
    if (en24) await waTexto(num.phone_number_id, d, txt);
    else {
      if (!AVISO_TPL) return { ok: false, msg: "fuera de 24 h y sin plantilla" };
      const { data: t } = await SB.rpc("wa_tope", { p_grupo: String(s.grupo_id), p_tipo: "avisos", p_max: num.avisos_dia_max ?? 30 });
      if (!t) return { ok: false, msg: "tope de avisos" };
      await waEnviar(num.phone_number_id, d, { type: "template", template: { name: AVISO_TPL, language: { code: idi === "es" ? "es_MX" : "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: txt.slice(0, 900) }] }] } });
    }
  } catch (e) { return { ok: false, msg: String(e).slice(0, 200) }; }
  await SB.rpc("wa_sumar_uso", { p_grupo: String(s.grupo_id), p_in: 0, p_out: 1, p_tin: 0, p_tout: 0 });
  return { ok: true };
}

// ---------------------------------------------------------------- la central contesta desde la agenda
async function yoStaff(req: Request, roles: string[]) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await SB.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: yo } = await SB.from("perfiles").select("id,grupo_id,rol").eq("id", u.user.id).maybeSingle();
  return yo && roles.includes(yo.rol) ? yo : null;
}
async function enviarDesdeApp(req: Request, body: any) {
  const yo = await yoStaff(req, ["admin", "despachador"]);
  if (!yo) return json({ ok: false, msg: "Sin permiso" }, 403);
  const { data: ped } = await SB.from("wa_pedidos").select("*").eq("id", body.pedido_id).maybeSingle();
  if (!ped || String(yo.grupo_id) !== String(ped.grupo_id)) return json({ ok: false, msg: "Sin permiso" }, 403);
  const texto = String(body.texto ?? "").trim();
  if (!texto) return json({ ok: false, msg: "Escribe el mensaje" });
  try { await waTexto(ped.phone_number_id, ped.cliente_wa, texto); }
  catch (e) { return json({ ok: false, msg: String(e).includes("24") ? "Ya pasaron más de 24 horas desde su último mensaje: WhatsApp no deja escribirle primero. Contéstale desde tu celular." : String(e) }); }
  const mensajes = (ped.mensajes ?? []).concat([{ id: "yo-" + Date.now(), de: "central", t: texto, ts: new Date().toISOString() }]);
  await SB.from("wa_pedidos").update({ mensajes, estado: ped.estado === "nuevo" ? "visto" : ped.estado, actualizado: new Date().toISOString() }).eq("id", ped.id);
  // mientras la central contesta, el bot se queda callado 2 h
  await SB.from("wa_conv").update({ humano_hasta: new Date(Date.now() + 2 * 3600e3).toISOString() }).eq("phone_number_id", ped.phone_number_id).eq("cliente_wa", ped.cliente_wa);
  await SB.rpc("wa_sumar_uso", { p_grupo: String(ped.grupo_id), p_in: 0, p_out: 1, p_tin: 0, p_tout: 0 });
  return json({ ok: true });
}
async function leerDesdeApp(req: Request, body: any) {
  const yo = await yoStaff(req, ["admin", "despachador", "programador"]);
  if (!yo) return json({ ok: false, msg: "Sin permiso" }, 403);
  const texto = String(body.texto ?? "").trim().slice(0, 4000);
  if (texto.length < 6) return json({ ok: false, msg: "Mensaje vacío" });
  if (!AI_KEY) return json({ ok: false, msg: "Falta la llave de la IA" });
  try {
    const r = await iaLeer([texto]);
    await abrirLinksDatos(r.datos);
    await SB.rpc("wa_sumar_uso", { p_grupo: String(yo.grupo_id), p_in: 0, p_out: 0, p_tin: r.tin, p_tout: r.tout });
    return json({ ok: true, datos: r.datos });
  } catch (e) { return json({ ok: false, msg: String(e).slice(0, 200) }); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === WA_VERIFY && WA_VERIFY)
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    return new Response("no", { status: 403 });
  }
  const raw = await req.text();
  let body: any = {};
  try { body = JSON.parse(raw); } catch { return json({ ok: false }, 400); }
  if (body.accion === "enviar") return enviarDesdeApp(req, body);
  if (body.accion === "leer") return leerDesdeApp(req, body);
  if (body.accion === "aviso") {
    if (!(await cronOk(req))) return json({ ok: false }, 401);
    return json(await aviso(String(body.id ?? ""), String(body.tipo ?? "")));
  }
  if (body.accion === "maps") {
    const cron = await cronOk(req);
    if (!cron) {
      const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = await SB.auth.getUser(jwt);
      if (!u?.user) return json({ ok: false }, 401);
    }
    const r = await abrirMapsFull(String(body.url ?? "")).catch(() => ({ c: null, url: "" }));
    const ru = rutaDe(r.url);
    if (ru) {
      const a = ru[0], b = ru[ru.length - 1];
      return json({ ok: a.lat != null || b.lat != null, ruta: { o: a, d: b, paradas: ru.slice(1, -1) }, ...(a.lat != null ? { lat: a.lat, lng: a.lng } : {}) });
    }
    return json(r.c ? { ok: true, ...r.c } : { ok: false, ...(cron ? { final: r.url, vistos: VISTOS } : {}) });
  }
  if (!(await firmaOk(req, raw))) return new Response("firma", { status: 401 });
  try {
    for (const e of body.entry ?? []) for (const c of e.changes ?? []) if (c.field === "messages") await recibir(c.value);
  } catch (e) { console.error(e); }
  return json({ ok: true });
});
