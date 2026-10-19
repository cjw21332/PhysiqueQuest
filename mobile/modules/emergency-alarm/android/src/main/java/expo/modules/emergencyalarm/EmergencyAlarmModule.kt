package expo.modules.emergencyalarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.PI
import kotlin.math.sin

/** Foreground workout alarm. Uses alarm volume independently of media/ringer volume. */
class EmergencyAlarmModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var track: AudioTrack? = null
  private var audio: AudioManager? = null
  private var previousVolume: Int? = null
  private val enforceVolume = object : Runnable {
    override fun run() {
      synchronized(this@EmergencyAlarmModule) {
        if (track == null) return
        maximizeVolume()
        handler.postDelayed(this, 500)
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("EmergencyAlarm")
    Function("start") { startAlarm() }
    Function("stop") { stopAlarm() }
    OnDestroy { stopAlarm() }
  }

  private fun maximizeVolume() {
    val manager = audio ?: return
    try {
      manager.setStreamVolume(AudioManager.STREAM_ALARM, manager.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
    } catch (error: SecurityException) {
      // Do not change Do Not Disturb or bypass the device's access policy.
      Log.w("EmergencyAlarm", "System policy prevents changing alarm volume", error)
    }
  }

  @Synchronized
  private fun startAlarm(): Boolean {
    if (track != null) return true
    val context = appContext.reactContext ?: return false
    val manager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audio = manager
    previousVolume = manager.getStreamVolume(AudioManager.STREAM_ALARM)
    try {
      maximizeVolume()
      val sampleRate = 22050
      // One second of alternating tones; loop in the native audio engine.
      val samples = ShortArray(sampleRate) { index ->
        val frequency = if ((index / (sampleRate / 4)) % 2 == 0) 880.0 else 660.0
        (sin(2 * PI * frequency * index / sampleRate) * Short.MAX_VALUE).toInt().toShort()
      }
      val sound = AudioTrack.Builder()
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        .setAudioFormat(AudioFormat.Builder().setSampleRate(sampleRate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
        .setBufferSizeInBytes(samples.size * 2)
        .setTransferMode(AudioTrack.MODE_STATIC)
        .build()
      track = sound
      check(sound.write(samples, 0, samples.size) == samples.size)
      // MODE_STATIC becomes initialized only after its initial PCM data is written.
      check(sound.state == AudioTrack.STATE_INITIALIZED)
      check(sound.setLoopPoints(0, samples.size, -1) == AudioTrack.SUCCESS)
      sound.setVolume(1f)
      sound.play()
      handler.post(enforceVolume)
      return true
    } catch (error: Exception) {
      Log.e("EmergencyAlarm", "Native alarm could not start", error)
      stopAlarm()
      return false
    }
  }

  @Synchronized
  private fun stopAlarm() {
    handler.removeCallbacks(enforceVolume)
    val sound = track
    track = null
    try {
      sound?.pause()
    } finally {
      sound?.release()
      val volume = previousVolume
      previousVolume = null
      try {
        if (volume != null) audio?.setStreamVolume(AudioManager.STREAM_ALARM, volume, 0)
      } catch (error: SecurityException) {
        Log.w("EmergencyAlarm", "System policy prevents restoring alarm volume", error)
      } finally {
        audio = null
      }
    }
  }
}
