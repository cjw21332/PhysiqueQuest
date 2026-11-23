import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

const word = 'PHYSIQUEQUEST';
export default function BrandIntro({ onDone }: { onDone: () => void }) {
  const [letters, setLetters] = useState(0);
  const morph = useRef(new Animated.Value(0)).current;
  const curl = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval>;
    let animation: Animated.CompositeAnimation;
    const start = (reduced: boolean) => {
      if (!alive) return;
      if (reduced) { onDone(); return; }
      let count = 0;
      timer = setInterval(() => {
        setLetters(++count);
        if (count < word.length) return;
        clearInterval(timer);
        const lift = (toValue: number) => Animated.timing(curl, { toValue, duration: 280, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
        animation = Animated.sequence([
          Animated.timing(morph, { toValue: 1, duration: 520, useNativeDriver: true }),
          lift(1), lift(0), lift(1), lift(0),
        ]);
        animation.start(({ finished }) => { if (alive && finished) onDone(); });
      }, 65);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(start, () => start(false));
    return () => { alive = false; clearInterval(timer); animation?.stop(); };
  }, [onDone, curl, morph]);
  return <View style={styles.cover} accessibilityViewIsModal>
    <Animated.Text accessibilityLabel="PhysiqueQuest" style={[styles.word,{ opacity: morph.interpolate({ inputRange:[0,1], outputRange:[1,0] }) }]}>{word.slice(0,letters)}</Animated.Text>
    <Animated.View style={{ alignItems:'center', opacity:morph, transform:[{scale:morph.interpolate({inputRange:[0,1],outputRange:[0.7,1.15]})}] }}>
      <Animated.Image source={require('./assets/physiquequest-icon.png')} style={{width:110,height:110,borderRadius:22}}/>
      <Animated.View accessibilityLabel="Dumbbell curl" style={[styles.bar,{ transform:[{translateY:curl.interpolate({inputRange:[0,1],outputRange:[8,-12]})},{rotate:curl.interpolate({inputRange:[0,1],outputRange:['-12deg','24deg']})}] }]}><View style={styles.plate}/><View style={styles.plate}/></Animated.View>
    </Animated.View>
    <Pressable onPress={onDone} accessibilityRole="button" style={styles.skip}><Text style={{color:'white'}}>Skip intro</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  cover:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:50,backgroundColor:'#0b0f15',alignItems:'center',justifyContent:'center'},
  word:{position:'absolute',color:'white',fontWeight:'800',fontSize:26,letterSpacing:3},
  bar:{width:48,height:5,backgroundColor:'#52e2ad',flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:12},
  plate:{width:9,height:20,backgroundColor:'#52e2ad',borderRadius:3},
  skip:{position:'absolute',bottom:50,padding:12}
});
