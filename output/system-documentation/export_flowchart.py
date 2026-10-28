from pathlib import Path
import math
import textwrap
import xml.etree.ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

folder = Path(__file__).resolve().parent
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', 'C:/Windows/Fonts/arialbd.ttf'))
root = ET.parse(folder / 'PhysiqueQuest_System_Flowchart.drawio').getroot()
out = canvas.Canvas(str(folder / 'PhysiqueQuest_System_Flowchart.pdf'))
palette = {'ellipse': ('#d5e8d4', '#4a825b'), 'rhombus': ('#fff2cc', '#d6b656'), 'shape=parallelogram': ('#e1d5e7', '#9673a6'), 'shape=cylinder3': ('#f8cecc', '#b85450'), 'shape=offPageConnector': ('#f5f5f5', '#666666'), 'rounded=0': ('#dae8fc', '#6c8ebf')}

for page in root.findall('diagram'):
    cells = page.findall('./mxGraphModel/root/mxCell')
    vertices = {cell.get('id'): cell for cell in cells if cell.get('vertex') == '1' and cell.get('id') != 'legend'}
    edges = [cell for cell in cells if cell.get('edge') == '1']
    boxes = {key: tuple(float(cell.find('mxGeometry').get(k)) for k in ('x', 'y', 'width', 'height')) for key, cell in vertices.items()}
    width = max(x+w for x,y,w,h in boxes.values()) + 80
    height = max(y+h for x,y,w,h in boxes.values()) + 200
    out.setPageSize((width, height))
    out.setTitle('PhysiqueQuest System Flowchart')
    out.setFont('ArialBold', 24); out.setFillColor(colors.HexColor('#102238')); out.drawString(35, height-35, page.get('name'))
    def center(box):
        x,y,w,h=box
        return (x+w/2, height-85-y-h/2)
    def boundary(box, tx, ty):
        x,y,w,h=box; cx,cy=center(box); dx,dy=tx-cx,ty-cy
        if not dx and not dy: return cx,cy
        factor=min((w/2)/abs(dx) if dx else 1e9,(h/2)/abs(dy) if dy else 1e9)
        return cx+dx*factor,cy+dy*factor
    out.setLineWidth(1.1)
    for edge in edges:
        a,b=boxes[edge.get('source')],boxes[edge.get('target')]
        ac,bc=center(a),center(b)
        x1,y1=boundary(a,*bc); x2,y2=boundary(b,*ac)
        out.setStrokeColor(colors.HexColor('#64748b')); out.line(x1,y1,x2,y2)
        ang=math.atan2(y2-y1,x2-x1); length=9
        path=out.beginPath(); path.moveTo(x2,y2); path.lineTo(x2-length*math.cos(ang-.4),y2-length*math.sin(ang-.4)); path.lineTo(x2-length*math.cos(ang+.4),y2-length*math.sin(ang+.4)); path.close()
        out.setFillColor(colors.HexColor('#64748b')); out.drawPath(path,fill=1,stroke=0)
        if edge.get('value'):
            label=edge.get('value'); mx,my=(x1+x2)/2,(y1+y2)/2
            out.setFont('Arial',11); w=pdfmetrics.stringWidth(label,'Arial',11)
            out.setFillColor(colors.white); out.rect(mx-w/2-3,my-2,w+6,14,fill=1,stroke=0)
            out.setFillColor(colors.HexColor('#334155')); out.drawCentredString(mx,my+1,label)
    for key,cell in vertices.items():
        x,y,w,h=boxes[key]; y=height-85-y-h
        style=cell.get('style','').split(';')[0]
        fill,stroke=palette.get(style,('#ffffff','#666666'))
        out.setFillColor(colors.HexColor(fill)); out.setStrokeColor(colors.HexColor(stroke))
        if style == 'ellipse': out.ellipse(x,y,x+w,y+h,fill=1,stroke=1)
        elif style == 'rhombus':
            p=out.beginPath(); p.moveTo(x+w/2,y+h); p.lineTo(x+w,y+h/2); p.lineTo(x+w/2,y); p.lineTo(x,y+h/2); p.close(); out.drawPath(p,fill=1,stroke=1)
        elif style in ('shape=parallelogram','shape=offPageConnector'):
            p=out.beginPath()
            if style == 'shape=parallelogram':
                p.moveTo(x+18,y); p.lineTo(x+w,y); p.lineTo(x+w-18,y+h); p.lineTo(x,y+h)
            else:
                p.moveTo(x,y+h); p.lineTo(x+w,y+h); p.lineTo(x+w,y+18); p.lineTo(x+w/2,y); p.lineTo(x,y+18)
            p.close(); out.drawPath(p,fill=1,stroke=1)
        elif style == 'shape=cylinder3':
            out.roundRect(x,y,x+w,y+h,12,fill=1,stroke=1); out.arc(x,y+h-25,x+w,y+h,startAng=180,extent=180)
        else: out.rect(x,y,w,h,fill=1,stroke=1)
        label=cell.get('value',''); lines=textwrap.wrap(label,width=32 if style=='rhombus' else 39,break_long_words=False) or ['']
        size=13 if w>80 else 12
        out.setFont('Arial',size); out.setFillColor(colors.HexColor('#182538'))
        for i,line in enumerate(lines): out.drawCentredString(x+w/2,y+h/2+(len(lines)-1)*8-i*16-4,line)
    out.setFont('Arial',11); out.setFillColor(colors.HexColor('#475569'))
    out.drawString(35,35,'Oval: start/end  |  Rectangle: process  |  Diamond: decision  |  Parallelogram: input/output  |  Cylinder: database  |  Pentagon: off-page  |  Paired circles: on-page')
    out.showPage()
out.save()
print('Exported',len(root.findall('diagram')),'pages')
