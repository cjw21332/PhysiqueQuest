import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation, Easing, Extrapolation, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { BODY_PATH, LEFT_FOREARM_PATH, RIGHT_FOREARM_PATH } from './brandLogoPaths';

const WORD = 'PHYSIQUEQUEST';
const CELL = 22; // fixed letter cell: wide tracking, and each letter knows its distance to center
const MID = (WORD.length - 1) / 2;
const LETTER_MS = 50, LETTER_FADE_MS = 150;
const TYPE_END = 800, CONVERGE_MS = 500, CURLS_START = 1300, EXIT_START = 2800, EXIT_MS = 500;
// Hammer curl, front view: the forearm swings toward the viewer, so it foreshortens about the elbow (scaleY 1 -> 0)
// and the dumbbell then rises past it toward the shoulder (scaleY < 0). Two reps; the right arm trails slightly.
const CURL_UP_MS = 280, CURL_HOLD_MS = 100, CURL_DOWN_MS = 300, CURL_PEAK_SCALE = -0.55, RIGHT_ARM_LAG_MS = 150;
const BG = '#0B0E14', LOGO_GREEN = '#1b512d';
const LOGO = 120;
// Crop of the 2000x2000 art to the grey disc (cx/cy 1000, r ~497); the circle clip hides the lettering below it.
const VB_X = 500, VB_Y = 500, VB_SIZE = 1000;
const VIEWBOX = `${VB_X} ${VB_Y} ${VB_SIZE} ${VB_SIZE}`;
// Art coordinates -> rendered logo pixels; every logo layer is LOGO x LOGO with this same viewBox.
const toPx = (art: number, origin: number) => ((art - origin) / VB_SIZE) * LOGO;
const LEFT_ELBOW = [toPx(745, VB_X), toPx(1095, VB_Y), 0];
const RIGHT_ELBOW = [toPx(1300, VB_X), toPx(1095, VB_Y), 0];
const AnimatedG = Animated.createAnimatedComponent(G);

function Letter({ ch, i, typed, fly }: { ch: string; i: number; typed: SharedValue<number>; fly: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const enter = interpolate(typed.value, [i * LETTER_MS, i * LETTER_MS + LETTER_FADE_MS], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: enter * (1 - fly.value),
      transform: [
        { translateX: (MID - i) * CELL * fly.value },
        { translateY: 8 * (1 - enter) },
        { scale: 1 - 0.6 * fly.value },
      ],
    };
  });
  return <Animated.Text style={[styles.letter, style]}>{ch}</Animated.Text>;
}

export default function BrandIntro({ onAnimationComplete }: { onAnimationComplete: () => void }) {
  const reduced = useReducedMotion();
  // Skip, reduced motion and the animation end can race; finish once.
  const finished = useRef(false);
  const done = useCallback(() => { if (!finished.current) { finished.current = true; onAnimationComplete(); } }, [onAnimationComplete]);

  const typed = useSharedValue(0); // ms into phase 1
  const fly = useSharedValue(0);
  const logoIn = useSharedValue(0.5);
  const curl = useSharedValue(0);
  const curlRight = useSharedValue(0);
  const exit = useSharedValue(0);
  const all = [typed, fly, logoIn, curl, curlRight, exit];

  useEffect(() => {
    if (reduced) { done(); return; }
    typed.value = withTiming(TYPE_END, { duration: TYPE_END, easing: Easing.linear });
    fly.value = withDelay(TYPE_END, withTiming(1, { duration: CONVERGE_MS, easing: Easing.in(Easing.cubic) }));
    logoIn.value = withDelay(TYPE_END, withSequence(
      withTiming(1.05, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    ));
    // Curl up, squeeze briefly at the top, lower under control; twice.
    // Lift, squeeze briefly at the top, lower under control; twice.
    const reps = () => withRepeat(withSequence(
      withTiming(1, { duration: CURL_UP_MS, easing: Easing.bezier(0.45, 0, 0.2, 1) }),
      withDelay(CURL_HOLD_MS, withTiming(0, { duration: CURL_DOWN_MS, easing: Easing.inOut(Easing.cubic) })),
    ), 2);
    curl.value = withDelay(CURLS_START, reps());
    curlRight.value = withDelay(CURLS_START + RIGHT_ARM_LAG_MS, reps());
    exit.value = withDelay(EXIT_START, withTiming(1, { duration: EXIT_MS, easing: Easing.out(Easing.quad) }, ok => { if (ok) runOnJS(done)(); }));
    return () => all.forEach(cancelAnimation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, done]);

  const skip = () => { all.forEach(cancelAnimation); done(); };

  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value, transform: [{ scale: 1 + 0.03 * exit.value }] }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fly.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: logoIn.value * (1 + 0.03 * Math.max(curl.value, curlRight.value)) }],
  }));
  const leftArmStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: interpolate(curl.value, [0, 1], [1, CURL_PEAK_SCALE]) }] }));
  const rightArmStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: interpolate(curlRight.value, [0, 1], [1, CURL_PEAK_SCALE]) }] }));
  // Hidden at rest so the forearms' own highlight cut-outs keep showing the grey disc.
  const patchProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(curl.value, curlRight.value) * 5) }));

  return <Animated.View style={[styles.cover, containerStyle]} accessibilityViewIsModal>
    <View style={styles.word} accessible accessibilityLabel="PhysiqueQuest">
      {WORD.split('').map((ch, i) => <Letter key={i} ch={ch} i={i} typed={typed} fly={fly}/>)}
    </View>
    <Animated.View style={[styles.logoWrap, logoStyle]}>
      <View style={styles.logoClip}>
        <Svg width={LOGO} height={LOGO} viewBox={VIEWBOX}>
          <Ellipse cx={1000} cy={1000} rx={497} ry={499} fill="#ced2d1"/>
          {/* Behind the body: fills its forearm cut-outs so the disc doesn't show through mid-curl. */}
          <AnimatedG animatedProps={patchProps} fill={LOGO_GREEN}>
            <Ellipse cx={735} cy={1165} rx={50} ry={90}/>
            <Ellipse cx={1307} cy={1195} rx={55} ry={120}/>
          </AnimatedG>
          <Path d={BODY_PATH} fill={LOGO_GREEN} fillRule="evenodd"/>
        </Svg>
      </View>
      {/* Forearms sit outside the clip (the plates overhang the disc) and swing about the elbow. */}
      <Animated.View pointerEvents="none" style={[styles.forearm, { transformOrigin: LEFT_ELBOW }, leftArmStyle]}>
        <Svg width={LOGO} height={LOGO} viewBox={VIEWBOX}><Path d={LEFT_FOREARM_PATH} fill={LOGO_GREEN} fillRule="evenodd"/></Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.forearm, { transformOrigin: RIGHT_ELBOW }, rightArmStyle]}>
        <Svg width={LOGO} height={LOGO} viewBox={VIEWBOX}><Path d={RIGHT_FOREARM_PATH} fill={LOGO_GREEN} fillRule="evenodd"/></Svg>
      </Animated.View>
    </Animated.View>
    <Pressable onPress={skip} accessibilityRole="button" accessibilityLabel="Skip intro" hitSlop={12} style={styles.skip}>
      <Text style={styles.skipText}>Skip intro</Text>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  word: { position: 'absolute', flexDirection: 'row' },
  letter: { width: CELL, textAlign: 'center', color: 'white', fontWeight: '800', fontSize: 22 },
  logoWrap: { width: LOGO, height: LOGO },
  logoClip: { width: LOGO, height: LOGO, borderRadius: LOGO / 2, overflow: 'hidden' },
  forearm: { position: 'absolute', top: 0, left: 0, width: LOGO, height: LOGO },
  skip: { position: 'absolute', bottom: 32, minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center' },
  skipText: { color: 'white', fontWeight: '600', fontSize: 15 },
});
