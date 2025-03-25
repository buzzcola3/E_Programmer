import asyncio
import binascii
from jsonrpc import dispatcher
from flash_interface import SPIFlash
# block size for reading the SPI flash 32KB
READ_BLOCK_SIZE = 32 * 1024
WRITE_BLOCK_SIZE = 2 * 1024 # anything more seems unstable, why ?

# Create an instance of the flash class and register its methods with the JSON-RPC dispatcher.
flash = SPIFlash()

dispatcher.add_method(name="get_jedec_id", f=flash.get_jedec_id)
dispatcher.add_method(name="set_write_enable", f=flash.set_write_enable)
dispatcher.add_method(name="erase_all", f=flash.erase_all)
dispatcher.add_method(name="erase_suspend", f=flash.erase_suspend)
dispatcher.add_method(name="erase_resume", f=flash.erase_resume)
dispatcher.add_method(name="end_flash", f=flash.end_flash)
dispatcher.add_method(name="read_flash", f=flash.read_flash)
dispatcher.add_method(name="write_page", f=flash.write_page)
dispatcher.add_method(name="erase_sector", f=flash.erase_sector)
dispatcher.add_method(name="erase_32k_block", f=flash.erase_32k_block)
dispatcher.add_method(name="erase_64k_block", f=flash.erase_64k_block)
dispatcher.add_method(name="busy", f=flash.busy)

@dispatcher.add_method
def get_read_block_size(**kwargs):
    """
    Returns the block size for reading the flash memory.
    """
    return READ_BLOCK_SIZE

@dispatcher.add_method
def get_write_block_size(**kwargs):
    """
    Returns the block size for writing the flash memory.
    """
    return WRITE_BLOCK_SIZE

@dispatcher.add_method
def programmer_read_block(**kwargs):
    """
    Reads a block from flash memory based on the block_id keyword argument and
    returns the data as a base64 encoded string using ubinascii.
    
    Keyword Arguments:
      block_id (int): The block number to read. Defaults to 0.
      append_crc (bool): If True, attaches a CRC byte (sum modulo 256) to the end of the data.
    """
    block_id = kwargs.get('block_id', 0)
    append_crc = kwargs.get('append_crc', False)
    # Calculate the starting address for the given block_id using READ_BLOCK_SIZE.
    address = block_id * READ_BLOCK_SIZE
    data = flash.read_flash(address, READ_BLOCK_SIZE)
    print(f"Read {len(data)} bytes from block {block_id} at address {address:#010x}")
    if append_crc:
        crc = sum(data) % 256
        data += bytes([crc])
        print(f"Attached CRC byte: {crc:#04x}")
    # Convert bytes to base64 encoded string using ubinascii.
    # ubinascii.b2a_base64 returns a bytes object with a newline, so we strip() it.
    encoded_data = binascii.b2a_base64(data).strip().decode('utf-8')
    return encoded_data

@dispatcher.add_method
def programmer_write_block(**kwargs):
    """
    Writes a block to flash memory using the provided block_id and data,
    and returns the CRC of the written block. The data is split into pages
    based on the chip_page_size and written sequentially.

    Keyword Arguments:
      block_id (int): The block number to write (default is 0).
      data (str): A Base64 encoded string representing the data to write.
      crc (int, optional): Expected CRC value for verification. If provided, the
                           block is read back and its CRC is compared for consistency.
      chip_page_size (int): The size of each page in the chip for writing.

    Returns:
      str: A hexadecimal string representing the CRC of the written block.

    Raises:
      ValueError: If no data is provided or if the decoded data length
                  does not match WRITE_BLOCK_SIZE.
      Exception: If verification is enabled and the calculated CRC does not match the expected CRC.
    """
    block_id = kwargs.get('block_id', 0)
    data_b64 = kwargs.get('data')
    expected_crc = kwargs.get('crc', None)
    chip_page_size = kwargs.get('chip_page_size')

    if data_b64 is None:
        raise ValueError("No data provided for writing.")

    # Decode the base64 encoded string to bytes.
    try:
        data = binascii.a2b_base64(data_b64)
    except Exception as e:
        raise ValueError("Invalid base64 data provided.") from e

    # Ensure the data length matches the expected block size.
    if len(data) != WRITE_BLOCK_SIZE:
        raise ValueError(f"Data length ({len(data)}) does not match expected block size ({WRITE_BLOCK_SIZE}).")

    # Calculate the starting address based on the block_id.
    address = block_id * WRITE_BLOCK_SIZE

    # Write data in pages.
    for i in range(0, len(data), chip_page_size):
        flash.write_page(address + i, data[i:i+chip_page_size])

    print(f"Wrote {len(data)} bytes to block {block_id} at address {address:#010x}")

    # If an expected CRC was provided, verify by reading the block back.
    if expected_crc is not None:
        written_data = flash.read_flash(address, WRITE_BLOCK_SIZE)
        if expected_crc != sum(written_data) % 256:
            #print(f"expected_crc: {expected_crc}, calculated_crc: {sum(written_data) % 256}")
            #print(f"Block data: {written_data}")
            raise Exception(f"Verification failed for block {block_id}.")
        else:
            print(f"Verification succeeded for block {block_id}.")

    return hex(sum(data) % 256)

@dispatcher.add_method
def programmer_start_erase_chip(**kwargs):
    """
    Erases the entire flash memory chip.
    """
    flash.set_write_enable(True)
    flash.erase_all()

    return "Chip erase started."

@dispatcher.add_method
def programmer_erase_done(**kwargs):
    """
    Checks the status of the chip erase operation.
    """
    if flash.busy():
        return False
    else:
        flash.set_write_enable(False)
        
    return True