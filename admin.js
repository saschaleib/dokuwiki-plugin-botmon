"use strict";
/* DokuWiki BotMon Plugin Script file */
/* 14.10.2025 - 0.5.0 - pre-release */
/* Author: Sascha Leib <ad@hominem.info> */

// enumeration of user types:
const BM_USERTYPE = Object.freeze({
	'UNKNOWN': 'unknown',
	'KNOWN_USER': 'user',
	'PROBABLY_HUMAN': 'human',
	'LIKELY_BOT': 'likely_bot',
	'KNOWN_BOT': 'known_bot'
});

// enumeration of log types:
const BM_LOGTYPE = Object.freeze({
	'SERVER': 'srv',
	'CLIENT': 'log',
	'TICKER': 'tck'
});

// enumeration of IP versions:
const BM_IPVERSION = Object.freeze({
	'IPv4': 4,
	'IPv6': 6
});

/* BotMon root object */
const BotMon = {

	init: function() {
		//console.info('BotMon.init()');

		// find the plugin basedir:
		this._baseDir = document.currentScript.src.substring(0, document.currentScript.src.lastIndexOf('/')+1);

		// read the page language from the DOM:
		this._lang = document.getRootNode().documentElement.lang || this._lang;

		// get the time offset:
		this._timeDiff = BotMon.t._getTimeOffset();

		// get yesterday's date:
		let d = new Date();
		if (BMSettings.showday == 'yesterday') d.setDate(d.getDate() - 1);
		this._datestr = d.toISOString().slice(0, 10);

		// init the sub-objects:
		BotMon.t._callInit(this);
	},

	_baseDir: null,
	_lang: 'en',
	_datestr: '',
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
		},

		/* helper to convert an ip address string to a normalised format: */
		_ip2Num: function(ip) {
			if (!ip) {
				return 'null';
			} else if (ip.indexOf(':') > 0) { /* IP6 */
				return (ip.split(':').map(d => ('0000'+d).slice(-4) ).join(':'));
			} else { /* IP4 */
				return ip.split('.').map(d => ('000'+d).slice(-3) ).join('.');
			}
		},

		/* helper function to format a Date object to show only the time. */
		/* returns String */
		_formatTime: function(date) {

			if (date) {
				return date.getHours() + ':' + ('0'+date.getMinutes()).slice(-2) + ':' + ('0'+date.getSeconds()).slice(-2);
			} else {
				return null;
			}

		},

		/* helper function to show a time difference in seconds or minutes */
		/* returns String */
		_formatTimeDiff: function(dateA, dateB) {

			// if the second date is ealier, swap them:
			if (dateA > dateB) dateB = [dateA, dateA = dateB][0];

			// get the difference in milliseconds:
			let ms = dateB - dateA;

			if (ms > 50) { /* ignore small time spans */
				const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
				const m = Math.floor((ms / (1000 * 60)) % 60);
				const s = Math.floor((ms / 1000) % 60);

				return ( h>0 ? h + 'h ': '') + ( m>0 ? m + 'm ': '') + ( s>0 ? s + 's': '');
			}

			return null;

		},

		// calcualte a reduced ration between two numbers
		// adapted from https://stackoverflow.com/questions/3946373/math-in-js-how-do-i-get-a-ratio-from-a-percentage
		_getRatio: function(a, b, tolerance) {

			var bg = b;
			var sm = a;
			if (a == 0 || b == 0) return '—';
			if (a > b) {
				var bg = a;
				var sm = b;
			}
			
			for (var i = 1; i < 1000000; i++) {
				var d = sm / i;
				var res = bg / d;
				var howClose = Math.abs(res - res.toFixed(0));
				if (howClose < tolerance) {
					if (a > b) {
						return res.toFixed(0) + ':' + i;
					} else {
						return i + ':' + res.toFixed(0);
					}
				}
			}
		}
	}
};

/* everything specific to the 'Latest' tab is self-contained in the 'live' object: */
BotMon.live = {
	init: function() {
		//console.info('BotMon.live.init()');

		// set the title:
		const tDiff = '<abbr title="Coordinated Universal Time">UTC</abbr> ' + (BotMon._timeDiff != '' ? ` (offset: ${BotMon._timeDiff}` : '' ) + ')';
		BotMon.live.gui.status.setTitle(`Data for <time datetime="${BotMon._datestr}">${BotMon._datestr}</time> ${tDiff}`);

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
				case 'rules':
					data._dispatchRulesLoaded = true;
					break;
				case 'ipranges':
					data._dispatchIPRangesLoaded = true;
					break;
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
			if (data._dispatchBotsLoaded && data._dispatchClientsLoaded && data._dispatchPlatformsLoaded && data._dispatchRulesLoaded && data._dispatchIPRangesLoaded) {
				// chain the log files loading:
				BotMon.live.data.loadLogFile(BM_LOGTYPE.SERVER, BotMon.live.data._onServerLogLoaded);
			}
		},
		// flags to track which data files have been loaded:
		_dispatchBotsLoaded: false,
		_dispatchClientsLoaded: false,
		_dispatchPlatformsLoaded: false,
		_dispatchIPRangesLoaded: false,
		_dispatchRulesLoaded: false,

		// event callback, after the server log has been loaded:
		_onServerLogLoaded: function() {
			//console.info('BotMon.live.data._onServerLogLoaded()');

			// chain the client log file to load:
			BotMon.live.data.loadLogFile(BM_LOGTYPE.CLIENT, BotMon.live.data._onClientLogLoaded);
		},

		// event callback, after the client log has been loaded:
		_onClientLogLoaded: function() {
			//console.info('BotMon.live.data._onClientLogLoaded()');
			
			// chain the ticks file to load:
			BotMon.live.data.loadLogFile(BM_LOGTYPE.TICKER, BotMon.live.data._onTicksLogLoaded);

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

		// the data model:
		model: {
			// visitors storage:
			_visitors: [],

			// find an already existing visitor record:
			findVisitor: function(visitor, type) {
				//console.info('BotMon.live.data.model.findVisitor()', type);
				//console.log(visitor);

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				// combine Bot networks to one visitor?
				const combineNets = (BMSettings.hasOwnProperty('combineNets') ? BMSettings['combineNets'] : true);;

				if (visitor._type == BM_USERTYPE.KNOWN_BOT) { // known bots match by their bot ID:

					for (let i=0; i<model._visitors.length; i++) {
						const v = model._visitors[i];

						// bots match when their ID matches:
						if (v._bot && v._bot.id == visitor._bot.id) {
							return v;
						}
					}

				} else if (combineNets && visitor.hasOwnProperty('_ipRange')) { // combine with other visits from the same range

					let nonRangeVisitor = null;

					for (let i=0; i<model._visitors.length; i++) {
						const v = model._visitors[i];

						if ( v.hasOwnProperty('_ipRange') && v._ipRange.g == visitor._ipRange.g ) { // match the IPRange Group IDs
							return v;
						} else if ( v.id.trim() !== '' && v.id == visitor.id) { // match the DW/PHP IDs
							nonRangeVisitor = v;
						}
					}

					// if no ip range was found, return the non-range visitor instead
					if (nonRangeVisitor) return nonRangeVisitor;

				} else { // other types match by their DW/PHPIDs:

					// loop over all visitors already registered and check for ID matches:
					for (let i=0; i<model._visitors.length; i++) {
						const v = model._visitors[i];

						if ( v.id.trim() !== '' && v.id == visitor.id) { // match the DW/PHP IDs
							return v;
						}
					}

					// if not found, try to match IP address and user agent:
					for (let i=0; i<model._visitors.length; i++) {
						const v = model._visitors[i];
						if (  v.ip == visitor.ip && v.agent == visitor.agent) {
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
				nv._type = ( bot ? BM_USERTYPE.KNOWN_BOT : ( nv.usr && nv.usr !== '' ? BM_USERTYPE.KNOWN_USER : BM_USERTYPE.UNKNOWN ) ); // user type
				if (bot && bot.geo) {
					if (!nv.geo || nv.geo == '' || nv.geo == 'ZZ') nv.geo = bot.geo;
				} else if (!nv.geo ||nv.geo == '') {
					nv.geo = 'ZZ';
				}

				// update first and last seen:
				if (!nv._firstSeen) nv._firstSeen = nv.ts; // first-seen
				nv._lastSeen = nv.ts; // last-seen

				// known bot IP range?
				if (nv._type == BM_USERTYPE.UNKNOWN) { // only for unknown visitors
					const ipInfo = BotMon.live.data.ipRanges.match(nv.ip);
					if (ipInfo) nv._ipRange = ipInfo;
				}

				// country name:
				try {
					nv._country = ( nv.geo == 'local' ? "localhost" : "Unknown" );
					if (nv.geo && nv.geo !== '' && nv.geo !== 'ZZ' && nv.geo !== 'local') {
						const countryName = new Intl.DisplayNames(['en', BotMon._lang], {type: 'region'});
						nv._country = countryName.of(nv.geo.substring(0,2)) ?? nv.geo;
					}
				} catch (err) {
					console.error(err);
					nv._country = 'Error';
				}

				// check if it already exists:
				let visitor = model.findVisitor(nv, type);
				if (!visitor) {
					visitor = {...nv, ...{
						_seenBy: [type],
						_viewCount: 0, // number of page views
						_loadCount: 0, // number of page loads (not necessarily views!)
						_pageViews: [], // array of page views
						_hasReferrer: false, // has at least one referrer
						_jsClient: false, // visitor has been seen logged by client js as well
						_client: BotMon.live.data.clients.match(nv.agent) ?? null, // client info
						_platform: BotMon.live.data.platforms.match(nv.agent), // platform info
						_captcha: {'X': 0, 'Y': 0, 'N': 0, 'W':0, 'H': 0,
							_str: function() { return (this.X > 0 ? 'X' : '') + (this.Y > 0 ? 'Y' : '') + (this.N > 0 ? 'N' : '') + (this.W > 0 ? 'W' : '') + (this.H > 0 ? 'H' : ''); }
						} // captcha counter
					}};
					model._visitors.push(visitor);
				};

				// update first and last seen:
				if (visitor._firstSeen > nv.ts) {
					visitor._firstSeen = nv.ts;
				}
				if (visitor._lastSeen < nv.ts) {
					visitor._lastSeen = nv.ts;
				}

				// update total loads and views (not the same!):
				visitor._loadCount += 1;
				visitor._viewCount += (nv.captcha == 'Y' ? 0 : 1);

				// ...because also a captcha is a "load", but not a "view".
				// let's count the captcha statuses as well:
				if (nv.captcha) visitor._captcha[nv.captcha] += 1;

				// is this visit already registered?
				let prereg = model._getPageView(visitor, nv);
				if (!prereg) {
					// add new page view:
					prereg = model._makePageView(nv, type);
					visitor._pageViews.push(prereg);
				}

				// update last seen date
				prereg._lastSeen = nv.ts;

				// increase view count:
				prereg._loadCount += (visitor.captcha == 'Y' ? 0 : 1);
				//prereg._tickCount += 1;

				// update referrer state:
				visitor._hasReferrer = visitor._hasReferrer || 
					(prereg.ref !== undefined && prereg.ref !== '');

				// update time stamp for last-seen:
				if (visitor._lastSeen < nv.ts) {
					visitor._lastSeen = nv.ts;
				}

				// if needed:
				return visitor;
			},

			// updating visit data from the client-side log:
			updateVisit: function(dat) {
				//console.info('updateVisit', dat);

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				const type = BM_LOGTYPE.CLIENT;

				let visitor = BotMon.live.data.model.findVisitor(dat, type);
				if (!visitor) {
					visitor = model.registerVisit(dat, type);
				}
				if (visitor) {

					if (visitor._lastSeen < dat.ts) {
						visitor._lastSeen = dat.ts;
					}
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
				prereg._tickCount += 1;
			},

			// updating visit data from the ticker log:
			updateTicks: function(dat) {
				//console.info('updateTicks', dat);

				// shortcut to make code more readable:
				const model = BotMon.live.data.model;

				const type = BM_LOGTYPE.TICKER;

				// find the visit info:
				let visitor = model.findVisitor(dat, type);
				if (!visitor) {
					console.info(`No visitor with ID “${dat.id}” found, registering as a new one.`);
					visitor = model.registerVisit(dat, type);
				}
				if (visitor) {
					// update visitor:
					if (visitor._lastSeen < dat.ts) visitor._lastSeen = dat.ts;
					if (!visitor._seenBy.includes(type)) visitor._seenBy.push(type);

					// get the page view info:
					let pv = model._getPageView(visitor, dat);
					if (!pv) {
						console.info(`No page view for visit ID “${dat.id}”, page “${dat.pg}”, registering a new one.`);
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
				// console.info('_makePageView', data);

				// try to parse the referrer:
				let rUrl = null;
				try {
					rUrl = ( data.ref && data.ref !== '' ? new URL(data.ref) : null );
				} catch (e) {
					console.warn(`Invalid referer: “${data.ref}”.`);
					console.info(data);
				}

				return {
					_by: type,
					ip: data.ip,
					pg: data.pg,
					lang: data.lang || '??',
					_ref: rUrl,
					_firstSeen: data.ts,
					_lastSeen: data.ts,
					_seenBy: [type],
					_jsClient: ( type !== BM_LOGTYPE.SERVER),
					_viewCount: 0,
					_loadCount: 0,
					_tickCount: 0
				};
			},

			// helper function to make a human-readable title from the Captcha statuses:
			_makeCaptchaTitle: function(cObj) {
				const cStr = cObj._str();
				switch (cStr) {
					case 'Y':
					case 'NY': return "Blocked.";
					case 'YN': return "Solved";
					case 'W': return "Whitelisted";
					case 'H': return "HEAD request, no captcha";
					default: return "Undefined: " + cStr;
				}
			}
		},

		// functions to analyse the data:
		analytics: {

			/**
			 * Initializes the analytics data storage object:
			 */
			init: function() {
				//console.info('BotMon.live.data.analytics.init()');
			},

			// data storage:
			data: {
				visits: {
					bots: 0,
					suspected: 0,
					humans: 0,
					users: 0,
					total: 0
				},
				views: {
					bots: 0,
					suspected: 0,
					humans: 0,
					users: 0,
					total: 0
				},
				loads: {
					bots: 0,
					suspected: 0,
					humans: 0,
					users: 0,
					total: 0
				},
				captcha: {
					bots_blocked: 0,
					bots_passed: 0,
					bots_whitelisted: 0,
					humans_blocked: 0,
					humans_passed: 0,
					sus_blocked: 0,
					sus_passed: 0,
					sus_whitelisted: 0
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
				const data = BotMon.live.data.analytics.data;
				const me = BotMon.live.data.analytics;

				BotMon.live.gui.status.showBusy("Analysing data …");

				// loop over all visitors:
				model._visitors.forEach( (v) => {

					const captchaStr = v._captcha._str();

					// count total visits and page views:
					data.visits.total += 1;
					data.loads.total += v._loadCount;
					data.views.total += v._viewCount;

					// check for typical bot aspects:
					let botScore = 0;

					if (v._type == BM_USERTYPE.KNOWN_BOT) { // known bots

						data.visits.bots += 1;
						data.views.bots += v._viewCount;
						this.groups.knownBots.push(v);

						// captcha counter
						if (captchaStr == 'Y') {
							data.captcha.bots_blocked += 1;
						} else if (captchaStr == 'YN') {
							data.captcha.bots_passed += 1;
						} else if (captchaStr == 'W') {
							data.captcha.bots_whitelisted += 1;
						}

					} else if (v._type == BM_USERTYPE.KNOWN_USER) { // known users */

						data.visits.users += 1;
						data.views.users += v._viewCount;
						this.groups.users.push(v);

					} else {

						// get evaluation: 
						const e = BotMon.live.data.rules.evaluate(v);
						v._eval = e.rules;
						v._botVal = e.val;

						if (e.isBot) { // likely bots

							v._type = BM_USERTYPE.LIKELY_BOT;
							data.visits.suspected += 1;
							data.views.suspected += v._viewCount;
							this.groups.suspectedBots.push(v);

							// captcha counter
							if (captchaStr == 'Y') {
								data.captcha.sus_blocked += 1;
							} else if (captchaStr == 'YN') {
								data.captcha.sus_passed += 1;
							} else if (captchaStr == 'W') {
								data.captcha.sus_whitelisted += 1;
							}

						} else { // probably humans

							v._type = BM_USERTYPE.PROBABLY_HUMAN;
							data.visits.humans += 1;
							data.views.humans += v._viewCount;

							this.groups.humans.push(v);

							// captcha counter
							if (captchaStr == 'Y') {
								data.captcha.humans_blocked += 1;
							} else if (captchaStr == 'YN') {
								data.captcha.humans_passed += 1;
							}
						}						
					}

					// perform actions depending on the visitor type:
					if (v._type == BM_USERTYPE.KNOWN_BOT ) { /* known bots only */

						// no specific actions here.

					} else if (v._type == BM_USERTYPE.LIKELY_BOT) { /* probable bots only */

						// add bot views to IP range information:
						if (v.ip) {
							me.addToIpRanges(v);
						} else {
							console.log(v);
						}

					} else { /* registered users and probable humans */

						// add browser and platform statistics:
						me.addBrowserPlatform(v);

						// add to referrer and pages lists:
						v._pageViews.forEach( pv => {
							me.addToRefererList(pv._ref);
							me.addToPagesList(pv.pg);
						});
					}

					// add to the country lists:
					me.addToCountries(v.geo, v._country, v._type);
	
				});

				BotMon.live.gui.status.hideBusy('Done.');
			},

			// get a list of known bots:
			getTopBots: function(max) {
				//console.info('BotMon.live.data.analytics.getTopBots('+max+')');

				//console.log(BotMon.live.data.analytics.groups.knownBots);

				let botsList = BotMon.live.data.analytics.groups.knownBots.toSorted( (a, b) => {
					return b._viewCount - a._viewCount;
				});

				const other = {
					'id': 'other',
					'name': "Others",
					'count': 0
				};

				const rList = [];
				const max2 = ( botsList.length > max ? max-1 : botsList.length );
				let total = 0; // adding up the items
				for (let i=0; i<botsList.length; i++) {
					const it = botsList[i];
					if (it && it._bot) {
						if (i < max2) {
							rList.push({
								id: it._bot.id,
								name: (it._bot.n ? it._bot.n : it._bot.id),
								count: it._viewCount
							});
						} else {
							other.count += it._pageViews.length;
						};
						total += it._viewCount;
					}
				};

				// add the "other" item, if needed:
				if (botsList.length > max2) {
					rList.push(other);
				};

				rList.forEach( it => {
					it.pct = (it.count * 100 / total);
				});

				return rList;
			},

			// most visited pages list:
			_pagesList: [],

			/**
			 * Add a page view to the list of most visited pages.
			 * @param {string} pageId - The page ID to add to the list.
			 * @example
			 * BotMon.live.data.analytics.addToPagesList('1234567890');
			 */
			addToPagesList: function(pageId) {
				//console.log('BotMon.live.data.analytics.addToPagesList', pageId);

				const me = BotMon.live.data.analytics;	

				// already exists?	
				let pgObj = null;
				for (let i = 0; i < me._pagesList.length; i++) {
					if (me._pagesList[i].id == pageId) {
						pgObj = me._pagesList[i];
						break;
					}
				}

				// if not exists, create it:				
				if (!pgObj) {
					pgObj = {
						id: pageId,
						count: 1
					};
					me._pagesList.push(pgObj);
				} else {
					pgObj.count += 1;
				}
			},

			getTopPages: function(max) {
				//console.info('BotMon.live.data.analytics.getTopPages('+max+')');
				const me = BotMon.live.data.analytics;
				return me._pagesList.toSorted( (a, b) => {
					return b.count - a.count;
				}).slice(0,max);
			},

			// Referer List:
			_refererList: [],

			addToRefererList: function(ref) {
				//console.log('BotMon.live.data.analytics.addToRefererList',ref);

				const me = BotMon.live.data.analytics;

				// ignore internal references:
				if (ref && ref.host == window.location.host) {
					return;
				}

				const refInfo = me.getRefererInfo(ref);
				
				// already exists?
				let refObj = null;
				for (let i = 0; i < me._refererList.length; i++) {
					if (me._refererList[i].id == refInfo.id) {
						refObj = me._refererList[i];
						break;
					}
				}

				// if not exists, create it:
				if (!refObj) {
					refObj = refInfo;
					refObj.count = 1;
					me._refererList.push(refObj);
				} else {
					refObj.count += 1;
				}
			},

			getRefererInfo: function(url) {
				//console.log('BotMon.live.data.analytics.getRefererInfo',url);
				try {
					url = new URL(url);
				} catch (e) {
					return {
						'id': 'null',
						'n': 'Invalid Referer'
					};
				}

				// find the referer ID:
				let refId = 'null';
				let refName = 'No Referer';
				if (url && url.host) {
					const hArr = url.host.split('.');
					const tld = hArr[hArr.length-1];
					refId = ( tld == 'localhost' ? tld : hArr[hArr.length-2]);
					refName = hArr[hArr.length-2] + '.' + tld;
				}

				return {
					'id': refId,
					'n': refName
				};
			},

			/**
			 * Get a sorted list of the top referers.
			 * The list is sorted in descending order of count.
			 * If the array has more items than the given maximum, the rest of the items are added to an "other" item.
			 * Each item in the list has a "pct" property, which is the percentage of the total count.
			 * @param {number} max - The maximum number of items to return.
			 * @return {Array} The sorted list of top referers.
			 */
			getTopReferers: function(max) {
				//console.info(('BotMon.live.data.analytics.getTopReferers(' + max + ')'));

				const me = BotMon.live.data.analytics;

				return me._makeTopList(me._refererList, max);
			},

			/**
			 * Create a sorted list of top items from a given array.
			 * The list is sorted in descending order of count.
			 * If the array has more items than the given maximum, the rest of the items are added to an "other" item.
			 * Each item in the list has a "pct" property, which is the percentage of the total count.
			 * @param {Array} arr - The array to sort and truncate.
			 * @param {number} max - The maximum number of items to return.
			 * @return {Array} The sorted list of top items.
			 */
			_makeTopList: function(arr, max) {
				//console.info(('BotMon.live.data.analytics._makeTopList(arr,' + max + ')'));

				const me = BotMon.live.data.analytics;

				// sort the list:
				arr.sort( (a,b) => {
					return b.count - a.count;
				});

				const rList = []; // return array
				const max2 = ( arr.length >= max ? max-1 : arr.length );
				const other = {
					'id': 'other',
					'name': "Others",
					'typ': 'other',
					'count': 0
				};
				let total = 0; // adding up the items
				for (let i=0; Math.min(max, arr.length) > i; i++) {
					const it = arr[i];
					if (it) {
						if (i < max2) {
							const rIt = {
								id: it.id,
								name: (it.n ? it.n : it.id),
								typ: it.typ || it.id,
								count: it.count
							};
							rList.push(rIt);
						} else {
							other.count += it.count;
						}
						total += it.count;
					}
				}

				// add the "other" item, if needed:
				if (arr.length > max2) {
					rList.push(other);
				};

				rList.forEach( it => {
					it.pct = (it.count * 100 / total);
				});

				return rList;
			},

			/* countries of visits */
			_countries: {
				'human': [],
				'bot': []
			},
			/**
			 * Adds a country code to the statistics.
			 * 
			 * @param {string} iso The ISO 3166-1 alpha-2 country code.
			 */
			addToCountries: function(iso, name, type) {

				const me = BotMon.live.data.analytics;

				// find the correct array:
				let arr = null;
				switch (type) {
					
					case BM_USERTYPE.KNOWN_USER:
					case BM_USERTYPE.PROBABLY_HUMAN:
						arr = me._countries.human;
						break;
					case BM_USERTYPE.LIKELY_BOT:
					case BM_USERTYPE.KNOWN_BOT:
						arr = me._countries.bot;
						break;
					default:
						console.warn(`Unknown user type ${type} in function addToCountries.`);
				}

				if (arr) {
					let cRec = arr.find( it => it.id == iso);
					if (!cRec) {
						cRec = {
							'id': iso,
							'n': name,
							'count': 1
						};
						arr.push(cRec);
					} else {
						cRec.count += 1;
					}
				}
			},

			/**
			 * Returns a list of countries with visit counts, sorted by visit count in descending order.
			 * 
			 * @param {BM_USERTYPE} type array of types type of visitors to return.
			 * @param {number} max The maximum number of entries to return.
			 * @return {Array} A list of objects with properties 'iso' (ISO 3166-1 alpha-2 country code) and 'count' (visit count).
			 */
			getCountryList: function(type, max) {

				const me = BotMon.live.data.analytics;

				// find the correct array:
				let arr = null;
				switch (type) {
					
					case 'human':
						arr = me._countries.human;
						break;
					case 'bot':
						arr = me._countries.bot;
						break;
					default:
						console.warn(`Unknown user type ${type} in function getCountryList.`);
						return;
				}
				
				return me._makeTopList(arr, max);
			},

			/* browser and platform of human visitors */
			_browsers: [],
			_platforms: [],

			addBrowserPlatform: function(visitor) {
				//console.info('addBrowserPlatform', visitor);

				const me = BotMon.live.data.analytics;

				// add to browsers list:
				let browserRec = ( visitor._client ? visitor._client : {'id': 'unknown'});
				if (visitor._client) {
					let bRec = me._browsers.find( it => it.id == browserRec.id);
					if (!bRec) {
						bRec = {
							id: browserRec.id,
							n: browserRec.n,
							count: 1
						};
						me._browsers.push(bRec);
					} else {
						bRec.count += 1;
					}
				}

				// add to platforms list:
				let platformRec = ( visitor._platform ? visitor._platform : {'id': 'unknown'});
				if (visitor._platform) {
					let pRec = me._platforms.find( it => it.id == platformRec.id);
					if (!pRec) {
						pRec = {
							id: platformRec.id,
							n: platformRec.n,
							count: 1
						};
						me._platforms.push(pRec);
					} else {
						pRec.count += 1;
					}
				}

			},

			getTopBrowsers: function(max) {
			
				const me = BotMon.live.data.analytics;

				return me._makeTopList(me._browsers, max);
			},

			getTopPlatforms: function(max) {

				const me = BotMon.live.data.analytics;

				return me._makeTopList(me._platforms, max);
			},

			/* bounces are counted, not calculates: */
			getBounceCount: function(type) {
				
				const me = BotMon.live.data.analytics;
				var bounces = 0;
				const list = me.groups[type];
				
				list.forEach(it => {
					bounces += (it._viewCount <= 1 ? 1 : 0);
				});

				return bounces;
			},

			_ipRanges: [],

			/* adds a visit to the ip ranges arrays */
			addToIpRanges: function(v) {
				//console.info('addToIpRanges', v.ip);

				const me = BotMon.live.data.analytics;
				const ipRanges = BotMon.live.data.ipRanges;

				// Number of IP address segments to look at:
				const kIP4Segments = 1;
				const kIP6Segments = 3;

				let ipGroup = ''; // group name
				let ipSeg = []; // IP segment array
				let rawIP = ''; // raw ip prefix
				let ipName = ''; // IP group display name

				const ipType = v.ip.indexOf(':') > 0 ? BM_IPVERSION.IPv6 : BM_IPVERSION.IPv4;
				const ipAddr = BotMon.t._ip2Num(v.ip);
				
				// is there already a known IP range assigned?
				if (v._ipRange) {

					ipGroup = v._ipRange.g; // group name
					ipName = ipRanges.getOwner( v._ipRange.g ) || "Unknown";

				} else { // no known IP range, let's collect necessary information:

					// collect basic IP address info:
					if (ipType == BM_IPVERSION.IPv6) {
						ipSeg = ipAddr.split(':');
						const prefix = v.ip.split(':').slice(0, kIP6Segments).join(':');
						rawIP = ipSeg.slice(0, kIP6Segments).join(':');
						ipGroup = 'ip6-' + rawIP.replaceAll(':', '-');
						ipName = prefix + '::'; // + '/' + (16 * kIP6Segments);
					} else {
						ipSeg = ipAddr.split('.');
						const prefix = v.ip.split('.').slice(0, kIP4Segments).join('.');
						rawIP = ipSeg.slice(0, kIP4Segments).join('.') ;
						ipGroup = 'ip4-' + rawIP.replaceAll('.', '-');
						ipName = prefix + '.x.x.x'.substring(0, 1+(4-kIP4Segments)*2); // + '/' + (8 * kIP4Segments);
					}
				}

				// check if record already exists:
				let ipRec = me._ipRanges.find( it => it.g == ipGroup);
				if (!ipRec) {

					// ip info record initialised:
					ipRec = {
						g: ipGroup,
						n: ipName,
						count: 0
					}

					// existing record?
					if (v._ipRange) {

						ipRec.from = v._ipRange.from;
						ipRec.to = v._ipRange.to;
						ipRec.typ = 'net';

					} else { // no known IP range, let's collect necessary information:

						// complete the ip info record:
						if (ipType == BM_IPVERSION.IPv6) {
							ipRec.from = rawIP + ':0000:0000:0000:0000:0000:0000:0000'.substring(0, (8-kIP6Segments)*5);
							ipRec.to = rawIP + ':FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF'.substring(0, (8-kIP6Segments)*5);
							ipRec.typ = '6';
						} else {
							ipRec.from = rawIP + '.000.000.000.000'.substring(0, (4-kIP4Segments)*4);
							ipRec.to = rawIP + '.255.255.255.254'.substring(0, (4-kIP4Segments)*4);
							ipRec.typ = '4';
						}
					}

					me._ipRanges.push(ipRec);
				}

				// add to counter:
				ipRec.count += v._viewCount;

			},

			getTopBotISPs: function(max) {

				const me = BotMon.live.data.analytics;

				return me._makeTopList(me._ipRanges, max);
			},
		},

		// information on "known bots":
		bots: {
			// loads the list of known bots from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.bots.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known bots …");
				const url = BotMon._baseDir + 'config/known-bots.json';
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					this._list = await response.json();
					this._ready = true;

				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the known bots file:", error.message);
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

				if (!agent) return null;

				// check for known bots:
				BotList.find(bot => {
					let r = false;
					for (let j=0; j<bot.rx.length; j++) {
						const rxr = agent.match(new RegExp(bot.rx[j]));
						if (rxr) {
							botInfo = {
								n : bot.n,
								id: bot.id,
								geo: (bot.geo ? bot.geo : null),
								url: bot.url,
								v: (rxr.length > 1 ? rxr[1] : -1)
							};
							r = true;
							break;
						};
					};
					return r;
				});

				// check for unknown bots:
				if (!botInfo) {
					const botmatch = agent.match(/([\s\d\w\-]*bot|[\s\d\w\-]*crawler|[\s\d\w\-]*spider)[\/\s\w\-;\),\\.$]/i);
					if(botmatch) {
						botInfo = {'id': ( botmatch[1] || "other_" ), 'n': "Other" + ( botmatch[1] ? " (" + botmatch[1] + ")" : "" ) , "bot": botmatch[1] };
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

		// information on known clients (browsers):
		clients: {
			// loads the list of known clients from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.clients.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known clients");
				const url = BotMon._baseDir + 'config/known-clients.json';
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

				let match = {"n": "Unknown", "v": -1, "id": 'null'};

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

			// return the browser name for a browser ID:
			getName: function(id) {
				const it = BotMon.live.data.clients._list.find(client => client.id == id);
				return ( it && it.n ? it.n : "Unknown"); //it.n;
			},

			// indicates if the list is loaded and ready to use:
			_ready: false,

			// the actual bot list is stored here:
			_list: []

		},

		// information on known platforms (operating systems):
		platforms: {
			// loads the list of known platforms from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.platforms.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known platforms");
				const url = BotMon._baseDir + 'config/known-platforms.json';
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

				let match = {"n": "Unknown", "id": 'null'};

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

			// return the platform name for a given ID:
			getName: function(id) {
				const it = BotMon.live.data.platforms._list.find( pf => pf.id == id);
				return ( it ? it.n : 'Unknown' );
			},


			// indicates if the list is loaded and ready to use:
			_ready: false,

			// the actual bot list is stored here:
			_list: []

		},

		// storage and functions for the known bot IP-Ranges:
		ipRanges: {

			init: function() {
				//console.log('BotMon.live.data.ipRanges.init()');
				// #TODO: Load from separate IP-Ranges file
				// load the rules file:
				const me = BotMon.live.data;

				try {
					BotMon.live.data._loadSettingsFile(['user-ipranges', 'known-ipranges'],
						(json) => {

						// groups can be just saved in the data structure:
						if (json.groups && json.groups.constructor.name == 'Array') {
							me.ipRanges._groups = json.groups;
						}

						// groups can be just saved in the data structure:
						if (json.ranges && json.ranges.constructor.name == 'Array') {
							json.ranges.forEach(range => {
								me.ipRanges.add(range);
							})
						}

						// finished loading
						BotMon.live.gui.status.hideBusy("Status: Done.");
						BotMon.live.data._dispatch('ipranges')
					});
				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the config file: " + error.message);
				}
			},

			// the actual bot list is stored here:
			_list: [],
			_groups: [],

			add: function(data) {
				//console.log('BotMon.live.data.ipRanges.add(',data,')');
				
				const me = BotMon.live.data.ipRanges;

				// convert IP address to easier comparable form:
				const ip2Num = BotMon.t._ip2Num;

				let item = {
					'cidr': data.from.replaceAll(/::+/g, '::') + '/' + ( data.m ? data.m : '??' ),
					'from': ip2Num(data.from),
					'to': ip2Num(data.to),
					'm': data.m,
					'g': data.g
				};
				me._list.push(item);

			},

			getOwner: function(gid) {

				const me = BotMon.live.data.ipRanges;

				for (let i=0; i < me._groups.length; i++) {
					const it = me._groups[i];
					if (it.id == gid) {
						return it.name;
					}
				}
				return null;
			},

			match: function(ip) {
				//console.log('BotMon.live.data.ipRanges.match(',ip,')');

				const me = BotMon.live.data.ipRanges;

				// convert IP address to easier comparable form:
				const ipNum = BotMon.t._ip2Num(ip);

				for (let i=0; i < me._list.length; i++) {
					const ipRange = me._list[i];

					if (ipNum >= ipRange.from && ipNum <= ipRange.to) {
						return ipRange;
					}

				};
				return null;
			}
		},

		// storage for the rules and related functions
		rules: {

			/**
			 * Initializes the rules data.
			 *
			 * Loads the default config file and the user config file (if present).
			 * The default config file is used if the user config file does not have a certain setting.
			 * The user config file can override settings from the default config file.
			 * 
			 * The rules are loaded from the `rules` property of the config files.
			 * The IP ranges are loaded from the `ipRanges` property of the config files.
			 * 
			 * If an error occurs while loading the config file, it is displayed in the status bar.
			 * After the config file is loaded, the status bar is hidden.
			 */
			init: async function() {
				//console.info('BotMon.live.data.rules.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading list of rules …");

				// load the rules file:
				const me = BotMon.live.data;

				try {
					BotMon.live.data._loadSettingsFile(['user-config', 'default-config'],
						(json) => {

							// override the threshold?
							if (json.threshold) me._threshold = json.threshold;

							// set the rules list:
							if (json.rules && json.rules.constructor.name == 'Array') {
								me.rules._rulesList = json.rules;
							}

							BotMon.live.gui.status.hideBusy("Status: Done.");
							BotMon.live.data._dispatch('rules')
						}
					);
				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the config file: " + error.message);
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

				// check if client is on the list passed as parameter:
				matchesClient: function(visitor, ...clients) {

					const clientId = ( visitor._client ? visitor._client.id : '');
					return clients.includes(clientId);
				},

				// check if OS/Platform is one of the obsolete ones:
				matchesPlatform: function(visitor, ...platforms) {

					const pId = ( visitor._platform ? visitor._platform.id : '');

					if (visitor._platform.id == null) console.log(visitor._platform);

					return platforms.includes(pId);
				},

				// are there at lest num pages loaded?
				smallPageCount: function(visitor, num) {
					return (visitor._viewCount <= Number(num));
				},

				// There was no entry in a specific log file for this visitor:
				// note that this will also trigger the "noJavaScript" rule:
				noRecord: function(visitor, type) {
					if (!visitor._seenBy.includes('srv')) return false; // only if 'srv' is also specified!
					return !visitor._seenBy.includes(type);
				},

				// there are no referrers in any of the page visits:
				noReferrer: function(visitor) {

					let r = false; // return value
					for (let i = 0; i < visitor._pageViews.length; i++) {
						if (!visitor._pageViews[i]._ref) {
							r = true;
							break;
						}
					}
					return r;
				},

				// test for specific client identifiers:
				matchesUserAgent: function(visitor, ...list) {

					for (let i=0; i<list.length; i++) {
						if (visitor.agent == list[i]) {
							return true
						}
					};
					return false;
				},

				// unusual combinations of Platform and Client:
				combinationTest: function(visitor, ...combinations) {

					for (let i=0; i<combinations.length; i++) {

						if (visitor._platform.id == combinations[i][0]
							&& visitor._client.id == combinations[i][1]) {
								return true
						}
					};

					return false;
				},

				// is the IP address from a known bot network?
				fromKnownBotIP: function(visitor) {
					//console.info('fromKnownBotIP()', visitor.ip);

					return visitor.hasOwnProperty('_ipRange');
				},

				// is the page language mentioned in the client's accepted languages?
				// the parameter holds an array of exceptions, i.e. page languages that should be ignored.
				matchLang: function(visitor, ...exceptions) {

					if (visitor.lang && visitor.accept && exceptions.indexOf(visitor.lang) < 0) {
						return (visitor.accept.split(',').indexOf(visitor.lang) < 0);
					}
					return false;
				},

				// the "Accept language" header contains certain entries:
				clientAccepts: function(visitor, ...languages) {
					//console.info('clientAccepts', visitor.accept, languages);

					if (visitor.accept && languages) {;
						return ( visitor.accept.split(',').filter(lang => languages.includes(lang)).length > 0 );
					}
					return false;
				},

				// Is there an accept-language field defined at all?
				noAcceptLang: function(visitor) {

					if (!visitor.accept || visitor.accept.length <= 0) { // no accept-languages header
						return true;
					}
					// TODO: parametrize this!
					return false;
				},
				// At least x page views were recorded, but they come within less than y seconds
				loadSpeed: function(visitor, minItems, maxTime) {

					if (visitor._viewCount >= minItems) {
						//console.log('loadSpeed', visitor._pageViews.length, minItems, maxTime);

						const pvArr = visitor._pageViews.map(pv => pv._lastSeen).sort();

						let totalTime = 0;
						for (let i=1; i < pvArr.length; i++) {
							totalTime += (pvArr[i] - pvArr[i-1]);
						}

						//console.log('     ', totalTime , Math.round(totalTime / (pvArr.length * 1000)), (( totalTime / pvArr.length ) <= maxTime * 1000), visitor.ip);

						return (( totalTime / pvArr.length ) <= maxTime * 1000);
					}
				},

				// Country code matches one of those in the list:
				matchesCountry: function(visitor, ...countries) {

					// ingore if geoloc is not set or unknown:
					if (visitor.geo) {
						return (countries.indexOf(visitor.geo) >= 0);
					}
					return false;
				},

				// Country does not match one of the given codes.
				notFromCountry: function(visitor, ...countries) {

					// ingore if geoloc is not set or unknown:
					if (visitor.geo && visitor.geo !== 'ZZ') {
						return (countries.indexOf(visitor.geo) < 0);
					}
					return false;
				},

				// Check if visitor never went beyond a captcha
				blockedByCaptcha: function(visitor) {
					return (visitor._captcha.Y > 0 && visitor._captcha.N === 0);
				},

				// Check if visitor came from a whitelisted IP-address
				whitelistedByCaptcha: function(visitor) {
					return (visitor._captcha.W > 0);
				}
			}
		},

		/**
		 * Loads a settings file from the specified list of filenames.
		 * If the file is successfully loaded, it will call the callback function
		 * with the loaded JSON data.
		 * If no file can be loaded, it will display an error message.
		 *
		 * @param {string[]} fns - list of filenames to load
		 * @param {function} callback - function to call with the loaded JSON data
		 */
		_loadSettingsFile: async function(fns, callback) {
			//console.info('BotMon.live.data._loadSettingsFile()', fns);

			const kJsonExt = '.json';
			let loaded = false; // if successfully loaded file

			for (let i=0; i<fns.length; i++) {
				const filename = fns[i] +kJsonExt;
				try {
					const response = await fetch(DOKU_BASE + 'lib/plugins/botmon/config/' + filename);
					if (!response.ok) {
						continue;
					} else {
						loaded = true;
					}
					const json = await response.json();
					if (callback && typeof callback === 'function') {
						callback(json);
					}
					break;
				} catch (e) {
					BotMon.live.gui.status.setError("Error while loading the config file: " + filename);
				}
			}

			if (!loaded) {
				BotMon.live.gui.status.setError("Could not load a config file.");
			}
		},

		/**
		 * Loads a log file (server, page load, or ticker) and parses it.
		 * @param {String} type - the type of the log file to load (srv, log, or tck)
		 * @param {Function} [onLoaded] - an optional callback function to call after loading is finished.
		 */
		loadLogFile: async function(type, onLoaded = undefined) {
			//console.info('BotMon.live.data.loadLogFile(',type,')');

			let typeName = '';
			let columns = [];

			switch (type) {
				case "srv":
					typeName = "Server";
					columns = ['ts','ip','pg','id','typ','usr','agent','ref','lang','accept','geo','captcha'];
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
			const url = BotMon._baseDir + `logs/${BotMon._datestr}.${type}.txt`;
			//console.log("Loading:",url);

			// fetch the data:
			try {
				const response = await fetch(url);
				if (!response.ok) {

					throw new Error(`${response.status} ${response.statusText}`);

				} else {
					
					// parse the data:
					const logtxt = await response.text();
					if (logtxt.length <= 0) {
						throw new Error(`Empty log file ${url}.`);
					}

					logtxt.split('\n').forEach((line) => {

						const line2 = line.replaceAll(new RegExp('[\x00-\x1F]','g'), "\u{FFFD}").trim();
						if (line2 === '') return; // skip empty lines

						const cols = line.split('\t');
						if (cols.length == 1) return

						// assign the columns to an object:
						const data = {};
						cols.forEach( (colVal,i) => {
							const colName = columns[i] || `col${i}`;
							const colValue = (colName == 'ts' ? new Date(colVal) : colVal.trim());
							data[colName] = colValue;
						});
		
						// register the visit in the model:
						switch(type) {
							case BM_LOGTYPE.SERVER:
								BotMon.live.data.model.registerVisit(data, type);
								break;
							case BM_LOGTYPE.CLIENT:
								data.typ = 'js';
								BotMon.live.data.model.updateVisit(data);
								break;
							case BM_LOGTYPE.TICKER:
								data.typ = 'js';
								BotMon.live.data.model.updateTicks(data);
								break;
							default:
								console.warn(`Unknown log type ${type}.`);
								return;
						}
					});
				}

			} catch (error) {
				BotMon.live.gui.status.setError(`Error while loading the ${typeName} log file: ${error.message} – data may be incomplete.`);
			} finally {
				BotMon.live.gui.status.hideBusy("Status: Done.");
				if (onLoaded) {
					onLoaded(); // callback after loading is finished.
				}
			}
		}
	},

	gui: {
		init: function() {
			//console.log('BotMon.live.gui.init()');

			// init sub-objects:
			BotMon.t._callInit(this);
		},

		tabs: {
			init: function() {
				//console.log('BotMon.live.gui.tabs.init()');

				/* find and add all existing tabs */
				document.querySelectorAll('#botmon__admin *[role=tablist]')
					.forEach((tablist) => {
						tablist.querySelectorAll('*[role=tab]')
					.forEach( t => t.addEventListener('click', this._onTabClick) )
					});
			},

			/* callback for tab click */
			_onTabClick: function(e) {
				//console.log('BotMon.live.gui.tabs._onTabClick()');
				
				/* reusable constants: */
				const kAriaSelected = 'aria-selected';
				const kAriaControls = 'aria-controls';
				const kTrue = 'true';
				const kFalse = 'false';
				const kHidden = 'hidden';
				
				/* cancel default action */
				e.preventDefault();
				
				/* if the active tab is clicked, do nothing: */
				let selState = this.getAttribute(kAriaSelected);
				if ( selState && selState == kTrue ) {
					return;
				}
				
				/* find the active tab element: */
				var aItem = null;
				let tablist = this.parentNode;
				while (tablist.getAttribute('role') !== 'tablist') {
					tablist = tablist.parentNode;
				}

				if (tablist.getAttribute('role') == 'tablist') {
					let lis = tablist.querySelectorAll('*[role=tab]');
					lis.forEach( (it) => {
						let selected = it.getAttribute(kAriaSelected);
						if ( selected && selected == kTrue ) {
							aItem = it;
						}
					});
				}
				
				/* swap the active states: */
				this.setAttribute(kAriaSelected, kTrue);
				if (aItem) {
					aItem.setAttribute(kAriaSelected, kFalse);
					let aId = aItem.getAttribute(kAriaControls);
					let aObj = document.getElementById(aId);
					if (aObj) aObj.hidden = true;
				}
				
				/* show the new panel: */
				let nId = this.getAttribute(kAriaControls);
				let nObj = document.getElementById(nId);
				if (nObj) nObj.hidden = false;
			}
		},

		/* The Overview / web metrics section of the live tab */
		overview: {
			/**
			 * Populates the overview part of the today tab with the analytics data.
			 *
			 * @method make
			 * @memberof BotMon.live.gui.overview
			 */
			make: function() {

				const maxItemsPerList = 5; // how many list items to show?
				const useCaptcha = BMSettings.useCaptcha || false;

				const kNoData = '–'; // shown when data is missing
				const kSeparator = ' / ';

				// shortcuts for neater code:
				const makeElement = BotMon.t._makeElement;
				const data = BotMon.live.data.analytics.data;

				const botsVsHumans = document.getElementById('botmon__today__botsvshumans');
				if (botsVsHumans) {
					botsVsHumans.appendChild(makeElement('dt', {}, "Bot statistics"));

					for (let i = 0; i <= ( useCaptcha ? 5 : 3 ); i++) {
						const dd = makeElement('dd');
						let title = '';
						let value = '';
						switch(i) {
							case 0:
								title = "Total (loads / views / visits):";
								value = (data.loads.total || kNoData) + kSeparator + (data.views.total || kNoData) + kSeparator + (data.visits.total || kNoData);
								break;
							case 1:
								title = "Known bots (views / visits):";
								value = (data.views.bots || kNoData) + kSeparator + (data.visits.bots || kNoData);
								break;
							case 2:
								title = "Suspected bots (views / visits):";
								value = (data.visits.suspected || kNoData) + kSeparator + (data.views.suspected || kNoData)
								break;
							case 3:
								title = "Bots-humans ratio (views / visits):";
								value = BotMon.t._getRatio(data.views.suspected + data.views.bots, data.views.users + data.views.humans, 100) + kSeparator + BotMon.t._getRatio(data.visits.suspected + data.visits.bots, data.visits.users + data.visits.humans, 100);
								break;
							case 4:
								title = "Known bots blocked / passed / whitelisted:";
								value = data.captcha.bots_blocked + kSeparator + data.captcha.bots_passed + kSeparator + data.captcha.bots_whitelisted;
								break;
							case 5:
								title = "Suspected bots blocked / passed / whitelisted:";
								value = data.captcha.sus_blocked + kSeparator + data.captcha.sus_passed + kSeparator + data.captcha.sus_whitelisted;
								break;
							default:
								console.warn(`Unknown list type ${i}.`);
						}
						dd.appendChild(makeElement('span', {}, title));
						dd.appendChild(makeElement('strong', {}, value));
						botsVsHumans.appendChild(dd);
					}
				}

				// update known bots list:
				const botElement = document.getElementById('botmon__botslist'); /* Known bots */
				if (botElement) {
					botElement.appendChild(makeElement('dt', {}, `Top known bots`));

					let botList = BotMon.live.data.analytics.getTopBots(maxItemsPerList);
					botList.forEach( (botInfo) => {
						const bli = makeElement('dd');
						bli.appendChild(makeElement('span', {'class': 'has_icon bot bot_' + botInfo.id }, botInfo.name));
						bli.appendChild(makeElement('span', {'class': 'count' }, botInfo.count));
						botElement.append(bli)
					});
				}

				// update the suspected bot IP ranges list:
				const botIps = document.getElementById('botmon__botips');
				if (botIps) {
					botIps.appendChild(makeElement('dt', {}, "Top bot Networks"));

					const ispList = BotMon.live.data.analytics.getTopBotISPs(5);
					//console.log(ispList);
					ispList.forEach( (netInfo) => {
						const li = makeElement('dd');
						li.appendChild(makeElement('span', {'class': 'has_icon ipaddr ip' + netInfo.typ }, netInfo.name));
						li.appendChild(makeElement('span', {'class': 'count' }, netInfo.count));
						botIps.append(li)
					});
				}

				// update the top bot countries list:
				const botCountries = document.getElementById('botmon__botcountries');
				if (botCountries) {
					botCountries.appendChild(makeElement('dt', {}, `Top bot Countries`));
					const countryList = BotMon.live.data.analytics.getCountryList('bot', 5);
					countryList.forEach( (cInfo) => {
						const cLi = makeElement('dd');
						cLi.appendChild(makeElement('span', {'class': 'has_icon country ctry_' + cInfo.id.toLowerCase() }, cInfo.name));
						cLi.appendChild(makeElement('span', {'class': 'count' }, cInfo.count));
						botCountries.appendChild(cLi);
					});
				}

				// update the webmetrics overview:
				const wmoverview = document.getElementById('botmon__today__wm_overview');
				if (wmoverview) {

					const humanVisits = data.views.total;
					const bounceRate = Math.round(100 * (BotMon.live.data.analytics.getBounceCount('users') + BotMon.live.data.analytics.getBounceCount('humans')) / humanVisits);

					wmoverview.appendChild(makeElement('dt', {}, "Humans’ metrics"));
					for (let i = 0; i <= 4; i++) { 
						const dd = makeElement('dd');
						let title = '';
						let value = '';
						switch(i) {
							case 0:
								title = "Registered users (views / visits):";
								value = (data.views.users || kNoData) + kSeparator + (data.visits.users || kNoData);
								break;
							case 1:
								title = "Probably humans (views / visits):";
								value = (data.views.humans || kNoData) + kSeparator + (data.visits.humans || kNoData);
								break;
							case 2:
								title = "Total human page views:";
								value = (data.views.users + data.views.humans) || kNoData;
								break;
							case 3:
								title = "Total human visits:";
								value = data.views.total || kNoData;
								break;
							case 4:
								title = "Humans’ bounce rate:";
								value = bounceRate + '%';
								break;
							default:
								console.warn(`Unknown list type ${i}.`);
						}
						dd.appendChild(makeElement('span', {}, title));
						dd.appendChild(makeElement('strong', {}, value));
						wmoverview.appendChild(dd);
					}
				}

				// update the webmetrics clients list:
				const wmclients = document.getElementById('botmon__today__wm_clients');
				if (wmclients) {

					wmclients.appendChild(makeElement('dt', {}, "Browsers"));

					const clientList = BotMon.live.data.analytics.getTopBrowsers(maxItemsPerList);
					if (clientList) {
						clientList.forEach( (cInfo) => {
							const cDd = makeElement('dd');
							cDd.appendChild(makeElement('span', {'class': 'has_icon client cl_' + cInfo.id }, ( cInfo.name ? cInfo.name : cInfo.id)));
							cDd.appendChild(makeElement('span', {
								'class': 'count',
								'title': cInfo.count + " page views"
							}, cInfo.pct.toFixed(1) + '%'));
							wmclients.appendChild(cDd);
						});
					}
				}

				// update the webmetrics platforms list:
				const wmplatforms = document.getElementById('botmon__today__wm_platforms');
				if (wmplatforms) {

					wmplatforms.appendChild(makeElement('dt', {}, "Platforms"));

					const pfList = BotMon.live.data.analytics.getTopPlatforms(maxItemsPerList);
					if (pfList) {
						pfList.forEach( (pInfo) => {
							const pDd = makeElement('dd');
							pDd.appendChild(makeElement('span', {'class': 'has_icon platform pf_' + pInfo.id }, ( pInfo.name ? pInfo.name : pInfo.id)));
							pDd.appendChild(makeElement('span', {
								'class': 'count',
								'title': pInfo.count + " page views"
							}, pInfo.pct.toFixed(1) + '%'));
							wmplatforms.appendChild(pDd);
						});
					}
				}

				// update the top bot countries list:
				const usrCountries = document.getElementById('botmon__today__wm_countries');
				if (usrCountries) {
					usrCountries.appendChild(makeElement('dt', {}, `Top visitor Countries:`));
					const usrCtryList = BotMon.live.data.analytics.getCountryList('human', 5);
					usrCtryList.forEach( (cInfo) => {
						const cLi = makeElement('dd');
						cLi.appendChild(makeElement('span', {'class': 'has_icon country ctry_' + cInfo.id.toLowerCase() }, cInfo.name));
						cLi.appendChild(makeElement('span', {'class': 'count' }, cInfo.count));
						usrCountries.appendChild(cLi);
					});
				}

				// update the top pages;
				const wmpages = document.getElementById('botmon__today__wm_pages');
				if (wmpages) {

					wmpages.appendChild(makeElement('dt', {}, "Top pages"));

					const pgList = BotMon.live.data.analytics.getTopPages(maxItemsPerList);
					if (pgList) {
						pgList.forEach( (pgInfo) => {
							const pgDd = makeElement('dd');
							pgDd.appendChild(makeElement('a', {
								'class': 'page_icon',
								'href': DOKU_BASE + 'doku.php?id=' + encodeURIComponent(pgInfo.id),
								'target': 'preview',
								'title': "PageID: " + pgInfo.id
							}, pgInfo.id));
							pgDd.appendChild(makeElement('span', {
								'class': 'count',
								'title': pgInfo.count + " page views"
							}, pgInfo.count));
							wmpages.appendChild(pgDd);
						});
					}
				}

				// update the top referrers;
				const wmreferers = document.getElementById('botmon__today__wm_referers');
				if (wmreferers) {

					wmreferers.appendChild(makeElement('dt', {}, "Referers"));

					const refList = BotMon.live.data.analytics.getTopReferers(maxItemsPerList);
					if (refList) {
						refList.forEach( (rInfo) => {
							const rDd = makeElement('dd');
							rDd.appendChild(makeElement('span', {'class': 'has_icon referer ref_' + rInfo.id }, rInfo.name));
							rDd.appendChild(makeElement('span', {
								'class': 'count',
								'title': rInfo.count + " references"
							}, rInfo.pct.toFixed(1) + '%'));
							wmreferers.appendChild(rDd);
						});
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
					el.innerText = "Data may be incomplete.";
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
						let infolink = null;
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
								infolink = 'https://leib.be/sascha/projects/dokuwiki/botmon/info/suspected_bots';
								break;
							case 3:
								listTitle = "Known bots";
								listId = 'knownBots';
								infolink = 'https://leib.be/sascha/projects/dokuwiki/botmon/info/known_bots';
								break;
							default:
								console.warn('Unknown list number.');
						}

						const details = makeElement('details', {
							'data-group': listId,
							'data-loaded': false
						});
						const title = details.appendChild(makeElement('summary'));
						title.appendChild(makeElement('span', {'class': 'title'}, listTitle));
						if (infolink) {
							title.appendChild(makeElement('a', {
								'class': 'ext_info', 
								'target': '_blank',
								'href': infolink,
								'title': "More information"
							}, "Info"));
						}
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

				// shortcuts for neater code:
				const make = BotMon.t._makeElement;
				const model = BotMon.live.data.model;

				let ipType = ( data.ip.indexOf(':') >= 0 ? '6' : '4' );
				if (data.ip == '127.0.0.1' || data.ip == '::1' ) ipType = '0';

				const platformName = (data._platform ? data._platform.n : 'Unknown');
				const clientName = (data._client ? data._client.n: 'Unknown');

				const sumClass = ( !data._seenBy || data._seenBy.indexOf(BM_LOGTYPE.SERVER) < 0 ? 'noServer' : 'hasServer');

				// combine with other networks?
				const combineNets = (BMSettings.hasOwnProperty('combineNets') ? BMSettings['combineNets'] : true)
					&& data.hasOwnProperty('_ipRange');

				const li = make('li'); // root list item
				const details = make('details');
				const summary = make('summary', {
					'class': sumClass
				});
				details.appendChild(summary);

				const span1 = make('span'); /* left-hand group */

				/*if (data._type !== BM_USERTYPE.KNOWN_BOT) { // No platform/client for bots // disabled because no longer relevant
					span1.appendChild(make('span', { // Platform 
						'class': 'icon_only platform pf_' + (data._platform ? data._platform.id : 'unknown'),
						'title': "Platform: " + platformName
					}, platformName));

					span1.appendChild(make('span', { // Client 
						'class': 'icon_only client client cl_' + (data._client ? data._client.id : 'unknown'),
						'title': "Client: " + clientName
					}, clientName));
				}*/

				// identifier:
				if (data._type == BM_USERTYPE.KNOWN_BOT) { /* Bot only */

					const botName = ( data._bot && data._bot.n ? data._bot.n : "Unknown");
					span1.appendChild(make('span', { /* Bot */
						'class': 'has_icon bot bot_' + (data._bot ? data._bot.id : 'unknown'),
						'title': "Bot: " + botName
					}, botName));

				} else if (data._type == BM_USERTYPE.KNOWN_USER) { /* User only */

					span1.appendChild(make('span', { /* User */
						'class': 'has_icon user_known',
						'title': "User: " + data.usr
					}, data.usr));

				} else { /* others */

					if (combineNets) {

						const ispName = BotMon.live.data.ipRanges.getOwner( data._ipRange.g ) || data._ipRange.g;

						span1.appendChild(make('span', { // IP-Address
							'class': 'has_icon ipaddr ipnet',
							'title': "IP-Range: " + data._ipRange.g
						}, ispName));

					} else {

						span1.appendChild(make('span', { // IP-Address
							'class': 'has_icon ipaddr ip' + ipType,
							'title': "IP-Address: " + data.ip
						}, data.ip));
					}
				}

				span1.appendChild(make('span', { /* page views */
					'class': 'has_icon pageseen',
					'title': data._pageViews.length + " page load(s)"
				}, data._pageViews.length));


				// referer icons:
				if ((data._type == BM_USERTYPE.PROBABLY_HUMAN || data._type == BM_USERTYPE.LIKELY_BOT) && data.ref) {
					const refInfo = BotMon.live.data.analytics.getRefererInfo(data.ref);
					span1.appendChild(make('span', {
						'class': 'icon_only referer ref_' + refInfo.id,
						'title': "Referer: " + data.ref
					}, refInfo.n));
				}

				summary.appendChild(span1);
				const span2 = make('span'); /* right-hand group */

				// country flag:
				if (!combineNets) { // not for combined networks
					if (data.geo && data.geo !== 'ZZ') {
						span2.appendChild(make('span', {
							'class': 'icon_only country ctry_' + data.geo.toLowerCase(),
							'data-ctry': data.geo,
							'title': "Country: " + ( data._country || "Unknown")
						}, ( data._country || "Unknown") ));
					}
				}

				span2.appendChild(make('span', { // seen-by icon:
					'class': 'icon_only seenby sb_' + data._seenBy.join(''),
					'title': "Seen by: " + data._seenBy.join('+')
				}, data._seenBy.join(', ')));

				// captcha status:
				const cCode = ( data._captcha ? data._captcha._str() : '');
				if (cCode !== '') {
					const cTitle = model._makeCaptchaTitle(data._captcha)
					span2.appendChild(make('span', { // captcha status
						'class': 'icon_only captcha cap_' + cCode,
						'title': "Captcha-status: " + cTitle
					}, cTitle));
				}

				summary.appendChild(span2);

				// add details expandable section:
				details.appendChild(BotMon.live.gui.lists._makeVisitorDetails(data, type));

				li.appendChild(details);
				return li;
			},

			_makeVisitorDetails: function(data, type) {

				// shortcuts for neater code:
				const make = BotMon.t._makeElement;
				const model = BotMon.live.data.model;

				let ipType = ( data.ip.indexOf(':') >= 0 ? '6' : '4' );
				if (data.ip == '127.0.0.1' || data.ip == '::1' ) ipType = '0';
				const platformName = (data._platform ? data._platform.n : 'Unknown');
				const clientName = (data._client ? data._client.n: 'Unknown');

				const dl = make('dl', {'class': 'visitor_details'});
				
				if (data._type == BM_USERTYPE.KNOWN_BOT) {

					dl.appendChild(make('dt', {}, "Bot name:")); /* bot info */
					dl.appendChild(make('dd', {'class': 'icon_only bot bot_' + (data._bot ? data._bot.id : 'unknown')},
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
					dl.appendChild(make('dd', {'class': 'has_icon client cl_' + (data._client ? data._client.id : 'unknown')},
						clientName + ( data._client.v > 0 ? ' (' + data._client.v + ')' : '' ) ));

					dl.appendChild(make('dt', {}, "Platform:")); /* platform */
					dl.appendChild(make('dd', {'class': 'has_icon platform pf_' + (data._platform ? data._platform.id : 'unknown')},
						platformName + ( data._platform.v > 0 ? ' (' + data._platform.v + ')' : '' ) ));

					/*dl.appendChild(make('dt', {}, "ID:"));
					dl.appendChild(make('dd', {'class': 'has_icon ip' + data.typ}, data.id));*/
				}

				dl.appendChild(make('dt', {}, "IP-Address:"));
				const ipItem = make('dd', {'class': 'has_icon ipaddr ip' + ipType});
					ipItem.appendChild(make('span', {'class': 'address'} , data.ip));
					ipItem.appendChild(make('a', {
						'class': 'icon_only extlink ipinfo',
						'href': `https://ipinfo.io/${encodeURIComponent(data.ip)}`,
						'target': 'ipinfo',
						'title': "View this address on IPInfo.io"
					} , "DNS Info"));
					ipItem.appendChild(make('a', {
						'class': 'icon_only extlink abuseipdb',
						'href': `https://www.abuseipdb.com/check/${encodeURIComponent(data.ip)}`,
						'target': 'abuseipdb',
						'title': "Check this address on AbuseIPDB.com"
					} , "Check on AbuseIPDB"));
				dl.appendChild(ipItem);

				if (Math.abs(data._lastSeen - data._firstSeen) < 100) {
					dl.appendChild(make('dt', {}, "Seen:"));
					dl.appendChild(make('dd', {'class': 'seen'}, data._firstSeen.toLocaleString()));
				} else {
					dl.appendChild(make('dt', {}, "First seen:"));
					dl.appendChild(make('dd', {'class': 'firstSeen'}, data._firstSeen.toLocaleString()));
					dl.appendChild(make('dt', {}, "Last seen:"));
					dl.appendChild(make('dd', {'class': 'lastSeen'}, data._lastSeen.toLocaleString()));
				}

				dl.appendChild(make('dt', {}, "Actions:"));
				dl.appendChild(make('dd', {'class': 'views'},
					"Page loads: " + data._loadCount.toString() +
					( data._captcha['Y'] > 0 || data._captcha['W'] || data._captcha['-'] > 0 ? ", captchas: " + (data._captcha['Y']+data._captcha['W']+data._captcha['-']).toString() : '') +
					", views: " + data._viewCount.toString()
				));

				dl.appendChild(make('dt', {}, "User-Agent:"));
				dl.appendChild(make('dd', {'class': 'agent'}, data.agent));

				if (data.ref && data.ref !== '') {
					dl.appendChild(make('dt', {}, "Referrer:"));
					
					const refInfo = BotMon.live.data.analytics.getRefererInfo(data.ref);
					const refDd = dl.appendChild(make('dd', {
						'class': 'has_icon referer ref_' + refInfo.id
					}));
					refDd.appendChild(make('a', {
						'href': data.ref,
						'target': 'refTarget'
					}, data.ref));
				}

				dl.appendChild(make('dt', {}, "Languages:"));
				dl.appendChild(make('dd', {'class': 'langs'}, ` [${data.accept}]`));

				if (data.geo && data.geo !=='') {
					dl.appendChild(make('dt', {}, "Location:"));
					dl.appendChild(make('dd', {
						'class': 'has_icon country ctry_' + data.geo.toLowerCase(),
						'data-ctry': data.geo,
						'title': "Country: " + data._country
					}, data._country + ' (' + data.geo + ')'));
				}

				if (data.captcha && data.captcha !=='') {
					dl.appendChild(make('dt', {}, "Captcha-status:"));
					dl.appendChild(make('dd', {
						'class': 'captcha'
					}, model._makeCaptchaTitle(data._captcha)));
				}

				dl.appendChild(make('dt', {}, "Session ID:"));
				dl.appendChild(make('dd', {'class': 'has_icon session typ_' + data.typ}, data.id));

				dl.appendChild(make('dt', {}, "Seen by:"));
				dl.appendChild(make('dd', {'class': 'has_icon seenby sb_' + data._seenBy.join('')}, data._seenBy.join(', ') ));

				dl.appendChild(make('dt', {}, "Visited pages:"));
				const pagesDd = make('dd', {'class': 'pages'});
				const pageList = make('ul');

				/* list all page views */
				data._pageViews.sort( (a, b) => a._firstSeen - b._firstSeen );
				data._pageViews.forEach( (page) => {
					pageList.appendChild(BotMon.live.gui.lists._makePageViewItem(page));
				});
				pagesDd.appendChild(pageList);
				dl.appendChild(pagesDd);

				/* bot evaluation rating */
				if (data._type !== BM_USERTYPE.KNOWN_BOT && data._type !== BM_USERTYPE.KNOWN_USER) {
					dl.appendChild(make('dt', undefined, "Bot rating:"));
					dl.appendChild(make('dd', {'class': 'bot-rating'}, ( data._botVal ? data._botVal : '–' ) + ' (of ' + BotMon.live.data.rules._threshold + ')'));

					/* add bot evaluation details: */
					if (data._eval) {
						dl.appendChild(make('dt', {}, "Bot evaluation:"));
						const evalDd = make('dd', {'class': 'eval'});
						const testList = make('ul');
						data._eval.forEach( test => {

							const tObj = BotMon.live.data.rules.getRuleInfo(test);
							let tDesc = tObj ? tObj.desc : test;

							// special case for Bot IP range test:
							if (tObj.func == 'fromKnownBotIP') {
								const rangeInfo = BotMon.live.data.ipRanges.match(data.ip);
								if (rangeInfo) {
									const owner = BotMon.live.data.ipRanges.getOwner(rangeInfo.g);
									tDesc += ' (range: “' + rangeInfo.cidr + '”, ' + owner + ')';
								}
							}

							// create the entry field
							const tstLi = make('li');
							tstLi.appendChild(make('span', {
								'data-testid': test
							}, tDesc));
							tstLi.appendChild(make('span', {}, ( tObj ? tObj.bot : '—') ));
							testList.appendChild(tstLi);
						});

						// add total row 
						const tst2Li = make('li', {
							'class': 'total'
						});
						/*tst2Li.appendChild(make('span', {}, "Total:"));
						tst2Li.appendChild(make('span', {}, data._botVal));
						testList.appendChild(tst2Li);*/

						evalDd.appendChild(testList);
						dl.appendChild(evalDd);
					}
				}

				// for debugging only. Disable on production:
				/*dl.appendChild(make('dt', {}, "Debug info:"));
				const dbgDd = make('dd', {'class': 'debug'});
				dbgDd.innerHTML = '<pre>' + JSON.stringify(data, null, 4) + '</pre>';
				dl.appendChild(dbgDd);*/

				// return the element to add to the UI:
				return dl;
			},

			// make a page view item:
			_makePageViewItem: function(page) {
				//console.log("makePageViewItem:",page);

				// shortcut for neater code:
				const make = BotMon.t._makeElement;

				// the actual list item:
				const pgLi = make('li');

				const row1 = make('div', {'class': 'row'});

					row1.appendChild(make('a', { // page id is the left group
						'href': DOKU_BASE + 'doku.php?id=' + encodeURIComponent(page.pg),
						'target': 'preview',
						'hreflang': page.lang,
						'title': "PageID: " + page.pg
					}, page.pg)); /* DW Page ID */

					const rightGroup = row1.appendChild(make('div')); // right-hand group

						// get the time difference:
						rightGroup.appendChild(make('span', {
							'class': 'first-seen',
							'title': "First visited: " + page._firstSeen.toLocaleString() + " UTC"
						}, BotMon.t._formatTime(page._firstSeen)));
						
						rightGroup.appendChild(make('span', { /* page loads */
							'class': 'has_icon pageviews',
							'title': page._viewCount.toString() + " page load(s)"
						}, page._viewCount.toString()));

				pgLi.appendChild(row1);

				/* LINE 2 */

				const row2 = make('div', {'class': 'row'});

					// page referrer:
					if (page._ref) {
						row2.appendChild(make('span', {
							'class': 'referer',
							'title': "Referrer: " + page._ref.href
						}, page._ref.hostname));
					} else {
						row2.appendChild(make('span', {
							'class': 'referer'
						}, "No referer"));
					}

					// visit duration:
					let visitTimeStr = "Bounce";
					const visitDuration = page._lastSeen.getTime() - page._firstSeen.getTime();
					if (visitDuration > 0) {
						visitTimeStr = Math.floor(visitDuration / 1000) + "s";
					}
					const tDiff = BotMon.t._formatTimeDiff(page._firstSeen, page._lastSeen);
					if (tDiff) {
						row2.appendChild(make('span', {'class': 'visit-length', 'title': 'Last seen: ' + page._lastSeen.toLocaleString()}, tDiff));
					} else {
						row2.appendChild(make('span', {
							'class': 'bounce',
							'title': "Visitor bounced"}, "Bounce"));
					}

				pgLi.appendChild(row2);

				return pgLi;
			}
		}
	}
};

/* launch only if the BotMon admin panel is open: */
if (document.getElementById('botmon__admin')) {
	BotMon.init();
}