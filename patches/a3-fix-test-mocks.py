from pathlib import Path
p=Path('mobile/camera-readiness.test.mjs');s=p.read_text(encoding='utf8')
s=s.replace("'react-native-svg':{default:'Svg'","'react-native-svg':{__esModule:true,default:'Svg'")
s=s.replace("'react-native-reanimated':{default:","'react-native-reanimated':{__esModule:true,default:")
s=s.replace("'./NativeTrackingCamera':{default:'NativeCamera'}","'./NativeTrackingCamera':{__esModule:true,default:'NativeCamera'}")
s=s.replace("'./PoseAlarmScreen':{default:'Alarm'}","'./PoseAlarmScreen':{__esModule:true,default:'Alarm'}")
p.write_text(s,encoding='utf8')
