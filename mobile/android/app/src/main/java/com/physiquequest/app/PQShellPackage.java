package com.physiquequest.app;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class PQShellPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    return Collections.singletonList(new ReactContextBaseJavaModule(context) {
      @Override public String getName() { return "PQShell"; }
      @Override public Map<String,Object> getConstants() { return Collections.singletonMap("standalone", BuildConfig.PQ_STANDALONE); }
    });
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) { return Collections.emptyList(); }
}
