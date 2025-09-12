"use strict";
/* DokuWiki BotMon Plugin Script file */
/* 12.09.2025 - 0.3.0 - beta */
/* Author: Sascha Leib <ad@hominem.info> */

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
		this._DWBaseDir = document.currentScript.src.substring(0, document.currentScript.src.indexOf('/lib/')) + '/';

		// read the page language from the DOM:
		this._lang = document.getRootNode().documentElement.lang || this._lang;

		// get the time offset:
		this._timeDiff = BotMon.t._getTimeOffset();

		// init the sub-objects:
		BotMon.t._callInit(this);
	},

	_baseDir: null,
	_DWBaseDir: null,
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
		},

		/* helper to convert an ip address string to a normalised format: */
		_ip2Num: function(ip) {
			if (ip.indexOf(':') > 0) { /* IP6 */
				return (ip.split(':').map(d => ('0000'+d).slice(-4) ).join(''));
			} else { /* IP4 */
				return Number(ip.split('.').map(d => ('000'+d).slice(-3) ).join(''));
			}
		},

		/* helper function to format a Date object to show only the time. */
		/* returns String */
		_formatTime: function(date) {

			if (date) {
				return ('0'+date.getHours()).slice(-2) + ':' + ('0'+date.getMinutes()).slice(-2) + ':' + ('0'+date.getSeconds()).slice(-2);
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
				case 'rules':
					data._dispatchRulesLoaded = true;
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

				const timeout = 60 * 60 * 1000; // session timeout: One hour

				// loop over all visitors already registered:
				for (let i=0; i<model._visitors.length; i++) {
					const v = model._visitors[i];

					if (visitor._type == BM_USERTYPE.KNOWN_BOT) { // known bots

						// bots match when their ID matches:
						if (v._bot && v._bot.id == visitor._bot.id) {
							return v;
						}

					} else { /*if (visitor._type == BM_USERTYPE.KNOWN_USER) { // registered users

						// visitors match when their names match:
						if ( v.usr == visitor.usr
						&& v.ip == visitor.ip
						&& v.agent == visitor.agent) {
							return v;
						}
					} else { // any other visitor

						if (Math.abs(v._lastSeen - visitor.ts) < timeout) { // ignore timed out visits */
							if ( v.id == visitor.id) { // match the DW/PHP IDs
								return v;
							}
						/*}*/
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

				// country name:
				try {
					nv._country = ( nv.geo == 'local' ? "localhost" : "Unknown" );
					if (nv.geo && nv.geo !== '' && nv.geo !== 'ZZ' && nv.geo !== 'local') {
						const countryName = new Intl.DisplayNames(['en', BotMon._lang], {type: 'region'});
						nv._country = countryName.of(nv.geo) ?? nv.geo;
					}
				} catch (err) {
					console.error(err);
					nv._country = 'Error';
				}

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
				} else { // update existing 
					if (visitor._firstSeen > nv.ts) {
						visitor._firstSeen = nv.ts;
					}
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
					prereg._tickCount += 1;
				}

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

				const type = 'log';

				let visitor = BotMon.live.data.model.findVisitor(dat);
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

				const type = 'tck';

				// find the visit info:
				let visitor = model.findVisitor(dat);
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
						console.warn(`No page view for visit ID “${dat.id}”, page “${dat.pg}”, registering a new one.`);
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

				// try to parse the referrer:
				let rUrl = null;
				try {
					rUrl = ( data.ref && data.ref !== '' ? new URL(data.ref) : null );
				} catch (e) {
					console.info(`Invalid referer: “${data.ref}”.`);
				}

				return {
					_by: type,
					ip: data.ip,
					pg: data.pg,
					_ref: rUrl,
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
				humanPageViews: 0,
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
				const me = BotMon.live.data.analytics;

				BotMon.live.gui.status.showBusy("Analysing data …");

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
					}

					// perform actions depending on the visitor type:
					if (v._type == BM_USERTYPE.KNOWN_BOT || v._type == BM_USERTYPE.LIKELY_BOT) { /* bots only */
						
						// add bot views to IP range information:
						v._pageViews.forEach( pv => {
							me.addToIPRanges(pv.ip);
						});

						// add to the country lists:
						me.addToCountries(v.geo, v._country, v._type);

					} else { /* humans only */

						// add browser and platform statistics:
						me.addBrowserPlatform(v);
					}
	
				});

				BotMon.live.gui.status.hideBusy('Done.');
			},

			// visits from IP ranges:
			_ipRange: {
				ip4: [],
				ip6: []
			},
			/**
			 * Adds a visit to the IP range statistics.
			 * 
			 * This helps to identify IP ranges that are used by bots.
			 * 
			 * @param {string} ip The IP address to add.
			 */
			addToIPRanges: function(ip) {

				// #TODO: handle nestled ranges!
				const me = BotMon.live.data.analytics;
				const ipv = (ip.indexOf(':') > 0 ? 6 : 4);
				
				const ipArr = ip.split( ipv == 6 ? ':' : '.');
				const maxSegments = (ipv == 6 ? 4 : 3);

				let arr = (ipv == 6 ? me._ipRange.ip6 : me._ipRange.ip4);

				// find any existing segment entry:
				it = null;
				for (let i=0; i < arr.length; i++) {
					const sig = arr[i];
					if (sig.seg == ipArr[0]) {
						it = sig;
						break;
					}
				}
				
				// create if not found:
				if (!it) {
					it = {seg: ipArr[0], count: 1};
					//if (i<maxSegments) it.sub = [];
					arr.push(it);

				} else { // increase count:

					it.count += 1;
				}
			
			},
			getTopBotIPRanges: function(max) {

				const me = BotMon.live.data.analytics;

				const kMinHits = 2;

				// combine the ip lists, removing all lower volume branches:
				let ipTypes = [4,6];
				const tmpList = [];
				for (let i=0; i<ipTypes.length; i++) {
					const ipType = ipTypes[i];
					(ipType == 6 ? me._ipRange.ip6 : me._ipRange.ip4).forEach( it => {
						if (it.count > kMinHits) {
							it.type = ipType;
							tmpList.push(it);
						}
						});
					tmpList.sort( (a,b) => b.count - a.count);
				}

				// reduce to only the top (max) items and create the target format:
				// #TODO: handle nestled ranges!
				let rList = [];
				for (let j=0; Math.min(max, tmpList.length) > j; j++) {
					const rangeInfo = tmpList[j];
					rList.push({
						'ip': rangeInfo.seg + ( rangeInfo.type == 4 ? '.x.x.x' : '::x'),
						'typ': rangeInfo.type,
						'num': rangeInfo.count
					});
				}
				
				return rList;
			},

			/* countries of visits */
			_countries: {
				'user': [],
				'human': [],
				'likelyBot': [],
				'known_bot': []

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
						arr = me._countries.user;
						break;
					case BM_USERTYPE.HUMAN:
						arr = me._countries.human;
						break;
					case BM_USERTYPE.LIKELY_BOT:
						arr = me._countries.likelyBot;
						break;
					case BM_USERTYPE.KNOWN_BOT:
						arr = me._countries.known_bot;
						break;
					default:
						console.warn(`Unknown user type ${type} in function addToCountries.`);
				}

				if (arr) {
					let cRec = arr.find( it => it.iso == iso);
					if (!cRec) {
						cRec = {
							'iso': iso,
							'name': name,
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
			 * @param {BM_USERTYPE} type The type of visitors to return.
			 * @param {number} max The maximum number of entries to return.
			 * @return {Array} A list of objects with properties 'iso' (ISO 3166-1 alpha-2 country code) and 'count' (visit count).
			 */
			getCountryList: function(type, max) {

				const me = BotMon.live.data.analytics;

				// find the correct array:
				let arr = null;
				switch (type) {
					
					case BM_USERTYPE.KNOWN_USER:
						arr = me._countries.user;
						break;
					case BM_USERTYPE.HUMAN:
						arr = me._countries.human;
						break;
					case BM_USERTYPE.LIKELY_BOT:
						arr = me._countries.likelyBot;
						break;
					case BM_USERTYPE.KNOWN_BOT:
						arr = me._countries.known_bot;
						break;
					default:
						console.warn(`Unknown user type ${type} in function getCountryList.`);
				}
				
				if (arr) {
					// sort by visit count:
					arr.sort( (a,b) => b.count - a.count);

					// reduce to only the top (max) items and create the target format:
					let rList = [];
					for (let i=0; Math.min(max, arr.length) > i; i++) {
						const cRec = arr[i];
						rList.push({
							'iso': cRec.iso,
							'name': cRec.name,
							'count': cRec.count
						});
					}
					return rList;
				}
				return [];
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
							'id': browserRec.id,
							'count': 1
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
							'id': platformRec.id,
							'count': 1
						};
						me._platforms.push(pRec);
					} else {
						pRec.count += 1;
					}
				}

			},

			getTopBrowsers: function(max) {
			
				const me = BotMon.live.data.analytics;
				
				me._browsers.sort( (a,b) => b.count - a.count);

				// how many browsers to show:
				const max2 = ( me._browsers.length >= max ? max-1 : max );

				const rArr = []; // return array
				let total = 0;
				const others = {
					'id': 'other',
					'name': "Others",
					'count': 0
				};
				for (let i=0; i < me._browsers.length; i++) {
					if (i < max2) {
						rArr.push({
							'id': me._browsers[i].id,
							'name': BotMon.live.data.clients.getName(me._browsers[i].id),
							'count': me._browsers[i].count
						});
						total += me._browsers[i].count;
					} else {
						others.count += me._browsers[i].count;
						total += me._browsers[i].count;
					}
				};

				if (me._browsers.length > (max-1)) {
					rArr.push(others);
				};

				// update percentages:
				rArr.forEach( it => {
					it.pct = Math.round(it.count * 100 / total);
				});

				return rArr;
			},

			getTopPlatforms: function(max) {

				const me = BotMon.live.data.analytics;
				
				me._platforms.sort( (a,b) => b.count - a.count);
				// how many browsers to show:
				const max2 = ( me._platforms.length >= max ? max-1 : max );

				const rArr = []; // return array
				let total = 0;
				const others = {
					'id': 'other',
					'name': "Others",
					'count': 0
				};
				for (let i=0; i < me._platforms.length; i++) {
					if (i < max2) {
						rArr.push({
							'id': me._platforms[i].id,
							'name': BotMon.live.data.platforms.getName(me._platforms[i].id),
							'count': me._platforms[i].count
						});
						total += me._platforms[i].count;
					} else {
						others.count += me._platforms[i].count;
						total += me._platforms[i].count;
					}
				};

				if (me._platforms.length > (max-1)) {
					rArr.push(others);
				};

				// update percentages:				
				rArr.forEach( it => {
					it.pct = Math.round(it.count * 100 / total);
				});

				return rArr;
			}
		},

		bots: {
			// loads the list of known bots from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.bots.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known bots …");
				const url = BotMon._baseDir + 'conf/known-bots.json';
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
					const botmatch = agent.match(/([\s\d\w]*bot|[\s\d\w]*crawler|[\s\d\w]*spider)[\/\s;\),\\.$]/i);
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

		clients: {
			// loads the list of known clients from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.clients.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading known clients");
				const url = BotMon._baseDir + 'conf/known-clients.json';
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

			// return the browser name for a browser ID:
			getName: function(id) {
				const it = BotMon.live.data.clients._list.find(client => client.id == id);
				return it.n;
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
				const url = BotMon._baseDir + 'conf/known-platforms.json';
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

		rules: {
			// loads the list of rules and settings from a JSON file:
			init: async function() {
				//console.info('BotMon.live.data.rules.init()');

				// Load the list of known bots:
				BotMon.live.gui.status.showBusy("Loading list of rules …");

				// relative file path to the rules file:
				const filePath = 'conf/botmon-config.json';

				// check if the user has a configuration file in their DokuWiki installation,
				// then load the appropriate file:
				this._checkForUserConfig( filePath, (hasUserConfig) => {
					this._loadrulesFile(( hasUserConfig ? BotMon._DWBaseDir : BotMon._baseDir ) + filePath);
				});				
			},

			/**
			 * Loads the list of rules and settings from a JSON file.
			 * @param {String} url - the URL from which to load the rules file.
			 */
			
			_loadrulesFile: async function(url) {
				//console.info('BotMon.live.data.rules._loadrulesFile(',url,')');}

				const me = BotMon.live.data.rules;
				try {
					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`${response.status} ${response.statusText}`);
					}

					const json = await response.json();

					if (json.rules) {
						me._rulesList = json.rules;
					}

					// override the threshold?
					if (json.threshold) me._threshold = json.threshold;

					if (json.ipRanges) {
						// clean up the IPs first:
						let list = [];
						json.ipRanges.forEach( it => {
							let item = {
								'from': BotMon.t._ip2Num(it.from),
								'to': BotMon.t._ip2Num(it.to),
								'label': it.label
							};
							list.push(item);
						});

						me._botIPs = list;
					}

					me._ready = true;

				} catch (error) {
					BotMon.live.gui.status.setError("Error while loading the ‘rules’ file: " + error.message);
				} finally {
					BotMon.live.gui.status.hideBusy("Status: Done.");
					BotMon.live.data._dispatch('rules')
				}
			},

			/**
			 * Checks if the user has a configuration file in their DokuWiki installation.
			 * @param {function} whenDone - an optional callback function to call when the check is finished.
			 */
			_checkForUserConfig: async function(filePath, whenDone = undefined) {
				//console.info('BotMon.live.data.rules._checkForUserConfig()');
				
				let hasUserConfig = false;
				try {
					const response = await fetch(BotMon._DWBaseDir + '/' + filePath, {
						method: 'HEAD'
					});
					hasUserConfig = response.ok;
				} catch (err) {
					console.info("An error occured while trying to check for a user configuration file:", err);
				} finally {
					if (whenDone) {
						whenDone(hasUserConfig);
					}
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
					return platforms.includes(pId);
				},

				// are there at lest num pages loaded?
				smallPageCount: function(visitor, num) {
					return (visitor._pageViews.length <= Number(num));
				},

				// There was no entry in a specific log file for this visitor:
				// note that this will also trigger the "noJavaScript" rule:
				noRecord: function(visitor, type) {
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
				/*matchesClients: function(visitor, ...list) {

					for (let i=0; i<list.length; i++) {
						if (visitor._client.id == list[i]) {
								return true
						}
					};
					return false;
				},*/

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

					const ipInfo = BotMon.live.data.rules.getBotIPInfo(visitor.ip);

					if (ipInfo) {
						visitor._ipInKnownBotRange = true;
					}

					return (ipInfo !== null);
				},

				// is the page language mentioned in the client's accepted languages?
				// the parameter holds an array of exceptions, i.e. page languages that should be ignored.
				matchLang: function(visitor, ...exceptions) {

					if (visitor.lang && visitor.accept && exceptions.indexOf(visitor.lang) < 0) {
						return (visitor.accept.split(',').indexOf(visitor.lang) < 0);
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

					if (visitor._pageViews.length >= minItems) {
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
				}
			},

			/* known bot IP ranges: */
			_botIPs: [],

			// return information on a bot IP range:
			getBotIPInfo: function(ip) {

				// shortcut to make code more readable:
				const me = BotMon.live.data.rules;

				// convert IP address to easier comparable form:
				const ipNum = BotMon.t._ip2Num(ip);

				for (let i=0; i < me._botIPs.length; i++) {
					const ipRange = me._botIPs[i];

					if (ipNum >= ipRange.from && ipNum <= ipRange.to) {
						return ipRange;
					}

				};
				return null;

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
					columns = ['ts','ip','pg','id','typ','usr','agent','ref','lang','accept','geo'];
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

				} else {
					
					// parse the data:
					const logtxt = await response.text();
					if (logtxt.length <= 0) {
						throw new Error(`Empty log file ${url}.`);
					}

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
				}

			} catch (error) {
				BotMon.live.gui.status.setError(`Error while loading the ${typeName} log file: ${error.message}.`);
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
			// init the lists view:
			this.lists.init();
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

				const data = BotMon.live.data.analytics.data;

				// shortcut for neater code:
				const makeElement = BotMon.t._makeElement;

				const botsVsHumans = document.getElementById('botmon__today__botsvshumans');
				if (botsVsHumans) {
					botsVsHumans.appendChild(makeElement('dt', {}, "Bots vs. Humans"));

					for (let i = 3; i >= 0; i--) {
						const dd = makeElement('dd');
						let title = '';
						let value = '';
						switch(i) {
							case 0:
								title = "Registered users:";
								value = data.bots.users;
								break;
							case 1:
								title = "Probably humans:";
								value = data.bots.human;
								break;
							case 2:
								title = "Suspected bots:";
								value = data.bots.suspected;
								break;
							case 3:
								title = "Known bots:";
								value = data.bots.known;
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
				const botlist = document.getElementById('botmon__botslist'); /* Known bots */
				botlist.innerHTML = "<dt>Known bots (top 5)</dt>";

				let bots = BotMon.live.data.analytics.groups.knownBots.toSorted( (a, b) => {
					return b._pageViews.length - a._pageViews.length;
				});

				for (let i=0; i < Math.min(bots.length, 5); i++) {
					const dd = makeElement('dd');
					dd.appendChild(makeElement('span', {'class': 'has_icon bot bot_' + bots[i]._bot.id }, bots[i]._bot.n));
					dd.appendChild(makeElement('span', undefined, bots[i]._pageViews.length));
					botlist.appendChild(dd);
				}

				// update the suspected bot IP ranges list:
				const botIps = document.getElementById('botmon__today__botips');
				if (botIps) {
					botIps.appendChild(makeElement('dt', {}, "Bot IP ranges (top 5)"));

					const ipList = BotMon.live.data.analytics.getTopBotIPRanges(5);
					ipList.forEach( (ipInfo) => {
						const li = makeElement('dd');
						li.appendChild(makeElement('span', {'class': 'has_icon ipaddr ip' + ipInfo.typ }, ipInfo.ip));
						li.appendChild(makeElement('span', {'class': 'count' }, ipInfo.num));
						botIps.append(li)
					});
				}

				// update the top bot countries list:
				const botCountries = document.getElementById('botmon__today__countries');
				if (botCountries) {
					botCountries.appendChild(makeElement('dt', {}, "Bot Countries (top 5)"));
					const countryList = BotMon.live.data.analytics.getCountryList('likely_bot', 5);
					countryList.forEach( (cInfo) => {
						const cLi = makeElement('dd');
						cLi.appendChild(makeElement('span', {'class': 'has_icon country ctry_' + cInfo.iso.toLowerCase() }, cInfo.name));
						cLi.appendChild(makeElement('span', {'class': 'count' }, cInfo.count));
						botCountries.appendChild(cLi);
					});
				}

				// update the webmetrics overview:
				const wmoverview = document.getElementById('botmon__today__wm_overview');
				if (wmoverview) {
					const bounceRate = Math.round(data.totalVisits / data.totalPageViews * 100);

					wmoverview.appendChild(makeElement('dt', {}, "Overview"));
					for (let i = 0; i < 3; i++) { 
						const dd = makeElement('dd');
						let title = '';
						let value = '';
						switch(i) {
							case 0:
								title = "Total page views:";
								value = data.totalPageViews;
								break;
							case 1:
								title = "Total visitors (est.):";
								value = data.totalVisits;
								break;
							case 2:
								title = "Bounce rate (est.):";
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

					wmclients.appendChild(makeElement('dt', {}, "Top browsers (humans only)"));

					const clientList = BotMon.live.data.analytics.getTopBrowsers(5);
					if (clientList) {
						clientList.forEach( (cInfo) => {
							const cDd = makeElement('dd');
							cDd.appendChild(makeElement('span', {'class': 'has_icon client cl_' + cInfo.id }, ( cInfo.name ? cInfo.name : cInfo.id)));
							cDd.appendChild(makeElement('span', {
								'class': 'count',
								'title': cInfo.count + " page views"
							}, Math.round(cInfo.pct) + '%'));
							wmclients.appendChild(cDd);
						});
					}
				}

				// update the webmetrics platforms list:
				const wmplatforms = document.getElementById('botmon__today__wm_platforms');
				if (wmplatforms) {

					wmplatforms.appendChild(makeElement('dt', {}, "Top platforms (humans only)"));

					const pfList = BotMon.live.data.analytics.getTopPlatforms(5);
					if (pfList) {
						pfList.forEach( (pInfo) => {
							const pDd = makeElement('dd');
							pDd.appendChild(makeElement('span', {'class': 'has_icon platform pf_' + pInfo.id }, ( pInfo.name ? pInfo.name : pInfo.id)));
							pDd.appendChild(makeElement('span', {
								'class': 'count',
								'title': pInfo.count + " page views"
							}, Math.round(pInfo.pct) + '%'));
							wmplatforms.appendChild(pDd);
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
					el.innerText = "An error occurred. Data may be incomplete! See browser console for details";
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
								console.warn('Unknown list number.');
						}

						const details = makeElement('details', {
							'data-group': listId,
							'data-loaded': false
						});
						const title = details.appendChild(makeElement('summary'));
						title.appendChild(makeElement('span', {'class': 'title'}, listTitle));
						title.appendChild(makeElement('span', {'class': 'counter'}));
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
				if (data.ip == '127.0.0.1' || data.ip == '::1' ) ipType = '0';

				const platformName = (data._platform ? data._platform.n : 'Unknown');
				const clientName = (data._client ? data._client.n: 'Unknown');

				const li = make('li'); // root list item
				const details = make('details');
				const summary = make('summary');
				details.appendChild(summary);

				const span1 = make('span'); /* left-hand group */

				// country flag:
				span1.appendChild(make('span', {
					'class': 'icon_only country ctry_' + data.geo.toLowerCase(),
					'data-ctry': (data.geo | 'ZZ'),
					'title': "Country: " + ( data._country || "Unknown")
				}, ( data._country || "Unknown") ));

				if (data._type !== BM_USERTYPE.KNOWN_BOT) { /* No platform/client for bots */
					span1.appendChild(make('span', { /* Platform */
						'class': 'icon_only platform pf_' + (data._platform ? data._platform.id : 'unknown'),
						'title': "Platform: " + platformName
					}, platformName));

					span1.appendChild(make('span', { /* Client */
						'class': 'icon_only client client cl_' + (data._client ? data._client.id : 'unknown'),
						'title': "Client: " + clientName
					}, clientName));
				}

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

					
					/*span1.appendChild(make('span', { // IP-Address
						'class': 'has_icon ipaddr ip' + ipType,
						'title': "IP-Address: " + data.ip
					}, data.ip));*/

					span1.appendChild(make('span', { /* Internal ID */
						'class': 'has_icon session typ_' + data.typ,
						'title': "ID: " + data.id
					}, data.id));
				}

				summary.appendChild(span1);
				const span2 = make('span'); /* right-hand group */

				span2.appendChild(make('span', { /* page views */
					'class': 'has_icon pageviews',
					'title': data._pageViews.length + " page view(s)"
				}, data._pageViews.length));

				summary.appendChild(span2);

				// add details expandable section:
				details.appendChild(BotMon.live.gui.lists._makeVisitorDetails(data, type));

				li.appendChild(details);
				return li;
			},

			_makeVisitorDetails: function(data, type) {

				// shortcut for neater code:
				const make = BotMon.t._makeElement;

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

					dl.appendChild(make('dt', {}, "IP-Address:"));
					dl.appendChild(make('dd', {'class': 'has_icon ipaddr ip' + ipType}, data.ip));

					/*dl.appendChild(make('dt', {}, "ID:"));
					dl.appendChild(make('dd', {'class': 'has_icon ip' + data.typ}, data.id));*/
				}

				if (Math.abs(data._lastSeen - data._firstSeen) < 100) {
					dl.appendChild(make('dt', {}, "Seen:"));
					dl.appendChild(make('dd', {'class': 'seen'}, data._firstSeen.toLocaleString()));
				} else {
					dl.appendChild(make('dt', {}, "First seen:"));
					dl.appendChild(make('dd', {'class': 'firstSeen'}, data._firstSeen.toLocaleString()));
					dl.appendChild(make('dt', {}, "Last seen:"));
					dl.appendChild(make('dd', {'class': 'lastSeen'}, data._lastSeen.toLocaleString()));
				}

				dl.appendChild(make('dt', {}, "User-Agent:"));
				dl.appendChild(make('dd', {'class': 'agent'}, data.agent));

				dl.appendChild(make('dt', {}, "Languages:"));
				dl.appendChild(make('dd', {'class': 'langs'}, "Client accepts: [" + data.accept + "]; Page: [" + data.lang + ']'));

				if (data.geo && data.geo !=='') {
					dl.appendChild(make('dt', {}, "Location:"));
					dl.appendChild(make('dd', {
						'class': 'has_icon country ctry_' + data.geo.toLowerCase(),
						'data-ctry': data.geo,
						'title': "Country: " + data._country
					}, data._country + ' (' + data.geo + ')'));
				}

				/*dl.appendChild(make('dt', {}, "Visitor Type:"));
				dl.appendChild(make('dd', undefined, data._type ));*/

				dl.appendChild(make('dt', {}, "Session ID:"));
				dl.appendChild(make('dd', {'class': 'has_icon session typ_' + data.typ}, data.id));

				dl.appendChild(make('dt', {}, "Seen by:"));
				dl.appendChild(make('dd', undefined, data._seenBy.join(', ') ));

				dl.appendChild(make('dt', {}, "Visited pages:"));
				const pagesDd = make('dd', {'class': 'pages'});
				const pageList = make('ul');

				/* list all page views */
				data._pageViews.forEach( (page) => {
					const pgLi = make('li');

					let visitTimeStr = "Bounce";
					const visitDuration = page._lastSeen.getTime() - page._firstSeen.getTime();
					if (visitDuration > 0) {
						visitTimeStr = Math.floor(visitDuration / 1000) + "s";
					}

					pgLi.appendChild(make('span', {}, page.pg)); /* DW Page ID */
					if (page._ref) {
						pgLi.appendChild(make('span', {
							'data-ref': page._ref.host,
							'title': "Referrer: " + page._ref.full
						}, page._ref.site));
					} else {
						pgLi.appendChild(make('span', {
						}, "No referer"));
					}
					pgLi.appendChild(make('span', {}, ( page._seenBy ? page._seenBy.join(', ') : '—') + '; ' + page._tickCount));
					pgLi.appendChild(make('span', {}, BotMon.t._formatTime(page._firstSeen)));

					// get the time difference:
					const tDiff = BotMon.t._formatTimeDiff(page._firstSeen, page._lastSeen);
					if (tDiff) {
						pgLi.appendChild(make('span', {'class': 'visit-length', 'title': 'Last seen: ' + page._lastSeen.toLocaleString()}, tDiff));
					} else {
						pgLi.appendChild(make('span', {
							'class': 'bounce',
							'title': "Visitor bounced"}, "Bounce"));
					}

					pageList.appendChild(pgLi);
				});
				pagesDd.appendChild(pageList);
				dl.appendChild(pagesDd);

				/* bot evaluation rating */
				if (data._type !== BM_USERTYPE.KNOWN_BOT && data._type !== BM_USERTYPE.KNOWN_USER) {
					dl.appendChild(make('dt', undefined, "Bot rating:"));
					dl.appendChild(make('dd', {'class': 'bot-rating'}, ( data._botVal ? data._botVal : '–' ) + ' (of ' + BotMon.live.data.rules._threshold + ')'));

					/* add bot evaluation details: */
					if (data._eval) {
						dl.appendChild(make('dt', {}, "Bot evaluation details:"));
						const evalDd = make('dd');
						const testList = make('ul',{
							'class': 'eval'
						});
						data._eval.forEach( test => {

							const tObj = BotMon.live.data.rules.getRuleInfo(test);
							let tDesc = tObj ? tObj.desc : test;

							// special case for Bot IP range test:
							if (tObj.func == 'fromKnownBotIP') {
								const rangeInfo = BotMon.live.data.rules.getBotIPInfo(data.ip);
								if (rangeInfo) {
									tDesc += ' (' + (rangeInfo.label ? rangeInfo.label : 'Unknown') + ')';
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
				// return the element to add to the UI:
				return dl;
			}

		}
	}
};

/* launch only if the BotMon admin panel is open: */
if (document.getElementById('botmon__admin')) {
	BotMon.init();
}