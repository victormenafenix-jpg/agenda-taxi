import json,os,re,sys
from bs4 import BeautifulSoup
from urllib.parse import urljoin
os.chdir(sys.argv[1])
D='https://taxicelcampeche.com'
M={'':'','aeropuerto':'airport','tren-maya':'tren-maya','edzna':'edzna','uxmal':'uxmal','bahia-de-tortugas':'bahia-de-tortugas','edzna-bahia-de-tortugas':'edzna-bahia-de-tortugas','tours':'tours','ironman':'ironman','santuario':'sanctuary'}
T={'':('Taxi in Campeche 24/7 · Airport & Tren Maya transfers | Taxicel','Private taxi in Campeche, Mexico, 24 hours: airport and Tren Maya station transfers, Edzná and Uxmal tours. Fixed prices, card payment and invoice. WhatsApp +52 981 115 0093.'),
'aeropuerto':('Campeche Airport Taxi · from $300 MXN · 24 hours | Taxicel','Taxi from Campeche International Airport to your hotel, from $300 MXN in a sedan for up to 4 people. Private van for up to 14 people $1,500. We wait if your flight is late. WhatsApp +52 981 115 0093.'),
'tren-maya':('Tren Maya Campeche Station Taxi · $300 MXN | Taxicel','Taxi between the Tren Maya Campeche station and your hotel: $300 MXN in a sedan for up to 4 people. Van for groups. We wait if the train is late. 24 hours. WhatsApp +52 981 115 0093.'),
'edzna':('Edzná Tour from Campeche with Guide · $2,500 MXN up to 4 | Taxicel','Private taxi to Edzná archaeological site from Campeche: round trip with up to 2 hours of waiting, $1,800 MXN, or with a local guide $2,500 MXN for up to 4 people. WhatsApp +52 981 115 0093.'),
'uxmal':('Uxmal Tour from Campeche by Private Taxi · from $4,000 MXN | Taxicel','Private taxi tour from Campeche to Uxmal: ride there, up to 2 hours of waiting and ride back for $4,000 MXN, up to 4 people. Add the Chocolate Museum and lunch. WhatsApp +52 981 115 0093.'),
'bahia-de-tortugas':('Bahía de Tortugas Beach Day from Campeche · $4,000 MXN | Taxicel','Private taxi from Campeche to Bahía de Tortugas beach club near Champotón: up to 6 hours of waiting and ride back, tolls included, $4,000 MXN for up to 4 people. WhatsApp +52 981 115 0093.'),
'edzna-bahia-de-tortugas':('Edzná + Bahía de Tortugas Tour from Campeche · $5,400 MXN | Taxicel','Private full-day tour from Campeche: Edzná ruins in the morning and Bahía de Tortugas beach in the afternoon. $5,400 MXN up to 4 people, tolls and water included. Guide +$800. WhatsApp +52 981 115 0093.'),
'ironman':('IRONMAN 70.3 Campeche · Airport Transfer with Bike | Taxicel','Transfers for IRONMAN 70.3 Campeche athletes from the airport to your hotel: $200 MXN per person and $400 MXN per bike. Private van $1,800 MXN. Book on WhatsApp +52 981 115 0093.'),
'santuario':('Taxi to the Sanctuary of the Immaculate Heart of Mary, Uayamón · from $450 MXN | Taxicel','Taxi from Campeche to the Sanctuary of the Immaculate Heart of Mary in Uayamón: from downtown $450 MXN, from the Tren Maya station $600. Round trip with up to 2 h 45 min waiting $1,100. Mass times. WhatsApp +52 981 115 0093.'),
'tours':('Private Taxi Tours from Campeche · Edzná, Uxmal, Bahía de Tortugas | Taxicel','Private taxi tours from Campeche, Mexico: Edzná, Uxmal, Bahía de Tortugas and Edzná + Bahía de Tortugas. Fixed prices for up to 4 people, hotel pick-up. WhatsApp +52 981 115 0093.')}
def es_url(s): return '/'+(s+'/' if s else '')
def en_url(s): return '/en/'+(M[s]+'/' if s else '')
def mappath(p):
    m=re.match(r'^/([a-z-]*)/?$',p)
    if m and m.group(1) in M: return en_url(m.group(1))
    return p
for s in M:
    src=(s+'/' if s else '')+'index.html'
    raw=open(src).read()
    # add hreflang + english button to the Spanish page
    sp=BeautifulSoup(raw,'html.parser')
    for l in sp.find_all('link',rel='alternate'): l.decompose()
    for lang,u in [('es',es_url(s)),('en',en_url(s)),('x-default',es_url(s))]:
        t=sp.new_tag('link',rel='alternate',hreflang=lang,href=D+u);sp.head.append(t)
    b=sp.find(id='lg')
    if b: 
        b.name='a';b['href']=en_url(s);b['style']='text-decoration:none';b.attrs.pop('onclick',None);b.string='English';b.attrs.pop('id',None)
    open(src,'w').write(str(sp))
    # build English page
    e=BeautifulSoup(str(sp),'html.parser');e.html['lang']='en'
    for el in e.select('[data-en]'):
        frag=BeautifulSoup(el['data-en'],'html.parser');el.clear()
        for c in list(frag.contents): el.append(c)
        del el['data-en']
    for el in e.select('[data-enph]'):
        el['placeholder']=el['data-enph'];del el['data-enph']
    for el in e.select('[data-msgen]'): el['data-msg']=el['data-msgen']
    base=es_url(s)
    for tag,att in [('a','href'),('img','src'),('link','href'),('script','src')]:
        for el in e.find_all(tag):
            v=el.get(att)
            if not v or v.startswith(('http','mailto:','#','data:')): continue
            ab=urljoin(base,v);path,_,frag=ab.partition('#')
            if tag=='a': path=mappath(path)
            el[att]=path+('#'+frag if frag else '')
    for el in e.find_all(attrs={'style':True}):
        el['style']=re.sub(r'url\((?!/|http)([^)]*)\)',lambda m:'url(/'+m.group(1)+')' if m.group(1).startswith('img/') else m.group(0),el['style'])
    for a in e.find_all('a',href=True):
        if a.get_text().strip()=='English': a['href']=es_url(s);a.string='Español'
    tt,dd=T[s];e.title.string=tt
    for m_ in e.find_all('meta'):
        if m_.get('name')=='description': m_['content']=dd
        if m_.get('property')=='og:title': m_['content']=tt
        if m_.get('property')=='og:description': m_['content']=dd
    c=e.find('link',rel='canonical')
    if c: c['href']=D+en_url(s)
    else:
        c=e.new_tag('link',rel='canonical',href=D+en_url(s));e.head.append(c)
    for sc in e.find_all('script',type='application/ld+json'):
        try: j=json.loads(sc.string)
        except Exception: continue
        L=j if isinstance(j,list) else [j]
        for o in L:
            if o.get('@type')=='FAQPage':
                o['mainEntity']=[{'@type':'Question','name':d.summary.get_text(),'acceptedAnswer':{'@type':'Answer','text':d.p.get_text()}} for d in e.select('details') if d.summary and d.p]
            elif 'description' in o: o['description']=dd
        sc.string=json.dumps(j,ensure_ascii=False)
    # force english mode for scripts
    last=e.find_all('script')[-1]
    js=e.new_tag('script');js.string="L='en';document.documentElement.lang='en';if(window.waLinks)waLinks();"
    cj=e.find('script',src='/comun.js');cj.insert_after(js)
    out='en/'+(M[s]+'/' if s else '')
    os.makedirs(out,exist_ok=True);open(out+'index.html','w').write(str(e))
sm=open('sitemap.xml').read()
add=''.join(f'<url><loc>{D}{en_url(s)}</loc></url>\n' for s in M if D+en_url(s) not in sm)
open('sitemap.xml','w').write(sm.replace('</urlset>',add+'</urlset>'))
print('ok')
