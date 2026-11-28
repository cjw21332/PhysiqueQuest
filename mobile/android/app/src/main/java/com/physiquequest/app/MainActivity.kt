package com.physiquequest.app

import android.os.Build
import android.os.Bundle
import android.graphics.Color
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowInsetsController

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    window.decorView.setBackgroundColor(Color.rgb(11, 15, 21))
    window.navigationBarColor = Color.rgb(11, 15, 21)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.insetsController?.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS)
    }
    holdSplashUntilFirstReactView()
  }

  // Android's launch splash (the logo) ends at the activity's first frame, but React needs ~2-3 s to load
  // its bundle, which showed as a blank dark screen. Skip drawing until the brand intro reports it has
  // mounted (PQShell.introShown) so the logo hands straight over to it. Capped at 6 s so it can never stick.
  private fun holdSplashUntilFirstReactView() {
    introShown = false
    val content = findViewById<ViewGroup>(android.R.id.content)
    val started = SystemClock.uptimeMillis()
    content.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        val ready = introShown || SystemClock.uptimeMillis() - started > 6000
        if (ready) content.viewTreeObserver.removeOnPreDrawListener(this)
        return ready
      }
    })
    content.postDelayed({ content.invalidate() }, 6100)
  }

  companion object {
    @Volatile private var introShown = false
    fun releaseSplash(activity: android.app.Activity?) {
      introShown = true
      activity?.runOnUiThread { activity.findViewById<View>(android.R.id.content)?.invalidate() }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
