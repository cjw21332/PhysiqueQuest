"""Generate two SVG previews and an editable, two-page diagrams.net ERD."""
from pathlib import Path
import html
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'diagrams'
OUTPUT.mkdir(exist_ok=True)


def fields(filename):
    text = (ROOT / filename).read_text(encoding='utf-8-sig')
    result = {}
    for name, body in re.findall(r'^    (\w+) \{(.*?)^    \}', text, re.M | re.S):
        rows = []
        for line in body.strip().splitlines():
            match = re.match(r'\s*(\S+)\s+(\S+)(.*)', line)
            kind, field, tail = match.groups()
            key = ' [PK]' if 'PK' in tail else ' [UK]' if 'UK' in tail else ''
            optional = ' ?' if 'optional' in tail or 'nullable' in tail else ''
            rows.append(f'{field}{key}{optional}: {kind.replace("_array", "[]")}')
        result[name] = rows
    return result


class Page:
    def __init__(self, name, width, height, title, subtitle):
        self.name, self.width, self.height = name, width, height
        self.nodes, self.edges, self.texts = {}, [], []
        self.text(48, 48, title, 30, '#15314b')
        self.text(48, 82, subtitle, 16, '#52657a')

    def text(self, x, y, value, size=15, color='#52657a'):
        self.texts.append((x, y, value, size, color))

    def box(self, key, x, y, title, rows, width=330, color='#176b80'):
        self.nodes[key] = dict(x=x, y=y, w=width, h=54 + 24 * len(rows),
                               title=title, rows=rows, color=color)

    def edge(self, start, end, points, label, lx, ly, dashed=True):
        self.edges.append((start, end, points, label, lx, ly, dashed))

    def svg(self):
        chunks = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.width}" height="{self.height}" viewBox="0 0 {self.width} {self.height}">',
                  '<rect width="100%" height="100%" fill="#f4f7fb"/>',
                  '<g font-family="Arial, sans-serif">']
        for _, _, pts, label, lx, ly, dashed in self.edges:
            coords = ' '.join(f'{x},{y}' for x, y in pts)
            dash = ' stroke-dasharray="6 5"' if dashed else ''
            chunks.append(f'<polyline points="{coords}" fill="none" stroke="#8297ac" stroke-width="2"{dash}/>')
            # Keep labels legible over relationship lines.
            tw = len(label) * 7.8 + 14
            chunks.append(f'<rect x="{lx-5}" y="{ly-16}" width="{tw}" height="23" rx="4" fill="#f4f7fb"/>')
            chunks.append(f'<text x="{lx}" y="{ly}" font-size="14" fill="#435a71">{html.escape(label)}</text>')
        for n in self.nodes.values():
            x, y, w, h, color = (n[k] for k in ('x', 'y', 'w', 'h', 'color'))
            chunks.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="white" stroke="#c7d4e1"/>')
            chunks.append(f'<path d="M{x+9},{y} H{x+w-9} Q{x+w},{y} {x+w},{y+9} V{y+40} H{x} V{y+9} Q{x},{y} {x+9},{y}" fill="{color}"/>')
            chunks.append(f'<text x="{x+16}" y="{y+27}" font-size="18" font-weight="bold" fill="white">{html.escape(n["title"])}</text>')
            for index, row in enumerate(n['rows']):
                chunks.append(f'<text x="{x+16}" y="{y+63+24*index}" font-size="15" fill="#253e54">{html.escape(row)}</text>')
        for x, y, value, size, color in self.texts:
            chunks.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}">{html.escape(value)}</text>')
        chunks.append('</g></svg>')
        return '\n'.join(chunks)

    def drawio(self, parent):
        diagram = ET.SubElement(parent, 'diagram', name=self.name, id=self.name.replace(' ', '-'))
        model = ET.SubElement(diagram, 'mxGraphModel', dx='1400', dy='900', grid='1', gridSize='10',
                              page='1', pageScale='1', pageWidth=str(self.width), pageHeight=str(self.height),
                              background='#f4f7fb', math='0', shadow='0')
        root = ET.SubElement(model, 'root')
        ET.SubElement(root, 'mxCell', id='0')
        ET.SubElement(root, 'mxCell', id='1', parent='0')
        for key, n in self.nodes.items():
            cell = ET.SubElement(root, 'mxCell', id=key, value=n['title'], vertex='1', parent='1',
                                 style=f'swimlane;html=0;startSize=40;horizontal=1;rounded=1;arcSize=8;fillColor={n["color"]};swimlaneFillColor=#ffffff;strokeColor=#c7d4e1;fontColor=#ffffff;fontStyle=1;fontSize=18;align=left;spacingLeft=16;collapsible=0;')
            ET.SubElement(cell, 'mxGeometry', x=str(n['x']), y=str(n['y']), width=str(n['w']), height=str(n['h']), **{'as': 'geometry'})
            for index, row in enumerate(n['rows']):
                child = ET.SubElement(root, 'mxCell', id=f'{key}-field-{index}', value=row, vertex='1', parent=key,
                                      style='text;html=0;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=15;fontColor=#253e54;spacingLeft=16;')
                ET.SubElement(child, 'mxGeometry', x='0', y=str(46+24*index), width=str(n['w']), height='24', **{'as': 'geometry'})
        for index, (start, end, pts, label, lx, ly, dashed) in enumerate(self.edges):
            # Bind connectors to the movable entity boxes, retaining editable waypoints.
            source, target = self.nodes[start], self.nodes[end]
            exit_x, exit_y = ((pts[0][0]-source['x'])/source['w'], (pts[0][1]-source['y'])/source['h'])
            entry_x, entry_y = ((pts[-1][0]-target['x'])/target['w'], (pts[-1][1]-target['y'])/target['h'])
            cell = ET.SubElement(root, 'mxCell', id=f'edge-{index}', edge='1', parent='1', source=start, target=end,
                                 style=f'endArrow=none;startArrow=none;rounded=0;strokeColor=#8297ac;strokeWidth=2;dashed={int(dashed)};exitX={exit_x};exitY={exit_y};exitPerimeter=0;entryX={entry_x};entryY={entry_y};entryPerimeter=0;')
            geo = ET.SubElement(cell, 'mxGeometry', relative='1', **{'as': 'geometry'})
            ET.SubElement(geo, 'mxPoint', x=str(pts[0][0]), y=str(pts[0][1]), **{'as': 'sourcePoint'})
            ET.SubElement(geo, 'mxPoint', x=str(pts[-1][0]), y=str(pts[-1][1]), **{'as': 'targetPoint'})
            waypoints = ET.SubElement(geo, 'Array', **{'as': 'points'})
            for x, y in pts[1:-1]:
                ET.SubElement(waypoints, 'mxPoint', x=str(x), y=str(y))
            self._label(root, f'edge-label-{index}', lx-5, ly-19, label, 14, '#435a71', '#f4f7fb')
        for index, (x, y, value, size, color) in enumerate(self.texts):
            self._label(root, f'text-{index}', x, y-size, value, size, color)

    @staticmethod
    def _label(root, key, x, y, text, size, color, fill='none'):
        cell = ET.SubElement(root, 'mxCell', id=key, value=text, vertex='1', parent='1',
                             style=f'text;html=0;strokeColor=none;fillColor={fill};align=left;verticalAlign=middle;whiteSpace=wrap;fontSize={size};fontColor={color};')
        ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(y), width=str(len(text)*size*0.59+24), height=str(size+12), **{'as': 'geometry'})


main_fields = fields('ERD.mmd')
p = Page('1 Collections', 1660, 1560, 'PhysiqueQuest / Collection relationships',
         '14 MongoDB collections  |  Key fields shown  |  Full field definitions: docs/ERD.md')
p.box('users', 625, 570, 'users', ['_id [PK]: ObjectId', 'email [UK]: string', 'name: string', 'role: user | admin', 'passwordHash: string', 'isActive: boolean'], 350, '#244ea3')
left = ['profiles', 'settings', 'activity', 'nutrition', 'notifications']
left_rows = [['_id [PK]', 'userId [UK]', 'goal, equipment[], days[]', 'duration, contactName, contactPhone'],
             ['_id [PK]', 'userId [UK]', 'values: Mixed', '  includes nutritionTargets'],
             ['_id [PK]', 'userId [UK]', 'state: Mixed', '  includes timezone'],
             ['_id [PK]', 'userId [UK]', 'meals[]: embedded MealEntry', 'water[]: embedded WaterEntry'],
             ['_id [PK]', 'userId [UK]', 'items[]: embedded NotificationItem']]
for index, (key, rows) in enumerate(zip(left, left_rows)):
    y = 155 + index * 235
    p.box(key, 48, y, key, rows, 350)
    p.edge('users', key, [(625, 665), (490, 665), (490, y+75), (398, y+75)], '1 user : 0..1', 401, y+55)
right = ['workout_sessions', 'progress_entries', 'coach_programs', 'leaderboard_snapshots', 'safety_alert_events', 'sign_in_events', 'password_recovery_tokens']
right_rows = [['_id [PK], userId', 'status, origin, revision', 'exercises[], sets[], exerciseResults[]', 'programVersion?, dayIndex?', 'scheduledDate?, activityDate?'],
              ['_id [PK], userId', 'metric, value, unit', 'measuredAt: Date'],
              ['_id [PK], userId', 'contextHash', 'plan: Mixed'],
              ['_id [PK], subjectId', 'period, boundaryKey', 'rank, points, creditPolicyVersion?'],
              ['_id [PK], userId', 'idempotencyKey, eventType, status', 'workoutSessionId?, exerciseId?', 'location?: embedded AlertLocation'],
              ['_id [PK], userId', 'occurredAt: Date', 'source: login | register'],
              ['_id [PK], userId', 'tokenHash [UK]', 'expiresAt [TTL], usedAt?']]
for index, (key, rows) in enumerate(zip(right, right_rows)):
    y = 125 + index * 190
    p.box(key, 1160, y, key, rows, 390)
    label = '1 user : 0..many'
    if key == 'coach_programs':
        label += ' *'
    p.edge('users', key, [(975, 665), (1080, 665), (1080, y+75), (1160, y+75)], label, 984, y+55)
p.box('admin_exercises', 625, 1120, 'admin_exercises', ['_id [PK]', 'name, targetMuscle, equipment', 'status, pose, trackingStatus', 'Shared catalog; no userId'], 350, '#655198')
p.edge('workout_sessions', 'safety_alert_events', [(1550, 200), (1600, 200), (1600, 960), (1550, 960)], '0..1 session : 0..many alerts', 1190, 850)
p.text(48, 1450, 'Dashed lines: intended document associations; MongoDB does not enforce foreign keys.', 16)
p.text(48, 1480, '* coach_programs.userId has no Mongoose ref. Optional alert-to-workout links are not verified by the safety service.', 15)
p.text(48, 1510, 'PK: document identity   UK: unique index   ?: optional or nullable   Compound keys and legacy-schema notes: docs/ERD.md', 15)

embedded = fields('ERD-embedded.mmd')
q = Page('2 Embedded objects', 2040, 1340, 'PhysiqueQuest / Embedded data',
         'Solid lines mean containment  |  Child boxes live inside parent documents; they are not separate collections')
q.box('workout_sessions', 48, 145, 'workout_sessions', ['Parent collection'], 340, '#244ea3')
for key, x in [('WorkoutExercise', 48), ('SetResult', 438), ('ExerciseResult', 828)]:
    q.box(key, x, 340, key, embedded[key], 360)
    q.edge('workout_sessions', key, [(218, 223), (218, 285), (x+180, 285), (x+180, 340)], '0..many', x+190, 320, False)
q.box('nutrition', 1250, 145, 'nutrition', ['Parent collection'], 340, '#244ea3')
for key, x in [('MealEntry', 1250), ('WaterEntry', 1640)]:
    q.box(key, x, 340, key, embedded[key], 350)
    q.edge('nutrition', key, [(1420, 223), (1420, 285), (x+175, 285), (x+175, 340)], '0..many', x+185, 320, False)
q.box('notifications', 48, 860, 'notifications', ['Parent collection'], 340, '#244ea3')
q.box('NotificationItem', 460, 860, 'NotificationItem', embedded['NotificationItem'], 360)
q.edge('notifications', 'NotificationItem', [(388, 900), (460, 900)], '0..many', 390, 841, False)
q.box('safety_alert_events', 1100, 860, 'safety_alert_events', ['Parent collection'], 340, '#244ea3')
q.box('AlertLocation', 1530, 860, 'AlertLocation', embedded['AlertLocation'], 360)
q.edge('safety_alert_events', 'AlertLocation', [(1440, 900), (1530, 900)], '0..1', 1452, 881, False)
q.text(48, 1220, 'SetResult.exerciseId matches an exercise snapshot within the same workout; string IDs are not catalog foreign keys.', 17)
q.text(48, 1190, 'sourceRecordingId links an imported planned set to its original reviewed recording; no source video is stored.', 17)
q.text(48, 1250, 'WorkoutExercise and SetResult are generic object arrays shaped by the workout contract. Other child objects have embedded schemas.', 17)
q.text(48, 1280, 'No independent MongoDB _id on the child objects. ? marks optional or nullable fields. PK / UK constraints belong to parent collections.', 17)

document = ET.Element('mxfile', host='app.diagrams.net', type='device', version='24.7.17')
for page, filename in [(p, 'ERD-collections.svg'), (q, 'ERD-embedded.svg')]:
    (OUTPUT / filename).write_text(page.svg(), encoding='utf-8')
    page.drawio(document)
ET.indent(document)
ET.ElementTree(document).write(OUTPUT / 'PhysiqueQuest-ERD.drawio', encoding='utf-8', xml_declaration=True)
assert len(p.nodes) == len(main_fields) == 14
assert len(q.nodes) == len(embedded) + 4 == 11
for path in OUTPUT.iterdir():
    if path.suffix in {'.svg', '.drawio'}:
        ET.parse(path)
print('Created and XML-validated 2 SVG previews and a 2-page editable draw.io file.')
