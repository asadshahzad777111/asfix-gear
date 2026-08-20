package com.asfixgear.pos.thermal;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "AsfixThermalPrint",
    permissions = {
        @Permission(
            alias = AsfixThermalPrintPlugin.BLUETOOTH,
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class AsfixThermalPrintPlugin extends Plugin {

    static final String BLUETOOTH = "bluetooth";

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothSocket socket;
    private String connectedAddress;

    @PluginMethod
    public void listPrinters(PluginCall call) {
        if (!ensureBluetoothPermission(call, "completeListPrinters")) {
            return;
        }
        resolveListPrinters(call);
    }

    @PermissionCallback
    private void completeListPrinters(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("Bluetooth permission denied");
            return;
        }
        resolveListPrinters(call);
    }

    @SuppressLint("MissingPermission")
    private void resolveListPrinters(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        JSArray printers = new JSArray();
        if (adapter != null) {
            try {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice device : bonded) {
                        JSObject item = new JSObject();
                        String name = device.getName();
                        item.put("name", name != null ? name : device.getAddress());
                        item.put("address", device.getAddress());
                        item.put("bonded", true);
                        printers.put(item);
                    }
                }
            } catch (SecurityException e) {
                call.reject("Bluetooth permission required to list printers");
                return;
            }
        }
        JSObject result = new JSObject();
        result.put("printers", printers);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("address is required");
            return;
        }
        if (!ensureBluetoothPermission(call, "completeConnect")) {
            return;
        }
        doConnect(call, address);
    }

    @PermissionCallback
    private void completeConnect(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("Bluetooth permission denied");
            return;
        }
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("address is required");
            return;
        }
        doConnect(call, address);
    }

    @SuppressLint("MissingPermission")
    private void doConnect(PluginCall call, String address) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is disabled");
            return;
        }

        closeSocketQuietly();

        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            BluetoothSocket btSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            // Cancel discovery so connect is more reliable.
            try {
                adapter.cancelDiscovery();
            } catch (SecurityException ignored) {
                // Permission already checked; ignore cancelDiscovery failures.
            }
            btSocket.connect();
            socket = btSocket;
            connectedAddress = address;

            JSObject result = new JSObject();
            result.put("connected", true);
            result.put("address", address);
            String name = device.getName();
            if (name != null) {
                result.put("name", name);
            }
            call.resolve(result);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid Bluetooth address");
        } catch (IOException | SecurityException e) {
            closeSocketQuietly();
            call.reject("Failed to connect: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeSocketQuietly();
        call.resolve();
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text");
        if (text == null) {
            call.reject("text is required");
            return;
        }
        if (!ensureBluetoothPermission(call, "completePrintText")) {
            return;
        }
        doPrintText(call, text);
    }

    @PermissionCallback
    private void completePrintText(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("Bluetooth permission denied");
            return;
        }
        String text = call.getString("text");
        if (text == null) {
            call.reject("text is required");
            return;
        }
        doPrintText(call, text);
    }

    private void doPrintText(PluginCall call, String text) {
        // ESC @ init + UTF-8 text + feed + partial cut (GS V 1)
        byte[] init = new byte[] { 0x1B, 0x40 };
        byte[] body = text.getBytes(StandardCharsets.UTF_8);
        byte[] feed = new byte[] { 0x0A, 0x0A, 0x0A };
        byte[] cut = new byte[] { 0x1D, 0x56, 0x01 };
        byte[] payload = new byte[init.length + body.length + feed.length + cut.length];
        int offset = 0;
        System.arraycopy(init, 0, payload, offset, init.length);
        offset += init.length;
        System.arraycopy(body, 0, payload, offset, body.length);
        offset += body.length;
        System.arraycopy(feed, 0, payload, offset, feed.length);
        offset += feed.length;
        System.arraycopy(cut, 0, payload, offset, cut.length);
        writeBytes(call, payload, call.getString("address"));
    }

    @PluginMethod
    public void printEscPos(PluginCall call) {
        String dataBase64 = call.getString("dataBase64");
        if (dataBase64 == null || dataBase64.isEmpty()) {
            call.reject("dataBase64 is required");
            return;
        }
        if (!ensureBluetoothPermission(call, "completePrintEscPos")) {
            return;
        }
        doPrintEscPos(call, dataBase64);
    }

    @PermissionCallback
    private void completePrintEscPos(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("Bluetooth permission denied");
            return;
        }
        String dataBase64 = call.getString("dataBase64");
        if (dataBase64 == null || dataBase64.isEmpty()) {
            call.reject("dataBase64 is required");
            return;
        }
        doPrintEscPos(call, dataBase64);
    }

    private void doPrintEscPos(PluginCall call, String dataBase64) {
        byte[] payload;
        try {
            payload = Base64.decode(dataBase64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid dataBase64");
            return;
        }
        writeBytes(call, payload, call.getString("address"));
    }

    @SuppressLint("MissingPermission")
    private void writeBytes(PluginCall call, byte[] payload, String address) {
        try {
            ensureConnected(address);
            OutputStream out = socket.getOutputStream();
            out.write(payload);
            out.flush();
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        } catch (IOException | SecurityException | IllegalStateException e) {
            call.reject("Print failed: " + e.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void ensureConnected(String address) throws IOException {
        String target = address != null && !address.isEmpty() ? address : connectedAddress;
        if (target == null || target.isEmpty()) {
            throw new IllegalStateException("No printer address; call connect() first or pass address");
        }
        if (socket != null && socket.isConnected() && target.equalsIgnoreCase(connectedAddress)) {
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            throw new IllegalStateException("Bluetooth not supported");
        }
        if (!adapter.isEnabled()) {
            throw new IllegalStateException("Bluetooth is disabled");
        }

        closeSocketQuietly();
        BluetoothDevice device = adapter.getRemoteDevice(target);
        BluetoothSocket btSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            adapter.cancelDiscovery();
        } catch (SecurityException ignored) {
            // ignore
        }
        btSocket.connect();
        socket = btSocket;
        connectedAddress = target;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        boolean enabled = adapter != null && adapter.isEnabled();
        boolean connected = socket != null && socket.isConnected();
        JSObject result = new JSObject();
        result.put("connected", connected);
        result.put("address", connected ? connectedAddress : JSONObject.NULL);
        result.put("bluetoothEnabled", enabled);
        call.resolve(result);
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        if (getPermissionState(BLUETOOTH) == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias(BLUETOOTH, call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasBluetoothPermission());
        call.resolve(result);
    }

    private boolean ensureBluetoothPermission(PluginCall call, String callbackName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        if (getPermissionState(BLUETOOTH) == PermissionState.GRANTED) {
            return true;
        }
        requestPermissionForAlias(BLUETOOTH, call, callbackName);
        return false;
    }

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        return getPermissionState(BLUETOOTH) == PermissionState.GRANTED;
    }

    private void closeSocketQuietly() {
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
                // ignore
            }
            socket = null;
        }
        connectedAddress = null;
    }

    @Override
    protected void handleOnDestroy() {
        closeSocketQuietly();
        super.handleOnDestroy();
    }
}
