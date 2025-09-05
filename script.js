"use strict";
/* DokuWiki BotMon Plugin Script file */
/* 04.09.2025 - 0.1.8 - pre-release */
/* Authors: Sascha Leib <ad@hominem.info> */

// enumeration of user types:
const BM_USERTYPE = Object.freeze({
	'UNKNOWN': 'unknown',
	'KNOWN_USER': 'user',
	'HUMAN': 'human',
	'LIKELY_BOT': 'likely_bot',
	'KNOWN_BOT': 'known_bot'
});

/* BotMon root object */
const BotMon = {

	init: function() {
		//console.info('BotMon.init()');

		// find the plugin basedir:
		this._baseDir = document.currentScript.src.substring(0, document.currentScript.src.indexOf('/exe/'))
			+ '/plugins/botmon/';

		// read the page language from the DOM:
		this._lang = document.getRootNode().documentElement.lang || this._lang;

		// get the time offset:
		this._timeDiff = BotMon.t._getTimeOffset();

		// init the sub-objects:
		BotMon.t._callInit(this);
	},

	_baseDir: null,
	_lang: 'en',
	_today: (new Date()).toISOString().slice(0, 10),
	_timeDiff: '',

	/* internal tools */
	t: {

		/* helper function to call inits of sub-objects */
		_callInit: function(obj) {
			//console.info('BotMon.t._callInit(obj=',obj,')');

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
		},

		/* helper function to create a new element with all attributes and text content */
		_makeElement: function(name, atlist = undefined, text = undefined) {
			var r = null;
			try {
				r = document.createElement(name);
				if (atlist) {
					for (let attr in atlist) {
						r.setAttribute(attr, atlist[attr]);
					}
				}
				if (text) {
					r.textContent = text.toString();
				}
			} catch(e) {
				console.error(e);
			}
			return r;
		}
	}
};

/* everything specific to the "Today" tab is self-contained in the "live" object: */
BotMon.live = {
	init: function() {
		//console.info('BotMon.live.init()');

		// set the title:
		const tDiff = '(<abbr title="Coordinated Universal Time">UTC</abbr>' + (BotMon._timeDiff != '' ? `, ${BotMon._timeDiff}` : '' ) + ')';
		BotMon.live.gui.status.setTitle(`Data for <time datetime=${BotMon._today}>${BotMon._today}</time> ${tDiff}`);

		// init sub-objects:
		BotMon.t._callInit(this);
	},

	data: {
		init: function() {
			//console.info('BotMon.live.data.init()');

			// call sub-inits:
			BotMon.t._callInit(this);
		},

		// this will be called when the known json files are done loading:
		_dispatch: function(file) {
			//console.info('BotMon.live.data._dispatch(,',file,')');

			// shortcut to make code more readable:
			const data = BotMon.live.data;

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
				case 'rules':
					data._dispatchRulesLoaded = true;
					break;
				default:
					// ignore
			}

			// are all the flags set?
			if (data._dispatchBotsLoaded && data._dispatchClientsLoaded && data._dispatchPlatformsLoaded && data._dispatchRulesLoaded) {
				// chain the log files loading:
				BotMon.live.data.loadLogFile('srv', BotMon.live.data._onServerLogLoaded);
			}
		},
		// flags to track which data files have been loaded:
		_dispatchBotsLoaded: false,
		_dispatchClientsLoaded: false,
		_dispatchPlatformsLoaded: false,
		_dispatchRulesLoaded: false,

		// event callback, after the server log has been loaded:
		_onServerLogLoaded: function() {
			//console.info('BotMon.live.data._onServerLogLoaded()');

			// chain the client log file to load:
			BotMon.live.data.loadLogFile('log', BotMon.live.data._onClientLogLoaded);
		},

		// event callback, after the client log has been loaded:
		_onClientLogLoaded: function() {
			//console.info('BotMon.live.data._onClientLogLoaded()');
			
			// chain the ticks file to load:
			BotMon.live.data.loadLogFile('tck', BotMon.live.data._onTicksLogLoaded);

		},

		// event callback, after the tiker log has been loaded:
		_onTicksLogLoaded: function() {
			//console.info('BotMon.live.data._onTicksLogLoaded()');

			// analyse the data:
			BotMon.live.data.analytics.analyseAll();

			// sort the data:
			// #TODO
			
			// display the data:
			BotMon.live.gui.overview.make();

			//console.log(BotMon.live.data.model._visitors);

		},

		model: {
			// visitors storage:
			_visitors: [],

			// find an already existing visitor record:
			findVisitor: function(visitor) {
				//console.info('BotMon.live.data.model.findVisitor()');
				//console.log(visitor);

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				// loop over all visitors already registered:
				for (let i=0; i<model._visitors.length; i++) {
					const v = model._visitors[i];

					if (visitor._type == BM_USERTYPE.KNOWN_BOT) { /* known bots */

						// bots match when their ID matches:
						if (v._bot && v._bot.id == visitor._bot.id) {
							return v;
						}

					} else if (visitor._type == BM_USERTYPE.KNOWN_USER) { /* registered users */
						
						//if (visitor.id == 'fsmoe7lgqb89t92vt4ju8vdl0q') console.log(visitor);

						// visitors match when their names match:
						if ( v.usr == visitor.usr
						 && v.ip == visitor.ip
						 && v.agent == visitor.agent) {
							return v;
						}
					} else { /* any other visitor */

						if ( v.id == visitor.id) { /* match the pre-defined IDs */
							return v;
						} else if (v.ip == visitor.ip && v.agent == visitor.agent) {
							console.warn("Visitor ID not found, using matchin IP + User-Agent instead.");
							return v;
						}

					}
				}
				return null; // nothing found
			},

			/* if there is already this visit registered, return the page view item */
			_getPageView: function(visit, view) {

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				for (let i=0; i<visit._pageViews.length; i++) {
					const pv = visit._pageViews[i];
					if (pv.pg == view.pg) {
						return pv;
					}
				}
				return null; // not found
			},

			// register a new visitor (or update if already exists)
			registerVisit: function(nv, type) {
				//console.info('registerVisit', nv, type);

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				// is it a known bot?
				const bot = BotMon.live.data.bots.match(nv.agent);

				// enrich new visitor with relevant data:
				if (!nv._bot) nv._bot = bot ?? null; // bot info
				nv._type = ( bot ? BM_USERTYPE.KNOWN_BOT : ( nv.usr && nv.usr !== '' ? BM_USERTYPE.KNOWN_USER : BM_USERTYPE.UNKNOWN ) );
				if (!nv._firstSeen) nv._firstSeen = nv.ts;
				nv._lastSeen = nv.ts;

				// check if it already exists:
				let visitor = model.findVisitor(nv);
				if (!visitor) {
					visitor = nv;
					visitor._seenBy = [type];
					visitor._pageViews = []; // array of page views
					visitor._hasReferrer = false; // has at least one referrer
					visitor._jsClient = false; // visitor has been seen logged by client js as well
					visitor._client = BotMon.live.data.clients.match(nv.agent) ?? null; // client info
					visitor._platform = BotMon.live.data.platforms.match(nv.agent); // platform info
					model._visitors.push(visitor);
				}

				// find browser 

				// is this visit already registered?
				let prereg = model._getPageView(visitor, nv);
				if (!prereg) {
					// add new page view:
					prereg = model._makePageView(nv, type);
					visitor._pageViews.push(prereg);
				} else {
					// update last seen date
					prereg._lastSeen = nv.ts;
					// increase view count:
					prereg._viewCount += 1;
				}

				// update referrer state:
				visitor._hasReferrer = visitor._hasReferrer || 
					(prereg.ref !== undefined && prereg.ref !== '');

				// update time stamp for last-seen:
				visitor._lastSeen = nv.ts;

				// if needed:
				return visitor;
			},

			// updating visit data from the client-side log:
			updateVisit: function(dat) {
				//console.info('updateVisit', dat);

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				const type = 'log';

				let visitor = BotMon.live.data.model.findVisitor(dat);
				if (!visitor) {
					visitor = model.registerVisit(dat, type);
				}
				if (visitor) {

					visitor._lastSeen = dat.ts;
					if (!visitor._seenBy.includes(type)) {
						visitor._seenBy.push(type);
					}
					visitor._jsClient = true; // seen by client js
				}

				// find the page view:
				let prereg = BotMon.live.data.model._getPageView(visitor, dat);
				if (prereg) {
					// update the page view:
					prereg._lastSeen = dat.ts;
					if (!prereg._seenBy.includes(type)) prereg._seenBy.push(type);
					prereg._jsClient = true; // seen by client js
				} else {
					// add the page view to the visitor:
					prereg = model._makePageView(dat, type);
					visitor._pageViews.push(prereg);
				}
			},

			// updating visit data from the ticker log:
			updateTicks: function(dat) {
				//console.info('updateTicks', dat);

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				const type = 'tck';

				// find the visit info:
				let visitor = model.findVisitor(dat);
				if (!visitor) {
					console.warn(`No visitor with ID ${dat.id}, registering a new one.`);
					visitor = model.registerVisit(dat, type);
				}
				if (visitor) {
					// update visitor:
					if (visitor._lastSeen < dat.ts) visitor._lastSeen = dat.ts;
					if (!visitor._seenBy.includes(type)) visitor._seenBy.push(type);

					// get the page view info:
					let pv = model._getPageView(visitor, dat);
					if (!pv) {
						console.warn(`No page view for visit ID ${dat.id}, page ${dat.pg}, registering a new one.`);
						pv = model._makePageView(dat, type);
						visitor._pageViews.push(pv);
					}

					// update the page view info:
					if (!pv._seenBy.includes(type)) pv._seenBy.push(type);
					if (pv._lastSeen.getTime() < dat.ts.getTime()) pv._lastSeen = dat.ts;
					pv._tickCount += 1;

				} 
			},

			// helper function to create a new "page view" item:
			_makePageView: function(data, type) {
				return {
					_by: type,
					ip: data.ip,
					pg: data.pg,
					ref: data.ref || '',
					_firstSeen: data.ts,
					_lastSeen: data.ts,
					_seenBy: [type],
					_jsClient: ( type !== 'srv'),
					_viewCount: 1,
					_tickCount: 0
				};
			}
		},

		analytics: {

			init: function() {
				//console.info('BotMon.live.data.analytics.init()');
			},

			// data storage:
			data: {
				totalVisits: 0,
				totalPageViews: 0,
				bots: {
					known: 0,
					suspected: 0,
					human: 0,
					users: 0
				}
			},

			// sort the visits by type:
			groups: {
				knownBots: [],
				suspectedBots: [],
				humans: [],
				users: []
			},

			// all analytics
			analyseAll: function() {
				//console.info('BotMon.live.data.analytics.analyseAll()');

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				// loop over all visitors:
				model._visitors.forEach( (v) => {

					// count visits and page views:
					this.data.totalVisits += 1;
					this.data.totalPageViews += v._pageViews.length;
					
					// check for typical bot aspects:
					let botScore = 0;

					if (v._type == BM_USERTYPE.KNOWN_BOT) { // known bots

						this.data.bots.known += v._pageViews.length;
						this.groups.knownBots.push(v);

					} else if (v._type == BM_USERTYPE.KNOWN_USER) { // known users */

						this.data.bots.users += v._pageViews.length;
						this.groups.users.push(v);

					} else {

						// get evaluation: 
						const e = BotMon.live.data.rules.evaluate(v);
						v._eval = e.rules;
						v._botVal = e.val;

						if (e.isBot) { // likely bots
							v._type = BM_USERTYPE.LIKELY_BOT;
							this.data.bots.suspected += v._pageViews.length;
							this.groups.suspectedBots.push(v);
						} else { // probably humans
							v._type = BM_USERTYPE.HUMAN;
							this.data.bots.human += v._pageViews.length;
							this.groups.humans.push(v);
						}
						// TODO: find suspected bots
						
					}
				});

				//console.log(this.data);
				//console.log(this.groups);
			}

		},

		bots: {
			// loads the list of known bots from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.bots.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known bots …");
				const url = BotMon._baseDir + 'data/known-bots.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					this._list = await response.json();
					this._ready = true;

				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the ‘known bots’ file: " + error.message);
				} finally {
					BotMon.live.gui.status.hideBusy("Status: Done.");
					BotMon.live.data._dispatch('bots')
				}
			},

			// returns bot info if the clientId matches a known bot, null otherwise:
			match: function(agent) {
				//console.info('BotMon.live.data.bots.match(',agent,')');

				const BotList = BotMon.live.data.bots._list;

				// default is: not found!
				let botInfo = null;

				// check for known bots:
				BotList.find(bot => {
					let r = false;
					for (let j=0; j<bot.rx.length; j++) {
						const rxr = agent.match(new RegExp(bot.rx[j]));
						if (rxr) {
							botInfo = {
								n : bot.n,
								id: bot.id,
								url: bot.url,
								v: (rxr.length > 1 ? rxr[1] : -1)
							};
							r = true;
							break;
						}
					};
					return r;
				});

				// check for unknown bots:
				if (!botInfo) {
					const botmatch = agent.match(/[^\s](\w*bot)[\/\s;\),$]/i);
					if(botmatch) {
						botInfo = {'id': "other", 'n': "Other", "bot": botmatch[0] };
					}
				}

				//console.log("botInfo:", botInfo);
				return botInfo;
			},


			// indicates if the list is loaded and ready to use:
			_ready: false,

			// the actual bot list is stored here:
			_list: []
		},

		clients: {
			// loads the list of known clients from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.clients.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known clients");
				const url = BotMon._baseDir + 'data/known-clients.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					BotMon.live.data.clients._list = await response.json();
					BotMon.live.data.clients._ready = true;

				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the known clients file: " + error.message);
				} finally {
					BotMon.live.gui.status.hideBusy("Status: Done.");
					BotMon.live.data._dispatch('clients')
				}
			},

			// returns bot info if the user-agent matches a known bot, null otherwise:
			match: function(agent) {
				//console.info('BotMon.live.data.clients.match(',agent,')');

				let match = {"n": "Unknown", "v": -1, "id": null};

				if (agent) {
					BotMon.live.data.clients._list.find(client => {
						let r = false;
						for (let j=0; j<client.rx.length; j++) {
							const rxr = agent.match(new RegExp(client.rx[j]));
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

				//console.log(match)
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
				//console.info('BotMon.live.data.platforms.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known platforms");
				const url = BotMon._baseDir + 'data/known-platforms.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					BotMon.live.data.platforms._list = await response.json();
					BotMon.live.data.platforms._ready = true;

				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the known platforms file: " + error.message);
				} finally {
					BotMon.live.gui.status.hideBusy("Status: Done.");
					BotMon.live.data._dispatch('platforms')
				}
			},

			// returns bot info if the browser id matches a known platform:
			match: function(cid) {
				//console.info('BotMon.live.data.platforms.match(',cid,')');

				let match = {"n": "Unknown", "id": null};

				if (cid) {
					BotMon.live.data.platforms._list.find(platform => {
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

		rules: {
			// loads the list of rules and settings from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.rules.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading list of rules …");
				const url = BotMon._baseDir + 'data/rules.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					const json = await response.json();

					if (json.rules) {
						this._rulesList = json.rules;
					}

					if (json.threshold) {
						this._threshold = json.threshold;
					}

					this._ready = true;

				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the ‘rules’ file: " + error.message);
				} finally {
					BotMon.live.gui.status.hideBusy("Status: Done.");
					BotMon.live.data._dispatch('rules')
				}
			},

			_rulesList: [], // list of rules to find out if a visitor is a bot
			_threshold: 100, // above this, it is considered a bot.

			// returns a descriptive text for a rule id
			getRuleInfo: function(ruleId) {
				// console.info('getRuleInfo', ruleId);

				// shortcut for neater code:
				const me = BotMon.live.data.rules;

				for (let i=0; i<me._rulesList.length; i++) {
					const rule = me._rulesList[i];
					if (rule.id == ruleId) {
						return rule;
					}
				}
				return null;

			},

			// evaluate a visitor for lkikelihood of being a bot
			evaluate: function(visitor) {

				// shortcut for neater code:
				const me = BotMon.live.data.rules;

				let r =  {	// evaluation result
					'val': 0,
					'rules': [],
					'isBot': false
				};

				for (let i=0; i<me._rulesList.length; i++) {
					const rule = me._rulesList[i];
					const params = ( rule.params ? rule.params : [] );

					if (rule.func) { // rule is calling a function
						if (me.func[rule.func]) {
							if(me.func[rule.func](visitor, ...params)) {
								r.val += rule.bot;
								r.rules.push(rule.id)
							}
						} else {
							//console.warn("Unknown rule function: “${rule.func}”. Ignoring rule.")
						}
					}
				}

				// is a bot?
				r.isBot = (r.val >= me._threshold);

				return r;
			},

			// list of functions that can be called by the rules list to evaluate a visitor:
			func: {

				// check if client is one of the obsolete ones:
				obsoleteClient: function(visitor, ...clients) {

					const clientId = ( visitor._client ? visitor._client.id : '');
					return clients.includes(clientId);
				},

				// check if OS/Platform is one of the obsolete ones:
				obsoletePlatform: function(visitor, ...platforms) {

					const pId = ( visitor._platform ? visitor._platform.id : '');
					return platforms.includes(pId);
				},

				// client does not use JavaScript:
				noJavaScript: function(visitor) {
					return (visitor._jsClient === false);
				},

				// are there at lest num pages loaded?
				smallPageCount: function(visitor, num) {
					return (visitor._pageViews.length <= Number(num));
				},

				// there are no ticks recorded for a visitor
				// note that this will also trigger the "noJavaScript" rule:
				noTicks: function(visitor) {
					return !visitor._seenBy.includes('tck');
				},

				// there are no references in any of the page visits:
				noReferences: function(visitor) {
					return (visitor._hasReferrer === true);
				}
			}

		},

		loadLogFile: async function(type, onLoaded = undefined) {
			//console.info('BotMon.live.data.loadLogFile(',type,')');

			let typeName = '';
			let columns = [];

			switch (type) {
				case "srv":
					typeName = "Server";
					columns = ['ts','ip','pg','id','typ','usr','agent','ref'];
					break;
				case "log":
					typeName = "Page load";
					columns = ['ts','ip','pg','id','usr','lt','ref','agent'];
					break;
				case "tck":
					typeName = "Ticker";
					columns = ['ts','ip','pg','id','agent'];
					break;
				default:
					console.warn(`Unknown log type ${type}.`);
					return;
			}

			// Show the busy indicator and set the visible status:
			BotMon.live.gui.status.showBusy(`Loading ${typeName} log file …`);

			// compose the URL from which to load:
			const url = BotMon._baseDir + `logs/${BotMon._today}.${type}.txt`;
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
						const colValue = (colName == 'ts' ? new Date(colVal) : colVal.trim());
						data[colName] = colValue;
					});
	
					// register the visit in the model:
					switch(type) {
						case 'srv':
							BotMon.live.data.model.registerVisit(data, type);
							break;
						case 'log':
							data.typ = 'js';
							BotMon.live.data.model.updateVisit(data);
							break;
						case 'tck':
							data.typ = 'js';
							BotMon.live.data.model.updateTicks(data);
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
				BotMon.live.gui.status.setError(`Error while loading the ${typeName} log file: ${error.message}.`);
			} finally {
				BotMon.live.gui.status.hideBusy("Status: Done.");
			}
		}
	},

	gui: {
		init: function() {
			// init the lists view:
			this.lists.init();
		},

		overview: {
			make: function() {

				const data = BotMon.live.data.analytics.data;
				const parent = document.getElementById('botmon__today__content');

				// shortcut for neater code:
				const makeElement = BotMon.t._makeElement;

				if (parent) {

					const bounceRate = Math.round(data.totalVisits / data.totalPageViews * 100);

					jQuery(parent).prepend(jQuery(`
						<details id="botmon__today__overview" open>
							<summary>Overview</summary>
							<div class="grid-3-columns">
								<dl>
									<dt>Web metrics</dt>
									<dd><span>Total page views:</span><strong>${data.totalPageViews}</strong></dd>
									<dd><span>Total visitors (est.):</span><span>${data.totalVisits}</span></dd>
									<dd><span>Bounce rate (est.):</span><span>${bounceRate}%</span></dd>
								</dl>
								<dl>
									<dt>Bots vs. Humans (page views)</dt>
									<dd><span>Registered users:</span><strong>${data.bots.users}</strong></dd>
									<dd><span>Probably humans:</span><strong>${data.bots.human}</strong></dd>
									<dd><span>Suspected bots:</span><strong>${data.bots.suspected}</strong></dd>
									<dd><span>Known bots:</span><strong>${data.bots.known}</strong></dd>
								</dl>
								<dl id="botmon__botslist"></dl>
							</div>
						</details>
					`));

					// update known bots list:
					const block = document.getElementById('botmon__botslist');
					block.innerHTML = "<dt>Top known bots (page views)</dt>";

					let bots = BotMon.live.data.analytics.groups.knownBots.toSorted( (a, b) => {
						return b._pageViews.length - a._pageViews.length;
					});

					for (let i=0; i < Math.min(bots.length, 4); i++) {
						const dd = makeElement('dd');
						dd.appendChild(makeElement('span', {'class': 'bot bot_' + bots[i]._bot.id}, bots[i]._bot.n));
						dd.appendChild(makeElement('strong', undefined, bots[i]._pageViews.length));
						block.appendChild(dd);
					}
				}
			}
		},

		status: {
			setText: function(txt) {
				const el = document.getElementById('botmon__today__status');
				if (el && BotMon.live.gui.status._errorCount <= 0) {
					el.innerText = txt;
				}
			},
	
			setTitle: function(html) {
				const el = document.getElementById('botmon__today__title');
				if (el) {
					el.innerHTML = html;
				}
			},
	
			setError: function(txt) {
				console.error(txt);
				BotMon.live.gui.status._errorCount += 1;
				const el = document.getElementById('botmon__today__status');
				if (el) {
					el.innerText = "An error occured. See the browser log for details!";
					el.classList.add('error');
				}
			},
			_errorCount: 0,
	
			showBusy: function(txt = null) {
				BotMon.live.gui.status._busyCount += 1;
				const el = document.getElementById('botmon__today__busy');
				if (el) {
					el.style.display = 'inline-block';
				}
				if (txt) BotMon.live.gui.status.setText(txt);
			},
			_busyCount: 0,
	
			hideBusy: function(txt = null) {
				const el = document.getElementById('botmon__today__busy');
				BotMon.live.gui.status._busyCount -= 1;
				if (BotMon.live.gui.status._busyCount <= 0) {
					if (el) el.style.display = 'none';
					if (txt) BotMon.live.gui.status.setText(txt);
				}
			}
		},

		lists: {
			init: function() {

				// function shortcut:
				const makeElement = BotMon.t._makeElement;

				const parent = document.getElementById('botmon__today__visitorlists');
				if (parent) {

					for (let i=0; i < 4; i++) {

						// change the id and title by number:
						let listTitle = '';
						let listId = '';
						switch (i) {
							case 0:
								listTitle = "Registered users";
								listId = 'users';
								break;
							case 1:
								listTitle = "Probably humans";
								listId = 'humans';
								break;
							case 2:
								listTitle = "Suspected bots";
								listId = 'suspectedBots';
								break;
							case 3:
								listTitle = "Known bots";
								listId = 'knownBots';
								break;
							default:
								console.warn('Unknwon list number.');
						}
						let group = BotMon.live.data.analytics.groups[listId];
						let gCount = '–';

						const details = makeElement('details', {
							'data-group': listId,
							'data-loaded': false
						});
						const title = details.appendChild(makeElement('summary'));
						title.appendChild(makeElement('span', {'class':'title'}, listTitle))
						title.appendChild(makeElement('span', {'class':'counter'}, gCount))
						details.addEventListener("toggle", this._onDetailsToggle);

						parent.appendChild(details);

					}
				}
			},

			_onDetailsToggle: function(e) {
				//console.info('BotMon.live.gui.lists._onDetailsToggle()');

				const target = e.target;
				
				if (target.getAttribute('data-loaded') == 'false') { // only if not loaded yet
					target.setAttribute('data-loaded', 'loading');

					const fillType = target.getAttribute('data-group');
					const fillList = BotMon.live.data.analytics.groups[fillType];
					if (fillList && fillList.length > 0) {

						const ul = BotMon.t._makeElement('ul');

						fillList.forEach( (it) => {
							ul.appendChild(BotMon.live.gui.lists._makeVisitorItem(it, fillType));
						});

						target.appendChild(ul);
						target.setAttribute('data-loaded', 'true');
					} else {
						target.setAttribute('data-loaded', 'false');
					}

				}
			},

			_makeVisitorItem: function(data, type) {

				// shortcut for neater code:
				const make = BotMon.t._makeElement;

				let ipType = ( data.ip.indexOf(':') >= 0 ? '6' : '4' );

				const li = make('li'); // root list item
				const details = make('details');
				const summary = make('summary');
				details.appendChild(summary);

				const span1 = make('span'); /* left-hand group */

				const platformName = (data._platform ? data._platform.n : 'Unknown');
				const clientName = (data._client ? data._client.n: 'Unknown');

				if (data._type == BM_USERTYPE.KNOWN_BOT) { /* Bot only */

					const botName = ( data._bot && data._bot.n ? data._bot.n : "Unknown");
					span1.appendChild(make('span', { /* Bot */
						'class': 'bot bot_' + (data._bot ? data._bot.id : 'unknown'),
						'title': "Bot: " + botName
					}, botName));

				} else if (data._type == BM_USERTYPE.KNOWN_USER) { /* User only */

					span1.appendChild(make('span', { /* User */
						'class': 'user_known',
						'title': "User: " + data.usr
					}, data.usr));

				} else { /* others */

					if (data.ip == '127.0.0.1' || data.ip == '::1' ) ipType = '0';
					span1.appendChild(make('span', { /* IP-Address */
						'class': 'ipaddr ip' + ipType,
						'title': "IP-Address: " + data.ip
					}, data.ip));

				}

				if (data._type !== BM_USERTYPE.KNOWN_BOT) { /* Not for bots */
					span1.appendChild(make('span', { /* Platform */
						'class': 'icon platform platform_' + (data._platform ? data._platform.id : 'unknown'),
						'title': "Platform: " + platformName
					}, platformName));

					span1.appendChild(make('span', { /* Client */
						'class': 'icon client client_' + (data._client ? data._client.id : 'unknown'),
						'title': "Client: " + clientName
					}, clientName));
				}

				summary.appendChild(span1);
				const span2 = make('span'); /* right-hand group */

				span2.appendChild(make('span', { /* page views */
					'class': 'pageviews'
				}, data._pageViews.length));

				summary.appendChild(span2);

				// create expanable section:

				const dl = make('dl', {'class': 'visitor_details'});
				
				if (data._type == BM_USERTYPE.KNOWN_BOT) {

					dl.appendChild(make('dt', {}, "Bot name:")); /* bot info */
					dl.appendChild(make('dd', {'class': 'has_icon bot bot_' + (data._bot ? data._bot.id : 'unknown')},
						(data._bot ? data._bot.n : 'Unknown')));

					if (data._bot && data._bot.url) {
						dl.appendChild(make('dt', {}, "Bot info:")); /* bot info */
						const botInfoDd = dl.appendChild(make('dd'));
						botInfoDd.appendChild(make('a', {
							'href': data._bot.url,
							'target': '_blank'
						}, data._bot.url)); /* bot info link*/

					}

				} else { /* not for bots */

					dl.appendChild(make('dt', {}, "Client:")); /* client */
					dl.appendChild(make('dd', {'class': 'has_icon client_' + (data._client ? data._client.id : 'unknown')},
						clientName + ( data._client.v > 0 ? ' (' + data._client.v + ')' : '' ) ));

					dl.appendChild(make('dt', {}, "Platform:")); /* platform */
					dl.appendChild(make('dd', {'class': 'has_icon platform_' + (data._platform ? data._platform.id : 'unknown')},
						platformName + ( data._platform.v > 0 ? ' (' + data._platform.v + ')' : '' ) ));

					dl.appendChild(make('dt', {}, "IP-Address:"));
					dl.appendChild(make('dd', {'class': 'has_icon ip' + ipType}, data.ip));

					dl.appendChild(make('dt', {}, "ID:"));
					dl.appendChild(make('dd', {'class': 'has_icon ip' + data.typ}, data.id));
				}

				if ((data._lastSeen - data._firstSeen) < 1) {
					dl.appendChild(make('dt', {}, "Seen:"));
					dl.appendChild(make('dd', {'class': 'seen'}, data._firstSeen.toLocaleString()));
				} else {
					dl.appendChild(make('dt', {}, "First seen:"));
					dl.appendChild(make('dd', {'class': 'firstSeen'}, data._firstSeen.toLocaleString()));
					dl.appendChild(make('dt', {}, "Last seen:"));
					dl.appendChild(make('dd', {'class': 'lastSeen'}, data._lastSeen.toLocaleString()));
				}

				dl.appendChild(make('dt', {}, "User-Agent:"));
				dl.appendChild(make('dd', {'class': 'agent' + ipType}, data.agent));

				dl.appendChild(make('dt', {}, "Visitor Type:"));
				dl.appendChild(make('dd', undefined, data._type ));

				dl.appendChild(make('dt', {}, "Seen by:"));
				dl.appendChild(make('dd', undefined, data._seenBy.join(', ') ));

				dl.appendChild(make('dt', {}, "Visited pages:"));
				const pagesDd = make('dd', {'class': 'pages'});
				const pageList = make('ul');
				data._pageViews.forEach( (page) => {
					const pgLi = make('li');

					let visitTimeStr = "Bounce";
					const visitDuration = page._lastSeen.getTime() - page._firstSeen.getTime();
					if (visitDuration > 0) {
						visitTimeStr = Math.floor(visitDuration / 1000) + "s";
					}

					console.log(page);

					pgLi.appendChild(make('span', {}, page.pg));
					// pgLi.appendChild(make('span', {}, page.ref));
					pgLi.appendChild(make('span', {}, ( page._seenBy ? page._seenBy.join(', ') : '—') + '; ' + page._tickCount));
					pgLi.appendChild(make('span', {}, page._firstSeen.toLocaleString()));
					pgLi.appendChild(make('span', {}, page._lastSeen.toLocaleString()));
					pageList.appendChild(pgLi);
				});
				pagesDd.appendChild(pageList);
				dl.appendChild(pagesDd);

				if (data._eval) {
					dl.appendChild(make('dt', {}, "Evaluation:"));
					const evalDd = make('dd');
					const testList = make('ul',{
						'class': 'eval'
					});
					data._eval.forEach( (test) => {

						const tObj = BotMon.live.data.rules.getRuleInfo(test);
						const tDesc = tObj ? tObj.desc : test;

						const tstLi = make('li');
						tstLi.appendChild(make('span', {
							'class': 'test test_' . test
						}, ( tObj ? tObj.desc : test )));
						tstLi.appendChild(make('span', {}, ( tObj ? tObj.bot : '—') ));
						testList.appendChild(tstLi);
					});

					const tst2Li = make('li', {
						'class': 'total'
					});
					tst2Li.appendChild(make('span', {}, "Total:"));
					tst2Li.appendChild(make('span', {}, data._botVal));
					testList.appendChild(tst2Li);

					evalDd.appendChild(testList);
					dl.appendChild(evalDd);
				}

				details.appendChild(dl);

				li.appendChild(details);
				return li;
			}

		}
	}
};

/* launch only if the BotMon admin panel is open: */
if (document.getElementById('botmon__admin')) {
	BotMon.init();
}