<?php

use dokuwiki\Extension\EventHandler;
use dokuwiki\Extension\Event;
use dokuwiki\Logger;

/**
 * Action Component for the Bot Monitoring Plugin
 *
 * @license	GPL 3 (http://www.gnu.org/licenses/gpl.html)
 * @author	 Sascha Leib <sascha.leib(at)kolmio.com>
 */

class action_plugin_botmon extends DokuWiki_Action_Plugin {

	/**
	 * Registers a callback functions
	 *
	 * @param EventHandler $controller DokuWiki's event controller object
	 * @return void
	 */
	public function register(EventHandler $controller) {

		// insert header data into the page:
		$controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'insertHeader');

		// write to the log after the page content was displayed:
		$controller->register_hook('TPL_CONTENT_DISPLAY', 'AFTER', $this, 'writeServerLog');

	}

	/* session information */
	private $sessionId = null;
	private $sessionType = '';
	private $ipAddress = null;

	/**
	 * Inserts tracking code to the page header
	 *
	 * @param Event $event event object by reference
	 * @return void
	 */
	public function insertHeader(Event $event, $param) {

		global $INFO;

		// populate the session id and type:
		$this->getSessionInfo();

		// is there a user logged in?
		$username = ( !empty($INFO['userinfo']) && !empty($INFO['userinfo']['name']) ?  $INFO['userinfo']['name'] : '');

		// build the tracker code:
		$code = NL . DOKU_TAB . "document._botmon = {'t0': Date.now(), 'session': '" . json_encode($this->sessionId) . "'};" . NL;
		if ($username) {
			$code .= DOKU_TAB . 'document._botmon.user = "' . $username . '";'. NL;
		}

		// add the deferred script loader::
		$code .= DOKU_TAB . "addEventListener('DOMContentLoaded', function(){" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "const e=document.createElement('script');" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "e.async=true;e.defer=true;" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "e.src='".DOKU_BASE."lib/plugins/botmon/client.js';" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "document.getElementsByTagName('head')[0].appendChild(e);" . NL;
		$code .= DOKU_TAB . "});" . NL . DOKU_TAB;

		$event->data['script'][] = ['_data' => $code];
	}

	/**
	 * Writes data to the server log.
	 *
	 * @return void
	 */
	public function writeServerLog(Event $event, $param) {

		global $conf;
		global $INFO;

		// is there a user logged in?
		$username = ( !empty($INFO['userinfo']) && !empty($INFO['userinfo']['name'])
					?  $INFO['userinfo']['name'] : '');



		// clean the page ID
		$pageId = preg_replace('/[\x00-\x1F]/', "\u{FFFD}", $INFO['id'] ?? '');

		// create the log array:
		$logArr = Array(
			$this->ipAddress, /* remote IP */
			$pageId, /* page ID */
			$this->sessionId, /* Session ID */
			$this->sessionType, /* session ID type */
			$username, /* user name */
			$_SERVER['HTTP_USER_AGENT'] ?? '', /* User agent */
			$_SERVER['HTTP_REFERER'] ?? '', /* HTTP Referrer */
			substr($conf['lang'],0,2), /* page language */
			implode(',', array_unique(array_map( function($it) { return substr($it,0,2); }, explode(',',trim($_SERVER['HTTP_ACCEPT_LANGUAGE'], " \t;,*"))))), /* accepted client languages */
			$this->getCountryCode() /* GeoIP country code */
		);

		//* create the log line */
		$filename = __DIR__ .'/logs/' . gmdate('Y-m-d') . '.srv.txt'; /* use GMT date for filename */
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

	private function getCountryCode() {

		$country = ( $this->ipAddress == 'localhost' ? 'local' : 'ZZ' ); // default if no geoip is available!

		$lib = $this->getConf('geoiplib'); /* which library to use? (can only be phpgeoip or disabled) */

		try {

			// use GeoIP module?
			if ($lib == 'phpgeoip' && extension_loaded('geoip') && geoip_db_avail(GEOIP_COUNTRY_EDITION)) { // Use PHP GeoIP module
				$result = geoip_country_code_by_name($_SERVER['REMOTE_ADDR']);
				$country = ($result ? $result : $country);
			}
		} catch (Exception $e) {
			Logger::error('BotMon Plugin: GeoIP Error', $e->getMessage());
		}

		return $country;
	}

	private function getSessionInfo() {

		$this->ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
		if ($this->ipAddress == '127.0.0.1' || $this->ipAddress == '::1') $this->ipAddress = 'localhost';

		// what is the session identifier?
		if (isset($_SESSION)) {
			$sesKeys = array_keys($_SESSION); /* DokuWiki Session ID preferred */
			foreach ($sesKeys as $key) {
				if (substr($key, 0, 2) == 'DW') {
					$this->sessionId = $key;
					$this->sessionType = 'dw';
					return;
				}
			}
		}
		if (!$this->sessionId) { /* no DokuWiki Session ID, try PHP session ID */
			$this->sessionId = session_id();
			$this->sessionType = 'php';
		}
		if (!$this->sessionId && $this->ipAddress) { /* no PHP session ID, try IP address */
			$this->sessionId = $this->ipAddress;
			$this->sessionType = 'ip';
		}
		if (!$this->sessionId) { /* if everything else fails, just us a random ID */
			$this->sessionId = rand(1000000, 9999999);
			$this->sessionType = 'rand';
		}
	}
}