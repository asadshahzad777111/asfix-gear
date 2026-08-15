package com.asfixgear.pos;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.ArrayList;

/**
 * POS shell loads https://asfixgear.com/pos in a WebView.
 * Sale-bill barcode scan uses getUserMedia — WebKit fires {@link PermissionRequest}
 * for VIDEO_CAPTURE; we must request android.permission.CAMERA then grant the WebView.
 */
public class MainActivity extends BridgeActivity {
  private static final int REQ_CAMERA_FOR_WEB = 0xC2A1;
  private PermissionRequest pendingWebPermission;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (bridge == null || bridge.getWebView() == null) {
      return;
    }

    // Re-attach Chrome client so getUserMedia permission is always handled for Sale scan.
    // Extends BridgeWebChromeClient so file chooser / JS dialogs keep working.
    bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> handleWebKitPermission(request));
      }
    });
  }

  private void handleWebKitPermission(PermissionRequest request) {
    if (request == null) {
      return;
    }

    final String[] resources = request.getResources();
    boolean wantsVideo = false;
    boolean wantsAudio = false;
    for (String resource : resources) {
      if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
        wantsVideo = true;
      } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
        wantsAudio = true;
      }
    }

    if (!wantsVideo && !wantsAudio) {
      request.grant(resources);
      return;
    }

    ArrayList<String> needed = new ArrayList<>();
    if (wantsVideo
        && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
      needed.add(Manifest.permission.CAMERA);
    }
    if (wantsAudio
        && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
      needed.add(Manifest.permission.RECORD_AUDIO);
    }

    if (needed.isEmpty()) {
      request.grant(resources);
      return;
    }

    pendingWebPermission = request;
    ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), REQ_CAMERA_FOR_WEB);
  }

  @Override
  public void onRequestPermissionsResult(
      int requestCode,
      @NonNull String[] permissions,
      @NonNull int[] grantResults
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode != REQ_CAMERA_FOR_WEB) {
      return;
    }

    PermissionRequest pending = pendingWebPermission;
    pendingWebPermission = null;
    if (pending == null) {
      return;
    }

    boolean granted = grantResults.length > 0;
    for (int result : grantResults) {
      if (result != PackageManager.PERMISSION_GRANTED) {
        granted = false;
        break;
      }
    }

    if (granted) {
      pending.grant(pending.getResources());
    } else {
      pending.deny();
    }
  }
}
