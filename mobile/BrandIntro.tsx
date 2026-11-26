import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation, Easing, Extrapolation, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { BODY_PATH, LEFT_FOREARM_PATH, RIGHT_FOREARM_PATH } from './brandLogoPaths';

// "Charge & Lift", about 2.6s: the wordmark rises from the centre out, is absorbed into a charging ring as the
// logo settles in, the logo does two hammer curls that pulse the ring, then the logo lifts away before the
// background fades, so the logo never ghosts over the app underneath.
const WORD = 'PHYSIQUEQUEST';
const CELL = 22; // fixed letter cell: wide tracking, and each letter knows its distance to center
const MID = (WORD.length - 1) / 2;
const WORD_MS = 600, LETTER_STAGGER_MS = 55, LETTER_IN_MS = 240, LETTER_SPREAD = 4;
const CONVERGE_START = 600, CONVERGE_MS = 400, RING_DRAW_MS = 550;
// Hammer curl, front view: the forearm swings toward the viewer, so it foreshortens about the elbow (scaleY 1 -> 0)
// and the dumbbell then rises past it toward the shoulder (scaleY < 0). Two reps; the right arm trails slightly.
const CURLS_START = 1000, CURL_UP_MS = 230, CURL_HOLD_MS = 70, CURL_DOWN_MS = 230, RIGHT_ARM_LAG_MS = 110;
const REP_MS = CURL_UP_MS + CURL_HOLD_MS + CURL_DOWN_MS;
const CURL_PEAK_SCALE = -0.55;
const LOGO_OUT_START = 2180, LOGO_OUT_MS = 220, BG_OUT_START = 2320, BG_OUT_MS = 300;
const BG = '#0b0f15', LOGO_GREEN = '#1b512d', RING_GREEN = '#22c55e';
const LOGO = 120;
const RING = LOGO + 32, GLOW_STROKE = 10, RING_STROKE = 3;
const RING_R = (RING - GLOW_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_R;
// Crop of the 2000x2000 art to the grey disc (cx/cy 1000, r ~497); the circle clip hides the lettering below it.
const VB_X = 500, VB_Y = 500, VB_SIZE = 1000;
const VIEWBOX = `${VB_X} ${VB_Y} ${VB_SIZE} ${VB_SIZE}`;
// Art coordinates -> rendered logo pixels; every logo layer is LOGO x LOGO with this same viewBox.
const toPx = (art: number, origin: number) => ((art - origin) / VB_SIZE) * LOGO;
const LEFT_ELBOW = [toPx(745, VB_X), toPx(1095, VB_Y), 0];
const RIGHT_ELBOW = [toPx(1300, VB_X), toPx(1095, VB_Y), 0];
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Most of the curl's time is spent away from scaleY 0, where a front-view forearm collapses to a flat line,
// so the swing reads as motion instead of a flicker.
const forearmScale = (value: number) => {
  'worklet';
  return interpolate(value, [0, 0.42, 0.58, 1], [1, 0.24, -0.16, CURL_PEAK_SCALE], Extrapolation.CLAMP);
};

function Letter({ ch, i, clock, fly }: { ch: string; i: number; clock: SharedValue<number>; fly: SharedValue<number> }) {
  const start = Math.abs(i - MID) * LETTER_STAGGER_MS; // centre letters first, spreading outward
  const style = useAnimatedStyle(() => {
    const progress = interpolate(clock.value, [start, start + LETTER_IN_MS], [0, 1], Extrapolation.CLAMP);
    const enter = 1 - Math.pow(1 - progress, 3);
    const absorbed = interpolate(fly.value, [0, 0.85], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: enter * (1 - absorbed),
      transform: [
        // Starts slightly wide and settles in, then glides to the centre.
        { translateX: (i - MID) * LETTER_SPREAD * (1 - enter) + (MID - i) * CELL * fly.value },
        { translateY: 10 * (1 - enter) },
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
  const haptics = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopHaptics = () => { haptics.current.forEach(clearTimeout); haptics.current = []; };

  const clock = useSharedValue(0); // ms into the wordmark reveal
  const fly = useSharedValue(0);
  const ringDraw = useSharedValue(0);
  const logoIn = useSharedValue(0.85);
  const curl = useSharedValue(0);
  const curlRight = useSharedValue(0);
  const logoOut = useSharedValue(0);
  const exit = useSharedValue(0);
  const all = [clock, fly, ringDraw, logoIn, curl, curlRight, logoOut, exit];

  useEffect(() => {
    if (reduced) { done(); return; }
    clock.value = withTiming(WORD_MS, { duration: WORD_MS, easing: Easing.linear });
    fly.value = withDelay(CONVERGE_START, withTiming(1, { duration: CONVERGE_MS, easing: Easing.inOut(Easing.cubic) }));
    ringDraw.value = withDelay(CONVERGE_START, withTiming(1, { duration: RING_DRAW_MS, easing: Easing.out(Easing.cubic) }));
    logoIn.value = withDelay(CONVERGE_START, withSpring(1, { damping: 16, stiffness: 140 }));
    // Lift, squeeze briefly at the top, lower under control; twice.
    const reps = () => withRepeat(withSequence(
      withTiming(1, { duration: CURL_UP_MS, easing: Easing.bezier(0.45, 0, 0.2, 1) }),
      withDelay(CURL_HOLD_MS, withTiming(0, { duration: CURL_DOWN_MS, easing: Easing.inOut(Easing.cubic) })),
    ), 2);
    curl.value = withDelay(CURLS_START, reps());
    curlRight.value = withDelay(CURLS_START + RIGHT_ARM_LAG_MS, reps());
    // A light tick at the top of each rep; haptics are best-effort and never block the intro.
    haptics.current = [0, 1].map(rep => setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, CURLS_START + rep * REP_MS + CURL_UP_MS));
    logoOut.value = withDelay(LOGO_OUT_START, withTiming(1, { duration: LOGO_OUT_MS, easing: Easing.in(Easing.quad) }));
    exit.value = withDelay(BG_OUT_START, withTiming(1, { duration: BG_OUT_MS, easing: Easing.out(Easing.quad) }, ok => { if (ok) runOnJS(done)(); }));
    return () => { all.forEach(cancelAnimation); stopHaptics(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, done]);

  const skip = () => { all.forEach(cancelAnimation); stopHaptics(); done(); };

  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  // Logo and ring leave together: a short lift and fade before the background goes.
  const stageStyle = useAnimatedStyle(() => ({
    opacity: 1 - logoOut.value,
    transform: [{ translateY: -8 * logoOut.value }, { scale: 1 + 0.08 * logoOut.value }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fly.value, [0.15, 0.7], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: logoIn.value * (1 + 0.03 * Math.max(curl.value, curlRight.value)) }],
  }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * (1 - ringDraw.value) }));
  // The squeeze at the top of each rep sends a soft glow through the ring.
  const glowProps = useAnimatedProps(() => ({
    opacity: interpolate(Math.max(curl.value, curlRight.value), [0.55, 1], [0, 0.45], Extrapolation.CLAMP),
  }));
  const leftArmStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: forearmScale(curl.value) }] }));
  const rightArmStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: forearmScale(curlRight.value) }] }));
  // Hidden at rest so the forearms' own highlight cut-outs keep showing the grey disc.
  const patchProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(curl.value, curlRight.value) * 5) }));

  return <Animated.View style={[styles.cover, containerStyle]} accessibilityViewIsModal>
    <View style={styles.word} accessible accessibilityLabel="PhysiqueQuest">
      {WORD.split('').map((ch, i) => <Letter key={i} ch={ch} i={i} clock={clock} fly={fly}/>)}
    </View>
    <Animated.View style={[styles.logoWrap, stageStyle]}>
      <View pointerEvents="none" style={styles.ring}>
        {/* Rotated so the ring starts drawing from the top. */}
        <Svg width={RING} height={RING} style={styles.ringSvg}>
          <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={RING_GREEN} strokeWidth={GLOW_STROKE} fill="none" animatedProps={glowProps}/>
          <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={RING_GREEN} strokeWidth={RING_STROKE} fill="none" strokeLinecap="round" strokeDasharray={RING_LENGTH} animatedProps={ringProps}/>
        </Svg>
      </View>
      <Animated.View style={[styles.logo, logoStyle]}>
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
  ring: { position: 'absolute', top: (LOGO - RING) / 2, left: (LOGO - RING) / 2, width: RING, height: RING },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  logo: { width: LOGO, height: LOGO },
  logoClip: { width: LOGO, height: LOGO, borderRadius: LOGO / 2, overflow: 'hidden' },
  forearm: { position: 'absolute', top: 0, left: 0, width: LOGO, height: LOGO },
  skip: { position: 'absolute', bottom: 32, minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center' },
  skipText: { color: 'white', fontWeight: '600', fontSize: 15 },
});
