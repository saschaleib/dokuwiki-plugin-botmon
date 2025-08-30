/* DokuWiki Monitor Plugin Script file */
/* 30.08.2025 - 0.1.5 - pre-release */
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

/* everything specific to the "Today" tab is self-contained in the "live" object: */
Monitor.live = {
	init: function() {
		//console.info('Monitor.live.init()');

		// set the title:
		const tDiff = '(<abbr title="Coordinated Universal Time">UTC</abbr>' + (Monitor._timeDiff != '' ? `, ${Monitor._timeDiff}` : '' ) + ')';
		Monitor.live.gui.status.setTitle(`Showing data for <time datetime=${Monitor._today}>${Monitor._today}</time> ${tDiff}`);

		// init sub-objects:
		Monitor.t._callInit(this);
	},

	data: {
		init: function() {
			//console.info('Monitor.live.data.init()');

			// call sub-inits:
			Monitor.t._callInit(this);
		},

		// this will be called when the known json files are done loading:
		_dispatch: function(file) {
			//console.info('Monitor.live.data._dispatch(,',file,')');

			// shortcut to make code more readable:
			const data = Monitor.live.data;

			// set the flags:
			switch(file) {
				case 'bots':
					data._dispatchBotsLoaded = true;
					break;
				case 'clients':
					data._dispatchClientsLoaded = true;
					break;
				case 'platforms':
					data._dispatchPlatformsLoaded = true;
					break;
				default:
					// ignore
			}

			// are all the flags set?
			if (data._dispatchBotsLoaded && data._dispatchClientsLoaded && data._dispatchPlatformsLoaded) {
				// chain the log files loading:
				Monitor.live.data.loadLogFile('srv', Monitor.live.data._onServerLogLoaded);
			}
		},
		// flags to track which data files have been loaded:
		_dispatchBotsLoaded: false,
		_dispatchClientsLoaded: false,
		_dispatchPlatformsLoaded: false,

		// event callback, after the server log has been loaded:
		_onServerLogLoaded: function() {
			//console.info('Monitor.live.data._onServerLogLoaded()');

			// chain the client log file to load:
			Monitor.live.data.loadLogFile('log', Monitor.live.data._onClientLogLoaded);
		},

		// event callback, after the client log has been loaded:
		_onClientLogLoaded: function() {
			console.info('Monitor.live.data._onClientLogLoaded()');
			
			// chain the ticks file to load:
			Monitor.live.data.loadLogFile('tck', Monitor.live.data._onTicksLogLoaded);

		},

		// event callback, after the tiker log has been loaded:
		_onTicksLogLoaded: function() {
			console.info('Monitor.live.data._onTicksLogLoaded()');

			// analyse the data:
			Monitor.live.data.analytics.analyseAll();

			// sort the data:
			// #TODO
			
			// display the data:
			Monitor.live.gui.overview.make();

			console.log(Monitor.live.data.model._visitors);

		},

		model: {
			// visitors storage:
			_visitors: [],

			// find an already existing visitor record:
			findVisitor: function(id) {

				// shortcut to make code more readable:
				const model = Monitor.live.data.model;

				// loop over all visitors already registered:
				for (let i=0; i<model._visitors.length; i++) {
					const v = model._visitors[i];
					if (v && v.id == id) return v;
				}
				return null; // nothing found
			},

			/* if there is already this visit registered, return it (used for updates) */
			_getVisit: function(visit, view) {

				// shortcut to make code more readable:
				const model = Monitor.live.data.model;


				for (let i=0; i<visit._pageViews.length; i++) {
					const pv = visit._pageViews[i];
					if (pv.pg == view.pg && // same page id, and
						view.ts.getTime() - pv._firstSeen.getTime() < 1200000) { // seen less than 20 minutes ago
							return pv; // it is the same visit.
					}
				}
				return null; // not found
			},

			// register a new visitor (or update if already exists)
			registerVisit: function(dat) {
				//console.info('registerVisit', dat);

				// shortcut to make code more readable:
				const model = Monitor.live.data.model;
	
				// check if it already exists:
				let visitor = model.findVisitor(dat.id);
				if (!visitor) {
					const bot = Monitor.live.data.bots.match(dat.client);

					model._visitors.push(dat);
					visitor = dat;
					visitor._firstSeen = dat.ts;
					visitor._lastSeen = dat.ts;
					visitor._isBot = ( bot ? 1.0 : 0.0 ); // likelihood of being a bot; primed to 0% or 100% in case of a known bot
					visitor._pageViews = []; // array of page views
					visitor._hasReferrer = false; // has at least one referrer
					visitor._jsClient = false; // visitor has been seen logged by client js as well
					visitor._client = bot ?? Monitor.live.data.clients.match(dat.client) ?? null; // client info (browser, bot, etc.)
					visitor._platform = Monitor.live.data.platforms.match(dat.client); // platform info

					// known bots get the bot ID as identifier:
					if (bot) visitor.id = bot.id;
				}

				// find browser 

				// is this visit already registered?
				let prereg = model._getVisit(visitor, dat);
				if (!prereg) {
					// add the page view to the visitor:
					prereg = {
						_by: 'srv',
						ip: dat.ip,
						pg: dat.pg,
						ref: dat.ref || '',
						_firstSeen: dat.ts,
						_lastSeen: dat.ts,
						_jsClient: false
					};
					visitor._pageViews.push(prereg);
				}

				// update referrer state:
				visitor._hasReferrer = visitor._hasReferrer || 
					(prereg.ref !== undefined && prereg.ref !== '');

				// update time stamp for last-seen:
				visitor._lastSeen = dat.ts;

				// if needed:
				return visitor;
			},

			// updating visit data from the client-side log:
			updateVisit: function(dat) {
				//console.info('updateVisit', dat);

				// shortcut to make code more readable:
				const model = Monitor.live.data.model;

				let visitor = model.findVisitor(dat.id);
				if (!visitor) {
					visitor = model.registerVisit(dat);
				}
				if (visitor) {
					visitor._lastSeen = dat.ts;
					visitor._jsClient = true; // seen by client js
				} else {
					console.warn(`No visit with ID ${dat.id}.`);
					return;
				}

				// find the page view:
				let prereg = model._getVisit(visitor, dat);
				if (prereg) {
					// update the page view:
					prereg._lastSeen = dat.ts;
					prereg._jsClient = true; // seen by client js
				} else {
					// add the page view to the visitor:
					prereg = {
						_by: 'log',
						ip: dat.ip,
						pg: dat.pg,
						ref: dat.ref || '',
						_firstSeen: dat.ts,
						_lastSeen: dat.ts,
						_jsClient: true
					};
					visitor._pageViews.push(prereg);
				}
			},

			// updating visit data from the ticker log:
			updateTicks: function(dat) {
				//console.info('updateTicks', dat);

				// shortcut to make code more readable:
				const model = Monitor.live.data.model;

				// find the visit info:
				let visitor = model.findVisitor(dat.id);
				if (!visitor) {
					console.warn(`No visitor with ID ${dat.id}, registering a new one.`);
					visitor = model.registerVisit(dat);
				}
				if (visitor) {
					// update "last seen":
					if (visitor._lastSeen < dat.ts) visitor._lastSeen = dat.ts;

					// get the page view info:
					const pv = model._getVisit(visitor, dat);
					if (pv) {
						// update the page view info:
						if (pv._lastSeen.getTime() < dat.ts.getTime()) pv._lastSeen = dat.ts;
					} else {
						console.warn(`No page view for visit ID ${dat.id}, page ${dat.pg}, registering a new one.`);
						
						// add a new page view to the visitor:
						const newPv = {
							_by: 'tck',
							ip: dat.ip,
							pg: dat.pg,
							ref: '',
							_firstSeen: dat.ts,
							_lastSeen: dat.ts,
							_jsClient: false
						};
						visitor._pageViews.push(newPv);
					}
					
				} else {
					console.warn(`No visit with ID ${dat.id}.`);
					return;
				}

			}
		},

		analytics: {

			init: function() {
				console.info('Monitor.live.data.analytics.init()');
			},

			// data storage:
			data: {
				totalVisits: 0,
				totalPageViews: 0,
				bots: {
					known: 0,
					possible: 0,
					human: 0
				}
			},

			// sort the visits by type:
			groups: {
				knownBots: [],
				possibleBots: [],
				humans: [],
				users: []
			},

			// all analytics
			analyseAll: function() {
				//console.info('Monitor.live.data.analytics.analyseAll()');

				// shortcut to make code more readable:
				const model = Monitor.live.data.model;

				// loop over all visitors:
				model._visitors.forEach( (v) => {

					// count visits and page views:
					this.data.totalVisits += 1;
					this.data.totalPageViews += v._pageViews.length;
					
					// check for typical bot aspects:
					let botScore = v._isBot; // start with the known bot score

					if (v._isBot >= 1.0) { // known bots

						this.data.bots.known += 1;
						this.groups.knownBots.push(v);

					} if (v.usr && v.usr != '') { // known users
						this.groups.users.push(v);
					} else {
						// not a known bot, nor a known user; check other aspects:

						// no referrer at all:
						if (!v._hasReferrer) botScore += 0.2;

						// no js client logging:
						if (!v._jsClient) botScore += 0.2;

						// average time between page views less than 30s:
						if (v._pageViews.length > 1) {
							botScore -= 0.2; // more than one view: good!
							let totalDiff = 0;
							for (let i=1; i<v._pageViews.length; i++) {
								const diff = v._pageViews[i]._firstSeen.getTime() - v._pageViews[i-1]._lastSeen.getTime();
								totalDiff += diff;
							}
							const avgDiff = totalDiff / (v._pageViews.length - 1);
							if (avgDiff < 30000) botScore += 0.2;
							else if (avgDiff < 60000) botScore += 0.1;
						}

						// decide based on the score:
						if (botScore >= 0.5) {
							this.data.bots.possible += 1;
							this.groups.possibleBots.push(v);
						} else {
							this.data.bots.human += 1;
							this.groups.humans.push(v);
						}
					}
				});

				console.log(this.data);
				console.log(this.groups);
			}

		},

		bots: {
			// loads the list of known bots from a JSON file:
			init: async function() {
				//console.info('Monitor.live.data.bots.init()');

				// Load the list of known bots:
				Monitor.live.gui.status.showBusy("Loading known bots …");
				const url = Monitor._baseDir + 'data/known-bots.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					Monitor.live.data.bots._list = await response.json();
					Monitor.live.data.bots._ready = true;

					// TODO: allow using the bots list...
				} catch (error) {
					Monitor.live.gui.status.setError("Error while loading the ’known bots’ file: " + error.message);
				} finally {
					Monitor.live.gui.status.hideBusy("Done.");
					Monitor.live.data._dispatch('bots')
				}
			},

			// returns bot info if the clientId matches a known bot, null otherwise:
			match: function(client) {
				//console.info('Monitor.live.data.bots.match(',client,')');

				if (client) {
					for (let i=0; i<Monitor.live.data.bots._list.length; i++) {
						const bot = Monitor.live.data.bots._list[i];
						for (let j=0; j<bot.rx.length; j++) {
							if (client.match(new RegExp(bot.rx[j]))) {
								return bot; // found a match
							}
						}
						return null; // not found!
					}
				}
			},

			// indicates if the list is loaded and ready to use:
			_ready: false,

			// the actual bot list is stored here:
			_list: []
		},

		clients: {
			// loads the list of known clients from a JSON file:
			init: async function() {
				//console.info('Monitor.live.data.clients.init()');

				// Load the list of known bots:
				Monitor.live.gui.status.showBusy("Loading known clients");
				const url = Monitor._baseDir + 'data/known-clients.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					Monitor.live.data.clients._list = await response.json();
					Monitor.live.data.clients._ready = true;

				} catch (error) {
					Monitor.live.gui.status.setError("Error while loading the known clients file: " + error.message);
				} finally {
					Monitor.live.gui.status.hideBusy("Done.");
					Monitor.live.data._dispatch('clients')
				}
			},

			// returns bot info if the clientId matches a known bot, null otherwise:
			match: function(cid) {
				//console.info('Monitor.live.data.clients.match(',cid,')');

				let match = {"n": "Unknown", "v": -1, "id": null};

				if (cid) {
					Monitor.live.data.clients._list.find(client => {
						let r = false;
						for (let j=0; j<client.rx.length; j++) {
							const rxr = cid.match(new RegExp(client.rx[j]));
							if (rxr) {
								match.n = client.n;
								match.v = (rxr.length > 1 ? rxr[1] : -1);
								match.id = client.id || null;
								r = true;
								break;
							}
						}
						return r;
					});
				}

				return match;
			},

			// indicates if the list is loaded and ready to use:
			_ready: false,

			// the actual bot list is stored here:
			_list: []

		},

		platforms: {
			// loads the list of known platforms from a JSON file:
			init: async function() {
				//console.info('Monitor.live.data.platforms.init()');

				// Load the list of known bots:
				Monitor.live.gui.status.showBusy("Loading known platforms");
				const url = Monitor._baseDir + 'data/known-platforms.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					Monitor.live.data.platforms._list = await response.json();
					Monitor.live.data.platforms._ready = true;

				} catch (error) {
					Monitor.live.gui.status.setError("Error while loading the known platforms file: " + error.message);
				} finally {
					Monitor.live.gui.status.hideBusy("Done.");
					Monitor.live.data._dispatch('platforms')
				}
			},

			// returns bot info if the browser id matches a known platform:
			match: function(cid) {
				//console.info('Monitor.live.data.platforms.match(',cid,')');

				let match = {"n": "Unknown", "id": null};

				if (cid) {
					Monitor.live.data.platforms._list.find(platform => {
						let r = false;
						for (let j=0; j<platform.rx.length; j++) {
							const rxr = cid.match(new RegExp(platform.rx[j]));
							if (rxr) {
								match.n = platform.n;
								match.v = (rxr.length > 1 ? rxr[1] : -1);
								match.id = platform.id || null;
								r = true;
								break;
							}
						}
						return r;
					});
				}

				return match;
			},

			// indicates if the list is loaded and ready to use:
			_ready: false,

			// the actual bot list is stored here:
			_list: []

		},

		loadLogFile: async function(type, onLoaded = undefined) {
			// console.info('Monitor.live.data.loadLogFile(',type,')');

			let typeName = '';
			let columns = [];

			switch (type) {
				case "srv":
					typeName = "Server";
					columns = ['ts','ip','pg','id','typ','usr','client','ref'];
					break;
				case "log":
					typeName = "Page load";
					columns = ['ts','ip','pg','id','usr','lt','ref','client'];
					break;
				case "tck":
					typeName = "Ticker";
					columns = ['ts','ip','pg','id','client'];
					break;
				default:
					console.warn(`Unknown log type ${type}.`);
					return;
			}

			// Show the busy indicator and set the visible status:
			Monitor.live.gui.status.showBusy(`Loading ${typeName} log file …`);

			// compose the URL from which to load:
			const url = Monitor._baseDir + `logs/${Monitor._today}.${type}`;
			//console.log("Loading:",url);

			// fetch the data:
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`${response.status} ${response.statusText}`);
				}

				const logtxt = await response.text();

				logtxt.split('\n').forEach((line) => {
					if (line.trim() === '') return; // skip empty lines
					const cols = line.split('\t');

					// assign the columns to an object:
					const data = {};
					cols.forEach( (colVal,i) => {
						colName = columns[i] || `col${i}`;
						const colValue = (colName == 'ts' ? new Date(colVal) : colVal);
						data[colName] = colValue;
					});
	
					// register the visit in the model:
					switch(type) {
						case 'srv':
							Monitor.live.data.model.registerVisit(data);
							break;
						case 'log':
							Monitor.live.data.model.updateVisit(data);
							break;
						case 'tck':
							Monitor.live.data.model.updateTicks(data);
							break;
						default:
							console.warn(`Unknown log type ${type}.`);
							return;
					}
				});

				if (onLoaded) {
					onLoaded(); // callback after loading is finished.
				}

			} catch (error) {
				Monitor.live.gui.status.setError(`Error while loading the ${typeName} log file: ${error.message}.`);
			} finally {
				Monitor.live.gui.status.hideBusy("Done.");
			}
		}
	},

	gui: {

		overview: {
			make: function() {
				const data = Monitor.live.data.analytics.data;
				const parent = document.getElementById('monitor__today__content');
				if (parent) {
					jQuery(parent).prepend(jQuery(`
						<h2>Overview</h2>
						<p>Total visits: ${data.totalVisits}</p>
						<p>Total page views: ${data.totalPageViews}</p>
						<h3>Bots vs. Humans</h3>
						<p>Known bots: ${data.bots.known}</p>
						<p>Possible bots: ${data.bots.possible}</p>
						<p>Humans: ${data.bots.human}</p>
					`));
				}
			}
		},
		status: {
			setText: function(txt) {
				const el = document.getElementById('monitor__today__status');
				if (el && Monitor.live.gui.status._errorCount <= 0) {
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
				Monitor.live.gui.status._errorCount += 1;
				const el = document.getElementById('monitor__today__status');
				if (el) {
					el.innerText = "An error occured. See the browser log for details!";
					el.classList.add('error');
				}
			},
			_errorCount: 0,
	
			showBusy: function(txt = null) {
				Monitor.live.gui.status._busyCount += 1;
				const el = document.getElementById('monitor__today__busy');
				if (el) {
					el.style.display = 'inline-block';
				}
				if (txt) Monitor.live.gui.status.setText(txt);
			},
			_busyCount: 0,
	
			hideBusy: function(txt = null) {
				const el = document.getElementById('monitor__today__busy');
				Monitor.live.gui.status._busyCount -= 1;
				if (Monitor.live.gui.status._busyCount <= 0) {
					if (el) el.style.display = 'none';
					if (txt) Monitor.live.gui.status.setText(txt);
				}
			}
		}
	
	}
};

/* launch only if the Monitor admin panel is open: */
if (document.getElementById('monitor__admin')) {
	Monitor.init();
}