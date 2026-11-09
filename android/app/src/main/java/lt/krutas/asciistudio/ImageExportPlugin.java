package lt.krutas.asciistudio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "ImageExport")
public class ImageExportPlugin extends Plugin {
    @PluginMethod
    public void savePng(PluginCall call) {
        chooseDestination(call, "image/png");
    }

    @PluginMethod
    public void saveVideo(PluginCall call) {
        String mimeType = call.getString("mimeType");
        if (!"video/mp4".equals(mimeType) && !"video/webm".equals(mimeType)) {
            call.reject("Unsupported video export format.");
            return;
        }
        chooseDestination(call, mimeType);
    }

    private void chooseDestination(PluginCall call, String mimeType) {
        String name = call.getString("name");
        String data = call.getString("base64");
        if (name == null || data == null || data.isEmpty()) {
            call.reject("Media data and filename are required.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mimeType)
            .putExtra(Intent.EXTRA_TITLE, name);

        try {
            startActivityForResult(call, intent, "onSaveLocation");
        } catch (RuntimeException error) {
            call.reject("Could not open the Android save dialog.", error);
        }
    }

    @ActivityCallback
    private void onSaveLocation(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent response = result.getData();
        Uri uri = response == null ? null : response.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }

        bridge.execute(() -> writeMedia(call, uri));
    }

    private void writeMedia(PluginCall call, Uri uri) {
        try {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("No output stream");
                output.write(Base64.decode(call.getString("base64"), Base64.DEFAULT));
            }
            call.resolve(new JSObject().put("saved", true));
        } catch (IOException | RuntimeException error) {
            call.reject("Could not write the file to the selected location.", error);
        }
    }
}
