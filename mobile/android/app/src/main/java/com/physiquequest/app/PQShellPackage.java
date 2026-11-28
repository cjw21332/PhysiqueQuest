package com.physiquequest.app;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.uimanager.ViewManager;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.OutputStream;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class PQShellPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.singletonList(new ReactContextBaseJavaModule(context) {
      @Override public String getName() { return "PQShell"; }
      @Override public Map<String,Object> getConstants() { return Collections.singletonMap("standalone", BuildConfig.PQ_STANDALONE); }
      // The brand intro has mounted: release the launch splash that MainActivity is holding.
      @ReactMethod public void introShown() { MainActivity.Companion.releaseSplash(getCurrentActivity()); }
      @ReactMethod public void exportBadge(String encoded, String name, String action, Promise promise) {
        Uri uri = null;
        try {
          if (Build.VERSION.SDK_INT < 29) throw new Exception("Saving badges requires Android 10 or newer.");
          if (!encoded.startsWith("data:image/png;base64,") || encoded.length() > 4000000 || !name.matches("[a-zA-Z0-9_-]{1,100}\\.png") || !(action.equals("save") || action.equals("share"))) throw new Exception("Invalid image request.");
          byte[] bytes = Base64.decode(encoded.substring(22), Base64.DEFAULT);
          if (bytes.length < 8 || bytes[0] != (byte)0x89 || bytes[1] != 0x50 || bytes[2] != 0x4e || bytes[3] != 0x47) throw new Exception("Invalid PNG image.");
          ContentValues values = new ContentValues();
          values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
          values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
          values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PhysiqueQuest");
          values.put(MediaStore.Images.Media.IS_PENDING, 1);
          uri = context.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
          if (uri == null) throw new Exception("Could not create the image.");
          try (OutputStream stream = context.getContentResolver().openOutputStream(uri)) { if (stream == null) throw new Exception("Could not save the image."); stream.write(bytes); }
          values.clear(); values.put(MediaStore.Images.Media.IS_PENDING, 0); context.getContentResolver().update(uri, values, null, null);
          if (action.equals("share")) {
            Intent send = new Intent(Intent.ACTION_SEND); send.setType("image/png"); send.putExtra(Intent.EXTRA_STREAM, uri); send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Share your achievement"); chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(chooser);
          }
          promise.resolve(true);
        } catch (Exception error) {
          if (uri != null) context.getContentResolver().delete(uri, null, null);
          promise.reject("BADGE_EXPORT_FAILED", error.getMessage(), error);
        }
      }
    });
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) { return Collections.emptyList(); }
}
