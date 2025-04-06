import { detectChipFromFlash, getKnownChips, readChipBlocks, writeChipBlocks, getNumberOfReceivePackets, getNumberOfTransmitPackets, startEraseChip, getEraseDone } from './programmer.js';

import { joinUint8Arrays, triggerUint8Download, triggerUint8Upload } from './utils.js';

const flash = document.getElementById('flash');
const dump = document.getElementById('dump');
const detect = document.getElementById('detect');
const chip = document.getElementById('chip');
const progressBar = document.querySelector('.progress-bar');
const log = document.querySelector('.log');
const erase = document.getElementById('erase');

const DEBUG = true;

flash.addEventListener('click', async () => {
    log.innerHTML = 'Flashing...';
    progressBar.style.width = '0%';
    try {
      const chipName = chip.value;
      // Trigger file upload to get the complete chip data as a Uint8Array.
      const fileData = await triggerUint8Upload();
      console.log('File data received:', fileData);
  
      const totalPackets = await getNumberOfReceivePackets(chipName, DEBUG)
      console.log(`Total blocks: ${totalPackets}`);
  
      let sentPackets = 0;
      // Use the writeChipBlocks async generator to write the chip data block by block.
      for await (const blockId of writeChipBlocks(chipName, fileData, true, DEBUG)) {
        sentPackets++;
        log.innerHTML += `.`;
        const progress = Math.floor((sentPackets / totalPackets) * 100);
        progressBar.style.width = `${progress}%`;
        console.log(`Block ${blockId} written; progress: ${progress}%`);
      }
  
      log.innerHTML = `Flashing complete: ${fileData.byteLength} bytes written.`;
      progressBar.style.width = '100%';
    } catch (error) {
      log.innerHTML = 'Error flashing chip data.';
      console.error(error);
      progressBar.style.width = '100%';
    }
  });


dump.addEventListener('click', async () => {
    log.innerHTML = 'Dumping...';
    progressBar.style.width = '0%';
    const chipName = chip.value;
    try {
      // Get total number of blocks for the selected chip.
      const totalBlocks = await getNumberOfTransmitPackets(chipName, DEBUG);
      console.log(`Total blocks: ${totalBlocks}`);

      let fullChipData = [];
      let blockIndex = 0;
      
      // Iterate over each block using the generator function.
      for await (const blockData of readChipBlocks(chipName, true, DEBUG)) {
        blockIndex++;
        fullChipData = joinUint8Arrays(fullChipData, blockData);
        
        // Calculate and update progress bar.
        const progress = Math.floor((blockIndex / totalBlocks) * 100);
        progressBar.style.width = `${progress}%`;
      }
      
      // Convert fullChipData array to a Uint8Array.
      const bytes = new Uint8Array(fullChipData);
      // Trigger download of the full chip data.
      triggerUint8Download(bytes, 'dump.bin', 'application/octet-stream');
      
      log.innerHTML = `Dump complete: ${fullChipData.length} bytes read and downloaded.`;
      progressBar.style.width = '100%';
    } catch (error) {
      log.innerHTML = 'Error dumping chip data.';
      console.error(error);
      progressBar.style.width = '100%';
    }
  });

erase.addEventListener('click', async () => {
    log.innerHTML = 'Erasing...';
    progressBar.style.width = '1%';
    startEraseChip(true, DEBUG);
    while (!getEraseDone(true, DEBUG)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      log.innerHTML += '.';
    }
    progressBar.style.width = '100%';
});

detect.addEventListener('click', async () => {
  log.innerHTML = 'Auto Detecting Chip...';
  var detectedChip = await detectChipFromFlash(DEBUG);
  log.innerHTML += detectedChip ? `Detected chip: ${detectedChip.manufacturer_name} ${detectedChip.model}` : 'Unknown chip';

  // if chip is detected, set the chip selector to the detected chip
  if (detectedChip) {
    chip.value = detectedChip.model;
  }
  progressBar.style.width = '100%';
});

// Populate chip selector
const chips = await getKnownChips(DEBUG);
console.log(chips);
chips.forEach(chipName => {
  const option = document.createElement('option');
  option.value = chipName;
  option.textContent = chipName;
  chip.appendChild(option);
});