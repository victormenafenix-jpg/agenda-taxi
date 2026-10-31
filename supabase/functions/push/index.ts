import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// 📱 App TaxiCentral (Android): los avisos van por Firebase (FCM). La llave está en el secreto FCM_SA.
const b64url = (x: string | Uint8Array) => {
  const s = typeof x === "string" ? x : String.fromCharCode(...x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
let fcmTok: { t: string; exp: number } | null = null;
async function fcmAcceso(sa: { client_email: string; private_key: string }): Promise<string> {
  if (fcmTok && fcmTok.exp > Date.now() + 60000) return fcmTok.t;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim)));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + claim + "." + b64url(sig),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("fcm acceso: " + JSON.stringify(j).slice(0, 200));
  fcmTok = { t: j.access_token, exp: Date.now() + 50 * 60000 };
  return fcmTok.t;
}
async function mandarUno(s: { endpoint: string; p256dh: string; auth: string }, cuerpo: string) {
  if (!s.endpoint.startsWith("fcm:")) {
    return await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      cuerpo,
      { TTL: 3600, urgency: "high" },
    );
  }
  const raw = Deno.env.get("FCM_SA");
  if (!raw) throw new Error("falta FCM_SA");
  const sa = JSON.parse(raw);
  const p = JSON.parse(cuerpo);
  const at = await fcmAcceso(sa);
  const r = await fetch("https://fcm.googleapis.com/v1/projects/" + sa.project_id + "/messages:send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + at },
    body: JSON.stringify({
      message: {
        token: s.endpoint.slice(4),
        data: { url: String(p.url || "./"), tag: String(p.tag || "") },
        android: {
          priority: "high",
          ttl: "3600s",
          notification: {
            title: String(p.title || "TaxiCentral"),
            body: String(p.body || ""),
            channel_id: "servicios",
            sound: "servicio",
            tag: String(p.tag || "servicio"),
            notification_priority: "PRIORITY_MAX",
            visibility: "PUBLIC",
          },
        },
      },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(t) || (r.status === 400 && /token/i.test(t))) {
      throw { statusCode: 410 };
    }
    throw new Error("fcm " + r.status + ": " + t.slice(0, 200));
  }
}

const h12 = (h: string) => {
  if (!h) return "";
  const [H, M] = h.split(":");
  let n = parseInt(H, 10);
  const ap = n >= 12 ? "pm" : "am";
  n = n % 12 || 12;
  return n + ":" + M + " " + ap;
};
const corto = (t: string) => (t || "").split(",")[0];
const GKEY = "AIzaSyCzDGvnfFkSMoQrfWOAUMk8yU3wPSjE0BI";
const llDe = (m: string | null) => {
  const x = String(m || "").match(/[?&](?:q|query|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/) || String(m || "").match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return x ? { lat: +x[1], lng: +x[2] } : null;
};
const pto = (txt: string | null, maps: string | null) => {
  const l = llDe(maps);
  if (l) return { location: { latLng: { latitude: l.lat, longitude: l.lng } } };
  const t = String(txt || "").trim();
  return t ? { address: /campeche/i.test(t) ? t : t + ", Campeche, México" } : null;
};
const linea = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) / 0.5; // ~30 km/h => minutos aprox.
};
async function minutosCalle(o: { lat: number; lng: number }, via: unknown, d: unknown): Promise<number | null> {
  try {
    const body: Record<string, unknown> = { origin: { location: { latLng: { latitude: o.lat, longitude: o.lng } } }, destination: d, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", languageCode: "es-MX", regionCode: "MX" };
    if (via) body.intermediates = [via];
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GKEY, "X-Goog-FieldMask": "routes.duration", "Referer": "https://agenda-taxi.pages.dev/" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const rt = j.routes && j.routes[0];
    if (!r.ok || !rt) return null;
    return parseInt(rt.duration) / 60;
  } catch (_e) { return null; }
}
type Perf = { id: string; rol: string; terminal: boolean | null; factura: boolean | null; transferencia: boolean | null; federal?: boolean | null; van?: boolean | null };
const cumple = (p: Perf, s: { pago?: string; factura?: boolean; aeropuerto?: boolean; vehiculo?: string | null; placas_req?: string | null }) => {
  if (p.rol === "admin" || p.rol === "despachador") return true;
  if (s.vehiculo === "van" && !p.van) return false; // 🚐 solo los que tienen van
  if (s.placas_req === "federal" && !p.federal) return false;
  if (s.placas_req === "estatal" && p.federal) return false;
  if (s.aeropuerto && !p.federal) return false; // aeropuerto: solo placas federales
  if ((s.pago === "Tarjeta débito" || s.pago === "Tarjeta crédito") && !p.terminal) return false;
  if (s.factura && !p.factura) return false;
  if (s.pago === "Transferencia" && !p.transferencia) return false;
  return true;
};
const marcas = (s: { pago?: string; factura?: boolean; aeropuerto?: boolean; vehiculo?: string | null; placas_req?: string | null }) => (s.vehiculo === "van" ? " · 🚐 VAN" : "") + (s.placas_req === "estatal" ? " · PLACAS ESTATALES" : "") + marcas0(s);
const marcas0 = (s: { pago?: string; factura?: boolean; aeropuerto?: boolean }) =>
  ((s.pago === "Tarjeta débito" || s.pago === "Tarjeta crédito") ? " 💳" : "") + (s.pago === "Transferencia" ? " 🏦" : "") + (s.factura ? " 🧾" : "") + (s.aeropuerto ? " ✈️" : "");

async function enviar(admin: any, grupo: string, userIds: string[], payload: unknown, excluir: string | null) {
  const { data: act } = await admin.from("perfiles").select("id").eq("grupo_id", grupo).eq("activo", true).in("id", userIds);
  const ok = (act || []).map((p: { id: string }) => p.id);
  if (!ok.length) return 0;
  const { data: subs, error } = await admin.from("push_subs").select("id,endpoint,p256dh,auth").in("usuario_id", ok);
  if (error) throw new Error("push_subs: " + error.message);
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC")!,
    Deno.env.get("VAPID_PRIVATE")!,
  );
  let enviados = 0;
  const borrar: string[] = [];
  await Promise.all((subs || []).filter((s: { endpoint: string }) => s.endpoint !== excluir).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await mandarUno(s, JSON.stringify(payload));
      enviados++;
    } catch (e) {
      const c = (e as { statusCode?: number }).statusCode;
      if (c === 404 || c === 410) borrar.push(s.id);
      else if (s.endpoint.startsWith("fcm:")) console.error("fcm", e);
    }
  }));
  if (borrar.length) await admin.from("push_subs").delete().in("id", borrar);
  return enviados;
}

// 🎉 Aviso de asignación: al ganador "ES TUYO"; a los demás, a quién se lo dieron y a cuántos minutos estaba cada uno
type Asig = { id: string; expres: boolean; hora: string; ubic: string; destino: string; costo: number; tomado_por: string; tomado_nombre: string; tomado_taxi: string; practica?: boolean; quiero_snap?: { uid?: string; taxi?: string; min?: number | null; gano?: boolean }[] | null };
async function avisoAsig(admin: any, gid: string, a: Asig, otros: string[]) {
  const pre = a.practica ? "🎓 PRÁCTICA · " : "";
  const precio = a.expres ? "⚡ EXPRÉS $" + a.costo : "🕐 " + h12(a.hora) + " · $" + a.costo;
  const n1 = await enviar(admin, gid, [a.tomado_por], {
    title: pre + "🎉 ¡ES TUYO! " + precio,
    body: corto(a.ubic) + " → " + corto(a.destino) + (a.expres ? " · Abre y toca YA VOY EN CAMINO" : ""),
    tag: "asig-" + a.id, expres: true, url: "./?asig=" + a.id,
  }, null);
  const snap = Array.isArray(a.quiero_snap) ? a.quiero_snap : [];
  const win = snap.find((x) => x.gano);
  const wtxt = (a.tomado_taxi || "") + (win && win.min != null ? " (estaba a " + win.min + " min del cliente)" : "");
  let n2 = 0;
  await Promise.all(otros.filter((x) => x !== a.tomado_por).slice(0, 30).map(async (uid) => {
    const yo = snap.find((x) => x.uid === uid);
    n2 += await enviar(admin, gid, [uid], {
      title: "❌ Se lo dieron a " + (a.tomado_taxi || "otro compañero"),
      body: "Se lo dieron a " + wtxt + (yo && yo.min != null ? " · tú estabas a " + yo.min + " min" : "") + ". " + corto(a.ubic),
      tag: "asig-" + a.id + "-o", expres: false, url: "./?perdido=" + a.id,
    }, null);
  }));
  return { n1, n2 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Reloj automático (cada 5 min): programados que siguen sin cubrir
    const cronKey = req.headers.get("x-cron");
    if (cronKey) {
      const { data: cfg } = await admin.from("config").select("valor").eq("clave", "cron").maybeSingle();
      if (!cfg || cfg.valor !== cronKey) return json({ error: "no autorizado" }, 401);
      let cuerpo: { tipo?: string; id?: string; h?: number; otros?: string[]; sube?: number; red?: boolean; gid?: string; ev?: string; esp?: number; lib?: number; sug?: number; pct?: number; ids?: string[]; queda?: number } = {};
      try { cuerpo = await req.json(); } catch (_e) { cuerpo = {}; }
      if (cuerpo.tipo === "auto_elegir" && cuerpo.id) {
        const { data: sv } = await admin.from("servicios").select("id,grupo_id,estado,ubic,ubic_maps").eq("id", cuerpo.id).maybeSingle();
        if (!sv || sv.estado !== "disponible") return json({ ok: 0 });
        const { data: R } = await admin.from("interesados").select("*").eq("servicio_id", sv.id);
        if (!R || !R.length) return json({ ok: 0 });
        const dest = pto(sv.ubic, sv.ubic_maps), sll = llDe(sv.ubic_maps);
        const cand = await Promise.all(R.map(async (r: { usuario_id: string; lat: number | null; lng: number | null; creado: string; nombre: string; taxi: string }) => {
          if (r.lat == null || r.lng == null || !dest) return { r, min: 1e9 };
          const { data: ab } = await admin.from("servicios").select("destino,destino_maps").eq("tomado_por", r.usuario_id).eq("estado", "abordo").limit(1).maybeSingle();
          const via = ab ? pto(ab.destino, ab.destino_maps) : null;
          let m = await minutosCalle({ lat: r.lat, lng: r.lng }, via, dest);
          if (m == null && sll) m = linea({ lat: r.lat, lng: r.lng }, sll);
          return { r, min: m == null ? 1e8 : m };
        }));
        // 🏁 Índice de prioridad (últimos 7 días): ajusta los minutos según el factor de cada taxista
        let fac: Record<string, number> = {};
        try { const { data: fx } = await admin.rpc("indice_factores", { p_grupo: sv.grupo_id }); fac = (fx || {}) as Record<string, number>; } catch (_e) { fac = {}; }
        const ef = (c: { r: { usuario_id: string }; min: number }) => { const f = fac[c.r.usuario_id]; if (c.min >= 1e8) return c.min; if (f === 0) return -1; return c.min * (f == null ? 1 : Number(f)); };
        cand.sort((a, b) => ef(a) - ef(b) || new Date(a.r.creado).getTime() - new Date(b.r.creado).getTime());
        const fijaW = fac[cand[0].r.usuario_id] === 0 && cand[0].min < 1e8;
        let w = cand[0].r;
        // Ventaja para programadores: si llega a lo mucho X minutos después del más cercano, es para él
        if (cand[0].min < 1e8) {
          const { data: gq } = await admin.from("grupos").select("ventaja_prog").eq("id", sv.grupo_id).maybeSingle();
          const vent = Number(gq?.ventaja_prog ?? 2);
          if (vent > 0) {
            const { data: roles } = await admin.from("perfiles").select("id,rol").in("id", cand.map((c) => c.r.usuario_id));
            const esProg = new Set((roles || []).filter((x: { rol: string }) => x.rol === "programador").map((x: { id: string }) => x.id));
            const pr = cand.find((c) => esProg.has(c.r.usuario_id) && c.min <= cand[0].min + vent);
            if (pr) w = pr.r;
          }
        }
        // 🏅 Preferencia a los puntuales: solo dentro del grupo dueño del servicio y si el grupo la prendió
        try {
          const { data: sv2 } = await admin.from("servicios").select("solo_equipo,creado_por").eq("id", sv.id).maybeSingle();
          let oe: string | null = sv2?.solo_equipo ?? null;
          if (!oe && sv2?.creado_por) {
            const { data: cp } = await admin.from("perfiles").select("equipo_id,rol").eq("id", sv2.creado_por).maybeSingle();
            oe = cp?.rol === "programador" ? (cp?.equipo_id ?? null) : null;
          }
          const { data: cf } = oe
            ? await admin.from("equipos").select("puntual_pref,puntual_min").eq("id", oe).maybeSingle()
            : await admin.from("grupos").select("puntual_pref,puntual_min").eq("id", sv.grupo_id).maybeSingle();
          if (cf?.puntual_pref) {
            const X = Number(cf.puntual_min ?? 2);
            // deno-lint-ignore no-explicit-any
            const rr = (c: { r: any }) => c.r;
            const mio = (c: { r: unknown }) => (rr(c as { r: { eq?: string } }).eq ?? null) === (oe ?? null);
            const wc = cand.find((c) => c.r.usuario_id === w.usuario_id);
            if (wc && rr(wc).atrasado && mio(wc)) {
              const p = cand.find((c) => c !== wc && mio(c) && !rr(c).atrasado && c.min <= wc.min + X);
              if (p) w = p.r;
            }
          }
        } catch (_e) { /* si falla, se queda el más cercano */ }
        if (fijaW) w = cand[0].r;
        const snap = cand.map((c) => ({ uid: c.r.usuario_id, taxi: c.r.taxi, nombre: c.r.nombre, lat: c.r.lat, lng: c.r.lng, min: c.min < 1e8 ? Math.round(c.min) : null, gano: c.r.usuario_id === w.usuario_id }));
        const { data: up } = await admin.from("servicios").update({ estado: "tomado", tomado_por: w.usuario_id, tomado_nombre: w.nombre, tomado_taxi: w.taxi, tomado_en: new Date().toISOString(), tomado_lat: w.lat, tomado_lng: w.lng, quiero_snap: snap, asig_aviso: true }).eq("id", sv.id).eq("estado", "disponible").select("id");
        if (!up || !up.length) return json({ ok: 0 });
        await admin.from("interesados").delete().eq("servicio_id", sv.id);
        cuerpo = { tipo: "asignado_auto", id: sv.id, otros: R.map((x: { usuario_id: string }) => x.usuario_id).filter((x: string) => x !== w.usuario_id) } as typeof cuerpo;
      }
      // Mensaje del cliente → al taxista (si no hay taxista, a la central)
      if (cuerpo.tipo === "msg" && cuerpo.id) {
        const { data: m } = await admin.from("mensajes").select("id,servicio_id,de,texto").eq("id", cuerpo.id).maybeSingle();
        if (!m || m.de !== "cliente") return json({ enviados: 0 });
        const { data: sv } = await admin.from("servicios").select("id,grupo_id,folio,tomado_por").eq("id", m.servicio_id).maybeSingle();
        if (!sv) return json({ enviados: 0 });
        let dest: string[] = [];
        if (sv.tomado_por) dest = [sv.tomado_por];
        else {
          const { data: st } = await admin.from("perfiles").select("id").eq("grupo_id", sv.grupo_id).eq("activo", true).in("rol", ["admin", "despachador"]);
          dest = (st || []).map((x: { id: string }) => x.id);
        }
        const t = String(m.texto || "");
        const n = await enviar(admin, sv.grupo_id, dest, {
          title: "💬 Mensaje del cliente" + (sv.folio ? " · T-" + String(sv.folio).padStart(4, "0") : ""),
          body: t.length > 150 ? t.slice(0, 147) + "…" : t,
          tag: "msg-" + sv.id, expres: true, url: "./?serv=" + sv.id + "&chat=1",
        }, null);
        return json({ enviados: n });
      }
      // El cliente subió la captura de su transferencia
      if (cuerpo.tipo === "comprobante" && cuerpo.id) {
        const { data: sv } = await admin.from("servicios").select("id,grupo_id,folio,tomado_por,costo").eq("id", cuerpo.id).maybeSingle();
        if (!sv) return json({ enviados: 0 });
        const { data: st } = await admin.from("perfiles").select("id").eq("grupo_id", sv.grupo_id).eq("activo", true).in("rol", ["admin", "despachador"]);
        const dest = (sv.tomado_por ? [sv.tomado_por] : []).concat((st || []).map((x: { id: string }) => x.id));
        const n = await enviar(admin, sv.grupo_id, dest, {
          title: "💸 El cliente ya transfirió" + (sv.folio ? " · T-" + String(sv.folio).padStart(4, "0") : ""),
          body: "Revisa el comprobante en el servicio y confirma que te llegó.",
          tag: "comp-" + sv.id, expres: true, url: "./?serv=" + sv.id,
        }, null);
        return json({ enviados: n });
      }
      // ⚡ Alta demanda: aviso al administrador (y a los taxistas cuando se prende)
      if (cuerpo.tipo === "alta" && cuerpo.gid) {
        const { data: per } = await admin.from("perfiles").select("id,rol").eq("grupo_id", cuerpo.gid).eq("activo", true);
        const ads = (per || []).filter((p: { rol: string }) => p.rol === "admin").map((p: { id: string }) => p.id);
        const tx = (per || []).filter((p: { rol: string }) => p.rol === "taxista" || p.rol === "programador").map((p: { id: string }) => p.id);
        const esp = Number(cuerpo.esp || 0), lib = Number(cuerpo.lib || 0);
        const sit = esp + " pedido" + (esp === 1 ? "" : "s") + " esperando y " + lib + " taxi" + (lib === 1 ? "" : "s") + " libre" + (lib === 1 ? "" : "s");
        let n = 0;
        if (cuerpo.ev === "aviso") {
          n += await enviar(admin, cuerpo.gid, ads, { title: "⚡ Alta demanda: " + sit, body: "Sugerido +" + cuerpo.sug + "%. Toca para revisar y prenderla.", tag: "alta-aviso", expres: true, url: "./?alta=1" }, null);
        } else if (cuerpo.ev === "on") {
          n += await enviar(admin, cuerpo.gid, ads, { title: "⚡ Alta demanda PRENDIDA · +" + cuerpo.pct + "%", body: sit + ". Se apaga sola cuando baje.", tag: "alta-aviso", expres: false, url: "./?alta=1" }, null);
          n += await enviar(admin, cuerpo.gid, tx, { title: "⚡ ALTA DEMANDA · los pedidos pagan +" + cuerpo.pct + "%", body: "Hay " + esp + " pedido" + (esp === 1 ? "" : "s") + " esperando. ¡Abre la agenda y tómalos!", tag: "alta-tx", expres: true, url: "./" }, null);
        } else if (cuerpo.ev === "off") {
          n += await enviar(admin, cuerpo.gid, ads, { title: "✅ Se apagó la alta demanda", body: "Ya bajaron los pedidos. Los precios regresan a lo normal.", tag: "alta-aviso", expres: false, url: "./?alta=1" }, null);
        }
        return json({ enviados: n });
      }
      // 📣 Evento: un coordinador pidió unidades a su punto
      if (cuerpo.tipo === "evento" && Array.isArray(cuerpo.ids) && cuerpo.ids.length) {
        const { data: sv } = await admin.from("servicios").select("id,grupo_id,estado,ubic,destino,costo,foraneo,ev_txt,personas").in("id", cuerpo.ids.slice(0, 30));
        const L = (sv || []).filter((x: { estado: string }) => x.estado === "disponible");
        if (!L.length) return json({ enviados: 0 });
        const a = L[0];
        const { data: act } = await admin.from("perfiles").select("id").eq("grupo_id", a.grupo_id).eq("activo", true);
        const n = await enviar(admin, a.grupo_id, (act || []).map((p: { id: string }) => p.id), {
          title: String(a.ev_txt || "📣 EVENTO").toUpperCase().slice(0, 70) + " · " + L.length + " unidad" + (L.length > 1 ? "es" : "") + " · $" + a.costo + (a.foraneo ? " 🛣️" : ""),
          body: corto(a.ubic) + " → " + corto(a.destino) + " · ya pagado, no se cobra al pasajero",
          tag: "ev-" + a.id, expres: true, url: "./",
        }, null);
        return json({ enviados: n });
      }
      if (cuerpo.tipo === "ev_saldo" && cuerpo.id) {
        const { data: ev } = await admin.from("eventos").select("id,grupo_id,nombre").eq("id", cuerpo.id).maybeSingle();
        if (!ev) return json({ enviados: 0 });
        const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", ev.grupo_id).eq("rol", "admin").eq("activo", true);
        const n = await enviar(admin, ev.grupo_id, (ads || []).map((x: { id: string }) => x.id), {
          title: "💰 " + ev.nombre + ": queda poco crédito", body: "Quedan $" + (cuerpo.queda ?? 0) + ". Pídele a la oficina que transfiera para seguir mandando unidades.",
          tag: "evs-" + ev.id, expres: true, url: "./",
        }, null);
        return json({ enviados: n });
      }
      // 🕵️ Después de terminar: se alejó mucho o cerró la app (aviso al administrador)
      if (cuerpo.tipo === "post" && cuerpo.id) {
        const { data: sv } = await admin.from("servicios").select("id,grupo_id,folio,tomado_taxi,tomado_nombre,post_km,destino").eq("id", cuerpo.id).maybeSingle();
        if (!sv) return json({ enviados: 0 });
        const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", sv.grupo_id).eq("rol", "admin").eq("activo", true);
        const quien = (sv.tomado_taxi || "") + (sv.tomado_nombre ? " · " + sv.tomado_nombre : "");
        const lejos = cuerpo.ev === "lejos";
        const n = await enviar(admin, sv.grupo_id, (ads || []).map((x: { id: string }) => x.id), {
          title: lejos ? "🕵️ " + quien + " se alejó " + sv.post_km + " km después de terminar" : "📴 " + quien + " cerró la app al terminar",
          body: (lejos ? "Puede ir de regreso a su base, o seguir con el cliente sin la app. " : "Dejó de mandar su ubicación justo al terminar. ") + "Folio " + (sv.folio ?? "") + (sv.destino ? " · " + corto(sv.destino) : "") + ". Toca para ver el recorrido.",
          tag: "post-" + sv.id, expres: false, url: "./?post=" + sv.id,
        }, null);
        return json({ enviados: n });
      }
      // ⚠️ Reporte de la calle (inundación, accidente, retén…): a todos menos al que lo mandó
      if (cuerpo.tipo === "reporte" && cuerpo.id) {
        const { data: rp } = await admin.from("reportes").select("id,grupo_id,usuario_id,tipo,dir,nota,lat,lng").eq("id", cuerpo.id).maybeSingle();
        if (!rp) return json({ enviados: 0 });
        const { data: q } = await admin.from("perfiles").select("nombre,taxi").eq("id", rp.usuario_id).maybeSingle();
        const { data: per } = await admin.from("perfiles").select("id").eq("grupo_id", rp.grupo_id).eq("activo", true).neq("id", rp.usuario_id);
        const TT: Record<string, string> = { inundacion: "🌊 INUNDACIÓN", accidente: "💥 ACCIDENTE", reten: "👮 RETÉN", obra: "🚧 CALLE CERRADA / OBRA", lluvia: "🌧️ LLUEVE", otro: "⚠️ CUIDADO" };
        const n = await enviar(admin, rp.grupo_id, (per || []).map((p: { id: string }) => p.id), {
          title: (TT[rp.tipo] || "⚠️ REPORTE") + (rp.dir ? " · " + String(rp.dir).split(",")[0] : ""),
          body: (rp.dir || "Ver en el mapa") + (rp.nota ? " · " + String(rp.nota).slice(0, 100) : "") + " · reportó " + (q?.taxi || q?.nombre || "un compañero"),
          tag: "rep-" + rp.id, expres: false, url: "./?rep=" + rp.id,
        }, null);
        return json({ enviados: n });
      }
      // Pedido de un cliente desde "Pide tu taxi": avisa a todos los que pueden tomarlo
      if (cuerpo.tipo === "pedido" && cuerpo.id) {
        const { data: pd } = await admin.from("servicios").select("id,grupo_id,estado,expres,hora,fecha,ubic,destino,costo,extra,pago,factura,aeropuerto,idioma,solo_equipo,solo_hasta,alta_pct").eq("id", cuerpo.id).maybeSingle();
        if (!pd || pd.estado !== "disponible") return json({ enviados: 0 });
        const { data: act } = await admin.from("perfiles").select("id,rol,terminal,factura,transferencia,federal,equipo_id,equipos_extra").eq("grupo_id", pd.grupo_id).eq("activo", true);
        // La red: el primer minuto solo le suena al equipo dueño del cliente; al liberarse, a todos los demás
        let eqNom = "";
        if (pd.solo_equipo) { const { data: eq } = await admin.from("equipos").select("nombre").eq("id", pd.solo_equipo).maybeSingle(); eqNom = eq?.nombre || ""; }
        const soloEq = !!pd.solo_equipo && !!pd.solo_hasta && new Date(pd.solo_hasta).getTime() > Date.now() && !cuerpo.red;
        const enEq = (p: { equipo_id?: string; equipos_extra?: string[] | null }) => p.equipo_id === pd.solo_equipo || (p.equipos_extra || []).includes(String(pd.solo_equipo));
        const ok = ((act || []) as (Perf & { equipo_id?: string; equipos_extra?: string[] | null })[]).filter((p) => cumple(p, pd))
          .filter((p) => soloEq ? (enEq(p) || p.rol === "admin" || p.rol === "despachador") : (cuerpo.red ? !enEq(p) : true))
          .map((p) => p.id);
        if (!ok.length) return json({ enviados: 0 });
        const n = await enviar(admin, pd.grupo_id, ok, {
          title: (pd.alta_pct ? "⚡ +" + pd.alta_pct + "% ALTA DEMANDA · " : "") + (cuerpo.red ? "🤝 DE " + eqNom.toUpperCase() + " · ¡LIBRE PARA TODOS! · " : "") + (cuerpo.sube ? "💰 SUBIÓ LA OFERTA +$" + cuerpo.sube + " · " : "📱 PEDIDO POR APP" + (eqNom && !cuerpo.red ? " " + eqNom.toUpperCase() : "") + " · ") + (pd.expres ? "⚡ EXPRÉS $" : "🕐 " + h12(pd.hora) + " · $") + (Number(pd.costo) + Number(pd.extra || 0)) + (Number(pd.extra || 0) > 0 ? " (+$" + pd.extra + " extra)" : "") + marcas(pd),
          body: corto(pd.ubic) + " → " + corto(pd.destino),
          tag: "sv-" + pd.id + (cuerpo.sube ? "-s" + Date.now() : "") + (cuerpo.red ? "-red" : ""), expres: !!pd.expres, url: "./",
        }, null);
        return json({ enviados: n });
      }
      if (cuerpo.tipo === "registro" && cuerpo.id) {
        const { data: nu } = await admin.from("perfiles").select("id,grupo_id,nombre,cel,rol,taxi,equipo_id,activo").eq("id", cuerpo.id).maybeSingle();
        if (!nu || nu.activo) return json({ enviados: 0 });
        let eqn = "";
        if (nu.equipo_id) { const { data: e } = await admin.from("equipos").select("nombre").eq("id", nu.equipo_id).maybeSingle(); eqn = e?.nombre ? " · " + e.nombre : ""; }
        const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", nu.grupo_id).eq("rol", "admin").eq("activo", true);
        const n = await enviar(admin, nu.grupo_id, (ads || []).map((x: { id: string }) => x.id), {
          title: "🆕 " + (nu.nombre || "Alguien") + " pide entrar",
          body: (nu.rol === "programador" ? "📋 Programador" : "🚕 Taxista") + (nu.taxi ? " " + nu.taxi : "") + eqn + " · " + (nu.cel || "") + ". Actívalo en Equipo",
          tag: "reg-" + nu.id, expres: true, url: "./",
        }, null);
        return json({ enviados: n });
      }
      if (cuerpo.tipo === "recarga" && cuerpo.id) {
        const { data: rc } = await admin.from("recargas").select("id,grupo_id,perfil_id,monto").eq("id", cuerpo.id).maybeSingle();
        if (!rc) return json({ enviados: 0 });
        const { data: q } = await admin.from("perfiles").select("nombre,taxi").eq("id", rc.perfil_id).maybeSingle();
        const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", rc.grupo_id).eq("rol", "admin").eq("activo", true);
        const n = await enviar(admin, rc.grupo_id, (ads || []).map((x: { id: string }) => x.id), {
          title: "💰 Recarga por revisar · $" + rc.monto, body: (q?.taxi || "") + " " + (q?.nombre || "") + " mandó su comprobante. Revísalo en 💰 Cuentas",
          tag: "rec-" + rc.id, expres: false, url: "./",
        }, null);
        return json({ enviados: n });
      }
      if (cuerpo.tipo === "docs") {
        // Avisos de saldo (una vez al día): bienvenida por vencer, saldo bajo y saldo en contra
        try {
          const hoyS = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
          const { data: PS } = await admin.from("perfiles").select("id,grupo_id,rol,modo").eq("activo", true).eq("modo", "comision").in("rol", ["taxista", "programador"]);
          const { data: GS } = await admin.from("grupos").select("id,bono_vence,aviso_saldo,credito_max");
          const gm = new Map((GS || []).map((g: { id: string }) => [g.id, g]));
          for (const p of (PS || []) as { id: string; grupo_id: string }[]) {
            const g = gm.get(p.grupo_id) as { bono_vence: string; aviso_saldo: number; credito_max: number } | undefined;
            if (!g) continue;
            const { data: sd } = await admin.rpc("saldo_de", { p_uid: p.id });
            const { data: bn } = await admin.rpc("bono_de", { p_uid: p.id });
            const saldo = Number(sd || 0), bono = Number(bn || 0);
            const dv = Math.round((new Date(g.bono_vence).getTime() - new Date(hoyS).getTime()) / 864e5);
            let t = "", b = "";
            if (bono > 0 && (dv === 5 || dv === 1)) { t = "🎁 Te quedan $" + Math.round(bono) + " de bienvenida"; b = "Vencen en " + dv + " día" + (dv > 1 ? "s" : "") + ". Úsalos tomando servicios."; }
            else if (saldo < 0) { t = "🔴 Debes $" + Math.round(-saldo) + " de comisiones"; b = "Recarga en 💰 Mi cuenta. Si pasas de -$" + g.credito_max + " ya no podrás tomar servicios."; }
            else if (saldo <= Number(g.aviso_saldo || 30)) { t = "🟡 Te quedan $" + Math.round(saldo) + " de saldo"; b = "Recarga pronto en 💰 Mi cuenta."; }
            if (t) await enviar(admin, p.grupo_id, [p.id], { title: t, body: b, tag: "saldo-" + p.id, expres: false, url: "./" }, null);
          }
        } catch (e) { console.error("saldos", e); }
        const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
        const lim = new Date(Date.now() - 6 * 3600e3 + 15 * 864e5).toISOString().slice(0, 10);
        const { data: D } = await admin.from("documentos").select("id,grupo_id,perfil_id,tipo,vence,avisado").not("vence", "is", null).lte("vence", lim);
        let tot = 0;
        for (const d of (D || []) as { id: string; grupo_id: string; perfil_id: string; tipo: string; vence: string; avisado: string | null }[]) {
          if (d.avisado === hoy) continue;
          const dias = Math.round((new Date(d.vence).getTime() - new Date(hoy).getTime()) / 864e5);
          if (dias >= 0 && dias !== 15 && dias !== 7 && dias !== 3 && dias !== 1 && dias !== 0) continue;
          if (dias < 0 && (-dias) % 7 !== 1) continue;
          const txt = dias > 0 ? "vence en " + dias + " día" + (dias > 1 ? "s" : "") : dias === 0 ? "vence HOY" : "está VENCIDO";
          tot += await enviar(admin, d.grupo_id, [d.perfil_id], { title: "📁 Tu " + d.tipo + " " + txt, body: "Sube el nuevo en la agenda: 📁 Mis documentos", tag: "doc-" + d.id, expres: dias <= 0, url: "./" }, null);
          const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", d.grupo_id).eq("rol", "admin").eq("activo", true);
          const { data: q } = await admin.from("perfiles").select("nombre,taxi").eq("id", d.perfil_id).maybeSingle();
          tot += await enviar(admin, d.grupo_id, (ads || []).map((x: { id: string }) => x.id), { title: "📁 " + (q?.taxi || "") + " " + (q?.nombre || "") + ": " + d.tipo + " " + txt, body: "Revísalo en Equipo", tag: "doca-" + d.id, expres: false, url: "./" }, null);
          await admin.from("documentos").update({ avisado: hoy }).eq("id", d.id);
        }
        return json({ enviados: tot });
      }
      if (cuerpo.tipo === "asignado_auto" && cuerpo.id) {
        const { data: a } = await admin.from("servicios").select("id,grupo_id,expres,hora,ubic,destino,costo,tomado_por,tomado_nombre,tomado_taxi,practica,quiero_snap").eq("id", cuerpo.id).maybeSingle();
        if (!a || !a.tomado_por) return json({ enviados: 0 });
        const ot = Array.isArray((cuerpo as { otros?: string[] }).otros) ? (cuerpo as { otros: string[] }).otros : [];
        const r = await avisoAsig(admin, a.grupo_id, a, ot);
        return json({ enviados: r.n1, otros: r.n2 });
      }
      // 🚐 Van 14: el cliente pidió cotización → administrador y representantes de la van (sin teléfono del cliente)
      if (cuerpo.tipo === "cotvan" && cuerpo.id) {
        const { data: c } = await admin.from("cot_van").select("id,grupo_id,nombre,ubic,destino,fecha,hora,personas").eq("id", cuerpo.id).maybeSingle();
        if (!c) return json({ enviados: 0 });
        const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", c.grupo_id).eq("rol", "admin").eq("activo", true);
        const { data: reps } = await admin.from("cot_van_rep").select("uid");
        const para = [...new Set([...(ads || []).map((x: { id: string }) => x.id), ...(reps || []).map((x: { uid: string }) => x.uid)])];
        if (!para.length) return json({ enviados: 0 });
        const n = await enviar(admin, c.grupo_id, para, {
          title: "🚐 Cotización de Van 14 · " + (c.personas || 1) + " pers.",
          body: corto(c.ubic || "") + " → " + corto(c.destino || "") + (c.fecha ? " · " + c.fecha + (c.hora ? " " + h12(c.hora) : "") : ""),
          tag: "cotvan-" + c.id, expres: true, url: "./?cotvan=1",
        }, null);
        return json({ enviados: n });
      }
      // 🗺️ Tours: nueva reserva o cotización de un turista → gerente, coordinadores del equipo y admin
      if (cuerpo.tipo === "tour" && cuerpo.id) {
        const { data: r } = await admin.from("tu_reservas").select("id,equipo_id,folio,tipo,estado,nombre,personas,fecha,hora,vuelo,total,vtipo,equipaje,destino").eq("id", cuerpo.id).maybeSingle();
        if (!r) return json({ enviados: 0 });
        const { data: e } = await admin.from("equipos").select("id,grupo_id,nombre,gerente").eq("id", r.equipo_id).maybeSingle();
        if (!e) return json({ enviados: 0 });
        const { data: per } = await admin.from("perfiles").select("id,rol,equipo_id").eq("grupo_id", e.grupo_id).eq("activo", true);
        const para = (per || []).filter((x: { id: string; rol: string; equipo_id: string | null }) => x.rol === "admin" || x.id === e.gerente || (x.equipo_id === e.id && x.rol === "programador")).map((x: { id: string }) => x.id);
        const TT: Record<string, string> = { tour: "🗺️ Tour", privado: "🚐 Traslado privado", colectivo: "👥 Colectivo", ironman: "🚴 IRONMAN" };
        const eq = r.equipaje || {};
        const n = await enviar(admin, e.grupo_id, para, {
          title: (r.estado === "cotizacion" ? "💬 Cotización " : "✅ Reserva ") + e.nombre + " · " + (TT[r.tipo] || r.tipo) + " · $" + (r.total ?? "?"),
          body: (r.nombre || "") + " · " + r.personas + " pers." + (r.fecha ? " · " + r.fecha + (r.hora ? " " + h12(r.hora) : "") : "") + (r.vuelo ? " · vuelo " + r.vuelo : "") + (eq.bici ? " · 🚴 " + eq.bici + " bici" : "") + (r.destino ? " · " + corto(r.destino) : ""),
          tag: "tour-" + r.id, expres: true, url: "./?tours=1",
        }, null);
        return json({ enviados: n });
      }
      // ⏰ Servicio abierto hace mucho / 🎉 asignado sin confirmar / 🧾 el cliente dice otro precio → al administrador
      if ((cuerpo.tipo === "abierto" || cuerpo.tipo === "sinconf" || cuerpo.tipo === "difiere") && cuerpo.id) {
        const { data: v } = await admin.from("servicios").select("id,grupo_id,folio,estado,hora,ubic,destino,tomado_por,tomado_taxi,tomado_nombre,tomado_en,llego_en,abordo_en,en_camino_en,creado_por,costo,extra,cargo_espera,descuento,cortesia,cli_pago").eq("id", cuerpo.id).maybeSingle();
        if (!v) return json({ enviados: 0 });
        let gid = v.grupo_id;
        if (cuerpo.tipo === "abierto" && v.tomado_por) {
          const { data: tp } = await admin.from("perfiles").select("grupo_id").eq("id", v.tomado_por).maybeSingle();
          if (tp?.grupo_id) gid = tp.grupo_id;
        }
        const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", gid).eq("rol", "admin").eq("activo", true);
        const para = (ads || []).map((x: { id: string }) => x.id);
        if (cuerpo.tipo === "sinconf" && v.creado_por && !para.includes(v.creado_por)) para.push(v.creado_por);
        const quien = (v.tomado_taxi || "") + (v.tomado_nombre ? " · " + v.tomado_nombre : "");
        const ST: Record<string, string> = { en_camino: "En camino", llego: "Llegué", abordo: "Abordó" };
        const desde = v.abordo_en || v.llego_en || v.en_camino_en || v.tomado_en;
        const hrs = desde ? Math.round((Date.now() - new Date(desde).getTime()) / 360000) / 10 : 0;
        const app = Number(v.costo || 0) + Number(v.extra || 0) + Number(v.cargo_espera || 0) - Number(v.descuento || 0) - Number(v.cortesia || 0);
        const P: Record<string, { title: string; body: string }> = {
          abierto: { title: "⏰ " + quien + " tiene un servicio abierto hace " + hrs + " h", body: "Folio " + (v.folio ?? "") + " sigue en \"" + (ST[v.estado] || v.estado) + "\" · " + corto(v.ubic) + ". Ciérralo en 🗺️ En vivo (sin cobrar espera)." },
          sinconf: { title: "⚠️ " + quien + " no ha confirmado el servicio", body: "Folio " + (v.folio ?? "") + " · " + corto(v.ubic) + ". Se lo asignaron hace más de 2 min y no ha tocado Ya voy en camino." },
          difiere: { title: "🧾 Folio " + (v.folio ?? "") + ": el cliente dice otro precio", body: "La app dice $" + app + ", el cliente dice que pagó $" + (v.cli_pago ?? "?") + " · " + quien },
        };
        const n = await enviar(admin, gid, para, { ...P[cuerpo.tipo], tag: cuerpo.tipo + "-" + v.id, expres: cuerpo.tipo === "sinconf", url: "./?vivo=1" }, null);
        return json({ enviados: n });
      }
      // ⏰ Recordatorio de servicio programado: 1 día antes y 2 horas antes
      if (cuerpo.tipo === "recordar" && cuerpo.id) {
        const { data: v } = await admin.from("servicios").select("id,grupo_id,folio,estado,fecha,hora,ubic,destino,costo,tomado_por,creado_por").eq("id", cuerpo.id).maybeSingle();
        if (!v || v.estado !== "tomado" || !v.tomado_por) return json({ enviados: 0 });
        const para: string[] = [v.tomado_por];
        if (v.creado_por && v.creado_por !== v.tomado_por) {
          const { data: cp } = await admin.from("perfiles").select("rol").eq("id", v.creado_por).maybeSingle();
          if (cp?.rol === "programador") para.push(v.creado_por);
        }
        const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
        const f = new Date(String(v.fecha) + "T12:00:00");
        const dia = DIAS[f.getDay()] + " " + f.getDate();
        const h2 = Number(cuerpo.h) === 2;
        const n = await enviar(admin, v.grupo_id, para, {
          title: (h2 ? "⏰ En 2 horas tienes servicio · " : "⏰ Mañana tienes servicio · ") + h12(String(v.hora)) + (h2 ? "" : " (" + dia + ")"),
          body: corto(v.ubic) + " → " + corto(v.destino) + " · $" + Number(v.costo || 0) + " · Folio T-" + String(v.folio ?? "").padStart(4, "0"),
          tag: "rec-" + v.id + "-" + (h2 ? 2 : 24), expres: h2, url: "./",
        }, null);
        return json({ enviados: n });
      }
      if (cuerpo.tipo === "calif" && cuerpo.id) {
        const { data: c } = await admin.from("calificaciones").select("servicio_id,grupo_id,estrellas,comentario").eq("servicio_id", cuerpo.id).maybeSingle();
        if (!c) return json({ enviados: 0 });
        const { data: sv } = await admin.from("servicios").select("folio,tomado_taxi,tomado_nombre").eq("id", c.servicio_id).maybeSingle();
        const { data: ads } = await admin.from("perfiles").select("id").eq("grupo_id", c.grupo_id).eq("activo", true).eq("rol", "admin");
        const n = await enviar(admin, c.grupo_id, (ads || []).map((x: { id: string }) => x.id), {
          title: (c.estrellas <= 2 ? "⚠️ " : "💬 ") + "Calificación " + "⭐".repeat(c.estrellas) + " · T-" + String(sv?.folio || "").padStart(4, "0"),
          body: (sv?.tomado_taxi || "") + " " + (sv?.tomado_nombre || "") + (c.comentario ? " · \"" + String(c.comentario).slice(0, 120) + "\"" : ""),
          tag: "calif-" + c.servicio_id, expres: c.estrellas <= 2, url: "./",
        }, null);
        return json({ enviados: n });
      }
      const { data: P, error: eP } = await admin.rpc("pendientes_alertar");
      if (eP) return json({ error: "pendientes", detalle: eP.message }, 500);
      let total = 0;
      const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
      for (const r of (P || []) as { sid: string; gid: string; niv: number; hora: string; ubic: string; destino: string; costo: number }[]) {
        const { data: per } = await admin.from("perfiles").select("id,rol,pagado_hasta,modo").eq("grupo_id", r.gid).eq("activo", true);
        const staffIds = (per || []).filter((x: { rol: string }) => x.rol === "admin" || x.rol === "despachador").map((x: { id: string }) => x.id);
        const taxIds = (per || []).filter((x: { rol: string; pagado_hasta: string | null; modo?: string }) => (x.rol === "taxista" || x.rol === "programador") && (x.modo === "comision" || (x.pagado_hasta && x.pagado_hasta >= hoy))).map((x: { id: string }) => x.id);
        const ruta = corto(r.ubic) + " → " + corto(r.destino);
        if (staffIds.length) {
          total += await enviar(admin, r.gid, staffIds, {
            title: "⏰ SIN CUBRIR · " + h12(r.hora) + " · $" + r.costo,
            body: ruta + (r.niv === 2 ? " · ¡ya casi es la hora!" : " · nadie lo ha tomado"),
            tag: "pend-" + r.sid, expres: true, url: "./",
          }, null);
        }
        const { data: g } = await admin.from("grupos").select("realertar").eq("id", r.gid).maybeSingle();
        if (taxIds.length && (!g || g.realertar !== false)) {
          total += await enviar(admin, r.gid, taxIds, {
            title: "🚕 Sigue disponible · " + h12(r.hora) + " · $" + r.costo,
            body: ruta, tag: "sv-" + r.sid, expres: false, url: "./",
          }, null);
        }
      }
      return json({ servicios: (P || []).length, enviados: total });
    }

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "no autorizado" }, 401);
    const { ids, yo: miEndpoint, tipo, para, otros } = await req.json();
    // 🔔 Probar avisos: se manda a sí mismo (sirve para saber si su celular sí recibe)
    if (tipo === "prueba") {
      const { data: me } = await admin.from("perfiles").select("grupo_id").eq("id", u.user.id).maybeSingle();
      if (!me) return json({ enviados: 0 });
      const n = await enviar(admin, me.grupo_id, [u.user.id], { title: "🔔 Prueba de aviso", body: "¡Sí te llegan los avisos! Así te va a sonar cuando suba un servicio.", tag: "prueba", expres: true, url: "./" }, null);
      return json({ enviados: n });
    }
    if (!Array.isArray(ids) || !ids.length) return json({ error: "sin servicios" }, 400);

    const { data: yo, error: e1 } = await admin.from("perfiles").select("grupo_id,activo,rol").eq("id", u.user.id).single();
    if (!yo || !yo.activo) {
      console.error("perfil", e1);
      return json({ error: "sin permiso", detalle: e1 ? e1.message : "perfil no activo" }, 403);
    }


    if (tipo === "aviso") {
      if (yo.rol !== "admin") return json({ error: "sin permiso" }, 403);
      const { data: av, error: eav } = await admin
        .from("avisos")
        .select("id,texto,para")
        .eq("id", ids[0])
        .eq("grupo_id", yo.grupo_id)
        .maybeSingle();
      if (eav) return json({ error: "avisos", detalle: eav.message }, 500);
      if (!av) return json({ enviados: 0, aviso: "aviso no encontrado" });
      let dest: string[] = [];
      if (av.para) dest = [av.para];
      else {
        const { data: todos } = await admin.from("perfiles").select("id").eq("grupo_id", yo.grupo_id).eq("activo", true);
        dest = (todos || []).map((p: { id: string }) => p.id);
      }
      if (!dest.length) return json({ enviados: 0 });
      const txt = String(av.texto || "");
      const n = await enviar(admin, yo.grupo_id, dest, {
        title: av.para ? "📢 Aviso para ti" : "📢 Aviso para todos",
        body: txt.length > 160 ? txt.slice(0, 157) + "…" : txt,
        tag: "av-" + av.id,
        expres: true,
        url: "./",
      }, miEndpoint || null);
      return json({ enviados: n });
    }

    if (tipo === "recarga_rev") {
      if (yo.rol !== "admin") return json({ error: "sin permiso" }, 403);
      const { data: rc } = await admin.from("recargas").select("id,perfil_id,monto,estado,nota").eq("id", ids[0]).eq("grupo_id", yo.grupo_id).maybeSingle();
      if (!rc || rc.estado === "pendiente") return json({ enviados: 0 });
      const ok = rc.estado === "ok";
      const n = await enviar(admin, yo.grupo_id, [rc.perfil_id], {
        title: ok ? "✅ Recarga abonada · $" + rc.monto : "❌ Recarga rechazada",
        body: ok ? "Ya tienes tu saldo en 💰 Mi cuenta" : String(rc.nota || "Revisa con el administrador"),
        tag: "recr-" + rc.id, expres: false, url: "./",
      }, null);
      return json({ enviados: n });
    }

    if (tipo === "asignado") {
      if (!["admin", "despachador", "programador"].includes(yo.rol)) return json({ error: "sin permiso" }, 403);
      const { data: a, error: ea } = await admin
        .from("servicios")
        .select("id,expres,hora,ubic,destino,costo,tomado_por,tomado_nombre,tomado_taxi,practica,quiero_snap")
        .eq("id", ids[0])
        .eq("grupo_id", yo.grupo_id)
        .maybeSingle();
      if (ea) return json({ error: "servicios", detalle: ea.message }, 500);
      if (!a || a.tomado_por !== para) return json({ enviados: 0, aviso: "no coincide" });
      const r = await avisoAsig(admin, yo.grupo_id, a, (Array.isArray(otros) ? otros : []).filter((x: string) => x !== para));
      return json({ enviados: r.n1, otros: r.n2 });
    }

    const { data: sv, error: e2 } = await admin
      .from("servicios")
      .select("id,expres,hora,fecha,ubic,destino,costo,creado_por,practica,pago,factura,aeropuerto,solo_equipo,solo_hasta,vehiculo,placas_req")
      .in("id", ids.slice(0, 50))
      .eq("grupo_id", yo.grupo_id);
    if (e2) {
      console.error("servicios", e2);
      return json({ error: "servicios", detalle: e2.message }, 500);
    }
    if (!sv || !sv.length) return json({ enviados: 0, aviso: "servicio no encontrado" });

    let payload;
    if (sv.length === 1) {
      const s = sv[0];
      payload = {
        title: (s.practica ? "🎓 PRÁCTICA · " : "") + (s.expres ? "⚡ EXPRÉS $" + s.costo : "🕐 " + h12(s.hora) + " · $" + s.costo) + marcas(s),
        body: corto(s.ubic) + " → " + corto(s.destino),
        tag: "sv-" + s.id,
        expres: !!s.expres,
        url: "./",
      };
    } else {
      payload = { title: "📅 " + sv.length + " servicios nuevos", body: "Abre la agenda para verlos", tag: "sv-varios", expres: false, url: "./" };
    }

    const { data: act } = await admin.from("perfiles").select("id,rol,terminal,factura,transferencia,federal,van,equipo_id,equipos_extra").eq("grupo_id", yo.grupo_id).eq("activo", true);
    // ⏳ Preferencia del equipo: mientras corre su tiempo, solo le suena a su equipo (y a la oficina)
    // deno-lint-ignore no-explicit-any
    const s1: any = sv.length === 1 ? sv[0] : null;
    const pref = !!s1 && !!s1.solo_equipo && !!s1.solo_hasta && new Date(s1.solo_hasta).getTime() > Date.now();
    // deno-lint-ignore no-explicit-any
    const deEq = (p: any) => p.equipo_id === s1?.solo_equipo || (p.equipos_extra || []).includes(String(s1?.solo_equipo)) || p.rol === "admin" || p.rol === "despachador";
    const ok = ((act || []) as Perf[]).filter((p) => (sv.length !== 1 || cumple(p, sv[0])) && (!pref || deEq(p))).map((p) => p.id);
    if (!ok.length) return json({ enviados: 0 });
    const { data: subs, error: e3 } = await admin.from("push_subs").select("id,endpoint,p256dh,auth").in("usuario_id", ok);

    if (e3) {
      console.error("push_subs", e3);
      return json({ error: "push_subs", detalle: e3.message }, 500);
    }
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC")!,
      Deno.env.get("VAPID_PRIVATE")!,
    );
    let enviados = 0;
    const borrar: string[] = [];
    await Promise.all((subs || []).filter((s: { endpoint: string }) => s.endpoint !== miEndpoint).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await mandarUno(s, JSON.stringify(payload));
        enviados++;
      } catch (e) {
        const c = (e as { statusCode?: number }).statusCode;
        if (c === 404 || c === 410) borrar.push(s.id);
        else if (s.endpoint.startsWith("fcm:")) console.error("fcm", e);
      }
    }));
    if (borrar.length) await admin.from("push_subs").delete().in("id", borrar);
    return json({ enviados });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
