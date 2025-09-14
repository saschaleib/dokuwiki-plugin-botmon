botmon_client = {
	init: function() {

		/* send the page view request: */
		this._onPageView(this._src.replace( this._scriptName, '/pview.php'));

		/* send the first heartbeat signal after x seconds: */
		setTimeout(this._onHeartbeat.bind(this, this._src.replace( this._scriptName, '/tick.php')),this._heartbeat * 1000);
	},

	/* keep a reference to the script URL: */
	_src: document.currentScript.src,

	/* heartbeat signal every x seconds: */
	_heartbeat: 30,

	/* name of this script (with slash): */
	_scriptName: '/client.js',

	/* function to init page data on server: */
	_onPageView: async function(url) {
		try {
			/* collect the data to send: */
			const visit = {
				'pg': JSINFO.id,
				'u': document._botmon.user || null,
				'lg': navigator.language.substring(0,2),
				'lt': ( document._botmon ? Date.now() - document._botmon.t0 : null),
				'id': (document._botmon.session || 'null').replaceAll('\"', ''),
				'r': document.referrer /*,
				'tz': new Date().getTimezoneOffset(),
				'url': window.location.href,
				'scr': screen.width+':'+screen.height,
				'l': navigator.languages */
			}
	
			/* compile to a FormData object: */
			const data = new FormData();
			data.append( "pageview", JSON.stringify( visit ) );
	
			/* send the request */
			const response = await fetch(url + '?t=' + Date.now(), {
				method: 'POST',
				body: data
			});
			if (!response.ok) {
				throw new Error(response.status + ' ' + response.statusText + ' - ' + url);
			}
		} catch (err) {
			console.error('Error: ', err);
		}
	},

	/* function to call regularly to show the user is still on the page: */
	_onHeartbeat: async function(url) {
		//console.info('botmon_client._onHeartbeat', url);

		let uid = document._botmon.user || null;
		let sessionId = (document._botmon.session || 'null').replaceAll('\"', '')

		try {
			const req = '?p=' + encodeURIComponent(JSINFO.id)
					+ '&t=' + encodeURIComponent(Date.now())
					+ ( sessionId ? '&id=' + encodeURIComponent(sessionId) : '')
					+ ( uid ? '&u=' + encodeURIComponent(uid) : '');
			const response = await fetch(url + req, {
				/*method: 'HEAD'*/
			});
			if (!response.ok) {
				throw new Error(response.status + ' ' + response.statusText + ' - ' + url);
			}
		} catch (err) {
			console.error(err);
		} finally {
			/* send the next heartbeat signal after x seconds: */
		//	setTimeout(this._onHeartbeat.bind(this, this._src.replace( this._scriptName, '/tick.php')),this._heartbeat * 1000);
		}
	}
}

// init the script:
botmon_client.init();