import json,os
B='https://taxicelcampeche.com/'
def page(slug,title,desc,hi,crumb,body,faq,service):
    ld=[{"@context":"https://schema.org","@type":"Service","name":service['name'],"description":desc,"areaServed":{"@type":"City","name":"San Francisco de Campeche"},
         "provider":{"@type":"LocalBusiness","name":"Taxicel Servicio Programado","telephone":"+52 981 115 0093","url":B},
         "offers":{"@type":"Offer","price":service['price'],"priceCurrency":"MXN"}},
        {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a,_,_ in faq]}]
    fq='\n'.join(f'<details><summary data-en="{qe}">{q}</summary><p data-en="{ae}">{a}</p></details>' for q,a,qe,ae in faq)
    more=[('tours','🗺️ Todos los tours','All tours','Compara paquetes','Compare packages'),('ironman','🏊🚴🏃 IRONMAN','IRONMAN','Traslados con bici','Transfers with bike'),('aeropuerto','✈️ Aeropuerto','Airport','Taxi y van','Taxi and van'),('tren-maya','🚆 Tren Maya','Tren Maya','Estación Campeche','Campeche station'),('edzna','🏛️ Edzná','Edzná','Tour con guía','Tour with guide'),('uxmal','🏛️ Uxmal','Uxmal','Tour de día completo','Full-day tour'),('bahia-de-tortugas','🏖️ Bahía de Tortugas','Bahía de Tortugas','Playa y mariscos','Beach and seafood'),('edzna-bahia-de-tortugas','🏛️🏖️ Edzná + Bahía de Tortugas','Edzná + Bahía de Tortugas','Ruinas y playa','Ruins and beach'),('','🚕 Todos los servicios','All services','Cotiza tu viaje','Get a price')]
    mh=''.join(f'<a href="../{m[0]}{"/" if m[0] else ""}"><span data-en="{m[2]}" style="color:var(--fg);font-weight:800;font-size:16px">{m[1]}</span><span data-en="{m[4]}">{m[3]}</span></a>' for m in more if m[0]!=slug)
    h=f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{B}{slug}/">
<meta name="theme-color" content="#1a0b2e">
<link rel="icon" href="../taxicel-192.png">
<link rel="apple-touch-icon" href="../taxicel-apple.png">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{B}img/{hi or 'og-logo'}.jpg">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../estilo.css">
<script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script>
</head>
<body>
<header><div class="w">
<a href="../" aria-label="Taxicel"><img src="../taxicel-logo.png" alt="Taxicel" width="1179" height="586"></a>
<nav><a class="lg" href="../tours/" style="text-decoration:none" data-en="🗺️ Tours">🗺️ Tours</a><button class="lg" id="lg" onclick="setLang(L=='es'?'en':'es')">English</button></nav>
</div></header>
<main>
<div class="ph" style="{('--hi:url(img/'+hi+'.webp)') if hi else '--hi:none;padding-top:40px'}"><div class="w">
<div class="crumb" style="padding:0 0 14px"><a href="../" data-en="Home">Inicio</a> › <span data-en="{crumb[1]}">{crumb[0]}</span></div>
{body[0]}
</div></div>
{body[1]}
<section><div class="w">
<h2 data-en="Frequently asked questions">Preguntas frecuentes</h2>
{fq}
</div></section>
<section style="padding-top:0"><div class="w">
<h2 data-en="Other services" style="font-size:24px;margin-bottom:14px">Otros servicios</h2>
<div class="more">{mh}</div>
</div></section>
</main>
<footer><div class="w">
<p><b style="color:var(--fg)">Taxicel Servicio Programado</b><br><span data-en="Scheduled taxi in San Francisco de Campeche · 24 hours">Taxi programado en San Francisco de Campeche · 24 horas</span></p>
<div class="row">
<a href="#" class="wal">💬 WhatsApp 981 115 0093</a>
<a href="mailto:reservas@taxicelcampeche.com">✉️ reservas@taxicelcampeche.com</a>
<a href="https://www.facebook.com/TAXIPROGRAMADOS" target="_blank" rel="noopener">Facebook</a>
<a href="https://www.instagram.com/taxicelservicio" target="_blank" rel="noopener">Instagram</a>
</div>
</div></footer>
<a class="wa wal" href="#" aria-label="WhatsApp" data-msg="{service['wa']}" data-msgen="{service['waen']}">💬 WhatsApp</a>
<script src="../comun.js"></script>
</body>
</html>
'''
    os.makedirs(slug,exist_ok=True);open(slug+'/index.html','w').write(h)

INC='''<section><div class="w">
<h2 data-en="What's included">Lo que incluye tu viaje</h2>
<div class="inc">
<div>⏱️<b data-en="10 minutes early">10 minutos antes</b><span data-en="Your taxi is waiting, not you.">Tu taxi te espera, no tú a él.</span></div>
<div>❄️<b data-en="Air conditioning">Aire acondicionado</b><span data-en="Clean, comfortable sedans.">Sedán limpio y cómodo.</span></div>
<div>🛡️<b data-en="Travel insurance">Seguro de viajero</b><span data-en="On every ride.">En todos los viajes.</span></div>
<div>💳<b data-en="Card or cash">Tarjeta o efectivo</b><span data-en="Debit or credit card.">Débito o crédito.</span></div>
<div>🧾<b data-en="Electronic invoice">Factura electrónica</b><span data-en="Ask for it when booking or write to facturacion@taxicelcampeche.com">Pídela al reservar o escribe a facturacion@taxicelcampeche.com</span></div>
<div>🕐<b data-en="24 hours">24 horas</b><span data-en="Early flights and late trains too.">También vuelos temprano y trenes de noche.</span></div>
</div></div></section>'''

# ---------- AEROPUERTO
page('aeropuerto','Taxi Aeropuerto de Campeche · desde $300 · 24 horas | Taxicel',
 'Taxi del Aeropuerto Internacional de Campeche a tu hotel o colonia, desde $300 en sedán hasta 4 personas. Van privada hasta 14 personas $1,500. Te esperamos si tu vuelo se retrasa. WhatsApp 981 115 0093.',
 'aer-cpe',('Aeropuerto','Airport'),
 ('''<span class="kick" data-en="Campeche International Airport">Aeropuerto Internacional de Campeche</span>
<h1 data-en="Airport taxi, <em>waiting for you</em> when you land">Taxi del aeropuerto, <em>esperándote</em> al aterrizar</h1>
<p class="sub" data-en="From the airport to your hotel or home, or from your home to your flight. Sedan up to 4 people from $300 MXN, private van up to 14 people. 24 hours.">Del aeropuerto a tu hotel o tu casa, o de tu casa a tu vuelo. Sedán hasta 4 personas desde $300 MXN, van privada hasta 14 personas. Las 24 horas.</p>
<div class="row">
<a class="btn b1" href="../?o=aer#cotizar" data-en="💰 Price from the airport">💰 Precio desde el aeropuerto</a>
<a class="btn b3" href="../?d=aer#cotizar" data-en="🛫 Price to the airport">🛫 Precio al aeropuerto</a>
<a class="btn b2 wal" href="#" data-msg="Hola, quiero reservar un taxi del aeropuerto." data-msgen="Hello, I would like to book an airport taxi." data-en="💬 WhatsApp">💬 WhatsApp</a>
</div>''',
 '''<section><div class="w">
<h2 data-en="Prices">Precios</h2>
<p class="lead" data-en="Fixed price before you travel. No surprises at the end of the ride.">Precio fijo antes de viajar. Sin sorpresas al final del viaje.</p>
<div class="grid">
<div class="card"><div class="cimg rot"><img src="../img/tx871.webp" alt="Taxi sedán Taxicel" loading="lazy" width="1000" height="563"><img src="../img/tx929.webp" alt="Taxi sedán Taxicel" loading="lazy" width="1200" height="630"></div><h3 data-en="🚕 Sedan taxi">🚕 Taxi sedán</h3><p data-en="Up to 4 passengers with luggage. Price depends on your pick-up or drop-off point.">Hasta 4 pasajeros con equipaje. El precio varía según tu punto de recogida o destino.</p><div class="pr"><small data-en="from">desde</small> $300 <small>MXN</small></div><a href="../?o=aer#cotizar" data-en="See exact price →">Ver precio exacto →</a></div>
<div class="card"><div class="cimg rot"><img src="../img/van-aer.webp" alt="Van de 14 pasajeros en el Aeropuerto de Campeche" loading="lazy" style="object-position:center 40%"><img src="../img/van.webp" alt="Van de 14 pasajeros" loading="lazy" width="1200" height="674"></div><h3 data-en="🚐 Private van">🚐 Van privada</h3><p data-en="Up to 14 people with luggage. The only van at the airport, with our partner JKPE. Scheduled.">Hasta 14 personas con equipaje. La única van del aeropuerto, con nuestro aliado JKPE. Programado.</p><div class="pr">$1,500 <small>MXN</small></div><a href="#" class="wal" data-msg="Hola, quiero reservar la van del aeropuerto." data-msgen="Hello, I would like to book the airport van." data-en="Book van →">Reservar van →</a></div>
<div class="card"><div class="cimg"><img src="../img/colectivo.webp" alt="Van del colectivo en el Aeropuerto de Campeche" loading="lazy" width="375" height="211"></div><h3 data-en="🚌 Shared shuttle">🚌 Colectivo</h3><p data-en="Fixed route from the airport to the city, per person.">Ruta fija del aeropuerto a la ciudad, por persona.</p><div class="pr">$150 <small data-en="per person">por persona</small></div><a href="#" class="wal" data-msg="Hola, quiero información del colectivo del aeropuerto." data-msgen="Hello, I would like information about the airport shuttle." data-en="Ask →">Preguntar →</a></div>
</div></div></section>
<section style="padding-top:0"><div class="w"><div class="air">
<div><h2 data-en="Arriving to Campeche?">¿Llegas a Campeche?</h2>
<ul>
<li data-en="Send us your flight number when booking">Mándanos tu número de vuelo al reservar</li>
<li data-en="We wait for you even if your flight is delayed">Te esperamos aunque tu vuelo se retrase</li>
<li data-en="Pick-up at arrivals with your name">Recepción en llegadas con tu nombre</li>
<li data-en="Agreement with the official airport taxis">Convenio con los taxis oficiales del aeropuerto</li>
</ul></div>
<div><h2 data-en="Leaving Campeche?">¿Te vas de Campeche?</h2>
<ul>
<li data-en="We pick you up at your hotel or home">Te recogemos en tu hotel o tu casa</li>
<li data-en="We arrive 10 minutes early">Llegamos 10 minutos antes</li>
<li data-en="Early morning flights too: book the day before">También vuelos de madrugada: reserva un día antes</li>
<li data-en="Card payment and electronic invoice">Pago con tarjeta y factura electrónica</li>
</ul></div>
</div></div></section>
'''+INC),
 [('¿Cuánto cuesta un taxi del Aeropuerto de Campeche?','Desde $300 MXN en sedán para hasta 4 personas, según tu destino. Van privada hasta 14 personas: $1,500. Colectivo: $150 por persona.','How much is a taxi from Campeche Airport?','From $300 MXN in a sedan for up to 4 people, depending on your destination. Private van for up to 14 people: $1,500. Shared shuttle: $150 per person.'),
  ('¿Qué pasa si mi vuelo se retrasa?','Te esperamos. Mándanos tu número de vuelo al reservar.','What if my flight is delayed?','We wait for you. Send us your flight number when booking.'),
  ('¿Puedo reservar desde antes de llegar?','Sí. Reserva en línea o por WhatsApp con el día y la hora de tu vuelo y te estaremos esperando.','Can I book before I arrive?','Yes. Book online or by WhatsApp with your flight date and time and we will be waiting for you.'),
  ('¿Puedo pagar con tarjeta y pedir factura?','Sí, tarjeta de débito o crédito, y factura electrónica (CFDI).','Can I pay by card and get an invoice?','Yes, debit or credit card, and electronic invoice (CFDI).'),
  ('¿Trabajan de madrugada?','Sí, las 24 horas, todos los días. Para vuelos temprano te recomendamos reservar un día antes.','Do you work early in the morning?','Yes, 24 hours, every day. For early flights we recommend booking the day before.')],
 {'name':'Taxi Aeropuerto de Campeche','price':'300','wa':'Hola, quiero reservar un taxi del aeropuerto.','waen':'Hello, I would like to book an airport taxi.'})

# ---------- TREN MAYA
page('tren-maya','Taxi Estación Tren Maya Campeche · $300 | Taxicel',
 'Taxi a la estación del Tren Maya en Campeche o de la estación a tu hotel: $300 en sedán hasta 4 personas. Van para grupos. Te esperamos si el tren se retrasa. 24 horas. WhatsApp 981 115 0093.',
 'tren-857',('Tren Maya','Tren Maya'),
 ('''<span class="kick" data-en="Tren Maya · Campeche station">Tren Maya · Estación Campeche</span>
<h1 data-en="Taxi to the Tren Maya, <em>$300</em>">Taxi al Tren Maya, <em>$300</em></h1>
<p class="sub" data-en="We take you to the Campeche station or pick you up when you get off the train and take you to your hotel. Sedan up to 4 people, van for groups. We wait if the train is late.">Te llevamos a la estación de Campeche o te recogemos al bajar del tren y te llevamos a tu hotel. Sedán hasta 4 personas, van para grupos. Te esperamos si el tren se retrasa.</p>
<div class="row">
<a class="btn b1" href="../?o=tren#cotizar" data-en="🚆 I'm arriving by train">🚆 Llego en tren</a>
<a class="btn b3" href="../?d=tren#cotizar" data-en="🏨 Take me to the station">🏨 Llévame a la estación</a>
<a class="btn b2 wal" href="#" data-msg="Hola, quiero reservar un taxi para el Tren Maya." data-msgen="Hello, I would like to book a taxi for the Tren Maya." data-en="💬 WhatsApp">💬 WhatsApp</a>
</div>''',
 '''<section><div class="w"><div class="two">
<div class="ph2 rot"><img src="../img/tren-letrero.webp" alt="Entrada de la Estación San Francisco de Campeche del Tren Maya" loading="lazy"><img src="../img/tren-llega.webp" alt="Tren Maya llegando a la estación Campeche" loading="lazy" width="1200" height="744"><img src="../img/tren857.webp" alt="Taxi Taxicel en la estación del Tren Maya Campeche" loading="lazy" width="1200" height="559"><img src="../img/tren.webp" alt="Taxis Taxicel en la estación del Tren Maya" loading="lazy" width="1200" height="605"></div>
<div>
<h2 data-en="Prices">Precios</h2>
<div class="opt"><b data-en="🚕 Sedan up to 4 people · $300 MXN">🚕 Sedán hasta 4 personas · $300 MXN</b><span style="color:var(--mu);font-size:14px" data-en="Between the station and the city, with luggage.">Entre la estación y la ciudad, con equipaje.</span></div>
<div class="opt"><b data-en="🚐 Van for groups">🚐 Van para grupos</b><span style="color:var(--mu);font-size:14px" data-en="5 people or more. Scheduled; we send you the price by WhatsApp.">De 5 personas en adelante. Programado; te mandamos el precio por WhatsApp.</span></div>
<div class="opt"><b data-en="🏛️ Train + Edzná">🏛️ Tren + Edzná</b><span style="color:var(--mu);font-size:14px" data-en="Arriving by train and want to visit Edzná? Ask us for the tour with guide.">¿Llegas en tren y quieres conocer Edzná? Pregúntanos por el tour con guía.</span> <a href="../edzna/" style="color:var(--lime);font-weight:800;text-decoration:none" data-en="See tour →">Ver tour →</a></div>
</div></div></div></section>
<section style="padding-top:0"><div class="w">
<h2 data-en="How it works">Cómo funciona</h2>
<div class="steps">
<div><b data-en="1. Book">1. Reserva</b><span data-en="Tell us the day and time of your train.">Dinos el día y la hora de tu tren.</span></div>
<div><b data-en="2. We wait for you">2. Te esperamos</b><span data-en="Your driver is at the station before the train arrives.">Tu taxi está en la estación antes de que llegue el tren.</span></div>
<div><b data-en="3. To your hotel">3. A tu hotel</b><span data-en="Fixed price, card or cash.">Precio fijo, tarjeta o efectivo.</span></div>
</div></div></section>
'''+INC),
 [('¿Cuánto cuesta un taxi a la estación del Tren Maya en Campeche?','$300 MXN en sedán para hasta 4 personas, entre la estación y la ciudad.','How much is a taxi to the Tren Maya station in Campeche?','$300 MXN in a sedan for up to 4 people, between the station and the city.'),
  ('¿Qué pasa si el tren se retrasa?','Te esperamos. Mándanos el día y la hora de tu tren al reservar.','What if the train is late?','We wait for you. Send us the day and time of your train when booking.'),
  ('Somos más de 4, ¿qué hacemos?','Tenemos van para grupos. Escríbenos por WhatsApp y te mandamos el precio.','We are more than 4, what can we do?','We have a van for groups. Message us on WhatsApp and we will send you the price.'),
  ('¿Puedo pagar con tarjeta?','Sí, tarjeta de débito o crédito, o efectivo. También damos factura.','Can I pay by card?','Yes, debit or credit card, or cash. We also give invoices.')],
 {'name':'Taxi Estación Tren Maya Campeche','price':'300','wa':'Hola, quiero reservar un taxi para el Tren Maya.','waen':'Hello, I would like to book a taxi for the Tren Maya.'})

# ---------- EDZNA
page('edzna','Tour a Edzná desde Campeche con guía · $2,500 hasta 4 personas | Taxicel',
 'Viaje a la Zona Arqueológica de Edzná desde Campeche: ida, espera de hasta 2 horas y regreso. Solo taxi $1,800 o paquete con guía $2,500 hasta 4 personas (ahorras $200). Reserva por WhatsApp 981 115 0093.',
 'edzna',('Edzná','Edzná'),
 ('''<span class="kick" data-en="Edzná archaeological site">Zona Arqueológica de Edzná</span>
<h1 data-en="Edzná with a guide, <em>everything in one booking</em>">Edzná con guía, <em>todo en una sola reserva</em></h1>
<p class="sub" data-en="We pick you up at your hotel, take you to Edzná, wait for you and bring you back. Add a Campeche guide and save $200.">Te recogemos en tu hotel, te llevamos a Edzná, te esperamos y te regresamos. Agrega un guía de Campeche y ahorras $200.</p>
<div class="row">
<a class="btn b1 wal" href="#" data-msg="Hola, quiero reservar el paquete Edzná con guía ($2,500)." data-msgen="Hello, I would like to book the Edzná package with guide ($2,500)." data-en="Book package with guide">Reservar paquete con guía</a>
<a class="btn b3 wal" href="#" data-msg="Hola, quiero reservar el viaje a Edzná (solo taxi)." data-msgen="Hello, I would like to book the trip to Edzná (taxi only)." data-en="Taxi only">Solo taxi</a>
</div>''',
 '''<section><div class="w"><div class="two">
<div class="pk">
<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="font-size:26px" data-en="Edzná package with guide">Paquete Edzná con guía</h2><span class="save" data-en="Save $200">Ahorras $200</span></div>
<table>
<tr><td data-en="🚕 Taxi: round trip + up to 2 h wait">🚕 Taxi: ida, espera de hasta 2 h y regreso</td><td><span class="old">$1,800</span>$1,700</td></tr>
<tr><td data-en="🧭 Campeche guide (up to 4 people)">🧭 Guía de Campeche (hasta 4 personas)</td><td><span class="old">$900</span>$800</td></tr>
<tr class="t"><td>Total</td><td>$2,500 <small style="font-size:14px">MXN</small></td></tr>
</table>
<div class="mu" style="font-size:14px" data-en="Up to 4 people. Site entrance fees are not included; they are paid at the ticket office.">Hasta 4 personas. Las entradas a la zona no están incluidas; se pagan en taquilla.</div>
<a class="btn b1 wal" href="#" data-msg="Hola, quiero reservar el paquete Edzná con guía ($2,500)." data-msgen="Hello, I would like to book the Edzná package with guide ($2,500)." data-en="Book on WhatsApp">Reservar por WhatsApp</a>
</div>
<div style="display:grid;gap:14px">
<div class="ph2"><img src="../img/edzna.webp" alt="Taxi Taxicel en la Zona Arqueológica de Edzná" loading="lazy" width="1000" height="750"></div>
<div class="opt"><b data-en="🚕 Taxi only · $1,800 MXN">🚕 Solo taxi · $1,800 MXN</b><span style="color:var(--mu);font-size:14px" data-en="Round trip from downtown or your hotel, up to 2 hours of waiting. Up to 4 passengers.">Ida y regreso desde el centro o tu hotel, con hasta 2 horas de espera. Hasta 4 personas.</span></div>
</div>
</div></div></section>
<section style="padding-top:0"><div class="w">
<h2 data-en="How it works">Cómo funciona</h2>
<div class="steps">
<div><b data-en="1. Book">1. Reserva</b><span data-en="Tell us the day, the time and how many people.">Dinos el día, la hora y cuántas personas van.</span></div>
<div><b data-en="2. We pick you up">2. Te recogemos</b><span data-en="At your hotel or anywhere in the city, 10 minutes early.">En tu hotel o cualquier punto de la ciudad, 10 minutos antes.</span></div>
<div><b data-en="3. Visit Edzná">3. Conoces Edzná</b><span data-en="With your guide if you chose the package. We wait up to 2 hours.">Con tu guía si elegiste el paquete. Te esperamos hasta 2 horas.</span></div>
<div><b data-en="4. Back to Campeche">4. De regreso</b><span data-en="We take you back to your hotel.">Te regresamos a tu hotel.</span></div>
</div></div></section>
'''+INC),
 [('¿Cuánto cuesta ir a Edzná desde Campeche?','Solo taxi: $1,800 MXN ida y regreso con hasta 2 horas de espera, hasta 4 personas. Con guía: $2,500 MXN en total.','How much is a trip to Edzná from Campeche?','Taxi only: $1,800 MXN round trip with up to 2 hours of waiting, up to 4 people. With guide: $2,500 MXN in total.'),
  ('¿Qué incluye el paquete con guía?','El taxi de ida, la espera de hasta 2 horas, el regreso y un guía de Campeche para hasta 4 personas.','What does the package with guide include?','The taxi there, up to 2 hours of waiting, the ride back and a Campeche guide for up to 4 people.'),
  ('¿Están incluidas las entradas?','No. Las entradas a la zona arqueológica se pagan en taquilla.','Are entrance fees included?','No. Entrance fees to the archaeological site are paid at the ticket office.'),
  ('¿Me recogen en mi hotel?','Sí, en tu hotel o en cualquier punto de la ciudad.','Do you pick me up at my hotel?','Yes, at your hotel or anywhere in the city.')],
 {'name':'Tour a Edzná desde Campeche','price':'2500','wa':'Hola, quiero reservar el viaje a Edzná.','waen':'Hello, I would like to book the trip to Edzná.'})

# ---------- UXMAL
UXJS='''<script>
function uxT(){var t=4000,h=6,m=0,o=[];document.querySelectorAll('.uxo').forEach(function(c){if(c.checked){t+=400;m+=80;o.push(c.dataset.n)}});h+=Math.floor(m/60);m=m%60;
document.getElementById('uxTot').textContent='$'+t.toLocaleString('en-US');document.getElementById('uxH').textContent=h+' h'+(m?' '+m+' min':'');
var es='Hola, quiero reservar el tour a Uxmal'+(o.length?' + '+o.join(' + '):'')+' ($'+t.toLocaleString('en-US')+').',en='Hello, I would like to book the Uxmal tour'+(o.length?' + '+o.map(function(x){return x=='Museo del Chocolate'?'Chocolate Museum':'Lunch'}).join(' + '):'')+' ($'+t.toLocaleString('en-US')+').';
document.querySelectorAll('.uxb').forEach(function(a){a.dataset.msg=es;a.dataset.msgen=en});if(window.waLinks)waLinks()}
document.querySelectorAll('.uxo').forEach(function(c){c.addEventListener('change',uxT)});
</script>'''
page('uxmal','Tour a Uxmal desde Campeche en taxi · desde $4,000 hasta 4 personas | Taxicel',
 'Tour en taxi de Campeche a la Zona Arqueológica de Uxmal: ida, 2 horas de espera y regreso por $4,000 hasta 4 personas. Agrega el Museo del Chocolate (+$400) y la comida (+$400). WhatsApp 981 115 0093.',
 'uxmal',('Uxmal','Uxmal'),
 ('''<span class="kick" data-en="Uxmal archaeological site · Yucatán">Zona Arqueológica de Uxmal · Yucatán</span>
<h1 data-en="Uxmal from Campeche, <em>build your tour</em>">Uxmal desde Campeche, <em>arma tu tour</em></h1>
<p class="sub" data-en="We pick you up at your hotel, take you to Uxmal, wait for you and bring you back. Add the Chocolate Museum and lunch if you like. Private sedan for up to 4 people.">Te recogemos en tu hotel, te llevamos a Uxmal, te esperamos y te regresamos. Si quieres, agrega el Museo del Chocolate y la comida. Taxi sedán privado hasta 4 personas.</p>
<div class="row">
<a class="btn b1" href="#arma" data-en="Build my tour">Armar mi tour</a>
</div>''',
 '''<section id="arma"><div class="w"><div class="two">
<div class="pk">
<h2 style="font-size:26px" data-en="Build your Uxmal tour">Arma tu tour a Uxmal</h2>
<table>
<tr><td data-en="🏛️ Uxmal: ride there, up to 2 h waiting and ride back">🏛️ Uxmal: ida, hasta 2 h de espera y regreso</td><td>$4,000</td></tr>
<tr><td><label style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="checkbox" class="uxo" data-n="Museo del Chocolate" style="width:22px;height:22px;accent-color:#a6e22e"><span data-en="🍫 Add Chocolate Museum (up to 1 h 20)">🍫 Agregar Museo del Chocolate (hasta 1 h 20)</span></label></td><td>+$400</td></tr>
<tr><td><label style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="checkbox" class="uxo" data-n="Comida" style="width:22px;height:22px;accent-color:#a6e22e"><span data-en="🍽️ Add lunch stop near Uxmal (up to 1 h 20)">🍽️ Agregar parada para comer cerca de Uxmal (hasta 1 h 20)</span></label></td><td>+$400</td></tr>
<tr class="t"><td>Total</td><td><span id="uxTot">$4,000</span> <small style="font-size:14px">MXN</small></td></tr>
</table>
<div class="mu" style="font-size:14px"><span data-en="Approximate total time:">Tiempo total aproximado:</span> <b id="uxH">6 h</b>. <span data-en="Private sedan, up to 4 people. Entrance fees and meals are not included.">Sedán privado, hasta 4 personas. Entradas y comida no incluidas.</span></div>
<a class="btn b1 wal uxb" href="#" data-msg="Hola, quiero reservar el tour a Uxmal ($4,000)." data-msgen="Hello, I would like to book the Uxmal tour ($4,000)." data-en="Book on WhatsApp">Reservar por WhatsApp</a>
</div>
<div>
<h2 style="font-size:24px;margin-bottom:10px" data-en="Your day">Tu día</h2>
<div class="steps" style="grid-template-columns:1fr">
<div><b data-en="Pick-up">Recogida</b><span data-en="At your hotel or anywhere in Campeche, 10 minutes early.">En tu hotel o cualquier punto de Campeche, 10 minutos antes.</span></div>
<div><b data-en="To Uxmal · about 2 h">Rumbo a Uxmal · unas 2 h</b><span data-en="By the coastal road.">Por la carretera costera.</span></div>
<div><b data-en="Uxmal · up to 2 h">Uxmal · hasta 2 h</b><span data-en="Time to walk the archaeological site.">Para recorrer la zona arqueológica.</span></div>
<div><b data-en="Optional: Chocolate Museum · up to 1 h 20">Opcional: Museo del Chocolate · hasta 1 h 20</b><span data-en="Very close to Uxmal.">Muy cerca de Uxmal.</span></div>
<div><b data-en="Optional: Lunch · up to 1 h 20">Opcional: Comida · hasta 1 h 20</b><span data-en="Yucatecan restaurant near Uxmal.">Restaurante de comida yucateca cerca de Uxmal.</span></div>
<div><b data-en="Back to Campeche · about 2 h">Regreso a Campeche · unas 2 h</b><span data-en="We drop you at your hotel.">Te dejamos en tu hotel.</span></div>
</div></div>
</div></div></section>
<section style="padding-top:0"><div class="w">
<h2 data-en="On the way">En el camino</h2>
<p class="lead" data-en="Real photos from our tours: local crafts and Don Carlos Cancino, Maya woodcarver, at work near Uxmal. On the tour you can meet him and take home a handmade piece.">Fotos reales de nuestros tours: artesanías de la región y Don Carlos Cancino, artesano maya, tallando madera cerca de Uxmal. En el tour puedes conocer su trabajo y llevarte una pieza hecha a mano.</p>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
<div class="ph2" style="aspect-ratio:3/4"><img src="../img/ux-artesano.webp" alt="Don Carlos Cancino, artesano maya, tallando madera cerca de Uxmal" loading="lazy"></div>
<div class="ph2" style="aspect-ratio:3/4"><img src="../img/ux-tallas.webp" alt="Tallas de madera con motivos mayas" loading="lazy"></div>
<div class="ph2" style="aspect-ratio:3/4"><img src="../img/ux-taller.webp" alt="Visitantes comprando tallas a Don Carlos Cancino; atrás, un taxi Taxicel" loading="lazy"></div>
<div class="ph2" style="aspect-ratio:3/4"><img src="../img/ux-artesano2.webp" alt="Visitantes conociendo las tallas de Don Carlos Cancino" loading="lazy" style="object-position:60% center"></div>
<div class="ph2" style="aspect-ratio:3/4"><img src="../img/ux-huipiles.webp" alt="Huipiles bordados a mano en Uxmal" loading="lazy"></div>
</div></div></section>
'''+INC+UXJS),
 [('¿Cuánto cuesta ir a Uxmal desde Campeche en taxi?','$4,000 MXN en taxi sedán privado para hasta 4 personas: ida, hasta 2 horas de espera en Uxmal y regreso. Museo del Chocolate +$400 y parada para comer +$400.','How much is a taxi tour to Uxmal from Campeche?','$4,000 MXN in a private sedan for up to 4 people: ride there, up to 2 hours of waiting at Uxmal and ride back. Chocolate Museum +$400 and lunch stop +$400.'),
  ('¿Cuánto dura el tour?','Unas 6 horas solo Uxmal. Cada opción extra agrega hasta 1 hora 20 minutos.','How long is the tour?','About 6 hours for Uxmal only. Each extra option adds up to 1 hour 20 minutes.'),
  ('¿Están incluidas las entradas y la comida?','No. Las entradas se pagan en taquilla y la comida la paga cada quien.','Are entrance fees and lunch included?','No. Entrance fees are paid at the ticket office and each person pays for their own meal.'),
  ('¿Me recogen en mi hotel?','Sí, en tu hotel o en cualquier punto de Campeche.','Do you pick me up at my hotel?','Yes, at your hotel or anywhere in Campeche.')],
 {'name':'Tour a Uxmal desde Campeche','price':'4000','wa':'Hola, quiero reservar el tour a Uxmal.','waen':'Hello, I would like to book the Uxmal tour.'})

# ---------- BAHIA DE TORTUGAS
page('bahia-de-tortugas','Bahía de Tortugas desde Campeche en taxi · $4,000 hasta 4 personas | Taxicel',
 'Viaje en taxi de Campeche a Bahía de Tortugas (Champotón): ida, hasta 6 horas de espera y regreso por $4,000, casetas incluidas, hasta 4 personas. Playa, alberca y mariscos. WhatsApp 981 115 0093.',
 None,('Bahía de Tortugas','Bahía de Tortugas'),
 ('''<span class="kick" data-en="Champotón · Campeche coast">Champotón · Costa de Campeche</span>
<h1 data-en="Bahía de Tortugas, <em>a beach day</em> from Campeche">Bahía de Tortugas, <em>un día de playa</em> desde Campeche</h1>
<p class="sub" data-en="Beach, pool and fresh seafood past Champotón. We take you, wait for you and bring you back: there is no public transport back from the beach club.">Playa, alberca y mariscos frescos pasando Champotón. Te llevamos, te esperamos y te regresamos: desde el club de playa no hay transporte de regreso.</p>
<div class="row">
<a class="btn b1 wal" href="#" data-msg="Hola, quiero reservar el viaje a Bahía de Tortugas ($4,000)." data-msgen="Hello, I would like to book the trip to Bahía de Tortugas ($4,000)." data-en="Book on WhatsApp">Reservar por WhatsApp</a>
</div>''',
 '''<section><div class="w"><div class="two">
<div class="pk">
<h2 style="font-size:26px" data-en="Bahía de Tortugas trip">Viaje a Bahía de Tortugas</h2>
<table>
<tr><td data-en="🚕 Private sedan, up to 4 people">🚕 Taxi sedán privado, hasta 4 personas</td><td>✓</td></tr>
<tr><td data-en="🏨 Pick-up and drop-off at your hotel">🏨 Recogida y regreso a tu hotel</td><td>✓</td></tr>
<tr><td data-en="🏖️ Up to 6 hours of waiting at the beach club">🏖️ Hasta 6 horas de espera en el club de playa</td><td>✓</td></tr>
<tr><td data-en="🛣️ Highway tolls included">🛣️ Casetas incluidas</td><td>✓</td></tr>
<tr class="t"><td>Total</td><td>$4,000 <small style="font-size:14px">MXN</small></td></tr>
</table>
<div class="mu" style="font-size:14px" data-en="Extra time: $100 for each additional 15 minutes. No entrance fee to the club: you pay for what you eat and drink.">Tiempo extra: $100 por cada 15 minutos adicionales. El club no cobra entrada: pagas lo que consumas.</div>
<a class="btn b1 wal" href="#" data-msg="Hola, quiero reservar el viaje a Bahía de Tortugas ($4,000)." data-msgen="Hello, I would like to book the trip to Bahía de Tortugas ($4,000)." data-en="Book on WhatsApp">Reservar por WhatsApp</a>
</div>
<div>
<h2 style="font-size:24px;margin-bottom:10px" data-en="Your day">Tu día</h2>
<div class="steps" style="grid-template-columns:1fr">
<div><b data-en="Pick-up">Recogida</b><span data-en="At your hotel or anywhere in Campeche, 10 minutes early.">En tu hotel o cualquier punto de Campeche, 10 minutos antes.</span></div>
<div><b data-en="To Bahía de Tortugas · about 1 h 30">Rumbo a Bahía de Tortugas · 1 h 30 aprox.</b><span data-en="By the coastal highway, past Champotón.">Por la carretera costera, pasando Champotón.</span></div>
<div><b data-en="Beach, pool and seafood · up to 6 h">Playa, alberca y mariscos · hasta 6 h</b><span data-en="We wait for you while you enjoy the day.">Te esperamos mientras disfrutas el día.</span></div>
<div><b data-en="Back to Campeche · about 1 h 30">Regreso a Campeche · 1 h 30 aprox.</b><span data-en="We drop you at your hotel.">Te dejamos en tu hotel.</span></div>
</div></div>
</div></div></section>
'''+INC),
 [('¿Cuánto cuesta ir a Bahía de Tortugas desde Campeche en taxi?','$4,000 MXN en taxi sedán privado para hasta 4 personas: ida, hasta 6 horas de espera y regreso, con casetas incluidas.','How much is a taxi to Bahía de Tortugas from Campeche?','$4,000 MXN in a private sedan for up to 4 people: ride there, up to 6 hours of waiting and ride back, tolls included.'),
  ('¿Por qué incluye la espera?','Porque desde el club de playa no hay transporte de regreso a Campeche. Te esperamos y te regresamos.','Why is waiting included?','Because there is no transport back to Campeche from the beach club. We wait for you and bring you back.'),
  ('¿Y si queremos quedarnos más tiempo?','Cada 15 minutos adicionales después de las 6 horas cuestan $100.','What if we want to stay longer?','Each additional 15 minutes after the 6 hours costs $100.'),
  ('¿Cobran entrada al club?','No, el club no cobra entrada; pagas lo que consumas.','Is there an entrance fee?','No, the club has no entrance fee; you pay for what you eat and drink.')],
 {'name':'Viaje a Bahía de Tortugas desde Campeche','price':'4000','wa':'Hola, quiero reservar el viaje a Bahía de Tortugas.','waen':'Hello, I would like to book the trip to Bahía de Tortugas.'})

# ---------- EDZNA + BAHIA
EBJS='''<script>
function ebT(){var g=document.getElementById('ebg').checked,t=5400+(g?800:0),f='$'+t.toLocaleString('en-US');document.getElementById('ebTot').textContent=f;
var es='Hola, quiero reservar el tour Edzná + Bahía de Tortugas'+(g?' con guía':'')+' ('+f+').',en='Hello, I would like to book the Edzná + Bahía de Tortugas tour'+(g?' with guide':'')+' ('+f+').';
document.querySelectorAll('.ebb').forEach(function(a){a.dataset.msg=es;a.dataset.msgen=en});if(window.waLinks)waLinks()}
document.getElementById('ebg').addEventListener('change',ebT);
</script>'''
page('edzna-bahia-de-tortugas','Tour Edzná y Bahía de Tortugas desde Campeche · $5,400 hasta 4 personas | Taxicel',
 'Tour privado en taxi desde Campeche: Zona Arqueológica de Edzná temprano y tarde de playa en Bahía de Tortugas. $5,400 hasta 4 personas, casetas y agua incluidas. Guía en Edzná +$800. WhatsApp 981 115 0093.',
 'edzna',('Edzná + Bahía de Tortugas','Edzná + Bahía de Tortugas'),
 ('''<span class="kick" data-en="Full day · ruins and beach">Día completo · ruinas y playa</span>
<h1 data-en="Edzná in the morning, <em>the beach in the afternoon</em>">Edzná en la mañana, <em>playa en la tarde</em></h1>
<p class="sub" data-en="We visit Edzná early, before the heat, and then head to Bahía de Tortugas for beach, pool and seafood. Private sedan for up to 4 people.">Visitamos Edzná temprano, antes del calor, y después vamos a Bahía de Tortugas a disfrutar playa, alberca y mariscos. Taxi sedán privado hasta 4 personas.</p>
<div class="row"><a class="btn b1" href="#arma" data-en="See the tour">Ver el tour</a></div>''',
 '''<section id="arma"><div class="w"><div class="two">
<div class="pk">
<h2 style="font-size:26px" data-en="Edzná + Bahía de Tortugas">Edzná + Bahía de Tortugas</h2>
<table>
<tr><td data-en="🚕 Private sedan, up to 4 people, hotel pick-up and drop-off">🚕 Sedán privado hasta 4 personas, recogida y regreso al hotel</td><td>✓</td></tr>
<tr><td data-en="🏛️ About 2 hours at Edzná">🏛️ Unas 2 horas en Edzná</td><td>✓</td></tr>
<tr><td data-en="🏖️ About 4 hours at Bahía de Tortugas">🏖️ Unas 4 horas en Bahía de Tortugas</td><td>✓</td></tr>
<tr><td data-en="🛣️ Tolls and 💧 bottled water included">🛣️ Casetas y 💧 agua embotellada incluidas</td><td>$5,400</td></tr>
<tr><td><label style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="checkbox" id="ebg" style="width:22px;height:22px;accent-color:#a6e22e"><span data-en="🧭 Add Campeche guide at Edzná (up to 4 people)">🧭 Agregar guía de Campeche en Edzná (hasta 4 personas)</span></label></td><td>+$800</td></tr>
<tr class="t"><td>Total</td><td><span id="ebTot">$5,400</span> <small style="font-size:14px">MXN</small></td></tr>
</table>
<div class="mu" style="font-size:14px" data-en="Entrance fees and meals are not included. Extra time: $100 for each additional 15 minutes.">Las entradas y la comida no están incluidas. Tiempo extra: $100 por cada 15 minutos adicionales.</div>
<a class="btn b1 wal ebb" href="#" data-msg="Hola, quiero reservar el tour Edzná + Bahía de Tortugas ($5,400)." data-msgen="Hello, I would like to book the Edzná + Bahía de Tortugas tour ($5,400)." data-en="Book on WhatsApp">Reservar por WhatsApp</a>
</div>
<div>
<h2 style="font-size:24px;margin-bottom:10px" data-en="Your day">Tu día</h2>
<div class="steps" style="grid-template-columns:1fr">
<div><b data-en="7:00 am · Pick-up">7:00 am · Recogida</b><span data-en="At your hotel or anywhere in Campeche.">En tu hotel o cualquier punto de Campeche.</span></div>
<div><b data-en="8:00 am · Edzná">8:00 am · Edzná</b><span data-en="About 2 hours to walk the site before the heat.">Unas 2 horas de recorrido, antes del calor.</span></div>
<div><b data-en="10:00 am · To the coast · 1 h 45">10:00 am · Rumbo a la costa · 1 h 45</b><span data-en="By the coastal highway to Champotón.">Por la carretera costera hacia Champotón.</span></div>
<div><b data-en="11:45 am · Bahía de Tortugas · about 4 h">11:45 am · Bahía de Tortugas · unas 4 h</b><span data-en="Beach, pool and fresh seafood.">Playa, alberca y mariscos frescos.</span></div>
<div><b data-en="4:00 pm · Back to Campeche">4:00 pm · Regreso a Campeche</b><span data-en="Arrival at your hotel around 5:30 pm.">Llegada a tu hotel alrededor de las 5:30 pm.</span></div>
</div></div>
</div></div></section>
'''+INC+EBJS),
 [('¿Cuánto cuesta el tour a Edzná y Bahía de Tortugas desde Campeche?','$5,400 MXN en taxi sedán privado para hasta 4 personas, con casetas y agua incluidas. Con guía en Edzná: $6,200.','How much is the Edzná and Bahía de Tortugas tour from Campeche?','$5,400 MXN in a private sedan for up to 4 people, tolls and water included. With a guide at Edzná: $6,200.'),
  ('¿A qué hora salimos?','A las 7:00 am, para llegar a Edzná cuando abre y evitar el calor. Regresamos a Campeche alrededor de las 5:30 pm.','What time do we leave?','At 7:00 am, to reach Edzná when it opens and avoid the heat. We are back in Campeche around 5:30 pm.'),
  ('¿Están incluidas las entradas y la comida?','No. La entrada a Edzná se paga en taquilla; Bahía de Tortugas no cobra entrada y cada quien paga lo que consume.','Are entrance fees and meals included?','No. Edzná entrance is paid at the ticket office; Bahía de Tortugas has no entrance fee and you pay for what you eat.'),
  ('¿Me recogen en mi hotel?','Sí, en tu hotel o en cualquier punto de Campeche.','Do you pick me up at my hotel?','Yes, at your hotel or anywhere in Campeche.')],
 {'name':'Tour Edzná y Bahía de Tortugas desde Campeche','price':'5400','wa':'Hola, quiero reservar el tour Edzná + Bahía de Tortugas.','waen':'Hello, I would like to book the Edzná + Bahía de Tortugas tour.'})

# ---------- TOURS HUB
page('tours','Tours desde Campeche en taxi privado · Edzná, Uxmal, Bahía de Tortugas | Taxicel',
 'Tours en taxi privado desde Campeche: Edzná, Uxmal, Bahía de Tortugas y Edzná + Bahía de Tortugas. Precios fijos para hasta 4 personas, recogida en tu hotel. WhatsApp 981 115 0093.',
 'uxmal',('Tours','Tours'),
 ('''<span class="kick" data-en="Private taxi tours from Campeche">Tours en taxi privado desde Campeche</span>
<h1 data-en="Choose your <em>tour</em>">Elige tu <em>tour</em></h1>
<p class="sub" data-en="Fixed prices for up to 4 people, pick-up at your hotel and we wait for you. Tap a tour to see details and book.">Precios fijos para hasta 4 personas, te recogemos en tu hotel y te esperamos. Toca un tour para ver detalles y reservar.</p>''',
 '''<section><div class="w"><div class="grid"><a class="card" href="../edzna/" style="text-decoration:none;color:inherit"><div class="cimg"><img src="../img/edzna.webp" alt="" loading="lazy"></div><h3 data-en="Edzná">Edzná</h3><p data-en="Maya ruins 1 hour from Campeche. Ride there, up to 2 h waiting and ride back. Package with guide available.">Ruinas mayas a 1 hora de Campeche. Ida, hasta 2 h de espera y regreso. Paquete con guía disponible.</p><div class="pr" data-en="$1,800 · with guide $2,500">$1,800 · con guía $2,500</div><span style="font-weight:800;color:var(--lime)" data-en="See tour →">Ver tour →</span></a><a class="card" href="../uxmal/" style="text-decoration:none;color:inherit"><div class="cimg"><img src="../img/uxmal.webp" alt="" loading="lazy"></div><h3 data-en="Uxmal">Uxmal</h3><p data-en="Full day. Add the Chocolate Museum and Yucatecan lunch.">Día completo. Agrega Museo del Chocolate y comida yucateca.</p><div class="pr" data-en="from $4,000">desde $4,000</div><span style="font-weight:800;color:var(--lime)" data-en="See tour →">Ver tour →</span></a><a class="card" href="../bahia-de-tortugas/" style="text-decoration:none;color:inherit"><div class="ic">🏖️</div><h3 data-en="Bahía de Tortugas">Bahía de Tortugas</h3><p data-en="Beach day past Champotón, up to 6 h waiting, tolls included.">Día de playa pasando Champotón, hasta 6 h de espera, casetas incluidas.</p><div class="pr" data-en="$4,000">$4,000</div><span style="font-weight:800;color:var(--lime)" data-en="See tour →">Ver tour →</span></a><a class="card" href="../edzna-bahia-de-tortugas/" style="text-decoration:none;color:inherit"><div class="cimg"><img src="../img/edzna.webp" alt="" loading="lazy"></div><h3 data-en="Edzná + Bahía de Tortugas">Edzná + Bahía de Tortugas</h3><p data-en="Edzná early and an afternoon at the beach. Tolls and water included. Optional guide.">Edzná temprano y tarde de playa. Casetas y agua incluidas. Guía opcional.</p><div class="pr" data-en="$5,400 · with guide $6,200">$5,400 · con guía $6,200</div><span style="font-weight:800;color:var(--lime)" data-en="See tour →">Ver tour →</span></a></div>
<p class="lead" style="margin-top:18px" data-en="Somewhere else in mind? Mérida, Calakmul, Sabancuy, Chichén Itzá… Ask us on WhatsApp.">¿Quieres ir a otro lugar? Mérida, Calakmul, Sabancuy, Chichén Itzá… Pregúntanos por WhatsApp.</p>
<div class="row"><a class="btn b2 wal" href="#" data-msg="Hola, quiero cotizar un tour." data-msgen="Hello, I would like a quote for a tour." data-en="💬 Ask for a quote">💬 Pedir cotización</a></div>
</div></section>
'''+INC),
 [('¿Los precios son por persona?','No, son por viaje en taxi sedán privado para hasta 4 personas.','Are prices per person?','No, they are per trip in a private sedan for up to 4 people.'),
  ('¿Están incluidas las entradas y la comida?','No. Las entradas se pagan en taquilla y la comida la paga cada quien.','Are entrance fees and meals included?','No. Entrance fees are paid at the ticket office and each person pays for their own meals.')],
 {'name':'Tours en taxi desde Campeche','price':'1800','wa':'Hola, quiero información de los tours.','waen':'Hello, I would like information about the tours.'})

# ---------- IRONMAN
IMJS='''<script>
var IM={p:1,b:1};function imS(k,d){IM[k]=Math.max(k=='p'?1:0,Math.min(k=='b'?5:14,IM[k]+d));imT()}
function imT(){var seats=IM.p+IM.b*2,ok=seats<=14,t=IM.p*200+IM.b*400,en=(typeof L!='undefined'&&L=='en');
document.getElementById('imP').textContent=IM.p;document.getElementById('imB').textContent=IM.b;
document.getElementById('imSeats').textContent=seats+'/14';document.getElementById('imSeats').style.color=ok?'':'#ff6b5b';
document.getElementById('imTot').textContent='$'+t.toLocaleString('en-US');
var m=en?('Hello, I would like the IRONMAN airport shuttle: '+IM.p+' person(s) and '+IM.b+' bike(s) ($'+t.toLocaleString('en-US')+').'):('Hola, quiero el traslado IRONMAN del aeropuerto: '+IM.p+' persona(s) y '+IM.b+' bici(s) ($'+t.toLocaleString('en-US')+').');
document.querySelectorAll('.imb').forEach(function(a){a.dataset.msg=m;a.dataset.msgen=m});if(window.waLinks)waLinks()}
window.addEventListener('load',imT);
</script>'''
page('ironman','IRONMAN 70.3 Campeche · Traslado del aeropuerto con bici | Taxicel',
 'Traslados para atletas del IRONMAN 70.3 Campeche: del aeropuerto a tu hotel en la ciudad, $200 por persona y $400 por bicicleta. Van privada $1,800. Reserva por WhatsApp 981 115 0093.',
 'van-aer',('IRONMAN','IRONMAN'),
 ('''<span class="kick" data-en="IRONMAN 70.3 Campeche · date to be confirmed">IRONMAN 70.3 Campeche · fecha por confirmar</span>
<h1 data-en="Your bike and you, <em>from the airport to your hotel</em>">Tú y tu bici, <em>del aeropuerto a tu hotel</em></h1>
<p class="sub" data-en="Transfers for athletes from Campeche International Airport to the city, with room for your bike box. Shared shuttle or private van.">Traslados para atletas del Aeropuerto Internacional de Campeche a la ciudad, con espacio para tu caja de bici. Colectivo o van privada.</p>
<div class="row"><a class="btn b1" href="#calc" data-en="Calculate my transfer">Calcular mi traslado</a></div>''',
 '''<section id="calc"><div class="w"><div class="two">
<div class="pk">
<h2 style="font-size:26px" data-en="Shared shuttle">Colectivo</h2>
<table>
<tr><td data-en="🧍 Athletes and companions · $200 each">🧍 Atletas y acompañantes · $200 c/u</td><td><span style="display:inline-flex;gap:8px;align-items:center"><button type="button" class="lg" onclick="imS('p',-1)">−</button><b id="imP">1</b><button type="button" class="lg" onclick="imS('p',1)">+</button></span></td></tr>
<tr><td data-en="🚴 Bikes · $400 each (a bike takes 2 seats)">🚴 Bicis · $400 c/u (cada bici ocupa 2 lugares)</td><td><span style="display:inline-flex;gap:8px;align-items:center"><button type="button" class="lg" onclick="imS('b',-1)">−</button><b id="imB">1</b><button type="button" class="lg" onclick="imS('b',1)">+</button></span></td></tr>
<tr><td data-en="Seats used">Lugares ocupados</td><td><b id="imSeats">3/14</b></td></tr>
<tr class="t"><td>Total</td><td><span id="imTot">$600</span> <small style="font-size:14px">MXN</small></td></tr>
</table>
<div class="mu" style="font-size:14px" data-en="Airport → your hotel in Campeche city, or hotel → airport after the race, same price. Van for up to 14 seats and up to 5 boxed bikes.">Aeropuerto → tu hotel en la ciudad, o hotel → aeropuerto después de la carrera, al mismo precio. Van de hasta 14 lugares y hasta 5 bicis en caja.</div>
<a class="btn b1 wal imb" href="#" data-msg="Hola, quiero el traslado IRONMAN del aeropuerto." data-msgen="Hello, I would like the IRONMAN airport shuttle." data-en="Book on WhatsApp">Reservar por WhatsApp</a>
</div>
<div style="display:grid;gap:14px">
<div class="pk" style="border-color:var(--line)">
<h2 style="font-size:24px" data-en="🚐 Private van">🚐 Van privada</h2>
<div class="price">$1,800 <small>MXN</small></div>
<div class="mu" style="font-size:14px" data-en="The whole van for your team or family, from the airport to your hotel. Fits up to 5 bikes in their boxes.">Toda la van para tu equipo o tu familia, del aeropuerto a tu hotel. Caben hasta 5 bicis en su caja.</div>
<a class="btn b3 wal" href="#" data-msg="Hola, quiero la van privada para el IRONMAN ($1,800)." data-msgen="Hello, I would like the private van for the IRONMAN ($1,800)." data-en="Book private van">Reservar van privada</a>
</div>
<div class="pk" style="border-color:var(--line)">
<h2 style="font-size:24px" data-en="🚕 City taxi">🚕 Taxi sedán</h2>
<div class="price">$300 <small data-en="MXN per taxi">MXN por taxi</small></div>
<div class="mu" style="font-size:14px" data-en="Up to 4 people. A bike box fits only sometimes: send us its size on WhatsApp and we confirm.">Hasta 4 personas. La caja de la bici solo cabe a veces: mándanos la medida por WhatsApp y te confirmamos.</div>
<a class="btn b3 wal" href="#" data-msg="Hola, quiero un taxi sedán del aeropuerto para el IRONMAN ($300). Mi caja de bici mide: " data-msgen="Hello, I would like a sedan taxi from the airport for the IRONMAN ($300). My bike box size is: " data-en="Ask for a taxi">Pedir taxi</a>
</div>
<div class="ph2"><img src="../img/van-aer.webp" alt="Van de 14 pasajeros en el Aeropuerto de Campeche" loading="lazy" style="object-position:center 40%"></div>
</div>
</div></div></section>
'''+INC+IMJS),
 [('¿Cuánto cuesta el traslado del aeropuerto para el IRONMAN?','En colectivo, $200 por persona y $400 por bicicleta. Van privada: $1,800.','How much is the airport transfer for the IRONMAN?','Shared shuttle: $200 per person and $400 per bike. Private van: $1,800.'),
  ('¿El regreso al aeropuerto cuesta igual?','Sí, del hotel al aeropuerto después de la carrera es el mismo precio.','Is the ride back to the airport the same price?','Yes, from your hotel to the airport after the race is the same price.'),
  ('¿Puedo ir en taxi normal?','Sí, $300 por taxi para hasta 4 personas. La caja de la bici solo cabe a veces; mándanos la medida por WhatsApp.','Can I take a regular taxi?','Yes, $300 per taxi for up to 4 people. A bike box fits only sometimes; send us its size on WhatsApp.'),
  ('¿Cuántas bicis caben en la van?','Hasta 5 bicis en su caja.','How many bikes fit in the van?','Up to 5 bikes in their boxes.'),
  ('¿Por qué la bici cuesta más?','Porque la caja de la bici ocupa 2 lugares de la van.','Why does the bike cost more?','Because a bike box takes 2 seats in the van.'),
  ('¿Cuándo es el IRONMAN 70.3 Campeche?','La fecha está por confirmar. Escríbenos y te avisamos.','When is IRONMAN 70.3 Campeche?','The date is to be confirmed. Message us and we will let you know.')],
 {'name':'Traslado aeropuerto IRONMAN Campeche','price':'200','wa':'Hola, quiero el traslado IRONMAN del aeropuerto.','waen':'Hello, I would like the IRONMAN airport shuttle.'})
