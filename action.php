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

	public function __construct() {

		// determine if a captcha should be loaded:
		$this->showCaptcha = 'Z';

		$useCaptcha = $this->getConf('useCaptcha'); // should we show a captcha?

		if ($useCaptcha !== 'disabled') {
			if ($_SERVER['REQUEST_METHOD'] == 'HEAD') {
				$this->showCaptcha = 'H'; // Method is HEAD, no need for captcha
			} elseif ($this->captchaWhitelisted()) {
				$this->showCaptcha = 'W'; // IP is whitelisted, no captcha
			} elseif ($this->hasCaptchaCookie()) {
				$this->showCaptcha = 'N'; // No, user already has a cookie, don't show the captcha
			} else {
				$this->showCaptcha = 'Y'; // Yes, show the captcha
			}
		}
	}

	/**
	 * Registers a callback functions
	 *
	 * @param EventHandler $controller DokuWiki's event controller object
	 * @return void
	 */
	public function register(EventHandler $controller) {

		global $ACT;

		// populate the session id and type:
		$this->setSessionInfo();

		// insert header data into the page:
		if ($ACT == 'show' || $ACT == 'edit' || $ACT == 'media') {
			$controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'insertHeader');

			// Override the page rendering, if a captcha needs to be displayed:
			$controller->register_hook('TPL_ACT_RENDER', 'BEFORE', $this, 'insertCaptchaCode');

		} else if ($ACT == 'admin' && isset($_REQUEST['page']) && $_REQUEST['page'] == 'botmon') {
			$controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'insertAdminHeader');
		} 

		// also show a captcha before the image preview
		$controller->register_hook('TPL_IMG_DISPLAY', 'BEFORE', $this, 'showImageCaptcha');

		// write to the log after the page content was displayed:
		$controller->register_hook('TPL_CONTENT_DISPLAY', 'AFTER', $this, 'writeServerLog');

	}

	/* session information */
	private $sessionId = null;
	private $sessionType = '';
	private $showCaptcha = 'X';

	/**
	 * Inserts tracking code to the page header
	 * (only called on 'show' actions)
	 *
	 * @param Event $event event object by reference
	 * @return void
	 */
	public function insertHeader(Event $event, $param) {

		global $INFO;


		// build the tracker code:
		$code = $this->getBMHeader();

		// add the deferred script loader::
		$code .= DOKU_TAB . DOKU_TAB . "addEventListener('DOMContentLoaded', function(){" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "const e=document.createElement('script');" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "e.async=true;e.defer=true;" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "e.src='".DOKU_BASE."lib/plugins/botmon/client.js';" . NL;
		$code .= DOKU_TAB . DOKU_TAB . DOKU_TAB . "document.getElementsByTagName('head')[0].appendChild(e);" . NL;
		$code .= DOKU_TAB . DOKU_TAB . "});";
		$event->data['script'][] = ['_data' => $code];
	}

	/* create the BM object code for insertion into a script element: */
	private function getBMHeader() {
	
		// build the tracker code:
		$code = DOKU_TAB . DOKU_TAB . "document._botmon = {t0: Date.now(), session: " . json_encode($this->sessionId) . ", seed: " . json_encode($this->getConf('captchaSeed')) . ", ip: " . json_encode($_SERVER['REMOTE_ADDR']) . "};" . NL;

		// is there a user logged in?
		$username = ( !empty($INFO['userinfo']) && !empty($INFO['userinfo']['name']) ?  $INFO['userinfo']['name'] : '');
		if ($username) {
			$code .= DOKU_TAB . DOKU_TAB . 'document._botmon.user = "' . $username . '";'. NL;
		}

		return $code;

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
			$this->getCountryCode(), /* GeoIP country code */
			$this->showCaptcha /* show captcha? */
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

	private function setSessionInfo() {

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

		if (!$this->sessionId) { /* if all fails, use random data */
			$this->sessionId = rand(100000000, 999999999);
			$this->sessionType = 'rnd';
		}

	}

	public function insertCaptchaCode(Event $event) {

		$useCaptcha = $this->getConf('useCaptcha'); // which background to show?

		// only if we previously determined that we need a captcha:
		if ($this->showCaptcha == 'Y') {

			echo '<h1 class="sectionedit1">'; tpl_pagetitle(); echo "</h1>\n"; // always show the original page title
			$event->preventDefault(); // don't show normal content
			switch ($useCaptcha) {
				case 'loremipsum':
					$this->insertLoremIpsum();  // show dada filler instead of text
					break;
				case 'dada':
					$this->insertDadaFiller();  // show dada filler instead of text
					break;
			}

			// insert the captcha loader code:
			echo '<script>' . NL;

			// add the deferred script loader::
			echo  DOKU_TAB . "addEventListener('DOMContentLoaded', function(){" . NL;
			echo  DOKU_TAB . DOKU_TAB . "const cj=document.createElement('script');" . NL;
			echo  DOKU_TAB . DOKU_TAB . "cj.async=true;cj.defer=true;cj.type='text/javascript';" . NL;
			echo  DOKU_TAB . DOKU_TAB . "cj.src='".DOKU_BASE."lib/plugins/botmon/captcha.js';" . NL;
			echo  DOKU_TAB . DOKU_TAB . "document.getElementsByTagName('head')[0].appendChild(cj);" . NL;
			echo  DOKU_TAB . "});" . NL;

			// add the translated strings for the captcha:
			echo  DOKU_TAB . '$BMLocales = {' . NL;
			echo  DOKU_TAB . DOKU_TAB . '"dlgTitle": ' . json_encode($this->getLang('bm_dlgTitle')) . ',' . NL;
			echo  DOKU_TAB . DOKU_TAB . '"dlgSubtitle": ' . json_encode($this->getLang('bm_dlgSubtitle')) . ',' . NL;
			echo  DOKU_TAB . DOKU_TAB . '"dlgConfirm": ' . json_encode($this->getLang('bm_dlgConfirm')) . ',' . NL;
			echo  DOKU_TAB . DOKU_TAB . '"dlgChecking": ' . json_encode($this->getLang('bm_dlgChecking')) . ',' . NL;
			echo  DOKU_TAB . DOKU_TAB . '"dlgLoading": ' . json_encode($this->getLang('bm_dlgLoading')) . ',' . NL;
			echo  DOKU_TAB . DOKU_TAB . '"dlgError": ' . json_encode($this->getLang('bm_dlgError')) . ',' . NL;
			echo  DOKU_TAB . '};' . NL;
			
			echo '</script>' . NL;
		}
	}

	public function showImageCaptcha(Event $event, $param) {
		
		$useCaptcha = $this->getConf('useCaptcha');

		echo '<script>' . $this->getBMHeader($event, $param) . '</script>';

		$cCode = '-';
		if ($useCaptcha !== 'disabled') {
			if ($this->captchaWhitelisted()) {
				$cCode = 'W'; // whitelisted
			}
			elseif ($this->hasCaptchaCookie()) {
				$cCode  = 'N'; // user already has a cookie
			}
			else {
				$cCode  = 'Y'; // show the captcha

				echo '<svg width="100%" height="100%" viewBox="0 0 800 400" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M1,1l798,398" style="fill:none;stroke:#f00;stroke-width:1px;"/><path d="M1,399l798,-398" style="fill:none;stroke:#f00;stroke-width:1px;"/><rect x="1" y="1" width="798" height="398" style="fill:none;stroke:#000;stroke-width:1px;"/></svg>'; // placeholder image
				$event->preventDefault(); // don't show normal content
				
				// TODO Insert dummy image
				$this->insertCaptchaLoader(); // and load the captcha
			}
		};

		$this->showCaptcha = $cCode; // store the captcha code for the logfile
	}

	private function hasCaptchaCookie() {

		$cookieVal = isset($_COOKIE['DWConfirm']) ? $_COOKIE['DWConfirm'] : null;

		$today = substr((new DateTime())->format('c'), 0, 10);

		$raw = $this->getConf('captchaSeed') . '|' . $_SERVER['SERVER_NAME'] . '|' . $_SERVER['REMOTE_ADDR'] . '|' . $today;
		$expected = hash('sha256', $raw);

		//echo '<ul><li>cookie: ' . $cookieVal . '</li><li>expected: ' . $expected . '</li><li>matches: ' .($cookieVal == $expected ? 'true' : 'false') . '</li></ul>';

		return $cookieVal == $expected;
	}

	// check if the visitor's IP is on a whitelist:
	private function captchaWhitelisted() {

		// normalise IP address:
		$ip = inet_pton($_SERVER['REMOTE_ADDR']);

		// find which file to open:
		$prefixes = ['user', 'default'];
		foreach ($prefixes as $pre) {
			$filename = __DIR__ .'/config/' . $pre . '-whitelist.txt';
			if (file_exists($filename)) {
				break;
			}
		}

		if (file_exists($filename)) {
			$lines = file($filename, FILE_SKIP_EMPTY_LINES);
			foreach ($lines as $line) {
				if (trim($line) !== '' && !str_starts_with($line, '#')) {
					$col = explode("\t", $line);
					if (count($col) >= 2) {						
						$from = inet_pton($col[0]);
						$to = inet_pton($col[1]);

						if ($ip >= $from && $ip <= $to) {
							return true; /* IP whitelisted */
						}
					}
				}
			}
		}
		return false; /* IP not found in whitelist */
	}

	// inserts a blank box to ensure there is enough space for the captcha:
	private function insertLoremIpsum() {

		echo '<div class="level1">' . NL;
		echo '<p>' . NL . 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'. NL . '</p>' . NL;
		echo '<p>' . NL . 'At vero eos et accusamus et iusto odio dignissimos ducimus, qui blanditiis praesentium voluptatum deleniti atque corrupti, quos dolores et quas molestias excepturi sint, obcaecati cupiditate non provident, similique sunt in culpa, qui officia deserunt mollitia animi, id est laborum et dolorum fuga.'. NL . '</p>' . NL;
		echo '</div>' . NL;

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