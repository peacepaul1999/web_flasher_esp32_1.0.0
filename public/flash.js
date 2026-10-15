/* flash.js */

// ============================================================
// APPLICATION VERSION
// ============================================================

const APP_VERSION = "1.0.0";

// ============================================================
// IMPORT ESPTOOL-JS
// ============================================================

import {
  Transport,
  ESPLoader,
} from "https://unpkg.com/esptool-js@0.6.1/bundle.js";

// ============================================================
// MCU HARD RESET
// ============================================================

async function resetMCU(targetPort = port) {
  if (!targetPort) {
    throw new Error("Serial port not available");
  }

  log("Waiting 500 ms before MCU reset...");

  await sleep(500);

  log("Resetting MCU...");

  await targetPort.setSignals({
    dataTerminalReady: false,
    requestToSend: false,
  });

  await sleep(100);

  await targetPort.setSignals({
    dataTerminalReady: false,
    requestToSend: true,
  });

  await sleep(150);

  await targetPort.setSignals({
    dataTerminalReady: false,
    requestToSend: false,
  });

  await sleep(300);

  log("MCU reset sequence completed");
}

/* ============================================================
   BACKUP FLASH - CHUNKED READ
   ============================================================ */

const BACKUP_CHUNK_SIZE = 0x10000; // 64 KiB
const BACKUP_MAX_ATTEMPTS = 3;

async function readBackupInChunks(start, size) {
  if (!loader) {
    throw new Error("Device not connected");
  }

  const output = new Uint8Array(size);

  let completed = 0;

  progress(0);

  while (completed < size) {
    const address = start + completed;

    const length = Math.min(BACKUP_CHUNK_SIZE, size - completed);

    let chunk = null;
    let lastError = null;

    for (let attempt = 1; attempt <= BACKUP_MAX_ATTEMPTS; attempt++) {
      try {
        operation(
          `Backup ${asHex(address)} ` +
            `(${completed}/${size} bytes), ` +
            `attempt ${attempt}`,
        );

        const result = await loader.readFlash(
          address,
          length,
          (_packet, done, total) => {
            if (total > 0) {
              const partial = Math.min(length, Math.max(0, done));

              progress((100 * (completed + partial)) / size);
            }
          },
        );

        if (!(result instanceof Uint8Array) || result.length !== length) {
          throw new Error(`Invalid read length at ${asHex(address)}`);
        }

        chunk = result;
        break;
      } catch (error) {
        lastError = error;

        log(
          `Backup block ${asHex(address)} ` +
            `attempt ${attempt}/${BACKUP_MAX_ATTEMPTS} ` +
            `failed: ${error.message || error}`,
        );

        progress((100 * completed) / size);

        if (attempt < BACKUP_MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    if (!chunk) {
      throw new Error(
        `Backup stopped at ${asHex(address)}. ` +
          `Last error: ${lastError?.message || lastError}. ` +
          `Reconnect the board before trying again.`,
      );
    }

    output.set(chunk, completed);

    completed += length;

    progress((100 * completed) / size);

    log(
      `Backup: ${completed}/${size} bytes ` +
        `(${Math.floor((100 * completed) / size)}%)`,
    );
  }

  return output;
}

// ============================================================
// 1. DOM ELEMENTS
// ============================================================

const $ = (id) => document.getElementById(id);

$("appVersion").textContent = `v${APP_VERSION}`;

const logBox = $("log");
const chipInfo = $("chipInfo");

const btnConnect = $("connect");
const btnDisconnect = $("disconnect");
const btnFlash = $("flash");
const btnErase = $("erase");

const progressBar = $("progressBar");
const progressText = $("progressText");

const btnBackup = $("backup");
const btnInspectDevice = $("inspectDevice");
const btnStartMonitor = $("startMonitor");
const btnStopMonitor = $("stopMonitor");

const btnAddFactory = $("addFactory");
const btnClearFactory = $("clearFactory");
const btnRunFactory = $("runFactory");
const btnFactoryExport = $("factoryExport");
const btnEraseFactory = $("eraseFactory");

const firmwareInputs = [
  {
    name: "Bootloader",
    input: "bootloader",
    address: "bootloaderAddr",
  },
  {
    name: "Partitions",
    input: "partitions",
    address: "partitionsAddr",
  },
  {
    name: "Firmware",
    input: "firmware",
    address: "firmwareAddr",
  },
];

// ============================================================
// 2. GLOBAL STATE
// ============================================================

let port = null;
let transport = null;
let loader = null;

let chipName = "";
let busy = false;
let analysisValid = false;

let monitoring = false;
let monitorPort = null;
let monitorReader = null;

let factoryBusy = false;
let factoryDevices = [];

let lastReport = null;

const HISTORY_KEY = "espflash-history";

// ============================================================
// 3. LOGGING AND UI
// ============================================================

function log(message) {
  const timestamp = new Date().toLocaleTimeString();

  logBox.value += `[${timestamp}] ${message}\n`;

  if (logBox.value.length > 100000) {
    logBox.value = logBox.value.slice(-75000);
  }

  logBox.scrollTop = logBox.scrollHeight;
}

function operation(message) {
  $("operation").textContent = message;
}

function progress(value) {
  const percentage = Math.max(0, Math.min(100, Math.round(value)));

  progressBar.value = percentage;
  progressText.textContent = `${percentage}%`;
}

function lockUI() {
  busy = true;
  updateUI();
}

function unlockUI() {
  busy = false;
  updateUI();
}

function updateUI() {
  const connected = Boolean(loader);
  const locked = busy || factoryBusy;

  btnConnect.disabled = locked || connected || monitoring;

  btnDisconnect.disabled = locked || !connected;

  btnFlash.disabled = locked || !connected || !analysisValid;

  btnErase.disabled = locked || !connected;

  btnBackup.disabled = locked || !connected;

  btnInspectDevice.disabled = locked || !connected;

  btnStartMonitor.disabled = locked || !connected || monitoring;

  btnStopMonitor.disabled = !monitoring;

  btnAddFactory.disabled = locked || connected || monitoring;

  btnClearFactory.disabled = locked;

  btnRunFactory.disabled =
    locked ||
    connected ||
    monitoring ||
    !analysisValid ||
    factoryDevices.length === 0;

  btnEraseFactory.disabled =
    locked || connected || monitoring || factoryDevices.length === 0;

  $("baudRate").disabled = locked || connected;

  const status = $("status");

  status.textContent = busy
    ? "Working..."
    : connected
      ? "Connected"
      : monitoring
        ? "Monitoring"
        : "Disconnected";

  status.className = "status";

  if (busy) {
    status.classList.add("busy");
  } else if (connected) {
    status.classList.add("connected");
  }
}

async function execute(title, callback) {
  if (busy || factoryBusy) {
    return;
  }

  lockUI();
  operation(title);

  try {
    await callback();
  } catch (error) {
    if (error.name === "NotFoundError") {
      log("Port selection cancelled");
    } else {
      log(`ERROR: ${error.message || error}`);
      console.error(error);
    }

    operation("Operation failed");
  } finally {
    unlockUI();
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ============================================================
// 4. DEVICE CONNECTION
// ============================================================

async function connectESP() {
  await execute("Connecting...", async () => {
    if (!("serial" in navigator)) {
      throw new Error("Browser does not support Web Serial API");
    }

    if (!window.isSecureContext) {
      throw new Error("HTTPS or localhost is required");
    }

    if (loader) {
      log("Already connected");
      return;
    }

    log("Select USB serial port");

    port = await navigator.serial.requestPort();

    const baudRate = Number($("baudRate").value);

    transport = new Transport(port);

    loader = new ESPLoader({
      transport: transport,
      baudrate: baudRate,
      debugLogging: false,

      terminal: {
        clean: () => {},
        writeLine: (text) => log(text),
        write: (text) => log(text),
      },
    });

    try {
      log("Initializing ESP ROM bootloader");

      chipName = await loader.main();
    } catch (error) {
      await cleanup();
      throw error;
    }

    chipInfo.textContent = `${chipName || "ESP Device"} | Baud ${baudRate}`;

    log(`Connected: ${chipName}`);

    await analyzeFiles();

    operation("Ready");
  });
}

// ============================================================
// 5. DEVICE DISCONNECTION
// ============================================================

async function disconnectESP() {
  if (!loader || !port) {
    return;
  }

  await execute("Disconnecting...", async () => {
    try {
      log("Waiting 500 ms before MCU reset...");

      // Reset MCU before closing connection 500 ms delay
      await resetMCU();

      log("MCU Reset completed");
    } catch (error) {
      log(`Reset ERROR: ${error.message || error}`);
    } finally {
      await cleanup();

      log("Disconnected");
      operation("Disconnected");
    }
  });
}

async function cleanup() {
  const oldTransport = transport;
  const oldPort = port;

  loader = null;
  transport = null;
  port = null;
  chipName = "";

  if (oldTransport) {
    try {
      await oldTransport.disconnect();
    } catch (error) {
      log(`Transport: ${error.message || error}`);
    }
  }

  if (oldPort) {
    try {
      if (oldPort.readable || oldPort.writable) {
        await oldPort.close();
      }
    } catch (error) {
      log(`Port close: ${error.message || error}`);
    }
  }

  chipInfo.textContent = "Not Connected";

  updateUI();
}

// ============================================================
// 6. BINARY INSPECTOR
// ============================================================

function asHex(number) {
  return `0x${number.toString(16).toUpperCase()}`;
}

function decodeText(bytes) {
  return new TextDecoder().decode(bytes).replace(/\0.*$/s, "").trim();
}

function parseOffset(text, name) {
  const value = String(text).trim();

  if (!/^(0x[0-9a-f]+|[0-9]+)$/i.test(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }

  const number = value.toLowerCase().startsWith("0x")
    ? parseInt(value.slice(2), 16)
    : parseInt(value, 10);

  if (!Number.isSafeInteger(number) || number < 0 || number > 0xffffffff) {
    throw new Error(`${name} out of range`);
  }

  if (number % 0x1000 !== 0) {
    throw new Error(`${name} must be aligned to 0x1000`);
  }

  return number;
}

function imageDetails(data) {
  if (data.length < 40 || data[0] !== 0xe9 || data[1] < 1 || data[1] > 16) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const segmentLength = view.getUint32(28, true);

  if (segmentLength > data.length - 32) {
    return null;
  }

  const isApplication = view.getUint32(32, true) === 0xabcd5432;

  const chipId = view.getUint16(12, true);

  let descriptor = null;

  if (isApplication && data.length >= 192) {
    descriptor = {
      version: decodeText(data.slice(48, 80)),
      project: decodeText(data.slice(80, 112)),
      idf: decodeText(data.slice(144, 176)),
    };
  }

  return {
    role: isApplication ? "firmware" : "bootloader",
    chipId: chipId,
    descriptor: descriptor,
  };
}

function partitionDetails(data) {
  if (data.length < 64 || data[0] !== 0xaa || data[1] !== 0x50) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const entries = [];
  let terminated = false;

  for (let position = 0; position + 32 <= data.length; position += 32) {
    if (data[position] === 0xff && data[position + 1] === 0xff) {
      terminated = true;
      break;
    }

    if (data[position] === 0xeb && data[position + 1] === 0xeb) {
      terminated = true;
      break;
    }

    if (data[position] !== 0xaa || data[position + 1] !== 0x50) {
      return null;
    }

    const offset = view.getUint32(position + 4, true);

    const size = view.getUint32(position + 8, true);

    if (!offset || !size || offset % 0x1000 !== 0 || size % 0x1000 !== 0) {
      return null;
    }

    entries.push({
      type: data[position + 2],
      subtype: data[position + 3],
      offset: offset,
      size: size,
      label: decodeText(data.slice(position + 12, position + 28)),
    });
  }

  return terminated && entries.length ? entries : null;
}

function bootOffset(chip) {
  if (!chip) {
    return null;
  }

  if (/^ESP32(?!-(S2|S3|C2|C3|C5|C6|C61|H2|P4))/i.test(chip)) {
    return 0x1000;
  }

  if (/ESP32-(S2|S3|C2|C3|C5|C6|C61|H2|P4)/i.test(chip)) {
    return 0x0000;
  }

  return null;
}

function chipIdForName(name) {
  const ids = {
    ESP32: 0,
    "ESP32-S2": 2,
    "ESP32-C3": 5,
    "ESP32-S3": 9,
    "ESP32-C2": 12,
    "ESP32-C6": 13,
    "ESP32-H2": 16,
    "ESP32-P4": 18,
    "ESP32-C61": 20,
    "ESP32-C5": 23,
  };

  const chip = String(name).trim().toUpperCase();

  const names = Object.keys(ids).sort((a, b) => b.length - a.length);

  // Match exact chip names and revision descriptions.
  for (const key of names) {
    if (
      chip === key ||
      chip.startsWith(`${key} `) ||
      chip.startsWith(`${key}(`)
    ) {
      return ids[key];
    }
  }

  // Classic ESP32 chip variants.
  if (/^ESP32-(D0WD|D2WD|SOLO|PICO|WROOM|WROVER)/.test(chip)) {
    return ids["ESP32"];
  }

  // Unknown chips must not bypass compatibility checks.
  return null;
}

// ============================================================
// 7. FIRMWARE AUTO ADDRESS
// ============================================================

async function analyzeFiles() {
  analysisValid = false;

  const info = $("binaryInfo");

  const selectedFiles = firmwareInputs
    .map((item) => $(item.input).files[0])
    .filter(Boolean);

  if (!selectedFiles.length) {
    info.textContent = "Select firmware .bin files";
    renderPartitionTable([]);
    updateUI();
    return;
  }

  try {
    const classified = new Map();

    for (const file of selectedFiles) {
      if (!file.size) {
        throw new Error("Empty binary file");
      }

      const data = new Uint8Array(await file.arrayBuffer());

      const partitions = partitionDetails(data);
      const image = imageDetails(data);

      const role = partitions ? "partitions" : image?.role;

      if (!role) {
        throw new Error(`Unsupported binary: ${file.name}`);
      }

      if (classified.has(role)) {
        throw new Error(`Duplicate ${role} binary`);
      }

      classified.set(role, {
        file: file,
        data: data,
        entries: partitions,
        image: image,
      });
    }

    for (const item of firmwareInputs) {
      $(item.input).value = "";
    }

    for (const [role, entry] of classified) {
      const target = $(role);

      const transfer = new DataTransfer();
      transfer.items.add(entry.file);

      target.files = transfer.files;
    }

    const boot = classified.get("bootloader");
    const partitions = classified.get("partitions");
    const firmware = classified.get("firmware");

    const lines = [];

    const detectedBoot = bootOffset(chipName);
    const resolvedBoot = detectedBoot ?? 0x1000;

    $("bootloaderAddr").value = asHex(resolvedBoot);
    $("partitionsAddr").value = "0x8000";
    $("firmwareAddr").value = "0x10000";

    const expectedChipId = chipIdForName(chipName);

    for (const [role, entry] of classified) {
      if (
        expectedChipId !== null &&
        entry.image?.chipId !== undefined &&
        entry.image?.chipId !== null &&
        entry.image.chipId !== expectedChipId
      ) {
        throw new Error(`${role} does not match ${chipName}`);
      }
    }

    if (boot) {
      lines.push(
        `Bootloader: ${asHex(resolvedBoot)} ` +
          (detectedBoot === null ? "[DEFAULT]" : "[AUTO]"),
      );
    }

    if (partitions) {
      lines.push("Partitions: 0x8000 [DEFAULT]");

      const apps = partitions.entries.filter((entry) => entry.type === 0);

      const factory = apps.find((entry) => entry.subtype === 0);

      const ota = apps.filter(
        (entry) => entry.subtype >= 0x10 && entry.subtype <= 0x1f,
      );

      const target = factory || (ota.length === 1 ? ota[0] : null);

      if (target && firmware) {
        if (firmware.data.length > target.size) {
          throw new Error("Firmware exceeds partition size");
        }

        $("firmwareAddr").value = asHex(target.offset);

        lines.push(`Firmware: ${asHex(target.offset)} [AUTO]`);
      } else if (firmware) {
        lines.push("Firmware: 0x10000 [DEFAULT]");
      }

      renderPartitionTable(partitions.entries);
    } else {
      renderPartitionTable([]);

      if (firmware) {
        lines.push("Firmware: 0x10000 [DEFAULT]");
      }
    }

    if (firmware?.image?.descriptor) {
      const desc = firmware.image.descriptor;

      lines.push(`Project: ${desc.project}`);
      lines.push(`Version: ${desc.version}`);
      lines.push(`ESP-IDF: ${desc.idf}`);
    }

    lines.push(
      "WARNING: Default offsets may differ " + "from custom flash layouts.",
    );

    info.textContent = lines.join("\n");

    analysisValid = true;
  } catch (error) {
    info.textContent = `Analysis failed: ${error.message}`;

    log(info.textContent);
  }

  updateUI();
  renderFactory();
}

// ============================================================
// 8. MERGED FULL FLASH INSPECTOR
// ============================================================

function inspectMerged(data) {
  if (data.length < 0x11000 || data.length > 32 * 1024 * 1024) {
    throw new Error("Invalid merged binary size");
  }

  const candidates = [];

  for (
    let address = 0x8000;
    address <= Math.min(0x20000, data.length - 0x1000);
    address += 0x1000
  ) {
    const entries = partitionDetails(data.subarray(address, address + 0x1000));

    if (entries) {
      candidates.push({
        address: address,
        entries: entries,
      });
    }
  }

  if (candidates.length !== 1) {
    throw new Error("Unable to identify unique partition table");
  }

  const partition = candidates[0];

  const apps = partition.entries.filter((entry) => entry.type === 0);

  const validApps = apps
    .filter((entry) => entry.offset < data.length)
    .map((entry) => ({
      entry: entry,
      image: imageDetails(data.subarray(entry.offset)),
    }))
    .filter((item) => item.image?.role === "firmware");

  if (!validApps.length) {
    throw new Error("Merged binary has no valid application");
  }

  const bootCandidates = [0, 0x1000].filter(
    (address) => imageDetails(data.subarray(address))?.role === "bootloader",
  );

  if (bootCandidates.length !== 1) {
    throw new Error("Unable to identify bootloader offset");
  }

  const bootImage = imageDetails(data.subarray(bootCandidates[0]));

  const chipIds = [
    bootImage.chipId,
    ...validApps.map((item) => item.image.chipId),
  ].filter((id) => id !== null);

  if (new Set(chipIds).size > 1) {
    throw new Error("Merged binary contains incompatible images");
  }

  return {
    bootOffset: bootCandidates[0],
    partitionOffset: partition.address,
    entries: partition.entries,
    apps: validApps,
    chipId: chipIds[0] ?? null,
  };
}

// ============================================================
// 9. FIRMWARE FILE PREPARATION
// ============================================================

async function imageFiles() {
  const files = [];

  const mergedFile = $("merged").files[0];

  if (mergedFile) {
    const data = new Uint8Array(await mergedFile.arrayBuffer());

    const details = inspectMerged(data);

    const expected = chipIdForName(chipName);

    if (
      expected !== null &&
      details.chipId !== null &&
      expected !== details.chipId
    ) {
      throw new Error("Merged binary chip mismatch");
    }

    const boot = bootOffset(chipName);

    if (boot !== null && boot !== details.bootOffset) {
      throw new Error("Merged bootloader offset mismatch");
    }

    return [
      {
        name: "Merged Full Flash",
        address: 0,
        size: data.length,
        data: data,
        merged: true,
      },
    ];
  }

  for (const item of firmwareInputs) {
    const file = $(item.input).files[0];

    if (!file) {
      continue;
    }

    const address = parseOffset($(item.address).value, item.name);

    const data = new Uint8Array(await file.arrayBuffer());

    files.push({
      name: item.name,
      address: address,
      size: data.length,
      data: data,
      merged: false,
    });
  }

  if (!files.length) {
    throw new Error("No firmware selected");
  }

  const sorted = [...files].sort((a, b) => a.address - b.address);

  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    const end = Math.ceil((previous.address + previous.size) / 0x1000) * 0x1000;

    if (end > current.address) {
      throw new Error(`Flash overlap: ${previous.name} / ${current.name}`);
    }
  }

  return files;
}

// ============================================================
// 10. FLASH READBACK AND VERIFICATION
// ============================================================

function bytesEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

async function readFlashRegion(currentLoader, address, size) {
  if (!currentLoader) {
    throw new Error("No active loader");
  }

  if (size <= 0 || size > 32 * 1024 * 1024) {
    throw new Error("Invalid flash read size");
  }

  const result = await currentLoader.readFlash(
    address,
    size,
    (_packet, done, total) => {
      if (total && !factoryBusy) {
        progress((done * 100) / total);
      }
    },
  );

  if (!(result instanceof Uint8Array)) {
    throw new Error("Unexpected flash read result");
  }

  return result;
}

// ============================================================
// 11. FLASH FIRMWARE
// ============================================================

async function flashESP() {
  await execute("Preparing firmware...", async () => {
    if (!loader) {
      throw new Error("Device not connected");
    }

    let flashError = null;
    let resetError = null;

    let report = null;

    try {
      // ==========================================
      // PREPARE FIRMWARE
      // ==========================================

      if (!analysisValid) {
        throw new Error("Binary inspection failed");
      }

      const images = await imageFiles();

      const totalBytes = images.reduce((sum, image) => sum + image.size, 0);

      const completed = images.map(() => 0);

      report = {
        date: new Date().toISOString(),
        chip: chipName,
        images: images.map((image) => ({
          name: image.name,
          address: asHex(image.address),
          size: image.size,
        })),
        status: "in progress",
        skipped: [],
      };

      lastReport = report;

      progress(0);

      const toWrite = [];

      // ==========================================
      // SMART FLASH
      // ==========================================

      if ($("smartFlash").checked) {
        for (const image of images) {
          operation(`Checking ${image.name}`);

          const existing = await readFlashRegion(
            loader,
            image.address,
            image.size,
          );

          if (bytesEqual(existing, image.data)) {
            log(`SKIP: ${image.name}`);

            report.skipped.push(image.name);
          } else {
            toWrite.push(image);
          }
        }
      } else {
        toWrite.push(...images);
      }

      // ==========================================
      // FLASH FIRMWARE
      // ==========================================

      if (toWrite.length > 0) {
        log("Flash started");

        const writeCompleted = toWrite.map(() => 0);

        const writeTotal = toWrite.reduce((sum, image) => sum + image.size, 0);

        await loader.writeFlash({
          fileArray: toWrite.map((image) => ({
            address: image.address,
            data: image.data,
          })),

          flashSize: "keep",
          eraseAll: false,
          compress: true,

          reportProgress: (index, written, total) => {
            if (index < 0 || index >= toWrite.length) {
              return;
            }

            const selectedImage = toWrite[index];

            writeCompleted[index] =
              total > 0 ? (selectedImage.size * written) / total : 0;

            const writtenBytes = writeCompleted.reduce(
              (sum, value) => sum + value,
              0,
            );

            progress((writtenBytes * 100) / writeTotal);

            operation(`Flashing ${selectedImage.name}`);
          },
        });

        log("Flash write completed");

        // ==========================================
        // VERIFY FIRMWARE
        // ==========================================

        if ($("verifyFlash").checked) {
          operation("Verifying flash...");

          for (const image of toWrite) {
            const actual = await readFlashRegion(
              loader,
              image.address,
              image.size,
            );

            if (!bytesEqual(actual, image.data)) {
              throw new Error(`Verification failed: ${image.name}`);
            }

            log(`VERIFY PASS: ${image.name}`);
          }
        }

        report.status = "success";

        log("Flash completed successfully");
      } else {
        report.status = "unchanged";

        log("No flash write required");
        log("Firmware unchanged");
      }

      progress(100);
    } catch (error) {
      // ==========================================
      // FLASH ERROR
      // ==========================================

      flashError = error;

      log(`Flash FAILED: ${error.message || error}`);

      operation("Flash failed");

      if (report) {
        report.status = "failed";

        report.error = String(error.message || error);
      }
    } finally {
      // ==========================================
      // RESET MCU - ALWAYS EXECUTE
      // ==========================================

      if (port) {
        try {
          operation("Resetting MCU...");

          log("Resetting MCU after Flash...");

          // resetMCU() includes 500 ms delay
          await resetMCU(port);

          log("MCU reset completed");
        } catch (error) {
          resetError = error;

          log(`MCU reset FAILED: ${error.message || error}`);
        }
      } else {
        log("MCU reset skipped: Serial port unavailable");
      }

      // ==========================================
      // DISCONNECT SERIAL PORT
      // ==========================================

      try {
        await cleanup();

        log("Disconnected");
      } catch (error) {
        log(`Disconnect warning: ${error.message || error}`);
      }

      // ==========================================
      // SAVE FLASH HISTORY
      // ==========================================

      if (report) {
        report.resetStatus = resetError ? "failed" : "requested";

        if (resetError) {
          report.resetError = String(resetError.message || resetError);
        }

        saveHistory(report);
      }
    }

    // ==============================================
    // FINAL RESULT
    // ==============================================

    if (flashError) {
      throw flashError;
    }

    if (resetError) {
      log("WARNING: Flash completed but MCU reset failed");
    }

    operation("Flash complete");
  });
}

// ============================================================
// 12. ERASE ENTIRE FLASH
// ============================================================

async function eraseESP() {
  if (!loader) {
    return;
  }

  const first = confirm("WARNING: Erase entire Flash including NVS?");

  if (!first) {
    log("Erase cancelled");
    return;
  }

  const second = confirm("FINAL CONFIRMATION: Erase entire device Flash?");

  if (!second) {
    log("Erase cancelled");
    return;
  }

  await execute("Erasing Flash...", async () => {
    let eraseError = null;
    let resetError = null;

    try {
      progress(0);

      log("Erasing entire Flash...");

      await loader.eraseFlash();

      progress(100);

      log("Flash erased successfully");
    } catch (error) {
      eraseError = error;

      log(`Erase FAILED: ${error.message || error}`);
    } finally {
      // ==========================================
      // RESET MCU - PASS OR FAIL
      // ==========================================

      if (port) {
        try {
          operation("Resetting MCU...");

          // Includes 500 ms delay
          await resetMCU(port);

          log("MCU reset completed");
        } catch (error) {
          resetError = error;

          log(`MCU reset FAILED: ${error.message || error}`);
        }
      }

      // ==========================================
      // DISCONNECT
      // ==========================================

      try {
        await cleanup();

        log("Disconnected");
      } catch (error) {
        log(`Disconnect warning: ${error.message || error}`);
      }
    }

    if (eraseError) {
      throw eraseError;
    }

    if (resetError) {
      log("WARNING: Flash erased, but MCU reset failed");
    }

    operation("Erase complete");
  });
}

// ============================================================
// 13. FLASH BACKUP
// ============================================================

function downloadFile(data, filename, type = "application/octet-stream") {
  const blob = new Blob([data], { type: type });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);

  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

async function backupESP() {
  await execute("Backing up Flash...", async () => {
    if (!loader) {
      throw new Error("Device not connected");
    }

    const address = parseOffset($("backupAddr").value, "Backup address");

    const size = parseOffset($("backupSize").value, "Backup size");

    if (
      size === 0 ||
      size > 16 * 1024 * 1024 ||
      address + size > 32 * 1024 * 1024
    ) {
      throw new Error("Invalid backup range");
    }

    log(`Backup started: ${asHex(address)}, ` + `${size} bytes`);

    const data = await readBackupInChunks(address, size);

    if (data.length !== size) {
      throw new Error("Backup size verification failed");
    }

    const filename = `esp_backup_${Date.now()}.bin`;

    downloadFile(data, filename);

    log(`Backup saved: ${filename}`);

    operation("Backup complete");
  });
}

// ============================================================
// 14. PARTITION TABLE VIEWER
// ============================================================

function renderPartitionTable(entries) {
  const view = $("partitionView");

  if (!entries.length) {
    view.textContent = "No partition table available";

    return;
  }

  view.textContent = entries
    .map((entry) => {
      return [
        entry.label || "unnamed",
        asHex(entry.offset),
        `${(entry.size / 1024).toFixed(0)} KiB`,
        `Type ${asHex(entry.type)}`,
        `Subtype ${asHex(entry.subtype)}`,
      ].join(" | ");
    })
    .join("\n");
}

async function inspectDevicePartitions() {
  await execute("Reading partition table...", async () => {
    if (!loader) {
      throw new Error("Device not connected");
    }

    const address = parseOffset($("partitionsAddr").value, "Partition address");

    const data = await readFlashRegion(loader, address, 0x1000);

    const entries = partitionDetails(data);

    renderPartitionTable(entries || []);

    log(
      entries
        ? `Found ${entries.length} partitions`
        : "Partition table not found",
    );
  });
}

// ============================================================
// 15. FLASH HISTORY
// ============================================================

function saveHistory(report) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

    history.unshift(report);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));

    renderHistory();
  } catch (error) {
    log(`History unavailable: ${error.message}`);
  }
}

function renderHistory() {
  let history = [];

  try {
    history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    history = [];
  }

  $("history").textContent =
    history
      .slice(0, 15)
      .map((entry) => {
        const names = entry.images.map((image) => image.name).join(", ");

        return (
          `${entry.date} | ` + `${entry.chip} | ` + `${entry.status} | ${names}`
        );
      })
      .join("\n") || "No history";
}

function exportHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

  const report = {
    date: new Date().toISOString(),
    lastReport: lastReport,
    history: history,
  };

  downloadFile(
    JSON.stringify(report, null, 2),
    `esp_flash_report_${Date.now()}.json`,
    "application/json",
  );
}

function clearHistory() {
  if (!confirm("Clear flash history?")) {
    return;
  }

  localStorage.removeItem(HISTORY_KEY);

  renderHistory();
}

// ============================================================
// 16. SERIAL MONITOR
// ============================================================

async function startSerialMonitor() {
  if (busy || monitoring || !port || !loader) {
    return;
  }

  const selectedPort = port;

  lockUI();

  try {
    await cleanup();

    monitorPort = selectedPort;

    await monitorPort.open({
      baudRate: Number($("monitorBaud").value),
    });

    monitoring = true;
    unlockUI();

    operation("Serial Monitor running");
    log("Serial Monitor started");

    const decoder = new TextDecoder();

    while (monitoring && monitorPort.readable) {
      monitorReader = monitorPort.readable.getReader();

      try {
        while (monitoring) {
          const { value, done } = await monitorReader.read();

          if (done) {
            break;
          }

          if (value) {
            log(decoder.decode(value, { stream: true }));
          }
        }
      } finally {
        monitorReader.releaseLock();
        monitorReader = null;
      }
    }
  } catch (error) {
    log(`Serial Monitor: ${error.message || error}`);
  } finally {
    monitoring = false;

    try {
      if (monitorPort?.readable || monitorPort?.writable) {
        await monitorPort.close();
      }
    } catch {}

    monitorPort = null;

    unlockUI();
    operation("Serial Monitor stopped");
  }
}

async function stopSerialMonitor() {
  monitoring = false;

  try {
    await monitorReader?.cancel();
  } catch {}

  operation("Stopping Serial Monitor");
}

// ============================================================
// 17. FACTORY MODE UI
// ============================================================

function renderFactory() {
  const tbody = $("factoryDevices");

  tbody.replaceChildren();

  factoryDevices.forEach((device, index) => {
    const tr = document.createElement("tr");

    const usbInfo = device.port.getInfo();

    const vid =
      usbInfo.usbVendorId !== undefined
        ? usbInfo.usbVendorId.toString(16).toUpperCase().padStart(4, "0")
        : null;

    const pid =
      usbInfo.usbProductId !== undefined
        ? usbInfo.usbProductId.toString(16).toUpperCase().padStart(4, "0")
        : null;

    const serialPort = `PORT ${index + 1}`;

    const values = [
      String(index + 1),
      serialPort,
      device.chip || "Not checked",
      device.status,
      `${device.progress}%`,
    ];

    values.forEach((value, columnIndex) => {
      const td = document.createElement("td");

      // ==========================================
      // SERIAL PORT
      // ==========================================

      if (columnIndex === 1) {
        const label = document.createElement("span");

        label.textContent = value;
        label.className = "serial-port-label";

        td.appendChild(label);

        if (vid !== null && pid !== null) {
          const details = document.createElement("small");

          details.textContent = `VID:${vid} PID:${pid}`;
          details.className = "serial-port-details";

          td.appendChild(details);
        }

        // ==========================================
        // FACTORY STATUS COLORS
        // ==========================================
      } else if (columnIndex === 3) {
        const status = document.createElement("span");

        status.textContent = value;
        status.className = "factory-status";

        if (value.startsWith("PASS")) {
          status.classList.add("status-pass");
        } else if (value.startsWith("FAIL")) {
          status.classList.add("status-fail");
        } else if (value === "NO SUPPORT") {
          status.classList.add("status-unsupported");
        } else if (
          value === "FLASHING" ||
          value === "ERASING" ||
          value === "VERIFYING" ||
          value === "RESETTING" ||
          value === "CHECKING"
        ) {
          status.classList.add("status-working");
        } else {
          status.classList.add("status-idle");
        }

        td.appendChild(status);
      } else {
        td.textContent = value;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // ==========================================
  // FACTORY SUMMARY
  // ==========================================

  const passed = factoryDevices.filter((device) =>
    device.status.startsWith("PASS"),
  ).length;

  const failed = factoryDevices.filter((device) =>
    device.status.startsWith("FAIL"),
  ).length;

  const unsupported = factoryDevices.filter(
    (device) => device.status === "NO SUPPORT",
  ).length;

  $("factorySummary").textContent =
    `${factoryDevices.length} devices | ` +
    `${passed} PASS | ` +
    `${failed} FAIL | ` +
    `${unsupported} NO SUPPORT`;
}

// ============================================================
// 18. FACTORY DEVICE SELECTION
// ============================================================

async function addFactoryDevice() {
  if (busy || factoryBusy || loader || monitoring) {
    return;
  }

  try {
    const selected = await navigator.serial.requestPort();

    if (factoryDevices.some((device) => device.port === selected)) {
      log("Device already selected");
      return;
    }

    factoryDevices.push({
      port: selected,
      chip: "",
      status: "READY",
      progress: 0,
    });

    renderFactory();
    updateUI();
  } catch (error) {
    if (error.name !== "NotFoundError") {
      log(`Factory: ${error.message}`);
    }
  }
}

function clearFactoryDevices() {
  if (factoryBusy) {
    return;
  }

  factoryDevices = [];

  renderFactory();
  updateUI();
}

// ============================================================
// 19. FACTORY FLASH WORKER
// ============================================================

async function factoryWorker(device, images, baudRate) {
  let currentTransport = null;
  let currentLoader = null;

  const station = factoryDevices.indexOf(device) + 1;

  let flashError = null;
  let resetError = null;

  const record = {
    date: new Date().toISOString(),
    chip: "",
    mode: "factory",
    station: station,
    images: [],
    status: "in progress",
    skipped: [],
  };

  device.status = "CONNECTING";
  device.progress = 0;

  renderFactory();

  try {
    // ==========================================
    // CONNECT DEVICE
    // ==========================================

    currentTransport = new Transport(device.port);

    currentLoader = new ESPLoader({
      transport: currentTransport,
      baudrate: baudRate,
      debugLogging: false,

      terminal: {
        clean: () => {},

        writeLine: (text) => {
          log(`[Station ${station}] ${text}`);
        },

        write: (text) => {
          log(`[Station ${station}] ${text}`);
        },
      },
    });

    device.chip = await currentLoader.main();

    record.chip = device.chip;

    log(`[Station ${station}] Connected: ${device.chip}`);

    // ==========================================
    // CHIP COMPATIBILITY CHECK
    // ==========================================

    const expectedChip = chipIdForName(device.chip);

    // Prevent unknown MCU from bypassing compatibility checks.
    if (expectedChip === null) {
      throw new Error(`NO_SUPPORT: Unknown target chip ${device.chip}`);
    }

    const resolvedImages = images.map((image) => {
      if (image.name === "Bootloader") {
        return {
          ...image,
          address: bootOffset(device.chip) ?? image.address,
        };
      }

      return {
        ...image,
      };
    });

    for (const image of resolvedImages) {
      if (image.merged) {
        const details = inspectMerged(image.data);

        if (
          expectedChip !== null &&
          details.chipId !== null &&
          details.chipId !== expectedChip
        ) {
          throw new Error("NO_SUPPORT: Merged image chip mismatch");
        }

        const requiredBoot = bootOffset(device.chip);

        if (requiredBoot !== null && details.bootOffset !== requiredBoot) {
          throw new Error("NO_SUPPORT: Merged bootloader offset mismatch");
        }
      } else {
        const details = imageDetails(image.data);

        if (
          details &&
          expectedChip !== null &&
          details.chipId !== null &&
          details.chipId !== expectedChip
        ) {
          throw new Error(`NO_SUPPORT: ${image.name}`);
        }
      }
    }

    record.images = resolvedImages.map((image) => ({
      name: image.name,
      address: asHex(image.address),
      size: image.size,
    }));

    // ==========================================
    // SMART FLASH
    // ==========================================

    const changed = [];

    for (const image of resolvedImages) {
      if ($("smartFlash").checked) {
        device.status = "CHECKING";

        renderFactory();

        const existing = await readFlashRegion(
          currentLoader,
          image.address,
          image.size,
        );

        if (bytesEqual(existing, image.data)) {
          log(`[Station ${station}] SKIP: ${image.name}`);

          record.skipped.push(image.name);

          continue;
        }
      }

      changed.push(image);
    }

    // ==========================================
    // FLASH FIRMWARE
    // ==========================================

    if (changed.length > 0) {
      device.status = "FLASHING";

      renderFactory();

      const totalBytes = changed.reduce((sum, image) => sum + image.size, 0);

      const completed = changed.map(() => 0);

      log(`[Station ${station}] Flash started`);

      await currentLoader.writeFlash({
        fileArray: changed.map((image) => ({
          address: image.address,
          data: image.data,
        })),

        flashSize: "keep",
        eraseAll: false,
        compress: true,

        reportProgress: (index, written, total) => {
          if (index < 0 || index >= changed.length) {
            return;
          }

          completed[index] =
            total > 0 ? (changed[index].size * written) / total : 0;

          const writtenBytes = completed.reduce((sum, value) => sum + value, 0);

          device.progress = Math.round((writtenBytes * 100) / totalBytes);

          renderFactory();
        },
      });

      log(`[Station ${station}] Flash write completed`);
    } else {
      log(`[Station ${station}] Firmware unchanged`);
    }

    // ==========================================
    // VERIFY FLASH
    // ==========================================

    if ($("verifyFlash").checked && changed.length > 0) {
      device.status = "VERIFYING";

      renderFactory();

      for (const image of changed) {
        const actual = await readFlashRegion(
          currentLoader,
          image.address,
          image.size,
        );

        if (!bytesEqual(actual, image.data)) {
          throw new Error(`Verification failed: ${image.name}`);
        }

        log(`[Station ${station}] VERIFY PASS: ${image.name}`);
      }
    }

    // ==========================================
    // FLASH SUCCESS
    // ==========================================

    device.progress = 100;

    record.status = changed.length > 0 ? "success" : "unchanged";

    log(`[Station ${station}] Flash completed successfully`);
  } catch (error) {
    const message = String(error.message || error);

    if (message.startsWith("NO_SUPPORT:")) {
      record.status = "unsupported";
      record.error = message;

      log(
        `[Station ${station}] Firmware not supported: ` +
          message.replace("NO_SUPPORT:", "").trim(),
      );
    } else {
      flashError = error;

      record.status = "failed";
      record.error = message;

      log(`[Station ${station}] Flash FAILED: ${message}`);
    }
  } finally {
    // ==========================================
    // RESET MCU - PASS OR FAIL
    // ==========================================

    if (currentLoader && device.port) {
      try {
        device.status = "RESETTING";

        renderFactory();

        log(`[Station ${station}] Resetting MCU...`);

        // resetMCU() includes 500 ms delay.
        // Each station uses its own Serial Port.
        await resetMCU(device.port);

        log(`[Station ${station}] MCU reset completed`);
      } catch (error) {
        resetError = error;

        record.resetError = String(error.message || error);

        log(
          `[Station ${station}] MCU reset FAILED: ` +
            `${error.message || error}`,
        );
      }
    } else {
      log(
        `[Station ${station}] MCU reset skipped: ` + `Device not initialized`,
      );
    }

    // ==========================================
    // DISCONNECT SERIAL
    // ==========================================

    if (currentTransport) {
      try {
        await currentTransport.disconnect();

        log(`[Station ${station}] Disconnected`);
      } catch (error) {
        log(
          `[Station ${station}] Disconnect warning: ` +
            `${error.message || error}`,
        );
      }
    }

    // ==========================================
    // SAVE RESET STATUS
    // ==========================================

    record.resetStatus = resetError
      ? "failed"
      : currentLoader
        ? "requested"
        : "skipped";

    // ==========================================
    // RESTORE FINAL STATUS
    // ==========================================

    if (record.status === "unsupported") {
      device.status = "NO SUPPORT";
    } else if (flashError) {
      device.status = `FAIL: ${flashError.message || flashError}`;
    } else if (resetError) {
      device.status = "PASS (RESET WARNING)";
    } else {
      device.status = "PASS";
    }

    // ==========================================
    // SAVE HISTORY
    // ==========================================

    saveHistory(record);

    renderFactory();
  }
}

// ============================================================
// 20. FACTORY FLASH ALL
// ============================================================

async function runFactory() {
  if (
    busy ||
    factoryBusy ||
    loader ||
    monitoring ||
    !analysisValid ||
    !factoryDevices.length
  ) {
    return;
  }

  factoryBusy = true;
  updateUI();

  try {
    const images = await imageFiles();

    const baudRate = Number($("baudRate").value);

    await Promise.all(
      factoryDevices.map((device) => factoryWorker(device, images, baudRate)),
    );

    log("Factory flashing completed");
  } catch (error) {
    log(`Factory error: ${error.message || error}`);
  } finally {
    factoryBusy = false;

    renderFactory();
    updateUI();
  }
}

// ============================================================
// 21. FACTORY ERASE WORKER
// ===========================================================

async function factoryEraseWorker(device, baudRate) {
  let currentTransport = null;
  let currentLoader = null;

  const station = factoryDevices.indexOf(device) + 1;

  let eraseError = null;
  let resetError = null;
  let resetAttempted = false;
  let resetCompleted = false;

  const record = {
    date: new Date().toISOString(),
    chip: "",
    mode: "factory",
    operation: "erase",
    station: station,
    images: [],
    status: "in progress",
    resetStatus: "skipped",
    skipped: [],
  };

  device.status = "CONNECTING";
  device.progress = 0;

  renderFactory();

  try {
    // ==========================================
    // CONNECT DEVICE
    // ==========================================

    currentTransport = new Transport(device.port);

    currentLoader = new ESPLoader({
      transport: currentTransport,
      baudrate: baudRate,
      debugLogging: false,

      terminal: {
        clean: () => {},

        writeLine: (text) => {
          log(`[Station ${station}] ${text}`);
        },

        write: (text) => {
          log(`[Station ${station}] ${text}`);
        },
      },
    });

    device.chip = await currentLoader.main();

    record.chip = device.chip;

    log(`[Station ${station}] Connected: ${device.chip}`);

    // ==========================================
    // ERASE ENTIRE FLASH
    // ==========================================

    device.status = "ERASING";
    device.progress = 0;

    renderFactory();

    log(`[Station ${station}] Erasing entire Flash...`);

    await currentLoader.eraseFlash();

    device.progress = 100;

    record.status = "success";

    log(`[Station ${station}] Flash erased successfully`);
  } catch (error) {
    // ==========================================
    // ERASE ERROR
    // ==========================================

    eraseError = error;

    record.status = "failed";
    record.error = String(error.message || error);

    log(`[Station ${station}] Erase FAILED: ` + `${error.message || error}`);
  } finally {
    // ==========================================
    // RESET MCU - PASS OR FAIL
    // ==========================================

    if (device.port && currentLoader) {
      try {
        device.status = "RESETTING";
        renderFactory();

        log(`[Station ${station}] Resetting MCU...`);

        resetAttempted = true;

        // resetMCU() includes 500 ms delay.
        await resetMCU(device.port);

        resetCompleted = true;

        log(`[Station ${station}] MCU reset completed`);
      } catch (error) {
        resetError = error;

        record.resetError = String(error.message || error);

        log(
          `[Station ${station}] MCU reset FAILED: ` +
            `${error.message || error}`,
        );
      }
    } else {
      log(
        `[Station ${station}] MCU reset skipped: ` +
          `Serial transport unavailable`,
      );
    }

    // ==========================================
    // DISCONNECT SERIAL
    // ==========================================

    if (currentTransport) {
      try {
        await currentTransport.disconnect();

        log(`[Station ${station}] Disconnected`);
      } catch (error) {
        log(
          `[Station ${station}] Disconnect warning: ` +
            `${error.message || error}`,
        );
      }
    }

    // ==========================================
    // SAVE RESET STATUS
    // ==========================================

    record.resetStatus = resetCompleted
      ? "requested"
      : resetAttempted
        ? "failed"
        : "skipped";

    // ==========================================
    // FINAL STATUS
    // ==========================================

    if (eraseError) {
      device.status = `FAIL: ${eraseError.message || eraseError}`;
    } else if (resetError || !resetCompleted) {
      device.status = "PASS (RESET WARNING)";
    } else {
      device.status = "PASS";
    }

    // ==========================================
    // SAVE HISTORY
    // ==========================================

    saveHistory(record);

    renderFactory();
  }
}

// ============================================================
// 22. FACTORY ERASE ALL
// ============================================================

async function eraseAllFactory() {
  if (
    busy ||
    factoryBusy ||
    loader ||
    monitoring ||
    factoryDevices.length === 0
  ) {
    return;
  }

  // ==========================================
  // FIRST CONFIRMATION
  // ==========================================

  const first = confirm(
    "WARNING: ERASE ALL DEVICES\n\n" +
      `Devices: ${factoryDevices.length}\n\n` +
      "This operation will erase the entire Flash " +
      "of EVERY selected device, including NVS, " +
      "firmware, and partition tables.\n\n" +
      "Do you want to continue?",
  );

  if (!first) {
    log("Factory erase cancelled");
    return;
  }

  // ==========================================
  // SECOND CONFIRMATION
  // ==========================================

  const second = confirm(
    "FINAL CONFIRMATION\n\n" +
      `Erase ALL ${factoryDevices.length} devices?\n\n` +
      "This action cannot be undone.",
  );

  if (!second) {
    log("Factory erase cancelled");
    return;
  }

  // ==========================================
  // LOCK FACTORY UI
  // ==========================================

  factoryBusy = true;

  updateUI();

  try {
    const baudRate = Number($("baudRate").value);

    log(`Factory erase started: ` + `${factoryDevices.length} devices`);

    // ==========================================
    // ERASE ALL STATIONS
    // ==========================================

    const results = await Promise.allSettled(
      factoryDevices.map((device) => {
        return factoryEraseWorker(device, baudRate);
      }),
    );

    // ==========================================
    // CHECK WORKER RESULTS
    // ==========================================

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const device = factoryDevices[index];

        device.status = `FAIL: ${result.reason?.message || result.reason}`;

        log(`[Station ${index + 1}] ` + `Worker error: ${result.reason}`);
      }
    });

    // ==========================================
    // FACTORY SUMMARY
    // ==========================================

    const passed = factoryDevices.filter((device) =>
      device.status.startsWith("PASS"),
    ).length;

    const failed = factoryDevices.filter((device) =>
      device.status.startsWith("FAIL"),
    ).length;

    log(`Factory erase completed: ` + `${passed} PASS, ${failed} FAIL`);

    operation("Factory erase completed");
  } catch (error) {
    log(`Factory erase error: ${error.message || error}`);

    operation("Factory erase failed");
  } finally {
    // ==========================================
    // RESTORE FACTORY UI
    // ==========================================

    factoryBusy = false;

    renderFactory();
    updateUI();
  }
}

// ============================================================
// 23. FACTORY REPORT
// ============================================================

function exportFactoryReport() {
  const stations = factoryDevices.map((device, index) => ({
    station: index + 1,
    chip: device.chip,
    status: device.status,
    progress: device.progress,
    usb: device.port.getInfo(),
  }));

  downloadFile(
    JSON.stringify(
      {
        date: new Date().toISOString(),
        stations: stations,
      },
      null,
      2,
    ),
    `factory_report_${Date.now()}.json`,
    "application/json",
  );
}

// ============================================================
// 24. MAIN EVENT LISTENERS
// ============================================================

// Device Connection

btnConnect.addEventListener("click", connectESP);

btnDisconnect.addEventListener("click", disconnectESP);

// Flash Operations

btnFlash.addEventListener("click", flashESP);

btnErase.addEventListener("click", eraseESP);

// Firmware Inspection

for (const item of firmwareInputs) {
  $(item.input).addEventListener("change", () => {
    $("merged").value = "";
    analyzeFiles();
  });
}

$("merged").addEventListener("change", async () => {
  for (const item of firmwareInputs) {
    $(item.input).value = "";
  }

  const file = $("merged").files[0];

  analysisValid = false;

  if (!file) {
    $("binaryInfo").textContent = "Select binary files";

    updateUI();
    return;
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());

    const details = inspectMerged(data);

    renderPartitionTable(details.entries);

    $("binaryInfo").textContent = [
      `Merged: ${file.name}`,
      `Size: ${data.length} bytes`,
      "Base: 0x0000",
      `Bootloader: ${asHex(details.bootOffset)}`,
      `Partitions: ${asHex(details.partitionOffset)}`,
      `Applications: ${details.apps.length}`,
      `Chip ID: ${details.chipId ?? "Unknown"}`,
    ].join("\n");

    analysisValid = true;
  } catch (error) {
    $("binaryInfo").textContent = `Analysis failed: ${error.message}`;
  }

  updateUI();
});

// Backup and Partition Viewer

btnBackup.addEventListener("click", backupESP);

btnInspectDevice.addEventListener("click", inspectDevicePartitions);

// Serial Monitor

btnStartMonitor.addEventListener("click", startSerialMonitor);

btnStopMonitor.addEventListener("click", stopSerialMonitor);

// Factory Mode

btnAddFactory.addEventListener("click", addFactoryDevice);

btnClearFactory.addEventListener("click", clearFactoryDevices);

btnRunFactory.addEventListener("click", runFactory);

btnFactoryExport.addEventListener("click", exportFactoryReport);

btnEraseFactory.addEventListener("click", eraseAllFactory);

// Reports and Logs

$("clearLog").addEventListener("click", () => {
  logBox.value = "";
});

$("exportReport").addEventListener("click", exportHistory);

$("clearHistory").addEventListener("click", clearHistory);

// USB Disconnect Detection

if ("serial" in navigator) {
  navigator.serial.addEventListener("disconnect", (event) => {
    if (port && (event.port === port || event.target === port)) {
      log("USB serial device removed");

      loader = null;
      transport = null;
      port = null;
      chipName = "";

      chipInfo.textContent = "Not Connected";

      operation("Device removed");
      updateUI();
    }
  });
}

// ============================================================
// 22. INITIAL STATE
// ============================================================

renderHistory();
renderFactory();
updateUI();

log("ESP Web Firmware Flasher Ready");
