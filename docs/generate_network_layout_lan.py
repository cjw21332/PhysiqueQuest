from pathlib import Path
import html
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent
out=root/'diagrams'
out.mkdir(exist_ok=True)
nodes={
'phone':(75,190,270,115,'Phone / Expo Go',['Native shell + Next.js WebView','Camera, motion and location bridge']),
'browser':(75,355,270,100,'Desktop browser',['Same Next.js frontend','No Expo shell required']),
'local':(75,560,270,155,'Local rep counter',['Device CPU + Web Worker','Model / WASM from frontend','Video frames stay on device','Only reviewed results are saved']),
'wifi':(425,190,230,115,'Private Wi-Fi / LAN',['Phone and computer share LAN','Example host: 192.168.1.10']),
'web':(765,190,300,115,'Next.js frontend',['TCP 3000: pages and assets','Runs on development computer']),
'api':(765,430,300,125,'Shared NestJS API',['TCP 4000 /api','Public library + private accounts','Coach / workouts / safety']),
'metro':(425,835,230,115,'Expo Metro',['Usually TCP 8081','Development bundle only']),
'mongo':(1225,430,555,125,'MongoDB Atlas',['Database reached by account API only','MONGODB_URI controls host, TLS and port','15 active application collections']),
'exercise':(1225,660,555,115,'ExerciseDB API',['Exercise metadata, instructions and GIF URLs','One shared API provider + request queue']),
'gif':(1225,190,555,115,'Exercise media host / CDN',['Browser or WebView loads GIFs directly','Host is supplied by the catalog response']),
'food':(1225,835,265,135,'Food-scan providers',['Gemini: identify food image','USDA: nutrient lookup','Backend credentials required']),
'optional':(1520,835,260,135,'Configured providers',['EmailJS / custom email','Alert-delivery endpoint','Pose stays on-device'])}
edges=[
('phone','wifi',[(345,247),(425,247)],'LAN',367,232,False),
('browser','wifi',[(345,405),(385,405),(385,275),(425,275)],'LAN',352,341,False),
('wifi','web',[(655,225),(765,225)],'3000',693,210,False),
('wifi','api',[(655,255),(705,255),(705,485),(765,485)],'4000 /api',674,388,False),
('phone','local',[(75,270),(60,270),(60,635),(75,635)],'Device processing',90,515,False),
('api','mongo',[(1065,482),(1225,482)],'DB connection',1083,466,False),
('api','exercise',[(1065,525),(1130,525),(1130,685),(1225,685)],'Library + new plans',1075,590,False),
('browser','gif',[(345,390),(365,390),(365,335),(1140,335),(1140,247),(1225,247)],'Direct client GIF request',780,325,False),
('api','food',[(1065,540),(1160,540),(1160,800),(1355,800),(1355,835)],'On food scan',1050,788,True),
('api','optional',[(980,555),(1195,555),(1195,790),(1650,790),(1650,835)],'When configured',1455,815,True),
('metro','phone',[(425,890),(375,890),(375,325),(290,325),(290,305)],'Expo bundle',385,805,True)]
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1860" height="1110" viewBox="0 0 1860 1110">','<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 Z" fill="#52657a"/></marker></defs>','<rect width="1860" height="1110" fill="#ffffff"/>']
def text(x,y,s,size=16,color='#15314b',bold=False):
 svg.append(f'<text x="{x}" y="{y}" font-family="Arial, sans-serif" font-size="{size}" fill="{color}"'+(' font-weight="700"' if bold else '')+'>'+html.escape(s)+'</text>')
text(40,50,'PhysiqueQuest v2.7.4 / Network layout',30,bold=True)
text(40,84,'Current LAN development architecture. Cloud services are outbound dependencies; this is not a live network scan.',17)
for x,w,title in [(40,1060,'Local private network — phone, browser and development computer'),(1185,635,'Internet / external services')]:
 svg.append(f'<rect x="{x}" y="125" width="{w}" height="885" rx="15" fill="#f4f7fb" stroke="#c5d2df"/>');text(x+20,157,title,17,bold=True)
for source,target,points,label,lx,ly,dashed in edges:
 coords=' '.join(f'{x},{y}' for x,y in points)
 svg.append(f'<polyline points="{coords}" fill="none" stroke="#52657a" stroke-width="2" marker-end="url(#arrow)"'+(' stroke-dasharray="7 5"' if dashed else '')+'/>')
 svg.append(f'<rect x="{lx-5}" y="{ly-16}" width="{len(label)*8+10}" height="22" fill="#f4f7fb"/>');text(lx,ly,label,14)
for key,(x,y,w,h,title,lines) in nodes.items():
 color='#26743a' if key in ['phone','browser','local'] else '#244ea3' if key in ['web','api','coach','metro','wifi'] else '#176b80'
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#fff" stroke="{color}" stroke-width="2"/>')
 text(x+15,y+28,title,18,color,True)
 for i,line in enumerate(lines):text(x+15,y+54+i*23,line,14)
text(40,1045,'Solid arrows: request/data paths. Dashed arrows: development-only or feature/configuration-dependent paths.',16)
text(40,1075,'The router is a network path, not an API proxy. GIF requests execute on the client after metadata is returned.',16)
(out/'NETWORK-layout-LAN.svg').write_text('\n'.join(svg)+'</svg>',encoding='utf-8')
mx=ET.Element('mxfile',host='app.diagrams.net',type='device');diagram=ET.SubElement(mx,'diagram',name='Network layout',id='network')
model=ET.SubElement(diagram,'mxGraphModel',page='1',pageWidth='1860',pageHeight='1110',grid='1');cells=ET.SubElement(model,'root');ET.SubElement(cells,'mxCell',id='0');ET.SubElement(cells,'mxCell',id='1',parent='0')
for key,(x,y,w,h,title,lines) in nodes.items():
 value='<b>'+html.escape(title)+'</b><br><br>'+'<br>'.join(html.escape(line) for line in lines)
 c=ET.SubElement(cells,'mxCell',id=key,value=value,vertex='1',parent='1',style='rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#26743a;fontSize=15;fontFamily=Arial;align=left;spacing=14;')
 ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})
for i,(source,target,points,label,lx,ly,dashed) in enumerate(edges):
 c=ET.SubElement(cells,'mxCell',id=f'edge{i}',value=label,edge='1',parent='1',source=source,target=target,style='edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;fontSize=14;labelBackgroundColor=#ffffff;'+('dashed=1;' if dashed else ''))
 g=ET.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'});arr=ET.SubElement(g,'Array',attrib={'as':'points'})
 for x,y in points[1:-1]:ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))
ET.indent(mx);ET.ElementTree(mx).write(out/'PhysiqueQuest-Network-LAN.drawio',encoding='utf-8',xml_declaration=True)
for name in ['NETWORK-layout-LAN.svg','PhysiqueQuest-Network-LAN.drawio']:ET.parse(out/name)
print('Created and XML-validated network SVG and editable draw.io diagram.')
