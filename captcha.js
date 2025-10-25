"use strict";
/* DokuWiki BotMon Captcha JavaScript */
/* 23.10.2025 - 0.1.2 - pre-release */
/* Author: Sascha Leib <ad@hominem.info> */

const $BMCaptcha = {

	init: function() {
		/* mark the page to contain the captcha styles */
		document.getElementsByTagName('body')[0].classList.add('botmon_captcha');

		$BMCaptcha.install()
	},

	install: function() {
		// find the parent element:
		let bm_parent = document.getElementsByTagName('body')[0];

		// create the dialog:
		const dlg = document.createElement('dialog');
		dlg.setAttribute('closedby', 'none');
		dlg.setAttribute('open', 'open');
		dlg.classList.add('checking');
		dlg.id = 'botmon_captcha_box';
		dlg.innerHTML = '<h2>Captcha box</h2><p>Making sure you are a human:</p>';

		// Checkbox:
		const lbl = document.createElement('label');
		lbl.innerHTML = '<span class="confirm">Click to confirm.</span><span class="busy"></span><span class="checking">Checking&nbsp;&hellip;</span><span class="loading">Loading&nbsp;&hellip;</span><span class="erricon">&#65533;</span><span class="error">An error occured.</span>';
		const cb = document.createElement('input');
		cb.setAttribute('type', 'checkbox');
		cb.setAttribute('disabled', 'disabled');
		cb.addEventListener('click', $BMCaptcha._cbCallback);
		lbl.prepend(cb);

		dlg.appendChild(lbl);

		bm_parent.appendChild(dlg);

		// call the delayed callback in a couple of seconds:
		setTimeout($BMCaptcha._delayedCallback, 1500);
	},

	/* creates a digest hash for the cookie function */
	digest: {

		/* simple SHA hash function - adapted from https://geraintluff.github.io/sha256/ */
		hash: function(ascii) {

			// shortcut:
			const sha256 = $BMCaptcha.digest.hash;

			// helper function
			const rightRotate = function(v, a) {
				return (v>>>a) | (v<<(32 - a));
			};
			
			var mathPow = Math.pow;
			var maxWord = mathPow(2, 32);
			var lengthProperty = 'length'
			var i, j;
			var result = ''

			var words = [];
			var asciiBitLength = ascii[lengthProperty]*8;
			
			//* caching results is optional - remove/add slash from front of this line to toggle
			// Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
			// (we actually calculate the first 64, but extra values are just ignored)
			var hash = sha256.h = sha256.h || [];
			// Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
			var k = sha256.k = sha256.k || [];
			var primeCounter = k[lengthProperty];
			/*/
			var hash = [], k = [];
			var primeCounter = 0;
			//*/

			var isComposite = {};
			for (var candidate = 2; primeCounter < 64; candidate++) {
				if (!isComposite[candidate]) {
					for (i = 0; i < 313; i += candidate) {
						isComposite[i] = candidate;
					}
					hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
					k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
				}
			}
			
			ascii += '\x80' // Append Ƈ' bit (plus zero padding)
			while (ascii[lengthProperty]%64 - 56) ascii += '\x00' // More zero padding
			for (i = 0; i < ascii[lengthProperty]; i++) {
				j = ascii.charCodeAt(i);
				if (j>>8) return; // ASCII check: only accept characters in range 0-255
				words[i>>2] |= j << ((3 - i)%4)*8;
			}
			words[words[lengthProperty]] = ((asciiBitLength/maxWord)|0);
			words[words[lengthProperty]] = (asciiBitLength)
			
			// process each chunk
			for (j = 0; j < words[lengthProperty];) {
				var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
				var oldHash = hash;
				// This is now the undefinedworking hash", often labelled as variables a...g
				// (we have to truncate as well, otherwise extra entries at the end accumulate
				hash = hash.slice(0, 8);
				
				for (i = 0; i < 64; i++) {
					var i2 = i + j;
					// Expand the message into 64 words
					// Used below if 
					var w15 = w[i - 15], w2 = w[i - 2];

					// Iterate
					var a = hash[0], e = hash[4];
					var temp1 = hash[7]
						+ (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
						+ ((e&hash[5])^((~e)&hash[6])) // ch
						+ k[i]
						// Expand the message schedule if needed
						+ (w[i] = (i < 16) ? w[i] : (
								w[i - 16]
								+ (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3)) // s0
								+ w[i - 7]
								+ (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10)) // s1
							)|0
						);
					// This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
					var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
						+ ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2])); // maj
					
					hash = [(temp1 + temp2)|0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
					hash[4] = (hash[4] + temp1)|0;
				}
				
				for (i = 0; i < 8; i++) {
					hash[i] = (hash[i] + oldHash[i])|0;
				}
			}
			
			for (i = 0; i < 8; i++) {
				for (j = 3; j + 1; j--) {
					var b = (hash[i]>>(j*8))&255;
					result += ((b < 16) ? 0 : '') + b.toString(16);
				}
			}
			return result;
		}
	},

	_cbCallback: function(e) {
		if (e.target.checked) {
			//document.getElementById('botmon_captcha_box').close();

			try {
				var $status = 'loading';

				// generate the hash:
				const dat = [ // the data to encode
					document._botmon.seed || '',
					location.hostname,
					document._botmon.ip || '0.0.0.0',
					(new Date()).toISOString().substring(0, 10)
				];
				const hash = $BMCaptcha.digest.hash(dat.join('|'));

				// set the cookie:
				document.cookie = "DWConfirm=" + hash + ';path=/;';

			} catch (err) {
				console.error(err);
				$status = 'error';
			}

			// change the interface:
			const dlg = document.getElementById('botmon_captcha_box');
			if (dlg) {
				dlg.classList.remove('ready');
				dlg.classList.add( $status );
			}

			// reload the page:
			if ($status !== 'error')window.location.reload(true);
		}
	},

	_delayedCallback: function() {
		const dlg = document.getElementById('botmon_captcha_box');
		if (dlg) {
			dlg.classList.remove('checking');
			dlg.classList.add('ready');

			const input = dlg.getElementsByTagName('input')[0];
			if (input) {
				input.removeAttribute('disabled');
				input.focus();
			}
		}
	},

}
// initialise the captcha module:
$BMCaptcha.init();