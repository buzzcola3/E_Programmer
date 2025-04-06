import time
from machine import SPI, Pin

class SPIFlash:
    # COMMANDS with prefix (class attributes)
    CMD_W_EN        = 0x06  # write enable
    CMD_W_DE        = 0x04  # write disable
    CMD_R_SR1       = 0x05  # read status register 1
    CMD_R_SR2       = 0x35  # read status register 2
    CMD_W_SR        = 0x01  # write status register
    CMD_PAGE_PGM    = 0x02  # page program
    CMD_QPAGE_PGM   = 0x32  # quad input page program
    CMD_BLK_E_64K   = 0xD8  # block erase 64KB
    CMD_BLK_E_32K   = 0x52  # block erase 32KB
    CMD_SECTOR_E    = 0x20  # sector erase 4KB
    CMD_CHIP_ERASE  = 0xC7  # chip erase
    CMD_CHIP_ERASE2 = 0x60  # chip erase alternative command
    CMD_E_SUSPEND   = 0x75  # erase suspend
    CMD_E_RESUME    = 0x7A  # erase resume
    CMD_PDWN        = 0xB9  # power down
    CMD_HIGH_PERF_M = 0xA3  # high performance mode
    CMD_CONT_R_RST  = 0xFF  # continuous read mode reset
    CMD_RELEASE     = 0xAB  # release power down or HPM/Dev ID (deprecated)
    CMD_R_MANUF_ID  = 0x90  # read Manufacturer and Device ID (deprecated)
    CMD_R_UNIQUE_ID = 0x4B  # read unique ID (suggested)
    CMD_R_JEDEC_ID  = 0x9F  # read JEDEC ID = Manufacturer + ID (suggested)
    CMD_READ        = 0x03  # standard read
    CMD_FAST_READ   = 0x0B  # fast read

    # Status Register Masks with prefix
    MASK_SR1_BUSY = 0x01
    MASK_SR1_WEN  = 0x02

    def __init__(self, spi_bus: int = 1, baudrate: int = 1600000,
                 sck_pin: int = 14, mosi_pin: int = 13, miso_pin: int = 12,
                 cs_pin: int = 11):
        """
        Initialize the SPIFlash with optional SPI parameters.
        Defaults:
          spi_bus = 1,
          baudrate = 1600000,
          sck_pin = 14, mosi_pin = 13, miso_pin = 12,
          cs_pin = 11.
        """
        self.hspi = SPI(
            spi_bus,
            baudrate,
            sck=Pin(sck_pin),
            mosi=Pin(mosi_pin),
            miso=Pin(miso_pin)
        )
        self.cs = Pin(cs_pin, Pin.OUT)
        self.cs.value(1)  # Deselect device initially

    def spi_write(self, command, data=None):
        self.cs.value(0)  # Select device
        self.hspi.write(bytes([command]))
        if data is not None:
            self.hspi.write(data)
        self.cs.value(1)  # Deselect device

    def spi_read(self, command, nbytes):
        self.cs.value(0)  # Select device
        self.hspi.write(bytes([command]))
        result = self.hspi.read(nbytes)
        self.cs.value(1)  # Deselect device
        return result

    def get_jedec_id(self, **kwargs):
        """
        Detects the flash chip by reading its JEDEC ID.
        """
        self.spi_write(self.CMD_R_JEDEC_ID)
        jedec_id = self.spi_read(self.CMD_R_JEDEC_ID, 3)
        return jedec_id.hex()

    def set_write_enable(self, enable: bool, **kwargs):
        """
        Sets the flash chip write enable state.
        """
        self.hspi.write(bytes([self.CMD_W_EN if enable else self.CMD_W_DE]))

    def erase_all(self, **kwargs):
        """
        Erase the whole chip.
        """
        self.spi_write(self.CMD_CHIP_ERASE)

    def erase_suspend(self, **kwargs):
        """
        Suspend an ongoing erase operation.
        """
        self.spi_write(self.CMD_E_SUSPEND)

    def erase_resume(self, **kwargs):
        """
        Resume a suspended erase operation.
        """
        self.spi_write(self.CMD_E_RESUME)

    def end_flash(self, **kwargs):
        """
        Puts the flash chip into power-down mode.
        """
        self.cs.value(0)
        self.hspi.write(bytes([self.CMD_PDWN]))
        self.cs.value(1)
        time.sleep_us(4)  # >3us delay

    def read_flash(self, addr: int, n: int, **kwargs):
        """
        Reads 'n' bytes from flash starting at address 'addr'.
        """
        self.cs.value(0)
        self.hspi.write(bytes([self.CMD_READ]))
        addr_bytes = addr.to_bytes(3, 'big')
        self.hspi.write(addr_bytes)
        data = self.hspi.read(n)
        self.cs.value(1)
        return data

    def write_page(self, addr_start: int, buf: bytes, **kwargs):
        """
        Writes a page starting at 'addr_start' with the content in 'buf'.
        """
        self.cs.value(0)
        self.set_write_enable(True)
        
        self.hspi.write(bytes([self.CMD_PAGE_PGM]))
        addr_bytes = addr_start.to_bytes(3, 'big')
        self.hspi.write(addr_bytes)
        self.hspi.write(buf)
        
        self.set_write_enable(False)
        self.cs.value(1)
        

    def erase_sector(self, addr_start: int, **kwargs):
        """
        Erases a 4KB sector starting at 'addr_start'.
        """
        self.cs.value(0)
        self.hspi.write(bytes([self.CMD_SECTOR_E]))
        addr_bytes = addr_start.to_bytes(3, 'big')
        self.hspi.write(addr_bytes)
        self.cs.value(1)

    def erase_32k_block(self, addr_start: int, **kwargs):
        """
        Erases a 32KB block starting at 'addr_start'.
        """
        self.cs.value(0)
        self.hspi.write(bytes([self.CMD_BLK_E_32K]))
        addr_bytes = addr_start.to_bytes(3, 'big')
        self.hspi.write(addr_bytes)
        self.cs.value(1)

    def erase_64k_block(self, addr_start: int, **kwargs):
        """
        Erases a 64KB block starting at 'addr_start'.
        """
        self.cs.value(0)
        self.hspi.write(bytes([self.CMD_BLK_E_64K]))
        addr_bytes = addr_start.to_bytes(3, 'big')
        self.hspi.write(addr_bytes)
        self.cs.value(1)

    def busy(self, **kwargs):
        """
        Checks if the flash chip is busy.
        """
        self.cs.value(0)
        self.hspi.write(bytes([self.CMD_R_SR1]))
        r1 = self.hspi.read(1)
        self.cs.value(1)
        return bool(r1[0] & self.MASK_SR1_BUSY)