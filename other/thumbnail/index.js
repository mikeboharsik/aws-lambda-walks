const fs = require('fs');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');

const canvas = createCanvas();

(async function(){
	const [, , val] = process.argv;
	if (!val.match(/(\d{2}:)*\d{2}:\d{2}/)) {
		throw new Error('Improperly formatted timestamp');
	}

	JsBarcode(canvas, val, { displayValue: false, margin: 0, width: 8, background: '#ffffff00' });

	const stream = canvas.createPNGStream();
	const barcodePath = `${__dirname}/gen/barcode.png`;
	const out = fs.createWriteStream(barcodePath);
	stream.pipe(out);
})();
