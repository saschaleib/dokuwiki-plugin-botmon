<?php

use dokuwiki\Extension\EventHandler;
use dokuwiki\Extension\Event;

/**
 * Action Component for the Monitor Plugin
 *
 * @license	GPL 3 (http://www.gnu.org/licenses/gpl.html)
 * @author	 Sascha Leib <sascha.leib(at)kolmio.com>
 */

class action_plugin_monitor extends DokuWiki_Action_Plugin {

	/**
	 * Registers a callback functions
	 *
	 * @param EventHandler $controller DokuWiki's event controller object
	 * @return void
	 */
	public function register(EventHandler $controller) {
		$controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'insertHeader');
	}

	/**
	 * Inserts tracking code to the page header
	 *
	 * @param Event $event event object by reference
	 * @return void
	 */
	public function insertHeader(Event $event, $param) {

		global $INFO;

		// is there a user logged in?
		$username = ( !empty($INFO['userinfo']) && !empty($INFO['userinfo']['name'])
					?  $INFO['userinfo']['name'] : null);

		// build the tracker code:
		$code = NL . DOKU_TAB . "document._monitor = {'t0': Date.now()};" . NL;
		if ($username) {
			$code .= DOKU_TAB . 'document._monitor.user = "' . $username . '";'. NL;
		}
		$code .= DOKU_TAB . "addEventListener('load',function(){" . NL;

		$code .= DOKU_TAB . DOKU_TAB . "const e=document.createElement('script');" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "e.async=true;e.defer=true;" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "e.src='".DOKU_BASE."lib/plugins/monitor/client.js';" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "document.getElementsByTagName('head')[0].appendChild(e);" . NL;
		$code .= DOKU_TAB . "});" . NL;

		$event->data['script'][] = [
			'_data'   => $code
        ];

		/* Write out client info to a server log: */

		// what is the session identifier?
		$sessionId = $_COOKIE['DokuWiki'] ?? null;
		$sessionType = 'dw';
		if (!$sessionId) {
			if (session_id()) {
				// if a session ID is set, use it
				$sessionId = session_id();
				$sessionType = 'php';
			} else {
				// if no session ID is set, use the ip address:
				$sessionId = $_SERVER['REMOTE_ADDR'] ?? '';
				$sessionType = 'ip';
			}
		}

		$logArr = Array(
			$_SERVER['REMOTE_ADDR'] ?? '', /* remote IP */
			$INFO['id'] ?? '', /* page ID */
			$sessionId, /* Session ID */
			$sessionType,
			$username,
			$_SERVER['HTTP_USER_AGENT'] ?? '' /* User agent */
		);

		//* create the log line */
		$filename = __DIR__ .'/logs/' . gmdate('Y-m-d') . '.srv'; /* use GMT date for filename */
		$logline = gmdate('Y-m-d H:i:s'); /* use GMT time for log entries */
		foreach ($logArr as $tab) {
			$logline .= "\t" . $tab;
		};

		/* write the log line to the file */
		$logfile = fopen($filename, 'a');
		if (!$logfile) die();
		if (fwrite($logfile, $logline . "\n") === false) {
			fclose($logfile);
			die();
		}

		/* Done */
		fclose($logfile);

	}

}