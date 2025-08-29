/* DokuWiki Monitor Plugin Script file */
/* 29.08.2025 - 1.0.5 - initial release */
/* Authors: Sascha Leib <ad@hominem.info> */

const Monitor = {

	init: function() {
		//console.info('Monitor.init()');

		// find the plugin basedir:
		this._baseDir = document.currentScript.src.substring(0, document.currentScript.src.indexOf('/exe/'))
			+ '/plugins/monitor/';

		// read the page language from the DOM:
		this._lang = document.getRootNode().documentElement.lang || this._lang;

		// get the time offset:
		this._timeDiff = Monitor.t._getTimeOffset();

		// init the sub-objects:
		Monitor.t._callInit(this);
	},

	_baseDir: null,
	_lang: 'en',
	_today: (new Date()).toISOString().slice(0, 10),
	_timeDiff: '',

	/* internal tools */
	t: {

		/* helper function to call inits of sub-objects */
		_callInit: function(obj) {
			//console.info('Monitor.t._callInit(obj=',obj,')');

			/* call init / _init on each sub-object: */
			Object.keys(obj).forEach( (key,i) => {
				const sub = obj[key];
				let init = null;
				if (typeof sub === 'object' && sub.init) {
					init = sub.init;
				}

				// bind to object
				if (typeof init == 'function') {
					const init2 = init.bind(sub);
					init2(obj);
				}
			});
		},

		/* helper function to calculate the time difference to UTC: */
		_getTimeOffset: function() {
			const now = new Date();
			let offset = now.getTimezoneOffset(); // in minutes
			const sign = Math.sign(offset); // +1 or -1
			offset = Math.abs(offset); // always positive

			let hours = 0;
			while (offset >= 60) {
				hours += 1;
				offset -= 60;
			}
			return ( hours > 0 ? sign * hours + ' h' : '') + (offset > 0 ? ` ${offset} min` : '');
		}
	}
};

/* everything specific to the "Today" tab is self-contained here: */
Monitor.today = {
	init: function() {
		//console.info('Monitor.today.init()');

		// set the title:
		const tDiff = (Monitor._timeDiff != '' ? ` (${Monitor._timeDiff})` : ' (<abbr>UTC</abbr>)' );
		Monitor.today.status.setTitle(`Showing visits for <time datetime=${Monitor._today}>${Monitor._today}</time>${tDiff}`);

		// init sub-objects:
		Monitor.t._callInit(this);
	},

	data: {
		init: function() {
			//console.info('Monitor.today.data.init()');

			// call sub-inits:
			Monitor.t._callInit(this);

			// load the first log file:
			Monitor.today.data.loadLogFile('srv');
		},

		bots: {
			// loads the list of known bots from a JSON file:
			init: async function() {
				//console.info('Monitor.today.data.bots.init()');

				// Load the list of known bots:
				Monitor.today.status.showBusy("Loading known bots&nbsp;&hellip;");
				const url = Monitor._baseDir + 'data/known-bots.json';

				console.log(url);
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					Monitor.today.data.bots._list = await response.json();
					Monitor.today.data.bots._ready = true;

					// TODO: allow using the bots list...
				} catch (error) {
					Monitor.today.status.setError("Error while loading the ’known bots’ file: " + error.message);
				} finally {
					Monitor.today.status.hideBusy("Done.");
				}
			},

			// returns bot info if the clientId matches a known bot, null otherwise:
			match: function(clientId) {

			// TODO!
			},

			// indicates if the list is loaded and ready to use:
			_ready: false,

			// the actual bot list is stored here:
			_list: []
		},

		loadLogFile: async function(type) {
			console.info('Monitor.today.data.loadLogFile(',type,')');

			let typeName = '';
			let columns = [];

			switch (type) {
				case "srv":
					typeName = "Server";
					columns = ['ts','ip','pg','id','usr','client'];
					break;
				break;
				case "log":
					typeName = "Page load";
					columns = ['ts','ip','pg','id','usr'];
					break;
				case "tck":
					typeName = "Ticker";
					columns = ['ts','ip','pg','id'];
					break;
				default:
					console.warn(`Unknown log type ${type}.`);
					return;
			}

			// Load the list of known bots:
			Monitor.today.status.showBusy(`Loading ${typeName} log file &nbsp;&hellip;`);

			const url = Monitor._baseDir + `logs/${Monitor._today}.${type}`;
			console.log("Loading:",url);

			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`${response.status} ${response.statusText}`);
				}

				const events = await response.text();
				console.log(events);
				//Monitor.today.data.serverEvents._ready = true;

				// TODO: parse the file...
			} catch (error) {
				Monitor.today.status.setError(`Error while loading the ${typeName} log file: ${error.message}.`);
			} finally {
				Monitor.today.status.hideBusy("Done.");
			}
		}
	},

	status: {
		setText: function(txt) {
			const el = document.getElementById('monitor__today__status');
			if (el && Monitor.today.status._errorCount <= 0) {
				el.innerText = txt;
			}
		},

		setTitle: function(html) {
			const el = document.getElementById('monitor__today__title');
			if (el) {
				el.innerHTML = html;
			}
		},

		setError: function(txt) {
			console.error(txt);
			Monitor.today.status._errorCount += 1;
			const el = document.getElementById('monitor__today__status');
			if (el) {
				el.innerText = "An error occured. See the browser log for details!";
				el.classList.add('error');
			}
		},
		_errorCount: 0,

		showBusy: function(txt = null) {
			Monitor.today.status._busyCount += 1;
			const el = document.getElementById('monitor__today__busy');
			if (el) {
				el.style.display = 'inline-block';
			}
			if (txt) Monitor.today.status.setText(txt);
		},
		_busyCount: 0,

		hideBusy: function(txt = null) {
			const el = document.getElementById('monitor__today__busy');
			Monitor.today.status._busyCount -= 1;
			if (Monitor.today.status._busyCount <= 0) {
				if (el) el.style.display = 'none';
				if (txt) Monitor.today.status.setText(txt);
			}
		}
	}
};

/* check if the nustat admin panel is open: */
if (document.getElementById('monitor__admin')) {
	Monitor.init();
}