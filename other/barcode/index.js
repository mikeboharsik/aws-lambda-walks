const fs = require('fs');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');
const child_process = require('child_process');

const canvas = createCanvas();

(async function(){
	const [, , val] = process.argv;
	JsBarcode(canvas, val, { displayValue: false, margin: 0, width: 8, background: '#ffffff00' });

	const stream = canvas.createPNGStream();
	const barcodePath = `${__dirname}/barcode.png`;
	const out = fs.createWriteStream(barcodePath);
	stream.pipe(out);

	child_process.spawnSync('start', [barcodePath]);
})();
