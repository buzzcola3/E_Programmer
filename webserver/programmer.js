import { RPCCall, getRPCResponse } from './ws_manager.js'
import { base64ToUint8Array, uint8ArrayToBase64, fetchJsonFile } from './utils.js';

// Cached chip data to prevent multiple fetches.
let cachedChips = null;

/**
 * Retrieves chip data from the JSON file. Uses a cache to fetch the file only once.
 *
 * @param {boolean} [debug=false] - If true, outputs debug information.
 * @returns {Promise<Object>} Resolves to the chip data object.
 */
async function getChipsData(debug = false) {
  if (!cachedChips) {
    if (debug) {
      console.log("Fetching chip data from JSON file...");
    }
    const data = await fetchJsonFile('webserver/knows_chips.json');
    cachedChips = data || { parts: [] };
    if (debug) {
      console.log("Chip data fetched:", cachedChips);
    }
  } else if (debug) {
    console.log("Using cached chip data.");
  }
  return cachedChips;
}

/**
 * Uses the JSON-RPC method "get_jedec_id" (registered on the server side)
 * to fetch the JEDEC ID from the SPI flash chip and then detects a chip by 
 * matching the JEDEC ID against the known chips in "knows_chips.json".
 *
 * The JEDEC ID is expected to be a hexadecimal string (e.g., "ef4016"),
 * which is compared against the "jdec_id" field in the JSON (e.g., "0xef4016").
 *
 * @param {boolean} [debug=false] - If true, logs debug information.
 * @returns {Promise<Object|null>} Resolves to the matching chip object, or null if not found.
 */
export async function detectChipFromFlash(debug = false) {
  // Call the "get_jedec_id" JSON-RPC method on the server side.
  const rpcId = await RPCCall("get_jedec_id", {}, debug);
  const response = await getRPCResponse(rpcId, debug);
  // Expected result: a hex string such as "ef4016"
  const jedecId = response.payload.result;
  if (debug) {
    console.log("JEDEC ID from flash:", jedecId);
  }
  // Convert expected jdec_id format: "0x" + jedecId
  const formattedJedecId = "0x" + jedecId.toLowerCase();
  try {
    const data = await getChipsData(debug);
    const chip = data.parts.find(part =>
      part.jdec_id && part.jdec_id.toLowerCase() === formattedJedecId
    );
    if (debug) {
      if (chip) {
        console.log(`Detected chip: ${chip.manufacturer_name} ${chip.model}`);
      } else {
        console.log("Unknown chip");
      }
    }
    return chip || null;
  } catch (error) {
    if (debug) {
      console.error("Error fetching chip data:", error);
    }
    return null;
  }
}

/**
 * Retrieves a list of known chip models from the chip data.
 *
 * @param {boolean} [debug=false] - If true, logs debug information.
 * @returns {Promise<Array<string>>} Resolves to an array of chip model names.
 */
export async function getKnownChips(debug = false) {
  try {
    const data = await getChipsData(debug);
    const models = data.parts.map(part => part.model);
    if (debug) {
      console.log("Known chips:", models);
    }
    return models;
  } catch (error) {
    console.error("Error fetching chip data:", error);
    return [];
  }
}

/**
 * Gets the number of blocks for a given chip based on its capacity.
 *
 * @param {string} chipName - The model name of the chip.
 * @param {boolean} [for_read=false] - If true, retrieves the read block size.
 * @param {boolean} [debug=false] - If true, logs debug information.
 * @returns {Promise<number>} Resolves to the number of blocks.
 */
export async function getNumberOfBlocksForChip(chipName, for_read, debug = false) {
  // Retrieve known chip data from cache.
  const data = await getChipsData(debug);
  const chip = data.parts.find(part => part.model === chipName);
  if (!chip) {
    if (debug) {
      console.error(`Chip ${chipName} not found in known chips data.`);
    }
    throw new Error(`Chip ${chipName} not found.`);
  }
  const total_size = chip.capacity;  // use capacity as total_size
  if (debug) {
    console.log(`Chip ${chipName} capacity: ${total_size}`);
  }

  // Obtain block size via JSON-RPC.
  let id;
  if (for_read) {
    id = await RPCCall("get_read_block_size", { }, debug);
  } else {
    id = await RPCCall("get_write_block_size", { }, debug);
  }

  const response = await getRPCResponse(id, debug);
  // Calculate the number of blocks as the total chip capacity divided by the block size.
  const blockSize = response.payload.result;
  if (debug) {
    console.log(`Block size for chip ${chipName}:`, blockSize);
    console.log(`Number of blocks for chip ${chipName}:`, total_size / blockSize);
  }
  return total_size / blockSize;
}

/**
 * Retrieves the block size from the flash chip using the "get_read_block_size" RPC call.
 *
 * @param {boolean} [debug=false] - If true, outputs debug information.
 * @returns {Promise<number>} The block size in bytes.
 * @throws {Error} If the block size cannot be retrieved.
 */
export async function getBlockSize(for_read ,debug = false) {
    try {
        let rpcIdBlockSize;
      if (for_read) {
        rpcIdBlockSize = await RPCCall("get_read_block_size", {}, debug);
      } else {
        rpcIdBlockSize = await RPCCall("get_write_block_size", {}, debug);
      }
      const respBlockSize = await getRPCResponse(rpcIdBlockSize, debug);
      const blockSize = Number(respBlockSize.payload.result);
      if (debug) {
        console.log(`Retrieved block size: ${blockSize} bytes.`);
      }
      return blockSize;
    } catch (error) {
      throw new Error(`Failed to retrieve block size: ${error.message}`);
    }
  }

/**
 * Generator function that reads each block of the chip data, optionally validating the CRC.
 *
 * For each block, if append_crc is true, the last byte is extracted as the CRC and compared
 * against the calculated sum of the preceding bytes. If the CRC validation passes, the block
 * data (excluding the CRC) is yielded. Otherwise, the function retries reading the block up
 * to 3 times before throwing an error.
 *
 * @param {string} chipName - The model name of the chip.
 * @param {boolean} [append_crc=true] - Indicates whether to validate and strip the CRC byte.
 * @param {boolean} [debug=false] - If true, logs debug information.
 * @yields {Uint8Array} The data of each block (with the CRC removed if append_crc is true).
 * @throws {Error} If the block fails to be read correctly after 3 attempts.
 */
export async function* readChipBlocks(chipName, append_crc = true, debug = false) {
  const num_blocks = await getNumberOfBlocksForChip(chipName, true, debug);
  if (debug) {
    console.log(`Reading ${num_blocks} block(s) from chip ${chipName}`);
  }
  // For each block, read and yield its data after CRC validation.
  for (let i = 0; i < num_blocks; i++) {
    let valid = false;
    let blockData;
    let attempts = 0;
    while (!valid && attempts < 3) {
      attempts++;
      if (debug) {
        console.log(`Reading block ${i}, attempt ${attempts}...`);
      }
      try {
        const rpcId = await RPCCall("programmer_read_block", { block_id: i, append_crc: append_crc }, debug);
        const resp = await getRPCResponse(rpcId, debug);
        blockData = base64ToUint8Array(resp.payload.result);
      } catch (error) {
        if (debug) {
          console.error(`RPC error on block ${i}, attempt ${attempts}:`, error);
        }
        continue;
      }
      if (append_crc) {
        const crc = blockData[blockData.length - 1];
        const sum = blockData.slice(0, -1).reduce((a, b) => a + b, 0) % 256;
        if (crc === sum) {
          valid = true;
          if (debug) {
            console.log(`Block ${i} CRC valid: ${crc}`);
          }
        } else {
          if (debug) {
            console.warn(`CRC error in block ${i}, attempt ${attempts}: expected ${sum}, got ${crc}.`);
          }
        }
      } else {
        valid = true;
      }
    }
    if (!valid) {
      throw new Error(`Failed to read block ${i} after 3 attempts.`);
    }
    yield append_crc ? blockData.slice(0, -1) : blockData;
  }
}


function generateIncrementalUint8Array(size) {
    const arr = new Uint8Array(size);
    if (size > 0) {
      arr[0] = 0xFF;
    }
    for (let i = 1; i < size; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }

/**
 * Async generator function that writes each block of the chip data using the
 * "programmer_write_block" RPC call, yielding the block index for each written block.
 *
 * The provided fileData must be a Uint8Array whose length is an exact multiple of the block size
 * retrieved via the getBlockSize function.
 *
 * @param {Uint8Array} fileData - The complete chip data to write.
 * @param {boolean} [verify=false] - If true, verifies each written block after writing.
 * @param {boolean} [debug=false] - If true, outputs debug information.
 * @yields {number} The index of each successfully written block.
 * @throws {Error} If the data length is not a multiple of the block size or any block fails to write after 3 attempts.
 */
export async function* writeChipBlocks(chipName, fileData, verify = false, debug = false) {
    const BLOCK_SIZE = await getBlockSize(false, debug);
  
    if (fileData.byteLength % BLOCK_SIZE !== 0) {
      throw new Error(`Data length (${fileData.byteLength}) is not a multiple of block size (${BLOCK_SIZE}).`);
    }
    
    const numBlocks = fileData.byteLength / BLOCK_SIZE;
    if (debug) {
      console.log(`Writing ${numBlocks} block(s) to flash with block size=${BLOCK_SIZE} bytes.`);
    }

    const data = await getChipsData(debug);
    const chip = data.parts.find(part => part.model === chipName);

    const pageSize = chip.page_size
    if (debug) {
        console.log(`Chip ${chipName} page size: ${pageSize}`);
    }
    
    for (let blockId = 0; blockId < numBlocks; blockId++) {
      const start = blockId * BLOCK_SIZE;
      const end = start + BLOCK_SIZE;
      const blockData = fileData.slice(start, end);
      const blockDataB64 = uint8ArrayToBase64(blockData);
      
      let attempts = 0;
      let written = false;
      let resp;
      
      while (!written && attempts < 3) {
        attempts++;
        if (debug) {
          console.log(`Writing block ${blockId}, attempt ${attempts}...`);
        }
        try {
          const crc = blockData.reduce((a, b) => a + b, 0) % 256;
          const rpcId = await RPCCall("programmer_write_block", { block_id: blockId, chip_page_size: pageSize, data: blockDataB64, crc: crc }, debug);
          resp = await getRPCResponse(rpcId, debug);
          written = true;
          if (debug) {
            console.log(`Block ${blockId} written successfully with CRC: ${resp.payload.result}`);
          }
        } catch (error) {
          if (debug) {
            console.error(`Error writing block ${blockId}, attempt ${attempts}:`, error);
          }
        }
      }
      
      if (!written) {
        throw new Error(`Failed to write block ${blockId} after 3 attempts.`);
      }
      
      yield blockId;
    }
  }

export async function startEraseChip(debug = false) {
    const rpcId = await RPCCall("programmer_start_erase_chip", {}, debug);
    const response = await getRPCResponse(rpcId, debug);
    return response.payload.result;
}

export async function getEraseDone(debug = false) {
    const rpcId = await RPCCall("programmer_erase_done", {}, debug);
    const response = await getRPCResponse(rpcId, debug);
    return response.payload.result; 
}