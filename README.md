# 🔥 ESP Web Firmware Flasher
### ESP32 Family | Browser-Based Firmware Programming & Factory Multi-device Utility
*(Dual Language — English / ภาษาไทย)*

ESP Web Firmware Flasher is a browser-based programming utility for Espressif microcontrollers. It uses the **Web Serial API** and **esptool-js** to inspect firmware images, flash and verify firmware, back up flash memory, monitor serial output, and manage multiple devices from a web interface.

**ภาพรวม:** ESP Web Firmware Flasher เป็นเครื่องมือ Flash Firmware ผ่านเว็บสำหรับไมโครคอนโทรลเลอร์ตระกูล ESP โดยใช้ **Web Serial API** และ **esptool-js** รองรับการตรวจสอบไฟล์ Firmware, Flash, Verify, Backup, Serial Monitor และ Factory Multi-device สำหรับพัฒนา ทดสอบ และโปรแกรมอุปกรณ์หลายตัว

> **Project status / สถานะ:** v1.0.0 — core functions tested on physical ESP32, ESP32-C3, and ESP32-S3 hardware, including a three-device factory test. Firebase Hosting deployment should be verified separately after publishing. / ทดสอบฟังก์ชันหลักกับ ESP32, ESP32-C3 และ ESP32-S3 จริงแล้ว รวมถึง Factory แบบ 3 อุปกรณ์ ส่วนการทำงานบน URL ที่ Deploy ต้องทดสอบอีกครั้ง

---

## 🧩 Version / เวอร์ชัน

| Version | Description / รายละเอียด |
| --- | --- |
| **v1.0.0** | Initial release: firmware inspection, smart flashing, verification, backup, serial monitor, factory multi-device flashing/erasing, and report export / เวอร์ชันเริ่มต้น พร้อมระบบ Flash, ตรวจสอบ Firmware, Backup และ Factory หลายอุปกรณ์ |

---

## 📘 Overview / ภาพรวม

- **Browser-based programming:** Flash ESP firmware without a separate desktop flashing GUI. / Flash Firmware ผ่าน Browser โดยไม่ต้องใช้โปรแกรม Flash แบบ Desktop
- **Client-side operation:** USB serial communication and firmware processing run on the user's computer. / ติดต่อ USB Serial และประมวลผล Firmware บนเครื่องผู้ใช้
- **Firmware workflows:** Designed for binaries produced by ESP-IDF and Arduino-ESP32. / รองรับแนวทางการพัฒนา Firmware จาก ESP-IDF และ Arduino-ESP32
- **Factory workflow:** Register multiple devices, check their compatibility, track outcomes, and export results. / เพิ่มอุปกรณ์หลายตัว ตรวจสอบความเข้ากันได้ แสดงผล และส่งออก Report
- **Static hosting:** The frontend is hosted as static files on Firebase Hosting; core flashing does not require a remote backend. / ใช้ Firebase Hosting ให้บริการไฟล์เว็บ โดยงาน Flash หลักไม่ต้องใช้ Backend ภายนอก

---

## 🖥️ Web Interface / ส่วนติดต่อผู้ใช้

The application uses a dark-themed web interface with dedicated sections for device connection, firmware programming, device utilities, serial monitoring, and factory programming.

หน้าเว็บออกแบบเป็น Dark Theme แบ่งส่วนควบคุมการเชื่อมต่อ การเลือกและ Flash Firmware เครื่องมือจัดการอุปกรณ์ Serial Monitor และ Factory Multi-device

> **Screenshots / ภาพตัวอย่าง:** Add screenshots after creating the image files under a `docs/images/` directory. / สามารถเพิ่มภาพหน้าเว็บภายหลังเมื่อมีไฟล์ภาพจริงใน `docs/images/`

---

## ⚙️ Features / คุณสมบัติเด่น

| Feature | Description / รายละเอียด |
| --- | --- |
| **Web Serial connection** | Connect to compatible ESP USB serial interfaces with browser permission / เชื่อมต่อผ่าน USB Serial โดยอนุญาตสิทธิ์จาก Browser |
| **Chip detection** | Identify the target MCU through the flashing interface / ตรวจสอบรุ่น MCU ของอุปกรณ์ |
| **Firmware inspection** | Inspect selected binary images before programming / วิเคราะห์ไฟล์ BIN ก่อน Flash |
| **Address handling** | Assist with flash address selection and supported merged images / ช่วยจัดการ Address และไฟล์ Firmware แบบ Merged |
| **Smart Flash** | Manage supported firmware programming workflows / จัดการลำดับการ Flash ตามรูปแบบ Firmware |
| **Compatibility checks** | Prevent known incompatible chip/image combinations / ตรวจสอบความเข้ากันได้ระหว่าง Firmware กับ MCU |
| **Verification** | Verify programmed firmware in supported workflows / ตรวจสอบข้อมูล Firmware หลังเขียน |
| **Flash erase** | Erase target flash memory / ลบข้อมูล Flash Memory |
| **Flash backup** | Read flash into a binary backup using chunked transfers and retries / สำรอง Flash เป็นไฟล์ BIN โดยอ่านเป็นชุดและ Retry |
| **Serial Monitor** | Read serial output at a selected baud rate / ดูข้อมูล Serial และเลือก Baud Rate |
| **Factory multi-device** | Manage multiple independent USB programming stations / จัดการ Station สำหรับอุปกรณ์หลายตัว |
| **Factory erase** | Erase all registered factory devices after confirmation / Erase อุปกรณ์ Factory ทั้งหมดหลังยืนยัน |
| **Factory report** | Export per-device outcomes for traceability / ส่งออกผลการทดสอบและ Flash แต่ละอุปกรณ์ |
| **Status indicators** | Show progress and color-coded PASS, FAIL, and NO SUPPORT states / แสดง Progress และสถานะด้วยสี |
| **MCU reset** | Attempt a reset sequence after supported operations / สั่ง Reset MCU หลังการทำงานที่รองรับ |

### Factory Status / สถานะในโหมด Factory

| Status | Meaning / ความหมาย |
| --- | --- |
| `READY` | Waiting for an operation / รอเริ่มงาน |
| `CHECKING` | Identifying or validating device / ตรวจสอบอุปกรณ์ |
| `FLASHING` | Writing firmware / กำลัง Flash |
| `VERIFYING` | Checking flashed data / กำลัง Verify |
| `ERASING` | Erasing flash / กำลัง Erase |
| `RESETTING` | Resetting MCU / กำลัง Reset |
| `PASS` | Operation completed / สำเร็จ |
| `FAIL` | Operation failed / ไม่สำเร็จ |
| `NO SUPPORT` | Incompatible or unsupported device/firmware / ไม่รองรับ Firmware หรืออุปกรณ์ที่เลือก |

---

## 🧰 Hardware / ฮาร์ดแวร์

| Component | Description / รายละเอียด |
| --- | --- |
| Target microcontrollers | ESP32 (classic), ESP32-C3, ESP32-S3 — hardware tested / ทดสอบกับบอร์ดจริงแล้ว |
| USB connection | Compatible USB-to-UART bridge or supported native USB Serial/JTAG |
| Host computer | Desktop/laptop with a Web Serial-capable browser / คอมพิวเตอร์ที่ใช้ Browser รองรับ Web Serial |
| USB cable | Data-capable cable and stable connection / สาย USB ที่ส่งข้อมูลได้ |

**Tested hardware / ฮาร์ดแวร์ที่ทดสอบ:** ESP32 classic, ESP32-C3, and ESP32-S3. Factory workflow tested with three connected devices. The application defines chip mappings for 10 ESP families; the remaining 7 have not been hardware-validated.

---

## 🔌 Supported ESP32 Devices / รุ่น ESP32 ที่รองรับ

ESP Web Firmware Flasher v1.0.0 is **designed to support 10 Espressif MCU families** through configured chip identification mappings and firmware compatibility checks. Hardware validation is listed separately from the intended support scope.

ESP Web Firmware Flasher v1.0.0 **ออกแบบให้รองรับ ESP จำนวน 10 รุ่น** ตาม Chip ID ที่กำหนดในโปรแกรม พร้อมระบบตรวจสอบ Firmware Compatibility โดยแยกผลการทดสอบกับบอร์ดจริงออกจากขอบเขตการรองรับที่ออกแบบไว้

| ESP Chip | Hardware Validation |
| --- | --- |
| ESP32 | ✅ Tested |
| ESP32-S2 | Not yet tested |
| ESP32-C3 | ✅ Tested |
| ESP32-S3 | ✅ Tested |
| ESP32-C2 | Not yet tested |
| ESP32-C6 | Not yet tested |
| ESP32-H2 | Not yet tested |
| ESP32-P4 | Not yet tested |
| ESP32-C61 | Not yet tested |
| ESP32-C5 | Not yet tested |

### Hardware Validation / ผลการทดสอบฮาร์ดแวร์

- **ESP32 (Classic):** Firmware flashing tested successfully. / ทดสอบ Flash Firmware สำเร็จ
- **ESP32-C3:** Firmware flashing and flash backup tested successfully. / ทดสอบ Flash และ Backup สำเร็จ
- **ESP32-S3:** Firmware flashing tested successfully. / ทดสอบ Flash Firmware สำเร็จ
- **Factory Multi-device:** Tested with three connected ESP devices. / ทดสอบการทำงานพร้อมกัน 3 อุปกรณ์

**Compatibility note / หมายเหตุ:** The table describes the application's configured target families, **not a guarantee that every chip has been successfully flashed**. Actual support depends on the integrated esptool-js version, device transport, firmware image format, and hardware-specific validation. / ตารางแสดงรุ่นที่ออกแบบให้รองรับ แต่ไม่ได้รับประกันว่าทุกรุ่นผ่านการ Flash จริง ทั้งนี้ขึ้นอยู่กับ Library รูปแบบ Firmware และการทดสอบกับอุปกรณ์

---

## 🛠️ Development Tools & Technologies / เครื่องมือและเทคโนโลยีที่ใช้พัฒนา

| Category / หมวดหมู่ | Tools & Technologies |
| --- | --- |
| **Development Environment** | Visual Studio Code |
| **Programming Languages** | JavaScript, HTML5, CSS3 |
| **Firmware Programming Library** | esptool-js v0.6.1 |
| **Browser API** | Web Serial API |
| **Firmware Ecosystems** | ESP-IDF, Arduino-ESP32 |
| **Target MCU** | Espressif ESP32 family (10 chip mappings; ESP32, ESP32-C3, ESP32-S3 hardware-tested) |
| **Frontend Architecture** | Static HTML/CSS/JavaScript; no framework required |
| **Hosting** | Firebase Hosting |
| **Deployment Tools** | Firebase CLI, Node.js, npm |
| **Version Control** | Git, GitHub |

### Software Architecture / โครงสร้างซอฟต์แวร์

- **Frontend:** `index.html` structures the interface; `style.css` provides the dark theme. / แยกโครงสร้างหน้าเว็บและ Style
- **Application logic:** `flash.js` contains the current Web Serial, programming, analysis, backup, monitoring, and factory logic. / Logic หลักรวมใน `flash.js`
- **Device transport:** esptool-js communicates with the target through Web Serial. / ใช้ esptool-js ติดต่อ MCU ผ่าน Web Serial
- **Deployment:** Firebase serves the static assets; serial operations run locally inside the browser. / Firebase ให้บริการหน้าเว็บ ส่วน USB ทำงานบนเครื่องผู้ใช้

---

## 🏗️ System Architecture / สถาปัตยกรรมระบบ

```text
                Firebase Hosting (HTTPS)
                          │
                          ▼
                    Browser UI
             index.html + style.css
                          │
                          ▼
                       flash.js
          ┌───────────────┼─────────────────┐
          │               │                 │
    Firmware Tools   Device Utilities   Factory Stations
    Inspect / Flash  Erase / Backup     Multi-device Flash
    Verify           Serial Monitor     Erase / Report
          └───────────────┼─────────────────┘
                          │
                       esptool-js
                          │
                    Web Serial API
                          │
                       USB Serial
                          │
                   ESP32 / ESP32-C3 / ESP32-S3
```

**Important distinction / ข้อควรทราบ:** Firebase hosts the frontend but does not access the USB hardware. The user's browser communicates directly with the connected ESP device. / Firebase ไม่ได้ติดต่อ USB โดยตรง Browser บนเครื่องผู้ใช้เป็นส่วนที่ติดต่อกับ MCU

---

## 📁 Repository Structure / โครงสร้างโปรเจกต์

```text
web_flasher_esp32_1.0.0/
├── .firebase/               # Local Firebase CLI cache (not source)
├── public/
│   ├── 404.html             # Hosting error page
│   ├── flash.js             # Main application logic
│   ├── index.html           # Web interface
│   └── style.css            # Dark theme and UI styles
├── .firebaserc              # Firebase project association
├── .gitignore               # Git ignore rules
├── firebase.json            # Firebase Hosting configuration
└── README.md                # Project documentation
```

**Source of truth / ไฟล์หลัก:** The web application currently keeps its core JavaScript logic in `public/flash.js`. The `.firebase/` directory is generated cache data and ordinarily should not be committed. / โค้ดหลักอยู่ที่ `public/flash.js` ส่วน `.firebase/` เป็น Cache ที่สร้างโดย CLI

---

## 🛠️ Installation & Local Development / การติดตั้งและทดสอบในเครื่อง

### Prerequisites / สิ่งที่ต้องใช้

- Google Chrome or Microsoft Edge with Web Serial support. / Browser ที่รองรับ Web Serial
- USB serial driver compatible with the target board, if needed. / Driver ของบอร์ดตามความจำเป็น
- Python 3 or another static HTTP server for local testing. / โปรแกรมเปิด Local Web Server
- Node.js, npm, and Firebase CLI only for Firebase deployment. / ใช้เครื่องมือ Firebase เมื่อจะ Deploy

### 1. Clone the repository / ดึงโปรเจกต์

```bash
git clone <YOUR_REPOSITORY_URL>
cd web_flasher_esp32_1.0.0
```

Replace `<YOUR_REPOSITORY_URL>` with the actual repository URL. / แทน URL ด้วย Repository จริง

### 2. Run locally / เปิด Local Server

```bash
cd public
python -m http.server 5500
```

Open `http://localhost:5500` in a compatible browser. VS Code Live Server can also serve the `public/` directory. / เปิดเว็บไซต์ผ่าน localhost หรือ Live Server ใน VS Code

> **Dependency note / หมายเหตุ:** The current application imports esptool-js from a CDN. An internet connection may be required to load that dependency unless it is later bundled locally. / หากใช้ CDN ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อโหลด Library

---

## 🔌 Device Connection & Flashing / การเชื่อมต่อและ Flash Firmware

1. Connect the ESP board using a USB data cable. / ต่อบอร์ดเข้าคอมพิวเตอร์ด้วยสาย USB
2. Open the web page using HTTPS or localhost. / เปิดเว็บผ่าน HTTPS หรือ localhost
3. Click **Connect** and choose the correct device in the browser's serial device picker. / เลือกอุปกรณ์ในหน้าต่าง Browser
4. Wait for chip identification. / รออ่านข้อมูล MCU
5. Select the appropriate firmware binary file(s). / เลือกไฟล์ Firmware
6. Inspect firmware and confirm compatible flash addresses. / ตรวจสอบ Firmware และ Address
7. Start flashing and allow verification and reset to finish. / เริ่ม Flash และรอ Verify/Reset

**Firmware image caution / ข้อควรระวัง:** ESP-IDF and Arduino builds may use different image arrangements and offsets. Always use the flash layout generated for your target board and build. / Firmware แต่ละ Build อาจมีตำแหน่ง Flash แตกต่างกัน ควรตรวจสอบให้ตรงกับบอร์ดเสมอ

---

## 🏭 Factory Multi-device / ระบบ Flash หลายอุปกรณ์

Factory mode allows multiple serial devices to be registered as separate stations. All stations use the selected firmware files, while each device is identified and validated independently.

Factory Mode สามารถเพิ่มอุปกรณ์หลายตัวเป็น Station แยกกัน โดยเลือก Firmware ชุดเดียวกัน และตรวจสอบรุ่น MCU ของแต่ละ Station ก่อนทำงาน

### Factory Workflow / ลำดับการทำงาน

```text
Add USB Devices
       │
       ▼
Register Stations
       │
       ▼
Select Firmware
       │
       ▼
Identify Each Chip
       │
       ▼
Check Compatibility ── Unsupported ──> NO SUPPORT
       │
       ▼
Flash / Verify / Reset
       │
       ├── Success ────────────────> PASS
       └── Failure ────────────────> FAIL
       │
       ▼
Factory Summary & Report Export
```

### Factory Controls / คำสั่ง Factory

| Control | Function / หน้าที่ |
| --- | --- |
| **Add USB Device** | Register a station / เพิ่ม Station |
| **Clear Devices** | Clear the station list / ล้างรายการอุปกรณ์ |
| **Flash All Devices** | Run factory firmware programming / Flash ทุก Station |
| **Erase All Devices** | Erase registered devices after confirmation / Erase ทุก Station หลังยืนยัน |
| **Export Factory Report** | Export result records / ส่งออก Report |

**Port labels / ชื่อพอร์ต:** Browsers can show Windows COM names in the permission dialog, but the standard Web Serial API does not expose `COM7`/`COM8`/etc. directly. The application's `PORT 1`, `PORT 2` labels identify station order, not verified Windows COM numbers. Available USB VID/PID values may be displayed. / `PORT 1`, `PORT 2` เป็นชื่อ Station ภายในเว็บ ไม่ใช่เลข COM ของ Windows

---

## 💾 Flash Backup & Erase / สำรองและลบข้อมูล Flash

- **Backup:** Read a selected flash region into a binary file. Chunked reads and retry handling improve resilience. / อ่าน Flash เป็นไฟล์ BIN โดยแบ่ง Chunk และ Retry
- **Default backup region:** 4 MiB, subject to the UI selection and device limitations. / ค่าเริ่มต้น 4 MiB สามารถปรับตามเครื่องมือและข้อจำกัดอุปกรณ์
- **Erase:** Remove flash contents on the selected device or registered factory devices. / ลบ Flash ทั้งเครื่องเดี่ยวหรือ Factory

> **Security notice / ข้อควรระวัง:** Flash backups may contain NVS data, Wi-Fi credentials, keys, and configuration. Flash encryption or security settings can prevent full or meaningful reads. Erasing flash is destructive. / ไฟล์ Backup อาจมีข้อมูลลับ และการ Erase ทำให้ข้อมูลถูกลบ

---

## 🖥️ Serial Monitor / หน้าต่างดูข้อมูล Serial

The integrated monitor displays data from a selected serial device at the configured baud rate. Starting the monitor ends the active esptool flashing session; reconnect before flashing again.

Serial Monitor แสดงข้อมูลจากอุปกรณ์ตาม Baud Rate ที่เลือก โดยการเริ่ม Monitor จะสิ้นสุด Flash Session ปัจจุบัน หากต้องการ Flash อีกครั้งให้เชื่อมต่อใหม่

---

## ☁️ Firebase Hosting / การ Deploy เว็บไซต์

### 1. Install Firebase CLI / ติดตั้งเครื่องมือ

```bash
npm install -g firebase-tools
```

### 2. Login / เข้าสู่ระบบ

```bash
firebase login
```

### 3. Deploy / เผยแพร่เว็บไซต์

Run this command in the project root (where `firebase.json` is located). / รันที่ Root ของโปรเจกต์

```bash
firebase deploy --only hosting
```

The existing `firebase.json` and `.firebaserc` contain the project's deployment configuration. / ใช้ Configuration ที่ตั้งค่าไว้แล้วในสองไฟล์ดังกล่าว

**Post-deployment check / ทดสอบหลัง Deploy:** Open the actual HTTPS URL and verify device selection, firmware inspection, flash/verify, serial monitor, and factory operations with suitable hardware. / ตรวจสอบการทำงานผ่าน URL จริงหลัง Deploy

---

## ⚠️ Browser Compatibility & Limitations / ข้อจำกัด

- The Web Serial API requires a supported browser and a secure context (HTTPS or localhost). / ต้องใช้ Browser ที่รองรับและ HTTPS หรือ localhost
- Users must grant access to each selected serial device. / ผู้ใช้ต้องอนุญาตสิทธิ์พอร์ต
- The browser does not reveal Windows COM port numbers via standard Web Serial device information. / ไม่สามารถอ่านเลข COM จริงจาก API มาตรฐาน
- USB driver, power, cable quality, and chip mode can affect programming reliability. / Driver สาย USB ไฟเลี้ยง และสถานะ MCU มีผลต่อการ Flash
- The set of supported chip families depends on esptool-js and application compatibility logic; ESP32 classic, ESP32-C3, and ESP32-S3 are hardware-tested, while seven additional mapped MCU families remain untested. / ทดสอบกับฮาร์ดแวร์จริงแล้ว 3 รุ่น ส่วนอีก 7 รุ่นมี Chip Mapping แต่ยังไม่ได้ทดสอบจริง
- Factory results should be verified against production-specific requirements before deployment. / งานผลิตจริงควรกำหนดขั้นตอนตรวจรับเพิ่มเติม

---

## 🧾 Changelog / บันทึกการเปลี่ยนแปลง

| Version | Date | Details / รายละเอียด |
| --- | --- | --- |
| **v1.0.0** | October 2026 | Initial ESP Web Firmware Flasher release: inspection, flash/verify, backup, serial monitor, factory multi-device flash/erase, reports and dark UI / รุ่นเริ่มต้นที่รวมฟังก์ชัน Flash และ Factory |

---

## 👨‍💻 Author / ผู้พัฒนา

**Pakprom Naennoi (Peace)**  
**GitHub:** [peacepaul1999](https://github.com/peacepaul1999)

---

## 📜 License / ใบอนุญาต

A project license has not been specified in the provided repository structure. Add a `LICENSE` file and update this section when a license is selected. / ยังไม่มีข้อมูลยืนยัน License ของ Repository นี้ กรุณาเพิ่มไฟล์ `LICENSE` และระบุเงื่อนไขเมื่อเลือกใบอนุญาตแล้ว

---

**ESP Web Firmware Flasher v1.0.0**  
*Browser-Based ESP Firmware Programming & Factory Multi-device Utility*
