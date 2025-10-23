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
		$code = "document._botmon = {t0: Date.now(), session: " . json_encode($this->sessionId) . ", seed: " . json_encode($this->getConf('captchaSeed')) . ", ip: " . json_encode($_SERVER['REMOTE_ADDR']) . "};" . NL;
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

		$useCaptcha = $this->getConf('useCaptcha');

		if ($useCaptcha !== 'disabled' && $this->checkCaptchaCookie()) {
			echo '<h1 class="sectionedit1">'; tpl_pagetitle(); echo "</h1>\n"; // always show the original page title
			$event->preventDefault(); // don't show normal content
			switch ($useCaptcha) {
				case 'blank':
					$this->insertBlankBox();  // show dada filler instead of text
					break;
				case 'dada':
					$this->insertDadaFiller();  // show dada filler instead of text
					break;
			}
			$this->insertCaptchaLoader(); // and load the captcha
		}
	}

	private function checkCaptchaCookie() {

		$cookieVal = isset($_COOKIE['DWConfirm']) ? $_COOKIE['DWConfirm'] : null;

		$today = substr((new DateTime())->format('c'), 0, 10);

		$raw = $this->getConf('captchaSeed') . '|' . $_SERVER['SERVER_NAME'] . '|' . $_SERVER['REMOTE_ADDR'] . '|' . $today;
		$expected = hash('sha256', $raw);

		//echo '<ul><li>cookie: ' . $cookieVal . '</li><li>expected: ' . $expected . '</li><li>matches: ' .($cookieVal == $expected ? 'true' : 'false') . '</li></ul>';

		return $cookieVal !== $expected;
	}

	private function insertCaptchaLoader() {
		echo '<script>' . NL;

		// add the deferred script loader::
		echo  DOKU_TAB . "addEventListener('DOMContentLoaded', function(){" . NL;
		echo  DOKU_TAB . DOKU_TAB . "const cj=document.createElement('script');" . NL;
		echo  DOKU_TAB . DOKU_TAB . "cj.async=true;cj.defer=true;cj.type='text/javascript';" . NL;
		echo  DOKU_TAB . DOKU_TAB . "cj.src='".DOKU_BASE."lib/plugins/botmon/captcha.js';" . NL;
		echo  DOKU_TAB . DOKU_TAB . "document.getElementsByTagName('head')[0].appendChild(cj);" . NL;
		echo  DOKU_TAB . "});";
		echo '</script>' . NL;

	}

	// inserts a blank box to ensure there is enough space for the captcha:
	private function insertBlankBox() {

		echo '<p style="min-height: 100px;">&nbsp;</p>';
	}
	
	/* Generates a few paragraphs of Dada text to show instead of the article content */
	private function insertDadaFiller() {

		global $conf;
		global $TOC;
		global $ID;

		// list of languages to search for the wordlist
		$langs = array_unique([$conf['lang'], 'la']);

		// find path to the first available wordlist:
		foreach ($langs as $lang) {
			$filename = __DIR__ .'/lang/' . $lang . '/wordlist.txt'; /* language-specific wordlist */
			if (file_exists($filename)) {
				break;
			}
		}

		// load the wordlist file:
		if (file_exists($filename)) {
			$words = array();
			$totalWeight = 0;
			$lines = file($filename, FILE_SKIP_EMPTY_LINES);
			foreach ($lines as $line) {
				$arr = explode("\t", $line);
				$arr[1] = ( count($arr) > 1 ? (int) trim($arr[1]) : 1 );
				$totalWeight += (int) $arr[1];
				array_push($words, $arr);
			}
		} else {
			echo '<script> console.log("Can’t generate filler text: wordlist file not found!"); </script>';
			return;
		}

		// If a TOC exists, use it for the headlines:
		if(is_array($TOC)) {
			$toc = $TOC;
		} else {
			$meta = p_get_metadata($ID, '', METADATA_RENDER_USING_CACHE);
			//$tocok = (isset($meta['internal']['toc']) ? $meta['internal']['toc'] : $tocok = true);
			$toc = isset($meta['description']['tableofcontents']) ? $meta['description']['tableofcontents'] : null;
		}
		if (!$toc) { // no TOC, generate my own:
			$hlCount = mt_rand(0, (int) $conf['tocminheads']);
			$toc = array();
			for ($i=0; $i<$hlCount; $i++) {
				array_push($toc, $this->dadaMakeHeadline($words, $totalWeight)); // $toc
			}
		}
		
		// if H1 heading is not in the TOC, add a chappeau section:
		$chapeauCount = mt_rand(1, 3);
		if ((int) $conf['toptoclevel'] > 1) {
			echo "<div class=\"level1\">\n";
			for ($i=0; $i<$chapeauCount; $i++) {
				echo $this->dadaMakeParagraph($words, $totalWeight);
			}
			echo "</div>\n";
		}

		//  text sections for each sub-headline:
		foreach ($toc as $hl) {
			echo $this->dadaMakeSection($words, $totalWeight, $hl);
		}
	}

	private function dadaMakeSection($words, $totalWeight, $hl) {

		global $conf;

		// how many paragraphs?
		$paragraphCount = mt_rand(1, 4);

		// section level
		$topTocLevel = (int) $conf['toptoclevel'];
		$secLevel = $hl['level'] + 1;;

		// return value:
		$sec = "";

		// make a headline:
		if ($topTocLevel > 1 || $secLevel > 1) {
			$sec .= "<h{$secLevel} id=\"{$hl['hid']}\">{$hl['title']}</h{$secLevel}>\n";
		}

		// add the paragraphs:
		$sec .= "<div class=\"level{$secLevel}\">\n";
		for ($i=0; $i<$paragraphCount; $i++) {
			$sec .= $this->dadaMakeParagraph($words, $totalWeight);
		}
		$sec .= "</div>\n";

		return $sec;
	}

	private function dadaMakeHeadline($words, $totalWeight) {

		// how many words to generate?
		$wordCount = mt_rand(2, 5);

		// function returns an array:
		$r = Array();

		// generate the headline:
		$hlArr = array();
		for ($i=0; $i<$wordCount; $i++) {
			array_push($hlArr, $this->dadaSelectRandomWord($words, $totalWeight));
		}

		$r['title'] =  ucfirst(implode(' ', $hlArr));

		$r['hid'] = preg_replace('/[^\w\d\-]+/i', '_', strtolower($r['title']));
		$r['type'] = 'ul'; // always ul!
		$r['level'] = 1; // always level 1 for now

		return $r;
	}

	private function dadaMakeParagraph($words, $totalWeight) {

		// how many words to generate?
		$sentenceCount = mt_rand(2, 5);

		$paragraph = array();
		for ($i=0; $i<$sentenceCount; $i++) {
			array_push($paragraph, $this->dadaMakeSentence($words, $totalWeight));
		}

		return "<p>\n" . implode(' ', $paragraph) . "\n</p>\n";
		
	}

	private function dadaMakeSentence($words, $totalWeight) {
		
		// how many words to generate?
		$wordCount = mt_rand(4, 20);

		// generate the sentence:
		$sentence = array();
		for ($i=0; $i<$wordCount; $i++) {
			array_push($sentence, $this->dadaSelectRandomWord($words, $totalWeight));
		}

		return ucfirst(implode(' ', $sentence)) . '.';

	}

	private function dadaSelectRandomWord($list, $totalWeight) {

		// get a random selection:
		$rand = mt_rand(0, $totalWeight);

		// match the selection to the weighted list:
		$cumulativeWeight = 0;
		for ($i=0; $i<count($list); $i++) {
			$cumulativeWeight += $list[$i][1];
			if ($cumulativeWeight >= $rand) {
				return $list[$i][0];
			}
		}
		return '***';
	}

}