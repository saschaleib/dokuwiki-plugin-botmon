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

		global $ACT;

		// insert header data into the page:
		if ($ACT == 'show') {
			$controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'insertHeader');
		} else if ($ACT == 'admin' && isset($_REQUEST['page']) && $_REQUEST['page'] == 'botmon') {
			$controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'insertAdminHeader');
		}
	
		// Override the page rendering, if a captcha needs to be displayed:
		if ($ACT !== 'admin') {
			$controller->register_hook('TPL_ACT_RENDER', 'BEFORE', $this, 'showCaptcha');
		}

		// write to the log after the page content was displayed:
		$controller->register_hook('TPL_CONTENT_DISPLAY', 'AFTER', $this, 'writeServerLog');

	}

	/* session information */
	private $sessionId = null;
	private $sessionType = '';

	/**
	 * Inserts tracking code to the page header
	 * (only called on 'show' actions)
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
		$code = "document._botmon = {'t0': Date.now(), 'session': '" . json_encode($this->sessionId) . "'};" . NL;
		if ($username) {
			$code .= DOKU_TAB . DOKU_TAB . 'document._botmon.user = "' . $username . '";'. NL;
		}

		// add the deferred script loader::
		$code .= DOKU_TAB . DOKU_TAB . "addEventListener('DOMContentLoaded', function(){" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "const e=document.createElement('script');" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "e.async=true;e.defer=true;" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "e.src='".DOKU_BASE."lib/plugins/botmon/client.js';" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "document.getElementsByTagName('head')[0].appendChild(e);" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "});";

		$event->data['script'][] = ['_data' => $code];
	}

	/**
	 * Inserts tracking code to the page header
	 * (only called on 'show' actions)
	 *
	 * @param Event $event event object by reference
	 * @return void
	 */
	public function insertAdminHeader(Event $event, $param) {

		$event->data['link'][] = ['rel' => 'stylesheet', 'href' => DOKU_BASE.'lib/plugins/botmon/admin.css', 'defer' => 'defer'];
		$event->data['script'][] = ['src' => DOKU_BASE.'lib/plugins/botmon/admin.js', 'defer' => 'defer', '_data' => ''];
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
			$_SERVER['REMOTE_ADDR'], /* remote IP */
			$pageId, /* page ID */
			$this->sessionId, /* Session ID */
			$this->sessionType, /* session ID type */
			$username, /* user name */
			$_SERVER['HTTP_USER_AGENT'] ?? '', /* User agent */
			$_SERVER['HTTP_REFERER'] ?? '', /* HTTP Referrer */
			substr($conf['lang'],0,2), /* page language */
			implode(',', array_unique(array_map( function($it) { return substr(trim($it),0,2); }, explode(',',trim($_SERVER['HTTP_ACCEPT_LANGUAGE'], " \t;,*"))))), /* accepted client languages */
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

		$country = ( $_SERVER['REMOTE_ADDR'] == '127.0.0.1' ? 'local' : 'ZZ' ); // default if no geoip is available!

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
		if (!$this->sessionId) { /* no PHP session ID, try IP address */
			$this->sessionId = $_SERVER['REMOTE_ADDR'];
			$this->sessionType = 'ip';
		}
		if (!$this->sessionId) { /* if everything else fails, just us a random ID */
			$this->sessionId = rand(1000000, 9999999);
			$this->sessionType = 'rand';
		}
	}

	public function showCaptcha(Event $event) {

		if ($this->getConf('useCaptcha') && $this->checkCaptchaCookie()) {

				$event->preventDefault(); // don't show normal content
				$this->insertDadaFiller(); // show dada filler instead!
				$this->insertCaptchaLoader(); // and load the captcha

		} else {
			echo '<p>Normal page.</p>';
		}
	}

	private function checkCaptchaCookie() {

		$cookieVal = isset($_COOKIE['_c_']) ? $_COOKIE['_c_'] : '';
		$seed = $this->getConf('captchaSeed');

		return ($cookieVal == $seed ? 0 : 1); // #TODO: encrypt with other data
	}

	private function insertCaptchaLoader() {
		
	}

	private function insertDadaFiller() {
		// #TODO: make a dada filler

		echo '<h1>'; tpl_pagetitle(); echo "</h1>\n";

		echo '<script> alert("Hello world!"); </script>';

		echo "<p>Placeholder text while the captcha is being displayed.</p>\n";


	}

}