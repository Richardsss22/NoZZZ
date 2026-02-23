const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function atob_custom(input = '') {
    const str = input.replace(/=+$/, '');
    let output = '';
    if (str.length % 4 === 1) return '';
    let bc = 0, bs = 0, buffer = 0, i = 0;
    while (i < str.length) {
        buffer = chars.indexOf(str.charAt(i++));
        if (buffer === -1) continue;
        bs = bc % 4 ? bs * 64 + buffer : buffer;
        if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
    return output;
}

const arduinoJson = '{"pitch":-12.5,"roll":4.1,"yaw":0}';
const b64 = Buffer.from(arduinoJson).toString('base64');
console.log("Mock Base64 from Arduino:", b64);
const decoded = atob_custom(b64);
console.log("Decoded string:", decoded);
console.log("JSON Parsed:", JSON.parse(decoded.trim()));
