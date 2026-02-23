const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function atob_custom(input = '') {
    const str = input.replace(/=+$/, '');
    let output = '';

    if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }

    let bc = 0;
    let bs = 0;
    let buffer = 0;
    let i = 0;

    while (i < str.length) {
        buffer = chars.indexOf(str.charAt(i++));
        if (buffer === -1) continue;

        bs = bc % 4 ? bs * 64 + buffer : buffer;

        if (bc++ % 4) {
            output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
    }

    return output;
}

const payload = '["RT",1234,0,-12.3,4.5]\n';
const b64 = Buffer.from(payload).toString('base64');
console.log("Mock Android Bridge B64:", b64);

const decoded = atob_custom(b64);
console.log("Decoded:", decoded);

let rxBuffer = decoded;
if (rxBuffer.includes('\n')) {
    const parts = rxBuffer.split('\n');
    rxBuffer = parts.pop() || '';

    for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed) {
            if (trimmed.includes('[') && trimmed.includes(']')) {
                const startIdx = trimmed.indexOf('[');
                const endIdx = trimmed.lastIndexOf(']') + 1;
                const cleanJson = trimmed.substring(startIdx, endIdx);

                console.log("cleanJson:", cleanJson);
                const arr = JSON.parse(cleanJson);
                console.log("Parsed array:", arr);
            }
        }
    }
}
