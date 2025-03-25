/**
 * Joins two Uint8Array objects into a single new Uint8Array.
 *
 * @param {Uint8Array} arr1 - The first Uint8Array.
 * @param {Uint8Array} arr2 - The second Uint8Array.
 * @returns {Uint8Array} A new Uint8Array containing the contents of arr1 followed by arr2.
 */
export function joinUint8Arrays(arr1, arr2) {
    // Create a new Uint8Array with the combined length of arr1 and arr2.
    const result = new Uint8Array(arr1.length + arr2.length);
    // Set the first part of the result to arr1.
    result.set(arr1, 0);
    // Set the next part of the result to arr2.
    result.set(arr2, arr1.length);
    return result;
  }

/**
 * Converts a base64 encoded string to a Uint8Array.
 *
 * @param {string} base64Str - The base64 encoded string.
 * @returns {Uint8Array} The resulting Uint8Array of bytes.
 */
export function base64ToUint8Array(base64Str) {
    const binaryStr = atob(base64Str);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

/**
 * Converts a Uint8Array to a base64 encoded string.
 *
 * @param {Uint8Array} uint8Array - The Uint8Array to convert.
 * @returns {string} The resulting base64 encoded string.
 */
export function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary);
}

/**
 * Triggers a download of a Uint8Array as a file.
 *
 * @param {Uint8Array} uint8Data - The data to be downloaded.
 * @param {string} [filename='dump.bin'] - The filename for the downloaded file.
 * @param {string} [mime='application/octet-stream'] - The MIME type of the file.
 */
export function triggerUint8Download(uint8Data, filename = 'dump.bin', mime = 'application/octet-stream') {
    const blob = new Blob([uint8Data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
 * Triggers a file upload dialog and returns the selected file's content as a Uint8Array.
 *
 * @returns {Promise<Uint8Array>} Resolves to the Uint8Array data of the selected file.
 * @throws {Error} If no file is selected or an error occurs during file reading.
 */
export function triggerUint8Upload() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = "file";
    input.accept = "*/*";
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      if (input.files.length === 0) {
        document.body.removeChild(input);
        return reject(new Error("No file selected."));
      }
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = () => {
        const arrayBuffer = reader.result;
        resolve(new Uint8Array(arrayBuffer));
        document.body.removeChild(input);
      };
      
      reader.onerror = (error) => {
        document.body.removeChild(input);
        reject(error);
      };
      
      reader.readAsArrayBuffer(file);
    });

    input.click();
  });
}

/**
 * Fetches a JSON file from the given file path and returns its parsed contents.
 *
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<Object|null>} Resolves to the JSON object if successful, or null on error.
 */
export async function fetchJsonFile(filePath) {
    try {
      const res = await fetch(filePath);
      return await res.json();
    } catch (error) {
      console.error(`Error fetching JSON file (${filePath}):`, error);
      return null;
    }
  }