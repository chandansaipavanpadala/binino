from dataclasses import dataclass, asdict
from typing import List, Optional

@dataclass
class MCUProfile:
    mcu_id: str
    display_name: str
    family: str
    protocol: str
    ghidra_lang: str
    default_baud: int   # 0 if USB-only
    flash_base: int
    default_flash_size: int
    flash_sizes: List[int]
    bootloader_note: str
    requires_tool: Optional[str] = None
    read_protected: bool = False
    supported: bool = True

    def to_dict(self) -> dict:
        return asdict(self)

MCU_REGISTRY = {
    # ESPRESSIF
    "esp32": MCUProfile(
        mcu_id="esp32",
        display_name="ESP32 (Xtensa dual-core)",
        family="Espressif",
        protocol="SLIP",
        ghidra_lang="Xtensa:LE:32:default",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=4194304,
        flash_sizes=[1048576, 2097152, 4194304, 8388608, 16777216],
        bootloader_note="Hold the BOOT/GPIO0 button while establishing connection to force download mode."
    ),
    "esp32s2": MCUProfile(
        mcu_id="esp32s2",
        display_name="ESP32-S2 (Xtensa single)",
        family="Espressif",
        protocol="SLIP",
        ghidra_lang="Xtensa:LE:32:default",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=4194304,
        flash_sizes=[2097152, 4194304, 8388608, 16777216],
        bootloader_note="Connect GPIO0 to ground during power-up to force device into download mode."
    ),
    "esp32s3": MCUProfile(
        mcu_id="esp32s3",
        display_name="ESP32-S3 (Xtensa dual)",
        family="Espressif",
        protocol="SLIP",
        ghidra_lang="Xtensa:LE:32:default",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=8388608,
        flash_sizes=[4194304, 8388608, 16777216, 33554432],
        bootloader_note="Ensure GPIO0 is pulled low on boot to enter the native ROM bootloader."
    ),
    "esp32c3": MCUProfile(
        mcu_id="esp32c3",
        display_name="ESP32-C3 (RISC-V)",
        family="Espressif",
        protocol="SLIP",
        ghidra_lang="RISCV:LE:32:RV32GC",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=4194304,
        flash_sizes=[2097152, 4194304, 8388608],
        bootloader_note="RISC-V single-core. Trigger download mode using standard GPIO9 low reset sequence."
    ),
    "esp32c6": MCUProfile(
        mcu_id="esp32c6",
        display_name="ESP32-C6 (RISC-V)",
        family="Espressif",
        protocol="SLIP",
        ghidra_lang="RISCV:LE:32:RV32GC",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=4194304,
        flash_sizes=[2097152, 4194304, 8388608],
        bootloader_note="RISC-V core with Wi-Fi 6. Enter bootloader via GPIO9 low reset sequence."
    ),
    "esp32h2": MCUProfile(
        mcu_id="esp32h2",
        display_name="ESP32-H2 (RISC-V)",
        family="Espressif",
        protocol="SLIP",
        ghidra_lang="RISCV:LE:32:RV32GC",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=4194304,
        flash_sizes=[2097152, 4194304],
        bootloader_note="RISC-V Thread/Zigbee SoC. Hold BOOT (GPIO9) low on reset."
    ),
    "esp8266": MCUProfile(
        mcu_id="esp8266",
        display_name="ESP8266 (Xtensa)",
        family="Espressif",
        protocol="SLIP",
        ghidra_lang="Xtensa:LE:32:default",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=4194304,
        flash_sizes=[524288, 1048576, 2097152, 4194304, 8388608, 16777216],
        bootloader_note="Ground GPIO0 during reset to trigger the internal ROM bootloader."
    ),

    # AVR / ATMEL
    "atmega328p": MCUProfile(
        mcu_id="atmega328p",
        display_name="ATmega328P (Arduino Uno/Nano)",
        family="AVR",
        protocol="STK500v1",
        ghidra_lang="AVR8:LE:16:ATmega328P",
        default_baud=57600,
        flash_base=0x0,
        default_flash_size=32768,
        flash_sizes=[32768],
        bootloader_note="Uses Optiboot or standard Arduino bootloader. Automatic reset triggered via DTR line."
    ),
    "atmega2560": MCUProfile(
        mcu_id="atmega2560",
        display_name="ATmega2560 (Arduino Mega)",
        family="AVR",
        protocol="STK500v2",
        ghidra_lang="AVR8:LE:16:ATmega2560",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=262144,
        flash_sizes=[262144],
        bootloader_note="STK500v2 protocol. Connects at 115200 baud over virtual COM port."
    ),
    "atmega32u4": MCUProfile(
        mcu_id="atmega32u4",
        display_name="ATmega32U4 (Leonardo/Micro)",
        family="AVR",
        protocol="AVR109",
        ghidra_lang="AVR8:LE:16:ATmega32U4",
        default_baud=57600,
        flash_base=0x0,
        default_flash_size=32768,
        flash_sizes=[32768],
        bootloader_note="Requires a 1200-baud touch reset to activate the butterfly AVR109 bootloader."
    ),
    "attiny85": MCUProfile(
        mcu_id="attiny85",
        display_name="ATtiny85",
        family="AVR",
        protocol="STK500v1",
        ghidra_lang="AVR8:LE:16:ATtiny85",
        default_baud=19200,
        flash_base=0x0,
        default_flash_size=8192,
        flash_sizes=[8192],
        bootloader_note="Normally requires an AVR ISP programmer unless running the Micronucleus bootloader."
    ),
    "attiny45": MCUProfile(
        mcu_id="attiny45",
        display_name="ATtiny45",
        family="AVR",
        protocol="STK500v1",
        ghidra_lang="AVR8:LE:16:ATtiny45",
        default_baud=19200,
        flash_base=0x0,
        default_flash_size=4096,
        flash_sizes=[4096],
        bootloader_note="Normally requires an AVR ISP programmer connected over SPI."
    ),
    "atmega4809": MCUProfile(
        mcu_id="atmega4809",
        display_name="ATmega4809 (Nano Every)",
        family="AVR",
        protocol="UPDI",
        ghidra_lang="AVR8:LE:16:ATmega4809",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=49152,
        flash_sizes=[49152],
        bootloader_note="Unified Program and Debug Interface (UPDI). Requires an onboard UPDI-to-USB bridge chip."
    ),

    # STM32
    "stm32f1": MCUProfile(
        mcu_id="stm32f1",
        display_name="STM32F1xx (Blue Pill)",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=65536,
        flash_sizes=[65536, 131072],
        bootloader_note="Set BOOT0 jumper to high (1) and pulse RESET to activate system memory bootloader."
    ),
    "stm32f4": MCUProfile(
        mcu_id="stm32f4",
        display_name="STM32F4xx (Black Pill)",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=524288,
        flash_sizes=[524288, 1048576],
        bootloader_note="Press BOOT0 on power-up to enter built-in STM32 system bootloader."
    ),
    "stm32l0": MCUProfile(
        mcu_id="stm32l0",
        display_name="STM32L0xx",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=65536,
        flash_sizes=[32768, 65536, 131072],
        bootloader_note="Ultra-low power Cortex-M0+. Set BOOT0 High to launch ROM bootloader."
    ),
    "stm32l4": MCUProfile(
        mcu_id="stm32l4",
        display_name="STM32L4xx",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=262144,
        flash_sizes=[262144, 524288, 1048576],
        bootloader_note="Low-power Cortex-M4. Set BOOT0 High to launch system bootloader."
    ),
    "stm32g0": MCUProfile(
        mcu_id="stm32g0",
        display_name="STM32G0xx",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=131072,
        flash_sizes=[64512, 131072, 262144],
        bootloader_note="Configure BOOT0 pin / user options and reset to run ROM bootloader."
    ),
    "stm32g4": MCUProfile(
        mcu_id="stm32g4",
        display_name="STM32G4xx",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=262144,
        flash_sizes=[131072, 262144, 524288],
        bootloader_note="Analog Cortex-M4. Hold BOOT0 High and toggle reset to enter bootloader."
    ),
    "stm32h7": MCUProfile(
        mcu_id="stm32h7",
        display_name="STM32H7xx",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=1048576,
        flash_sizes=[1048576, 2097152],
        bootloader_note="Set BOOT0 to High and cycle power/reset to launch built-in system bootloader."
    ),
    "gd32f1": MCUProfile(
        mcu_id="gd32f1",
        display_name="GD32F103 (STM32 clone)",
        family="STM32",
        protocol="STM32-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=65536,
        flash_sizes=[65536, 131072, 262144],
        bootloader_note="GigaDevice STM32F103 clone. Compatible with standard STM32 AN3155 bootloader protocol."
    ),

    # RP-SERIES
    "rp2040": MCUProfile(
        mcu_id="rp2040",
        display_name="RP2040 (Raspberry Pi Pico)",
        family="RP-series",
        protocol="PICOTOOL",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=0,
        flash_base=0x10000000,
        default_flash_size=2097152,
        flash_sizes=[2097152, 4194304, 8388608, 16777216],
        bootloader_note="Hold the BOOTSEL button while plugging in to mount as USB MSD. Read using picotool or mount copy."
    ),
    "rp2350": MCUProfile(
        mcu_id="rp2350",
        display_name="RP2350 (Pico 2)",
        family="RP-series",
        protocol="PICOTOOL",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=0,
        flash_base=0x10000000,
        default_flash_size=4194304,
        flash_sizes=[4194304, 8388608, 16777216],
        bootloader_note="Hold the BOOTSEL button while plugging in to trigger USB bootloader."
    ),

    # SAMD
    "samd21": MCUProfile(
        mcu_id="samd21",
        display_name="SAMD21 (Arduino Zero, MKR)",
        family="SAMD",
        protocol="BOSSA",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=1200,
        flash_base=0x00000000,
        default_flash_size=262144,
        flash_sizes=[262144],
        bootloader_note="BOSSA Protocol. Resets to bootloader upon 1200 baud serial touch connection."
    ),
    "samd51": MCUProfile(
        mcu_id="samd51",
        display_name="SAMD51 (Adafruit M4)",
        family="SAMD",
        protocol="BOSSA",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=1200,
        flash_base=0x00000000,
        default_flash_size=524288,
        flash_sizes=[524288, 1048576],
        bootloader_note="BOSSA Protocol. Double tap Reset button to trigger bootloader mode."
    ),

    # NORDIC
    "nrf52840": MCUProfile(
        mcu_id="nrf52840",
        display_name="nRF52840",
        family="Nordic nRF",
        protocol="NRF-DFU",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=1048576,
        flash_sizes=[1048576],
        bootloader_note="Requires Nordic DFU/nrfjprog tool. Read protection must be disabled to dump.",
        requires_tool="nrfjprog"
    ),
    "nrf52833": MCUProfile(
        mcu_id="nrf52833",
        display_name="nRF52833",
        family="Nordic nRF",
        protocol="NRF-DFU",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=524288,
        flash_sizes=[524288],
        bootloader_note="Requires Nordic nrfjprog tools for extraction over SWD/serial.",
        requires_tool="nrfjprog"
    ),
    "nrf51822": MCUProfile(
        mcu_id="nrf51822",
        display_name="nRF51822",
        family="Nordic nRF",
        protocol="NRF-DFU",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=38400,
        flash_base=0x0,
        default_flash_size=262144,
        flash_sizes=[131072, 262144],
        bootloader_note="Older Bluetooth LE chip. Requires nrfjprog for SWD dumping.",
        requires_tool="nrfjprog"
    ),

    # NXP LPC
    "lpc1768": MCUProfile(
        mcu_id="lpc1768",
        display_name="LPC1768 (mbed)",
        family="NXP LPC",
        protocol="LPC-ISP",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=524288,
        flash_sizes=[524288],
        bootloader_note="NXP ISP mode over UART. Connect ISP pin to ground, pulse reset to enter."
    ),
    "lpc1114": MCUProfile(
        mcu_id="lpc1114",
        display_name="LPC1114 (M0)",
        family="NXP LPC",
        protocol="LPC-ISP",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=9600,
        flash_base=0x0,
        default_flash_size=32768,
        flash_sizes=[32768, 65536],
        bootloader_note="Synchronizes at 9600 baud using ASCII ISP commands."
    ),
    "lpc54608": MCUProfile(
        mcu_id="lpc54608",
        display_name="LPC54608",
        family="NXP LPC",
        protocol="LPC-ISP",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=524288,
        flash_sizes=[524288],
        bootloader_note="NXP ISP bootloader over UART. Assert ISP pins during boot."
    ),
    "mimxrt1060": MCUProfile(
        mcu_id="mimxrt1060",
        display_name="iMX RT1060 (T4.x)",
        family="NXP LPC",
        protocol="HID-DFU",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=0,
        flash_base=0x60000000,
        default_flash_size=2097152,
        flash_sizes=[2097152, 4194304, 8388608, 16777216],
        bootloader_note="Teensy 4.x bootloader chip or NXP SDP mode over USB HID."
    ),

    # TI MSP430
    "msp430g2": MCUProfile(
        mcu_id="msp430g2",
        display_name="MSP430G2",
        family="Texas Instruments MSP430",
        protocol="TI-BSL",
        ghidra_lang="TI_MSP430:LE:16:default",
        default_baud=9600,
        flash_base=0xC000,
        default_flash_size=16384,
        flash_sizes=[8192, 16384],
        bootloader_note="MSP430 Bootstrap Loader (BSL). Invoke by pulsing RST and TEST pins."
    ),
    "msp430f5": MCUProfile(
        mcu_id="msp430f5",
        display_name="MSP430F5xx",
        family="Texas Instruments MSP430",
        protocol="TI-BSL",
        ghidra_lang="TI_MSP430:LE:16:default",
        default_baud=9600,
        flash_base=0x8000,
        default_flash_size=131072,
        flash_sizes=[65536, 131072, 262144],
        bootloader_note="MSP430 5xx series BSL. Uses specialized BSL entry sequence on TEST/RST."
    ),
    "msp430fr5": MCUProfile(
        mcu_id="msp430fr5",
        display_name="MSP430FR5xx FRAM",
        family="Texas Instruments MSP430",
        protocol="TI-BSL",
        ghidra_lang="TI_MSP430:LE:16:default",
        default_baud=9600,
        flash_base=0x8000,
        default_flash_size=65536,
        flash_sizes=[32768, 65536, 131072],
        bootloader_note="MSP430 FRAM series BSL. FRAM requires no sector erasing before writes."
    ),

    # WCH
    "ch32v003": MCUProfile(
        mcu_id="ch32v003",
        display_name="CH32V003",
        family="WCH",
        protocol="WCH-ISP",
        ghidra_lang="RISCV:LE:32:RV32EC",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=16384,
        flash_sizes=[16384],
        bootloader_note="RISC-V CH32V003. Ground the BOOT0 pin during power-on to invoke UART bootloader."
    ),
    "ch32v203": MCUProfile(
        mcu_id="ch32v203",
        display_name="CH32V203",
        family="WCH",
        protocol="WCH-ISP",
        ghidra_lang="RISCV:LE:32:RV32GC",
        default_baud=115200,
        flash_base=0x08000000,
        default_flash_size=65536,
        flash_sizes=[65536, 131072, 262144],
        bootloader_note="RISC-V CH32V203. Hold BOOT0 high and reset to invoke WCH bootloader."
    ),
    "ch552": MCUProfile(
        mcu_id="ch552",
        display_name="CH552 (8051)",
        family="WCH",
        protocol="WCH-ISP",
        ghidra_lang="8051:BE:16:default",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=16384,
        flash_sizes=[16384],
        bootloader_note="8051-compatible CH552. Hold PROG button (USB D+ pull-up) while plugging in to invoke ISP."
    ),
    "ch554": MCUProfile(
        mcu_id="ch554",
        display_name="CH554 (8051)",
        family="WCH",
        protocol="WCH-ISP",
        ghidra_lang="8051:BE:16:default",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=16384,
        flash_sizes=[16384],
        bootloader_note="8051-compatible CH554. Hold PROG button (USB D+ pull-up) while plugging in to invoke ISP."
    ),

    # MICROCHIP PIC
    "pic16f": MCUProfile(
        mcu_id="pic16f",
        display_name="PIC16F",
        family="Microchip PIC",
        protocol="ICSP",
        ghidra_lang="PIC:LE:16:default",
        default_baud=0,
        flash_base=0x0,
        default_flash_size=14336,
        flash_sizes=[14336, 28672],
        bootloader_note="PIC16F requires ICSP (In-Circuit Serial Programming) using PICkit or ICD programmer.",
        requires_tool="pickit"
    ),
    "pic18f": MCUProfile(
        mcu_id="pic18f",
        display_name="PIC18F",
        family="Microchip PIC",
        protocol="ICSP",
        ghidra_lang="PIC:LE:16:default",
        default_baud=0,
        flash_base=0x0,
        default_flash_size=32768,
        flash_sizes=[32768, 65536, 131072],
        bootloader_note="PIC18F requires ICSP using PICkit or compatible programmer.",
        requires_tool="pickit"
    ),
    "pic32mx": MCUProfile(
        mcu_id="pic32mx",
        display_name="PIC32MX (MIPS)",
        family="Microchip PIC",
        protocol="ICSP",
        ghidra_lang="MIPS:LE:32:micro",
        default_baud=0,
        flash_base=0x1FC00000,
        default_flash_size=524288,
        flash_sizes=[262144, 524288],
        bootloader_note="MIPS-based PIC32MX. Requires ICSP or ICD programmer.",
        requires_tool="pickit"
    ),

    # RENESAS
    "rl78": MCUProfile(
        mcu_id="rl78",
        display_name="Renesas RL78",
        family="Renesas",
        protocol="RENESAS-UART",
        ghidra_lang="RL78:LE:16:default",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=65536,
        flash_sizes=[32768, 65536, 131072],
        bootloader_note="RL78 Single-Wire UART bootloader. Requires dedicated tool or reset sequence."
    ),
    "rx65n": MCUProfile(
        mcu_id="rx65n",
        display_name="Renesas RX65N",
        family="Renesas",
        protocol="RENESAS-UART",
        ghidra_lang="RX:LE:32:default",
        default_baud=115200,
        flash_base=0xFFE00000,
        default_flash_size=1048576,
        flash_sizes=[1048576, 2097152],
        bootloader_note="Renesas RX65N Boot Mode over UART interface."
    ),
    "ra4m1": MCUProfile(
        mcu_id="ra4m1",
        display_name="Renesas RA4M1",
        family="Renesas",
        protocol="RENESAS-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=262144,
        flash_sizes=[262144],
        bootloader_note="RA4M1 Cortex-M4 (Arduino UNO R4). Connect MD pin to ground during boot to enter SCI bootloader."
    ),

    # SILICON LABS
    "efm32gg": MCUProfile(
        mcu_id="efm32gg",
        display_name="EFM32 Giant Gecko",
        family="Silicon Labs EFM32",
        protocol="XMODEM-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=1048576,
        flash_sizes=[524288, 1048576],
        bootloader_note="Silicon Labs UART Bootloader. Responds to 'r' command with XMODEM-CRC firmware read."
    ),
    "efm32tg": MCUProfile(
        mcu_id="efm32tg",
        display_name="EFM32 Tiny Gecko",
        family="Silicon Labs EFM32",
        protocol="XMODEM-UART",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0,
        default_flash_size=32768,
        flash_sizes=[32768],
        bootloader_note="Silicon Labs UART Bootloader. Responds to 'r' command with XMODEM-CRC."
    ),

    # INFINEON
    "xmc1100": MCUProfile(
        mcu_id="xmc1100",
        display_name="XMC1100 (M0)",
        family="Infineon XMC",
        protocol="UART-BSL",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x10001000,
        default_flash_size=65536,
        flash_sizes=[65536],
        bootloader_note="Infineon bootstrap loader mode. Enabled via BMI configuration pins."
    ),
    "xmc4700": MCUProfile(
        mcu_id="xmc4700",
        display_name="XMC4700 (M4)",
        family="Infineon XMC",
        protocol="UART-BSL",
        ghidra_lang="ARM:LE:32:Cortex",
        default_baud=115200,
        flash_base=0x0C000000,
        default_flash_size=2097152,
        flash_sizes=[2097152],
        bootloader_note="Infineon bootstrap loader mode. Configure pins to boot from PSRAM/UART BSL."
    ),

    # GIGADEVICE
    "gd32vf103": MCUProfile(
        mcu_id="gd32vf103",
        display_name="GD32VF103 (Longan Nano)",
        family="GigaDevice RISC-V",
        protocol="DFU-USB",
        ghidra_lang="RISCV:LE:32:RV32IMAC",
        default_baud=0,
        flash_base=0x08000000,
        default_flash_size=131072,
        flash_sizes=[131072],
        bootloader_note="Hold BOOT0 High during boot to enter built-in DFU bootloader over USB."
    )
}
