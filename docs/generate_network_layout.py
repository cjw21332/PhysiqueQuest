from pathlib import Path
import html
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent
out=root/'diagrams'
out.mkdir(exist_ok=True)
nodes={
'phone':(70,190,300,125,'Installed Android app',['com.physiquequest.app','Bundled native shell + WebView','Internet via Wi-Fi or mobile data']),
'local':(70,450,300,155,'On-device rep counting',['Video decoding + pose worker','Model / WASM from hosted web','Frames stay on the device','Reviewed results go to the API']),
'install':(70,860,300,135,'Installation / app updates',['Google Play distribution','or a signed release APK','Separate from runtime requests']),
'edge':(480,190,250,150,'HTTPS entry / proxy',['Public DNS + TLS: TCP 443','App + shared API hosts','Routes to private services','Example domains in document']),
'web':(850,190,380,125,'Hosted Next.js frontend',['app.physiquequest.example','Pages, JS, local model / WASM assets','Example internal port: 3000']),
'api':(850,450,380,125,'Hosted shared NestJS API',['api.physiquequest.example/api','Public library + JWT user features','Example internal port: 4000']),
'mongo':(1490,450,400,125,'MongoDB Atlas',['Backend-only authenticated connection','TLS / database network access controls','15 active application collections']),
'exercise':(1490,700,400,125,'ExerciseDB API',['Exercise metadata and GIF URLs','Shared by library + saved-plan generation','Outbound HTTPS']),
'gif':(1490,190,400,125,'Exercise media host / CDN',['Android WebView fetches GIFs directly','HTTPS URL supplied by catalog','Not a separate project database']),
'food':(1490,930,400,125,'Food-scan providers',['Gemini identification + USDA nutrients','Food images go through the account API','Provider keys remain on the server']),
'optional':(850,930,380,125,'Configured delivery providers',['EmailJS or custom email endpoint','Safety-alert delivery endpoint','Pose processing stays on-device'])}
edges=[
('phone','edge',[(370,240),(480,240)],'HTTPS 443',380,225,False),
('edge','web',[(730,235),(850,235)],'Web host',750,219,False),
('edge','api',[(730,280),(790,280),(790,510),(850,510)],'API host',760,410,False),
('phone','local',[(220,315),(220,450)],'Device processing',235,395,False),
('api','mongo',[(1230,510),(1490,510)],'Database driver / TLS',1265,492,False),
('api','exercise',[(1230,545),(1320,545),(1320,720),(1490,720)],'Library + new plans',1335,630,False),
('phone','gif',[(370,280),(425,280),(425,365),(1415,365),(1415,250),(1490,250)],'Direct HTTPS media request',900,350,False),
('api','food',[(1230,565),(1360,565),(1360,990),(1490,990)],'On food scan',1370,905,True),
('api','optional',[(850,550),(810,550),(810,900),(1040,900),(1040,930)],'When configured',860,885,True),
('install','phone',[(70,925),(55,925),(55,250),(70,250)],'Install / update',80,810,True)]
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1960" height="1210" viewBox="0 0 1960 1210">','<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 Z" fill="#52657a"/></marker></defs>','<rect width="1960" height="1210" fill="#ffffff"/>']
def text(x,y,s,size=16,color='#15314b',bold=False):
 svg.append(f'<text x="{x}" y="{y}" font-family="Arial, sans-serif" font-size="{size}" fill="{color}"'+(' font-weight="700"' if bold else '')+'>'+html.escape(s)+'</text>')
text(40,50,'PhysiqueQuest / Android deployment network',30,bold=True)
text(40,84,'Target topology for the installed Android release app. Example hosts and private service ports require deployment configuration.',17)
for x,w,title in [(40,360,'Android device'),(450,820,'Application hosting'),(1450,470,'Database / providers')]:
 svg.append(f'<rect x="{x}" y="125" width="{w}" height="980" rx="15" fill="#f4f7fb" stroke="#c5d2df"/>');text(x+20,157,title,17,bold=True)
for source,target,points,label,lx,ly,dashed in edges:
 coords=' '.join(f'{x},{y}' for x,y in points)
 svg.append(f'<polyline points="{coords}" fill="none" stroke="#52657a" stroke-width="2" marker-end="url(#arrow)"'+(' stroke-dasharray="7 5"' if dashed else '')+'/>')
 svg.append(f'<rect x="{lx-5}" y="{ly-16}" width="{len(label)*8+10}" height="22" fill="#f4f7fb"/>');text(lx,ly,label,14)
for key,(x,y,w,h,title,lines) in nodes.items():
 color='#26743a' if key in ['phone','local'] else '#244ea3' if key in ['web','api','coach','edge','install'] else '#176b80'
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#fff" stroke="{color}" stroke-width="2"/>')
 text(x+15,y+28,title,18,color,True)
 for i,line in enumerate(lines):text(x+15,y+54+i*23,line,14)
text(40,1140,'Solid arrows: runtime request paths. Dashed arrows: installation or feature-dependent paths. All public app requests use HTTPS.',16)
text(40,1175,'The release app needs no Expo Go or Metro server. The existing WebView design still requires the hosted frontend and APIs.',16)
(out/'NETWORK-layout.svg').write_text('\n'.join(svg)+'</svg>',encoding='utf-8')
mx=ET.Element('mxfile',host='app.diagrams.net',type='device');diagram=ET.SubElement(mx,'diagram',name='Network layout',id='network')
model=ET.SubElement(diagram,'mxGraphModel',page='1',pageWidth='1960',pageHeight='1210',grid='1');cells=ET.SubElement(model,'root');ET.SubElement(cells,'mxCell',id='0');ET.SubElement(cells,'mxCell',id='1',parent='0')
for key,(x,y,w,h,title,lines) in nodes.items():
 value='<b>'+html.escape(title)+'</b><br><br>'+'<br>'.join(html.escape(line) for line in lines)
 c=ET.SubElement(cells,'mxCell',id=key,value=value,vertex='1',parent='1',style='rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#26743a;fontSize=15;fontFamily=Arial;align=left;spacing=14;')
 ET.SubElement(c,'mxGeometry',x=str(x),y=str(y),width=str(w),height=str(h),attrib={'as':'geometry'})
for i,(source,target,points,label,lx,ly,dashed) in enumerate(edges):
 c=ET.SubElement(cells,'mxCell',id=f'edge{i}',value=label,edge='1',parent='1',source=source,target=target,style='edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;fontSize=14;labelBackgroundColor=#ffffff;'+('dashed=1;' if dashed else ''))
 g=ET.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'});arr=ET.SubElement(g,'Array',attrib={'as':'points'})
 for x,y in points[1:-1]:ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))
ET.indent(mx);ET.ElementTree(mx).write(out/'PhysiqueQuest-Network.drawio',encoding='utf-8',xml_declaration=True)
for name in ['NETWORK-layout.svg','PhysiqueQuest-Network.drawio']:ET.parse(out/name)
print('Created and XML-validated network SVG and editable draw.io diagram.')
